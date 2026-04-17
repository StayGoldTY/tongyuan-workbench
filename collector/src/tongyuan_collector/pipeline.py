from __future__ import annotations

from hashlib import sha256
from typing import Any

from .adapters.code_repository import CodeRepositoryAdapter
from .adapters.sqlite_chat_archive import SqliteChatArchiveAdapter
from .chunking import KnowledgeChunker
from .contracts import IngestionBatch, KnowledgeChunkRecord, KnowledgeUnitRecord, SourceSyncStatus
from .embedding import OpenAICompatibleEmbedder
from .redaction import redact_text
from .settings import CollectorSettings
from .source_catalog import discover_sources, to_catalog_record
from .summaries import KnowledgeNarrator
from .sync_client import SyncClient


class CollectorPipeline:
    def __init__(self, settings: CollectorSettings) -> None:
        self._settings = settings
        self._chunker = KnowledgeChunker(
            max_characters=settings.max_chunk_characters,
            overlap_characters=settings.chunk_overlap_characters,
        )
        self._narrator = KnowledgeNarrator()
        self._embedder = OpenAICompatibleEmbedder(settings)
        self._sync_client = SyncClient(settings)
        self._adapters = {
            "code_repository": CodeRepositoryAdapter(),
            "sqlite_chat_archive": SqliteChatArchiveAdapter(),
        }

    def discover(self) -> list[dict[str, Any]]:
        return [to_catalog_record(source).to_payload() for source in discover_sources(self._settings)]

    def sync(self) -> dict[str, Any]:
        catalog_records = []
        sync_statuses: list[SourceSyncStatus] = []
        prepared_units: list[KnowledgeUnitRecord] = []

        for source in discover_sources(self._settings):
            catalog_records.append(to_catalog_record(source))
            if source.health != "ready":
                sync_statuses.append(
                    SourceSyncStatus(
                        source_key=source.source_key,
                        workspace=source.workspace,
                        source_app=source.source_app,
                        status="skipped",
                        discovered_units=0,
                        uploaded_units=0,
                        message="Source root was not found on disk.",
                    )
                )
                continue

            adapter = self._adapters[source.adapter_key]
            try:
                raw_units = adapter.collect(source, self._settings)
                if not raw_units:
                    sync_statuses.append(
                        SourceSyncStatus(
                            source_key=source.source_key,
                            workspace=source.workspace,
                            source_app=source.source_app,
                            status="skipped",
                            discovered_units=0,
                            uploaded_units=0,
                            message="No readable units were extracted from this source.",
                        )
                    )
                    continue
                prepared_batch = [self._prepare_unit(unit) for unit in raw_units if unit.content_redacted.strip()]
                prepared_units.extend(prepared_batch)
                sync_statuses.append(
                    SourceSyncStatus(
                        source_key=source.source_key,
                        workspace=source.workspace,
                        source_app=source.source_app,
                        status="synced",
                        discovered_units=len(raw_units),
                        uploaded_units=len(prepared_batch),
                        message="Source collected and sanitized successfully.",
                    )
                )
            except Exception as error:  # noqa: BLE001
                sync_statuses.append(
                    SourceSyncStatus(
                        source_key=source.source_key,
                        workspace=source.workspace,
                        source_app=source.source_app,
                        status="failed",
                        discovered_units=0,
                        uploaded_units=0,
                        message=str(error),
                    )
                )

        batch = IngestionBatch(
            bot=self._settings.bot,
            run_summary={
                "sourceCount": len(catalog_records),
                "knowledgeUnitCount": len(prepared_units),
                "failedSourceCount": len([item for item in sync_statuses if item.status == "failed"]),
            },
            sources=catalog_records,
            sync_statuses=sync_statuses,
            knowledge_units=prepared_units,
        )
        sync_result = self._sync_client.push(batch)
        return {
            "sources": [item.to_payload() for item in sync_statuses],
            "runSummary": batch.run_summary,
            "syncResult": sync_result,
        }

    def _prepare_unit(self, unit: KnowledgeUnitRecord) -> KnowledgeUnitRecord:
        redacted_content = redact_text(unit.content_redacted)
        redacted_title = redact_text(unit.title)
        redacted_speaker = redact_text(unit.speaker or "") or None
        summary = self._narrator.build_summary(redacted_title, redacted_content)
        tags = sorted(
            {
                *unit.tags,
                *self._narrator.infer_tags(
                    unit.workspace,
                    unit.source_app,
                    unit.source_family,
                    unit.source_uri,
                ),
            }
        )

        chunks = self._chunker.split(redacted_content)
        chunk_embeddings = self._embedder.embed_texts(chunks)
        prepared_chunks = [
            KnowledgeChunkRecord(
                chunk_index=index,
                content_redacted=content,
                summary=f"{summary} [chunk {index + 1}]",
                metadata={"sourceUri": unit.source_uri, "workspace": unit.workspace},
                embedding=chunk_embeddings[index] if index < len(chunk_embeddings) else None,
            )
            for index, content in enumerate(chunks)
        ]

        checksum = sha256(
            "|".join(
                [
                    unit.external_id,
                    redacted_title,
                    redacted_content,
                    unit.source_uri or "",
                    unit.event_time or "",
                ]
            ).encode("utf-8")
        ).hexdigest()

        unit.title = redacted_title
        unit.content_redacted = redacted_content
        unit.speaker = redacted_speaker
        unit.summary = summary
        unit.tags = tags
        unit.allowed_emails = self._settings.allowed_emails.copy()
        unit.permissions = self._settings.permission_scopes.copy()
        unit.checksum = checksum
        unit.chunks = prepared_chunks
        return unit

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class AttachmentReference:
    label: str
    uri: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None


@dataclass(slots=True)
class KnowledgeChunkRecord:
    chunk_index: int
    content_redacted: str
    summary: str
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] | None = None


@dataclass(slots=True)
class KnowledgeUnitRecord:
    external_id: str
    bot: str
    source_family: str
    source_app: str
    workspace: str
    title: str
    content_redacted: str
    summary: str
    tags: list[str]
    permissions: list[str]
    allowed_emails: list[str]
    checksum: str = ""
    conversation_id: str | None = None
    speaker: str | None = None
    event_time: str | None = None
    attachment_refs: list[AttachmentReference] = field(default_factory=list)
    source_uri: str | None = None
    embedding: list[float] | None = None
    chunks: list[KnowledgeChunkRecord] = field(default_factory=list)

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SourceCatalogRecord:
    source_key: str
    source_family: str
    source_app: str
    workspace: str
    root_path: str
    adapter_key: str
    health: str
    notes: str = ""
    last_discovered_at: str | None = None

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SourceSyncStatus:
    source_key: str
    workspace: str
    source_app: str
    status: str
    discovered_units: int
    uploaded_units: int
    message: str

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class IngestionBatch:
    bot: str
    run_summary: dict[str, Any]
    sources: list[SourceCatalogRecord]
    sync_statuses: list[SourceSyncStatus]
    knowledge_units: list[KnowledgeUnitRecord]

    def to_payload(self) -> dict[str, Any]:
        return {
            "bot": self.bot,
            "runSummary": self.run_summary,
            "sources": [item.to_payload() for item in self.sources],
            "syncStatuses": [item.to_payload() for item in self.sync_statuses],
            "knowledgeUnits": [item.to_payload() for item in self.knowledge_units],
        }

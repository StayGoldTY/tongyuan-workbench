from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from ..contracts import AttachmentReference, KnowledgeUnitRecord
from ..settings import CollectorSettings
from ..source_catalog import SourceDescriptor
from .base import SourceAdapter


MESSAGE_COLUMNS = ("content", "msg", "message", "text", "body")
SPEAKER_COLUMNS = ("sender", "speaker", "from_user", "author", "talker")
TIME_COLUMNS = ("create_time", "timestamp", "time", "send_time", "created_at", "updated_at")
CONVERSATION_COLUMNS = ("conversation_id", "chat_id", "session_id", "talker", "peer_id")
TITLE_COLUMNS = ("title", "conversation_name", "session_name", "nickname")
ATTACHMENT_COLUMNS = ("file_path", "file_name", "file_url", "url", "link")
TEXT_SUFFIXES = {".log", ".txt"}


class SqliteChatArchiveAdapter(SourceAdapter):
    adapter_key = "sqlite_chat_archive"

    def collect(
        self,
        source: SourceDescriptor,
        settings: CollectorSettings,
    ) -> list[KnowledgeUnitRecord]:
        units: list[KnowledgeUnitRecord] = []

        for db_path in self._candidate_paths(source.root_path, {".db", ".sqlite", ".sqlite3"}):
            if len(units) >= settings.max_chat_units_per_source:
                break
            units.extend(
                self._collect_from_sqlite(
                    db_path,
                    source,
                    settings.max_chat_rows_per_table,
                    settings.max_chat_units_per_source - len(units),
                )
            )

        if units:
            return units[: settings.max_chat_units_per_source]

        return self._collect_from_text_logs(source, settings.max_chat_units_per_source)

    def _candidate_paths(self, root: Path, suffixes: set[str]) -> list[Path]:
        paths: list[Path] = []
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in suffixes:
                paths.append(path)
        return paths[:80]

    def _collect_from_sqlite(
        self,
        db_path: Path,
        source: SourceDescriptor,
        row_limit: int,
        remaining_capacity: int,
    ) -> list[KnowledgeUnitRecord]:
        units: list[KnowledgeUnitRecord] = []
        try:
            connection = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
        except sqlite3.Error:
            return units

        try:
            with connection:
                tables = connection.execute(
                    "select name from sqlite_master where type='table' order by name"
                ).fetchall()
                for (table_name,) in tables:
                    if len(units) >= remaining_capacity:
                        break
                    columns = [row[1] for row in connection.execute(f'pragma table_info("{table_name}")')]
                    message_column = self._pick_column(columns, MESSAGE_COLUMNS)
                    if not message_column:
                        continue
                    speaker_column = self._pick_column(columns, SPEAKER_COLUMNS)
                    time_column = self._pick_column(columns, TIME_COLUMNS)
                    conversation_column = self._pick_column(columns, CONVERSATION_COLUMNS)
                    title_column = self._pick_column(columns, TITLE_COLUMNS)
                    attachment_columns = [column for column in columns if column in ATTACHMENT_COLUMNS]
                    select_columns = [message_column]
                    for extra in [speaker_column, time_column, conversation_column, title_column, *attachment_columns]:
                        if extra and extra not in select_columns:
                            select_columns.append(extra)
                    quoted = ", ".join(f'"{column}"' for column in select_columns)
                    order_by = f'"{time_column}" desc' if time_column else "rowid desc"
                    query = f'select {quoted} from "{table_name}" order by {order_by} limit ?'
                    try:
                        rows = connection.execute(query, (row_limit,)).fetchall()
                    except sqlite3.Error:
                        continue
                    units.extend(
                        self._rows_to_units(
                            rows,
                            select_columns,
                            source,
                            db_path,
                            table_name,
                            message_column,
                            speaker_column,
                            time_column,
                            conversation_column,
                            title_column,
                            attachment_columns,
                        )
                    )
        except sqlite3.Error:
            return []
        return units[:remaining_capacity]

    def _rows_to_units(
        self,
        rows: list[tuple[object, ...]],
        columns: list[str],
        source: SourceDescriptor,
        db_path: Path,
        table_name: str,
        message_column: str,
        speaker_column: str | None,
        time_column: str | None,
        conversation_column: str | None,
        title_column: str | None,
        attachment_columns: list[str],
    ) -> list[KnowledgeUnitRecord]:
        units: list[KnowledgeUnitRecord] = []
        for index, row in enumerate(rows):
            payload = dict(zip(columns, row, strict=True))
            message = self._coerce_text(payload.get(message_column))
            if not message or not self._is_readable(message):
                continue
            conversation_id = self._coerce_text(payload.get(conversation_column)) if conversation_column else None
            title = self._coerce_text(payload.get(title_column)) if title_column else None
            speaker = self._coerce_text(payload.get(speaker_column)) if speaker_column else None
            units.append(
                KnowledgeUnitRecord(
                    external_id=f"{source.source_key}:{db_path.stem}:{table_name}:{index}",
                    bot="tongyuan",
                    source_family="chat",
                    source_app=source.source_app,
                    workspace=source.workspace,
                    conversation_id=conversation_id,
                    speaker=speaker,
                    title=title or f"{source.workspace} {table_name}",
                    content_redacted=message,
                    summary="",
                    tags=[],
                    permissions=["owner_only", "redacted"],
                    allowed_emails=[],
                    event_time=self._normalize_time(payload.get(time_column)) if time_column else None,
                    attachment_refs=self._build_attachment_refs(payload, attachment_columns),
                    source_uri=f"sqlite://{db_path.name}/{table_name}",
                )
            )
        return units

    def _collect_from_text_logs(self, source: SourceDescriptor, limit: int) -> list[KnowledgeUnitRecord]:
        units: list[KnowledgeUnitRecord] = []
        for path in self._candidate_paths(source.root_path, TEXT_SUFFIXES):
            if len(units) >= limit:
                break
            content = path.read_text(encoding="utf-8", errors="ignore")
            if not content.strip() or not self._is_readable(content):
                continue
            units.append(
                KnowledgeUnitRecord(
                    external_id=f"{source.source_key}:{path.stem}",
                    bot="tongyuan",
                    source_family="chat",
                    source_app=source.source_app,
                    workspace=source.workspace,
                    title=path.name,
                    content_redacted=content[:20_000],
                    summary="",
                    tags=[],
                    permissions=["owner_only", "redacted"],
                    allowed_emails=[],
                    source_uri=f"file://{path.as_posix()}",
                )
            )
        return units

    def _pick_column(self, columns: list[str], candidates: tuple[str, ...]) -> str | None:
        lower_mapping = {column.lower(): column for column in columns}
        for candidate in candidates:
            if candidate.lower() in lower_mapping:
                return lower_mapping[candidate.lower()]
        return None

    def _coerce_text(self, value: object | None) -> str:
        if value is None:
            return ""
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="ignore")
        text = str(value).strip()
        if text.startswith("{") or text.startswith("["):
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                return text
            if isinstance(payload, dict):
                fragments = [str(item) for item in payload.values() if isinstance(item, (str, int, float))]
                return " ".join(fragments)
        return text

    def _build_attachment_refs(
        self,
        payload: dict[str, object],
        attachment_columns: list[str],
    ) -> list[AttachmentReference]:
        references: list[AttachmentReference] = []
        for column in attachment_columns:
            value = self._coerce_text(payload.get(column))
            if value:
                references.append(AttachmentReference(label=column, uri=value))
        return references

    def _normalize_time(self, raw_value: object | None) -> str | None:
        if raw_value is None:
            return None
        try:
            timestamp = int(str(raw_value))
        except ValueError:
            return None
        if timestamp > 10_000_000_000:
            timestamp = timestamp // 1000
        return datetime.fromtimestamp(timestamp, tz=UTC).isoformat()

    def _is_readable(self, text: str) -> bool:
        sample = text[:800]
        printable = sum(character.isprintable() or character in "\n\r\t" for character in sample)
        return printable / max(len(sample), 1) > 0.82

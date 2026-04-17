from __future__ import annotations

import json
import re
import sqlite3
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

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
SQLITE_SUFFIXES = {".db", ".sqlite", ".sqlite3"}
TEXT_SUFFIXES = {".log", ".txt", ".json"}
SQLITE_HEADER = b"SQLite format 3\x00"
WECHAT_DATABASE_NAMES = ("MicroMsg.db", "ChatMsg.db", "Favorite.db", "Sns.db")
URL_PATTERN = re.compile(r"https?://[^\s\"'>)]+", re.IGNORECASE)
TIMESTAMP_PATTERN = re.compile(r"(20\d{2})[-_/\.](\d{2})[-_/\.](\d{2})")
LONG_NUMBER_PATTERN = re.compile(r"(?<!\d)\d{8,}(?!\d)")
WXWORK_PLACEHOLDER_DOC_PATTERN = re.compile(r"/doc/D0{6,}", re.IGNORECASE)

SOURCE_RULES = {
    "wechat": {
        "text_includes": ("\\log\\", "/log/"),
        "text_excludes": ("cloud_account", "tdi_account", "manifest.json", "sohu_simp", "md5.txt"),
        "sqlite_includes": (),
        "sqlite_excludes": ("applet.db",),
    },
    "wxwork": {
        "text_includes": ("\\log\\cef\\", "/log/cef/", "\\mobileframework\\", "/mobileframework/"),
        "text_excludes": ("_encrypt.log", "_encode.log", "\\critical\\", "/critical/"),
        "disable_sqlite": True,
        "sqlite_includes": (),
        "sqlite_excludes": (),
    },
    "larkshell": {
        "text_includes": ("apollo_", "iron_", "iron-utility_", "\\sdk_storage\\log\\"),
        "text_excludes": (
            "rtc-sdk",
            "byteview-pcsdk",
            "tea_records",
            "ttnet_records",
            "steam_events",
            "vesdk_",
            "netlog",
            "mediacenter",
        ),
        "skip_logs_when_sqlite_units_exist": True,
        "sqlite_includes": ("persistent_storage",),
        "sqlite_excludes": ("preload.db-wal", "preload.db-shm"),
    },
}

SOURCE_LOG_SIGNAL_PATTERNS = {
    "wechat": (
        re.compile(r"https?://", re.IGNORECASE),
        re.compile(r"\bmessage(?:s)?\b", re.IGNORECASE),
        re.compile(r"\bconversation(?:s)?\b", re.IGNORECASE),
        re.compile(r"\bmsg\b", re.IGNORECASE),
        re.compile(r"\.(?:docx?|xlsx?|pptx?|pdf)\b", re.IGNORECASE),
    ),
    "wxwork": (
        re.compile(r"rejected download", re.IGNORECASE),
        re.compile(r"doc\.weixin\.qq\.com", re.IGNORECASE),
        re.compile(r"\bwemail", re.IGNORECASE),
        re.compile(r"\bmeeting\b", re.IGNORECASE),
        re.compile(r"\bcalendar\b", re.IGNORECASE),
        re.compile(r"\bmail\b", re.IGNORECASE),
        re.compile(r"\bdownload\b", re.IGNORECASE),
        re.compile(r"\bupload\b", re.IGNORECASE),
        re.compile(r"\bworkflow\b", re.IGNORECASE),
        re.compile(r"\.(?:docx?|xlsx?|pptx?|pdf)\b", re.IGNORECASE),
    ),
    "larkshell": (
        re.compile(r"\bdownload\b", re.IGNORECASE),
        re.compile(r"timeline_notice", re.IGNORECASE),
        re.compile(r"\bvideomeeting\b", re.IGNORECASE),
        re.compile(r"\bcalendar\b", re.IGNORECASE),
        re.compile(r"\battachment\b", re.IGNORECASE),
        re.compile(r"\bpassport\b", re.IGNORECASE),
        re.compile(r"\bpermission\b", re.IGNORECASE),
        re.compile(r"\bworkplace\b", re.IGNORECASE),
        re.compile(r"\btemplate\b", re.IGNORECASE),
        re.compile(r"https?://", re.IGNORECASE),
        re.compile(r"\.(?:docx?|xlsx?|pptx?|pdf)\b", re.IGNORECASE),
    ),
}
SOURCE_LOG_NOISE_PATTERNS = {
    "wechat": (
        re.compile(r"wechatext", re.IGNORECASE),
        re.compile(r"cmdline:", re.IGNORECASE),
        re.compile(r"advfirewall", re.IGNORECASE),
    ),
    "wxwork": (
        re.compile(r"rumt-zh\.com", re.IGNORECASE),
        re.compile(r"native\.iscontentmodify", re.IGNORECASE),
        re.compile(r"log_report_whitelist", re.IGNORECASE),
        re.compile(r"service worker state", re.IGNORECASE),
        re.compile(r"\bswbox\b", re.IGNORECASE),
        re.compile(r"cors policy", re.IGNORECASE),
        re.compile(r"onaccountexmailhostchange", re.IGNORECASE),
        re.compile(r"gpuprocesshost", re.IGNORECASE),
        re.compile(r"account_consistency_mode_manager", re.IGNORECASE),
        re.compile(r"viz_main_impl", re.IGNORECASE),
        re.compile(r"angle_platform_impl", re.IGNORECASE),
        re.compile(r"checkerboard", re.IGNORECASE),
        re.compile(r"layer_tree_scroll_metrics_reporter", re.IGNORECASE),
        re.compile(r"frame_caret", re.IGNORECASE),
        re.compile(r"dom_selection", re.IGNORECASE),
        re.compile(r"mailinlinedcsr", re.IGNORECASE),
        re.compile(r"composeindex\.html", re.IGNORECASE),
        re.compile(r"wemail_native_resource", re.IGNORECASE),
        re.compile(r"qqmailapijs://dispatch_message", re.IGNORECASE),
        re.compile(r"/doc/D0{6,}", re.IGNORECASE),
        re.compile(r"bigfont init", re.IGNORECASE),
        re.compile(r"ratiogroup", re.IGNORECASE),
        re.compile(r"ssr snapshot styles", re.IGNORECASE),
    ),
    "larkshell": (
        re.compile(r"jash_monitor", re.IGNORECASE),
        re.compile(r"delay task", re.IGNORECASE),
        re.compile(r"picture_layer_impl", re.IGNORECASE),
        re.compile(r"frame_caret", re.IGNORECASE),
        re.compile(r"dom_selection", re.IGNORECASE),
        re.compile(r"layer_tree_scroll_metrics_reporter", re.IGNORECASE),
        re.compile(r"angle_platform_impl", re.IGNORECASE),
        re.compile(r"focus_element_changed", re.IGNORECASE),
        re.compile(r"checkerboard", re.IGNORECASE),
        re.compile(r"\[ime-renderer\]", re.IGNORECASE),
        re.compile(r"log_encrypt\.cc", re.IGNORECASE),
    ),
}
SENSITIVE_TABLE_TOKENS = ("login", "authorize", "profile")
SENSITIVE_COLUMN_NAMES = {"password", "passwd", "token", "apptoken", "auth_code", "phone", "telephone"}
LARKSHELL_KV_ALLOW_TOKENS = ("download", "timeline_notice", "workplace", "template", "schema", "userinfo")
LARKSHELL_KV_SKIP_TOKENS = ("slardar", "infra_client_fg_usage_dev", "search_engine_storage_key")


class SqliteChatArchiveAdapter(SourceAdapter):
    adapter_key = "sqlite_chat_archive"

    def collect(
        self,
        source: SourceDescriptor,
        settings: CollectorSettings,
    ) -> list[KnowledgeUnitRecord]:
        if source.source_key == "wechat":
            return self._collect_wechat_units(source, settings)

        units: list[KnowledgeUnitRecord] = []
        rules = SOURCE_RULES.get(source.source_key, {})

        if not rules.get("disable_sqlite"):
            for db_path in self._candidate_sqlite_paths(source):
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

        if rules.get("skip_logs_when_sqlite_units_exist") and units:
            return units[: settings.max_chat_units_per_source]

        if len(units) < settings.max_chat_units_per_source:
            units.extend(
                self._collect_from_text_logs(
                    source,
                    settings.max_chat_units_per_source - len(units),
                )
            )

        return units[: settings.max_chat_units_per_source]

    def _candidate_sqlite_paths(self, source: SourceDescriptor) -> list[Path]:
        paths = self._candidate_paths(source.root_path, SQLITE_SUFFIXES, source, path_kind="sqlite")
        return [path for path in paths if self._is_sqlite_database(path)]

    def _collect_wechat_units(
        self,
        source: SourceDescriptor,
        settings: CollectorSettings,
    ) -> list[KnowledgeUnitRecord]:
        collection_root = self._resolve_wechat_collection_root(source, settings)
        effective_source = SourceDescriptor(
            source_key=source.source_key,
            source_family=source.source_family,
            source_app=source.source_app,
            workspace=source.workspace,
            root_path=collection_root,
            adapter_key=source.adapter_key,
            health=source.health,
            notes=source.notes,
        )

        units: list[KnowledgeUnitRecord] = []
        for db_path in self._candidate_sqlite_paths(effective_source):
            if len(units) >= settings.max_chat_units_per_source:
                break
            units.extend(
                self._collect_from_sqlite(
                    db_path,
                    effective_source,
                    settings.max_chat_rows_per_table,
                    settings.max_chat_units_per_source - len(units),
                )
            )

        if units:
            return units[: settings.max_chat_units_per_source]

        raise RuntimeError("已找到微信消息目录，但目前还没有抽取到可读聊天内容，请确认解密结果是否完整。")

    def _resolve_wechat_collection_root(
        self,
        source: SourceDescriptor,
        settings: CollectorSettings,
    ) -> Path:
        if self._has_readable_wechat_database(source.root_path):
            return source.root_path

        if settings.wechat_decrypted_root and settings.wechat_decrypted_root.exists():
            if self._has_readable_wechat_database(settings.wechat_decrypted_root):
                return settings.wechat_decrypted_root

        if self._has_wechat_database_files(source.root_path):
            if not settings.wechat_key:
                raise RuntimeError(
                    "已发现真实微信消息库，但当前数据库仍是加密状态。请先配置 TONGYUAN_WECHAT_KEY，或提供 TONGYUAN_WECHAT_DECRYPTED_ROOT 指向已解密目录。"
                )

            return self._decrypt_wechat_database_tree(source.root_path, settings)

        raise RuntimeError("没有在微信目录里找到可用的消息库。")

    def _find_wechat_database_paths(self, root: Path) -> list[Path]:
        matches: list[Path] = []
        for name in WECHAT_DATABASE_NAMES:
            direct_path = root / name
            if direct_path.exists():
                matches.append(direct_path)
                continue
            matches.extend(path for path in root.rglob(name) if path.is_file())
        deduped: list[Path] = []
        seen = set()
        for path in matches:
            normalized = str(path.resolve())
            if normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(path)
        return deduped

    def _has_wechat_database_files(self, root: Path) -> bool:
        return len(self._find_wechat_database_paths(root)) > 0

    def _has_readable_wechat_database(self, root: Path) -> bool:
        return any(self._is_sqlite_database(path) for path in self._find_wechat_database_paths(root))

    def _decrypt_wechat_database_tree(
        self,
        root: Path,
        settings: CollectorSettings,
    ) -> Path:
        wxdump_command = shutil.which(settings.wxdump_path) if settings.wxdump_path else None
        if not wxdump_command:
            raise RuntimeError("已提供微信解密 key，但本机没有找到 wxdump.exe，无法自动解密微信数据库。")

        account_name = root.parent.name if root.name.lower() == "msg" else root.name
        base_output_root = settings.wechat_decrypted_root or (settings.output_directory / "wechat-decrypted")
        output_root = base_output_root if base_output_root.name.lower() == "msg" else base_output_root / account_name
        output_root.mkdir(parents=True, exist_ok=True)

        completed = subprocess.run(
            [
                wxdump_command,
                "decrypt",
                "-k",
                settings.wechat_key,
                "-i",
                str(root),
                "-o",
                str(output_root),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )

        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout or "").strip()
            if detail:
                raise RuntimeError(f"微信数据库自动解密失败：{detail}")
            raise RuntimeError("微信数据库自动解密失败，wxdump.exe 没有返回可用结果。")

        if not self._has_readable_wechat_database(output_root):
            raise RuntimeError("微信数据库已执行解密，但输出目录里还没有发现可读的 SQLite 消息库。")

        return output_root

    def _candidate_text_paths(self, source: SourceDescriptor) -> list[Path]:
        return self._candidate_paths(source.root_path, TEXT_SUFFIXES, source, path_kind="text")

    def _candidate_paths(
        self,
        root: Path,
        suffixes: set[str],
        source: SourceDescriptor,
        path_kind: str,
    ) -> list[Path]:
        rules = SOURCE_RULES.get(source.source_key, {})
        include_tokens = tuple(token.lower() for token in rules.get(f"{path_kind}_includes", ()))
        exclude_tokens = tuple(token.lower() for token in rules.get(f"{path_kind}_excludes", ()))
        scored: list[tuple[int, float, Path]] = []

        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in suffixes:
                continue
            normalized = path.as_posix().lower()
            if exclude_tokens and any(token in normalized for token in exclude_tokens):
                continue
            score = 0
            if include_tokens:
                score = sum(1 for token in include_tokens if token in normalized)
                if score == 0:
                    continue
            try:
                modified_time = path.stat().st_mtime
            except OSError:
                modified_time = 0.0
            scored.append((score, modified_time, path))

        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        limit = 16 if path_kind == "sqlite" else 32
        return [path for _, _, path in scored[:limit]]

    def _collect_from_sqlite(
        self,
        db_path: Path,
        source: SourceDescriptor,
        row_limit: int,
        remaining_capacity: int,
    ) -> list[KnowledgeUnitRecord]:
        if source.source_key == "larkshell" and "persistent_storage" in db_path.name.lower():
            return self._collect_from_larkshell_kv_store(db_path, source, row_limit, remaining_capacity)

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
                    if not self._should_scan_sqlite_table(source.source_key, table_name, columns):
                        continue
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
        finally:
            connection.close()
        return units[:remaining_capacity]

    def _collect_from_larkshell_kv_store(
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
                tables = [
                    row[0]
                    for row in connection.execute(
                        "select name from sqlite_master where type='table' and name like 'kv_%' order by name"
                    )
                    if self._table_has_columns(
                        connection,
                        row[0],
                        ("key", "value", "partition", "update_time"),
                    )
                ]
                for table_name in tables:
                    if len(units) >= remaining_capacity:
                        break
                    query_limit = max(row_limit * 5, 300)
                    rows = connection.execute(
                        f'select key, value, partition, update_time from "{table_name}" order by update_time desc limit ?',
                        (query_limit,),
                    ).fetchall()
                    for index, (key, value, partition, update_time) in enumerate(rows):
                        flattened_value = self._coerce_text(value)
                        if not self._is_interesting_larkshell_kv_record(key, partition, flattened_value):
                            continue
                        content = self._compose_larkshell_value(key, flattened_value, partition)
                        if not self._is_meaningful_content(content):
                            continue
                        units.append(
                            KnowledgeUnitRecord(
                                external_id=f"{source.source_key}:{db_path.stem}:{table_name}:{index}",
                                bot="tongyuan",
                                source_family="chat",
                                source_app=source.source_app,
                                workspace=source.workspace,
                                title=self._sanitize_larkshell_text(f"{source.workspace} {partition} {key}"),
                                content_redacted=content,
                                summary="",
                                tags=[],
                                permissions=["owner_only", "redacted"],
                                allowed_emails=[],
                                event_time=self._normalize_time(update_time),
                                attachment_refs=self._extract_attachment_refs_from_text(content),
                                source_uri=f"sqlite://{db_path.name}/{table_name}",
                            )
                        )
                        if len(units) >= remaining_capacity:
                            break
        except sqlite3.Error:
            return []
        finally:
            connection.close()

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
            if not self._is_meaningful_content(message):
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
        for path in self._candidate_text_paths(source):
            if len(units) >= limit:
                break
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if not content.strip() or not self._is_readable(content):
                continue
            units.extend(
                self._log_segments_to_units(
                    source,
                    path,
                    content,
                    limit - len(units),
                )
            )
        return units[:limit]

    def _log_segments_to_units(
        self,
        source: SourceDescriptor,
        path: Path,
        content: str,
        remaining_capacity: int,
    ) -> list[KnowledgeUnitRecord]:
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        informative_lines = [line for line in lines if self._is_informative_log_line(source.source_key, line)]
        if not informative_lines:
            return []

        segments: list[str] = []
        current_lines: list[str] = []
        current_length = 0
        for line in informative_lines[:800]:
            if current_lines and (len(current_lines) >= 12 or current_length + len(line) > 1800):
                segments.append("\n".join(current_lines))
                current_lines = []
                current_length = 0
            current_lines.append(line)
            current_length += len(line)
        if current_lines:
            segments.append("\n".join(current_lines))

        units: list[KnowledgeUnitRecord] = []
        for index, segment in enumerate(segments[:remaining_capacity]):
            attachment_refs = self._extract_attachment_refs_from_text(segment)
            units.append(
                KnowledgeUnitRecord(
                    external_id=f"{source.source_key}:{path.stem}:{index}",
                    bot="tongyuan",
                    source_family="chat",
                    source_app=source.source_app,
                    workspace=source.workspace,
                    title=f"{source.workspace} log {path.stem} #{index + 1}",
                    content_redacted=segment,
                    summary="",
                    tags=[],
                    permissions=["owner_only", "redacted"],
                    allowed_emails=[],
                    event_time=self._timestamp_from_path(path),
                    attachment_refs=attachment_refs,
                    source_uri=f"file://{path.as_posix()}",
                )
            )
        return units

    def _compose_larkshell_value(self, key: object, value: object, partition: object) -> str:
        flattened_value = self._sanitize_larkshell_text(self._coerce_text(value))[:2000]
        return "\n".join(
            [
                f"key: {self._sanitize_larkshell_text(self._coerce_text(key))}",
                f"partition: {self._sanitize_larkshell_text(self._coerce_text(partition))}",
                f"value: {flattened_value}",
            ]
        )

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
        if not text:
            return ""
        if text.startswith("{") or text.startswith("["):
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                return text
            flattened = self._flatten_json_payload(payload)
            return " | ".join(flattened) if flattened else text
        return text

    def _flatten_json_payload(self, payload: object, prefix: str = "") -> list[str]:
        if isinstance(payload, dict):
            fragments: list[str] = []
            for key, value in payload.items():
                next_prefix = f"{prefix}.{key}" if prefix else str(key)
                fragments.extend(self._flatten_json_payload(value, next_prefix))
            return fragments
        if isinstance(payload, list):
            fragments: list[str] = []
            for index, value in enumerate(payload[:12]):
                next_prefix = f"{prefix}[{index}]"
                fragments.extend(self._flatten_json_payload(value, next_prefix))
            return fragments
        if isinstance(payload, (str, int, float, bool)):
            return [f"{prefix}={payload}" if prefix else str(payload)]
        return []

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

    def _sanitize_larkshell_text(self, text: str) -> str:
        return LONG_NUMBER_PATTERN.sub("[REDACTED_ID]", text)

    def _should_scan_sqlite_table(
        self,
        source_key: str,
        table_name: str,
        columns: list[str],
    ) -> bool:
        lowered_table = table_name.lower()
        lowered_columns = {column.lower() for column in columns}
        if any(token in lowered_table for token in SENSITIVE_TABLE_TOKENS):
            return False
        if lowered_columns & SENSITIVE_COLUMN_NAMES:
            return False
        if source_key == "wxwork" and "config" in lowered_table:
            return False
        return True

    def _table_has_columns(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        required_columns: tuple[str, ...],
    ) -> bool:
        columns = {row[1].lower() for row in connection.execute(f'pragma table_info("{table_name}")')}
        return all(column.lower() in columns for column in required_columns)

    def _is_interesting_larkshell_kv_record(
        self,
        key: object,
        partition: object,
        flattened_value: str,
    ) -> bool:
        key_text = self._coerce_text(key)
        partition_text = self._coerce_text(partition)
        combined = " ".join([key_text, partition_text, flattened_value]).lower()
        if any(token in combined for token in LARKSHELL_KV_SKIP_TOKENS):
            return False
        if key_text.startswith(("JSSDK_DB_", "DB_")) or key_text.endswith(("_MD5", "_VERSION")):
            return False
        if "userid" in flattened_value.lower() or "deviceid" in flattened_value.lower():
            return False
        if not any(token in combined for token in LARKSHELL_KV_ALLOW_TOKENS):
            return False
        return (
            flattened_value.count(" | ") >= 2
            or "http://" in combined
            or "https://" in combined
            or "tenantname=" in combined
            or "updateremark=" in combined
        )

    def _extract_attachment_refs_from_text(self, text: str) -> list[AttachmentReference]:
        references: list[AttachmentReference] = []
        for index, match in enumerate(URL_PATTERN.findall(text)[:6]):
            if WXWORK_PLACEHOLDER_DOC_PATTERN.search(match):
                continue
            parsed = urlparse(match)
            query = parse_qs(parsed.query)
            label = parsed.path.rsplit("/", 1)[-1] or f"url-{index + 1}"
            if "fname" in query:
                label = unquote(query["fname"][0])
            references.append(AttachmentReference(label=label, uri=match))
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

    def _timestamp_from_path(self, path: Path) -> str | None:
        match = TIMESTAMP_PATTERN.search(path.name)
        if not match:
            return None
        year, month, day = match.groups()
        return f"{year}-{month}-{day}T00:00:00+00:00"

    def _is_sqlite_database(self, path: Path) -> bool:
        try:
            return path.read_bytes()[:16] == SQLITE_HEADER
        except OSError:
            return False

    def _is_readable(self, text: str) -> bool:
        sample = text[:800]
        printable = sum(character.isprintable() or character in "\n\r\t" for character in sample)
        return printable / max(len(sample), 1) > 0.82

    def _is_meaningful_content(self, text: str) -> bool:
        normalized = text.strip()
        if not normalized or not self._is_readable(normalized):
            return False
        if len(normalized) < 12:
            return False
        lowered = normalized.lower()
        if "ktdikey" in lowered:
            return False
        return True

    def _is_informative_log_line(self, source_key: str, line: str) -> bool:
        if len(line) < 24:
            return False
        noise_patterns = SOURCE_LOG_NOISE_PATTERNS.get(source_key, ())
        if any(pattern.search(line) for pattern in noise_patterns):
            return False
        signal_patterns = SOURCE_LOG_SIGNAL_PATTERNS.get(source_key, ())
        return any(pattern.search(line) for pattern in signal_patterns)

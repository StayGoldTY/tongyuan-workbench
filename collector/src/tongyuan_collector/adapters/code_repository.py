from __future__ import annotations

import subprocess
import zipfile
from datetime import UTC, datetime
from hashlib import sha1
from pathlib import Path
from xml.etree import ElementTree

from ..contracts import KnowledgeUnitRecord
from ..settings import CollectorSettings
from ..source_catalog import SourceDescriptor
from .base import SourceAdapter


CODE_EXTENSIONS = {".cs", ".js", ".json", ".sql", ".ts", ".tsx", ".vue", ".yml", ".yaml"}
DOCUMENT_EXTENSIONS = {".docx", ".markdown", ".md", ".txt"}
SKIPPED_DIRECTORIES = {
    ".git",
    ".idea",
    ".vs",
    "bin",
    "dist",
    "lib",
    "node_modules",
    "obj",
    "TestResults",
}


class CodeRepositoryAdapter(SourceAdapter):
    adapter_key = "code_repository"

    def collect(
        self,
        source: SourceDescriptor,
        settings: CollectorSettings,
    ) -> list[KnowledgeUnitRecord]:
        if not source.root_path.exists():
            return []

        units: list[KnowledgeUnitRecord] = [self._build_repository_overview(source)]
        commit_digest = self._build_commit_digest(source, settings.max_commit_entries)
        if commit_digest:
            units.append(commit_digest)

        for path in self._iter_indexable_files(source.root_path, settings.max_repo_files_per_source):
            content = self._read_file(path, settings.max_file_bytes)
            if not content.strip():
                continue

            relative_path = path.relative_to(source.root_path).as_posix()
            family = "document" if path.suffix.lower() in DOCUMENT_EXTENSIONS else "code"
            units.append(
                KnowledgeUnitRecord(
                    external_id=f"{source.source_key}:{relative_path}",
                    bot=settings.bot,
                    source_family=family,
                    source_app=source.source_app,
                    workspace=source.workspace,
                    title=relative_path,
                    content_redacted=content,
                    summary="",
                    tags=[],
                    permissions=settings.permission_scopes.copy(),
                    allowed_emails=settings.allowed_emails.copy(),
                    event_time=self._to_iso(path.stat().st_mtime),
                    source_uri=f"file://{path.as_posix()}",
                )
            )

        return units

    def _build_repository_overview(self, source: SourceDescriptor) -> KnowledgeUnitRecord:
        directories = sorted(
            entry.name
            for entry in source.root_path.iterdir()
            if entry.is_dir() and entry.name not in SKIPPED_DIRECTORIES
        )
        content = "\n".join(
            [
                f"Workspace: {source.workspace}",
                f"Root: {source.root_path}",
                "Top-level directories:",
                *[f"- {name}" for name in directories[:50]],
            ]
        )
        return KnowledgeUnitRecord(
            external_id=f"{source.source_key}:overview",
            bot="tongyuan",
            source_family="code",
            source_app=source.source_app,
            workspace=source.workspace,
            title=f"{source.workspace} repository overview",
            content_redacted=content,
            summary="",
            tags=[],
            permissions=["owner_only", "redacted"],
            allowed_emails=[],
            source_uri=f"git://{source.workspace}/overview",
        )

    def _build_commit_digest(
        self,
        source: SourceDescriptor,
        max_commit_entries: int,
    ) -> KnowledgeUnitRecord | None:
        try:
            completed = subprocess.run(
                [
                    "git",
                    "-C",
                    str(source.root_path),
                    "log",
                    f"-n{max_commit_entries}",
                    "--pretty=format:%h | %an | %ad | %s",
                    "--date=iso-strict",
                ],
                capture_output=True,
                check=True,
                encoding="utf-8",
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return None

        if not completed.stdout.strip():
            return None

        digest_key = sha1(completed.stdout.encode("utf-8")).hexdigest()[:12]
        return KnowledgeUnitRecord(
            external_id=f"{source.source_key}:commits:{digest_key}",
            bot="tongyuan",
            source_family="code",
            source_app=source.source_app,
            workspace=source.workspace,
            title=f"{source.workspace} recent commit digest",
            content_redacted=completed.stdout,
            summary="",
            tags=[],
            permissions=["owner_only", "redacted"],
            allowed_emails=[],
            source_uri=f"git://{source.workspace}/recent-commits",
        )

    def _iter_indexable_files(self, root: Path, limit: int) -> list[Path]:
        files: list[Path] = []
        for path in root.rglob("*"):
            if len(files) >= limit:
                break
            if any(part in SKIPPED_DIRECTORIES for part in path.parts):
                continue
            if not path.is_file():
                continue
            if path.suffix.lower() not in CODE_EXTENSIONS | DOCUMENT_EXTENSIONS:
                continue
            files.append(path)
        return files

    def _read_file(self, path: Path, max_bytes: int) -> str:
        if path.stat().st_size > max_bytes:
            return ""
        if path.suffix.lower() == ".docx":
            return self._read_docx(path)

        sample = path.read_bytes()[:512]
        if b"\x00" in sample:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")

    def _read_docx(self, path: Path) -> str:
        try:
            with zipfile.ZipFile(path) as archive:
                xml_content = archive.read("word/document.xml")
        except (KeyError, OSError, zipfile.BadZipFile):
            return ""

        root = ElementTree.fromstring(xml_content)
        texts = [node.text for node in root.iter() if node.text]
        return "\n".join(texts)

    def _to_iso(self, timestamp: float) -> str:
        return datetime.fromtimestamp(timestamp, tz=UTC).isoformat()

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .contracts import SourceCatalogRecord
from .settings import CollectorSettings


@dataclass(slots=True)
class SourceDescriptor:
    source_key: str
    source_family: str
    source_app: str
    workspace: str
    root_path: Path
    adapter_key: str
    health: str
    notes: str


REPOSITORY_BLUEPRINTS = {
    "hainan-server": ("code", "git", "HAINAN.Server", "code_repository", "海南后端主仓库"),
    "hainan-web": ("code", "git", "HAINAN.Web", "code_repository", "海南前端主仓库"),
    "hunan-kellyt": (
        "code",
        "git",
        "KellyT.Solutions.Prod",
        "code_repository",
        "湖南后端主仓库",
    ),
    "hunan-lekima": ("code", "git", "Lekima-App", "code_repository", "湖南前端主仓库"),
}

CHAT_BLUEPRINTS = {
    "wechat": ("chat", "wechat", "WeChat", "sqlite_chat_archive", "微信本地目录"),
    "wxwork": ("chat", "wxwork", "WXWork", "sqlite_chat_archive", "企业微信本地目录"),
    "larkshell": ("chat", "larkshell", "建研智通", "sqlite_chat_archive", "建研智通本地目录"),
}


def discover_sources(settings: CollectorSettings) -> list[SourceDescriptor]:
    discovered: list[SourceDescriptor] = []

    for source_key, root_path in settings.repository_roots.items():
        family, app, workspace, adapter, note = REPOSITORY_BLUEPRINTS[source_key]
        discovered.append(
            SourceDescriptor(
                source_key=source_key,
                source_family=family,
                source_app=app,
                workspace=workspace,
                root_path=root_path,
                adapter_key=adapter,
                health="ready" if root_path.exists() else "missing",
                notes=note,
            )
        )

    for source_key, root_path in settings.chat_roots.items():
        family, app, workspace, adapter, note = CHAT_BLUEPRINTS[source_key]
        health = "ready" if root_path.exists() else "missing"
        discovered.append(
            SourceDescriptor(
                source_key=source_key,
                source_family=family,
                source_app=app,
                workspace=workspace,
                root_path=root_path,
                adapter_key=adapter,
                health=health,
                notes=note,
            )
        )

    return discovered


def to_catalog_record(source: SourceDescriptor) -> SourceCatalogRecord:
    return SourceCatalogRecord(
        source_key=source.source_key,
        source_family=source.source_family,
        source_app=source.source_app,
        workspace=source.workspace,
        root_path=str(source.root_path),
        adapter_key=source.adapter_key,
        health=source.health,
        notes=source.notes,
        last_discovered_at=datetime.now(tz=UTC).isoformat(),
    )

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .contracts import SourceCatalogRecord
from .settings import CollectorSettings


WECHAT_PRIMARY_DATABASES = ("MicroMsg.db", "ChatMsg.db", "Favorite.db", "Sns.db")
SQLITE_HEADER = b"SQLite format 3\x00"


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
    "hunan-kellyt": ("code", "git", "KellyT.Solutions.Prod", "code_repository", "湖南后端主仓库"),
    "hunan-lekima": ("code", "git", "Lekima-App", "code_repository", "湖南前端主仓库"),
}

CHAT_BLUEPRINTS = {
    "wechat": ("chat", "wechat", "WeChat", "sqlite_chat_archive", "微信本地目录"),
    "wxwork": ("chat", "wxwork", "WXWork", "sqlite_chat_archive", "企业微信本地目录"),
    "larkshell": ("chat", "larkshell", "建研智通", "sqlite_chat_archive", "建研智通本地目录"),
}


def _is_readable_sqlite(path: Path) -> bool:
    try:
      return path.read_bytes()[:16] == SQLITE_HEADER
    except OSError:
      return False


def _find_wechat_msg_root(settings: CollectorSettings) -> Path | None:
    if settings.wechat_decrypted_root and settings.wechat_decrypted_root.exists():
        return settings.wechat_decrypted_root

    if settings.wechat_msg_root and settings.wechat_msg_root.exists():
        return settings.wechat_msg_root

    base_root = settings.chat_roots.get("wechat")
    if not base_root or not base_root.exists():
        return None

    if settings.wechat_account:
        preferred = base_root / settings.wechat_account / "Msg"
        if preferred.exists():
            return preferred

    candidates: list[tuple[float, Path]] = []
    for account_dir in base_root.iterdir():
        if not account_dir.is_dir():
            continue
        msg_dir = account_dir / "Msg"
        if not msg_dir.exists():
            continue
        if not any((msg_dir / name).exists() for name in WECHAT_PRIMARY_DATABASES):
            continue
        try:
            modified_time = max((msg_dir / name).stat().st_mtime for name in WECHAT_PRIMARY_DATABASES if (msg_dir / name).exists())
        except OSError:
            modified_time = 0.0
        candidates.append((modified_time, msg_dir))

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1] if candidates else None


def _describe_wechat_source(settings: CollectorSettings) -> tuple[Path, str, str]:
    base_root = settings.chat_roots.get("wechat", Path("D:/WeChat Files"))
    msg_root = _find_wechat_msg_root(settings)

    if not base_root.exists() and not (settings.wechat_decrypted_root and settings.wechat_decrypted_root.exists()):
        return base_root, "missing", "未发现微信本地数据目录"

    if not msg_root:
        return base_root, "warning", "已发现微信目录，但还没有定位到可用的消息库目录"

    readable_databases = [
        path for path in (msg_root / name for name in WECHAT_PRIMARY_DATABASES) if path.exists() and _is_readable_sqlite(path)
    ]
    encrypted_databases = [
        path for path in (msg_root / name for name in WECHAT_PRIMARY_DATABASES) if path.exists() and not _is_readable_sqlite(path)
    ]
    account_name = msg_root.parent.name if msg_root.name.lower() == "msg" else msg_root.name

    if settings.wechat_decrypted_root and msg_root == settings.wechat_decrypted_root and readable_databases:
        return msg_root, "ready", f"已发现微信账号 {account_name} 的解密消息目录，可直接采集聊天正文"

    if readable_databases:
        return msg_root, "ready", f"已发现微信账号 {account_name} 的可读消息库，可直接采集"

    if encrypted_databases:
        return (
            msg_root,
            "warning",
            f"已发现微信账号 {account_name} 的真实消息库，但当前数据库仍是加密格式；配置 TONGYUAN_WECHAT_KEY 或提供解密目录后才能继续采集正文",
        )

    return msg_root, "warning", "已定位微信消息目录，但还没有发现可采集的消息库文件"


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

        if source_key == "wechat":
            actual_root, health, resolved_note = _describe_wechat_source(settings)
            discovered.append(
                SourceDescriptor(
                    source_key=source_key,
                    source_family=family,
                    source_app=app,
                    workspace=workspace,
                    root_path=actual_root,
                    adapter_key=adapter,
                    health=health,
                    notes=resolved_note,
                )
            )
            continue

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

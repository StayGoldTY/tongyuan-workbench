from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(slots=True)
class CollectorSettings:
    bot: str = "tongyuan"
    owner_email: str = ""
    allowed_emails: list[str] = field(default_factory=list)
    permission_scopes: list[str] = field(default_factory=lambda: ["owner_only", "redacted"])
    sync_endpoint: str = ""
    sync_secret: str = ""
    openai_base_url: str = ""
    openai_api_key: str = ""
    chat_model: str = ""
    embedding_model: str = ""
    max_repo_files_per_source: int = 240
    max_commit_entries: int = 80
    max_file_bytes: int = 180_000
    max_chat_units_per_source: int = 220
    max_chat_rows_per_table: int = 80
    max_chunk_characters: int = 1_800
    chunk_overlap_characters: int = 180
    repository_roots: dict[str, Path] = field(default_factory=dict)
    chat_roots: dict[str, Path] = field(default_factory=dict)
    output_directory: Path = Path(".")

    @classmethod
    def from_env(cls, env_file: Path | None = None) -> "CollectorSettings":
        collector_root = Path(__file__).resolve().parents[2]
        env_path = env_file or collector_root / ".env"
        env_values = _parse_env_file(env_path)
        read = lambda key, default="": os.getenv(key, env_values.get(key, default))

        owner_email = read("TONGYUAN_OWNER_EMAIL")
        allowed_emails = _split_csv(read("TONGYUAN_ALLOWED_EMAILS"))
        if owner_email and owner_email not in allowed_emails:
            allowed_emails.insert(0, owner_email)

        return cls(
            owner_email=owner_email,
            allowed_emails=allowed_emails,
            permission_scopes=_split_csv(read("TONGYUAN_PERMISSION_SCOPES", "owner_only,redacted")),
            sync_endpoint=read("TONGYUAN_SYNC_ENDPOINT"),
            sync_secret=read("TONGYUAN_SYNC_SECRET"),
            openai_base_url=read("TONGYUAN_OPENAI_BASE_URL"),
            openai_api_key=read("TONGYUAN_OPENAI_API_KEY"),
            chat_model=read("TONGYUAN_CHAT_MODEL"),
            embedding_model=read("TONGYUAN_EMBEDDING_MODEL"),
            repository_roots={
                "hainan-server": Path(read("TONGYUAN_HAINAN_SERVER", "D:/Code/WorkCode/HAINAN.Server")),
                "hainan-web": Path(read("TONGYUAN_HAINAN_WEB", "D:/Code/WorkCode/HAINAN.Web")),
                "hunan-kellyt": Path(
                    read(
                        "TONGYUAN_HUNAN_KELLYT",
                        "D:/Code/WorkCode/HUNAN-ALL/KellyT.Solutions.Prod",
                    )
                ),
                "hunan-lekima": Path(
                    read(
                        "TONGYUAN_HUNAN_LEKIMA",
                        "D:/Code/WorkCode/HUNAN-ALL/Lekima-App",
                    )
                ),
            },
            chat_roots={
                "wechat": Path(read("TONGYUAN_WECHAT_ROOT", "C:/Users/14042/AppData/Roaming/Tencent/WeChat")),
                "wxwork": Path(read("TONGYUAN_WXWORK_ROOT", "C:/Users/14042/AppData/Roaming/Tencent/WXWork")),
                "larkshell": Path(
                    read(
                        "TONGYUAN_LARKSHELL_ROOT",
                        "C:/Users/14042/AppData/Roaming/LarkShell-ka-dajzkx436",
                    )
                ),
            },
            output_directory=collector_root / "out",
        )

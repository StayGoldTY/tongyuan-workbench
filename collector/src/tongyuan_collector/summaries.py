from __future__ import annotations

from pathlib import PurePosixPath


class KnowledgeNarrator:
    def build_summary(self, title: str, content: str) -> str:
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        preview = " ".join(lines[:3])[:320]
        return f"{title}: {preview}" if preview else title

    def infer_tags(
        self,
        workspace: str,
        source_app: str,
        source_family: str,
        source_uri: str | None,
    ) -> list[str]:
        tags = {workspace.lower(), source_app.lower(), source_family.lower()}

        if "hainan" in workspace.lower():
            tags.add("hainan")
        if "lekima" in workspace.lower() or "kellyt" in workspace.lower():
            tags.add("hunan")

        if source_uri and "://" in source_uri:
            path = source_uri.split("://", 1)[1]
            for part in PurePosixPath(path).parts[:3]:
                if part and part not in {".", "/"}:
                    tags.add(part.lower())

        return sorted(tags)

from __future__ import annotations

import json
from pathlib import Path
from urllib import request

from .contracts import IngestionBatch
from .settings import CollectorSettings


class SyncClient:
    def __init__(self, settings: CollectorSettings) -> None:
        self._settings = settings

    def push(self, batch: IngestionBatch) -> dict[str, str | int]:
        payload = batch.to_payload()

        if not (self._settings.sync_endpoint and self._settings.sync_secret):
            self._settings.output_directory.mkdir(parents=True, exist_ok=True)
            preview_path = self._settings.output_directory / "last_sync_preview.json"
            preview_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return {"mode": "preview", "path": str(preview_path)}

        http_request = request.Request(
            self._settings.sync_endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-tongyuan-sync-key": self._settings.sync_secret,
            },
            method="POST",
        )

        with request.urlopen(http_request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))

        return {
            "mode": "remote",
            "runId": str(body.get("runId", "")),
            "insertedUnits": int(body.get("insertedUnits", 0)),
        }

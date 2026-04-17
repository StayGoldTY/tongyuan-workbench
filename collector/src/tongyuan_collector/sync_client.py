from __future__ import annotations

import json
import time
from pathlib import Path
from urllib import error
from urllib import request

from .contracts import IngestionBatch
from .settings import CollectorSettings


class SyncClient:
    def __init__(self, settings: CollectorSettings) -> None:
        self._settings = settings
        self._batch_size = 10

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

        knowledge_units = payload.get("knowledgeUnits", [])
        run_id = ""
        inserted_units = 0

        if not knowledge_units:
            response_body = self._post_json(
                {
                    **payload,
                    "finalize": True,
                    "knowledgeUnits": [],
                }
            )
            return {
                "mode": "remote",
                "runId": str(response_body.get("runId", "")),
                "insertedUnits": int(response_body.get("insertedUnits", 0)),
            }

        for index in range(0, len(knowledge_units), self._batch_size):
            chunk = knowledge_units[index : index + self._batch_size]
            response_body = self._post_json(
                {
                    "bot": payload.get("bot"),
                    "runSummary": payload.get("runSummary", {}),
                    "sources": payload.get("sources", []) if index == 0 else [],
                    "syncStatuses": payload.get("syncStatuses", []) if index == 0 else [],
                    "knowledgeUnits": chunk,
                    "runId": run_id or None,
                    "finalize": False,
                }
            )
            run_id = str(response_body.get("runId", run_id))
            inserted_units += int(response_body.get("insertedUnits", 0))

        self._post_json(
            {
                "bot": payload.get("bot"),
                "runSummary": payload.get("runSummary", {}),
                "syncStatuses": payload.get("syncStatuses", []),
                "knowledgeUnits": [],
                "runId": run_id,
                "finalize": True,
            }
        )

        return {
            "mode": "remote",
            "runId": run_id,
            "insertedUnits": inserted_units,
        }

    def _post_json(self, payload: dict[str, object]) -> dict[str, object]:
        http_request = request.Request(
            self._settings.sync_endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-tongyuan-sync-key": self._settings.sync_secret,
            },
            method="POST",
        )

        for attempt in range(1, 5):
            try:
                with request.urlopen(http_request, timeout=300) as response:
                    return json.loads(response.read().decode("utf-8"))
            except error.HTTPError:
                raise
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(attempt * 2)

        raise RuntimeError("Failed to push ingestion payload after retries.")

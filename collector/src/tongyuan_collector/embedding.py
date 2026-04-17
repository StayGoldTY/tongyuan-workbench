from __future__ import annotations

import json
from urllib import request

from .settings import CollectorSettings


class OpenAICompatibleEmbedder:
    def __init__(self, settings: CollectorSettings) -> None:
        self._settings = settings

    def embed_texts(self, texts: list[str]) -> list[list[float] | None]:
        if not texts:
            return []

        if not (
            self._settings.openai_base_url
            and self._settings.openai_api_key
            and self._settings.embedding_model
        ):
            return [None for _ in texts]

        payload = json.dumps(
            {"model": self._settings.embedding_model, "input": texts}
        ).encode("utf-8")
        endpoint = f"{self._settings.openai_base_url.rstrip('/')}/embeddings"
        http_request = request.Request(
            endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._settings.openai_api_key}",
            },
            method="POST",
        )

        with request.urlopen(http_request, timeout=60) as response:
            raw = json.loads(response.read().decode("utf-8"))

        items = raw.get("data", [])
        return [item.get("embedding") for item in items]

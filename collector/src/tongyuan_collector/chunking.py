from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class KnowledgeChunker:
    max_characters: int
    overlap_characters: int

    def split(self, content: str) -> list[str]:
        normalized = content.replace("\r\n", "\n").strip()
        if not normalized:
            return []

        paragraphs = [item.strip() for item in normalized.split("\n\n") if item.strip()]
        chunks: list[str] = []
        current = ""

        for paragraph in paragraphs:
            candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
            if len(candidate) <= self.max_characters:
                current = candidate
                continue

            if current:
                chunks.append(current)

            current = paragraph
            while len(current) > self.max_characters:
                window = current[: self.max_characters]
                chunks.append(window)
                current = current[self.max_characters - self.overlap_characters :].strip()

        if current:
            chunks.append(current)

        return chunks

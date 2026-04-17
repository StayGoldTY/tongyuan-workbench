from __future__ import annotations

from abc import ABC, abstractmethod

from ..contracts import KnowledgeUnitRecord
from ..settings import CollectorSettings
from ..source_catalog import SourceDescriptor


class SourceAdapter(ABC):
    adapter_key: str

    @abstractmethod
    def collect(
        self,
        source: SourceDescriptor,
        settings: CollectorSettings,
    ) -> list[KnowledgeUnitRecord]:
        raise NotImplementedError

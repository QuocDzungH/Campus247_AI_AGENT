"""Compose RagPort from settings. Stub remains the CI default."""

from campus247.agents.stubs import StubRag
from campus247.config import Settings
from campus247.models.ports_v1 import RagPort
from campus247.rag.corpus import CorpusRag


def create_rag(settings: Settings) -> RagPort:
    if settings.rag_mode == "corpus":
        return CorpusRag.from_packaged()
    if settings.rag_mode == "official":
        return CorpusRag.from_official()
    return StubRag()

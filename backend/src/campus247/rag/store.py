"""Local embedding cache for hybrid RAG.

File-backed now (JSON manifest + float32 matrix). A PostgreSQL/pgvector store can
implement VectorIndexStore later; PipelineRag, L1, and L3 keep using retrieve_policy.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol, runtime_checkable

import numpy as np

logger = logging.getLogger("campus247.rag")

CHUNKER_VERSION = "markdown-v1"
STORE_SCHEMA_VERSION = 1


@dataclass(frozen=True)
class IndexSpec:
    source_hash: str
    embedding_model: str
    chunker_version: str
    chunk_ids: tuple[str, ...]
    index_version: str


@runtime_checkable
class VectorIndexStore(Protocol):
    def read(self, spec: IndexSpec) -> np.ndarray | None: ...

    def write(self, spec: IndexSpec, matrix: np.ndarray) -> None: ...


class FileVectorIndex:
    """Persist embeddings under a configured directory. Missing/stale cache is a miss."""

    def __init__(self, directory: Path) -> None:
        self.directory = Path(directory)

    @property
    def _manifest_path(self) -> Path:
        return self.directory / "manifest.json"

    @property
    def _matrix_path(self) -> Path:
        return self.directory / "embeddings.npy"

    def read(self, spec: IndexSpec) -> np.ndarray | None:
        if not self._manifest_path.is_file() or not self._matrix_path.is_file():
            return None
        try:
            payload = json.loads(self._manifest_path.read_text(encoding="utf-8"))
            if int(payload.get("schema_version") or 0) != STORE_SCHEMA_VERSION:
                return None
            if payload.get("source_hash") != spec.source_hash:
                return None
            if payload.get("embedding_model") != spec.embedding_model:
                return None
            if payload.get("chunker_version") != spec.chunker_version:
                return None
            if payload.get("index_version") != spec.index_version:
                return None
            stored_ids = tuple(payload.get("chunk_ids") or ())
            if stored_ids != spec.chunk_ids:
                return None
            matrix = np.load(self._matrix_path)
        except Exception:
            logger.warning("hybrid_index_cache_unreadable path=%s", self.directory)
            return None
        if matrix.ndim != 2 or matrix.shape[0] != len(spec.chunk_ids):
            return None
        return np.asarray(matrix, dtype=np.float32)

    def write(self, spec: IndexSpec, matrix: np.ndarray) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        aligned = np.asarray(matrix, dtype=np.float32)
        tmp_matrix = self.directory / "embeddings.tmp.npy"
        with tmp_matrix.open("wb") as handle:
            np.save(handle, aligned)
        tmp_matrix.replace(self._matrix_path)
        manifest = {
            "schema_version": STORE_SCHEMA_VERSION,
            "index_version": spec.index_version,
            "source_hash": spec.source_hash,
            "embedding_model": spec.embedding_model,
            "chunker_version": spec.chunker_version,
            "chunk_ids": list(spec.chunk_ids),
            "created_at": datetime.now(UTC).isoformat(),
        }
        tmp_manifest = self._manifest_path.with_suffix(".json.tmp")
        tmp_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_manifest.replace(self._manifest_path)
        logger.info(
            "hybrid_index_cache_written version=%s chunks=%s path=%s",
            spec.index_version,
            len(spec.chunk_ids),
            self.directory,
        )

# ---- Stage 1: Build ----
FROM python:3.11-slim AS builder

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

# ---- Stage 2: Production ----
FROM python:3.11-slim

WORKDIR /app

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app/src

RUN useradd -m appuser

COPY backend/pyproject.toml backend/alembic.ini ./
COPY backend/src ./src
COPY backend/alembic ./alembic
COPY RAG ./RAG

RUN mkdir -p /app/data /app/data/rag_index && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "campus247.main:app", "--host", "0.0.0.0", "--port", "8000"]

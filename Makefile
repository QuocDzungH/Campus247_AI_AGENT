.PHONY: install run test lint format typecheck check clean migrate seed worker frontend-dev frontend-lint frontend-build test-eval-agent test-eval-rag benchmark

export PYTHONPATH := $(CURDIR)/backend/src
PYTHON ?= $(shell if [ -f .venv/bin/python ]; then echo .venv/bin/python; else echo python3; fi)

install:
	pip install -e "./backend[dev]"

run:
	uvicorn campus247.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	alembic -c backend/alembic.ini upgrade head

seed:
	python -m campus247.db.seed

worker:
	python -m campus247.workers

test:
	cd backend && pytest tests/ -v

lint:
	ruff check backend/src backend/tests scripts/export_contracts_v1.py scripts/seed_edu14.py scripts/generate_edu14_seed.py

format:
	ruff format backend/src backend/tests scripts/export_contracts_v1.py scripts/seed_edu14.py scripts/generate_edu14_seed.py

typecheck:
	mypy backend/src

check: lint test

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +

frontend-dev:
	cd frontend && npm run dev

frontend-lint:
	cd frontend && npm run lint

frontend-build:
	cd frontend && npm run build

test-eval-agent:
	$(PYTHON) eval/agent/run_eval.py --split holdout --out-json eval/results/agent_eval_report.json --out-md eval/results/agent_eval_report.md

test-eval-rag:
	$(PYTHON) eval/rag/run_rag_eval.py --split holdout --out-json eval/results/rag_eval_report.json --out-md eval/results/rag_eval_report.md

benchmark: test-eval-agent test-eval-rag
	$(PYTHON) eval/quality_gate.py

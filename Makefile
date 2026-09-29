.PHONY: install run test lint format typecheck check clean migrate seed worker frontend-dev frontend-lint frontend-build

export PYTHONPATH := $(CURDIR)/backend/src

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

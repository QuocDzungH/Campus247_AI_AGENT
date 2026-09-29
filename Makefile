.PHONY: run test lint format typecheck check clean migrate seed worker

run:
	uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	alembic upgrade head

seed:
	python -m scripts.seed_edu14

worker:
	python -m src.workers

test:
	pytest tests/ -v

lint:
	ruff check src/ tests/

format:
	ruff format src/ tests/

typecheck:
	mypy src/

check: lint format test

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +

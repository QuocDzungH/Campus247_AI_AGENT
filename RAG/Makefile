.PHONY: install crawl convert index search-test run test lint clean

install:
	pip install -e .[dev]

crawl:
	python -m src.scripts.crawl

convert:
	python -m src.scripts.convert

index:
	python -m src.scripts.index

search-test:
	python -m src.scripts.search_test

run:
	streamlit run src/app.py

test:
	pytest tests/

lint:
	ruff check .
	ruff format .

clean:
	rm -rf vectorstore/
	rm -rf data/
	rm -rf .pytest_cache
	find . -type d -name __pycache__ -exec rm -rf {} +

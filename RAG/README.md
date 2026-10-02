# VinUni Student Services RAG Chatbot

This project implements a Retrieval-Augmented Generation (RAG) chatbot for VinUni student services, specifically focusing on document requests (giấy tờ) and complaints (khiếu nại).

## Pipeline
The pipeline follows a standard RAG architecture with advanced retrieval techniques:
1. **Crawl**: Download content from official VinUni policies and registrar websites.
2. **Convert**: Parse HTML/PDF documents into clean text.
3. **Chunk**: Split documents into semantic chunks.
4. **Index**: Store chunks in a vector database (ChromaDB) and build BM25 index.
5. **Hybrid Retrieval**: Perform dense (semantic) and sparse (BM25 keyword) searches.
6. **RRF (Reciprocal Rank Fusion)**: Combine scores from dense and sparse retrievers.
7. **Fallback**: Fallback to general page index search if specific chunks are not found.
8. **Generation with Citation**: Generate answers using LLM with inline citations mapping to source chunks.

## Data Sources
The chatbot uses the following data sources:
1. Request Transcripts & Certifications
2. Document Request Form
3. Formal Escalation Management Procedure
4. Formal Escalation Management Procedure (PDF)
5. Academic Regulations
6. Student Academic Integrity
7. Student Affairs Regulations & Code of Conduct
8. Residential Life Guideline
9. Library Policies for Users
10. Facility Usage Regulations
11. Room Bookings

## Quick Start
1. Clone the repository
2. Install dependencies: `make install`
3. Copy `.env.example` to `.env` and configure your API keys
4. Crawl data: `make crawl`
5. Convert data: `make convert`
6. Index data: `make index`
7. Run the application: `make run`

## Folder Structure
- `src/`: Main source code
  - `config.py`: Configuration and data sources
  - `contracts.py`: Pydantic models for data contracts
- `tests/`: Unit and integration tests
- `vectorstore/`: ChromaDB persistent storage (created after indexing)
- `data/`: Raw and processed data (created after crawling/converting)

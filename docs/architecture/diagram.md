# Architecture Diagram

## System Overview

```mermaid
graph TB
    User([User]) --> UI[frontend/<br/>Next.js]
    UI -.->|P0 REST, chưa nối| API[backend/src/campus247<br/>FastAPI]
    API --> P0[Conversation / ticket / claim]
    API --> Agent[LangGraph Agent]
    P0 --> DB[(PostgreSQL / SQLite)]
    Agent --> LLM[LLM Service]
    Agent --> Tools[Agent Tools]
    Agent --> VS[Vector Store<br/>ChromaDB]
```

## Agent Flow

```mermaid
graph LR
    START((Start)) --> Input[Parse Input]
    Input --> Analyze[Analyze Query]
    Analyze --> Decide{Need Tool?}
    Decide -->|Yes| CallTool[Call Tool]
    CallTool --> Analyze
    Decide -->|No| Generate[Generate Response]
    Generate --> END((End))
```

## Component Details

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React/Next.js | User interface |
| Backend | FastAPI | API server |
| Agent | LangGraph | AI agent orchestration |
| LLM | OpenAI/Gemini | Language model |
| Database | PostgreSQL/SQLite | Data persistence |
| Vector Store | ChromaDB | RAG / embeddings |

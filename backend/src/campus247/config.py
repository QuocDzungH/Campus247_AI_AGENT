from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", str(_REPO_ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "AI20K Agent"
    app_env: Literal["development", "production", "test"] = "development"
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = "0.0.0.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "http://localhost:3000"

    # LLM. Canonical model name is llm_model; model_name is a compatibility alias.
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    model_name: str = "gpt-4o-mini"
    llm_temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    openai_api_key: str = ""
    google_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    deepseek_api_key: str = ""
    anthropic_api_key: str = ""
    openai_base_url: str = ""
    agent_mode: Literal["stub", "langgraph"] = "stub"

    # Database
    database_url: str = "sqlite:///./data/app.db"
    demo_auth_enabled: bool = True
    session_ttl_seconds: int = Field(default=8 * 3600, ge=60)
    preview_ttl_seconds: int = Field(default=30 * 60, ge=60)
    idempotency_ttl_seconds: int = Field(default=24 * 3600, ge=60)
    worker_lease_seconds: int = Field(default=60, ge=5)
    worker_max_attempts: int = Field(default=3, ge=1)

    # Vector Store
    chroma_persist_dir: str = "./data/chroma"

    @model_validator(mode="after")
    def apply_model_name_alias(self) -> Self:
        """Use MODEL_NAME only when LLM_MODEL was not set. llm_model stays canonical if both exist."""
        if "llm_model" not in self.model_fields_set and "model_name" in self.model_fields_set:
            self.llm_model = self.model_name
        return self

    def resolved_llm_model(self) -> str:
        """Canonical chat model name. llm_model wins; model_name is a legacy alias."""
        return (self.llm_model or self.model_name).strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()

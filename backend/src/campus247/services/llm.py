"""LLM provider factory. This module is the only place that imports vendor chat clients."""

from __future__ import annotations

from typing import Literal

from langchain_core.language_models.chat_models import BaseChatModel

from campus247.config import Settings, get_settings

LLMProvider = Literal["openai", "google", "groq", "openai_compatible"]
SUPPORTED_LLM_PROVIDERS: tuple[LLMProvider, ...] = ("openai", "google", "groq", "openai_compatible")
PROVIDER_CALL_TIMEOUT_SECONDS = 10.0


class LLMConfigurationError(ValueError):
    """Raised when langgraph mode cannot build a provider client from settings."""


def normalize_llm_provider(value: str) -> LLMProvider:
    provider = (value or "").strip().lower()
    aliases = {"gemini": "google", "openai-compatible": "openai_compatible"}
    provider = aliases.get(provider, provider)
    if provider not in SUPPORTED_LLM_PROVIDERS:
        supported = ", ".join(SUPPORTED_LLM_PROVIDERS)
        raise LLMConfigurationError(
            f"llm_provider={value!r} is not supported. Use one of: {supported}."
        )
    return provider  # type: ignore[return-value]


def google_api_key(settings: Settings) -> str:
    return (settings.google_api_key or settings.gemini_api_key).strip()


def validate_llm_settings(settings: Settings) -> LLMProvider:
    provider = normalize_llm_provider(settings.llm_provider)
    model_name = settings.resolved_llm_model()
    if not model_name:
        raise LLMConfigurationError("llm_model is required when AGENT_MODE=langgraph.")
    if provider == "openai":
        if not settings.openai_api_key.strip():
            raise LLMConfigurationError("OPENAI_API_KEY is required for llm_provider=openai.")
    elif provider == "google":
        if not google_api_key(settings):
            raise LLMConfigurationError(
                "GOOGLE_API_KEY (or GEMINI_API_KEY) is required for llm_provider=google."
            )
    elif provider == "groq":
        if not settings.groq_api_key.strip():
            raise LLMConfigurationError("GROQ_API_KEY is required for llm_provider=groq.")
    elif provider == "openai_compatible":
        if not settings.openai_api_key.strip():
            raise LLMConfigurationError("OPENAI_API_KEY is required for llm_provider=openai_compatible.")
        if not settings.openai_base_url.strip():
            raise LLMConfigurationError("OPENAI_BASE_URL is required for llm_provider=openai_compatible.")
    return provider


def create_chat_model(settings: Settings) -> BaseChatModel:
    """Build a chat model for the configured provider. Does not perform a network call."""
    provider = validate_llm_settings(settings)
    model_name = settings.resolved_llm_model()
    temperature = settings.llm_temperature
    timeout = PROVIDER_CALL_TIMEOUT_SECONDS

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model_name,
            api_key=settings.openai_api_key,
            temperature=temperature,
            timeout=timeout,
            max_retries=0,
        )
    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=google_api_key(settings),
            temperature=temperature,
            timeout=timeout,
            max_retries=0,
        )
    if provider == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=model_name,
            groq_api_key=settings.groq_api_key,
            temperature=temperature,
            request_timeout=timeout,
            max_retries=0,
        )

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model_name,
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url.strip(),
        temperature=temperature,
        timeout=timeout,
        max_retries=0,
    )


def get_llm() -> BaseChatModel:
    """Compatibility wrapper. Prefer create_chat_model(settings) at the composition root."""
    return create_chat_model(get_settings())

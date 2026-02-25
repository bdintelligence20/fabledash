"""Application configuration using pydantic-settings for environment variable management."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-credentials.json"
    OPENAI_API_KEY: str = ""
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    LOG_LEVEL: str = "INFO"

    # Sage Business Cloud Accounting API
    SAGE_CLIENT_ID: str = ""
    SAGE_CLIENT_SECRET: str = ""
    SAGE_API_BASE_URL: str = "https://api.accounting.sage.com/v3.1"
    SAGE_REDIRECT_URI: str = "http://localhost:8000/sage/callback"

    @property
    def cors_origins_list(self) -> list[str]:
        """Split CORS_ORIGINS string into a list of origins."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()

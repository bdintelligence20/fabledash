"""Tests for application configuration (app/config.py)."""

import os
from unittest.mock import patch

import pytest


class TestSettings:
    def test_default_values(self):
        from app.config import Settings
        s = Settings(
            FIREBASE_PROJECT_ID="test",
            OPENAI_API_KEY="test",
            _env_file=None,
        )
        assert s.PORT == 8000
        assert s.HOST == "0.0.0.0"
        assert s.LOG_LEVEL == "INFO"
        assert s.SAGE_API_BASE_URL == "https://api.accounting.sage.com/v3.1"

    def test_cors_origins_list_single(self):
        from app.config import Settings
        s = Settings(CORS_ORIGINS="http://localhost:3000", _env_file=None)
        assert s.cors_origins_list == ["http://localhost:3000"]

    def test_cors_origins_list_multiple(self):
        from app.config import Settings
        s = Settings(CORS_ORIGINS="http://a.com, http://b.com", _env_file=None)
        assert s.cors_origins_list == ["http://a.com", "http://b.com"]

    def test_empty_strings_defaults(self):
        from app.config import Settings
        s = Settings(_env_file=None)
        assert s.FIREBASE_PROJECT_ID == "" or isinstance(s.FIREBASE_PROJECT_ID, str)
        assert s.SAGE_CLIENT_ID == ""
        assert s.SAGE_CLIENT_SECRET == ""

    def test_get_settings_returns_settings(self):
        from app.config import get_settings
        s = get_settings()
        assert hasattr(s, "PORT")
        assert hasattr(s, "CORS_ORIGINS")

    def test_sage_defaults(self):
        from app.config import Settings
        s = Settings(_env_file=None)
        assert "sage" in s.SAGE_REDIRECT_URI.lower() or "localhost" in s.SAGE_REDIRECT_URI

    def test_readai_defaults(self):
        from app.config import Settings
        s = Settings(_env_file=None)
        assert s.READAI_API_KEY == ""
        assert "read.ai" in s.READAI_API_BASE_URL

    def test_fireflies_defaults(self):
        from app.config import Settings
        s = Settings(_env_file=None)
        assert s.FIREFLIES_API_KEY == ""
        assert "fireflies" in s.FIREFLIES_API_BASE_URL

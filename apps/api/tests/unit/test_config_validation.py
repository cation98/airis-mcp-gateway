"""Tests for configuration validation."""
import os
import pytest
from unittest.mock import patch


class TestValidateEnvironment:
    """Test validate_environment function."""

    def test_warns_when_allowed_origins_not_set(self):
        """Should warn when ALLOWED_ORIGINS is not set."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("ALLOWED_ORIGINS", None)

            from app.core.config import validate_environment
            warnings = validate_environment()

        assert any("ALLOWED_ORIGINS" in w for w in warnings)

    def test_warns_when_allowed_origins_is_wildcard(self):
        """Should warn when ALLOWED_ORIGINS is '*'."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "*"}):
            from app.core.config import validate_environment
            warnings = validate_environment()

        assert any("ALLOWED_ORIGINS" in w for w in warnings)

    def test_no_warning_when_allowed_origins_set(self):
        """Should not warn when ALLOWED_ORIGINS is properly set."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "https://app.example.com"}):
            from app.core.config import validate_environment
            warnings = validate_environment()

        assert not any("ALLOWED_ORIGINS not set" in w for w in warnings)

    def test_warns_when_api_key_not_set(self):
        """Should warn when AIRIS_API_KEY is not set."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("AIRIS_API_KEY", None)

            from app.core.config import validate_environment
            warnings = validate_environment()

        assert any("AIRIS_API_KEY" in w for w in warnings)

    def test_warns_when_timeout_too_low(self):
        """Should warn when TOOL_CALL_TIMEOUT is very low."""
        with patch.dict(os.environ, {"TOOL_CALL_TIMEOUT": "5"}):
            # Need to reload settings to pick up new env var
            from app.core import config
            original_timeout = config.settings.TOOL_CALL_TIMEOUT
            config.settings.TOOL_CALL_TIMEOUT = 5.0

            try:
                warnings = config.validate_environment()
                assert any("very low" in w for w in warnings)
            finally:
                config.settings.TOOL_CALL_TIMEOUT = original_timeout

    def test_warns_when_timeout_too_high(self):
        """Should warn when TOOL_CALL_TIMEOUT is very high."""
        from app.core import config
        original_timeout = config.settings.TOOL_CALL_TIMEOUT
        config.settings.TOOL_CALL_TIMEOUT = 600.0

        try:
            warnings = config.validate_environment()
            assert any("very high" in w for w in warnings)
        finally:
            config.settings.TOOL_CALL_TIMEOUT = original_timeout

    def test_warns_when_ip_limit_higher_than_key_limit(self):
        """Should warn when IP rate limit is higher than API key limit."""
        with patch.dict(os.environ, {
            "RATE_LIMIT_PER_IP": "500",
            "RATE_LIMIT_PER_API_KEY": "100"
        }):
            from app.core.config import validate_environment
            warnings = validate_environment()

        assert any("RATE_LIMIT_PER_IP" in w and ">" in w for w in warnings)

"""Tests for CORS configuration."""
import os
import pytest
from unittest.mock import patch


class TestParseAllowedOrigins:
    """Test _parse_allowed_origins function."""

    def test_returns_wildcard_when_not_set(self):
        """Should return ['*'] when ALLOWED_ORIGINS is not set."""
        with patch.dict(os.environ, {}, clear=True):
            # Remove ALLOWED_ORIGINS if it exists
            os.environ.pop("ALLOWED_ORIGINS", None)

            # Import fresh to get the parsed value
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        assert result == ["*"]

    def test_returns_wildcard_when_empty(self):
        """Should return ['*'] when ALLOWED_ORIGINS is empty string."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": ""}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        assert result == ["*"]

    def test_parses_single_origin(self):
        """Should parse single origin correctly."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "http://localhost:3000"}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        assert result == ["http://localhost:3000"]

    def test_parses_multiple_origins(self):
        """Should parse multiple comma-separated origins."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "http://localhost:3000,https://app.example.com"}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        assert result == ["http://localhost:3000", "https://app.example.com"]

    def test_strips_whitespace(self):
        """Should strip whitespace from origins (critical for split())."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "http://localhost:3000, https://app.example.com , http://test.com"}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        # No leading/trailing whitespace
        assert result == ["http://localhost:3000", "https://app.example.com", "http://test.com"]
        for origin in result:
            assert origin == origin.strip()

    def test_filters_empty_strings(self):
        """Should filter out empty strings from result."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "http://localhost:3000,,, https://app.example.com,"}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        # No empty strings
        assert "" not in result
        assert result == ["http://localhost:3000", "https://app.example.com"]

    def test_handles_only_whitespace_and_commas(self):
        """Should return ['*'] when only whitespace and commas."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": " , , , "}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        assert result == ["*"]

    def test_preserves_port_numbers(self):
        """Should preserve port numbers in origins."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "http://localhost:3000,http://localhost:8080"}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        assert "http://localhost:3000" in result
        assert "http://localhost:8080" in result

    def test_preserves_https_scheme(self):
        """Should preserve HTTPS scheme."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": "https://secure.example.com"}):
            from app.main import _parse_allowed_origins
            result = _parse_allowed_origins()

        assert result == ["https://secure.example.com"]

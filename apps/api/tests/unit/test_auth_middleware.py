"""Tests for optional bearer token authentication middleware."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.middleware.auth import OptionalBearerAuth


class TestOptionalBearerAuth:
    """Test OptionalBearerAuth middleware."""

    @pytest.fixture
    def mock_app(self):
        """Create a mock app."""
        return AsyncMock()

    @pytest.fixture
    def mock_request(self):
        """Create a mock request."""
        request = MagicMock()
        request.url = MagicMock()
        request.headers = {}
        return request

    @pytest.fixture
    def mock_call_next(self):
        """Create a mock call_next."""
        return AsyncMock(return_value="response")

    @pytest.mark.asyncio
    async def test_no_api_key_configured_allows_all(self, mock_app, mock_request, mock_call_next):
        """When no API key is configured, all requests should pass."""
        middleware = OptionalBearerAuth(mock_app, api_key=None)
        mock_request.url.path = "/api/tools/combined"

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_empty_api_key_allows_all(self, mock_app, mock_request, mock_call_next):
        """When API key is empty string, all requests should pass."""
        middleware = OptionalBearerAuth(mock_app, api_key="")
        mock_request.url.path = "/api/tools/combined"

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_health_endpoint_bypasses_auth(self, mock_app, mock_request, mock_call_next):
        """Health endpoint should bypass auth even when API key is set."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/health"

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_ready_endpoint_bypasses_auth(self, mock_app, mock_request, mock_call_next):
        """Ready endpoint should bypass auth even when API key is set."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/ready"

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_root_endpoint_bypasses_auth(self, mock_app, mock_request, mock_call_next):
        """Root endpoint should bypass auth even when API key is set."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/"

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_valid_bearer_token_passes(self, mock_app, mock_request, mock_call_next):
        """Valid bearer token should pass authentication."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/api/tools/combined"
        mock_request.headers = {"authorization": "Bearer secret-key"}

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_valid_bearer_token_case_insensitive(self, mock_app, mock_request, mock_call_next):
        """Bearer token prefix should be case insensitive."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/api/tools/combined"
        mock_request.headers = {"authorization": "BEARER secret-key"}

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, mock_app, mock_request, mock_call_next):
        """Invalid bearer token should return 401."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/api/tools/combined"
        mock_request.headers = {"authorization": "Bearer wrong-key"}

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, mock_call_next)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "unauthorized"

    @pytest.mark.asyncio
    async def test_missing_auth_header_returns_401(self, mock_app, mock_request, mock_call_next):
        """Missing authorization header should return 401 when API key is set."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/api/tools/combined"
        mock_request.headers = {}

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, mock_call_next)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "unauthorized"

    @pytest.mark.asyncio
    async def test_non_bearer_auth_returns_401(self, mock_app, mock_request, mock_call_next):
        """Non-bearer authorization should return 401."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/api/tools/combined"
        mock_request.headers = {"authorization": "Basic dXNlcjpwYXNz"}

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, mock_call_next)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "unauthorized"

    @pytest.mark.asyncio
    async def test_token_with_extra_spaces(self, mock_app, mock_request, mock_call_next):
        """Token with extra spaces should be trimmed."""
        middleware = OptionalBearerAuth(mock_app, api_key="secret-key")
        mock_request.url.path = "/api/tools/combined"
        mock_request.headers = {"authorization": "Bearer   secret-key  "}

        result = await middleware.dispatch(mock_request, mock_call_next)

        assert result == "response"
        mock_call_next.assert_called_once_with(mock_request)

"""Tests for request size limiting middleware."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from starlette.datastructures import Headers

from app.middleware.request_size import RequestSizeLimitMiddleware


class TestRequestSizeLimitMiddleware:
    """Test RequestSizeLimitMiddleware."""

    @pytest.fixture
    def mock_app(self):
        """Create mock app."""
        return AsyncMock()

    @pytest.fixture
    def mock_response(self):
        """Create mock response."""
        response = MagicMock()
        response.status_code = 200
        return response

    @pytest.fixture
    def mock_call_next(self, mock_response):
        """Create mock call_next."""
        return AsyncMock(return_value=mock_response)

    def _create_request(self, content_length: str = None):
        """Helper to create mock request."""
        request = MagicMock()
        headers = {}
        if content_length is not None:
            headers["content-length"] = content_length
        request.headers = Headers(headers)
        return request

    @pytest.mark.asyncio
    async def test_allows_small_request(self, mock_app, mock_call_next):
        """Should allow requests under the limit."""
        middleware = RequestSizeLimitMiddleware(mock_app, max_size=1024)
        request = self._create_request(content_length="500")

        response = await middleware.dispatch(request, mock_call_next)

        mock_call_next.assert_called_once()
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_blocks_large_request(self, mock_app, mock_call_next):
        """Should return 413 for requests over the limit."""
        middleware = RequestSizeLimitMiddleware(mock_app, max_size=1024)
        request = self._create_request(content_length="2048")

        response = await middleware.dispatch(request, mock_call_next)

        mock_call_next.assert_not_called()
        assert response.status_code == 413

    @pytest.mark.asyncio
    async def test_allows_request_at_limit(self, mock_app, mock_call_next):
        """Should allow requests exactly at the limit."""
        middleware = RequestSizeLimitMiddleware(mock_app, max_size=1024)
        request = self._create_request(content_length="1024")

        response = await middleware.dispatch(request, mock_call_next)

        mock_call_next.assert_called_once()
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_allows_request_without_content_length(self, mock_app, mock_call_next):
        """Should allow requests without Content-Length header."""
        middleware = RequestSizeLimitMiddleware(mock_app, max_size=1024)
        request = self._create_request(content_length=None)

        response = await middleware.dispatch(request, mock_call_next)

        mock_call_next.assert_called_once()
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_allows_invalid_content_length(self, mock_app, mock_call_next):
        """Should allow requests with invalid Content-Length (let later handlers deal with it)."""
        middleware = RequestSizeLimitMiddleware(mock_app, max_size=1024)
        request = self._create_request(content_length="invalid")

        response = await middleware.dispatch(request, mock_call_next)

        mock_call_next.assert_called_once()
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_default_max_size(self, mock_app, mock_call_next):
        """Should use default max size from environment."""
        # Default is 10MB
        middleware = RequestSizeLimitMiddleware(mock_app)
        assert middleware.max_size == 10 * 1024 * 1024

    @pytest.mark.asyncio
    async def test_413_response_body(self, mock_app, mock_call_next):
        """413 response should include error details."""
        middleware = RequestSizeLimitMiddleware(mock_app, max_size=1024)
        request = self._create_request(content_length="2048")

        response = await middleware.dispatch(request, mock_call_next)

        assert response.status_code == 413
        # JSONResponse body
        import json
        body = json.loads(response.body)
        assert body["error"] == "payload_too_large"
        assert body["max_size"] == 1024

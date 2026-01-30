"""Tests for rate limiting middleware."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from starlette.datastructures import Headers

from app.middleware.rate_limit import (
    RateLimitMiddleware,
    RateLimitStore,
    EXCLUDED_PATHS,
    RATE_LIMIT_PER_IP,
    RATE_LIMIT_PER_API_KEY,
)


class TestRateLimitStore:
    """Test RateLimitStore."""

    def test_allows_requests_under_limit(self):
        """Should allow requests under the limit."""
        store = RateLimitStore()

        for i in range(10):
            allowed, retry_after = store.check_and_increment("test-key", limit=10)
            assert allowed is True
            assert retry_after == 0

    def test_blocks_requests_over_limit(self):
        """Should block requests over the limit."""
        store = RateLimitStore()

        # Use up the limit
        for i in range(10):
            store.check_and_increment("test-key", limit=10)

        # Next request should be blocked
        allowed, retry_after = store.check_and_increment("test-key", limit=10)
        assert allowed is False
        assert retry_after > 0

    def test_different_keys_have_separate_limits(self):
        """Different keys should have separate rate limits."""
        store = RateLimitStore()

        # Use up limit for key1
        for i in range(5):
            store.check_and_increment("key1", limit=5)

        # key1 is blocked
        allowed, _ = store.check_and_increment("key1", limit=5)
        assert allowed is False

        # key2 should still work
        allowed, _ = store.check_and_increment("key2", limit=5)
        assert allowed is True

    def test_clear_resets_all_entries(self):
        """Clear should reset all entries."""
        store = RateLimitStore()

        # Use up the limit
        for i in range(5):
            store.check_and_increment("test-key", limit=5)

        # Blocked
        allowed, _ = store.check_and_increment("test-key", limit=5)
        assert allowed is False

        # Clear
        store.clear()

        # Should work again
        allowed, _ = store.check_and_increment("test-key", limit=5)
        assert allowed is True


class TestRateLimitMiddleware:
    """Test RateLimitMiddleware."""

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

    @pytest.fixture
    def fresh_store(self):
        """Create fresh rate limit store for each test."""
        return RateLimitStore()

    def _create_request(self, path: str = "/api/test", headers: dict = None, client_ip: str = "127.0.0.1"):
        """Helper to create mock request."""
        request = MagicMock()
        request.url = MagicMock()
        request.url.path = path
        request.headers = Headers(headers or {})
        request.client = MagicMock()
        request.client.host = client_ip
        return request

    @pytest.mark.asyncio
    async def test_allows_request_under_limit(self, mock_app, mock_call_next, fresh_store):
        """Should allow requests under the limit."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)
        request = self._create_request()

        response = await middleware.dispatch(request, mock_call_next)

        mock_call_next.assert_called_once()
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_blocks_request_over_limit(self, mock_app, mock_call_next, fresh_store):
        """Should return 429 when limit exceeded."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)
        request = self._create_request()

        # Use up the limit
        for _ in range(RATE_LIMIT_PER_IP):
            await middleware.dispatch(request, mock_call_next)

        # Reset mock to verify next call
        mock_call_next.reset_mock()

        # Next request should be blocked
        response = await middleware.dispatch(request, mock_call_next)

        mock_call_next.assert_not_called()
        assert response.status_code == 429
        assert "Retry-After" in response.headers

    @pytest.mark.asyncio
    async def test_excludes_health_endpoint(self, mock_app, mock_call_next, fresh_store):
        """Should skip rate limiting for /health."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)
        request = self._create_request(path="/health")

        # Make many requests - should all pass
        for _ in range(RATE_LIMIT_PER_IP + 10):
            response = await middleware.dispatch(request, mock_call_next)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_excludes_ready_endpoint(self, mock_app, mock_call_next, fresh_store):
        """Should skip rate limiting for /ready."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)
        request = self._create_request(path="/ready")

        # Make many requests - should all pass
        for _ in range(RATE_LIMIT_PER_IP + 10):
            response = await middleware.dispatch(request, mock_call_next)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_excludes_metrics_endpoint(self, mock_app, mock_call_next, fresh_store):
        """Should skip rate limiting for /metrics."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)
        request = self._create_request(path="/metrics")

        # Make many requests - should all pass
        for _ in range(RATE_LIMIT_PER_IP + 10):
            response = await middleware.dispatch(request, mock_call_next)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_api_key_has_higher_limit(self, mock_app, mock_call_next, fresh_store):
        """API key should have higher limit than IP."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)

        # Request with API key
        request_with_key = self._create_request(
            headers={"authorization": "Bearer test-api-key-123"}
        )

        # Should allow more than IP limit
        for i in range(RATE_LIMIT_PER_IP + 50):
            response = await middleware.dispatch(request_with_key, mock_call_next)
            # Should still be allowed (API key limit is higher)
            if i < RATE_LIMIT_PER_API_KEY:
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_extracts_ip_from_x_forwarded_for(self, mock_app, mock_call_next, fresh_store):
        """Should extract IP from X-Forwarded-For header."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)

        # First client
        request1 = self._create_request(
            headers={"x-forwarded-for": "203.0.113.1, 10.0.0.1"},
            client_ip="127.0.0.1"
        )

        # Use up limit for first client
        for _ in range(RATE_LIMIT_PER_IP):
            await middleware.dispatch(request1, mock_call_next)

        # First client blocked
        response1 = await middleware.dispatch(request1, mock_call_next)
        assert response1.status_code == 429

        # Different client should still work
        request2 = self._create_request(
            headers={"x-forwarded-for": "203.0.113.2"},
            client_ip="127.0.0.1"
        )
        mock_call_next.reset_mock()
        response2 = await middleware.dispatch(request2, mock_call_next)
        assert response2.status_code == 200

    @pytest.mark.asyncio
    async def test_429_response_has_retry_after_header(self, mock_app, mock_call_next, fresh_store):
        """429 response should include Retry-After header."""
        middleware = RateLimitMiddleware(mock_app, store=fresh_store)
        request = self._create_request()

        # Use up the limit
        for _ in range(RATE_LIMIT_PER_IP):
            await middleware.dispatch(request, mock_call_next)

        # Get 429 response
        response = await middleware.dispatch(request, mock_call_next)

        assert response.status_code == 429
        assert "Retry-After" in response.headers
        retry_after = int(response.headers["Retry-After"])
        assert 0 < retry_after <= 61  # Should be within the window


class TestExcludedPaths:
    """Test excluded paths configuration."""

    def test_excluded_paths_contains_health(self):
        """Should exclude /health."""
        assert "/health" in EXCLUDED_PATHS

    def test_excluded_paths_contains_ready(self):
        """Should exclude /ready."""
        assert "/ready" in EXCLUDED_PATHS

    def test_excluded_paths_contains_metrics(self):
        """Should exclude /metrics."""
        assert "/metrics" in EXCLUDED_PATHS

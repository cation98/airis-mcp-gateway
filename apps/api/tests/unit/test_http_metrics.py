"""Tests for HTTP metrics middleware."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.middleware.http_metrics import (
    HTTPMetricsMiddleware,
    HTTPMetricsStore,
    LatencyStats,
)


class TestLatencyStats:
    """Test LatencyStats."""

    def test_empty_returns_none(self):
        """Empty stats should return None for percentiles."""
        stats = LatencyStats()
        assert stats.p50 is None
        assert stats.p95 is None
        assert stats.p99 is None

    def test_single_sample(self):
        """Single sample should be returned for all percentiles."""
        stats = LatencyStats()
        stats.add(100.0)

        assert stats.p50 == 100.0
        assert stats.p95 == 100.0
        assert stats.p99 == 100.0

    def test_percentile_calculation(self):
        """Should calculate percentiles correctly."""
        stats = LatencyStats()
        for i in range(1, 101):
            stats.add(float(i))

        # p50 should be around 50
        assert 49 <= stats.p50 <= 51

        # p95 should be around 95
        assert 94 <= stats.p95 <= 96

        # p99 should be around 99
        assert 98 <= stats.p99 <= 100

    def test_max_samples_limit(self):
        """Should keep only max_samples most recent."""
        stats = LatencyStats(max_samples=10)

        # Add 20 samples
        for i in range(20):
            stats.add(float(i))

        # Should have 10 samples (10-19)
        assert len(stats.samples) == 10
        assert stats.samples[0] == 10.0
        assert stats.samples[-1] == 19.0


class TestHTTPMetricsStore:
    """Test HTTPMetricsStore."""

    def test_record_request(self):
        """Should record request counts."""
        store = HTTPMetricsStore()

        store.record_request("GET", "/health", 200, 10.0)
        store.record_request("GET", "/health", 200, 15.0)
        store.record_request("POST", "/api/data", 201, 50.0)

        counts = store.get_request_counts()

        assert counts[("GET", "/health", 200)] == 2
        assert counts[("POST", "/api/data", 201)] == 1

    def test_normalize_path_removes_query_params(self):
        """Should remove query params from path."""
        store = HTTPMetricsStore()

        store.record_request("GET", "/api/data?page=1&limit=10", 200, 10.0)

        counts = store.get_request_counts()
        assert ("GET", "/api/data", 200) in counts

    def test_normalize_path_collapses_hex_ids(self):
        """Should collapse long hex ID segments to {id}."""
        store = HTTPMetricsStore()

        # Hex IDs without dashes get collapsed
        store.record_request("GET", "/api/users/550e8400e29b41d4", 200, 10.0)
        store.record_request("GET", "/api/users/a1b2c3d4e5f67890", 200, 15.0)

        counts = store.get_request_counts()
        # Both should be normalized to the same path
        assert ("GET", "/api/users/{id}", 200) in counts
        assert counts[("GET", "/api/users/{id}", 200)] == 2

    def test_latency_stats(self):
        """Should track latency stats per path."""
        store = HTTPMetricsStore()

        for i in range(100):
            store.record_request("GET", "/health", 200, float(i))

        stats = store.get_latency_stats()
        assert "/health" in stats
        assert stats["/health"]["p50"] is not None
        assert stats["/health"]["p95"] is not None
        assert stats["/health"]["p99"] is not None

    def test_clear(self):
        """Should clear all metrics."""
        store = HTTPMetricsStore()
        store.record_request("GET", "/health", 200, 10.0)

        store.clear()

        assert store.get_request_counts() == {}
        assert store.get_latency_stats() == {}


class TestHTTPMetricsMiddleware:
    """Test HTTPMetricsMiddleware."""

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
        """Create fresh store for each test."""
        return HTTPMetricsStore()

    @pytest.mark.asyncio
    async def test_records_request(self, mock_app, mock_call_next, fresh_store):
        """Should record request metrics."""
        middleware = HTTPMetricsMiddleware(mock_app, store=fresh_store)

        request = MagicMock()
        request.method = "GET"
        request.url = MagicMock()
        request.url.path = "/api/test"

        await middleware.dispatch(request, mock_call_next)

        counts = fresh_store.get_request_counts()
        assert ("GET", "/api/test", 200) in counts

    @pytest.mark.asyncio
    async def test_records_latency(self, mock_app, mock_call_next, fresh_store):
        """Should record request latency."""
        middleware = HTTPMetricsMiddleware(mock_app, store=fresh_store)

        request = MagicMock()
        request.method = "GET"
        request.url = MagicMock()
        request.url.path = "/api/test"

        await middleware.dispatch(request, mock_call_next)

        stats = fresh_store.get_latency_stats()
        assert "/api/test" in stats

    @pytest.mark.asyncio
    async def test_records_different_status_codes(
        self, mock_app, fresh_store
    ):
        """Should record different status codes separately."""
        middleware = HTTPMetricsMiddleware(mock_app, store=fresh_store)

        request = MagicMock()
        request.method = "GET"
        request.url = MagicMock()
        request.url.path = "/api/test"

        # 200 response
        response_200 = MagicMock()
        response_200.status_code = 200
        await middleware.dispatch(request, AsyncMock(return_value=response_200))

        # 404 response
        response_404 = MagicMock()
        response_404.status_code = 404
        await middleware.dispatch(request, AsyncMock(return_value=response_404))

        counts = fresh_store.get_request_counts()
        assert counts[("GET", "/api/test", 200)] == 1
        assert counts[("GET", "/api/test", 404)] == 1

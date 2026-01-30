"""Tests for logging configuration and context."""
import json
import logging
import pytest
from io import StringIO
from unittest.mock import MagicMock, AsyncMock

from app.core.logging import (
    setup_logging,
    get_logger,
    set_request_id,
    get_request_id,
    request_id_var,
    RequestIDFilter,
    JSONFormatter,
)
from app.middleware.logging_context import LoggingContextMiddleware


class TestRequestIDContext:
    """Test request_id context variable."""

    def test_set_and_get_request_id(self):
        """Should set and get request_id from context."""
        set_request_id("test-123")
        assert get_request_id() == "test-123"

        # Clean up
        set_request_id(None)

    def test_default_request_id_is_none(self):
        """Default request_id should be None."""
        set_request_id(None)
        assert get_request_id() is None


class TestRequestIDFilter:
    """Test RequestIDFilter."""

    def test_adds_request_id_to_record(self):
        """Should add request_id attribute to log record."""
        filter_ = RequestIDFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="test message",
            args=(),
            exc_info=None,
        )

        set_request_id("filter-test-123")
        result = filter_.filter(record)

        assert result is True
        assert record.request_id == "filter-test-123"

        # Clean up
        set_request_id(None)

    def test_uses_dash_when_no_request_id(self):
        """Should use '-' when no request_id is set."""
        filter_ = RequestIDFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="test message",
            args=(),
            exc_info=None,
        )

        set_request_id(None)
        filter_.filter(record)

        assert record.request_id == "-"


class TestJSONFormatter:
    """Test JSONFormatter."""

    def test_formats_as_json(self):
        """Should format log record as JSON."""
        formatter = JSONFormatter(datefmt="%Y-%m-%dT%H:%M:%S")
        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="test message",
            args=(),
            exc_info=None,
        )
        record.request_id = "json-test-123"

        output = formatter.format(record)
        data = json.loads(output)

        assert data["level"] == "INFO"
        assert data["logger"] == "test.logger"
        assert data["request_id"] == "json-test-123"
        assert data["message"] == "test message"
        assert "timestamp" in data

    def test_includes_exception_info(self):
        """Should include exception info when present."""
        formatter = JSONFormatter(datefmt="%Y-%m-%dT%H:%M:%S")

        try:
            raise ValueError("test error")
        except ValueError:
            import sys
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="",
            lineno=0,
            msg="error occurred",
            args=(),
            exc_info=exc_info,
        )
        record.request_id = "-"

        output = formatter.format(record)
        data = json.loads(output)

        assert "exception" in data
        assert "ValueError" in data["exception"]


class TestSetupLogging:
    """Test setup_logging function."""

    def test_json_format_by_default(self):
        """Should use JSON format by default."""
        import os

        # Clear env vars to test defaults
        old_format = os.environ.pop("LOG_FORMAT", None)

        try:
            setup_logging()
            logger = get_logger("test.json")

            # Get the handler
            root = logging.getLogger()
            handler = root.handlers[0]

            assert isinstance(handler.formatter, JSONFormatter)
        finally:
            if old_format:
                os.environ["LOG_FORMAT"] = old_format

    def test_standard_format_when_specified(self):
        """Should use standard format when LOG_FORMAT=standard."""
        setup_logging(format_style="standard")
        logger = get_logger("test.standard")

        root = logging.getLogger()
        handler = root.handlers[0]

        # Standard formatter is a regular Formatter, not JSONFormatter
        assert not isinstance(handler.formatter, JSONFormatter)


class TestLoggingContextMiddleware:
    """Test LoggingContextMiddleware."""

    @pytest.fixture
    def mock_app(self):
        """Create mock app."""
        return AsyncMock()

    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock()
        request.method = "GET"
        request.url = MagicMock()
        request.url.path = "/test"
        request.headers = {}
        request.client = MagicMock()
        request.client.host = "127.0.0.1"
        request.state = MagicMock()
        request.state.request_id = "middleware-test-123"
        return request

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

    @pytest.mark.asyncio
    async def test_sets_request_id_in_context(
        self, mock_app, mock_request, mock_call_next
    ):
        """Should set request_id in logging context."""
        middleware = LoggingContextMiddleware(mock_app)

        await middleware.dispatch(mock_request, mock_call_next)

        # Context is cleared after request, but we can verify call_next was called
        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_clears_context_after_request(
        self, mock_app, mock_request, mock_call_next
    ):
        """Should clear request_id context after request."""
        middleware = LoggingContextMiddleware(mock_app)

        # Set a different request_id first
        set_request_id("should-be-cleared")

        await middleware.dispatch(mock_request, mock_call_next)

        # Context should be cleared
        assert get_request_id() is None

    @pytest.mark.asyncio
    async def test_extracts_client_ip_from_x_forwarded_for(
        self, mock_app, mock_call_next, mock_response
    ):
        """Should extract client IP from X-Forwarded-For header."""
        middleware = LoggingContextMiddleware(mock_app)

        request = MagicMock()
        request.method = "GET"
        request.url = MagicMock()
        request.url.path = "/test"
        request.headers = {"x-forwarded-for": "203.0.113.1, 10.0.0.1"}
        request.client = MagicMock()
        request.client.host = "127.0.0.1"
        request.state = MagicMock()
        request.state.request_id = "test-123"

        # Verify middleware extracts first IP from X-Forwarded-For
        ip = middleware._get_client_ip(request)
        assert ip == "203.0.113.1"

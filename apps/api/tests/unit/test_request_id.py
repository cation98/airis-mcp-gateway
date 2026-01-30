"""Tests for Request ID middleware."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from starlette.datastructures import Headers

from app.middleware.request_id import RequestIDMiddleware, REQUEST_ID_HEADER


class TestRequestIDMiddleware:
    """Test RequestIDMiddleware."""

    @pytest.fixture
    def mock_app(self):
        """Create a mock app."""
        return AsyncMock()

    @pytest.fixture
    def mock_request(self):
        """Create a mock request with state support."""
        request = MagicMock()
        request.headers = Headers({})
        request.state = MagicMock()
        return request

    @pytest.fixture
    def mock_response(self):
        """Create a mock response with headers dict."""
        response = MagicMock()
        response.headers = {}
        return response

    @pytest.fixture
    def mock_call_next(self, mock_response):
        """Create a mock call_next that returns mock response."""
        return AsyncMock(return_value=mock_response)

    @pytest.mark.asyncio
    async def test_generates_request_id_when_not_provided(
        self, mock_app, mock_request, mock_call_next, mock_response
    ):
        """Should generate a new UUID when X-Request-ID is not provided."""
        middleware = RequestIDMiddleware(mock_app)
        mock_request.headers = Headers({})

        response = await middleware.dispatch(mock_request, mock_call_next)

        # Should have set request_id on request.state
        assert hasattr(mock_request.state, 'request_id')
        request_id = mock_request.state.request_id

        # Should be a valid UUID format (36 chars with dashes)
        assert len(request_id) == 36
        assert request_id.count('-') == 4

        # Should include ID in response header
        assert response.headers[REQUEST_ID_HEADER] == request_id

    @pytest.mark.asyncio
    async def test_propagates_request_id_when_provided(
        self, mock_app, mock_request, mock_call_next, mock_response
    ):
        """Should propagate existing X-Request-ID when provided."""
        middleware = RequestIDMiddleware(mock_app)
        provided_id = "fixed-request-id-123"
        mock_request.headers = Headers({REQUEST_ID_HEADER: provided_id})

        response = await middleware.dispatch(mock_request, mock_call_next)

        # Should use the provided ID
        assert mock_request.state.request_id == provided_id

        # Should include same ID in response header
        assert response.headers[REQUEST_ID_HEADER] == provided_id

    @pytest.mark.asyncio
    async def test_stores_request_id_in_request_state(
        self, mock_app, mock_request, mock_call_next
    ):
        """Should store request_id in request.state for downstream access."""
        middleware = RequestIDMiddleware(mock_app)
        mock_request.headers = Headers({})

        await middleware.dispatch(mock_request, mock_call_next)

        # Verify request.state.request_id was set
        assert hasattr(mock_request.state, 'request_id')
        assert mock_request.state.request_id is not None

    @pytest.mark.asyncio
    async def test_call_next_is_invoked(
        self, mock_app, mock_request, mock_call_next
    ):
        """Should invoke call_next to continue request processing."""
        middleware = RequestIDMiddleware(mock_app)
        mock_request.headers = Headers({})

        await middleware.dispatch(mock_request, mock_call_next)

        mock_call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_empty_header_generates_new_id(
        self, mock_app, mock_request, mock_call_next, mock_response
    ):
        """Empty X-Request-ID header should result in new UUID."""
        middleware = RequestIDMiddleware(mock_app)
        mock_request.headers = Headers({REQUEST_ID_HEADER: ""})

        response = await middleware.dispatch(mock_request, mock_call_next)

        # Empty string is falsy, should generate new ID
        request_id = mock_request.state.request_id
        assert len(request_id) == 36
        assert response.headers[REQUEST_ID_HEADER] == request_id

"""
Tests for MCP proxy routing and session handling.
"""
import pytest
from httpx import AsyncClient
from typing import Dict
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.requests import Request

from apps.api.app.api.endpoints.mcp_proxy import (
    _build_gateway_sse_url,
    _build_stream_gateway_url,
)


pytestmark = pytest.mark.asyncio


def _build_mock_gateway_response(status_code: int = 200, content: bytes = b"{}"):
    """Helper to build a fake gateway response."""
    response = MagicMock()
    response.status_code = status_code
    response.content = content
    response.headers = {"content-type": "application/json"}
    return response


async def _make_proxy_request(path: str, headers: Dict[str, str] | None = None):
    """Execute a POST request against the FastAPI proxy."""
    from apps.api.app.main import app

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {"clientInfo": {"name": "test", "version": "0.0.1"}, "capabilities": {}},
    }

    async with AsyncClient(app=app, base_url="http://testserver") as client:
        return await client.post(path, json=payload, headers=headers)


async def test_proxy_preserves_session_query():
    """Ensure JSON POSTs to /sse keep the sessionid query when forwarded."""
    mock_response = _build_mock_gateway_response()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        resp = await _make_proxy_request(
            "/api/v1/mcp/sse?sessionid=abc123",
            headers={"Accept": "application/json"},
        )

    assert resp.status_code == 200
    called_url = mock_post.await_args.args[0]
    assert called_url == "http://mcp-gateway:9390/sse?sessionid=abc123"


async def test_proxy_root_path_defaults_to_gateway_base():
    """POST /api/v1/mcp/ should forward to the gateway root path."""
    mock_response = _build_mock_gateway_response()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        resp = await _make_proxy_request("/api/v1/mcp/")

    assert resp.status_code == 200
    called_url = mock_post.await_args.args[0]
    assert called_url == "http://mcp-gateway:9390/"


def test_build_gateway_sse_url_preserves_querystring():
    """Ensure SSE proxy keeps session-specific queries when targeting the gateway."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/mcp/sse",
        "query_string": b"sessionid=abc&foo=bar",
        "headers": [],
        "client": ("test", 0),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    request = Request(scope)

    url = _build_gateway_sse_url(request)
    assert url == "http://mcp-gateway:9390/sse?sessionid=abc&foo=bar"


def test_build_stream_gateway_url_strips_api_prefix():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/mcp/.well-known/oauth-authorization-server",
        "query_string": b"",
        "headers": [],
        "client": ("test", 0),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    request = Request(scope)
    url = _build_stream_gateway_url(request)
    assert url == "http://mcp-gateway-stream:9091/mcp/.well-known/oauth-authorization-server"


async def test_post_sse_with_accept_header_streams_sse():
    """POST /sse with Accept: text/event-stream should stream SSE traffic."""
    from apps.api.app.main import app

    captured = {}

    class MockStreamResponse:
        def __init__(self, lines):
            self._lines = lines

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return False

        async def aiter_lines(self):
            for line in self._lines:
                yield line

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return False

        def stream(self, method, url, headers):
            captured["method"] = method
            captured["url"] = url
            captured["headers"] = headers
            return MockStreamResponse(
                ['data: {"jsonrpc": "2.0", "id": 1, "result": {}}\n']
            )

    with patch("apps.api.app.api.endpoints.mcp_proxy.httpx.AsyncClient", MockAsyncClient):
        async with AsyncClient(app=app, base_url="http://testserver") as client:
            resp = await client.post(
                "/api/v1/mcp/sse?sessionid=abc123",
                headers={"Accept": "text/event-stream"},
            )

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
    assert 'data: {"jsonrpc": "2.0", "id": 1, "result": {}}\n\n' == resp.text
    assert captured["method"] == "GET"
    assert captured["url"] == "http://mcp-gateway:9390/sse?sessionid=abc123"


async def test_stream_proxy_without_session_id_forwards_to_stream_gateway():
    """Codex streamable_http requests (no sessionid) should use the streaming gateway."""
    from apps.api.app.main import app

    captured = {}

    class MockStreamResponse:
        def __init__(self):
            self.status_code = 200
            self.headers = {"content-type": "application/json"}

        async def aiter_raw(self):
            yield b'{"jsonrpc":"2.0","result":{}}\n'

        async def aread(self):
            return b""

        async def aclose(self):
            captured["stream_closed"] = True

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            captured["client_timeout"] = kwargs.get("timeout")

        def build_request(self, method, url, headers=None, content=None):
            captured["method"] = method
            captured["url"] = url
            captured["headers"] = headers
            captured["content"] = content
            return object()

        async def send(self, request, stream=False, follow_redirects=True):
            captured["stream"] = stream
            captured["follow_redirects"] = follow_redirects
            return MockStreamResponse()

        async def aclose(self):
            captured["client_closed"] = True

    with patch("apps.api.app.api.endpoints.mcp_proxy.httpx.AsyncClient", MockAsyncClient):
        async with AsyncClient(app=app, base_url="http://testserver") as client:
            resp = await client.post(
                "/api/v1/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {"clientInfo": {"name": "test", "version": "0.0.1"}, "capabilities": {}},
                },
            )

    assert resp.status_code == 200
    assert resp.text == '{"jsonrpc":"2.0","result":{}}\n'
    assert captured["url"] == "http://mcp-gateway-stream:9091/mcp"
    assert captured["method"] == "POST"
    assert captured["stream"] is True
    assert captured["follow_redirects"] is True
    assert captured["client_closed"] is True
    assert captured["stream_closed"] is True


async def test_stream_proxy_appends_initialized_notification_for_sse():
    """Ensure streamable HTTP responses include notifications/initialized for handshake."""
    from apps.api.app.main import app

    class MockStreamResponse:
        def __init__(self):
            self.status_code = 200
            self.headers = {"content-type": "text/event-stream"}

        async def aiter_lines(self):
            yield "event: message"
            yield 'data: {"jsonrpc":"2.0","id":1,"result":{}}'
            yield ""

        async def aiter_raw(self):
            yield b""

        async def aread(self):
            return b""

        async def aclose(self):
            return None

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        def build_request(self, method, url, headers=None, content=None):
            return object()

        async def send(self, request, stream=False, follow_redirects=True):
            assert stream is True
            return MockStreamResponse()

        async def aclose(self):
            return None

    with patch("apps.api.app.api.endpoints.mcp_proxy.httpx.AsyncClient", MockAsyncClient):
        async with AsyncClient(app=app, base_url="http://testserver") as client:
            resp = await client.post(
                "/api/v1/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {"clientInfo": {"name": "test", "version": "0.0.1"}, "capabilities": {}},
                },
            )

    assert resp.status_code == 200
    body = resp.text.strip()
    assert 'notifications/initialized' in body
    events = [segment for segment in body.split("\n\n") if segment]
    assert len(events) == 2

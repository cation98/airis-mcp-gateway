from app.main import app


def test_public_sse_route_registered():
    """Verify the Codex-compatible /sse passthrough stays wired up."""
    matching_routes = [
        route for route in app.routes if getattr(route, "path", None) == "/sse"
    ]
    assert matching_routes, "Expected /sse route to be registered on the FastAPI app"
    assert any("GET" in getattr(route, "methods", set()) for route in matching_routes)

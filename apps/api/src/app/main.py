"""
AIRIS MCP Gateway API - Hybrid MCP Multiplexer.

Routes:
- Docker MCP servers -> Docker MCP Gateway (port 9390)
- Process MCP servers (uvx/npx) -> Direct subprocess management
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

from .api.endpoints import mcp_proxy
from .api.endpoints import process_mcp
from .core.process_manager import initialize_process_manager, get_process_manager

MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://gateway:9390")
MCP_CONFIG_PATH = os.getenv("MCP_CONFIG_PATH", "/app/mcp-config.json")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("AIRIS MCP Gateway API starting")
    print(f"   Docker Gateway URL: {MCP_GATEWAY_URL}")
    print(f"   MCP Config Path: {MCP_CONFIG_PATH}")

    # Initialize ProcessManager for uvx/npx servers
    try:
        await initialize_process_manager(MCP_CONFIG_PATH)
        manager = get_process_manager()
        print(f"   Process servers: {manager.get_server_names()}")
        print(f"   Enabled: {manager.get_enabled_servers()}")
    except Exception as e:
        print(f"   ProcessManager init failed: {e}")

    yield

    # Shutdown ProcessManager
    print("Shutting down...")
    try:
        manager = get_process_manager()
        await manager.shutdown()
    except Exception as e:
        print(f"   ProcessManager shutdown error: {e}")


app = FastAPI(
    title="AIRIS MCP Gateway API",
    description="Proxy to docker/mcp-gateway with initialized notification fix",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount MCP proxy router (Docker Gateway proxy with initialized notification fix)
app.include_router(mcp_proxy.router, prefix="/mcp", tags=["mcp"])

# Mount Process MCP router (direct uvx/npx process management)
app.include_router(process_mcp.router, prefix="/process", tags=["process-mcp"])


# Root-level SSE endpoint for Claude Code compatibility
@app.get("/sse")
async def root_sse_proxy(request: Request):
    """SSE endpoint at root level for Claude Code compatibility."""
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        mcp_proxy.proxy_sse_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/sse")
async def root_sse_proxy_post(request: Request):
    """POST to /sse for transports that need it."""
    from fastapi.responses import StreamingResponse
    accept = request.headers.get("accept", "")
    if "text/event-stream" in accept.lower():
        return StreamingResponse(
            mcp_proxy.proxy_sse_stream(request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    # Fall back to JSON-RPC proxy
    return await mcp_proxy._proxy_jsonrpc_request(request)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/ready")
async def ready():
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{MCP_GATEWAY_URL}/health")
            gateway_ok = resp.status_code == 200
    except Exception:
        gateway_ok = False

    return {
        "ready": gateway_ok,
        "gateway": "ok" if gateway_ok else "unreachable",
    }


@app.get("/")
async def root():
    return {
        "service": "airis-mcp-gateway-api",
        "gateway_url": MCP_GATEWAY_URL,
    }

"""
AIRIS MCP Gateway API - Lite mode (stateless, no DB).

Minimal proxy to docker/mcp-gateway with health endpoints.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

# Config from env (all optional with sensible defaults)
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://gateway:9390")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lite mode: no initialization needed"""
    print("🚀 AIRIS MCP Gateway API starting (lite mode)")
    yield
    print("👋 Shutting down")


app = FastAPI(
    title="AIRIS MCP Gateway API",
    description="Lite proxy to docker/mcp-gateway",
    lifespan=lifespan,
)

# CORS - allow all for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Health check - always healthy if running"""
    return {"status": "healthy", "mode": "lite"}


@app.get("/ready")
async def ready():
    """Readiness check - verify gateway is reachable"""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{MCP_GATEWAY_URL}/health")
            gateway_ok = resp.status_code == 200
    except Exception:
        gateway_ok = False

    return {
        "ready": gateway_ok,
        "gateway": "ok" if gateway_ok else "unreachable",
        "mode": "lite",
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "airis-mcp-gateway-api",
        "mode": "lite",
        "gateway_url": MCP_GATEWAY_URL,
    }


# ============================================================
# SSE/MCP Proxy endpoints (forward to gateway)
# ============================================================

@app.get("/sse")
@app.get("/mcp/sse")
async def proxy_sse(request: Request):
    """Proxy SSE requests to gateway"""
    from starlette.responses import StreamingResponse

    async def stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("GET", f"{MCP_GATEWAY_URL}/sse") as resp:
                async for chunk in resp.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/sse")
@app.post("/mcp/sse")
@app.post("/mcp")
async def proxy_mcp_post(request: Request):
    """Proxy MCP JSON-RPC requests to gateway"""
    body = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{MCP_GATEWAY_URL}/sse",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        return resp.json()


@app.get("/mcp")
async def proxy_mcp_health():
    """Gateway MCP health"""
    async with httpx.AsyncClient(timeout=2.0) as client:
        resp = await client.get(f"{MCP_GATEWAY_URL}/health")
        return resp.json() if resp.status_code == 200 else {"status": "error"}

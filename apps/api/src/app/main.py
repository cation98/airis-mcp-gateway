from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api.routes import api_router
from .api.endpoints.mcp_proxy import (
    mcp_sse_proxy as api_mcp_sse_proxy,
    mcp_sse_proxy_post as api_mcp_sse_proxy_post,
    mcp_jsonrpc_proxy as api_mcp_jsonrpc_proxy,
    mcp_jsonrpc_proxy_root as api_mcp_jsonrpc_proxy_root,
    mcp_http_health_check as api_mcp_http_health_check,
    mcp_http_health_check_head as api_mcp_http_health_check_head,
    proxy_root_well_known,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    debug=settings.DEBUG,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/sse", include_in_schema=False)
async def public_mcp_sse_proxy(request: Request):
    """Compatibility SSE endpoint for editors that pin to the domain root."""
    return await api_mcp_sse_proxy(request)


@app.post("/sse", include_in_schema=False)
async def public_mcp_jsonrpc_proxy(request: Request):
    """Allow transports that POST to /sse (Codex streamable_http) to function."""
    return await api_mcp_sse_proxy_post(request)


@app.get("/mcp", include_in_schema=False)
@app.get("/mcp/", include_in_schema=False)
async def public_mcp_health_proxy():
    """Expose /mcp for clients that skip the API prefix."""
    return await api_mcp_http_health_check()


@app.head("/mcp", include_in_schema=False)
@app.head("/mcp/", include_in_schema=False)
async def public_mcp_health_head_proxy():
    """Expose HEAD /mcp for health checks."""
    return await api_mcp_http_health_check_head()


@app.post("/mcp", include_in_schema=False)
@app.post("/mcp/", include_in_schema=False)
async def public_mcp_jsonrpc_root_proxy(request: Request):
    """Expose POST /mcp for editors expecting the transport at the domain root."""
    return await api_mcp_jsonrpc_proxy_root(request)


@app.api_route("/.well-known/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def public_well_known_proxy(request: Request, path: str):
    """Forward /.well-known discovery requests to the streaming gateway."""
    return await proxy_root_well_known(request, path)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AIRIS MCP Gateway API",
        "version": "0.1.0",
        "docs": "/docs",
    }

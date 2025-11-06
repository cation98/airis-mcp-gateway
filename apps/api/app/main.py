from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api.routes import api_router
from .api.endpoints.mcp_proxy import (
    mcp_sse_proxy as api_mcp_sse_proxy,
    mcp_jsonrpc_proxy as api_mcp_jsonrpc_proxy,
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
    return await api_mcp_jsonrpc_proxy(request)


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

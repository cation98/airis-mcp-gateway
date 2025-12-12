"""
AIRIS MCP Gateway API - Schema Partitioning Mode.

Intercepts MCP protocol to reduce token usage:
- tools/list responses: Strip nested schemas (~90% reduction)
- expandSchema tool: Retrieve full schemas on-demand
- In-memory cache: Fast local schema lookups
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse, JSONResponse
import httpx
import os
import json
import asyncio
from typing import Any

from .core.schema_partitioning import (
    partition_tools_list,
    inject_expand_schema_tool,
    get_schema_at_path,
    EXPAND_SCHEMA_TOOL,
)

# Config from env
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://gateway:9390")
ENABLE_SCHEMA_PARTITIONING = os.getenv("ENABLE_SCHEMA_PARTITIONING", "true").lower() == "true"

# In-memory schema cache
# Key: tool name, Value: full inputSchema
_schema_cache: dict[str, dict[str, Any]] = {}
_cache_lock = asyncio.Lock()


async def refresh_schema_cache():
    """Fetch tools from gateway and cache full schemas."""
    global _schema_cache

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Send tools/list request to gateway
            resp = await client.post(
                f"{MCP_GATEWAY_URL}/sse",
                json={"jsonrpc": "2.0", "method": "tools/list", "id": "cache-refresh"},
                headers={"Content-Type": "application/json"},
            )

            if resp.status_code != 200:
                print(f"Failed to fetch tools: {resp.status_code}")
                return

            data = resp.json()
            tools = data.get("result", {}).get("tools", [])

            async with _cache_lock:
                _schema_cache.clear()
                for tool in tools:
                    name = tool.get("name")
                    if name and "inputSchema" in tool:
                        _schema_cache[name] = tool["inputSchema"]

            print(f"Schema cache refreshed: {len(_schema_cache)} tools")

    except Exception as e:
        print(f"Error refreshing schema cache: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize schema cache on startup."""
    print("Starting AIRIS MCP Gateway API (Schema Partitioning Mode)")
    print(f"  Gateway URL: {MCP_GATEWAY_URL}")
    print(f"  Schema Partitioning: {'enabled' if ENABLE_SCHEMA_PARTITIONING else 'disabled'}")

    if ENABLE_SCHEMA_PARTITIONING:
        # Initial cache population (with retry)
        for attempt in range(3):
            await asyncio.sleep(2)  # Wait for gateway to be ready
            await refresh_schema_cache()
            if _schema_cache:
                break
            print(f"Retry {attempt + 1}/3...")

    yield
    print("Shutting down")


app = FastAPI(
    title="AIRIS MCP Gateway API",
    description="MCP proxy with schema partitioning for token reduction",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Health Endpoints
# ============================================================

@app.get("/health")
async def health():
    """Health check."""
    return {
        "status": "healthy",
        "mode": "schema-partitioning" if ENABLE_SCHEMA_PARTITIONING else "passthrough",
        "cached_tools": len(_schema_cache),
    }


@app.get("/ready")
async def ready():
    """Readiness check."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{MCP_GATEWAY_URL}/health")
            gateway_ok = resp.status_code == 200
    except Exception:
        gateway_ok = False

    return {
        "ready": gateway_ok and (len(_schema_cache) > 0 if ENABLE_SCHEMA_PARTITIONING else True),
        "gateway": "ok" if gateway_ok else "unreachable",
        "cached_tools": len(_schema_cache),
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "airis-mcp-gateway-api",
        "mode": "schema-partitioning" if ENABLE_SCHEMA_PARTITIONING else "passthrough",
        "gateway_url": MCP_GATEWAY_URL,
        "cached_tools": len(_schema_cache),
    }


@app.post("/refresh-cache")
async def refresh_cache():
    """Manually refresh schema cache."""
    await refresh_schema_cache()
    return {"status": "refreshed", "cached_tools": len(_schema_cache)}


# ============================================================
# MCP Protocol Handlers
# ============================================================

def process_tools_list_response(data: dict[str, Any]) -> dict[str, Any]:
    """
    Process tools/list response:
    1. Cache full schemas
    2. Partition schemas for reduced tokens
    3. Inject expandSchema tool
    """
    if "result" not in data or "tools" not in data.get("result", {}):
        return data

    tools = data["result"]["tools"]

    # Update cache with full schemas
    for tool in tools:
        name = tool.get("name")
        if name and "inputSchema" in tool:
            _schema_cache[name] = tool["inputSchema"]

    if not ENABLE_SCHEMA_PARTITIONING:
        return data

    # Partition schemas
    partitioned_tools = partition_tools_list(tools)

    # Inject expandSchema tool
    partitioned_tools = inject_expand_schema_tool(partitioned_tools)

    # Return modified response
    result = data.copy()
    result["result"] = {"tools": partitioned_tools}

    return result


def handle_expand_schema(params: dict[str, Any]) -> dict[str, Any]:
    """
    Handle expandSchema tool call.
    Returns full schema from cache.
    """
    tool_name = params.get("toolName")
    path = params.get("path", [])

    if not tool_name:
        return {"error": "toolName is required"}

    if tool_name not in _schema_cache:
        return {"error": f"Unknown tool: {tool_name}", "available": list(_schema_cache.keys())}

    full_schema = _schema_cache[tool_name]

    if path:
        schema_at_path = get_schema_at_path(full_schema, path)
        if schema_at_path is None:
            return {"error": f"Path not found: {path}", "schema": full_schema}
        return {"toolName": tool_name, "path": path, "schema": schema_at_path}

    return {"toolName": tool_name, "schema": full_schema}


def is_expand_schema_call(data: dict[str, Any]) -> bool:
    """Check if this is an expandSchema tool call."""
    if data.get("method") != "tools/call":
        return False
    params = data.get("params", {})
    return params.get("name") == "expandSchema"


async def process_mcp_request(body: bytes) -> tuple[bytes, bool]:
    """
    Process incoming MCP request.
    Returns (response_body, handled_locally).
    """
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return body, False

    # Handle expandSchema locally
    if is_expand_schema_call(data):
        params = data.get("params", {}).get("arguments", {})
        result = handle_expand_schema(params)

        response = {
            "jsonrpc": "2.0",
            "id": data.get("id"),
            "result": {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]},
        }
        return json.dumps(response).encode(), True

    return body, False


async def process_mcp_response(body: bytes, request_body: bytes) -> bytes:
    """
    Process MCP response from gateway.
    Applies schema partitioning to tools/list responses.
    """
    try:
        request_data = json.loads(request_body)
        response_data = json.loads(body)
    except json.JSONDecodeError:
        return body

    # Only process tools/list responses
    if request_data.get("method") == "tools/list":
        processed = process_tools_list_response(response_data)
        return json.dumps(processed).encode()

    return body


# ============================================================
# SSE/MCP Proxy Endpoints
# ============================================================

@app.get("/sse")
@app.get("/mcp/sse")
@app.get("/api/v1/mcp/sse")
async def proxy_sse_get(request: Request):
    """Proxy SSE GET requests (event stream)."""

    async def stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("GET", f"{MCP_GATEWAY_URL}/sse") as resp:
                async for chunk in resp.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/sse")
@app.post("/mcp/sse")
@app.post("/mcp")
@app.post("/api/v1/mcp/sse")
async def proxy_mcp_post(request: Request):
    """
    Proxy MCP JSON-RPC requests with schema partitioning.

    - expandSchema calls: handled locally from cache
    - tools/list responses: partitioned before returning
    - Other requests: passed through to gateway
    """
    body = await request.body()

    # Check for locally-handled requests
    processed_body, handled = await process_mcp_request(body)
    if handled:
        return JSONResponse(json.loads(processed_body))

    # Build gateway URL with query parameters (sessionid, etc.)
    gateway_url = f"{MCP_GATEWAY_URL}/sse"
    if request.query_params:
        gateway_url = f"{gateway_url}?{request.query_params}"

    # Forward to gateway
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            gateway_url,
            content=body,
            headers={"Content-Type": "application/json"},
        )

        response_body = resp.content

        # Process response (schema partitioning for tools/list)
        if ENABLE_SCHEMA_PARTITIONING:
            response_body = await process_mcp_response(response_body, body)

        try:
            return JSONResponse(json.loads(response_body))
        except json.JSONDecodeError:
            return JSONResponse({"error": "Invalid response from gateway"}, status_code=502)


@app.get("/mcp")
@app.get("/api/v1/mcp")
async def mcp_info():
    """MCP endpoint info."""
    return {
        "status": "ok",
        "schema_partitioning": ENABLE_SCHEMA_PARTITIONING,
        "cached_tools": len(_schema_cache),
        "gateway": MCP_GATEWAY_URL,
    }


# ============================================================
# Debug Endpoints
# ============================================================

@app.get("/debug/cache")
async def debug_cache():
    """View cached schemas (debug only)."""
    return {
        "tools": list(_schema_cache.keys()),
        "count": len(_schema_cache),
    }


@app.get("/debug/cache/{tool_name}")
async def debug_cache_tool(tool_name: str):
    """View specific tool's cached schema."""
    if tool_name not in _schema_cache:
        return JSONResponse({"error": f"Tool not found: {tool_name}"}, status_code=404)
    return {"tool": tool_name, "schema": _schema_cache[tool_name]}


@app.get("/debug/token-savings")
async def debug_token_savings():
    """Estimate token savings from schema partitioning."""
    if not _schema_cache:
        return {"error": "Cache is empty"}

    # Rough estimation: 4 chars per token
    full_size = sum(len(json.dumps(s)) for s in _schema_cache.values())
    partitioned_tools = partition_tools_list([
        {"name": n, "inputSchema": s} for n, s in _schema_cache.items()
    ])
    partitioned_size = sum(len(json.dumps(t.get("inputSchema", {}))) for t in partitioned_tools)

    full_tokens = full_size // 4
    partitioned_tokens = partitioned_size // 4
    saved_tokens = full_tokens - partitioned_tokens
    reduction_pct = (saved_tokens / full_tokens * 100) if full_tokens > 0 else 0

    return {
        "tools_count": len(_schema_cache),
        "full_schema_chars": full_size,
        "partitioned_chars": partitioned_size,
        "estimated_tokens": {
            "full": full_tokens,
            "partitioned": partitioned_tokens,
            "saved": saved_tokens,
        },
        "reduction_percent": round(reduction_pct, 1),
    }

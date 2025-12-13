---
name: MCP Initialize Race Condition
about: Report issues with Docker MCP Gateway initialize/initialized handshake timing
title: "[MCP Gateway] tools/call rejected before initialize handshake"
labels: bug, mcp-gateway
assignees: ''
---

## Summary

Docker MCP Gateway rejects `tools/call` requests unless the `initialize` → `initialized` handshake sequence is explicitly performed with proper delays.

## Environment

- **Docker MCP Gateway**: `docker/mcp-gateway:latest` (or specify tag/commit)
- **Client**: FastAPI Proxy (airis-mcp-gateway)
- **Date**: YYYY-MM-DD

## Expected Behavior

When a client sends `tools/call` as the first request, the Gateway should:
1. Internally wait for initialization to complete
2. Or return a clear "not initialized" error that triggers client-side init

## Actual Behavior

The Gateway rejects `tools/call` immediately if `initialize`/`initialized` hasn't been sent first.

## Workaround

The airis-mcp-gateway proxy implements a forced handshake sequence:

```python
# Force initialize handshake before any tools/call
async def _ensure_initialized(session_id: str):
    # 1. Send initialize request
    await send_jsonrpc(session_id, {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "proxy", "version": "1.0"}
        }
    })

    # 2. Wait for response
    await asyncio.sleep(0.15)

    # 3. Send initialized notification
    await send_jsonrpc(session_id, {
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    })

    # 4. Wait before actual request
    await asyncio.sleep(0.10)
```

## Reproduction Steps

1. Start Docker MCP Gateway
2. Connect via SSE, obtain session ID
3. Immediately send `tools/call` without initialize handshake
4. Observe rejection/error
5. Perform initialize → wait → initialized → wait → tools/call
6. Observe success

## Logs

<details>
<summary>Gateway logs showing the issue</summary>

```
[paste relevant logs here]
```

</details>

## Proposed Solution

One of:
1. Gateway auto-initializes on first request
2. Gateway queues requests until initialized
3. Gateway returns specific error code for "not initialized" state

## Related

- MCP Protocol Specification: initialize/initialized lifecycle
- Docker MCP Gateway repository issues

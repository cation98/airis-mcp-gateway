"""
MCP Proxy Endpoint with OpenMCP Lazy Loading Pattern

Claude Code → FastAPI (/mcp/sse) → Docker MCP Gateway (http://mcp-gateway:9090/sse)
"""

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from typing import Any, Dict, Optional
import httpx
import json
import asyncio
from ...core.schema_partitioning import schema_partitioner
from ...core.config import settings
from ...core.protocol_logger import protocol_logger

router = APIRouter()


async def proxy_sse_stream(request: Request):
    """
    SSEストリームをDocker MCP GatewayからProxyしてschema partitioning適用

    Args:
        request: FastAPI Request

    Yields:
        Server-Sent Events
    """
    initialize_request_id = None  # initialize リクエストIDを追跡

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "GET",
            f"{settings.MCP_GATEWAY_URL}/sse",
            headers=dict(request.headers),
        ) as response:
            async for line in response.aiter_lines():
                if not line:
                    yield "\n"
                    continue

                # SSE形式: "data: {...}\n\n"
                if line.startswith("data: "):
                    data_str = line[6:]  # "data: " を除去

                    try:
                        data = json.loads(data_str)

                        # initialize リクエストを検出
                        if isinstance(data, dict) and data.get("method") == "initialize":
                            initialize_request_id = data.get("id")
                            print(f"[MCP Proxy] Detected initialize request (id={initialize_request_id})")
                            # Log initialize request
                            await protocol_logger.log_message("client→server", data, {"phase": "initialize"})

                        # tools/list レスポンスをインターセプト
                        if isinstance(data, dict) and data.get("method") == "tools/list":
                            # Log tools/list request
                            await protocol_logger.log_message("client→server", data, {"phase": "tools_list"})
                            data = await apply_schema_partitioning(data)
                            # Log tools/list response (after partitioning)
                            await protocol_logger.log_message("server→client", data, {"phase": "tools_list"})

                        # 変換後のデータを返す
                        yield f"data: {json.dumps(data)}\n\n"

                        # initialize responseを検出したら initialized notification を送信
                        if (isinstance(data, dict) and
                            "result" in data and
                            initialize_request_id is not None and
                            data.get("id") == initialize_request_id):

                            print(f"[MCP Proxy] Detected initialize response, sending initialized notification")
                            # Log initialize response
                            await protocol_logger.log_message("server→client", data, {"phase": "initialize"})

                            # initialized notification を送信
                            initialized_notification = {
                                "jsonrpc": "2.0",
                                "method": "notifications/initialized"
                            }
                            yield f"data: {json.dumps(initialized_notification)}\n\n"

                            # リクエストIDをリセット
                            initialize_request_id = None

                    except json.JSONDecodeError:
                        # JSONでない場合はそのまま
                        yield f"{line}\n"
                else:
                    yield f"{line}\n"


async def apply_schema_partitioning(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    tools/list レスポンスにschema partitioning適用

    Args:
        data: tools/list JSON-RPC 2.0 レスポンス

    Returns:
        Schema partitioningされたレスポンス
    """
    if "result" not in data or "tools" not in data["result"]:
        return data

    tools = data["result"]["tools"]
    partitioned_tools = []

    for tool in tools:
        tool_name = tool.get("name", "")
        input_schema = tool.get("inputSchema", {})

        # フルスキーマを保存（expandSchema用）
        if input_schema:
            schema_partitioner.store_full_schema(tool_name, input_schema)

        # スキーマを分割
        partitioned_schema = schema_partitioner.partition_schema(input_schema)

        # トークン削減効果をログ出力
        reduction = schema_partitioner.get_token_reduction_estimate(input_schema)
        print(f"[Schema Partitioning] {tool_name}: {reduction['full']} → {reduction['partitioned']} tokens ({reduction['reduction']}% reduction)")

        partitioned_tool = {
            **tool,
            "inputSchema": partitioned_schema
        }
        partitioned_tools.append(partitioned_tool)

    # expandSchema ツールを追加
    expand_schema_tool = {
        "name": "expandSchema",
        "description": "Get detailed schema for specific tool parameters. Use this when you need to know the structure of nested properties.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "toolName": {
                    "type": "string",
                    "description": "Name of the tool whose schema you want to expand"
                },
                "path": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Path to the property to expand (e.g., ['metadata', 'shipping']). Omit for full schema."
                }
            },
            "required": ["toolName"]
        }
    }
    partitioned_tools.append(expand_schema_tool)

    data["result"]["tools"] = partitioned_tools
    return data


@router.get("/sse")
async def mcp_sse_proxy(request: Request):
    """
    MCP SSE Proxy Endpoint

    Claude Code connects via the public API URL (`${GATEWAY_API_URL}/v1/mcp/sse`)
    """
    return StreamingResponse(
        proxy_sse_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx buffering無効化
        }
    )


async def _proxy_jsonrpc_request(request: Request) -> Response:
    """
    MCP JSON-RPC 2.0 Proxy Endpoint（tools/call用）

    Args:
        request: JSON-RPC 2.0 リクエスト

    Returns:
        JSON-RPC 2.0 レスポンス
    """
    body = await request.body()
    rpc_request = json.loads(body)

    # expandSchema ツールコール処理
    if rpc_request.get("method") == "tools/call":
        params = rpc_request.get("params", {})
        tool_name = params.get("name", "")

        if tool_name == "expandSchema":
            # expandSchema は Gateway にproxyしない（ローカル処理）
            return await handle_expand_schema(rpc_request)

    # その他のツールコールはGatewayにproxy
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.MCP_GATEWAY_URL}/",
            content=body,
            headers={"Content-Type": "application/json"}
        )

        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers)
        )


@router.post("/")
async def mcp_jsonrpc_proxy(request: Request):
    """Expose the JSON-RPC proxy at /api/v1/mcp/."""
    return await _proxy_jsonrpc_request(request)


@router.post("/sse", include_in_schema=False)
async def mcp_jsonrpc_proxy_sse_alias(request: Request):
    """
    Compatibility alias so transports that POST to /sse instead of /
    (Codex streamable_http) still hit the same proxy logic.
    """
    return await _proxy_jsonrpc_request(request)


async def handle_expand_schema(rpc_request: Dict[str, Any]) -> Dict[str, Any]:
    """
    expandSchema ツールコールをローカル処理

    Args:
        rpc_request: JSON-RPC 2.0 リクエスト

    Returns:
        JSON-RPC 2.0 レスポンス
    """
    params = rpc_request.get("params", {})
    arguments = params.get("arguments", {})

    tool_name = arguments.get("toolName")
    path = arguments.get("path")

    # Log expandSchema request
    await protocol_logger.log_message("client→server", rpc_request, {
        "phase": "expand_schema",
        "tool_name": tool_name
    })

    if not tool_name:
        error_response = {
            "jsonrpc": "2.0",
            "id": rpc_request.get("id"),
            "error": {
                "code": -32602,
                "message": "toolName is required"
            }
        }
        await protocol_logger.log_message("server→client", error_response, {
            "phase": "expand_schema",
            "tool_name": tool_name
        })
        return error_response

    # フルスキーマから該当パスを取得
    expanded_schema = schema_partitioner.expand_schema(tool_name, path)

    if expanded_schema is None:
        error_response = {
            "jsonrpc": "2.0",
            "id": rpc_request.get("id"),
            "error": {
                "code": -32602,
                "message": f"Schema not found for tool: {tool_name}"
            }
        }
        await protocol_logger.log_message("server→client", error_response, {
            "phase": "expand_schema",
            "tool_name": tool_name
        })
        return error_response

    success_response = {
        "jsonrpc": "2.0",
        "id": rpc_request.get("id"),
        "result": {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(expanded_schema, indent=2)
                }
            ]
        }
    }

    # Log expandSchema response
    await protocol_logger.log_message("server→client", success_response, {
        "phase": "expand_schema",
        "tool_name": tool_name
    })

    return success_response

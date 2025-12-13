"""
MCP Proxy Endpoint with OpenMCP Lazy Loading Pattern

Claude Code → FastAPI (/mcp/sse) → Docker MCP Gateway (http://mcp-gateway:9390/sse)
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
from ...core.process_manager import get_process_manager

router = APIRouter()


def _summarize_description(description: str, max_length: int = 160) -> str:
    """
    Generate a compact summary for tools/list responses.
    """
    if not description:
        return ""

    text = description.strip()
    if not text:
        return ""

    for delimiter in [". ", "。", "！", "?", "？", "\n"]:
        idx = text.find(delimiter)
        if 0 < idx:
            if delimiter == "\n":
                text = text[:idx]
            else:
                text = text[: idx + len(delimiter.strip())]
            break

    if len(text) > max_length:
        text = text[: max_length - 1].rstrip() + "…"

    return text


def _extract_server_name_from_tool(tool_name: str) -> Optional[str]:
    """
    ツール名からMCPサーバー名を推測して抽出

    Rules:
    1. expandSchema → None (特殊ツール、常に有効)
    2. mindbase_*, github_*, tavily_* → prefix部分がサーバー名
    3. read_file, write_file, list_dir → filesystem or serena (曖昧)
    4. find_symbol, find_referencing_symbols → serena
    5. get_time, fetch_url → built-in (always enabled)

    Args:
        tool_name: ツール名

    Returns:
        サーバー名 or None (判定不能/常時有効)
    """
    if not tool_name:
        return None

    # expandSchemaは特殊ツール（Proxy側で生成）
    if tool_name == "expandSchema":
        return None

    # Built-in servers (Gateway起動時に--serversで自動有効化、DBに記録されない)
    builtin_tools = {
        "get_time", "get_current_time",
        "fetch", "fetch_url",
        "git_status", "git_diff", "git_commit", "git_push",
        "read_memory", "write_memory", "delete_memory"
    }
    if tool_name in builtin_tools:
        return None  # Built-inは常時有効

    # アンダースコア区切りでprefix抽出
    parts = tool_name.split("_")
    if len(parts) >= 2:
        prefix = parts[0]

        # 既知のサーバー名パターン
        known_servers = {
            "mindbase", "github", "tavily", "stripe", "twilio",
            "supabase", "notion", "slack", "figma", "cloudflare",
            "docker", "postgres", "mongodb", "sqlite"
        }

        if prefix in known_servers:
            return prefix

    # filesystem vs serena の曖昧なツール
    # → とりあえずfilesystemとして扱う（serenaのツールはfind_symbolなど特徴的）
    filesystem_tools = {
        "read_file", "write_file", "create_file", "delete_file",
        "list_dir", "list_directory", "search_files",
        "read_text_file", "read_media_file", "read_multiple_files", "edit_file"
    }
    if tool_name in filesystem_tools:
        return "filesystem"

    # serena特有のツール
    serena_tools = {
        "find_symbol", "find_referencing_symbols", "get_symbols_overview",
        "insert_after_symbol", "replace_symbol", "delete_symbol",
        "activate_project", "switch_modes"
    }
    if tool_name in serena_tools:
        return "serena"

    # context7ツール
    if tool_name.startswith("context7_") or tool_name in ["search_docs", "get_documentation"]:
        return "context7"

    # sequential-thinkingツール
    if tool_name in ["think", "sequential_think", "reasoning"]:
        return "sequential-thinking"

    # gateway-controlツール
    if tool_name in ["list_mcp_servers", "enable_mcp_server", "disable_mcp_server", "get_mcp_server_status"]:
        return "airis-mcp-gateway-control"

    # playwright/puppeteerツール
    if any(keyword in tool_name for keyword in ["browser", "page", "click", "navigate", "screenshot"]):
        # より詳細な判定が必要だが、とりあえずplaywrightとする
        return "playwright"

    # 判定不能 → サーバー名として最初の部分を使用
    return parts[0] if parts else None


async def proxy_sse_stream(request: Request):
    """
    SSEストリームをDocker MCP GatewayからProxyしてschema partitioning適用

    Args:
        request: FastAPI Request

    Yields:
        Server-Sent Events
    """
    initialize_request_id = None  # initialize リクエストIDを追跡
    session_id = request.query_params.get("sessionid")  # セッションID追跡
    endpoint_url = None  # エンドポイントURL追跡

    # Codex streamable_http sometimes POSTs to /sse with Content-Length headers.
    # Strip entity headers so the proxied GET doesn't advertise a body it never sends.
    forward_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"content-length", "content-type", "host"}
    }

    if not session_id:
        print("[MCP Proxy] SSE request missing sessionid", dict(request.headers))

    gateway_sse_url = _build_gateway_sse_url(request)

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "GET",
            gateway_sse_url,
            headers=forward_headers,
        ) as response:
            async for line in response.aiter_lines():
                if not line:
                    yield "\n"
                    continue

                # SSE形式: "event: xxx\n" or "data: {...}\n\n"
                if line.startswith("event: endpoint"):
                    yield f"{line}\n"
                    continue

                if line.startswith("data: "):
                    data_str = line[6:]  # "data: " を除去

                    # Check if it's an endpoint URL (not JSON)
                    if not data_str.startswith("{") and not data_str.startswith("["):
                        # Extract sessionid from endpoint URL if present
                        if "sessionid=" in data_str:
                            import re
                            match = re.search(r'sessionid=([A-Z0-9]+)', data_str)
                            if match:
                                session_id = match.group(1)
                                endpoint_url = data_str.strip()
                                print(f"[MCP Proxy] Captured endpoint URL with sessionid={session_id}")
                        yield f"{line}\n"
                        continue

                    try:
                        data = json.loads(data_str)

                        # initialize リクエストを検出（SSEストリームで見えることはないが念のため）
                        if isinstance(data, dict) and data.get("method") == "initialize":
                            initialize_request_id = data.get("id")
                            print(f"[MCP Proxy] Detected initialize request (id={initialize_request_id})")
                            await protocol_logger.log_message("client→server", data, {"phase": "initialize"})

                        # tools/list レスポンスをインターセプト
                        if isinstance(data, dict) and "result" in data and "tools" in data.get("result", {}):
                            await protocol_logger.log_message("client→server", data, {"phase": "tools_list"})
                            data = await apply_schema_partitioning(data)
                            await protocol_logger.log_message("server→client", data, {"phase": "tools_list"})

                        # 変換後のデータを返す
                        yield f"data: {json.dumps(data)}\n\n"

                        # initialize responseを検出したらGatewayに notifications/initialized を POST
                        if (isinstance(data, dict) and
                            "result" in data and
                            isinstance(data.get("result"), dict) and
                            "protocolVersion" in data.get("result", {})):

                            print(f"[MCP Proxy] Detected initialize response, sending initialized notification to Gateway")
                            await protocol_logger.log_message("server→client", data, {"phase": "initialize"})

                            # Gateway に notifications/initialized を POST
                            initialized_notification = {
                                "jsonrpc": "2.0",
                                "method": "notifications/initialized"
                            }

                            # sessionid を使って Gateway に POST
                            if session_id:
                                gateway_post_url = f"{settings.MCP_GATEWAY_URL.rstrip('/')}/sse?sessionid={session_id}"
                                try:
                                    post_response = await client.post(
                                        gateway_post_url,
                                        json=initialized_notification,
                                        headers={"Content-Type": "application/json"}
                                    )
                                    print(f"[MCP Proxy] Sent initialized notification to Gateway: {post_response.status_code}")
                                except Exception as e:
                                    print(f"[MCP Proxy] Failed to send initialized notification: {e}")
                            else:
                                print("[MCP Proxy] No sessionid available, cannot send initialized notification")

                    except json.JSONDecodeError:
                        # JSONでない場合はそのまま
                        yield f"{line}\n"
                else:
                    yield f"{line}\n"


async def apply_schema_partitioning(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    tools/list レスポンスにschema partitioning適用 + Process MCPツール統合

    Args:
        data: tools/list JSON-RPC 2.0 レスポンス

    Returns:
        Schema partitioningされたレスポンス（Docker + Process統合）
    """
    if "result" not in data or "tools" not in data["result"]:
        return data

    tools = list(data["result"]["tools"])

    # Process MCP サーバーからツールを取得して統合
    try:
        process_manager = get_process_manager()
        process_tools = await process_manager.list_tools()
        if process_tools:
            print(f"[SSE Integration] Merging {len(process_tools)} process tools with {len(tools)} docker tools")
            tools.extend(process_tools)
    except Exception as e:
        print(f"[SSE Integration] Failed to get process tools: {e}")

    partitioned_tools = []

    for tool in tools:
        tool_name = tool.get("name", "")
        input_schema = tool.get("inputSchema", {})

        # フルスキーマを保存（expandSchema用）
        if input_schema:
            schema_partitioner.store_full_schema(tool_name, input_schema)

        full_description = tool.get("description")
        schema_partitioner.store_tool_description(tool_name, full_description)
        lightweight_description = _summarize_description(full_description or "")

        # スキーマを分割
        partitioned_schema = schema_partitioner.partition_schema(input_schema)

        # トークン削減効果をログ出力
        reduction = schema_partitioner.get_token_reduction_estimate(input_schema)
        print(f"[Schema Partitioning] {tool_name}: {reduction['full']} → {reduction['partitioned']} tokens ({reduction['reduction']}% reduction)")

        extensions = dict(tool.get("extensions", {}))
        if full_description:
            extensions["hasDocs"] = True
            extensions["docHandle"] = tool_name
            extensions["docHint"] = "Call expandSchema with mode='docs' for the full instructions."
        else:
            extensions["hasDocs"] = False

        partitioned_tool = {
            **tool,
            "inputSchema": partitioned_schema,
            "extensions": extensions
        }

        if lightweight_description:
            partitioned_tool["description"] = lightweight_description

        partitioned_tools.append(partitioned_tool)

    # expandSchema ツールを追加
    expand_schema_tool = {
        "name": "expandSchema",
        "description": "Lazy-load schemas or documentation for a specific tool. Use mode='schema' (default) for JSON schema or mode='docs' for the full description.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "toolName": {
                    "type": "string",
                    "description": "Name of the tool whose schema or docs you want to expand"
                },
                "path": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Path to the property to expand (e.g., ['metadata', 'shipping']). Omit for full schema."
                },
                "mode": {
                    "type": "string",
                    "enum": ["schema", "docs"],
                    "description": "schema → return JSON schema (default). docs → return stored description text."
                }
            },
            "required": ["toolName"]
        }
    }
    partitioned_tools.append(expand_schema_tool)

    data["result"]["tools"] = partitioned_tools
    return data


def _build_gateway_jsonrpc_url(request: Request) -> str:
    """
    Construct the MCP Gateway URL that matches the client's requested path/query.
    """
    base_url = settings.MCP_GATEWAY_URL.rstrip("/")
    prefix = f"{settings.API_V1_PREFIX}/mcp"
    path = request.url.path

    suffix = path
    if prefix and path.startswith(prefix):
        suffix = path[len(prefix):]

    if not suffix:
        suffix = "/"
    elif not suffix.startswith("/"):
        suffix = f"/{suffix}"

    if request.url.query:
        return f"{base_url}{suffix}?{request.url.query}"
    return f"{base_url}{suffix}"


def _build_gateway_sse_url(request: Request) -> str:
    """
    Construct the MCP Gateway SSE URL, preserving client-provided query params.
    """
    base_url = f"{settings.MCP_GATEWAY_URL.rstrip('/')}/sse"
    if request.url.query:
        return f"{base_url}?{request.url.query}"
    return base_url


def _build_stream_gateway_url(request: Request, include_api_prefix: bool = True) -> str:
    """
    Construct the streaming MCP Gateway URL (Codex RMCP transport).
    """
    base_url = settings.MCP_STREAM_GATEWAY_URL.rstrip("/")
    suffix = request.url.path
    prefix = f"{settings.API_V1_PREFIX}/mcp" if include_api_prefix else ""

    if prefix and suffix.startswith(prefix):
        suffix = suffix[len(prefix):]

    if not suffix:
        return base_url if not request.url.query else f"{base_url}?{request.url.query}"

    if not suffix.startswith("/"):
        suffix = f"/{suffix}"

    if request.url.query:
        return f"{base_url}{suffix}?{request.url.query}"
    return f"{base_url}{suffix}"


def _normalize_stream_accept_header(accept_header: Optional[str]) -> str:
    """
    Ensure the upstream stream gateway always receives Accept headers that
    declare both JSON (for Codex logging) and SSE (required by streamable_http).
    """
    required_media_types = ("application/json", "text/event-stream")

    if not accept_header:
        return ", ".join(required_media_types)

    parts: list[str] = []
    seen_tokens: set[str] = set()

    for raw_part in accept_header.split(","):
        part = raw_part.strip()
        if not part:
            continue
        token = part.split(";", 1)[0].strip().lower()
        parts.append(part)
        seen_tokens.add(token)

    for media_type in required_media_types:
        if media_type not in seen_tokens:
            parts.append(media_type)
            seen_tokens.add(media_type)

    return ", ".join(parts)


def _filter_stream_headers(headers: dict[str, str]) -> dict[str, str]:
    """
    Remove hop-by-hop headers that should not be forwarded and normalize Accept.
    """
    blocked = {"host", "content-length", "accept-encoding", "connection", "accept"}
    accept_header = next(
        (value for key, value in headers.items() if key.lower() == "accept"),
        None,
    )
    filtered = {
        key: value
        for key, value in headers.items()
        if key.lower() not in blocked
    }

    filtered["accept"] = _normalize_stream_accept_header(accept_header)

    return filtered


def _format_sse_event(data: Dict[str, Any], event_type: str | None = "message") -> bytes:
    """
    Encode an SSE event payload.
    """
    lines = []
    if event_type:
        lines.append(f"event: {event_type}")
    lines.append(f"data: {json.dumps(data)}")
    return ("\n".join(lines) + "\n\n").encode("utf-8")


def _parse_sse_json(lines: list[str]) -> Optional[Dict[str, Any]]:
    """
    Extract JSON payload from SSE event lines.
    """
    data_lines: list[str] = []
    for line in lines:
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
    if not data_lines:
        return None
    data_str = "\n".join(data_lines)
    try:
        return json.loads(data_str)
    except json.JSONDecodeError:
        return None


def _method_has_body(method: str) -> bool:
    return method.upper() in {"POST", "PUT", "PATCH", "DELETE"}


async def _proxy_streaming_gateway_request(
    request: Request,
    *,
    include_api_prefix: bool = True,
    initialize_request_id: Optional[Any] = None,
) -> Response:
    """
    Proxy Codex RMCP streamable_http traffic to the streaming gateway.
    """
    target_url = _build_stream_gateway_url(request, include_api_prefix=include_api_prefix)
    method = request.method.upper()
    payload = await request.body() if _method_has_body(method) else None

    client = httpx.AsyncClient(timeout=None)
    try:
        upstream_request = client.build_request(
            method,
            target_url,
            headers=_filter_stream_headers(dict(request.headers)),
            content=payload,
        )
        upstream = await client.send(upstream_request, stream=True, follow_redirects=True)
    except Exception:
        await client.aclose()
        raise

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in {"transfer-encoding", "connection"}
    }

    if method == "HEAD":
        await upstream.aread()
        await upstream.aclose()
        await client.aclose()
        return Response(
            status_code=upstream.status_code,
            headers=response_headers,
        )

    content_type = response_headers.get("content-type", "")
    is_sse_response = "text/event-stream" in content_type.lower()

    async def _inject_initialized_notifications():
        """
        Yield SSE stream chunks and append notifications/initialized when needed.
        """
        if not is_sse_response:
            async for chunk in upstream.aiter_raw():
                yield chunk
            return

        pending_lines: list[str] = []
        tracked_initialize_id = initialize_request_id

        def flush_lines() -> list[bytes]:
            nonlocal pending_lines, tracked_initialize_id
            if not pending_lines:
                return [b"\n"]

            event_text = "\n".join(pending_lines)
            payload = _parse_sse_json(pending_lines)
            chunks = [(event_text + "\n\n").encode("utf-8")]

            if isinstance(payload, dict):
                method = payload.get("method")
                if method == "notifications/initialized":
                    tracked_initialize_id = None
                elif (
                    tracked_initialize_id is not None
                    and payload.get("id") == tracked_initialize_id
                    and "result" in payload
                ):
                    chunks.append(
                        _format_sse_event(
                            {
                                "jsonrpc": "2.0",
                                "method": "notifications/initialized",
                            }
                        )
                    )
                    tracked_initialize_id = None

            pending_lines = []
            return chunks

        async for line in upstream.aiter_lines():
            if line == "":
                for chunk in flush_lines():
                    yield chunk
            else:
                pending_lines.append(line)

        if pending_lines:
            for chunk in flush_lines():
                yield chunk

    async def stream_body():
        try:
            async for chunk in _inject_initialized_notifications():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_body(),
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )


def _should_stream_sse(request: Request) -> bool:
    """
    Determine whether the client expects an SSE response.
    """
    accept_header = request.headers.get("accept")
    if not accept_header:
        return False
    return "text/event-stream" in accept_header.lower()


def _build_sse_response(request: Request) -> StreamingResponse:
    """
    Return a StreamingResponse for MCP SSE proxy traffic.
    """
    return StreamingResponse(
        proxy_sse_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable buffering at the edge
        }
    )


@router.get("/sse")
async def mcp_sse_proxy(request: Request):
    """
    MCP SSE Proxy Endpoint

    Claude Code connects via the public API URL (`${GATEWAY_API_URL}/v1/mcp/sse`)
    """
    return _build_sse_response(request)


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
    method = rpc_request.get("method") if isinstance(rpc_request, dict) else None
    is_initialize_request = method == "initialize"
    session_id = request.query_params.get("sessionid")

    print(f"[MCP Proxy] JSON-RPC request: method={method}, sessionid={session_id}")

    # セッション状態を追跡（初期化済みかどうか）
    if not hasattr(_proxy_jsonrpc_request, '_initialized_sessions'):
        _proxy_jsonrpc_request._initialized_sessions = set()

    # tools/call の前に完全な初期化シーケンスを実行（未初期化セッションの場合）
    if method == "tools/call" and session_id and session_id not in _proxy_jsonrpc_request._initialized_sessions:
        print(f"[MCP Proxy] Session {session_id} not initialized, running full init sequence")
        gateway_post_url = f"{settings.MCP_GATEWAY_URL.rstrip('/')}/sse?sessionid={session_id}"

        async with httpx.AsyncClient(timeout=10.0) as init_client:
            try:
                # Step 1: initialize リクエストを送信
                initialize_request = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {
                            "name": "airis-proxy",
                            "version": "1.0.0"
                        }
                    }
                }
                init_req_response = await init_client.post(
                    gateway_post_url,
                    json=initialize_request,
                    headers={"Content-Type": "application/json"}
                )
                print(f"[MCP Proxy] Initialize request sent: {init_req_response.status_code}")

                # Step 2: 少し待つ (Gateway が処理する時間)
                await asyncio.sleep(0.15)

                # Step 3: notifications/initialized を送信
                initialized_notification = {
                    "jsonrpc": "2.0",
                    "method": "notifications/initialized"
                }
                init_notif_response = await init_client.post(
                    gateway_post_url,
                    json=initialized_notification,
                    headers={"Content-Type": "application/json"}
                )
                print(f"[MCP Proxy] Initialized notification sent: {init_notif_response.status_code}")

                if init_notif_response.status_code in (200, 202):
                    _proxy_jsonrpc_request._initialized_sessions.add(session_id)
                    # Gateway が処理する時間を少し待つ
                    await asyncio.sleep(0.1)

            except Exception as e:
                print(f"[MCP Proxy] Failed to run init sequence: {e}")

    # expandSchema ツールコール処理
    if rpc_request.get("method") == "tools/call":
        params = rpc_request.get("params", {})
        tool_name = params.get("name", "")

        if tool_name == "expandSchema":
            # expandSchema は Gateway にproxyしない（ローカル処理）
            return await handle_expand_schema(rpc_request)

    # その他のツールコールはGatewayにproxy
    if not session_id:
        # RMCP streamable_http clients (Codex) expect streaming responses.
        return await _proxy_streaming_gateway_request(
            request,
            initialize_request_id=rpc_request.get("id") if is_initialize_request else None,
        )

    target_url = _build_gateway_jsonrpc_url(request)
    forward_headers = {"Content-Type": "application/json"}
    auth_header = request.headers.get("Authorization")
    if auth_header:
        forward_headers["Authorization"] = auth_header

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            target_url,
            content=body,
            headers=forward_headers,
            follow_redirects=True,
        )

        # initialize リクエストが成功したら、notifications/initialized を Gateway に送信
        if is_initialize_request and response.status_code in (200, 202):
            print(f"[MCP Proxy] Initialize request successful, sending initialized notification to Gateway (sessionid={session_id})")
            initialized_notification = {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            }
            gateway_post_url = f"{settings.MCP_GATEWAY_URL.rstrip('/')}/sse?sessionid={session_id}"
            try:
                init_response = await client.post(
                    gateway_post_url,
                    json=initialized_notification,
                    headers={"Content-Type": "application/json"}
                )
                print(f"[MCP Proxy] Sent initialized notification: {init_response.status_code}")
            except Exception as e:
                print(f"[MCP Proxy] Failed to send initialized notification: {e}")

        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers)
        )


@router.get("", include_in_schema=False)
@router.get("/", include_in_schema=False)
async def mcp_http_health_check():
    """Lightweight health check for Streamable HTTP transport."""
    return {"status": "ok"}


@router.head("", include_in_schema=False)
@router.head("/", include_in_schema=False)
async def mcp_http_health_check_head():
    """HEAD variant for Streamable HTTP transport."""
    return Response(status_code=204)


@router.post("", include_in_schema=False)
async def mcp_jsonrpc_proxy_root(request: Request):
    """Expose the JSON-RPC proxy at /api/v1/mcp (no trailing slash)."""
    return await _proxy_jsonrpc_request(request)


@router.post("/")
async def mcp_jsonrpc_proxy(request: Request):
    """Expose the JSON-RPC proxy at /api/v1/mcp/."""
    return await _proxy_jsonrpc_request(request)


@router.post("/sse", include_in_schema=False)
async def mcp_sse_proxy_post(request: Request):
    """
    Allow transports that POST to /sse. If the client requests SSE (Accept:
    text/event-stream), stream the Docker gateway SSE connection; otherwise fall
    back to the JSON-RPC proxy for legacy callers.
    """
    if _should_stream_sse(request):
        return _build_sse_response(request)
    return await _proxy_jsonrpc_request(request)


@router.api_route("/.well-known/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def mcp_stream_well_known(request: Request, path: str):
    """
    Forward /.well-known discovery requests under the API prefix.
    """
    return await _proxy_streaming_gateway_request(request)


async def proxy_root_well_known(request: Request, path: str) -> Response:
    """
    Public /.well-known proxy mounted at the application root.
    """
    return await _proxy_streaming_gateway_request(
        request,
        include_api_prefix=False,
    )


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
    mode = arguments.get("mode", "schema")

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

    if mode not in {"schema", "docs"}:
        error_response = {
            "jsonrpc": "2.0",
            "id": rpc_request.get("id"),
            "error": {
                "code": -32602,
                "message": "mode must be 'schema' or 'docs'"
            }
        }
        await protocol_logger.log_message("server→client", error_response, {
            "phase": "expand_schema",
            "tool_name": tool_name
        })
        return error_response

    if mode == "docs":
        detailed_description = schema_partitioner.get_tool_description(tool_name)
        if not detailed_description:
            error_response = {
                "jsonrpc": "2.0",
                "id": rpc_request.get("id"),
                "error": {
                    "code": -32602,
                    "message": f"Documentation not found for tool: {tool_name}"
                }
            }
            await protocol_logger.log_message("server→client", error_response, {
                "phase": "expand_schema",
                "tool_name": tool_name
            })
            return error_response

        response_content = detailed_description
    else:
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

        response_content = json.dumps(expanded_schema, indent=2)

    success_response = {
        "jsonrpc": "2.0",
        "id": rpc_request.get("id"),
        "result": {
            "content": [
                {
                    "type": "text",
                    "text": response_content
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

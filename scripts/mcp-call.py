#!/usr/bin/env python3
"""
mcp-call.py — Reusable CLI for calling MCP tools via SSE gateway.

Usage:
    python3 mcp-call.py <tool> '<json-arguments>'
    python3 mcp-call.py --gateway http://localhost:9400 --timeout 60 <tool> '<json-arguments>'

Examples:
    python3 mcp-call.py memory_list '{}'
    python3 mcp-call.py conversation_save '{"source":"claude-code","title":"test"}'
    python3 mcp-call.py session_create '{"name":"my session","description":"..."}'

Note: Use UNPREFIXED tool names (e.g. memory_list, not mindbase:memory_list).
      The root /sse endpoint connects directly to the Docker MCP Gateway
      which uses catalog tool names without server prefixes.

Protocol (MCP SSE Transport):
    1. GET /sse → SSE stream, first event is endpoint with sessionid
    2. POST /sse?sessionid=<ID> with JSON-RPC tools/call → 202 Accepted
    3. Response arrives on the SSE stream with matching request ID

Exit codes: 0=success, 1=error, 2=timeout
"""

import argparse
import json
import sys
import threading
import time
import requests


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def main():
    parser = argparse.ArgumentParser(description="Call MCP tools via SSE gateway")
    parser.add_argument("tool", help="Tool name (e.g. mindbase:memory_list)")
    parser.add_argument("arguments", nargs="?", default="{}", help="JSON arguments (default: {})")
    parser.add_argument("--gateway", default="http://localhost:9400", help="Gateway URL (default: http://localhost:9400)")
    parser.add_argument("--timeout", type=int, default=60, help="Timeout in seconds (default: 60)")
    parser.add_argument("--sse-path", default="/sse", help="SSE endpoint path (default: /sse)")
    args = parser.parse_args()

    # Parse arguments
    try:
        tool_args = json.loads(args.arguments)
    except json.JSONDecodeError as e:
        eprint(f"Error: Invalid JSON arguments: {e}")
        sys.exit(1)

    if not isinstance(tool_args, dict):
        eprint("Error: Arguments must be a JSON object (dict), not a string or array")
        sys.exit(1)

    gateway = args.gateway.rstrip("/")
    sse_path = args.sse_path
    timeout = args.timeout
    request_id = f"mcp-call-{int(time.time())}"

    # Shared state between threads
    state = {
        "endpoint": None,          # session endpoint URL from SSE
        "endpoint_ready": threading.Event(),
        "result": None,
        "error": None,
        "done": threading.Event(),
    }

    def sse_reader(resp):
        """Single reader thread that handles the entire SSE stream."""
        event_type = None
        data_lines = []

        try:
            for raw_line in resp.iter_lines(decode_unicode=True):
                if state["done"].is_set():
                    return

                if raw_line is None:
                    continue

                line = raw_line

                if line.startswith("event:"):
                    event_type = line[6:].strip()
                    data_lines = []
                elif line.startswith("data:"):
                    data_lines.append(line[5:].strip())
                elif line == "":
                    # End of SSE event block
                    if data_lines:
                        full_data = "\n".join(data_lines)

                        if event_type == "endpoint":
                            state["endpoint"] = full_data.strip()
                            state["endpoint_ready"].set()

                        elif event_type == "message":
                            try:
                                msg = json.loads(full_data)
                                if msg.get("id") == request_id:
                                    if "error" in msg:
                                        state["error"] = msg["error"]
                                    else:
                                        state["result"] = msg.get("result")
                                    state["done"].set()
                                    return
                            except json.JSONDecodeError:
                                pass

                    event_type = None
                    data_lines = []

        except requests.exceptions.ConnectionError:
            if not state["done"].is_set():
                state["error"] = {"message": "SSE connection closed"}
                state["done"].set()
        except Exception as e:
            if not state["done"].is_set():
                state["error"] = {"message": f"SSE reader error: {e}"}
                state["done"].set()

    # Step 1: Open SSE stream
    sse_url = f"{gateway}{sse_path}"
    eprint(f"Connecting to {sse_url} ...")
    try:
        resp = requests.get(sse_url, stream=True, timeout=(10, timeout + 30))
    except requests.exceptions.ConnectionError:
        eprint(f"Error: Cannot connect to gateway at {gateway}")
        sys.exit(1)
    except requests.exceptions.Timeout:
        eprint(f"Error: Connection timeout to {sse_url}")
        sys.exit(1)

    # Start the SSE reader thread
    reader = threading.Thread(target=sse_reader, args=(resp,), daemon=True)
    reader.start()

    # Wait for the endpoint event
    if not state["endpoint_ready"].wait(timeout=15):
        eprint("Error: Timeout waiting for endpoint event from SSE stream")
        resp.close()
        sys.exit(1)

    session_endpoint = state["endpoint"]
    eprint(f"Session established: {session_endpoint}")

    # Build POST URL: the endpoint data from upstream is "/sse?sessionid=X"
    # but we need to POST to the same path prefix we used for GET
    # e.g., if GET was /sse, POST should be /sse?sessionid=X
    # if GET was /mcp/sse, POST should be /mcp/sse?sessionid=X
    if "sessionid=" in session_endpoint:
        # Extract sessionid and build POST URL with same path prefix
        import re
        match = re.search(r'sessionid=([A-Za-z0-9]+)', session_endpoint)
        if match:
            session_id = match.group(1)
            post_url = f"{gateway}{sse_path}?sessionid={session_id}"
        else:
            post_url = f"{gateway}{session_endpoint}"
    else:
        post_url = f"{gateway}{session_endpoint}"

    # Step 2: POST tools/call
    payload = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {
            "name": args.tool,
            "arguments": tool_args,
        },
    }

    eprint(f"Calling {args.tool} → POST {post_url}")
    try:
        post_resp = requests.post(
            post_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if post_resp.status_code not in (200, 202):
            eprint(f"Error: POST returned {post_resp.status_code}: {post_resp.text}")
            resp.close()
            sys.exit(1)
        eprint(f"POST accepted ({post_resp.status_code})")
    except Exception as e:
        eprint(f"Error: POST failed: {e}")
        resp.close()
        sys.exit(1)

    # Step 3: Wait for response on SSE stream
    eprint("Waiting for response ...")
    if not state["done"].wait(timeout=timeout):
        eprint(f"Error: Timeout after {timeout}s waiting for response")
        resp.close()
        sys.exit(2)

    resp.close()

    # Output result
    if state["error"]:
        eprint(f"Error: {json.dumps(state['error'])}")
        sys.exit(1)

    if state["result"] is not None:
        print(json.dumps(state["result"], ensure_ascii=False, indent=2))
    else:
        print("{}")
    sys.exit(0)


if __name__ == "__main__":
    main()

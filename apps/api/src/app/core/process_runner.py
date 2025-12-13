"""
ProcessRunner - uvx/npx MCP Server Process Management

Handles:
- Lazy process startup on first request
- StdIO JSON-RPC communication
- Automatic idle kill
- Proper initialized notification handling
"""

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from enum import Enum


class ProcessState(Enum):
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    INITIALIZING = "initializing"
    READY = "ready"
    STOPPING = "stopping"


@dataclass
class ProcessConfig:
    """Configuration for a process-based MCP server."""
    name: str
    command: str
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    cwd: Optional[str] = None
    idle_timeout: int = 120  # seconds


class ProcessRunner:
    """
    Manages a single uvx/npx MCP server process.

    Lifecycle:
    1. STOPPED -> start() -> STARTING -> RUNNING
    2. RUNNING -> send initialize -> INITIALIZING
    3. INITIALIZING -> receive initialize response -> send initialized -> READY
    4. READY -> tools/call works
    5. idle_timeout exceeded -> STOPPING -> STOPPED
    """

    def __init__(
        self,
        config: ProcessConfig,
        on_stderr: Optional[Callable[[str, str], None]] = None,
    ):
        self.config = config
        self.on_stderr = on_stderr or self._default_stderr_handler

        self._proc: Optional[asyncio.subprocess.Process] = None
        self._state = ProcessState.STOPPED
        self._last_used = 0.0
        self._request_id = 0
        self._pending_requests: dict[int, asyncio.Future] = {}
        self._reader_task: Optional[asyncio.Task] = None
        self._reaper_task: Optional[asyncio.Task] = None
        self._stderr_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

        # Server capabilities (populated after initialize)
        self._server_info: dict[str, Any] = {}
        self._tools: list[dict[str, Any]] = []

    @property
    def state(self) -> ProcessState:
        return self._state

    @property
    def is_ready(self) -> bool:
        return self._state == ProcessState.READY

    @property
    def tools(self) -> list[dict[str, Any]]:
        return self._tools

    def _default_stderr_handler(self, server_name: str, line: str):
        print(f"[{server_name}][stderr] {line}")

    async def ensure_ready(self, timeout: float = 30.0) -> bool:
        """
        Ensure the process is started and initialized.
        Returns True if ready, False if failed.
        """
        async with self._lock:
            if self._state == ProcessState.READY:
                self._last_used = time.time()
                return True

            if self._state == ProcessState.STOPPED:
                await self._start_process()

            if self._state == ProcessState.RUNNING:
                await self._initialize()

        # Wait for READY state
        start = time.time()
        while time.time() - start < timeout:
            if self._state == ProcessState.READY:
                return True
            if self._state == ProcessState.STOPPED:
                return False
            await asyncio.sleep(0.05)

        return False

    async def _start_process(self):
        """Start the subprocess."""
        self._state = ProcessState.STARTING

        # Build environment
        env = {**os.environ, **self.config.env}

        # Expand environment variables in args
        expanded_args = [
            os.path.expandvars(arg) for arg in self.config.args
        ]

        cmd = [self.config.command] + expanded_args
        print(f"[ProcessRunner] Starting {self.config.name}: {' '.join(cmd)}")

        try:
            self._proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.config.cwd,
                env=env,
            )

            self._state = ProcessState.RUNNING
            self._last_used = time.time()

            # Start background tasks
            self._reader_task = asyncio.create_task(self._stdout_reader())
            self._stderr_task = asyncio.create_task(self._stderr_reader())
            self._reaper_task = asyncio.create_task(self._idle_reaper())

            print(f"[ProcessRunner] {self.config.name} started (PID: {self._proc.pid})")

        except Exception as e:
            print(f"[ProcessRunner] Failed to start {self.config.name}: {e}")
            self._state = ProcessState.STOPPED
            raise

    async def _initialize(self):
        """Send initialize request and wait for response."""
        self._state = ProcessState.INITIALIZING

        # MCP initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "roots": {"listChanged": True},
                    "sampling": {}
                },
                "clientInfo": {
                    "name": "airis-mcp-gateway",
                    "version": "1.0.0"
                }
            }
        }

        try:
            response = await self._send_request(init_request, timeout=10.0)

            if "error" in response:
                print(f"[ProcessRunner] {self.config.name} initialize failed: {response['error']}")
                self._state = ProcessState.STOPPED
                return

            self._server_info = response.get("result", {})
            print(f"[ProcessRunner] {self.config.name} initialized: {self._server_info.get('serverInfo', {})}")

            # Send notifications/initialized
            await self._send_notification({
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            })

            # Fetch tools list
            await self._fetch_tools()

            self._state = ProcessState.READY
            print(f"[ProcessRunner] {self.config.name} is READY with {len(self._tools)} tools")

        except Exception as e:
            print(f"[ProcessRunner] {self.config.name} initialize error: {e}")
            self._state = ProcessState.STOPPED

    async def _fetch_tools(self):
        """Fetch available tools from the server."""
        request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/list",
            "params": {}
        }

        response = await self._send_request(request, timeout=10.0)

        if "result" in response:
            self._tools = response["result"].get("tools", [])

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """
        Call a tool on this MCP server.

        Returns the JSON-RPC response (with result or error).
        """
        if not await self.ensure_ready():
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Server {self.config.name} failed to initialize"
                }
            }

        request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }

        return await self._send_request(request, timeout=60.0)

    async def send_raw_request(self, request: dict[str, Any]) -> dict[str, Any]:
        """Send a raw JSON-RPC request."""
        if not await self.ensure_ready():
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {
                    "code": -32603,
                    "message": f"Server {self.config.name} failed to initialize"
                }
            }

        # Assign ID if not present
        if "id" not in request:
            request = {**request, "id": self._next_id()}

        return await self._send_request(request, timeout=60.0)

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    async def _send_request(self, request: dict[str, Any], timeout: float = 30.0) -> dict[str, Any]:
        """Send a request and wait for response."""
        if not self._proc or not self._proc.stdin:
            raise RuntimeError("Process not running")

        request_id = request.get("id")
        if request_id is None:
            raise ValueError("Request must have an id")

        # Create future for response
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending_requests[request_id] = future

        try:
            # Send request
            data = json.dumps(request) + "\n"
            self._proc.stdin.write(data.encode())
            await self._proc.stdin.drain()
            self._last_used = time.time()

            # Wait for response
            return await asyncio.wait_for(future, timeout=timeout)

        except asyncio.TimeoutError:
            self._pending_requests.pop(request_id, None)
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": f"Request timeout after {timeout}s"
                }
            }
        except Exception as e:
            self._pending_requests.pop(request_id, None)
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }

    async def _send_notification(self, notification: dict[str, Any]):
        """Send a notification (no response expected)."""
        if not self._proc or not self._proc.stdin:
            return

        data = json.dumps(notification) + "\n"
        self._proc.stdin.write(data.encode())
        await self._proc.stdin.drain()
        self._last_used = time.time()

    async def _stdout_reader(self):
        """Read JSON-RPC responses from stdout."""
        if not self._proc or not self._proc.stdout:
            return

        try:
            async for line in self._proc.stdout:
                self._last_used = time.time()
                line_str = line.decode().strip()

                if not line_str:
                    continue

                try:
                    message = json.loads(line_str)
                except json.JSONDecodeError:
                    print(f"[ProcessRunner] {self.config.name} invalid JSON: {line_str[:100]}")
                    continue

                # Handle response
                if "id" in message:
                    request_id = message["id"]
                    future = self._pending_requests.pop(request_id, None)
                    if future and not future.done():
                        future.set_result(message)

                # Handle server-initiated notifications
                elif "method" in message:
                    # Log notifications for debugging
                    print(f"[ProcessRunner] {self.config.name} notification: {message.get('method')}")

        except Exception as e:
            if self._state not in (ProcessState.STOPPING, ProcessState.STOPPED):
                print(f"[ProcessRunner] {self.config.name} stdout reader error: {e}")

    async def _stderr_reader(self):
        """Read stderr and forward to handler."""
        if not self._proc or not self._proc.stderr:
            return

        try:
            async for line in self._proc.stderr:
                line_str = line.decode().rstrip()
                if line_str:
                    self.on_stderr(self.config.name, line_str)
        except Exception as e:
            if self._state not in (ProcessState.STOPPING, ProcessState.STOPPED):
                print(f"[ProcessRunner] {self.config.name} stderr reader error: {e}")

    async def _idle_reaper(self):
        """Kill process after idle timeout."""
        while self._state not in (ProcessState.STOPPING, ProcessState.STOPPED):
            await asyncio.sleep(5)

            if self._state == ProcessState.READY:
                idle_time = time.time() - self._last_used
                if idle_time > self.config.idle_timeout:
                    print(f"[ProcessRunner] {self.config.name} idle for {idle_time:.0f}s, stopping")
                    await self.stop()
                    return

    async def stop(self):
        """Stop the process gracefully."""
        if self._state in (ProcessState.STOPPING, ProcessState.STOPPED):
            return

        self._state = ProcessState.STOPPING

        # Cancel pending requests
        for future in self._pending_requests.values():
            if not future.done():
                future.set_exception(RuntimeError("Process stopping"))
        self._pending_requests.clear()

        # Cancel background tasks
        for task in [self._reader_task, self._stderr_task, self._reaper_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        # Terminate process
        if self._proc:
            try:
                self._proc.terminate()
                try:
                    await asyncio.wait_for(self._proc.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    self._proc.kill()
                    await self._proc.wait()
            except ProcessLookupError:
                pass

            print(f"[ProcessRunner] {self.config.name} stopped")

        self._proc = None
        self._state = ProcessState.STOPPED
        self._tools = []
        self._server_info = {}

"""
ProcessManager - Unified management of process-based MCP servers.

Provides:
- Lazy loading of process servers on first request
- Aggregated tools/list across all servers
- Routing tools/call to correct server
- Server enable/disable at runtime
- Shutdown cleanup
"""

import asyncio
from typing import Any, Optional

from .process_runner import ProcessRunner, ProcessConfig, ProcessState
from .mcp_config_loader import (
    load_mcp_config,
    get_process_servers,
    McpServerConfig,
    ServerType,
    ServerMode,
)


class ProcessManager:
    """
    Manages multiple process-based MCP servers.

    Usage:
        manager = ProcessManager()
        await manager.initialize()

        # Get aggregated tools
        tools = await manager.list_tools()

        # Call a tool (auto-routes to correct server)
        result = await manager.call_tool("get_current_time", {"timezone": "UTC"})

        # Shutdown
        await manager.shutdown()
    """

    def __init__(self, config_path: Optional[str] = None, idle_timeout: int = 120):
        self._config_path = config_path
        self._idle_timeout = idle_timeout
        self._runners: dict[str, ProcessRunner] = {}
        self._server_configs: dict[str, McpServerConfig] = {}
        self._tool_to_server: dict[str, str] = {}  # tool_name -> server_name
        self._initialized = False

    async def initialize(self):
        """Load config and prepare runners (but don't start processes yet)."""
        if self._initialized:
            return

        all_config = load_mcp_config(self._config_path)
        process_servers = get_process_servers(all_config)

        for name, server_config in process_servers.items():
            self._server_configs[name] = server_config

            # Create runner (process not started yet - lazy loading)
            runner = ProcessRunner(
                server_config.to_process_config(self._idle_timeout)
            )
            self._runners[name] = runner

            print(f"[ProcessManager] Registered server: {name} (enabled={server_config.enabled})")

        self._initialized = True
        print(f"[ProcessManager] Initialized with {len(self._runners)} process servers")

    def get_server_names(self) -> list[str]:
        """Get all registered server names."""
        return list(self._runners.keys())

    def get_enabled_servers(self) -> list[str]:
        """Get enabled server names."""
        return [
            name for name, config in self._server_configs.items()
            if config.enabled
        ]

    def get_hot_servers(self) -> list[str]:
        """Get HOT mode server names (enabled + hot)."""
        return [
            name for name, config in self._server_configs.items()
            if config.enabled and config.mode == ServerMode.HOT
        ]

    def get_cold_servers(self) -> list[str]:
        """Get COLD mode server names (enabled + cold)."""
        return [
            name for name, config in self._server_configs.items()
            if config.enabled and config.mode == ServerMode.COLD
        ]

    def is_process_server(self, name: str) -> bool:
        """Check if a server is managed by ProcessManager."""
        return name in self._runners

    def get_runner(self, name: str) -> Optional[ProcessRunner]:
        """Get runner for a specific server."""
        return self._runners.get(name)

    async def enable_server(self, name: str) -> bool:
        """Enable a server at runtime."""
        if name not in self._server_configs:
            return False
        self._server_configs[name].enabled = True
        print(f"[ProcessManager] Enabled server: {name}")
        return True

    async def disable_server(self, name: str) -> bool:
        """Disable a server and stop its process."""
        if name not in self._server_configs:
            return False

        self._server_configs[name].enabled = False

        runner = self._runners.get(name)
        if runner and runner.state != ProcessState.STOPPED:
            await runner.stop()

        # Remove tools from mapping
        self._tool_to_server = {
            tool: server for tool, server in self._tool_to_server.items()
            if server != name
        }

        print(f"[ProcessManager] Disabled server: {name}")
        return True

    async def list_tools(
        self,
        server_name: Optional[str] = None,
        mode: Optional[str] = None,  # "hot", "cold", "all", or None (default: "hot")
    ) -> list[dict[str, Any]]:
        """
        Get aggregated tools list.

        Args:
            server_name: If specified, only list tools from that server.
            mode: Filter by server mode:
                  - "hot": Only HOT servers (default)
                  - "cold": Only COLD servers
                  - "all": All enabled servers

        Returns:
            List of tool definitions
        """
        if server_name:
            return await self._list_tools_for_server(server_name)

        # Determine which servers to query based on mode
        if mode == "all":
            servers = self.get_enabled_servers()
        elif mode == "cold":
            servers = self.get_cold_servers()
        else:  # Default to "hot"
            servers = self.get_hot_servers()

        all_tools = []
        for name in servers:
            tools = await self._list_tools_for_server(name)
            all_tools.extend(tools)

        return all_tools

    async def _list_tools_for_server(self, name: str) -> list[dict[str, Any]]:
        """Get tools for a specific server (starts process if needed)."""
        runner = self._runners.get(name)
        if not runner:
            return []

        config = self._server_configs.get(name)
        if not config or not config.enabled:
            return []

        # Ensure process is running and initialized
        if not await runner.ensure_ready():
            print(f"[ProcessManager] Failed to start server: {name}")
            return []

        # Cache tool -> server mapping
        for tool in runner.tools:
            tool_name = tool.get("name", "")
            if tool_name:
                self._tool_to_server[tool_name] = name

        return runner.tools

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """
        Call a tool, auto-routing to the correct server.

        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments

        Returns:
            JSON-RPC response (with result or error)
        """
        # Find server for this tool
        server_name = self._tool_to_server.get(tool_name)

        if not server_name:
            # Tool not cached - might need to refresh tools list
            # Try to find it by checking all enabled servers
            for name in self.get_enabled_servers():
                tools = await self._list_tools_for_server(name)
                for tool in tools:
                    if tool.get("name") == tool_name:
                        server_name = name
                        break
                if server_name:
                    break

        if not server_name:
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32601,
                    "message": f"Tool not found: {tool_name}"
                }
            }

        runner = self._runners.get(server_name)
        if not runner:
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Server not available: {server_name}"
                }
            }

        return await runner.call_tool(tool_name, arguments)

    async def call_tool_on_server(
        self,
        server_name: str,
        tool_name: str,
        arguments: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Call a tool on a specific server.

        Args:
            server_name: Server to call
            tool_name: Tool name
            arguments: Tool arguments

        Returns:
            JSON-RPC response
        """
        runner = self._runners.get(server_name)
        if not runner:
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Server not found: {server_name}"
                }
            }

        config = self._server_configs.get(server_name)
        if not config or not config.enabled:
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Server not enabled: {server_name}"
                }
            }

        return await runner.call_tool(tool_name, arguments)

    async def send_request(
        self,
        server_name: str,
        request: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Send a raw JSON-RPC request to a specific server.

        Args:
            server_name: Server to call
            request: JSON-RPC request

        Returns:
            JSON-RPC response
        """
        runner = self._runners.get(server_name)
        if not runner:
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {
                    "code": -32603,
                    "message": f"Server not found: {server_name}"
                }
            }

        return await runner.send_raw_request(request)

    def get_server_status(self, name: str, include_metrics: bool = False) -> dict[str, Any]:
        """Get status of a specific server."""
        runner = self._runners.get(name)
        config = self._server_configs.get(name)

        if not runner or not config:
            return {"error": f"Server not found: {name}"}

        status = {
            "name": name,
            "type": "process",
            "command": config.command,
            "enabled": config.enabled,
            "mode": config.mode.value,  # "hot" or "cold"
            "state": runner.state.value,
            "tools_count": len(runner.tools),
        }

        if include_metrics:
            status["metrics"] = runner.get_metrics()

        return status

    def get_all_status(self, include_metrics: bool = False) -> list[dict[str, Any]]:
        """Get status of all servers."""
        return [
            self.get_server_status(name, include_metrics=include_metrics)
            for name in self._runners.keys()
        ]

    async def shutdown(self):
        """Stop all running processes."""
        print("[ProcessManager] Shutting down...")

        tasks = []
        for name, runner in self._runners.items():
            if runner.state != ProcessState.STOPPED:
                tasks.append(runner.stop())

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        print("[ProcessManager] Shutdown complete")


# Global singleton
_process_manager: Optional[ProcessManager] = None


def get_process_manager() -> ProcessManager:
    """Get the global ProcessManager instance."""
    global _process_manager
    if _process_manager is None:
        _process_manager = ProcessManager()
    return _process_manager


async def initialize_process_manager(config_path: Optional[str] = None):
    """Initialize the global ProcessManager."""
    manager = get_process_manager()
    manager._config_path = config_path
    await manager.initialize()
    return manager

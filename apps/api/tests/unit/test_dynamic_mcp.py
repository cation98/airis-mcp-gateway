"""Unit tests for dynamic_mcp.py"""
import pytest
from app.core.dynamic_mcp import DynamicMCP, ToolInfo, ServerInfo, get_dynamic_mcp


@pytest.fixture
def dynamic_mcp():
    """Create fresh DynamicMCP instance"""
    return DynamicMCP()


@pytest.fixture
def populated_dynamic_mcp():
    """Create DynamicMCP with sample data"""
    mcp = DynamicMCP()

    # Add sample servers
    mcp._servers["memory"] = ServerInfo(
        name="memory",
        enabled=True,
        mode="hot",
        tools_count=3,
        source="process"
    )
    mcp._servers["fetch"] = ServerInfo(
        name="fetch",
        enabled=True,
        mode="cold",
        tools_count=1,
        source="process"
    )
    mcp._servers["disabled-server"] = ServerInfo(
        name="disabled-server",
        enabled=False,
        mode="cold",
        tools_count=0,
        source="process"
    )

    # Add sample tools
    mcp._tools["create_entities"] = ToolInfo(
        name="create_entities",
        server="memory",
        description="Create new entities in the knowledge graph",
        input_schema={"type": "object", "properties": {"entities": {"type": "array"}}},
        source="process"
    )
    mcp._tools["search_entities"] = ToolInfo(
        name="search_entities",
        server="memory",
        description="Search for entities by query",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}},
        source="process"
    )
    mcp._tools["fetch_url"] = ToolInfo(
        name="fetch_url",
        server="fetch",
        description="Fetch a URL and return its content as markdown",
        input_schema={"type": "object", "properties": {"url": {"type": "string"}}},
        source="process"
    )

    # Set up tool -> server mapping
    mcp._tool_to_server["create_entities"] = "memory"
    mcp._tool_to_server["search_entities"] = "memory"
    mcp._tool_to_server["fetch_url"] = "fetch"

    return mcp


class TestDynamicMCPFind:
    """Tests for airis-find functionality"""

    def test_find_all_tools(self, populated_dynamic_mcp):
        """Test finding all tools without query"""
        results = populated_dynamic_mcp.find()

        assert results["total_servers"] == 3
        assert results["total_tools"] == 3
        assert len(results["tools"]) == 3

    def test_find_by_query(self, populated_dynamic_mcp):
        """Test finding tools by query string"""
        results = populated_dynamic_mcp.find(query="entities")

        # Should match create_entities and search_entities
        assert len(results["tools"]) == 2
        tool_names = [t["name"] for t in results["tools"]]
        assert "create_entities" in tool_names
        assert "search_entities" in tool_names

    def test_find_by_server(self, populated_dynamic_mcp):
        """Test finding tools by server name"""
        results = populated_dynamic_mcp.find(server="memory")

        assert len(results["tools"]) == 2
        for tool in results["tools"]:
            assert tool["server"] == "memory"

    def test_find_by_query_and_server(self, populated_dynamic_mcp):
        """Test finding tools with both query and server filter"""
        results = populated_dynamic_mcp.find(query="create", server="memory")

        assert len(results["tools"]) == 1
        assert results["tools"][0]["name"] == "create_entities"

    def test_find_case_insensitive(self, populated_dynamic_mcp):
        """Test that search is case-insensitive"""
        results = populated_dynamic_mcp.find(query="ENTITIES")

        assert len(results["tools"]) == 2

    def test_find_matches_description(self, populated_dynamic_mcp):
        """Test that search matches description"""
        results = populated_dynamic_mcp.find(query="markdown")

        assert len(results["tools"]) == 1
        assert results["tools"][0]["name"] == "fetch_url"

    def test_find_no_results(self, populated_dynamic_mcp):
        """Test finding with no matches"""
        results = populated_dynamic_mcp.find(query="nonexistent")

        assert len(results["tools"]) == 0
        assert results["total_tools"] == 3  # Total still shows all

    def test_find_with_limit(self, populated_dynamic_mcp):
        """Test limiting results"""
        results = populated_dynamic_mcp.find(limit=1)

        assert len(results["tools"]) == 1

    def test_find_empty_cache(self, dynamic_mcp):
        """Test finding with empty cache"""
        results = dynamic_mcp.find()

        assert results["total_servers"] == 0
        assert results["total_tools"] == 0
        assert len(results["tools"]) == 0


class TestDynamicMCPSchema:
    """Tests for airis-schema functionality"""

    def test_get_tool_schema(self, populated_dynamic_mcp):
        """Test getting tool schema"""
        schema = populated_dynamic_mcp.get_tool_schema("create_entities")

        assert schema is not None
        assert schema["name"] == "create_entities"
        assert schema["server"] == "memory"
        assert "inputSchema" in schema

    def test_get_tool_schema_not_found(self, populated_dynamic_mcp):
        """Test getting schema for non-existent tool"""
        schema = populated_dynamic_mcp.get_tool_schema("nonexistent")

        assert schema is None


class TestDynamicMCPToolReference:
    """Tests for tool reference parsing"""

    def test_parse_with_server(self, populated_dynamic_mcp):
        """Test parsing server:tool format"""
        server, tool = populated_dynamic_mcp.parse_tool_reference("memory:create_entities")

        assert server == "memory"
        assert tool == "create_entities"

    def test_parse_without_server(self, populated_dynamic_mcp):
        """Test parsing tool-only format (auto-lookup)"""
        server, tool = populated_dynamic_mcp.parse_tool_reference("create_entities")

        assert server == "memory"  # Should find from cache
        assert tool == "create_entities"

    def test_parse_unknown_tool(self, populated_dynamic_mcp):
        """Test parsing unknown tool"""
        server, tool = populated_dynamic_mcp.parse_tool_reference("unknown_tool")

        assert server is None
        assert tool == "unknown_tool"


class TestDynamicMCPMetaTools:
    """Tests for meta-tool definitions"""

    def test_get_meta_tools(self, dynamic_mcp):
        """Test getting meta-tool definitions"""
        tools = dynamic_mcp.get_meta_tools()

        assert len(tools) == 3
        tool_names = [t["name"] for t in tools]
        assert "airis-find" in tool_names
        assert "airis-exec" in tool_names
        assert "airis-schema" in tool_names

    def test_meta_tools_have_schemas(self, dynamic_mcp):
        """Test that meta-tools have valid input schemas"""
        tools = dynamic_mcp.get_meta_tools()

        for tool in tools:
            assert "name" in tool
            assert "description" in tool
            assert "inputSchema" in tool
            assert tool["inputSchema"]["type"] == "object"

    def test_airis_find_schema(self, dynamic_mcp):
        """Test airis-find has correct schema"""
        tools = dynamic_mcp.get_meta_tools()
        find_tool = next(t for t in tools if t["name"] == "airis-find")

        props = find_tool["inputSchema"]["properties"]
        assert "query" in props
        assert "server" in props

    def test_airis_exec_schema(self, dynamic_mcp):
        """Test airis-exec has correct schema"""
        tools = dynamic_mcp.get_meta_tools()
        exec_tool = next(t for t in tools if t["name"] == "airis-exec")

        props = exec_tool["inputSchema"]["properties"]
        assert "tool" in props
        assert "arguments" in props
        assert "tool" in exec_tool["inputSchema"].get("required", [])


class TestDynamicMCPServerInfo:
    """Tests for server info"""

    def test_find_servers_by_query(self, populated_dynamic_mcp):
        """Test finding servers by query"""
        results = populated_dynamic_mcp.find(query="memory")

        assert len(results["servers"]) == 1
        assert results["servers"][0]["name"] == "memory"

    def test_server_info_structure(self, populated_dynamic_mcp):
        """Test server info has correct structure"""
        results = populated_dynamic_mcp.find()

        for server in results["servers"]:
            assert "name" in server
            assert "enabled" in server
            assert "mode" in server
            assert "tools_count" in server


class TestDynamicMCPSingleton:
    """Tests for singleton pattern"""

    def test_get_dynamic_mcp_returns_same_instance(self):
        """Test that get_dynamic_mcp returns singleton"""
        from app.core.dynamic_mcp import _dynamic_mcp, get_dynamic_mcp

        # Reset singleton for test
        import app.core.dynamic_mcp as module
        module._dynamic_mcp = None

        instance1 = get_dynamic_mcp()
        instance2 = get_dynamic_mcp()

        assert instance1 is instance2


class TestDynamicMCPTruncation:
    """Tests for description truncation"""

    def test_truncate_long_description(self, dynamic_mcp):
        """Test that long descriptions are truncated"""
        result = dynamic_mcp._truncate("A" * 200, 100)

        assert len(result) == 100
        assert result.endswith("…")

    def test_no_truncate_short_description(self, dynamic_mcp):
        """Test that short descriptions are not truncated"""
        result = dynamic_mcp._truncate("Short text", 100)

        assert result == "Short text"

    def test_truncate_empty_string(self, dynamic_mcp):
        """Test truncating empty string"""
        result = dynamic_mcp._truncate("", 100)

        assert result == ""

    def test_truncate_none(self, dynamic_mcp):
        """Test truncating None"""
        result = dynamic_mcp._truncate(None, 100)

        assert result is None


class TestDynamicMCPModeWithHotTools:
    """Tests for Dynamic MCP mode with HOT server tools.

    In Dynamic MCP mode (DYNAMIC_MCP=true), the gateway returns:
    - Meta-tools (airis-find, airis-exec, airis-schema)
    - HOT server tools (directly callable, no startup delay)

    COLD server tools are NOT returned; they are discovered via airis-find
    and called via airis-exec for token efficiency.
    """

    @pytest.fixture
    def mcp_with_hot_and_cold(self):
        """Create DynamicMCP with HOT and COLD servers."""
        mcp = DynamicMCP()

        # HOT server (gateway-control)
        mcp._servers["gateway-control"] = ServerInfo(
            name="gateway-control",
            enabled=True,
            mode="hot",
            tools_count=5,
            source="process"
        )
        # COLD server (supabase)
        mcp._servers["supabase"] = ServerInfo(
            name="supabase",
            enabled=True,
            mode="cold",
            tools_count=20,
            source="process"
        )
        # Disabled server
        mcp._servers["disabled"] = ServerInfo(
            name="disabled",
            enabled=False,
            mode="hot",
            tools_count=0,
            source="process"
        )

        # HOT server tools
        for tool_name in ["gateway_list_servers", "gateway_enable_server", "gateway_disable_server"]:
            mcp._tools[tool_name] = ToolInfo(
                name=tool_name,
                server="gateway-control",
                description=f"Gateway control tool: {tool_name}",
                input_schema={"type": "object"},
                source="process"
            )
            mcp._tool_to_server[tool_name] = "gateway-control"

        # COLD server tools (supabase)
        for tool_name in ["list_tables", "execute_sql", "list_projects"]:
            mcp._tools[tool_name] = ToolInfo(
                name=tool_name,
                server="supabase",
                description=f"Supabase tool: {tool_name}",
                input_schema={"type": "object"},
                source="process"
            )
            mcp._tool_to_server[tool_name] = "supabase"

        return mcp

    def test_meta_tools_count(self, dynamic_mcp):
        """Meta-tools should be exactly 3: airis-find, airis-exec, airis-schema."""
        meta_tools = dynamic_mcp.get_meta_tools()

        assert len(meta_tools) == 3
        names = {t["name"] for t in meta_tools}
        assert names == {"airis-find", "airis-exec", "airis-schema"}

    def test_hot_server_tools_separate_from_cold(self, mcp_with_hot_and_cold):
        """HOT and COLD server tools should be properly categorized."""
        # Find HOT server tools
        hot_results = mcp_with_hot_and_cold.find(server="gateway-control")
        cold_results = mcp_with_hot_and_cold.find(server="supabase")

        assert len(hot_results["tools"]) == 3
        assert len(cold_results["tools"]) == 3

        # Verify tool names
        hot_tool_names = {t["name"] for t in hot_results["tools"]}
        cold_tool_names = {t["name"] for t in cold_results["tools"]}

        assert "gateway_list_servers" in hot_tool_names
        assert "list_tables" in cold_tool_names

        # No overlap
        assert hot_tool_names.isdisjoint(cold_tool_names)

    def test_combined_tools_for_dynamic_mode(self, mcp_with_hot_and_cold):
        """In Dynamic MCP mode, tools/list should return meta-tools + HOT tools only."""
        meta_tools = mcp_with_hot_and_cold.get_meta_tools()

        # Simulate Dynamic MCP tools/list response
        # Meta-tools (3) + HOT server tools (should be filtered)
        hot_servers = [s for s, info in mcp_with_hot_and_cold._servers.items()
                       if info.mode == "hot" and info.enabled]

        hot_tools = [t for name, t in mcp_with_hot_and_cold._tools.items()
                     if t.server in hot_servers]

        # Build expected response
        dynamic_tools = list(meta_tools) + [
            {"name": t.name, "description": t.description, "inputSchema": t.input_schema}
            for t in hot_tools
        ]

        # Expected: 3 meta-tools + 3 HOT tools = 6
        assert len(dynamic_tools) == 6

        # Verify meta-tools are present
        tool_names = {t["name"] for t in dynamic_tools}
        assert "airis-find" in tool_names
        assert "airis-exec" in tool_names
        assert "airis-schema" in tool_names

        # Verify HOT tools are present
        assert "gateway_list_servers" in tool_names

        # Verify COLD tools are NOT present
        assert "list_tables" not in tool_names
        assert "execute_sql" not in tool_names

    def test_token_savings_calculation(self):
        """Verify token savings from Dynamic MCP mode with realistic data."""
        # Create a more realistic scenario with many COLD tools
        mcp = DynamicMCP()

        # HOT server (gateway-control) with 5 tools
        mcp._servers["gateway-control"] = ServerInfo(
            name="gateway-control", enabled=True, mode="hot",
            tools_count=5, source="process"
        )
        for i in range(5):
            tool_name = f"gateway_tool_{i}"
            mcp._tools[tool_name] = ToolInfo(
                name=tool_name, server="gateway-control",
                description="Gateway tool", input_schema={}, source="process"
            )

        # COLD servers with many tools (simulating supabase, github, playwright, etc.)
        cold_servers = ["supabase", "github", "playwright", "fetch", "memory"]
        for server in cold_servers:
            mcp._servers[server] = ServerInfo(
                name=server, enabled=True, mode="cold",
                tools_count=20, source="process"
            )
            for i in range(20):
                tool_name = f"{server}_tool_{i}"
                mcp._tools[tool_name] = ToolInfo(
                    name=tool_name, server=server,
                    description=f"{server} tool", input_schema={}, source="process"
                )

        # Full mode: all tools
        all_tools_count = len(mcp._tools)  # 5 + 100 = 105 tools

        # Dynamic mode: meta-tools + HOT tools
        meta_tools = mcp.get_meta_tools()
        hot_servers = [s for s, info in mcp._servers.items()
                       if info.mode == "hot" and info.enabled]
        hot_tools = [t for t in mcp._tools.values() if t.server in hot_servers]

        dynamic_tools_count = len(meta_tools) + len(hot_tools)  # 3 + 5 = 8 tools

        # Token estimate (300 tokens per tool schema)
        full_mode_tokens = all_tools_count * 300  # 31,500 tokens
        dynamic_mode_tokens = dynamic_tools_count * 300  # 2,400 tokens

        # Calculate savings
        savings_percent = (1 - dynamic_mode_tokens / full_mode_tokens) * 100

        # Should have significant savings (> 90%)
        assert savings_percent > 90, \
            f"Expected >90% savings, got {savings_percent:.1f}%"

        print(f"Token savings: {savings_percent:.1f}% "
              f"({full_mode_tokens:,} -> {dynamic_mode_tokens:,} tokens)")
        print(f"All tools: {all_tools_count}, Dynamic tools: {dynamic_tools_count}")

    def test_cold_server_discovery_via_airis_find(self, mcp_with_hot_and_cold):
        """COLD server tools should be discoverable via airis-find."""
        # Search for supabase tools
        results = mcp_with_hot_and_cold.find(query="supabase")

        # Should find supabase server
        server_names = {s["name"] for s in results["servers"]}
        assert "supabase" in server_names

        # Should find supabase tools
        tool_names = {t["name"] for t in results["tools"]}
        assert len(tool_names) >= 1

    def test_airis_exec_can_call_cold_tool(self, mcp_with_hot_and_cold):
        """airis-exec should be able to resolve COLD server tools."""
        # Parse tool reference for a COLD tool
        server, tool = mcp_with_hot_and_cold.parse_tool_reference("list_tables")

        assert server == "supabase"
        assert tool == "list_tables"

        # Parse explicit server:tool format
        server2, tool2 = mcp_with_hot_and_cold.parse_tool_reference("supabase:execute_sql")

        assert server2 == "supabase"
        assert tool2 == "execute_sql"


class TestRefreshCacheHotOnly:
    """Tests for refresh_cache_hot_only method."""

    @pytest.mark.asyncio
    async def test_refresh_cache_hot_only_skips_cold(self):
        """refresh_cache_hot_only should only load HOT server tools."""
        from unittest.mock import AsyncMock, MagicMock

        mcp = DynamicMCP()

        # Mock process manager
        mock_pm = MagicMock()
        mock_pm.get_enabled_servers.return_value = ["hot-server", "cold-server"]
        mock_pm.get_hot_servers.return_value = ["hot-server"]
        mock_pm.get_server_status.side_effect = lambda name: {
            "enabled": True,
            "mode": "hot" if name == "hot-server" else "cold",
            "tools_count": 5
        }

        # HOT server returns tools
        async def list_tools(name):
            if name == "hot-server":
                return [
                    {"name": "hot_tool_1", "description": "HOT tool 1", "inputSchema": {}},
                    {"name": "hot_tool_2", "description": "HOT tool 2", "inputSchema": {}},
                ]
            return []

        mock_pm._list_tools_for_server = list_tools
        mock_pm._server_configs = {
            "hot-server": MagicMock(enabled=True),
            "cold-server": MagicMock(enabled=True),
        }

        await mcp.refresh_cache_hot_only(mock_pm, docker_tools=None)

        # Should have cached servers
        assert "hot-server" in mcp._servers
        assert "cold-server" in mcp._servers

        # Should only have HOT server tools
        assert "hot_tool_1" in mcp._tools
        assert "hot_tool_2" in mcp._tools
        assert len(mcp._tools) == 2

        # Verify mode is correctly set
        assert mcp._servers["hot-server"].mode == "hot"
        assert mcp._servers["cold-server"].mode == "cold"

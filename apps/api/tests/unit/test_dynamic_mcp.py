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

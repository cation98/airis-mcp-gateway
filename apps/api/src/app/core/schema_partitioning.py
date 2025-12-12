"""
Schema Partitioning for MCP Tool Descriptions.

Reduces token usage by stripping nested schema properties from tools/list responses.
Full schemas are cached in memory and served on-demand via expandSchema tool.

Token Reduction:
- Full schemas: ~500 tokens per tool
- Partitioned: ~50 tokens per tool
- Result: ~90% reduction
"""
from typing import Any
from copy import deepcopy


def partition_schema(schema: dict[str, Any], max_depth: int = 1, current_depth: int = 0) -> dict[str, Any]:
    """
    Recursively partition a JSON schema, keeping only top-level structure.

    Args:
        schema: The JSON schema to partition
        max_depth: Maximum depth to preserve (default 1 = top-level only)
        current_depth: Current recursion depth

    Returns:
        Partitioned schema with nested properties stripped

    Example:
        Input (500 tokens):
        {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "options": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer"},
                        "offset": {"type": "integer"},
                        "filters": {
                            "type": "object",
                            "properties": {...}
                        }
                    }
                }
            }
        }

        Output (50 tokens):
        {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "options": {"type": "object", "_partitioned": true}
            }
        }
    """
    if not isinstance(schema, dict):
        return schema

    result = {}

    for key, value in schema.items():
        if key == "properties" and isinstance(value, dict):
            # Process each property
            result[key] = {}
            for prop_name, prop_schema in value.items():
                if not isinstance(prop_schema, dict):
                    result[key][prop_name] = prop_schema
                elif _has_nested_complexity(prop_schema) and current_depth >= max_depth - 1:
                    # This property has nested complexity, simplify it
                    result[key][prop_name] = _simplify_property(prop_schema)
                else:
                    # Simple property or not at max depth yet, recurse
                    result[key][prop_name] = partition_schema(prop_schema, max_depth, current_depth + 1)
        elif key == "items" and isinstance(value, dict):
            # Array items - simplify if complex and at max depth
            if _has_nested_complexity(value) and current_depth >= max_depth - 1:
                result[key] = _simplify_property(value)
            else:
                result[key] = partition_schema(value, max_depth, current_depth + 1)
        elif key in ("allOf", "anyOf", "oneOf") and isinstance(value, list):
            # Schema composition - simplify at max depth
            if current_depth >= max_depth:
                result[key] = [{"_partitioned": True}]
            else:
                result[key] = [partition_schema(item, max_depth, current_depth + 1) for item in value]
        else:
            # Keep primitive values (type, description, enum, required, etc.)
            result[key] = value

    return result


def _has_nested_complexity(schema: dict[str, Any]) -> bool:
    """Check if schema has nested properties or complex items."""
    if not isinstance(schema, dict):
        return False
    # Has nested object properties
    if "properties" in schema:
        return True
    # Has complex array items
    if schema.get("type") == "array" and isinstance(schema.get("items"), dict):
        if "properties" in schema.get("items", {}):
            return True
    return False


def _simplify_property(prop_schema: dict[str, Any]) -> dict[str, Any]:
    """
    Simplify a property schema to essential fields only.

    Keeps: type, description, enum, format, pattern, default, required
    Strips: nested properties, items details, complex schemas
    """
    if not isinstance(prop_schema, dict):
        return prop_schema

    # Essential fields to preserve
    essential_keys = {"type", "description", "enum", "format", "pattern", "default", "required", "const"}

    result = {k: v for k, v in prop_schema.items() if k in essential_keys}

    # Mark complex types as partitioned
    if prop_schema.get("type") == "object" and "properties" in prop_schema:
        result["_partitioned"] = True
    elif prop_schema.get("type") == "array" and "items" in prop_schema:
        result["_partitioned"] = True
        # Keep basic item type info
        items = prop_schema.get("items", {})
        if isinstance(items, dict) and "type" in items:
            result["items"] = {"type": items["type"]}

    return result if result else {"type": "object", "_partitioned": True}


def partition_tool(tool: dict[str, Any]) -> dict[str, Any]:
    """
    Partition a single MCP tool definition.

    Args:
        tool: MCP tool definition with name, description, inputSchema

    Returns:
        Tool with partitioned inputSchema
    """
    result = deepcopy(tool)

    if "inputSchema" in result:
        result["inputSchema"] = partition_schema(result["inputSchema"])

    return result


def partition_tools_list(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Partition all tools in a tools/list response.

    Args:
        tools: List of MCP tool definitions

    Returns:
        List of tools with partitioned schemas
    """
    return [partition_tool(tool) for tool in tools]


# expandSchema tool definition to inject
EXPAND_SCHEMA_TOOL = {
    "name": "expandSchema",
    "description": "Retrieve full schema details for a specific tool. Use when you need complete parameter information for a tool with partitioned schema (_partitioned: true).",
    "inputSchema": {
        "type": "object",
        "properties": {
            "toolName": {
                "type": "string",
                "description": "Name of the tool to get full schema for"
            },
            "path": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional JSON path to specific nested property (e.g., ['options', 'filters'])"
            }
        },
        "required": ["toolName"]
    }
}


def inject_expand_schema_tool(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Add expandSchema tool to the tools list.

    Args:
        tools: List of partitioned tools

    Returns:
        Tools list with expandSchema added
    """
    # Check if already present
    if any(t.get("name") == "expandSchema" for t in tools):
        return tools

    return [EXPAND_SCHEMA_TOOL] + tools


def get_schema_at_path(schema: dict[str, Any], path: list[str]) -> dict[str, Any] | None:
    """
    Navigate to a specific path within a schema.

    Args:
        schema: Full JSON schema
        path: List of property names to navigate

    Returns:
        Schema at the specified path, or None if not found

    Example:
        get_schema_at_path(schema, ["options", "filters"])
        -> Returns the schema for options.filters property
    """
    current = schema

    for segment in path:
        if not isinstance(current, dict):
            return None

        # Try to find in properties
        props = current.get("properties", {})
        if segment in props:
            current = props[segment]
        # Try items for arrays
        elif current.get("type") == "array" and segment == "items":
            current = current.get("items", {})
        else:
            return None

    return current

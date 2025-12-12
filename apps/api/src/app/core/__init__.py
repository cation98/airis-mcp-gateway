"""Core modules for AIRIS MCP Gateway API."""
from .schema_partitioning import (
    partition_schema,
    partition_tool,
    partition_tools_list,
    inject_expand_schema_tool,
    get_schema_at_path,
    EXPAND_SCHEMA_TOOL,
)

__all__ = [
    "partition_schema",
    "partition_tool",
    "partition_tools_list",
    "inject_expand_schema_tool",
    "get_schema_at_path",
    "EXPAND_SCHEMA_TOOL",
]

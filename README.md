# AIRIS MCP Gateway

Unified MCP server hub powered by `docker/mcp-gateway`.

## Quick Start

```bash
# Install globally (all projects)
claude mcp add airis-gateway -s user -- docker mcp gateway run

# Restart Claude Code
```

Done. Gateway provides dynamic tools:
- `mcp-find` - Search MCP servers in Docker catalog
- `mcp-add` - Add servers to your session
- `mcp-remove` - Remove servers

## Example

```
"Find filesystem MCP server"
→ mcp-find("filesystem")

"Add it to my session"
→ mcp-add("filesystem")
```

## Archive

API layer (Schema Partitioning) archived to `feature/schema-partitioning` branch.

Restore if needed:
```bash
git merge feature/schema-partitioning
```

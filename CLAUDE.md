# AIRIS MCP Gateway - Development Guide

## Design Principles (NEVER VIOLATE)

### 1. Global Registration Only
- MCP Gateway MUST be registered globally (`--scope user`), NOT per-project
- Users should NOT need to register in every project directory
- MCP servers can be enabled/disabled dynamically, so global registration is sufficient
- Name MUST be `airis-mcp-gateway` (clear what it is)
- **Command**: `claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse`

### 2. Hybrid Architecture (Docker + Process)
- **Docker servers**: Heavy/stateful servers via Docker MCP Gateway (port 9390)
- **Process servers**: Lightweight uvx/npx servers via ProcessManager (Lazy + idle-kill)
- Both types are exposed through a single endpoint (port 9400)
- Users don't need to know which type a server is

### 3. One-Command Install
- `docker compose up -d` from repo root handles everything
- Users should NOT need manual steps after running compose
- Register with Claude Code: `claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse`

### 4. ALL MCP Servers Through Gateway
- All MCP servers MUST go through gateway
- Users should NOT register individual MCP servers separately
- Dynamic enable/disable via API (`airis_enable_mcp_server`, `airis_disable_mcp_server`)
- Only ONE MCP registration needed: `airis-mcp-gateway`
- Add new servers to `mcp-config.json`

## Architecture

```
Claude Code
    |
    v
FastAPI API (port 9400) - Hybrid MCP Multiplexer
    |
    +-- /sse, /mcp/* --> Docker MCP Gateway (9390) --> Docker servers
    |                    + schema partitioning
    |                    + initialized notification fix
    |                    + ProcessManager tools merge
    |
    +-- /process/*   --> ProcessManager (Lazy + idle-kill)
                         + airis-agent (uvx)     10 tools
                         + context7 (npx)         2 tools
                         + fetch (uvx)            1 tool
                         + memory (npx)           9 tools
                         + sequential-thinking    1 tool
```

## MCP Tools Policy

Choose tools by feature tag:
- `web-fetch` -> `fetch`
- `docs` -> `context7` (resolve-library-id, get-library-docs)
- `memory` -> `memory` (create_entities, read_graph, etc.)
- `thinking` -> `sequential-thinking` (sequentialthinking)
- `orchestration` -> `airis-agent` (airis_confidence_check, airis_repo_index, etc.)

## Default Enabled Servers

| Server | Runner | Tools | Description |
|--------|--------|-------|-------------|
| airis-agent | uvx | 10 | LLM orchestration, confidence checks, repo indexing |
| context7 | npx | 2 | Library documentation lookup |
| fetch | uvx | 1 | Web page fetching as markdown |
| memory | npx | 9 | Knowledge graph (entities, relations) |
| sequential-thinking | npx | 1 | Step-by-step reasoning |

## Common Mistakes to Avoid

1. **DO NOT** use `--scope local` or omit scope (defaults to local)
2. **DO NOT** require users to run `claude mcp add` manually after install
3. **DO NOT** add project-specific MCP configurations
4. **DO NOT** register individual MCP servers separately - use gateway
5. **ALWAYS** use `uvx` for Python MCP servers, `npx` for Node.js MCP servers

## File Structure

- `docker-compose.yml` - Gateway container config
- `mcp-config.json` - Server definitions (command, args, enabled)
- `apps/api/` - FastAPI Hybrid MCP Multiplexer
- `apps/api/src/app/core/process_runner.py` - ProcessRunner (uvx/npx)
- `apps/api/src/app/core/process_manager.py` - Multi-server management

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/sse` | SSE endpoint for Claude Code |
| `/mcp/*` | Docker MCP Gateway proxy |
| `/process/servers` | List process servers |
| `/process/tools` | List tools from process servers |
| `/process/tools/call` | Call tool (auto-routes to correct server) |
| `/api/tools/combined` | All tools from all sources |
| `/api/tools/status` | Server status overview |
| `/metrics` | Prometheus metrics |

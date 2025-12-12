# AIRIS MCP Gateway - Development Guide

## Design Principles (NEVER VIOLATE)

### 1. Global Registration Only
- MCP Gateway MUST be registered globally (`--scope user`), NOT per-project
- Users should NOT need to register in every project directory
- MCP servers can be enabled/disabled dynamically, so global registration is sufficient
- Name MUST be `airis-mcp-gateway` (clear what it is)
- **Command**: `claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse`

### 2. Use GHCR Images (No Local Builds)
- All MCP servers (airis-agent, mindbase, etc.) MUST use pre-built GHCR images
- Users should NOT need to build anything locally
- Images are pulled automatically via `docker compose pull`
- Example: `ghcr.io/agiletec-inc/airis-agent:latest`

### 3. One-Command Install
- `quick-install.sh` MUST handle everything:
  - Clone/update repo
  - Setup config
  - Start Docker containers
  - Register with Claude Code globally
- Users should NOT need manual steps after running the install script

### 4. ALL MCP Servers Through Gateway
- All MCP servers (stripe, supabase, twilio, etc.) MUST go through gateway
- Users should NOT register individual MCP servers separately
- Dynamic enable/disable via API (`airis_enable_mcp_server`, `airis_disable_mcp_server`)
- Only ONE MCP registration needed: `airis-mcp-gateway`
- Add new servers to `catalogs/airis-catalog.yaml`, NOT as separate registrations

## Architecture

```
User -> Claude Code -> AIRIS Gateway (port 9400) -> Docker MCP Gateway -> Individual MCP Servers
                              |
                              v
                    mcp-config.json (enables/disables servers)
```

## Common Mistakes to Avoid

1. **DO NOT** use `--scope local` or omit scope (defaults to local)
2. **DO NOT** require users to run `claude mcp add` manually after install
3. **DO NOT** use local Docker builds - always use GHCR images
4. **DO NOT** add project-specific MCP configurations
5. **DO NOT** register individual MCP servers (stripe, supabase, etc.) - use gateway
6. **ALWAYS** clean up existing project-level MCP configs during install

## File Structure

- `scripts/quick-install.sh` - One-line installer
- `catalogs/airis-catalog.yaml` - MCP server definitions (GHCR images)
- `docker-compose.yml` - Gateway container config
- `~/.config/airis-mcp-gateway/mcp-config.json` - User's server enable/disable config

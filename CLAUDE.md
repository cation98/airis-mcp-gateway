# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AIRIS MCP Gateway is a unified entrypoint for 25+ MCP servers that eliminates token explosion at IDE startup through OpenMCP lazy loading pattern.

**Core Value**: 90% token reduction (12,500 → 1,250 tokens) via schema partitioning and on-demand expansion.

**Key Documents**: See `PROJECT_INDEX.md` for architecture overview, `ARCHITECTURE.md` for technical deep-dive, `AGENTS.md` for coding conventions.

## Architecture

**Three-layer Stack**:
1. **IDE Clients** → connect to Gateway SSE endpoint via `mcp.json`
2. **FastAPI Proxy** (`apps/api/`) → intercepts `tools/list`, applies schema partitioning, handles `expandSchema` locally
3. **Gateway Container** (`gateway/`) → orchestrates 25+ MCP servers (npx/uvx/docker), reads `mcp-config.json`

**Supporting Services**:
- **PostgreSQL**: Encrypted secrets (Fernet), server states
- **Settings UI** (`apps/settings/`): React dashboard for server management
- **Custom Servers**: `servers/mindbase/` (memory), `servers/self-management/` (orchestration)

**Key Insight**: Proxy intercepts MCP protocol to partition schemas (top-level only), reducing startup tokens by 90%. Full schemas retrieved on-demand via `expandSchema` tool.

## Configuration

**Key Files**:
- `mcp-config.json`: Gateway server definitions (command, args, env)
- `mcp.json`: IDE client config (symlinked to `~/.claude/mcp.json`)
- `.env`: Ports, database credentials, encryption key
- `profiles/*.json`: Server presets (recommended/minimal)

**Profile System**: Toggle servers by renaming keys in `mcp-config.json`:
- Enabled: `"serena": { ... }`
- Disabled: `"__disabled_serena": { ... }`
- Built-in servers (time, fetch, git, memory) always enabled

## Essential Commands

### Daily Operations
```bash
make install        # Full setup: build, start, register all editors
make up             # Start services only (no editor import)
make restart        # Full restart cycle
make down           # Stop containers
make logs           # Stream all logs
make test           # Validate config + run tests
```

### Development
```bash
make deps           # Install pnpm deps in container
make dev            # Start Vite dev server (UI hot reload)
make build          # Build all TypeScript workspaces
make lint           # ESLint all workspaces
make typecheck      # Run tsc --noEmit

# API tests
docker compose run --rm test        # Run pytest in container
cd apps/api && pytest tests/ -v     # Run locally

# Database
make db-migrate     # Run Alembic migrations
make db-shell       # PostgreSQL psql shell
```

### Building Custom Servers
```bash
make mindbase-build                 # Build TypeScript server → dist/
docker compose --profile builder up # Build with isolated node_modules
```

**Builder Pattern**: Source code mounted read-only, `node_modules` in Docker volumes, `dist/` written to host for Gateway consumption.

### Editor Installation
```bash
make install-claude     # Claude Code only
make uninstall          # Remove from all editors
make verify-claude      # Test installation
```

**Auto-import**: Scans `~/.claude/`, `~/.cursor/`, `~/.windsurf/`, `~/.config/zed/`, merges configs, backs up originals.

## Monorepo Structure

**pnpm workspace** (mixed TypeScript + Python):
```
apps/
  api/          Python FastAPI (NOT in pnpm workspace, uses pytest)
  settings/     React + Vite (@airis/settings, in workspace)
  desktop/      Tauri wrapper (in workspace)

servers/
  mindbase/     TypeScript MCP server (memory, in workspace)
  self-management/  Task orchestration (in workspace)
```

**Database** (`apps/api/app/models/`):
- `secrets`: Encrypted API keys (Fernet)
- `mcp_server_states`: Server ON/OFF toggles
- `mcp_servers`: Server metadata

**API Endpoints** (`/api/v1/` prefix):
- `/secrets`: Manage encrypted credentials
- `/mcp/servers`, `/server-states`: Server management
- `/gateway/restart`: Trigger Gateway restart
- `/mcp/*`: Schema partitioning proxy (OpenMCP pattern)

**Docker-First Principles**:
- NO host-side `node_modules`, `dist`, `__pycache__`
- All builds in containers with isolated volumes
- Source code: bind mounts, Build artifacts: named volumes

## Development Workflows

### Adding MCP Server
1. Edit `mcp-config.json` → add under `mcpServers`
2. Add secrets via UI or `/api/v1/secrets`
3. `make restart` + restart IDE

### Adding API Endpoint
1. Create file in `apps/api/app/api/endpoints/`
2. Register in `apps/api/app/api/routes.py`
3. Define schemas in `apps/api/app/schemas/`
4. Run `make test`

### Database Migration
```bash
docker compose exec api alembic revision --autogenerate -m "description"
make db-migrate
```

### UI Development
Edit `apps/settings/src/` → auto-reloads with `make dev` → build with `pnpm --filter @airis/settings build`

## Coding Conventions (from AGENTS.md)

### TypeScript/React
- Two-space indentation, functional components in PascalCase
- Hooks in `useCamelCase`, validate with `pnpm lint` and `pnpm typecheck`
- React 19: `forwardRef` deprecated, use `React.ComponentProps<...>`
- Tailwind v4: Single import, `darkMode: "class"`

### Python/FastAPI
- Four-space indentation, snake_case modules, type hints for routes
- **Async consistency**: Alembic migrations fully async (`async_engine_from_config`)
- **Timestamps**: Use `server_default=func.now()` (DB-side, not Python)
- **PostgreSQL triggers**: Auto-update `updated_at` via `trigger_set_updated_at()`
- **Session management**: Always `async with AsyncSession` (NOT concurrency-safe)
- **Schema isolation**: Tests use session-scoped schemas

### Testing
- Mirror source layout under `tests/`, name `test_<unit>.py`
- Run `pytest tests/ --cov=app` after backend changes
- Mark async tests with `@pytest.mark.asyncio`
- Fixtures in `tests/conftest.py`

### Git Commits
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`)
- PRs: summary, linked issue, commands run, screenshots for UI
- Flag migrations/secret-store implications

## Important Notes

- **mcp-config.json**: Keys starting with `__comment_` = docs, `__disabled_` = ignored by Gateway
- **Secrets**: Encrypted at rest (Fernet), injected via `${VAR_NAME}`
- **Docker networking**: Custom servers must join `airis-mcp-gateway_default` network
- **Testing**: Each test gets isolated DB schema
- **Symlinks**: Changes to `mcp.json` auto-apply to all editors

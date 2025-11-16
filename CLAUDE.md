# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

**First-time reading this repo?** Start with `PROJECT_INDEX.md` (3K tokens, 94% reduction vs. full codebase scan).

**Most-used commands:**
```bash
just init       # Full installation (build + start + register editors)
just dev        # UI development server with hot reload
just test       # Run backend tests (pytest in Docker)
just logs       # Stream all service logs
just doctor     # Health check (Docker daemon, toolchain verification)
```

## Project Overview

AIRIS MCP Gateway is a unified entrypoint for 25+ MCP servers that eliminates token explosion at IDE startup through OpenMCP lazy loading pattern.

**Core Value**: 90% token reduction (12,500 → 1,250 tokens) via schema partitioning and on-demand expansion.

**Key Innovation**: FastAPI proxy intercepts MCP protocol `tools/list` responses, partitions schemas to top-level only, and injects `expandSchema` tool for on-demand loading. Full schemas cached in memory; requests for details handled locally without Gateway roundtrip.

**Key Documents**:
- `PROJECT_INDEX.md` - Complete repository index (entry points, modules, architecture)
- `docs/ARCHITECTURE.md` - Technical deep-dive (OpenMCP pattern, performance)
- `AGENTS.md` - Coding conventions (TypeScript/Python style guide)

## Architecture

**Three-layer Stack**:
1. **IDE Clients** → connect to Gateway SSE endpoint via `mcp.json`
2. **FastAPI Proxy** (`apps/api/`) → intercepts `tools/list`, applies schema partitioning, handles `expandSchema` locally
3. **Gateway Container** (`gateway/`) → orchestrates 25+ MCP servers (npx/uvx/docker), reads `mcp-config.json`

**Supporting Services**:
- **PostgreSQL**: Encrypted secrets (Fernet), server states
- **Settings UI** (`apps/settings/`): React dashboard for server management
- **Custom Servers**: `servers/mindbase/` (memory), `servers/self-management/` (orchestration)

**Key Insight**: Proxy intercepts MCP protocol to partition schemas (トップレベルのみ) ＋ ツール説明も lazy-load。`tools/list` ではサマリだけ返し、必要なときに `expandSchema(mode="schema"|"docs")` を呼び出して詳細/ドキュメントを取得。

## Configuration

**Key Files**:
- `mcp-config.json`: Gateway server definitions (command, args, env)
- `mcp.json`: IDE client config (symlinked to `~/.claude/mcp.json`)
- `.env`: Ports, database credentials, encryption key
- `config/profiles/*.json`: Server presets (recommended/minimal)

**Profile System**: Server presets available in `config/profiles/`:
- **Recommended**: filesystem, context7, serena, mindbase (~500MB)
- **Minimal**: filesystem, context7 only (~50MB)

Toggle servers by renaming keys in `mcp-config.json`:
- Enabled: `"serena": { ... }`
- Disabled: `"__disabled_serena": { ... }`
- Built-in servers (time, fetch, git, memory) always enabled

## Essential Commands

### Daily Operations
```bash
just init           # Full reset: clean editor configs, build custom servers, start services, register all editors (Claude, Cursor, Zed, Codex)
just up             # Start services with localhost publishing (ports exposed on host)
just restart        # Full stop/start cycle (no editor registration)
just down           # Stop containers, keep volumes
just clean          # Clean build artifacts (does NOT remove volumes)
just logs           # Stream all logs
just logs-api       # Show API logs only
just logs-gateway   # Show Gateway logs only
just test           # Run pytest in container (config + unit tests)
just doctor         # Health check (Docker, toolchain shims)
```

### Development
```bash
# Workspace builds
just install        # Install pnpm deps in container
just dev            # Start Vite dev server on port 5273 (UI hot reload)
just build-all      # Build all TypeScript workspaces
just lint           # ESLint all workspaces
just typecheck      # Run tsc --noEmit

# Backend tests (Python)
just test                           # Full test suite in Docker
docker compose run --rm test        # Same as above
pytest tests/ --cov=app -v          # Run locally with coverage
pytest apps/api/tests/unit/ -v      # Unit tests only
pytest apps/api/tests/integration/  # Integration tests only

# Run specific test file or function
pytest apps/api/tests/unit/test_secret_crud.py -v
pytest apps/api/tests/unit/test_schema_partitioning.py::test_partition_schema -v

# Frontend tests (TypeScript)
just test-ui                        # Run vitest in container
pnpm test                           # Run locally (if inside toolchain)

# Database
just db-migrate     # Run Alembic migrations
just db-shell       # PostgreSQL psql shell
docker compose exec api alembic revision --autogenerate -m "description"  # Create migration

# Running individual Python files/scripts
uv run <script.py>  # Always use uv for ephemeral venvs
python scripts/install_all_editors.py  # Also works if venv active
```

### Building Custom Servers
```bash
just mindbase-build                 # Build TypeScript server → dist/
just build-custom-servers           # Build with isolated node_modules
```

**Builder Pattern**: Source code mounted read-only, `node_modules` in Docker volumes, `dist/` written to host for Gateway consumption.

### Editor Installation
```bash
just install-editors     # DEPRECATED: Use just init instead
just install-editors    # Register with all detected editors (Claude, Cursor, Zed, Codex)
just install-dev        # Start with UI/API + register editors (development mode)
just uninstall          # Remove from all editors, restore backups
just verify-claude      # Test Claude Code installation
just hosts-add          # Add gateway*.localhost to /etc/hosts (sudo required)
just hosts-remove       # Remove gateway hostnames from /etc/hosts
```

**Auto-import**: `just init` automatically:
1. Runs `scripts/import_existing_configs.py` to scan `~/.claude/`, `~/.cursor/`, `~/.windsurf/`, `~/.config/zed/`
2. Merges existing MCP servers into `mcp-config.json`
3. Backs up original configs to `<editor>/.mcp.json.backup.<timestamp>`
4. Registers unified Gateway via `scripts/install_all_editors.py`

**Codex CLI Transport**: Installer attempts HTTP endpoint first (`http://api.gateway.localhost:9400/api/v1/mcp`), falls back to STDIO bridge if unreachable. Set `CODEX_GATEWAY_BEARER_ENV` for auth.

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

**Database** (`apps/api/src/app/models/`):
- `secrets`: Encrypted API keys (Fernet + `ENCRYPTION_MASTER_KEY`)
- `mcp_server_states`: Server ON/OFF toggles
- `mcp_servers`: Server metadata

**API Endpoints** (`/api/v1/` prefix):
- `/secrets`: Manage encrypted credentials
- `/mcp/servers`, `/server-states`: Server management
- `/gateway/restart`: Trigger Gateway restart (Docker socket access)
- `/mcp/sse`, `/sse`: Schema partitioning proxy (SSE transport)
- `/mcp/*`: JSON-RPC proxy for tool calls
- `/health`: Healthcheck endpoint
- `/dashboard/summary`: UI metrics

**Schema Partitioning** (`apps/api/src/app/core/schema_partitioning.py`):
- `partition_schema()`: Remove nested `properties`, keep top-level types/descriptions
- `store_full_schema()`: Cache full schema in memory
- `expand_schema()`: On-demand retrieval (no Gateway call)
- `expandSchema` tool: Injected into `tools/list` response

**Docker-First Principles**:
- NO host-side `node_modules`, `dist`, `__pycache__` (all in named volumes)
- All builds in containers with isolated volumes
- Source code: bind mounts (read-only for builders), Build artifacts: named volumes
- CLI shims (`bin/pnpm`, `bin/node`, `bin/supabase`) fail with instructions to use Make targets

## Development Workflows

### Adding MCP Server
1. Edit `mcp-config.json` → add under `mcpServers`
2. Add secrets via UI or `/api/v1/secrets`
3. `just restart` + restart IDE

### Adding API Endpoint
1. Create file in `apps/api/app/api/endpoints/`
2. Register in `apps/api/app/api/routes.py`
3. Define schemas in `apps/api/app/schemas/`
4. Run `just test`

### Database Migration
```bash
docker compose exec api alembic revision --autogenerate -m "description"
just db-migrate
```

### UI Development
Edit `apps/settings/src/` → auto-reloads with `just dev` → build with `pnpm --filter @airis/settings build`

### Using Dynamic Profile
```bash
# Switch to Dynamic profile (enables self-management server)
# (Profile switching not yet implemented in justfile)
just restart

# LLM can now control servers via self-management tools:
# - list_mcp_servers() - Show all available servers
# - enable_mcp_server(server_name='tavily') - Enable web search
# - disable_mcp_server(server_name='tavily') - Disable after task
# - get_mcp_server_status(server_name='github') - Check status

# Use case: LLM enables only needed servers per task
# Example workflow:
#   1. Task requires GitHub API → LLM enables 'github' server
#   2. Complete GitHub operations
#   3. LLM disables 'github' to reduce token overhead
```

## Coding Conventions (from AGENTS.md)

### TypeScript/React
- Two-space indentation, functional components in PascalCase (e.g., `MCPServerCard.tsx`)
- Hooks in `useCamelCase`, validate with `pnpm lint` and `pnpm typecheck`
- React 19: `forwardRef` deprecated, use `React.ComponentProps<...>`
- Tailwind v4: Single `@import "tailwindcss"` in CSS, `darkMode: "class"` in config
- UI validation: Zod schemas in `apps/settings/src/validation/`
- Vitest for unit tests: `apps/settings/src/**/*.test.tsx`

### Python/FastAPI
- Four-space indentation, snake_case modules, type hints for all route handlers
- **Async consistency**: Alembic migrations fully async (`async_engine_from_config`), all DB ops use `AsyncSession`
- **Timestamps**: Use `server_default=func.now()` (DB-side, not Python `datetime.now()`)
- **PostgreSQL triggers**: Auto-update `updated_at` via `trigger_set_updated_at()` function
- **Session management**: Always `async with AsyncSession() as session:` (NOT thread-safe without context manager)
- **Schema isolation**: Tests use session-scoped schemas via `@pytest.fixture(scope="session")`
- **Secrets**: Never commit to `.env`, use Fernet encryption via `core/encryption.py`
- **Path construction**: `CONTAINER_PROJECT_ROOT` for Docker paths, `HOST_WORKSPACE_DIR` for host paths

### Testing
- **Python**: Mirror source under `tests/` and `apps/api/tests/`, name `test_<unit>.py`
- **React**: Co-locate tests in `src/` as `*.test.tsx` or mirror in `tests/apps/settings/`
- Run `pytest tests/ --cov=app --cov-report=term-missing` after backend changes
- Mark async tests with `@pytest.mark.asyncio`
- Fixtures in `tests/conftest.py` and `apps/api/tests/conftest.py`
- Integration tests use `apps/api/tests/integration/`

### Git Commits
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`)
- PRs: summary, linked issue/roadmap item, commands run (`just lint`, `pytest tests/`), screenshots for UI changes
- Flag migrations, secret-store changes, or Docker networking modifications in PR description

## Important Notes

### Configuration & Secrets
- **mcp-config.json**: Keys starting with `__comment_` = documentation only, `__disabled_<name>` = server disabled (Gateway ignores)
- **mcp.json**: IDE client config (symlinked to editor config directories)
- **Secrets**: Encrypted at rest (Fernet), stored in PostgreSQL `secrets` table, injected via `${VAR_NAME}` in `mcp-config.json`
- **Environment variables**: Defined in `.env` file (`GATEWAY_LISTEN_PORT`, `API_LISTEN_PORT`, `DOCKER_NETWORK`, etc.)

### Docker & Networking
- **Network name**: `airis-mcp-gateway_default` (auto-created by Compose with `COMPOSE_PROJECT_NAME`)
- **Custom servers**: Must join `airis-mcp-gateway_default` network or use `DOCKER_NETWORK` env var
- **Internal URLs**: `http://mcp-gateway:9390`, `http://api:9900`, `http://settings-ui:5273`
- **External URLs**: `http://api.gateway.localhost:9400` (proxy), `http://ui.gateway.localhost:5273` (UI)
- **Port binding**: `just up` binds to localhost based on the `ports` entries in `docker-compose.yml`

### Testing & CI
- **Test isolation**: Each pytest test gets isolated DB schema via `@pytest.fixture(scope="session")`
- **Test command**: Always run `just test` (not `pytest` directly on host)
- **Coverage**: `pytest tests/ --cov=app --cov-report=term-missing` shows missing lines

### Editor Integration
- **Symlinks**: Changes to `mcp.json` auto-propagate to `~/.claude/mcp.json` if symlinked by `just init`
- **Backup locations**: `~/<editor>/.mcp.json.backup.<timestamp>` for restored configs
- **Multi-editor**: `scripts/install_all_editors.py` handles Claude Desktop, Claude Code, Cursor, Zed, Codex CLI
- **Transport detection**: Codex uses HTTP if available, falls back to STDIO bridge via `mcp-proxy`

### Performance & Monitoring
- **Token measurement**: `just measure-tokens` analyzes `apps/api/logs/protocol_messages.jsonl` for reduction metrics
- **Logs**: Protocol messages logged to `apps/api/logs/protocol_messages.jsonl` when `DEBUG=true`
- **Health checks**: All services have Docker healthchecks (Gateway: port 9390, API: `/health`, UI: port 5273)

## Data Flow: Schema Partitioning

**Startup (Zero-Token):**
```
IDE → Proxy (SSE /mcp/sse)
      ↓
Proxy intercepts tools/list from Gateway
      ↓
1. Store full schemas in memory cache
2. Partition schemas (top-level only)
3. Inject expandSchema tool
      ↓
IDE receives 1,250 tokens (vs. 12,500)
```

**On-Demand Expansion:**
```
IDE needs nested property details
      ↓
IDE calls expandSchema(toolName, path)
      ↓
Proxy retrieves from memory cache (<10ms)
      ↓
IDE receives full schema for specific property
```

**Regular Tool Call:**
```
IDE → Proxy → Gateway → MCP Server → Result
(Proxy is transparent, no modification)
```

## Troubleshooting

### Gateway won't start
```bash
# Check Docker daemon and toolchain
just doctor

# Check port conflicts
lsof -i :9390 -i :9400 -i :5273

# View Gateway logs for errors
just logs-gateway

# Hard reset (drops all volumes)
just down && docker volume prune -f && just init
```

### Command issues
```bash
# "just: command not found"
# Install just: brew install just (macOS) or cargo install just

# "docker: command not found"
# Ensure Docker Desktop or OrbStack is running:
docker version

# Permission denied on /etc/hosts
# hosts-add/hosts-remove require sudo:
sudo just hosts-add

# Port binding errors
# Check if ports are in use and update .env:
lsof -i :9400 -i :5273 -i :9390
# Then edit GATEWAY_LISTEN_PORT, API_LISTEN_PORT, etc. in .env
```

### Editor not detecting Gateway
```bash
# Verify symlink
ls -la ~/.claude/mcp.json

# Re-register all editors
just install-editors

# Test connection
just verify-claude
```

### Database migration fails
```bash
# Check current revision
docker compose exec api alembic current

# Reset to specific revision
docker compose exec api alembic downgrade <revision>

# Re-run migration
just db-migrate
```

### Custom server build errors
```bash
# Clean build artifacts and rebuild
just builder-down
just build-custom-servers
```

### Tests failing
```bash
# Backend: Check DB schema isolation
pytest apps/api/tests/ -v --tb=short

# Frontend: Clear cache
rm -rf apps/settings/node_modules/.vite
just test-ui

# Integration: Ensure services are running
just up && just test
```

### Token reduction not working
```bash
# Enable protocol logging
echo "DEBUG=true" >> .env
just restart

# Check logs
tail -f apps/api/logs/protocol_messages.jsonl

# Measure reduction
just measure-tokens
```

## Quick Fixes

**"Port already in use"**: Change `*_LISTEN_PORT` in `.env`, then `just restart`

**"No module named 'app'"**: Run `just test` (not `pytest` directly)

**"pnpm: command not found"**: Use `just install` (shims intentionally fail on host to enforce Docker-first)

**"Gateway unhealthy"**: Check `just logs-gateway` for startup errors, verify `mcp-config.json` syntax

**"UI not loading"**: Ensure `just hosts-add` was run, check `http://ui.gateway.localhost:5273`

## Release Process

### Automated Release (Recommended)

Releases are fully automated via GitHub Actions. Simply push a version tag:

```bash
# Create and push a new version tag
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0
```

**What happens automatically:**
1. GitHub Actions creates tarball and GitHub Release
2. Formula in `agiletec-inc/homebrew-tap` is auto-updated with new version and SHA256
3. Users can upgrade via `brew upgrade airis-mcp-gateway`

**Requirements:**
- `HOMEBREW_TAP_TOKEN` secret must be set in repository settings (personal access token with `repo` scope)

### Manual Formula Update (Testing)

For testing or manual updates:

```bash
# Update Formula for version v1.3.0
./scripts/update_homebrew_formula.sh v1.3.0

# Review changes
cd ~/github/homebrew-tap
git diff Formula/airis-mcp-gateway.rb

# Commit and push
git add Formula/airis-mcp-gateway.rb
git commit -m "chore: update airis-mcp-gateway to v1.3.0"
git push
```

### Release Checklist

Before creating a release tag:
- [ ] All tests passing (`just test`)
- [ ] CLAUDE.md and PROJECT_INDEX.md up to date
- [ ] CHANGELOG.md updated (if exists)
- [ ] Version bumped in relevant files
- [ ] No uncommitted changes (`git status`)

### Homebrew Installation

Once released, users can install via:

```bash
# First-time installation
brew tap agiletec-inc/tap
brew install airis-mcp-gateway

# Upgrade to latest version
brew upgrade airis-mcp-gateway

# Installed location
brew --prefix airis-mcp-gateway
# → /opt/homebrew/Cellar/airis-mcp-gateway/<version>
```

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**参考ドキュメント**: このプロジェクトには詳細な `PROJECT_INDEX.md` があります。アーキテクチャの全体像、技術スタック、配布方法などの詳細はそちらを参照してください。

## Project Overview

AIRIS MCP Gateway is a centralized management system for MCP (Model Context Protocol) servers. It solves token explosion and editor configuration fragmentation by providing a unified gateway that IDE clients connect to, which then multiplexes requests to 25+ backend MCP servers.

**Core Problem Solved**: IDE clients loading all MCP tool definitions at startup consume massive tokens. Gateway pattern = 0 tokens until tools are actually invoked.

## Architecture

### Three-Layer Stack

```
┌─────────────────────────────────────────┐
│  IDE Clients (Claude Code/Desktop,     │
│  Cursor, Windsurf, Zed)                 │
│  - Single config: mcp.json → Gateway    │
└──────────────┬──────────────────────────┘
               │ SSE Transport (:9090)
┌──────────────▼──────────────────────────┐
│  Gateway Container (docker-mcp)         │
│  - Multiplexes to 25+ MCP servers       │
│  - Runs: npx, uvx, docker servers       │
│  - Config: mcp-config.json              │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌──▼──┐  ┌───▼────┐
│ API   │  │ UI  │  │ Custom │
│ :8001 │  │:5173│  │ Servers│
│FastAPI│  │React│  │mindbase│
└───┬───┘  └─────┘  │serena  │
    │               └────────┘
┌───▼────────────┐
│ PostgreSQL     │
│ - secrets      │
│ - server_states│
└────────────────┘
```

### Key Components

1. **Gateway Container** (`mcp-gateway`):
   - Container name: `airis-mcp-gateway-gateway`
   - Built from `gateway/Dockerfile` using `docker-mcp` binary
   - Reads `mcp-config.json` for server definitions
   - Exposes SSE endpoint at `:9090` for IDE clients
   - Has access to Docker socket to spawn server containers
   - Network: `airis-mcp-gateway_default`

2. **API Container** (`api`):
   - Container name: `airis-mcp-gateway-api`
   - FastAPI app in `apps/api/`
   - Internal port: `8000`, External port: `${API_PORT}` (default: 8001)
   - Manages encrypted secrets in PostgreSQL
   - Provides REST endpoints for UI and Gateway config management
   - Runs Alembic migrations on startup
   - Health check: `http://127.0.0.1:8000/health`

3. **UI Container** (`settings-ui`):
   - Container name: `airis-mcp-gateway-settings-ui`
   - React + Vite app in `apps/settings/`
   - Internal port: `80`, External port: `${UI_PORT}` (default: 5173)
   - Provides web dashboard for toggling servers, managing API keys
   - Built with Nginx for static serving

4. **PostgreSQL Container** (`postgres`):
   - Container name: `airis-mcp-gateway-postgres`
   - Internal only (no port binding to host)
   - Data volume: `postgres_data`
   - Accessible from other containers via hostname `postgres:5432`

5. **Custom MCP Servers**:
   - `servers/mindbase/`: TypeScript MCP server for long-term memory
   - `servers/self-management/`: Task orchestration MCP server
   - Built with separate builder containers, output to `dist/`
   - Run via Docker in `mcp-config.json` with network access to Gateway

## Configuration Files

### Primary Configs
- `mcp-config.json`: Gateway-side server definitions (what Gateway spawns)
- `mcp.json`: Client-side config (symlinked to `~/.claude/mcp.json`, etc.)
- `docker-compose.yml`: All service definitions

### Profile System
- `profiles/recommended.json`: filesystem, context7, serena, mindbase
- `profiles/minimal.json`: filesystem, context7 only
- Switch with: `make profile-recommended` or `make profile-minimal`
- Profile switching disables servers by renaming keys to `__disabled_<name>`

**How profiles work:**
- Profiles modify `mcp-config.json` by toggling server keys
- Enabled: `"serena": { ... }`
- Disabled: `"__disabled_serena": { ... }`
- Keys starting with `__` are ignored by Gateway
- Built-in servers (time, fetch, git, memory, sequentialthinking) always enabled
- See comments in `mcp-config.json` for server categories

## Development Commands

### Essential Operations
```bash
# Install + start all services (Gateway + PostgreSQL + API + UI)
make install

# Start services only (advanced restart without editor import)
make up

# Stop all services
make down

# Full restart (down then up)
make restart

# View logs (all services)
make logs

# View specific service logs
make logs-mcp-gateway
make logs-api
make logs-postgres
make logs-settings-ui
```

### Testing
```bash
# Run all tests (config validation + unit tests)
make test

# Run tests via pnpm (root level)
pnpm test

# Run API tests in Docker container (recommended)
docker compose run --rm test

# Run API tests locally (requires Python 3.12+)
cd apps/api && pytest tests/

# Run specific test file
cd apps/api && pytest tests/unit/test_secret_crud.py -v

# Run specific test function
cd apps/api && pytest tests/unit/test_secret_crud.py::test_create_secret -v

# Run with output
cd apps/api && pytest tests/ -v -s
```

### Database Operations
```bash
# Run migrations
make db-migrate

# Access PostgreSQL shell
make db-shell

# Migration files location
apps/api/alembic/versions/
```

### Building Custom Servers
```bash
# Build MindBase MCP server (TypeScript → dist/)
make mindbase-build

# Clean build artifacts
make mindbase-clean

# Build location
servers/mindbase/dist/index.js

# Build self-management server
docker compose --profile builder up --build -d self-management-builder

# View builder logs
docker compose logs mindbase-builder -f
```

**Builder Pattern:**
- Dedicated builder containers with `--profile builder`
- Source code mounted read-only
- `node_modules` isolated in Docker volumes (NOT on host)
- Build output (`dist/`) written to host for Gateway consumption
- Builder runs `pnpm install && pnpm build`, then sleeps
- Gateway's `mcp-config.json` references `dist/index.js` for execution

### UI Development
```bash
# Build UI image
make ui-build

# Start UI only
make ui-up

# View UI logs
make ui-logs

# Enter UI container shell
make ui-shell
```

### Installation & Editor Integration
```bash
# Install to all editors (auto-imports existing configs)
make install

# Install with dev mode (includes UI/API)
make install-dev

# Install with explicit config import first
make install-import

# Uninstall and restore original configs
make uninstall

# Install to Claude Code only
make install-claude

# Uninstall from Claude Code only
make uninstall-claude

# Verify installation
make verify-claude

# Import existing IDE configs without installing
python3 scripts/import_existing_configs.py
```

**What auto-import does:**
- Scans: `~/.claude/`, `~/.cursor/`, `~/.windsurf/`, `~/.config/zed/`
- Merges: Deduplicates MCP servers from all editors
- Preserves: Original configs backed up before symlink
- Output: Summary in `/tmp/airis_import_summary.txt`

## Database Schema

### Key Tables (apps/api/app/models/)

- **secrets**: Encrypted API keys (Fernet encryption)
  - Columns: `key`, `value` (encrypted), `created_at`, `updated_at`
  - Accessed via CRUD in `apps/api/app/crud/secret.py`

- **mcp_server_states**: Server ON/OFF toggles
  - Columns: `server_name`, `enabled`, `updated_at`
  - Persists across Gateway restarts

- **mcp_servers**: Server metadata (if exists)

### Schema Partitioning
- API uses `public` schema
- Tests use isolated session-scoped schemas
- See: `apps/api/tests/unit/test_schema_partitioning.py`

## API Endpoints (apps/api/app/api/endpoints/)

Key endpoint files:
- `secrets.py`: GET/POST/DELETE `/api/v1/secrets`
- `mcp_servers.py`: GET `/api/v1/mcp/servers`
- `mcp_server_states.py`: GET/PUT `/api/v1/server-states`
- `gateway.py`: POST `/api/v1/gateway/restart`
- `mcp_config.py`: GET/PUT `/api/v1/mcp-config`
- `validate_server.py`: POST `/api/v1/validate`
- `mcp_proxy.py`: `/api/v1/mcp/*` (OpenMCP Schema Partitioning)

Route prefix: All routes are under `/api/v1` (configured in main.py)

FastAPI docs available at: `http://localhost:${API_PORT}/docs` (default: 8001)

## Docker-First Development

This project follows strict Docker-First principles:

1. **NO host-side build artifacts**: No `node_modules`, `dist`, `__pycache__` on Mac
2. **All builds in containers**: Use dedicated builder containers with isolated volumes
3. **Clean command**: `make clean` removes any artifacts that shouldn't exist on host
4. **Volume strategy**:
   - Source code: bind mounts (read-only where possible)
   - Build artifacts: named volumes (`mindbase_node_modules`, etc.)
   - Data: named volumes (`postgres_data`, `claude-memory`)

## Testing Strategy

### Unit Tests (`apps/api/tests/unit/`)
- Test individual CRUD operations
- Use isolated database schemas per test session
- Mock external dependencies

### Integration Tests (`apps/api/tests/integration/`)
- Test full API workflows
- Use Docker Compose test profile
- Validate Gateway interaction

### Config Validation (`tests/test_config.py`)
- Validates `mcp-config.json` structure
- Ensures required fields exist

## Environment Variables

### Quick Start (デフォルト値で動作可能)
`.env` ファイルは**デフォルト値で動作します**。開発環境では以下の最小構成でOK：

```bash
# .env (最小構成 - これだけでOK)
GATEWAY_PORT=9090
API_PORT=9000
UI_PORT=5173
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mcp_gateway
```

**重要**: `ENCRYPTION_MASTER_KEY` は**省略可能**（開発環境のみ）。本番環境では必須。

### 本番環境用 (秘密情報を扱う場合)
暗号化キーが必要な場合のみ追加：

```bash
# Generate encryption key for production
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Add to .env
ENCRYPTION_MASTER_KEY=<generated-key-here>
```

### ポート設定
- **API_PORT**: 実際の `.env` では `9000` を使用
- `.env.example` では `8001` と記載されているが、環境に応じて変更可能

## MCP Server Management

### Adding New Servers

1. Add to `mcp-config.json` under `mcpServers`:
```json
{
  "your-server": {
    "command": "npx",
    "args": ["-y", "@your/mcp-server"],
    "env": {
      "API_KEY": "${YOUR_API_KEY}"
    }
  }
}
```

2. If requires secrets, add via API or UI
3. Restart Gateway: `make restart`

### Disabling Servers

**Option 1**: Profile switch
```bash
make profile-minimal  # Disables serena, mindbase
make restart
```

**Option 2**: Manual edit
```bash
# Rename key in mcp-config.json
"serena": { ... }  →  "__disabled_serena": { ... }
make restart
```

## Monorepo Structure

This is a **pnpm workspace** (pnpm@10.18.3) with mixed TypeScript and Python packages:

```
apps/
  api/          - Python FastAPI backend (NOT in pnpm workspace)
                  - Uses pytest for testing
                  - Runs in Docker with Python 3.12
  settings/     - React + Vite UI (@airis/settings)
                  - In pnpm workspace
  desktop/      - Desktop extension bundle
                  - In pnpm workspace

servers/
  mindbase/     - Custom MCP server (TypeScript, in pnpm workspace)
                  - Built with Docker builder container
                  - Output: servers/mindbase/dist/
  self-management/ - Task orchestration MCP server (TypeScript, in pnpm workspace)
                  - Built with Docker builder container
                  - Output: servers/self-management/dist/

Workspace config: pnpm-workspace.yaml
  packages:
    - 'apps/*'
    - 'servers/*'

Root package.json scripts:
  pnpm dev      - Start settings UI dev server (apps/settings)
  pnpm build    - Build all TypeScript workspaces
  pnpm test     - Run all TypeScript tests
  pnpm lint     - Lint all workspaces
  pnpm typecheck - Type-check all TypeScript workspaces
  pnpm clean    - Clean all build artifacts
```

## Common Workflows

### Making Changes to Gateway Config
1. Edit `mcp-config.json`
2. Run `make restart`
3. Restart IDE to pick up changes

### Adding API Endpoint
1. Create endpoint file in `apps/api/app/api/endpoints/`
2. Register route in `apps/api/app/api/routes.py`
3. Add Pydantic schemas in `apps/api/app/schemas/`
4. Test with `make test`

### Modifying UI
1. Edit files in `apps/settings/src/`
2. Dev server auto-reloads (if running `pnpm dev`)
3. Build for production: `pnpm --filter @airis/settings build`
4. Rebuild container: `make ui-build && make ui-up`

### Creating Database Migration
```bash
# Generate migration (auto-detect model changes)
docker compose exec api alembic revision --autogenerate -m "add_new_table"

# Apply migrations
make db-migrate

# View migration history
docker compose exec api alembic history

# Rollback one version
docker compose exec api alembic downgrade -1

# Migration files location
apps/api/alembic/versions/
```

## Troubleshooting

### Gateway not starting
```bash
docker logs airis-mcp-gateway-gateway
# Common issue: mcp-config.json syntax error
make test  # Validates config
```

### API not connecting to DB
```bash
make db-shell  # Verify PostgreSQL is up
docker compose ps  # Check all container health
```

### UI not loading
```bash
make ui-logs
# Check CORS_ORIGINS in apps/api/app/core/config.py
```

### Clean slate restart
```bash
make clean-all  # ⚠️ DESTROYS ALL DATA (volumes)
make install
```

## Important Notes

- **Symlink propagation**: Changes to `mcp.json` auto-apply to all editors
- **Profile switching**: Requires `make restart` to take effect
- **Secret storage**: All API keys encrypted at rest in PostgreSQL
- **Gateway restart**: Can be triggered via API at `/api/v1/gateway/restart`
- **Testing isolation**: Each test gets isolated DB schema to prevent interference

## Development Best Practices

### Working with mcp-config.json
- **Comments**: Keys starting with `__comment_` are documentation-only
- **Disabled servers**: Keys starting with `__disabled_` are ignored by Gateway
- **Environment variables**: Use `${VAR_NAME}` for secret injection
- **Docker servers**: Must specify `--network airis-mcp-gateway_default` to communicate
- **Validation**: Run `make test` after editing to validate JSON structure
- **MCP Specification**: Official spec at `modelcontextprotocol.io/specification/2025-03-26`

### Testing Patterns
- **Unit tests**: Use in-memory SQLite (`sqlite+aiosqlite:///:memory:`)
- **Integration tests**: Use Docker Compose test profile
- **Schema isolation**: Tests use session-scoped schemas, not `public`
- **Fixtures**: Defined in `apps/api/tests/unit/conftest.py`
- **Async tests**: Always mark with `@pytest.mark.asyncio`

### API Development (FastAPI + SQLAlchemy 2.0 Best Practices)

**Async Consistency (2025 Critical)**:
- **Alembic migrations**: ✅ **Already implemented** - `alembic/env.py` is fully async
  - Uses `async_engine_from_config` with `poolclass=pool.NullPool` (apps/api/alembic/env.py:54-58)
  - Properly awaits `connection.run_sync(do_run_migrations)` (line 61)
  - No sync wrappers - pure async from top to bottom
  - ✅ **compare_server_default=True** enabled (detects server_default changes)
- **asyncpg driver**: ✅ Required for optimal performance (`postgresql+asyncpg://...`)
- **Connection pooling**: SQLAlchemy 2.0 uses `AsyncAdaptedQueuePool` automatically
  - **Note**: Alembic uses `NullPool` (creates new connection per request, no pooling)

**Timestamp Best Practices (2025)**:
- ✅ **server_default=func.now()**: All models use DB-side defaults (not Python `datetime.utcnow`)
  - Why: Web latency is variable, clients have clock drift, portability
  - Models: `Secret`, `MCPServerState`, `MCPServer` (apps/api/app/models/)
- ✅ **PostgreSQL Triggers**: Auto-update `updated_at` on ANY update (not just ORM)
  - Function: `trigger_set_updated_at()` (apps/api/alembic/versions/006)
  - Triggers: Applied to `secrets`, `mcp_server_states`, `mcp_servers`
  - Why: PostgreSQL lacks MySQL's `ON UPDATE CURRENT_TIMESTAMP`

**Architecture**:
- **Route registration**: Add routes to `apps/api/app/api/routes.py`
- **Schemas**: Define Pydantic models in `apps/api/app/schemas/` (separate from ORM models)
- **CRUD operations**: Implement in `apps/api/app/crud/`
- **Models**: SQLAlchemy models in `apps/api/app/models/` (DB schema only)
- **Service layer**: Business logic should be separated from CRUD (if complex)
- **Hot reload**: API auto-reloads when `apps/api/app/` files change

**Session Management**:
- Always use `async with` for AsyncSession (ensures proper connection return to pool)
- **NOT concurrency-safe**: AsyncSession = single asyncpg connection (no sharing across tasks)
- Configure `pool_size` and `max_overflow` based on workload

**Performance**:
- asyncpg provides 2-5x higher throughput vs sync drivers
- Pool includes automatic "reset on return" (calls `rollback()` on connection return)

### Frontend Development (React 19 + Vite + Tailwind v4)

**React 19 Changes**:
- **forwardRef deprecated**: Use `React.ComponentProps<...>` instead of `React.forwardRef<...>`
- Remove explicit `ref={ref}` from components
- Leverage Server Components when applicable

**Tailwind CSS v4 (Latest)**:
- **Installation**: `npm install tailwindcss @tailwindcss/vite`
- **Simplified imports**: No longer `@tailwind base/components/utilities` (v4 uses single import)
- **Vite plugin**: Add `tailwindcss` to `vite.config.ts` plugins array
- **Dark mode**: Enable `darkMode: "class"` for better theme control

**TypeScript Configuration**:
- **Path aliases**: Configure in both `tsconfig.json` and `tsconfig.app.json`
- Set `baseUrl: "."` and `paths: { "@/*": ["./src/*"] }`
- Install `@types/node` as dev dependency

**Dev Workflow**:
- **Dev mode**: `pnpm dev` starts Vite dev server with hot reload
- **Production build**: `pnpm --filter @airis/settings build`
- **Container rebuild**: Required after `package.json` changes
- **API calls**: Use relative URLs (Nginx proxies `/api` to API container)

### pnpm Workspace Best Practices (2025)

**Workspace Protocol**:
- Use `workspace:*` for internal package dependencies
- On publish, `workspace:` is dynamically replaced with actual version/semver range

**Dependency Management**:
- **Root dev dependencies**: `pnpm add -Dw <package>` (workspace root)
- **TypeScript**: Install at root for version consistency across all packages
- **Scoped scripts**: `pnpm --filter @airis/settings build`

**Configuration**:
- `pnpm-workspace.yaml` defines all packages (`apps/*`, `servers/*`)
- TypeScript base config at root with `strict: true` and `esModuleInterop: true`
- Use `incremental: true` for build caching (`tsconfig.tsbuildinfo`)

### Docker Compose Best Practices (2025)

**Startup Order & Health**:
- Use `depends_on` with `condition: service_healthy` (not just depends_on)
- Define `healthcheck` for all services (PostgreSQL, API, Gateway)
- Prevents race conditions during container startup

**Volume Strategy**:
- **Database**: Named volume for persistence (`postgres_data:/var/lib/postgresql/data`)
- **Code**: Bind mounts for development (`./apps/api/app:/app/app:rw`)
- **Build artifacts**: Named volumes (`mindbase_node_modules`, etc.)

**Network Configuration**:
- Docker Compose creates network automatically (`airis-mcp-gateway_default`)
- Service-to-service: Use service name as hostname (`postgres:5432`, `api:8000`)
- Host access: Use `host.docker.internal` from containers

**Production Considerations**:
- Use managed database services (RDS, Cloud SQL) instead of containerized PostgreSQL
- Run services with non-root user
- Consider `uvicorn-gunicorn` for production FastAPI deployment

### Container Networking
- **Gateway to API**: `http://api:8000`
- **MCP servers to Gateway**: `http://host.docker.internal:9090`
- **Custom servers**: Must join `airis-mcp-gateway_default` network
- **Database access**: `postgres:5432` (internal only)

# Project Index: AIRIS MCP Gateway

**Generated**: 2025-11-12
**Version**: 1.0.0
**Repository**: airis-mcp-gateway

---

## 📁 Project Structure

```
airis-mcp-gateway/
├── apps/
│   ├── api/                    # FastAPI backend (Python 3.12+)
│   │   ├── alembic/           # Database migrations
│   │   ├── src/app/           # Core API implementation
│   │   │   ├── api/endpoints/ # REST endpoints
│   │   │   ├── core/          # Schema partitioning, crypto, DB
│   │   │   ├── models/        # SQLAlchemy models
│   │   │   ├── crud/          # Database operations
│   │   │   └── schemas/       # Pydantic schemas
│   │   └── tests/             # Pytest test suite
│   ├── settings/              # React settings UI (@airis/settings)
│   │   └── src/
│   │       ├── pages/         # React pages
│   │       ├── i18n/          # Internationalization (en/ja)
│   │       └── validation/    # Zod schemas
│   ├── webui/                 # Alternative web UI
│   ├── desktop/               # Tauri desktop wrapper
│   └── menubar/               # macOS menubar app
├── servers/
│   ├── mindbase/              # Custom MCP: AI conversation memory
│   └── self-management/       # Custom MCP: Dynamic server control
├── packages/
│   ├── cli/                   # CLI tools (@airis/cli)
│   └── augmentor-runtime/     # Augmentor runtime support
├── scripts/
│   ├── installers/            # Editor installers (Claude, Cursor, Zed, Codex)
│   ├── import_existing_configs.py  # Config migration tool
│   └── install_all_editors.py      # Multi-editor installer
├── config/
│   ├── profiles/              # Server presets (recommended, minimal, dynamic)
│   └── mcp.json.template      # IDE config template
├── gateway/                   # Gateway container scripts
├── tests/                     # Integration tests
└── tools/                     # Measurement utilities
```

---

## 🚀 Entry Points

### CLI Commands
- **`make init`** - Full installation: build, start, register editors
  - Location: `Makefile:609`
- **`make up`** - Start services with host port bindings
  - Location: `Makefile:168`
- **`make restart`** - Full stop/start cycle
  - Location: `Makefile:199`
- **`make install-editors`** - Register with all detected editors
  - Location: `Makefile:605`

### API Endpoints
- **HTTP MCP (Codex)**: `http://api.gateway.localhost:9400/api/v1/mcp`
- **SSE Gateway**: `http://api.gateway.localhost:9400/api/v1/mcp/sse`
- **API Docs**: `http://api.gateway.localhost:9400/docs`
- **Settings UI**: `http://ui.gateway.localhost:5273`

### Python Entry Points
- **API Server**: `apps/api/src/app/main.py` (FastAPI application)
- **Config Importer**: `scripts/import_existing_configs.py`
- **Editor Installer**: `scripts/install_all_editors.py`
- **Token Measurement**: `tools/measurement/measure_token_reduction.py`

### TypeScript Entry Points
- **Settings UI**: `apps/settings/src/main.tsx` (React app)
- **MindBase Server**: `servers/mindbase/src/index.ts` (MCP server)
- **Self-Management**: `servers/self-management/src/index.ts` (MCP server)

---

## 📦 Core Modules

### API Core (`apps/api/src/app/core/`)
- **`schema_partitioning.py`** - Token reduction via schema partitioning (90% reduction)
- **`encryption.py`** - Fernet encryption for API keys
- **`database.py`** - Async SQLAlchemy session management
- **`protocol_logger.py`** - MCP protocol message logging
- **`validators.py`** - Input validation utilities

### API Endpoints (`apps/api/src/app/api/endpoints/`)
- **`mcp_proxy.py`** - SSE/JSON-RPC proxy with schema partitioning
- **`mcp_servers.py`** - Server CRUD operations
- **`mcp_server_states.py`** - Server enable/disable toggle
- **`gateway.py`** - Gateway restart API
- **`dashboard.py`** - UI dashboard summary
- **`validate_server.py`** - Server connection testing

### Database Models (`apps/api/src/app/models/`)
- **`mcp_server.py`** - Server metadata
- **`mcp_server_state.py`** - ON/OFF states
- **`secret.py`** - Encrypted API keys
- **`mcp_credential.py`** - Credential storage
- **`mcp_setting.py`** - Server-specific settings

### Editor Installers (`scripts/installers/`)
- **`base.py`** - Abstract installer base class
- **`claude.py`** - Claude Desktop/Code installer
- **`cursor.py`** - Cursor IDE installer
- **`zed.py`** - Zed editor installer
- **`codex.py`** - Codex CLI installer (HTTP + STDIO fallback)

### React UI (`apps/settings/src/`)
- **`pages/mcp-dashboard/`** - Server management dashboard
- **`components/MCPServerCard.tsx`** - Server card component
- **`components/ConfigEditor.tsx`** - JSON config editor
- **`validation/server-config.ts`** - Zod validation schemas
- **`i18n/`** - English/Japanese translations

---

## 🔧 Configuration Files

### Core Configuration
- **`.env`** - Environment variables (ports, DB credentials, encryption key)
- **`mcp-config.json`** - Gateway server definitions (25+ MCP servers)
- **`mcp.json`** - Generated IDE configuration (from template)
- **`docker-compose.yml`** - Service orchestration
- **`docker-compose.dev.yml`** - Development overrides

### Profiles
- **`config/profiles/recommended.json`** - Default profile (filesystem, context7, serena, mindbase)
- **`config/profiles/minimal.json`** - Minimal profile (filesystem, context7 only)
- **`config/profiles/dynamic.json`** - LLM-controlled profile (self-management enabled)

### Build Configuration
- **`apps/api/pyproject.toml`** - Python dependencies (FastAPI, SQLAlchemy, Alembic)
- **`apps/settings/package.json`** - React UI dependencies
- **`servers/mindbase/package.json`** - MindBase server dependencies
- **`package.json`** - Workspace root (pnpm 10.20.0)
- **`pnpm-workspace.yaml`** - pnpm monorepo configuration

---

## 📚 Documentation

### Main Docs
- **`README.md`** - Quick start, daily commands, configuration
- **`CLAUDE.md`** - AI assistant guidance (project overview, architecture, commands)
- **`AGENTS.md`** - Coding conventions (TypeScript/Python style)
- **`ARCHITECTURE.md`** - Technical deep-dive (OpenMCP pattern, schema partitioning)
- **`HACKING.md`** - Development guide

### Guides
- **`docs/guides/mcp-best-practices.md`** - MCP server best practices
- **`docs/guides/mcp-installation.md`** - Installation workflow
- **`docs/guides/augmentor-integration.md`** - Augmentor ABI integration
- **`docs/guides/testing-implementation-summary.md`** - Testing strategy

### Research
- **`docs/research/token-measurement-guide.md`** - Token reduction measurement
- **`docs/research/PHASE2_IMPLEMENTATION_SUMMARY.md`** - Phase 2 summary
- **`docs/research/mcp_servers_verification_20251018.md`** - Server verification
- **`SECRETS.md`** - Secrets management guide

---

## 🧪 Test Coverage

### Backend Tests (`apps/api/tests/`)
- **Unit Tests**: 12 files
  - `unit/test_secret_crud.py` - Secret CRUD operations
  - `unit/test_mcp_server_state_crud.py` - Server state management
  - `unit/test_credentials_provider.py` - Credential injection
  - `unit/test_schema_partitioning.py` - Schema partitioning logic
  - `unit/test_dashboard_summary.py` - Dashboard metrics
  - `unit/test_public_routes.py` - Public endpoint tests

- **Integration Tests**: 1 file
  - `integration/test_server_toggle_workflow.py` - End-to-end server toggle

### Frontend Tests (`apps/settings/src/`)
- **Component Tests**: 2 files
  - `pages/mcp-dashboard/components/MCPServerCard.test.tsx`
  - `pages/mcp-dashboard/page.test.tsx`
- **Setup**: `test/setup.ts` (vitest configuration)

### Root Tests (`tests/`)
- **Config Tests**: `test_config.py` - Configuration validation
- **Token Tests**: `test_token_reduction.py` - Token measurement validation
- **MCP Tests**: `test_mcp_tools.py` - MCP protocol tests

**Test Commands**:
- `make test` - Run backend tests (pytest)
- `make test-ui` - Run frontend tests (vitest)
- `pytest apps/api/tests/ --cov=app` - Backend with coverage

---

## 🔗 Key Dependencies

### Backend (Python 3.12+)
- **FastAPI** 0.120+ - Async web framework
- **SQLAlchemy** 2.0.35+ - Async ORM
- **Alembic** 1.13.3+ - Database migrations
- **asyncpg** 0.30+ - PostgreSQL async driver
- **cryptography** 43+ - Fernet encryption
- **pydantic** 2.10+ - Data validation
- **httpx** 0.27+ - Async HTTP client
- **pytest** 8.3+ - Testing framework

### Frontend (React 19)
- **React** 19.2 - UI framework
- **react-router-dom** 7.9+ - Routing
- **Vite** 7.1+ - Build tool
- **Tailwind CSS** 4.1+ - Styling
- **Zod** 4.1+ - Schema validation
- **i18next** 25.6+ - Internationalization
- **vitest** 4.0+ - Testing

### Custom MCP Servers
- **@modelcontextprotocol/sdk** 1.0.4 - MCP protocol SDK
- **simple-git** 3.27 - Git operations (MindBase)
- **TypeScript** 5.9.3 - Type safety

### Infrastructure
- **Docker** 24.0+ - Containerization
- **Docker Compose** 2.20+ - Orchestration
- **PostgreSQL** 15+ - Database
- **pnpm** 10.20.0 - Package manager
- **Node.js** 24+ - JavaScript runtime

---

## 📝 Quick Start

### 1. Initial Setup (90 seconds)
```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway
cp .env.example .env
make hosts-add              # Add *.localhost to /etc/hosts (sudo)
make init                   # Build, start, register editors
```

### 2. Development Workflow
```bash
make dev                    # Start Vite dev server (Settings UI)
make logs                   # Stream all service logs
make restart                # Full stop/start cycle
make test                   # Run backend tests
make test-ui                # Run frontend tests
```

### 3. Editor Configuration
```bash
make install-editors        # Register with all editors
make verify-claude          # Test Claude Code installation
make uninstall              # Remove from all editors
```

### 4. Database Operations
```bash
make db-migrate             # Run Alembic migrations
make db-shell               # PostgreSQL psql shell
# Create migration:
docker compose exec api alembic revision --autogenerate -m "description"
```

### 5. Profile Management
```bash
make profile-list           # List available profiles
make profile-recommended    # Switch to recommended profile
make profile-minimal        # Switch to minimal profile
make profile-dynamic        # Switch to LLM-controlled profile
```

---

## 🔍 Key Features

### 1. Token Reduction (90%)
- **Before**: 12,500 tokens at IDE startup (25 servers × ~500 tokens)
- **After**: 1,250 tokens (partitioned schemas only)
- **Mechanism**: Schema partitioning + on-demand `expandSchema` tool
- **Implementation**: `apps/api/src/app/core/schema_partitioning.py`

### 2. Unified Gateway
- **Single SSE endpoint** for all MCP servers
- **25+ bundled servers**: filesystem, context7, serena, mindbase, etc.
- **Dynamic enable/disable**: Toggle servers via UI or API
- **Auto-restart**: Gateway restarts on config changes

### 3. Multi-Editor Support
- **Claude Desktop** & **Claude Code**: SSE transport
- **Cursor** & **Windsurf**: SSE transport
- **Zed Editor**: SSE transport
- **Codex CLI**: HTTP + STDIO fallback
- **Unified config**: Single `mcp.json` for all editors

### 4. Secrets Management
- **Fernet encryption** for API keys
- **PostgreSQL storage** with `ENCRYPTION_MASTER_KEY`
- **UI-based management**: Settings dashboard
- **Environment injection**: Auto-inject into MCP servers

### 5. Docker-First Development
- **Zero host pollution**: All builds in containers
- **Named volumes**: `node_modules`, `dist`, `.venv` isolated
- **Bind mounts**: Source code only
- **Health checks**: All services monitored

---

## 🎯 Architecture Highlights

### Three-Layer Stack
1. **IDE Clients** → Claude Code, Cursor, Zed, Codex
2. **FastAPI Proxy** → Schema partitioning, `expandSchema` injection
3. **MCP Gateway** → Orchestrates 25+ MCP servers

### Key Innovation: OpenMCP Lazy Loading
- **Intercept `tools/list`**: Partition schemas to top-level only
- **Inject `expandSchema` tool**: On-demand schema retrieval
- **Cache full schemas**: In-memory storage for instant access
- **Transparent proxy**: Regular tool calls pass through unchanged

### Performance Characteristics
- **SSE connection**: <100ms
- **tools/list (partitioned)**: <200ms
- **expandSchema (cached)**: <10ms
- **tools/call (proxy)**: +5-10ms overhead
- **Schema cache**: ~2MB for 25 servers (linear growth)

---

## 🚦 Status & Roadmap

### Current Status (Phase 1 MVP)
- ✅ Schema partitioning implementation
- ✅ SSE/JSON-RPC proxy
- ✅ Multi-editor support (4 editors)
- ✅ Settings UI with dashboard
- ✅ Encrypted secrets storage
- ✅ 25+ bundled MCP servers
- ✅ Dynamic profile system

### Phase 2 (Planned)
- [ ] Retry logic with exponential backoff
- [ ] Graceful degradation (fallback to full schemas)
- [ ] Structured logging (INFO/WARNING/ERROR)
- [ ] Health check endpoints

### Phase 3 (Planned)
- [ ] Redis caching (persistent schemas)
- [ ] HTTP/2 support
- [ ] Gzip compression for SSE
- [ ] Prometheus metrics

---

## 💡 Useful Commands

### Daily Operations
```bash
make init           # Full reset + install
make up             # Start with host ports
make up-dev         # Start with internal DNS only
make restart        # Stop + start
make down           # Stop containers
make clean          # Stop + drop volumes
make logs           # Stream all logs
make ps             # Container status
```

### Development
```bash
make deps           # Install pnpm deps
make dev            # Vite dev server (UI)
make build          # Build all workspaces
make lint           # ESLint
make typecheck      # TypeScript checks
make test           # Backend tests
make test-ui        # Frontend tests
```

### Database
```bash
make db-migrate     # Run migrations
make db-shell       # PostgreSQL shell
```

### Custom Servers
```bash
make mindbase-build          # Build MindBase MCP server
make self-management-build   # Build Self-Management server
make build-custom-servers    # Build both
```

---

## 📊 Token Efficiency ROI

### Break-Even Analysis
- **Index creation**: 2,000 tokens (one-time)
- **Index reading**: 3,000 tokens (every session)
- **Full codebase read**: 58,000 tokens (every session)

### Savings
- **Break-even**: 1 session
- **10 sessions**: 550,000 tokens saved
- **100 sessions**: 5,500,000 tokens saved

### Schema Partitioning ROI
- **Before**: 12,500 tokens at startup
- **After**: 1,250 tokens at startup
- **Per session savings**: 11,250 tokens
- **100 sessions**: 1,125,000 tokens saved

---

## 🛡️ Security Model

### Secrets Encryption
- **Algorithm**: Fernet (symmetric encryption)
- **Key**: `ENCRYPTION_MASTER_KEY` in `.env`
- **Storage**: PostgreSQL `secrets` table
- **Access**: Encrypted at rest, decrypted in memory

### Network Isolation
- **Exposed**: FastAPI Proxy (9400), Settings UI (5273)
- **Internal**: MCP Gateway (9390), PostgreSQL (5432), MCP Servers
- **Docker network**: `airis-mcp-gateway_default` (bridge)

### Environment Variables
- **Never commit** `.env` with real secrets
- **Use Settings UI** to manage API keys
- **Auto-inject** into MCP servers via Gateway

---

## 📞 Support & Resources

### Help Commands
- `make help` - Show all available targets
- `make doctor` - Health check (Docker, toolchain)
- `make verify-claude` - Test Claude Code installation
- `make info` - List available MCP servers
- `make profile-list` - Show profile options

### Documentation
- `/help` in Claude Code - Get help
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- API Docs: http://api.gateway.localhost:9400/docs

---

**Generated by**: Index Creator Agent
**Purpose**: 94% token reduction (58K → 3K) for session efficiency
**Maintained by**: Agiletec Inc.

# AIRIS MCP Gateway - Project Index

**Version**: 1.3.0
**Type**: Monorepo (pnpm workspace)
**Purpose**: Unified MCP server management with zero-token startup and encrypted secrets
**Last Updated**: 2025-10-23

---

## 📊 Repository Statistics

- **Total Files**: 613 (code, docs, configs)
- **Core Code**: 72 TypeScript/Python files
- **Architecture**: FastAPI (Python) + Vite React (TypeScript)
- **Package Manager**: pnpm (workspace mode)
- **Docker**: OrbStack/Docker Desktop compatible

---

## 🏗️ Architecture Overview

```
airis-mcp-gateway/
├── apps/                    # Main applications
│   ├── api/                # FastAPI backend (Python)
│   │   ├── app/
│   │   │   ├── api/        # REST endpoints
│   │   │   ├── core/       # Config, DB, encryption
│   │   │   ├── crud/       # Database operations
│   │   │   ├── models/     # SQLAlchemy models
│   │   │   └── schemas/    # Pydantic schemas
│   │   └── alembic/        # Database migrations
│   │
│   └── settings/           # Vite + React frontend (TypeScript)
│       ├── src/
│       │   ├── pages/      # React pages
│       │   ├── router/     # React Router config
│       │   ├── validation/ # Zod schemas
│       │   └── i18n/       # Internationalization
│       └── out/            # Build output
│
├── packages/               # Shared packages
│   └── cli/               # CLI tool (TypeScript)
│
├── servers/               # Custom MCP servers
│   ├── mindbase/         # Memory management server
│   └── self-management/  # Self-improvement server
│
├── gateway/              # MCP Gateway orchestration
├── profiles/             # Server profiles (minimal, recommended)
├── desktop-extension/    # Claude Desktop extension bundle
├── Formula/              # Homebrew formula
├── scripts/              # Build and deployment scripts
├── tests/                # Integration tests
└── docs/                 # Documentation
```

---

## 🔑 Key Components

### 1. Backend API (`apps/api/`)
**Tech**: FastAPI + PostgreSQL + SQLAlchemy + Alembic
**Purpose**: REST API for MCP server management, secret storage, state persistence

**Core Modules**:
- `app/main.py` - FastAPI application entry point
- `app/core/` - Configuration, database, encryption, validators
- `app/api/endpoints/` - REST endpoints (servers, secrets, config, proxy)
- `app/models/` - SQLAlchemy ORM models (mcp_server, secret, state)
- `app/schemas/` - Pydantic request/response schemas
- `app/crud/` - Database CRUD operations
- `alembic/` - Database migration scripts

**Database Tables**:
1. `mcp_servers` - MCP server metadata and enabled state
2. `secrets` - Encrypted API keys and credentials
3. `mcp_server_states` - Runtime state tracking

### 2. Frontend Settings UI (`apps/settings/`)
**Tech**: Vite + React 19 + TypeScript + TailwindCSS
**Purpose**: Web UI for server management, configuration, and monitoring

**Key Files**:
- `src/pages/mcp-dashboard/` - Main dashboard
- `src/pages/mcp-dashboard/components/` - UI components
  - `MCPServerCard.tsx` - Server card with toggle
  - `ConfigEditor.tsx` - JSON config editor
  - `MultiFieldConfigModal.tsx` - Multi-field config UI
  - `StatusIndicator.tsx` - Server status display
- `src/validation/server-config.ts` - Zod validation schemas
- `src/router/config.tsx` - React Router routes
- `src/i18n/` - i18next translations

### 3. CLI Tool (`packages/cli/`)
**Tech**: TypeScript + Commander.js
**Purpose**: Command-line interface for installation and management

**Commands**:
- `airis-gateway install` - Setup and start gateway
- `airis-gateway status` - Check service status
- `airis-gateway stop` - Stop services

### 4. Custom MCP Servers (`servers/`)

**mindbase** - Memory management and knowledge graph
- Persistent memory across sessions
- Entity and relation tracking

**self-management** - Self-improvement and learning
- Performance tracking
- Pattern learning

### 5. Gateway Orchestration (`gateway/`)
**Purpose**: Unified MCP server proxy and routing
- 25+ MCP servers via single endpoint
- Zero-token startup (lazy loading)
- SSE transport for Claude Desktop

---

## 📄 Configuration Files

### Root Level
- `package.json` - Workspace root config
- `pnpm-workspace.yaml` - pnpm workspace definition
- `docker-compose.yml` - Production services
- `docker-compose.dev.yml` - Development overrides
- `mcp-config.json` - MCP server definitions
- `mcp.json` - Claude Desktop integration

### Homebrew
- `Formula/airis-mcp-gateway.rb` - Homebrew formula (CLI)

### Desktop Extension
- `desktop-extension/manifest.json` - Claude Desktop extension
- `desktop-extension/build/` - Built extension bundle

### Profiles
- `profiles/minimal.json` - Minimal server set (filesystem, context7)
- `profiles/recommended.json` - Recommended servers (+serena, mindbase)

---

## 🧪 Testing

**Location**: `apps/api/tests/integration/`

**Key Tests**:
- `test_mcp_server_persistence.py` - Database persistence validation
- `test_server_toggle_workflow.py` - UI toggle workflow
- `test_validate_server.py` - Server validation endpoint

**Test Database**: PostgreSQL with NullPool (no session caching)

---

## 📚 Documentation

### Root Docs
- `README.md` - Project overview and quick start
- `ARCHITECTURE.md` - System architecture deep dive
- `SECRETS.md` - Secret management guide
- `ROADMAP.md` - Future features roadmap
- `VISION.md` - Project vision and goals
- `CHANGELOG.md` - Version history
- `PERFORMANCE_TEST.md` - Token reduction validation

### Research (`docs/research/`)
- `mcp_servers_verification_20251018.md` - MCP server verification
- `mcp_installation_best_practices_20251018.md` - Installation patterns
- `token-measurement-guide.md` - Token efficiency measurement

### Memory (`docs/memory/`)
- `pm_context.md` - Project manager context
- `next_actions.md` - Planned actions

### Serena Memory (`.serena/memories/`)
- `codebase_structure.md` - Codebase overview
- `tech_stack.md` - Technology stack
- `development_guidelines.md` - Development rules
- `code_style_and_conventions.md` - Coding standards

---

## 🚀 Development Workflow

### Quick Start
```bash
# Install dependencies
pnpm install

# Start development
docker compose up -d

# Access
Gateway:     http://localhost:9090
Settings UI: http://localhost:5173
API Docs:    http://localhost:8001/docs
```

### Common Commands
```bash
pnpm dev          # Start frontend dev server
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm typecheck    # Type checking
```

### Database
```bash
# Run migrations
docker compose exec api alembic upgrade head

# Create migration
docker compose exec api alembic revision --autogenerate -m "description"
```

---

## 🔧 Technology Stack

### Backend
- **FastAPI** 0.115+ - Modern async Python web framework
- **PostgreSQL** 16+ - Primary database
- **SQLAlchemy** 2.0+ - ORM with async support
- **Alembic** 1.13+ - Database migrations
- **Pydantic** 2.10+ - Data validation
- **cryptography** - Secret encryption (Fernet)

### Frontend
- **Vite** 7.0+ - Build tool and dev server
- **React** 19.1+ - UI framework
- **TypeScript** 5.8+ - Type safety
- **TailwindCSS** 3.4+ - Styling
- **React Router** 7.6+ - Routing
- **i18next** - Internationalization
- **Zod** - Runtime validation

### Infrastructure
- **Docker Compose** - Container orchestration
- **OrbStack/Docker Desktop** - Container runtime
- **pnpm** 9.15+ - Package manager
- **Homebrew** - macOS distribution

---

## 🎯 Key Features

1. **Zero-Token Startup** - Lazy loading, 50K → 3K token reduction
2. **Encrypted Secrets** - Fernet encryption for API keys
3. **Multi-Editor Support** - Claude Desktop, Cursor, Zed, Windsurf
4. **Unified Gateway** - 25+ MCP servers via single endpoint
5. **Persistent State** - PostgreSQL database for state management
6. **Auto-Import** - Migrate existing IDE configs
7. **Web UI** - Settings dashboard at localhost:5173
8. **Profile System** - Minimal/Recommended server profiles

---

## 📦 Distribution

### Homebrew (macOS)
```bash
brew tap agiletec-inc/tap
brew install airis-mcp-gateway
```

### Manual
```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway
cd airis-mcp-gateway
docker compose up -d
```

---

## 🔗 Integration Points

### MCP Servers Included
- **filesystem** - File operations
- **context7** - Library documentation
- **serena** - Project memory
- **mindbase** - Knowledge graph
- **sequential-thinking** - Multi-step reasoning
- **tavily** - Web search
- **brave-search** - Alternative search
- **github** - GitHub operations
- **stripe** - Payment APIs
- **supabase** - Database operations
- **postgresql** - PostgreSQL access
- **mongodb** - MongoDB operations
- **sqlite** - SQLite operations
- **puppeteer** - Browser automation
- **playwright** - E2E testing
- **sentry** - Error tracking
- **twilio** - SMS/Voice APIs
- **figma** - Design system access
- **notion** - Note management
- **slack** - Team communication

### IDE Integration
- Claude Desktop (via `.mcpb` extension)
- Cursor (via `~/.cursor/mcp.json`)
- Zed (via `~/.config/zed/mcp.json`)
- Windsurf (via `~/.windsurf/mcp.json`)

---

## 🎓 Learning Resources

- **SuperClaude Framework** - Global development rules
- **Makefile-First Development** - Docker-first architecture
- **XDG Compliance** - Clean Mac environment
- **Database Persistence Patterns** - SQLAlchemy best practices
- **Token Efficiency** - MCP optimization techniques

---

**Next Steps**:
1. Review `README.md` for quick start
2. Check `ARCHITECTURE.md` for system design
3. Explore `SECRETS.md` for credential setup
4. Run `airis-gateway install` to begin

**Token Savings**: Using this index saves ~54K tokens per session (93% reduction)

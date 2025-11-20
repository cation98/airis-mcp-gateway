# AIRIS MCP Gateway

Unified orchestration for the AIRIS MCP stack. This repository contains everything required to run the FastAPI backend, the Docker-facing gateway, and the Vite-based UIs that administer bundled MCP servers.

---

## 🌟 Part of the AIRIS Ecosystem

AIRIS MCP Gateway is one component of the **AIRIS Suite** - a unified toolkit that makes AI coding assistants smarter across all editors.

### The AIRIS Suite

| Component | Purpose | For Who |
|-----------|---------|---------|
| **[airis-agent](https://github.com/agiletec-inc/airis-agent)** | 🧠 Intelligence layer for all editors (confidence checks, deep research, self-review) | All developers using Claude Code, Cursor, Windsurf, Codex, Gemini CLI |
| **airis-mcp-gateway** (this repo) | 🚪 Unified MCP proxy with 90% token reduction via lazy loading | Claude Code users who want faster startup |
| **[mindbase](https://github.com/kazukinakai/mindbase)** | 💾 Local cross-session memory with semantic search | Developers who want persistent conversation history |
| **[airis-workspace](https://github.com/agiletec-inc/airis-workspace)** | 🏗️ Docker-first monorepo manager | Teams building monorepos |
| **[airiscode](https://github.com/agiletec-inc/airiscode)** | 🖥️ Terminal-first autonomous coding agent | CLI-first developers |

### MCP Servers (Included by Default)

The Gateway comes with these MCP servers pre-configured and ready to use:

| Server | Description | Tools |
|--------|-------------|-------|
| **[airis-mcp-supabase-selfhost](https://github.com/agiletec-inc/airis-mcp-supabase-selfhost)** | Self-hosted Supabase MCP with RLS support | `supabase_query`, `supabase_insert`, etc. |
| **[MindBase](https://github.com/agiletec-inc/mindbase)** | Local cross-session memory with semantic search | `mindbase_search`, `mindbase_store` |

**Note**: These servers are installed and configured automatically when you install the Gateway. No additional setup required.

### Quick Install

```bash
# 1. Clone Gateway
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway

# 2. Start the gateway
docker compose up -d

# 3. Add to Claude Code
claude mcp add --transport http airis-mcp-gateway http://api.gateway.localhost:9400/api/v1/mcp
```

### For Claude Code Users

```bash
# Add airis-agent plugin for enhanced AI capabilities
/plugin marketplace add agiletec-inc/airis-agent
/plugin install airis-agent
```

**What you get with the full suite:**
- ✅ Confidence-gated workflows (prevents wrong-direction coding)
- ✅ Deep research with evidence synthesis
- ✅ 94% token reduction via repository indexing
- ✅ Cross-session memory across all editors
- ✅ Self-review and post-implementation validation

---

## What’s Inside

- `apps/api` – FastAPI backend with Alembic migrations and pytest suites.
- `apps/settings` – Vite + React admin dashboard (now the single source of truth for managing servers, secrets, and profiles).
- `apps/desktop` / `apps/menubar` – Tauri/Node shells for desktop delivery.
- `servers/*` – Bundled MCP servers (MindBase, self-management, etc.).
- `gateway/` – Docker entrypoints and secret injection helpers.
- `config/profiles` – Declarative presets mirrored in the Settings UI.

## Requirements

| Tool | Notes |
|------|-------|
| Docker Desktop or OrbStack | Required on macOS/Windows. Docker Engine + Compose v2 for Linux. |
| `git` | Preinstalled on macOS; install via package manager elsewhere. |
| [`uv`](https://docs.astral.sh/uv/) | Used to run the lightweight editor installers outside the containers. |
| `just` | Provided by the repo; run `brew install just` or `apt install just` if missing. |

> **Why Docker-first?** Local `pnpm`, `node`, and `supabase` binaries are shims that deliberately fail. Always run commands through Docker (`just …`) to keep the host clean and ensure deterministic builds.

## Quick Start

```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway
cp .env.example .env           # adjust ports/domains if needed
docker compose pull            # optional but speeds up the first run
docker compose up -d           # builds containers and starts everything
```

The `docker compose up -d` command starts all services in detached mode. Once the stack is live:

- Gateway SSE: `http://api.gateway.localhost:9400/api/v1/mcp/sse`
- Streamable HTTP endpoint: `http://api.gateway.localhost:9400/api/v1/mcp`
- FastAPI docs: `http://api.gateway.localhost:9400/docs`
- Settings UI: `http://ui.gateway.localhost:5273`

### Add to Claude Code

```bash
# Start the Gateway first
docker compose up -d

# Add to Claude Code using official command
claude mcp add --transport http airis-mcp-gateway http://api.gateway.localhost:9400/api/v1/mcp
```

This uses Claude Code's native HTTP transport - clean and simple, no Docker bridge complexity.

## Daily Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start (or rebuild) the stack. |
| `docker compose down` | Stop containers without pruning volumes. |
| `docker compose logs -f` | Tail all service logs. |
| `docker compose ps` | Show container status. |
| `docker compose exec <service> sh` | Drop into service container shell. |

Standard Docker Compose commands for managing the Gateway stack.

## Development

```bash
# Enter service container shell
docker compose exec workspace sh    # Workspace container
docker compose exec api sh          # API development

# View logs
docker compose logs -f api          # API logs
docker compose logs -f settings     # UI logs

# Run tests
docker compose exec workspace pnpm test
```

Tips:

- Use `docker compose exec <service> sh` to access container shells
- All services run with hot reload enabled
- Backend coverage: `pytest tests/ --cov=app --cov-report=term-missing`
- Integration suites reside in `tests/integration` with fixtures in `tests/conftest.py`

## Configuration & Secrets

- `.env` controls all ports (`GATEWAY_LISTEN_PORT`, `API_LISTEN_PORT`, `WEBUI_PORT`, etc.), publish URLs, and database credentials
- Secrets entered through the Settings UI are encrypted with Fernet (`ENCRYPTION_MASTER_KEY`) and stored in Postgres; never commit `.env`
- MCP server configuration is in `mcp-config.json` - edit this file and restart the stack to apply changes
- Profiles under `config/profiles/*.yaml` define which MCP servers ship enabled by default

## Testing & Quality Gates

| Area | Command |
|------|---------|
| Backend unit tests | `docker compose exec workspace pytest tests/` |
| UI tests / lint | `docker compose exec workspace pnpm lint`, `pnpm typecheck`, `pnpm test-ui` (see `apps/settings` docs) |
| Build verification | `docker compose exec workspace pnpm build` or use `just build` inside the workspace container. |

CI mirrors these commands, so failing locally usually means an upstream failure as well.

## Troubleshooting

- **Container won't start**: `docker compose logs <service>` plus `docker system prune` often clears stale layers
- **Claude Code not seeing the gateway**: Ensure `docker compose up -d` is running and re-run `claude mcp add` command
- **Ports already in use**: adjust `*_LISTEN_PORT` values in `.env` and restart with `docker compose down && docker compose up -d`
- **MCP tools not appearing**: Check `mcp-config.json` and ensure servers are `"enabled": true`

## Contributing

1. Create a topic branch off `main`.
2. Run `pnpm lint`, `pnpm typecheck`, and `pytest tests/` as appropriate.
3. Follow Conventional Commits (`feat:`, `fix:`, etc.).
4. Include screenshots for UI changes and mention any migrations or secret-store impacts in the PR description.

Welcome aboard! 🚀

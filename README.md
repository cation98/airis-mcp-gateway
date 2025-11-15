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

### MCP Servers (Included via Gateway)

- **[airis-mcp-supabase-selfhost](https://github.com/agiletec-inc/airis-mcp-supabase-selfhost)** - Self-hosted Supabase MCP with RLS support
- **mindbase** - Memory search & storage tools (`mindbase_search`, `mindbase_store`)

### Quick Install: Complete AIRIS Suite

```bash
# Option 1: Install airis-agent plugin (recommended for Claude Code users)
/plugin marketplace add agiletec-inc/airis-agent
/plugin install airis-agent

# Option 2: Clone all AIRIS repositories at once
uv run airis-agent install-suite --profile core

# Option 3: Just use this gateway standalone (you're already here!)
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway && just up
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
just up                        # builds containers and starts everything
```

The `just up` recipe wraps `docker compose up -d` and waits for Postgres, API, and UI containers to report healthy. Once the stack is live:

- Gateway SSE: `http://api.gateway.localhost:9400/api/v1/mcp/sse`
- Streamable HTTP endpoint: `http://api.gateway.localhost:9400/api/v1/mcp`
- FastAPI docs: `http://api.gateway.localhost:9400/docs`
- Settings UI: `http://ui.gateway.localhost:5273`

### Recommended: Claude Code Official Installation

```bash
# Start the Gateway first
just up

# Add to Claude Code using official command (recommended)
claude mcp add --transport http airis-mcp-gateway http://api.gateway.localhost:9400/api/v1/mcp
```

This is the cleanest approach - uses Claude Code's native HTTP transport with no Docker bridge complexity.

### Alternative: Automated Multi-Editor Setup

Need a full reinstall with editor bindings and config regeneration? Run `just init`. It will:

1. Register Codex CLI, Claude, Cursor, and Zed through the `uv` installers.
2. Generate `mcp.json` based on `.env` and workspace paths.
3. Build API/UI/gateway containers, seed Postgres, and enable default MCP servers.

> **Heads up:** The legacy standalone WebUI has been deprecated. All MCP management now lives inside `apps/settings`, so you only need the Settings UI endpoint during development.

## Daily Commands

| Command | Description |
|---------|-------------|
| `just up` | Start (or rebuild) the stack. |
| `just down` | Stop containers without pruning volumes. |
| `just logs` | Tail all service logs. |
| `just ps` | Show container status. |
| `just workspace` | Drop into the toolchain container shell for ad‑hoc commands. |
| `just install` | Run `pnpm install` inside Docker (rarely needed thanks to cached layers). |

Shortcuts generated by `airis-workspace` let you scope tasks per app, e.g. `just dev-next dashboard`, `just dev-node api`, or `just dev-ts packages/cli`.

## Working Inside the Workspace Container

```bash
just workspace                     # opens /workspace/host/<repo>
pnpm --filter @airis/settings dev   # example command (guards enforce Docker usage)
pytest tests/                       # run backend tests against FastAPI
```

Tips:

- Use `pnpm --filter` to target specific apps or packages.
- React/Vite work happens under `apps/settings`; run `pnpm dev`, `pnpm build`, and `pnpm test` from that directory once inside the container.
- Backend coverage: `pytest tests/ --cov=app --cov-report=term-missing`.
- Integration suites reside in `tests/integration` with fixtures in `tests/conftest.py`.

## Configuration & Secrets

- `.env` controls all ports (`GATEWAY_LISTEN_PORT`, `API_LISTEN_PORT`, `WEBUI_PORT`, etc.), publish URLs, and database credentials. Uncomment `HOST_*` variables only if you run `docker compose` manually.
- `just hosts-add` / `just hosts-remove` configure `gateway*.localhost` entries so every OS resolves the same endpoints.
- Secrets entered through the Settings UI are encrypted with Fernet (`ENCRYPTION_MASTER_KEY`) and stored in Postgres; never commit `.env`.
- Profiles under `config/profiles/*.yaml` define which MCP servers ship enabled. Modify them and run `just init` (or restart the stack) to propagate changes.

## Testing & Quality Gates

| Area | Command |
|------|---------|
| Backend unit tests | `docker compose exec workspace pytest tests/` |
| UI tests / lint | `docker compose exec workspace pnpm lint`, `pnpm typecheck`, `pnpm test-ui` (see `apps/settings` docs) |
| Build verification | `docker compose exec workspace pnpm build` or use `make build` inside the workspace container. |

CI mirrors these commands, so failing locally usually means an upstream failure as well.

## Troubleshooting

- **pnpm errors**: Run through `just workspace`; never call `pnpm` on the host (shims will block it).
- **Container won’t start**: `docker compose logs <service>` plus `docker system prune` often clears stale layers.
- **Editor not seeing the gateway**: rerun `just init` to regenerate MCP configs and installers.
- **Ports already in use**: adjust `*_LISTEN_PORT` values in `.env` and recreate the stack.

## Contributing

1. Create a topic branch off `main`.
2. Run `pnpm lint`, `pnpm typecheck`, and `pytest tests/` as appropriate.
3. Follow Conventional Commits (`feat:`, `fix:`, etc.).
4. Include screenshots for UI changes and mention any migrations or secret-store impacts in the PR description.

Welcome aboard! 🚀

# 🌉 AIRIS MCP Gateway

**Unified entrypoint for 25+ MCP servers. One command, zero manual provisioning.**

---

## ⚡ Quick Start (90 seconds)

Prerequisites:
- Docker Desktop **or** OrbStack running (all services start inside containers)
- `make` / `git`
- [`uv`](https://docs.astral.sh/uv/) (used to run the lightweight editor installers; install with `brew install uv` on macOS)

```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway
cp .env.example .env        # adjust listen ports or public domains if needed
make hosts-add              # writes gateway*.localhost entries to /etc/hosts (sudo prompt)
make init                   # clean install (build, start, editor registration)
# Optional: dev profile with UI/API preview
# make install-dev
```

`make init` will:
- register Codex CLI, Claude Code, and Cursor via the Python installers executed with `uv`
- import any existing MCP configs from Claude, Cursor, or Zed and back them up
- generate `mcp.json` from `mcp.json.template` (port/env-aware)
- build the Gateway, API, UI, and bundled MCP servers
- seed the database (MindBase + Self-Management shipped by default)
- run all database migrations automatically via Alembic
- start everything in the background and print running endpoints
- auto-enable the zero-setup servers (filesystem, context7, serena, mindbase, sequential-thinking, playwright, chrome-devtools)

When it finishes you should see:
- Codex Streamable HTTP MCP → `http://api.gateway.localhost:9400/api/v1/mcp` (no trailing slash; set `CODEX_GATEWAY_BEARER_ENV` if auth is required)
- Gateway SSE endpoint → `http://api.gateway.localhost:9400/api/v1/mcp/sse` (mirrored at `http://api.gateway.localhost:9400/sse` for Claude/Cursor)
- FastAPI docs → `http://api.gateway.localhost:9400/docs`
- Settings UI → `http://ui.gateway.localhost:5273`

Need a quick health check? Run `make doctor` to verify Docker availability and toolchain shims.

---

## 🧭 Daily Driver Commands

| Command | What it does |
|---------|--------------|
| `make init` | Full reinstall: clean configs, build/start services, register every editor |
| `make install` | Dockerized pnpm install (defined in `scripts/tasks/pnpm-install.yml`) |
| `make restart` | Full stop/start cycle (no editor import) |
| `make up` | Start services only (advanced/CI use) |
| `make up-dev` | Start with internal-only networking (Docker DNS only) |
| `make down` | Stop containers, keep volumes |
| `make clean` | Stop everything and drop local volumes |
| `make logs` | Stream logs from every service |
| `make ps` | Show container status |

All commands run through docker-compose using the auto-detected workspace paths. No Homebrew tap or local Node install required.

---

## 🔧 Configuration

- `.env` centralises container listen ports (`GATEWAY_LISTEN_PORT`, `GATEWAY_STREAM_LISTEN_PORT`, `API_LISTEN_PORT`, `UI_CONTAINER_PORT`), host-published ports (e.g., `UI_LISTEN_PORT`), public domains (`GATEWAY_PUBLIC_URL`, `GATEWAY_STREAM_PUBLIC_URL`, `UI_PUBLIC_URL`, `GATEWAY_API_URL`), database credentials, and the encryption master key. Defaults work out-of-the-box; uncomment the `HOST_*` variables only if you run `docker compose` directly.
- `make hosts-add` / `make hosts-remove` manage the `/etc/hosts` entries for `gateway.localhost`, `gateway-stream.localhost`, `api.gateway.localhost`, and `ui.gateway.localhost` so every OS resolves the same endpoints without an external reverse proxy.
- `make generate-mcp-config` renders `mcp.json` from `mcp.json.template`, swapping `${GATEWAY_API_URL}` and other variables. It runs automatically inside `make init`, so no manual edits required.
- Secrets stay out of `.env`: save API keys via the Settings UI. They are encrypted with Fernet using `ENCRYPTION_MASTER_KEY` and stored in Postgres; the Gateway fetches and injects them on startup.
- Project paths are auto-detected by `make` and injected as:
  - `HOST_WORKSPACE_DIR` → parent directory containing your clones
  - `CONTAINER_WORKSPACE_ROOT` → `/workspace/host`
  - `CONTAINER_PROJECT_ROOT` → `/workspace/host/<repo>`
- Internal wiring between containers defaults to `http://api:9900` for the FastAPI service and `http://mcp-gateway:9390` for the gateway. Override with `API_INTERNAL_URL`, `MINDBASE_API_URL`, or `GATEWAY_API_URL` if your topology changes.

Need additional MCP servers? Add them via the Settings UI or edit `config/profiles/` and re-run `make init` (or `make restart` if configs stay the same).

---

## 🎛 Codex CLI Transport Notes

Codex now targets the Streamable HTTP MCP endpoint at `http://api.gateway.localhost:9400/api/v1/mcp` by default. Set these optional environment variables before running `make init` (or `make install-editors`) to fine-tune the installer:

| Variable | Purpose |
|----------|---------|
| `CODEX_GATEWAY_URL` | Override the HTTP MCP URL if you publish the API elsewhere. Must end with `/mcp` and omit the trailing slash (e.g., `https://prod.example.com/api/v1/mcp`). |
| `CODEX_GATEWAY_BEARER_ENV` | Name of an environment variable that stores the bearer token Codex should send (e.g., `CODEX_GATEWAY_BEARER_ENV=AIRIS_MCP_TOKEN`). The installer injects `bearer_token_env_var` into `~/.codex/config.toml`. |
| `CODEX_STDIO_CMD` | (Optional) Override the STDIO fallback command. By default we run `npx -y mcp-proxy stdio-to-http --target <HTTP_URL>` and add an `Authorization` header if `CODEX_GATEWAY_BEARER_ENV` is set. |

Workflow:
```bash
export AIRIS_MCP_TOKEN="<your-token>"
export CODEX_GATEWAY_BEARER_ENV=AIRIS_MCP_TOKEN
make init
```

The installer attempts HTTP first (`codex mcp add ... --url http://api.gateway.localhost:9400/api/v1/mcp`). If the endpoint returns 4xx/5xx or is unreachable, it automatically falls back to a STDIO bridge powered by `npx -y mcp-proxy stdio-to-http --target <HTTP_URL> [--header "Authorization: Bearer <token>"]`. Set `CODEX_STDIO_CMD` only if you need a different STDIO command.

---

## 🧑‍💻 Development Workflow

| Task | Command |
|------|---------|
| Install JS deps inside the toolchain shim | `make deps` |
| Run Vite dev server for Settings UI | `make dev` |
| Build all workspaces | `make build` |
| Lint / Typecheck / Test | `make lint` / `make typecheck` / `make test-ui` |
| Run backend tests | `docker compose --profile test run --rm test` |
| Enforce host-port policy | `make check-host-ports` |

The `node`, `pnpm`, and `supabase` binaries under `bin/` are shims that route into the toolchain container, so the host stays clean.

Need to run unit tests or scripts from the host? Use `uv run …` so the virtual environment stays ephemeral, or rely on the dedicated Docker profiles.

---

## 🔌 Bundled MCP Servers

Enabled by default after `make init`:
- `filesystem` – read-only access to your workspace (mounted at `/workspace/host`)
- `context7`, `serena`, `mindbase`, `sequential-thinking`, `time`, `fetch`, `git`, `memory`
- Self-Management server (dynamic enable/disable orchestration, built from `servers/self-management`)

Disabled-but-ready via UI toggle:
- Supabase self-host, Tavily, Notion, Stripe, Twilio, GitHub, Puppeteer, SQLite, etc.

Workflow: save credentials → run “Test connection” → enable. Failures are blocked automatically so the gateway stays healthy.

All containerised servers use environment-aware commands (`HOST_WORKSPACE_DIR`, `DOCKER_NETWORK`, `HOST_SUPABASE_DIR`) so they work on any machine without editing JSON.

---

## 🧀 Troubleshooting Cheats

- **Need internal-only networking** → run `make up-dev` (no host port bindings) after the initial `make init`.
- **Change internal bindings** → update `*_LISTEN_PORT` in `.env`, then `make restart`.
- **Docker daemon unavailable** → run `make doctor` for context; ensure Docker Desktop/OrbStack is running.
- **MindBase / Supabase directories missing** → create adjacent clones or override `HOST_SUPABASE_DIR` in `.env`.
- **Changing profiles** → tweak `config/profiles/*.json` or toggle servers in the UI, then hit "Restart Gateway" or call `POST /api/v1/gateway/restart`.

Still stuck? Check `make logs` for stack traces, or `docker compose ps` to confirm containers are healthy.

---

## 🤝 Contributing

- Follow Conventional Commits (`feat:`, `fix:`, etc.).
- Pair schema or server changes with the necessary Alembic migrations and tests.
- Before opening a PR run: `make lint`, `make typecheck`, and backend `pytest`.
- Include screenshots for UI adjustments and mention any secret-store or migration implications.

Enjoy a single MCP proxy that stays up even when individual servers don’t. Dispatch once, hydrate tools on demand, and keep the token budget lean. Happy shipping!

# 🌉 AIRIS MCP Gateway

**Unified entrypoint for 25+ MCP servers. One command, zero manual provisioning.**

---

## ⚡ Quick Start (90 seconds)

Prerequisites:
- Docker Desktop **or** OrbStack installed and running
- `make`, `git`, and `pnpm` (automatically vendored inside the container)

```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway
cp .env.example .env        # adjust ports if they clash
make up
```

`make up` will:
- build the Gateway, API, UI, and bundled MCP servers
- seed the database (MindBase + Self-Management shipped by default)
- start everything in the background and print the running endpoints

When it finishes you should see:
- Gateway SSE endpoint → `http://localhost:${GATEWAY_PORT:-9090}`
- FastAPI docs → `http://localhost:${API_PORT:-8001}/docs`
- Settings UI → `http://localhost:${UI_PORT:-5173}`

Need a quick health check? Run `make doctor` to verify Docker availability and toolchain shims.

---

## 🧭 Daily Driver Commands

| Command | What it does |
|---------|--------------|
| `make up` | Build + start all services (idempotent) |
| `make down` | Stop containers, keep volumes |
| `make clean` | Stop everything and drop local volumes |
| `make logs` | Stream logs from every service |
| `make ps` | Show container status |
| `make restart` | Full stop/start cycle |

All commands run through docker-compose using the auto-detected workspace paths. No Homebrew tap or local Node install required.

---

## 🔧 Configuration

- `.env` controls host ports, database credentials, and optional overrides. The defaults work out-of-the-box; uncomment the `HOST_*` variables only if you run `docker compose` directly.
- Project paths are auto-detected by `make` and injected as:
  - `HOST_WORKSPACE_DIR` → parent directory containing your clones
  - `CONTAINER_WORKSPACE_ROOT` → `/workspace/host`
  - `CONTAINER_PROJECT_ROOT` → `/workspace/host/<repo>`
- Internal wiring between containers defaults to `http://api:8000` for the FastAPI service and `http://mcp-gateway:9090` for the gateway. Override with `API_INTERNAL_URL`, `MINDBASE_API_URL`, or `GATEWAY_API_URL` if your topology changes.

Need additional MCP servers? Add them via the Settings UI or edit `profiles/` and restart with `make up`.

---

## 🧑‍💻 Development Workflow

| Task | Command |
|------|---------|
| Install JS deps inside the toolchain shim | `make deps` |
| Run Vite dev server for Settings UI | `make dev` |
| Build all workspaces | `make build` |
| Lint / Typecheck / Test | `make lint` / `make typecheck` / `make test-ui` |
| Run backend tests | `docker compose --profile test run --rm test` or `pytest tests/` |

The `node`, `pnpm`, and `supabase` binaries under `bin/` are shims that route into the toolchain container, so the host stays clean.

---

## 🔌 Bundled MCP Servers

Enabled by default after `make up`:
- `filesystem` – read-only access to your workspace (mounted at `/workspace/host`)
- `context7`, `puppeteer`, `sqlite`
- MindBase (knowledge graph) and Self-Management servers (built from `servers/`)

Disabled-but-ready via UI toggle:
- Supabase self-host, Tavily, Notion, Stripe, Twilio, GitHub, etc.

All containerised servers use environment-aware commands (`HOST_WORKSPACE_DIR`, `DOCKER_NETWORK`, `HOST_SUPABASE_DIR`) so they work on any machine without editing JSON.

---

## 🧀 Troubleshooting Cheats

- **Ports already in use** → edit `GATEWAY_PORT`, `API_PORT`, or `UI_PORT` in `.env`, then `make up`.
- **Docker daemon unavailable** → run `make doctor` for context; ensure Docker Desktop/OrbStack is running.
- **MindBase / Supabase directories missing** → create adjacent clones or override `HOST_SUPABASE_DIR` in `.env`.
- **Changing profiles** → tweak `profiles/*.json` or toggle servers in the UI, then hit “Restart Gateway” or call `POST /api/v1/gateway/restart`.

Still stuck? Check `make logs` for stack traces, or `docker compose ps` to confirm containers are healthy.

---

## 🤝 Contributing

- Follow Conventional Commits (`feat:`, `fix:`, etc.).
- Pair schema or server changes with the necessary Alembic migrations and tests.
- Before opening a PR run: `make lint`, `make typecheck`, and backend `pytest`.
- Include screenshots for UI adjustments and mention any secret-store or migration implications.

Enjoy a single MCP proxy that stays up even when individual servers don’t. Dispatch once, hydrate tools on demand, and keep the token budget lean. Happy shipping!

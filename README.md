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
cp .env.example .env        # adjust listen ports or public domains if needed
make up                     # internal-only (Docker DNS)
# Optional: publish to localhost during development
# make up-dev
```

`make up` will:
- generate `mcp.json` from `mcp.json.template` (port/env-aware)
- build the Gateway, API, UI, and bundled MCP servers
- seed the database (MindBase + Self-Management shipped by default)
- start everything in the background and print running endpoints

When it finishes you should see:
- Gateway SSE endpoint → `http://gateway.localhost:9090/sse`
- FastAPI docs → `http://gateway.localhost:9090/api/docs`
- Settings UI → `http://ui.gateway.localhost:5173`

Need a quick health check? Run `make doctor` to verify Docker availability and toolchain shims.

---

## 🧭 Daily Driver Commands

| Command | What it does |
|---------|--------------|
| `make up` | Build + start all services (internal-only networking) |
| `make up-dev` | Start with temporary localhost publishing (9090/9000/5173) |
| `make down` | Stop containers, keep volumes |
| `make clean` | Stop everything and drop local volumes |
| `make logs` | Stream logs from every service |
| `make ps` | Show container status |
| `make restart` | Full stop/start cycle |

All commands run through docker-compose using the auto-detected workspace paths. No Homebrew tap or local Node install required.

---

## 🔧 Configuration

- `.env` centralises container listen ports (`GATEWAY_LISTEN_PORT`, `API_LISTEN_PORT`, `UI_LISTEN_PORT`), public domains (`GATEWAY_PUBLIC_URL`, `UI_PUBLIC_URL`, `GATEWAY_API_URL`), database credentials, and the encryption master key. Defaults work out-of-the-box; uncomment the `HOST_*` variables only if you run `docker compose` directly.
- `make generate-mcp-config` renders `mcp.json` from `mcp.json.template`, swapping `${GATEWAY_API_URL}` and other variables. It runs automatically before `make up`, so no manual edits required.
- Secrets stay out of `.env`: save API keys via the Settings UI. They are encrypted with Fernet using `ENCRYPTION_MASTER_KEY` and stored in Postgres; the Gateway fetches and injects them on startup.
- Project paths are auto-detected by `make` and injected as:
  - `HOST_WORKSPACE_DIR` → parent directory containing your clones
  - `CONTAINER_WORKSPACE_ROOT` → `/workspace/host`
  - `CONTAINER_PROJECT_ROOT` → `/workspace/host/<repo>`
- Internal wiring between containers defaults to `http://api:9000` for the FastAPI service and `http://mcp-gateway:9090` for the gateway. Override with `API_INTERNAL_URL`, `MINDBASE_API_URL`, or `GATEWAY_API_URL` if your topology changes.

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
| Enforce host-port policy | `make check-host-ports` |

The `node`, `pnpm`, and `supabase` binaries under `bin/` are shims that route into the toolchain container, so the host stays clean.

---

## 🔌 Bundled MCP Servers

Enabled by default after `make up`:
- `filesystem` – read-only access to your workspace (mounted at `/workspace/host`)
- `context7`, `serena`, `mindbase`, `sequentialthinking`, `time`, `fetch`, `git`, `memory`
- Self-Management server (dynamic enable/disable orchestration, built from `servers/self-management`)

Disabled-but-ready via UI toggle:
- Supabase self-host, Tavily, Notion, Stripe, Twilio, GitHub, Puppeteer, SQLite, etc.

Workflow: save credentials → run “Test connection” → enable. Failures are blocked automatically so the gateway stays healthy.

All containerised servers use environment-aware commands (`HOST_WORKSPACE_DIR`, `DOCKER_NETWORK`, `HOST_SUPABASE_DIR`) so they work on any machine without editing JSON.

---

## 🧀 Troubleshooting Cheats

- **Need localhost access** → run `make up-dev` (adds temporary `ports:` bindings).
- **Change internal bindings** → update `*_LISTEN_PORT` in `.env`, then `make restart`.
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

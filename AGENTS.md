# Repository Guidelines

## Project Structure & Module Organization
- `apps/api`: FastAPI backend with `app/` domain modules and Alembic migrations. Add new routes under `app/api/endpoints` and pair schema updates with migrations.
- `apps/settings`: Vite + React admin UI; dashboard components in `src/pages/mcp-dashboard/components`, shared validation in `src/validation`.
- `apps/desktop`: Tauri wrapper; Rust commands in `src-tauri`.
- Shared Docker entrypoints live in `gateway/`, bundled MCP servers in `servers/`, profile presets in `config/profiles/`, and integration suites in `tests/`.

## Build, Test, and Development Commands
- `make deps` – bootstrap pnpm workspaces inside the Node toolchain container (alias: `make install-deps`).
- `make init` – wipe prior editor bindings, rebuild the stack, and re-register all IDEs (full reinstall).
- `make dev` – run the settings UI (`pnpm dev`) for hot reload (binds to 5273 on the host).
- `make build` / `make typecheck` / `make lint` – build artifacts, run `tsc --noEmit`, and enforce ESLint 9 rules (all containerised).
- `make test-ui` – execute pnpm-managed UI test suites in Docker.
- `make up` (localhost publishing) / `make up-dev` (internal DNS only) / `make down` / `make logs` – orchestrate the Docker stack; use `pytest tests/` for API coverage runs.
- CLI shims (`pnpm` / `node` / `supabase <cmd>`) intentionally fail and redirect to the Make targets so LLMs follow the container-first workflow.

## Coding Style & Naming Conventions
- TypeScript/React: Two-space indentation, functional components in PascalCase (e.g., `MultiFieldConfigModal.tsx`), hooks in `useCamelCase`. Validate with `pnpm lint` and `pnpm typecheck`; Tailwind utility order may stay default.
- Python (FastAPI): Four-space indentation, snake_case modules (`core/validators.py`), type hints for route contracts, and secrets handled via `core/encryption.py`. Avoid committing `.env` overrides.
- Shell scripts: Prefer lowercase names and `set -euo pipefail` when extending `scripts/` or `gateway/`.

## Testing Guidelines
- Mirror source layout under `tests/`; keep naming `test_<unit>.py` or `.tsx`. React schema tests sit in `tests/apps/settings/src/validation`.
- Run `pytest tests/ --cov=app --cov-report=term-missing` after backend changes and watch for regressions.
- Integration flows (server toggles, persistence) live in `tests/integration/`; extend fixtures in `tests/conftest.py` rather than duplicating configs.
- When UI behaviour shifts, include a quick note or screenshot and add a co-located regression test when feasible.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`) as in repository history; keep unrelated work in separate commits.
- PRs should include a short summary, linked issue or roadmap item, commands run (`make lint`, `pytest tests/`), and screenshots for UI updates.
- Flag migrations or secret-store implications in the description and request cross-package reviewers early.

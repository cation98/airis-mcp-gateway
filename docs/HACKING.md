# Hacking on AIRIS MCP Gateway

This workspace is **Docker-first** and **Makefile-driven**. Keep the host as clean as possible—install only `git`, `docker`, `docker compose`, and `make`. Tooling such as Node.js, pnpm, or the Supabase CLI lives inside Docker containers that are invoked through make targets.

## Contract (Read This First)
- **Always run commands via `make`**. Start with `make help` to discover the available entry points.
- Execute `make doctor` after cloning or whenever the toolchain changes; it verifies Docker access and the Node/pnpm versions inside the container.
- **Do not execute `pnpm`, `npm`, `node`, or `supabase` directly.** Guard scripts in `bin/` intentionally fail to keep humans and LLMs on the same path.
- Work from the repository root so volume mounts resolve correctly, and ensure `bin/` remains at the front of `PATH` (the Makefile exports this automatically).
- When you need a new workflow, add a make target that shells out to Docker Compose instead of invoking CLI tools on the host.

## Key Make Targets
| Target | What it does |
| --- | --- |
| `make help` | Lists every documented target (LLMs should read this first). |
| `make doctor` | Runs Docker connectivity checks and prints `node -v` / `pnpm -v` from the toolchain container. |
| `make init` | Resets editor configs, rebuilds the stack, and re-registers every editor (full reinstall). |
| `make deps` | Executes `pnpm install --frozen-lockfile` inside the Node service (alias: `make install-deps`). |
| `make install` | Lightweight wrapper around `apps/settings/src/tasks/install.yml` (Dockerized pnpm install only). |
| `make dev` | Launches the Vite dev server via `pnpm dev` in Docker (`DEV_PORT` defaults to 5273). |
| `make build` | Builds the entire pnpm workspace in the Node container. |
| `make lint` / `make typecheck` | Delegates ESLint and TypeScript checks to the containerised toolchain. |
| `make test-ui` | Runs `pnpm test` in Docker. |
| `make test` | Executes the existing config/API validation suite through the dedicated `test` service. |
| `make typegen` | Generates Supabase types using the Supabase CLI container (writes to `libs/types-supabase/src/index.ts`). |
| `make clean` | Stops containers and prunes development volumes. |
| `make clean-host` | Deletes any accidental host-side build artefacts (should normally be a no-op). |

The legacy operational targets (`make up`, `make init`, profile toggles, etc.) continue to work and now reuse the `$(DC)` helper so they automatically benefit from the same Docker Compose routing.

## Docker Toolchain Services
- **`node` service**: `node:24-bookworm` image mounted at `/workspace` with `node_modules` / `.pnpm-store` volumes keeping dependencies inside Docker. Every CLI target runs `corepack enable` + `corepack prepare pnpm@$(PNPM_VER)` before executing `pnpm …`, so the pnpm CLI is provisioned on-demand in the container without touching the host.
- **`supabase` service**: `ghcr.io/supabase/cli:latest` image backed by the `supabase_data` volume. Invocations go through the optional `cli` profile so missing credentials or private images never break `make up`.

Both services sit behind the Docker Compose `cli` profile, so `make up` never starts them automatically; the make targets enable the profile only for the duration of each command.

## Extending the Tooling
1. Add a Docker Compose service that wraps the tool you need and mounts the repository (reusing `UID`/`GID` environment variables if the tool writes to disk).
2. Create a make target that calls `$(DC) run --rm <service> ...` with any required environment configuration.
3. Defensively document the new target in this file so LLMs default to it.

If you absolutely must expose a raw CLI, provide a guard in `bin/` that points developers back to the appropriate make target.

## Troubleshooting
- **Docker errors**: Run `make doctor`; if it fails at the Docker step, confirm the daemon is running and you can execute `docker ps`.
- **Volume permission issues**: The make targets forward `UID`/`GID`. If files still show up as root, ensure your shell preserves these environment variables (avoid `sudo`).
- **Dev server port already in use**: Override `DEV_PORT` per invocation, e.g. `make DEV_PORT=3001 dev`.
- **Supabase typegen fails**: Verify the database container is running (`make up`) and the `supabase` service can reach it. The output directory is created automatically.
- **LLM ignores the contract**: The guard scripts will exit with guidance; remind the agent to start from `make help`.

Following this contract guarantees that humans and AI assistants share the same execution path, preventing configuration drift between environments.

# justfile for airis-mcp-gateway
# Core orchestration layer for Docker services and editor integration

project := "airis-mcp-gateway"
workspace := "workspace"

# Default recipe (show help)
default:
    @just --list

# ============================================
# Docker Management
# ============================================

# Start all services
up:
    @echo "🚀 Starting Docker services..."
    docker compose up -d
    @echo "✅ Services started"

# Rebuild (images + containers)
rebuild:
    @echo "🔁 Rebuilding Docker services..."
    docker compose up -d --build
    @echo "✅ Services rebuilt"

# Build container images
build:
    @echo "🏗️ Building Docker images..."
    docker compose build
    @echo "✅ Images built"

# Stop all services
down:
    docker compose down --remove-orphans

# Restart services
restart:
    just down
    just up

# Install dependencies (in Docker)
install:
    @echo "📦 Installing dependencies in Docker..."
    docker compose exec workspace pnpm install
    @echo "✅ Dependencies installed"

# Enter workspace shell
workspace:
    docker compose exec -it workspace sh

# Show logs
logs:
    docker compose logs -f

# Show container status
ps:
    docker compose ps

# Clean artifacts
clean:
    rm -rf ./node_modules ./dist ./.next ./build ./target
    find . -name ".DS_Store" -delete 2>/dev/null || true

# ============================================
# API & Backend Commands
# ============================================

# Show API logs only
logs-api:
    docker compose logs -f api

# Show Gateway logs only
logs-gateway:
    docker compose logs -f mcp-gateway mcp-gateway-stream

# Run backend tests (pytest in Docker)
test:
    docker compose run --rm test

# Run UI tests (vitest)
test-ui:
    docker compose exec workspace pnpm test

# Start Vite dev server on port 5273
dev:
    docker compose exec workspace pnpm --filter @airis/settings dev

# Build all TypeScript workspaces
build-all:
    docker compose exec workspace pnpm build

# ESLint all workspaces
lint:
    docker compose exec workspace pnpm lint

# Run tsc --noEmit
typecheck:
    docker compose exec workspace pnpm typecheck

# Run Alembic migrations
db-migrate:
    docker compose exec api alembic upgrade head

# PostgreSQL psql shell
db-shell:
    docker compose exec postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-airis_mcp_gateway}

# Health check (Docker daemon, toolchain verification)
doctor:
    @echo "🔍 Checking Docker..."
    @docker version >/dev/null 2>&1 && echo "✅ Docker OK" || echo "❌ Docker not running"
    @echo "🔍 Checking services..."
    @docker compose ps
    @echo "🔍 Checking API health..."
    @curl -sf http://localhost:9400/health >/dev/null 2>&1 && echo "✅ API healthy" || echo "❌ API not responding"

# Build TypeScript MCP server → dist/
mindbase-build:
    cd servers/mindbase && pnpm install && pnpm build

# Build custom servers (mindbase + self-management)
build-custom-servers:
    docker compose --profile builder up

# Stop builder containers
builder-down:
    docker compose --profile builder down

# Measure token reduction
measure-tokens:
    @echo "📊 Token measurement not yet implemented"
    @echo "Check apps/api/logs/protocol_messages.jsonl when DEBUG=true"

# ============================================
# TypeScript Library Commands
# ============================================

# Dev TypeScript library
dev-ts name:
    docker compose exec workspace pnpm --filter {{name}} dev

# Build TypeScript library
build-ts name:
    docker compose exec workspace pnpm --filter {{name}} build

# Test TypeScript library
test-ts name:
    docker compose exec workspace pnpm --filter {{name}} test

# ============================================
# Next.js Commands
# ============================================

# Dev Next.js app
dev-next name:
    docker compose exec workspace pnpm --filter {{name}} dev

# Build Next.js app
build-next name:
    docker compose exec workspace pnpm --filter {{name}} build

# Start Next.js production
start-next name:
    docker compose exec workspace pnpm --filter {{name}} start

# ============================================
# Node Service Commands
# ============================================

# Dev Node service
dev-node name:
    docker compose exec workspace pnpm --filter {{name}} dev

# Build Node service
build-node name:
    docker compose exec workspace pnpm --filter {{name}} build

# Start Node service
start-node name:
    docker compose exec workspace pnpm --filter {{name}} start

# ============================================
# Rust Commands (Cargo only, no pnpm)
# ============================================

# Build Rust project
build-rust name:
    cargo build --manifest-path {{name}}/Cargo.toml

# Build Rust release
release-rust name:
    cargo build --release --manifest-path {{name}}/Cargo.toml

# Run Rust project
run-rust name:
    cargo run --manifest-path {{name}}/Cargo.toml

# ============================================
# Docker-First Guards (Prevent Host Pollution)
# ============================================

[private]
guard tool:
    @echo "❌ ERROR: '{{tool}}' は直接使えません"
    @echo ""
    @echo "Docker-Firstアーキテクチャでは、以下を使ってください:"
    @echo "  TypeScript: just dev-ts <name>"
    @echo "  Next.js:    just dev-next <name>"
    @echo "  Node:       just dev-node <name>"
    @echo "  Rust:       just build-rust <name>"
    @echo ""
    @echo "または: just workspace → pnpm <cmd>"
    @exit 1

pnpm *args:
    @just guard pnpm

npm *args:
    @just guard npm

yarn *args:
    @just guard yarn

# ============================================
# Shortcuts (Project-Specific)
# ============================================

# Dev dashboard (nextjs)
dev-dashboard: (dev-next "dashboard")

# Dev api (node)
dev-api: (dev-node "api")

# ============================================
# Installer & Editor Management
# ============================================

# Install pnpm dependencies inside Docker
bootstrap-deps:
    uv run python scripts/run_task_from_yaml.py --file scripts/tasks/pnpm-install.yml

# Add development hostnames (run with sudo)
hosts-add:
    ./scripts/manage-hosts.sh add

# Remove development hostnames (run with sudo)
hosts-remove:
    ./scripts/manage-hosts.sh remove

# Wait for the API health endpoint
wait-gateway:
    uv run python scripts/wait_for_gateway.py

# Register editors only
install-editors:
    uv run python scripts/install_all_editors.py install

# Uninstall editor bindings
uninstall:
    uv run python scripts/install_all_editors.py uninstall

# List detected editors
list-editors:
    uv run python scripts/install_all_editors.py list

# Quick verification helper (lists detected editors, including Claude)
verify-claude:
    uv run python scripts/install_all_editors.py list

# Standard installation flow (build + start + register editors)
init:
    @echo "📥 Importing existing IDE configurations..."
    uv run python scripts/import_existing_configs.py || true
    @echo "📦 Installing workspace dependencies..."
    just bootstrap-deps
    @echo "🚢 Building and starting Docker stack..."
    docker compose up -d --build mcp-gateway mcp-gateway-stream api postgres settings-ui
    just wait-gateway
    just install-editors

# Development install (alias for init, kept for compatibility)
install-dev:
    just init

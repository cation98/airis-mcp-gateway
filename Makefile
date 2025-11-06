# ================================
# AIRIS MCP Gateway Makefile
# ================================
# Docker-First standalone project
# ================================

.DEFAULT_GOAL := help

.SHELLFLAGS := -eu -o pipefail -c
MAKEFLAGS   += --no-builtin-rules --warn-undefined-variables

# ========== Environment Settings ==========
# Load .env file for port configurations
-include .env
export

export COMPOSE_DOCKER_CLI_BUILD := 1
export DOCKER_BUILDKIT := 1
export PATH := $(PWD)/bin:$(PATH)

DC := docker compose
NODE_SVC := node
SUPA_SVC := supabase
PNPM_VER := 10.20.0
NODE_VER := 24
DEV_PORT ?= 5173
UI_CONTAINER_PORT ?= 5173
CLI_PROFILE := cli
PNPM_BOOTSTRAP := set -euo pipefail; \
	corepack enable >/dev/null 2>&1; \
	corepack prepare pnpm@$(PNPM_VER) --activate >/dev/null 2>&1;

# Auto-detect project name from directory
HOST_REPO_DIR := $(shell pwd)
REPO_NAME := $(notdir $(HOST_REPO_DIR))
HOST_WORKSPACE_DIR := $(patsubst %/,%,$(dir $(HOST_REPO_DIR)))
HOST_SUPABASE_DIR ?= $(HOST_WORKSPACE_DIR)/airis-mcp-supabase-selfhost
CONTAINER_WORKSPACE_ROOT := /workspace/host
CONTAINER_PROJECT_ROOT := $(CONTAINER_WORKSPACE_ROOT)/$(REPO_NAME)
PROJECT ?= $(REPO_NAME)

export COMPOSE_PROJECT_NAME := $(PROJECT)
export HOST_REPO_DIR
export HOST_WORKSPACE_DIR
export HOST_SUPABASE_DIR
export REPO_NAME
export CONTAINER_WORKSPACE_ROOT
export CONTAINER_PROJECT_ROOT
export DOCKER_NETWORK := $(COMPOSE_PROJECT_NAME)_default
GATEWAY_CONTAINER := airis-mcp-gateway-gateway

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
RED := \033[0;31m
NC := \033[0m

# ========== Help ==========
.PHONY: help
help:
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*##/{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo "\nProject: $(PROJECT)"

.PHONY: doctor
doctor: ## 開発前ヘルスチェック
	@echo ">> Docker reachable?"
	@docker version >/dev/null
	@echo ">> Compose services"
	@$(DC) ls || true
	@echo ">> Node $(NODE_VER) & pnpm $(PNPM_VER) inside container"
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(NODE_SVC) bash -lc '$(PNPM_BOOTSTRAP) node -v; corepack pnpm --version'

# ========== Workspace Tooling ==========

.PHONY: deps install-deps
deps install-deps: ## Node依存をコンテナ内pnpmで解決
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(NODE_SVC) bash -lc '$(PNPM_BOOTSTRAP) pnpm install --frozen-lockfile'

.PHONY: dev
dev: ## 設定UIの開発サーバー (pnpm dev)
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		-p $(DEV_PORT):$(DEV_PORT) \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(NODE_SVC) bash -lc '$(PNPM_BOOTSTRAP) pnpm dev -- --host 0.0.0.0 --port $(DEV_PORT)'

.PHONY: build
build: ## ワークスペース全体をビルド
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(NODE_SVC) bash -lc '$(PNPM_BOOTSTRAP) pnpm build'

.PHONY: lint
lint: ## ESLintを実行
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(NODE_SVC) bash -lc '$(PNPM_BOOTSTRAP) pnpm lint'

.PHONY: typecheck
typecheck: ## TypeScript型チェック
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(NODE_SVC) bash -lc '$(PNPM_BOOTSTRAP) pnpm typecheck'

.PHONY: test-ui
test-ui: ## フロントエンドテスト (pnpm test)
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(NODE_SVC) bash -lc '$(PNPM_BOOTSTRAP) pnpm test'

# ========== Supabase / Tooling ==========

.PHONY: supa-up
supa-up: ## Supabase CLIコンテナを起動
	@$(DC) --profile $(CLI_PROFILE) up -d $(SUPA_SVC)

.PHONY: supa-down
supa-down: ## Supabase CLIコンテナを停止
	@$(DC) --profile $(CLI_PROFILE) stop $(SUPA_SVC) || true

.PHONY: typegen
typegen: ## DB→TS型生成を実行
	@mkdir -p libs/types-supabase/src
	@$(DC) --profile $(CLI_PROFILE) run --rm \
		--user $$(id -u):$$(id -g) \
		-e UID=$$(id -u) -e GID=$$(id -g) \
		$(SUPA_SVC) supabase gen types typescript --local > libs/types-supabase/src/index.ts

# ========== Core Commands ==========

.PHONY: generate-mcp-config
generate-mcp-config: ## Generate mcp.json from template
	@echo "$(BLUE)Generating mcp.json from template...$(NC)"
	@envsubst < mcp.json.template > mcp.json
	@echo "$(GREEN)✅ mcp.json generated (GATEWAY_API_URL=$${GATEWAY_API_URL})$(NC)"

.PHONY: check-host-ports
check-host-ports: ## Verify source files do not reference localhost or host.docker.internal
	@scripts/check-no-host-ports.sh

.PHONY: up
up: generate-mcp-config ## Start all services with localhost publishing
	@echo "$(GREEN)Starting services with host port bindings...$(NC)"
	@$(DC) -f docker-compose.yml -f docker-compose.dev.yml up -d --build --remove-orphans
	@echo "$(GREEN)✅ All services started (localhost accessible)$(NC)"
	@echo "🔗 Gateway:     $${GATEWAY_PUBLIC_URL}"
	@echo "🚀 API (proxy): $${GATEWAY_API_URL}"
	@echo "🎨 Settings UI: $${UI_PUBLIC_URL}"
	@echo ""
	@echo "🧠 Internal DNS: http://mcp-gateway:$${GATEWAY_LISTEN_PORT}, http://api:$${API_LISTEN_PORT}, http://settings-ui:$${UI_CONTAINER_PORT}"
	@echo "💡 Need internal-only networking? Run 'make up-dev'."

.PHONY: up-dev
up-dev: generate-mcp-config ## Start all services (internal-only networking)
	@echo "$(GREEN)Starting services (internal DNS only)...$(NC)"
	@$(DC) up -d --build --remove-orphans
	@echo "$(GREEN)✅ All services started (internal mode)$(NC)"
	@echo "🔗 Gateway (internal DNS): http://mcp-gateway:$${GATEWAY_LISTEN_PORT}"
	@echo "🧠 API (internal DNS):     http://api:$${API_LISTEN_PORT}"
	@echo "🎨 UI (internal DNS):      http://settings-ui:$${UI_CONTAINER_PORT}"
	@echo ""
	@echo "💡 Need localhost access? Run 'make up'."

.PHONY: down
down: ## Stop all services
	@echo "$(YELLOW)Stopping services...$(NC)"
	@$(DC) down --remove-orphans
	@echo "$(GREEN)✅ Stopped$(NC)"

.PHONY: restart
restart: down up ## Full restart

.PHONY: logs
logs: ## Show logs (all services)
	@$(DC) logs -f

.PHONY: logs-%
logs-%: ## Show logs for specific service
	@$(DC) logs -f $*

.PHONY: ps
ps: ## Show container status
	@$(DC) ps

# ========== Clean Commands ==========

.PHONY: clean
clean: ## Stop containers & drop development volumes
	@echo "$(YELLOW)🧹 Removing containers and development volumes...$(NC)"
	@$(DC) down -v --remove-orphans
	@echo "$(GREEN)✅ Docker volumes reset$(NC)"

.PHONY: clean-host
clean-host: ## Clean Mac host garbage - ALL build artifacts should be in Docker volumes
	@echo "$(YELLOW)🧹 Cleaning Mac host garbage (Docker-First violation artifacts)...$(NC)"
	@echo "$(YELLOW)   ⚠️  These files should NOT exist on Mac host in Docker-First dev$(NC)"
	@find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name ".next" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name "build" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name "out" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name ".turbo" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name ".cache" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name ".swc" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name ".eslintcache" -type f -delete 2>/dev/null || true
	@find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
	@find . -name ".DS_Store" -type f -delete 2>/dev/null || true
	@find . -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -type f -delete 2>/dev/null || true
	@echo "$(GREEN)✅ Mac host cleaned$(NC)"
	@echo "$(GREEN)   If files were found, your Docker volume setup needs fixing!$(NC)"

.PHONY: clean-all
clean-all: ## Complete cleanup (WARNING: destroys data)
	@echo "$(YELLOW)⚠️  WARNING: This will destroy all data (volumes + host cache)$(NC)"
	@$(MAKE) clean
	@$(MAKE) clean-host
	@echo "$(GREEN)✅ Complete cleanup done$(NC)"

# ========== Info ==========

.PHONY: info
info: ## Show available MCP servers
	@echo "$(BLUE)📦 Available MCP Servers:$(NC)"
	@grep -A 2 '"mcpServers"' mcp-config.json | grep -o '"[^"]*":' | sed 's/[":,]//g' | tail -n +2

.PHONY: config
config: ## Show effective Docker Compose configuration
	@$(DC) config

# ========== Profile Management ==========

.PHONY: profile-list
profile-list: ## List available profiles
	@echo "$(BLUE)📦 Available Profiles:$(NC)"
	@echo ""
	@echo "$(GREEN)1. Recommended$(NC) (recommended.json)"
	@cat profiles/recommended.json | jq -r '.description' | sed 's/^/     /'
	@echo "     Servers: filesystem, context7, serena, mindbase"
	@echo "     Resource: ~500MB"
	@echo ""
	@echo "$(GREEN)2. Minimal$(NC) (minimal.json)"
	@cat profiles/minimal.json | jq -r '.description' | sed 's/^/     /'
	@echo "     Servers: filesystem, context7"
	@echo "     Resource: ~50MB"
	@echo ""
	@echo "$(YELLOW)Current profile:$(NC) $$($(MAKE) --no-print-directory profile-info-short)"
	@echo ""
	@echo "$(BLUE)Switch:$(NC) make profile-recommended | make profile-minimal"

.PHONY: profile-info
profile-info: ## Show current profile configuration
	@echo "$(BLUE)📊 Current Profile Configuration:$(NC)"
	@echo ""
	@if grep -q '"serena":' mcp-config.json | grep -v '__disabled'; then \
		echo "$(GREEN)✅ Profile: Recommended$(NC)"; \
		echo "   - filesystem, context7, serena, mindbase"; \
		echo "   - Memory: ~500MB"; \
		echo "   - Features: 短期+長期記憶, コード理解, LLM暴走防止"; \
	else \
		echo "$(GREEN)✅ Profile: Minimal$(NC)"; \
		echo "   - filesystem, context7"; \
		echo "   - Memory: ~50MB"; \
		echo "   - Features: 必須機能のみ"; \
	fi
	@echo ""
	@echo "$(BLUE)Active Servers:$(NC)"
	@grep -A 2 '"mcpServers"' mcp-config.json | grep -o '"[^"]*":' | sed 's/[":,]//g' | tail -n +2 | grep -v '^__' | sed 's/^/  - /'

.PHONY: profile-info-short
profile-info-short:
	@if grep -q '"serena":' mcp-config.json | grep -v '__disabled'; then \
		echo "Recommended"; \
	else \
		echo "Minimal"; \
	fi

.PHONY: profile-recommended
profile-recommended: ## Switch to Recommended profile (filesystem, context7, serena, mindbase)
	@echo "$(BLUE)🔄 Switching to Recommended profile...$(NC)"
	@if grep -q '"__disabled_serena":' mcp-config.json; then \
		sed -i '' 's/"__disabled_serena":/"serena":/g' mcp-config.json; \
		echo "$(GREEN)✅ Enabled: serena$(NC)"; \
	fi
	@if grep -q '"__disabled_mindbase":' mcp-config.json; then \
		sed -i '' 's/"__disabled_mindbase":/"mindbase":/g' mcp-config.json; \
		echo "$(GREEN)✅ Enabled: mindbase$(NC)"; \
	fi
	@echo "$(BLUE)📋 Profile: Recommended$(NC)"
	@echo "   - filesystem, context7, serena, mindbase"
	@echo "   - Memory: ~500MB"
	@echo "   - Features: 短期+長期記憶, コード理解, LLM暴走防止"
	@echo ""
	@echo "$(YELLOW)⚠️  Gateway restart required$(NC)"
	@echo "$(BLUE)Run: make restart$(NC)"

.PHONY: profile-minimal
profile-minimal: ## Switch to Minimal profile (filesystem, context7 only)
	@echo "$(BLUE)🔄 Switching to Minimal profile...$(NC)"
	@if grep -q '"serena":' mcp-config.json | grep -v '__disabled'; then \
		sed -i '' 's/"serena":/"__disabled_serena":/g' mcp-config.json; \
		echo "$(YELLOW)🔴 Disabled: serena$(NC)"; \
	fi
	@if grep -q '"mindbase":' mcp-config.json | grep -v '__disabled'; then \
		sed -i '' 's/"mindbase":/"__disabled_mindbase":/g' mcp-config.json; \
		echo "$(YELLOW)🔴 Disabled: mindbase$(NC)"; \
	fi
	@echo "$(BLUE)📋 Profile: Minimal$(NC)"
	@echo "   - filesystem, context7"
	@echo "   - Memory: ~50MB"
	@echo "   - Features: 必須機能のみ"
	@echo ""
	@echo "$(YELLOW)⚠️  Gateway restart required$(NC)"
	@echo "$(BLUE)Run: make restart$(NC)"

# ========== Settings UI ==========

.PHONY: ui-build
ui-build: ## Build Settings UI image
	@$(DC) build settings-ui
	@echo "$(GREEN)✅ Settings UI image built$(NC)"

.PHONY: ui-up
ui-up: ## Start Settings UI
	@$(DC) up -d settings-ui
	@echo "$(GREEN)✅ Settings UI started$(NC)"
	@echo "🎨 Internal URL: http://settings-ui:$${UI_CONTAINER_PORT}"
	@echo "💡 Need localhost access? Run 'make up'."

.PHONY: ui-down
ui-down: ## Stop Settings UI
	@$(DC) stop settings-ui
	@echo "$(GREEN)🛑 Settings UI stopped$(NC)"

.PHONY: ui-logs
ui-logs: ## Show Settings UI logs
	@$(DC) logs -f settings-ui

.PHONY: ui-shell
ui-shell: ## Enter Settings UI shell
	@$(DC) exec settings-ui sh

# ========== API ==========

.PHONY: api-build
api-build: ## Build API image
	@$(DC) build api
	@echo "$(GREEN)✅ API image built$(NC)"

.PHONY: api-logs
api-logs: ## Show API logs
	@$(DC) logs -f api

.PHONY: api-shell
api-shell: ## Enter API shell
	@$(DC) exec api bash


.PHONY: builder-down
builder-down:
	@$(DC) --profile builder down --remove-orphans
# ========== MindBase MCP Server ==========

.PHONY: mindbase-build
mindbase-build: ## Build MindBase MCP Server (TypeScript → dist/)
	@$(MAKE) builder-down
	@echo "$(BLUE)🔨 Building MindBase MCP Server...$(NC)"
	@$(DC) --profile builder up --build -d mindbase-builder
	@echo "$(YELLOW)⏳ Waiting for build to complete...$(NC)"
	@timeout 120 sh -c 'until [ -f servers/mindbase/dist/index.js ]; do printf "."; sleep 1; done' || (echo "$(RED)❌ Build timeout$(NC)"; exit 1)
	@echo ""
	@echo "$(GREEN)✅ MindBase MCP Server built$(NC)"
	@ls -lh servers/mindbase/dist/
	@$(DC) --profile builder stop mindbase-builder

.PHONY: mindbase-clean
mindbase-clean: ## Clean MindBase build artifacts
	@echo "$(YELLOW)🧹 Cleaning MindBase build artifacts...$(NC)"
	@rm -rf servers/mindbase/dist 2>/dev/null || true
	@echo "$(GREEN)✅ Cleaned$(NC)"

.PHONY: self-management-build
self-management-build: ## Build Self-Management MCP Server (TypeScript → dist/)
	@$(MAKE) builder-down
	@echo "$(BLUE)🔨 Building Self-Management MCP Server...$(NC)"
	@$(DC) --profile builder up --build -d self-management-builder
	@echo "$(YELLOW)⏳ Waiting for build to complete...$(NC)"
	@timeout 120 sh -c 'until [ -f servers/self-management/dist/index.js ]; do printf "."; sleep 1; done' || (echo "$(RED)❌ Build timeout$(NC)"; exit 1)
	@echo ""
	@echo "$(GREEN)✅ Self-Management MCP Server built$(NC)"
	@ls -lh servers/self-management/dist/
	@$(DC) --profile builder stop self-management-builder

.PHONY: self-management-clean
self-management-clean: ## Clean Self-Management build artifacts
	@echo "$(YELLOW)🧹 Cleaning Self-Management build artifacts...$(NC)"
	@rm -rf servers/self-management/dist 2>/dev/null || true
	@echo "$(GREEN)✅ Cleaned$(NC)"

.PHONY: build-custom-servers
build-custom-servers: ## Build bundled TypeScript MCP servers (mindbase + self-management)
	@$(MAKE) mindbase-build
	@$(MAKE) self-management-build

# ========== Database ==========

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@$(DC) exec api alembic upgrade head
	@echo "$(GREEN)✅ Database migrations applied$(NC)"

.PHONY: db-shell
db-shell: ## Enter PostgreSQL shell
	@$(DC) exec postgres psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-mcp_gateway}

# ========== Test ==========

.PHONY: test
test: ## Run tests in Docker
	@echo "$(BLUE)🧪 Running tests in Docker...$(NC)"
	@$(DC) run --rm test
	@echo "$(GREEN)✅ Tests completed$(NC)"

# ========== Token Measurement ==========

.PHONY: measure-tokens
measure-tokens: ## Measure token reduction (OpenMCP Pattern validation)
	@echo "$(BLUE)📊 Measuring token reduction...$(NC)"
	@if [ ! -f apps/api/logs/protocol_messages.jsonl ]; then \
		echo "$(RED)❌ No protocol log found$(NC)"; \
		echo ""; \
		echo "$(YELLOW)Please ensure:$(NC)"; \
		echo "  1. Gateway is running: make up"; \
		echo "  2. Claude Desktop/Code is connected"; \
		echo "  3. Some MCP operations have been performed"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Protocol log found$(NC)"
	@$(DC) --profile measurement run --rm measurement
	@echo ""
	@echo "$(GREEN)📄 Report generated:$(NC)"
	@cat docs/research/token_measurement_report.md
	@echo ""
	@echo "$(BLUE)📊 Metrics saved:$(NC) metrics/token_measurement.json"

.PHONY: measure-clear
measure-clear: ## Clear measurement logs and start fresh
	@echo "$(YELLOW)🧹 Clearing measurement logs...$(NC)"
	@rm -f apps/api/logs/protocol_messages.jsonl
	@rm -f metrics/token_measurement.json
	@rm -f docs/research/token_measurement_report.md
	@echo "$(GREEN)✅ Logs cleared - ready for new measurement$(NC)"

# ========== Claude Code Integration ==========

.PHONY: install-claude
install-claude: ## Install and register with Claude Code (one-command setup)
	@echo "$(BLUE)🌉 Installing AIRIS MCP Gateway for Claude Code...$(NC)"
	@$(MAKE) install
	@echo "$(BLUE)📝 Creating configuration symlink...$(NC)"
	@mkdir -p $(HOME)/.claude
	@if [ -f $(HOME)/.claude/mcp.json ] && [ ! -L $(HOME)/.claude/mcp.json ]; then \
		BACKUP="$(HOME)/.claude/mcp.json.backup.$$(date +%Y%m%d_%H%M%S)"; \
		echo "$(YELLOW)⚠️  Backing up existing config to: $$BACKUP$(NC)"; \
		cp $(HOME)/.claude/mcp.json $$BACKUP; \
	fi
	@rm -f $(HOME)/.claude/mcp.json
	@ln -s $(PWD)/mcp.json $(HOME)/.claude/mcp.json
	@echo "$(GREEN)✅ Configuration symlink created$(NC)"
	@echo ""
	@echo "$(GREEN)🎉 Installation complete!$(NC)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "$(BLUE)Next Steps:$(NC)"
	@echo "  1. $(YELLOW)Restart Claude Code completely$(NC)"
	@echo "  2. Run: $(BLUE)/mcp$(NC)"
	@echo "  3. Verify: $(GREEN)airis-mcp-gateway$(NC) appears in list"
	@echo ""
	@echo "$(BLUE)Tip: $(NC)Future updates can use $(BLUE)make install$(NC) directly."
	@echo ""
	@echo "$(BLUE)Access URLs:$(NC)"
	@echo "  Gateway:     $${GATEWAY_PUBLIC_URL}"
	@echo "  Settings UI: $${UI_PUBLIC_URL}"
	@echo "  API Docs:    $${GATEWAY_API_URL}/docs"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

.PHONY: uninstall-claude
uninstall-claude: ## Uninstall from Claude Code
	@echo "$(YELLOW)🗑️  Removing Claude Code configuration...$(NC)"
	@rm -f $(HOME)/.claude/mcp.json
	@echo "$(GREEN)✅ Configuration removed$(NC)"
	@$(MAKE) down
	@echo "$(GREEN)✅ Gateway stopped$(NC)"
	@echo ""
	@echo "$(GREEN)🎉 Uninstalled successfully$(NC)"

.PHONY: verify-claude
verify-claude: ## Verify Claude Code installation
	@echo "$(BLUE)🔍 Verifying installation...$(NC)"
	@echo ""
	@echo "Checking Claude config..."
	@if [ -L $(HOME)/.claude/mcp.json ]; then \
		echo "$(GREEN)✅ Symlink exists: $(HOME)/.claude/mcp.json$(NC)"; \
		echo "   → $$(readlink $(HOME)/.claude/mcp.json)"; \
	elif [ -f $(HOME)/.claude/mcp.json ]; then \
		echo "$(GREEN)✅ Config file present (direct copy)$(NC)"; \
	else \
		echo "$(RED)❌ Claude config not found$(NC)"; \
		exit 1; \
	fi
	@echo ""
	@echo "Checking Gateway status..."
	@if docker inspect $(GATEWAY_CONTAINER) > /dev/null 2>&1; then \
		STATUS=$$(docker inspect --format '{{.State.Health.Status}}' $(GATEWAY_CONTAINER) 2>/dev/null || echo "no-healthcheck"); \
		if [ "$$STATUS" = "healthy" ]; then \
			echo "$(GREEN)✅ Gateway is healthy$(NC)"; \
		else \
			echo "$(YELLOW)⚠️  Gateway status: $$STATUS$(NC)"; \
		fi; \
	else \
		echo "$(RED)❌ Gateway not running$(NC)"; \
		exit 1; \
	fi
	@echo ""
	@echo "Checking connectivity..."
	@if curl -sf $${GATEWAY_PUBLIC_URL}/ > /dev/null; then \
		echo "$(GREEN)✅ Gateway responding at $${GATEWAY_PUBLIC_URL}$(NC)"; \
	else \
		echo "$(RED)❌ Gateway not responding$(NC)"; \
		exit 1; \
	fi
	@echo ""
	@echo "$(GREEN)🎉 All checks passed!$(NC)"
	@echo ""
	@echo "$(BLUE)Next: Restart Claude Code and run /mcp$(NC)"

# ========== Installation ==========

.PHONY: install-editors
install-editors: ## Synchronize MCP configs across editors
	@echo "$(BLUE)📝 Syncing MCP configs with editors...$(NC)"
	@uv run scripts/install_all_editors.py install

.PHONY: install
install: ## Install AIRIS Gateway (imports existing IDE configs automatically)
	@echo "$(BLUE)🌉 Installing AIRIS Gateway...$(NC)"
	@echo ""
	@echo "$(YELLOW)🛠️  Step 1: Building bundled MCP servers (mindbase, self-management)...$(NC)"
	@$(MAKE) build-custom-servers
	@echo ""
	@echo "$(YELLOW)📥 Step 2: Importing existing IDE configurations...$(NC)"
	@uv run scripts/import_existing_configs.py || true
	@echo ""
	@echo "$(YELLOW)🚀 Step 3: Starting Gateway...$(NC)"
	@$(MAKE) up
	@echo "$(YELLOW)⏳ Waiting for Gateway to become healthy (max 60s)...$(NC)"
	@timeout 60 sh -c 'until docker inspect --format "{{.State.Health.Status}}" $(GATEWAY_CONTAINER) 2>/dev/null | grep -q "healthy"; do printf "."; sleep 1; done' || (echo "$(RED)❌ Gateway failed to become healthy$(NC)"; exit 1)
	@echo ""
	@echo "$(GREEN)✅ Gateway healthy$(NC)"
	@echo ""
	@echo "$(YELLOW)📝 Step 4: Registering with editors...$(NC)"
	@$(MAKE) install-editors
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "$(GREEN)🎉 Installation complete!$(NC)"
	@echo ""
	@echo "$(BLUE)What was imported:$(NC)"
	@cat /tmp/airis_import_summary.txt 2>/dev/null | grep -A 20 "Found MCP Servers" || echo "  No existing configs found (fresh install)"
	@echo ""
	@echo "$(BLUE)Next Steps:$(NC)"
	@echo "  1. $(YELLOW)Restart ALL editors$(NC) (Claude Desktop, Cursor, Zed, etc.)"
	@echo "  2. Test MCP tools - all share unified Gateway!"
	@echo ""
	@echo "$(BLUE)Access URLs:$(NC)"
	@echo "  Gateway:     $${GATEWAY_PUBLIC_URL}"
	@echo "  Settings UI: $${UI_PUBLIC_URL}"
	@echo "  API Docs:    $${GATEWAY_API_URL}/docs"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

.PHONY: install-dev
install-dev: ## Install with UI/API (development mode, imports existing configs)
	@echo "$(BLUE)🔧 Installing AIRIS Gateway (Development Mode)...$(NC)"
	@echo "$(GREEN)   ✅ Gateway + Settings UI + FastAPI$(NC)"
	@echo ""
	@echo "$(YELLOW)🛠️  Step 1: Building bundled MCP servers (mindbase, self-management)...$(NC)"
	@$(MAKE) build-custom-servers
	@echo ""
	@echo "$(YELLOW)📥 Step 2: Importing existing IDE configurations...$(NC)"
	@uv run scripts/import_existing_configs.py || true
	@echo ""
	@echo "$(YELLOW)🚀 Step 3: Starting all services...$(NC)"
	@$(MAKE) up
	@echo "$(YELLOW)⏳ Waiting for all services (max 60s)...$(NC)"
	@timeout 60 sh -c "until $(DC) ps | grep -q 'healthy.*healthy.*healthy'; do printf '.'; sleep 1; done" || (echo "$(YELLOW)⚠️  Some services might not be healthy yet$(NC)")
	@echo ""
	@echo "$(GREEN)✅ Services started$(NC)"
	@echo ""
	@echo "$(YELLOW)📝 Step 4: Registering with editors...$(NC)"
	@$(MAKE) install-editors
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "$(GREEN)🎉 Development Mode Active$(NC)"
	@echo ""
	@echo "$(BLUE)What was imported:$(NC)"
	@cat /tmp/airis_import_summary.txt 2>/dev/null | grep -A 20 "Found MCP Servers" || echo "  No existing configs found (fresh install)"
	@echo ""
	@echo "$(GREEN)Web Dashboard:$(NC)"
	@echo "  🎨 Settings UI: $${UI_PUBLIC_URL}"
	@echo "  📊 API Docs:    $${GATEWAY_API_URL}/docs"
	@echo "  🔗 Gateway:     $${GATEWAY_PUBLIC_URL}"
	@echo ""
	@echo "$(BLUE)Features:$(NC)"
	@echo "  - Toggle MCP servers ON/OFF via UI"
	@echo "  - Manage API keys with encryption"
	@echo "  - Real-time server status monitoring"
	@echo "  - Gateway restart API endpoint"
	@echo ""
	@echo "$(BLUE)Next Steps:$(NC)"
	@echo "  1. $(YELLOW)Restart ALL editors$(NC)"
	@echo "  2. Open $${UI_PUBLIC_URL} to customize"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

.PHONY: install-import
install-import: ## Import existing IDE MCP configs and merge into AIRIS Gateway
	@echo "$(BLUE)📥 Importing existing IDE configurations...$(NC)"
	@echo ""
	@uv run scripts/import_existing_configs.py
	@echo ""
	@echo "$(GREEN)✅ Import complete$(NC)"
	@echo "$(BLUE)🌉 Installing AIRIS Gateway with merged configuration...$(NC)"
	@$(MAKE) install
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "$(GREEN)🎉 Your existing MCP servers are now unified!$(NC)"
	@echo ""
	@echo "$(BLUE)What was imported:$(NC)"
	@cat /tmp/airis_import_summary.txt 2>/dev/null || echo "  (See import log above)"
	@echo ""
	@echo "$(BLUE)Next: Restart editors and enjoy unified Gateway!$(NC)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

.PHONY: uninstall
uninstall: ## Uninstall AIRIS Gateway and restore original editor configs
	@echo "$(YELLOW)🗑️  Uninstalling AIRIS Gateway...$(NC)"
	@uv run scripts/install_all_editors.py uninstall
	@$(MAKE) down
	@echo ""
	@echo "$(GREEN)🎉 Uninstalled successfully$(NC)"

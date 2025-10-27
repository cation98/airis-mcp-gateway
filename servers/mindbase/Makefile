# ================================
# MindBase MCP Server Makefile
# ================================
# Docker-First development
# All operations in containers
# ================================

.DEFAULT_GOAL := help

# ========== Environment Settings ==========
export COMPOSE_DOCKER_CLI_BUILD := 1
export DOCKER_BUILDKIT := 1

# Project settings
PROJECT := mindbase-mcp-server
MINDBASE_API_URL ?= http://mindbase-api:18002

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

# ========== Help ==========
.PHONY: help
help:
	@echo ""
	@echo "$(BLUE)MindBase MCP Server Commands:$(NC)"
	@echo "  $(GREEN)build$(NC)              - Build MCP server (TypeScript → JavaScript)"
	@echo "  $(GREEN)install$(NC)            - Install dependencies in Docker"
	@echo "  $(GREEN)dev$(NC)                - Watch mode (auto-rebuild on changes)"
	@echo "  $(GREEN)test$(NC)               - Test connection to MindBase API"
	@echo "  $(GREEN)clean$(NC)              - Remove build artifacts (dist/, node_modules/ on Mac)"
	@echo ""
	@echo "$(YELLOW)Current API:$(NC) $(MINDBASE_API_URL)"
	@echo ""

# ========== Build Commands ==========

.PHONY: build
build: ## Build TypeScript → JavaScript
	@echo "$(GREEN)Building MindBase MCP Server...$(NC)"
	@docker run --rm \
		-v "$(PWD):/app" \
		-w /app \
		node:22-alpine \
		sh -c "corepack enable && pnpm install && pnpm build"
	@echo "$(GREEN)✅ Build complete → dist/$(NC)"

.PHONY: install
install: ## Install dependencies in Docker
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@docker run --rm \
		-v "$(PWD):/app" \
		-w /app \
		node:22-alpine \
		sh -c "corepack enable && pnpm install --frozen-lockfile"
	@echo "$(GREEN)✅ Dependencies installed$(NC)"

.PHONY: dev
dev: ## Watch mode (auto-rebuild)
	@echo "$(BLUE)Starting watch mode...$(NC)"
	@docker run --rm -it \
		-v "$(PWD):/app" \
		-w /app \
		node:22-alpine \
		sh -c "corepack enable && pnpm install && pnpm dev"

# ========== Test ==========

.PHONY: test
test: ## Test MindBase API connection
	@echo "$(BLUE)Testing MindBase API connection...$(NC)"
	@echo "$(YELLOW)API URL: $(MINDBASE_API_URL)$(NC)"
	@curl -s -f $(MINDBASE_API_URL)/health > /dev/null 2>&1 && \
		echo "$(GREEN)✅ MindBase API is healthy$(NC)" || \
		echo "$(YELLOW)⚠️  MindBase API not responding. Start with: cd ~/github/mindbase && make up$(NC)"

# ========== Clean ==========

.PHONY: clean
clean: ## Clean Mac host garbage (Docker-First violation artifacts)
	@echo "$(YELLOW)🧹 Cleaning Mac host artifacts...$(NC)"
	@echo "$(YELLOW)   ⚠️  These files should NOT exist on Mac host in Docker-First dev$(NC)"
	@rm -rf node_modules dist 2>/dev/null || true
	@find . -name ".DS_Store" -type f -delete 2>/dev/null || true
	@find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
	@echo "$(GREEN)✅ Mac host cleaned$(NC)"
	@echo "$(GREEN)   If files were found, your Docker volume setup needs fixing!$(NC)"

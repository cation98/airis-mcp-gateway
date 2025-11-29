#!/bin/bash
# quick-install.sh - One-liner installer for AIRIS MCP Gateway
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/agiletec-inc/airis-mcp-gateway/main/scripts/quick-install.sh)

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="${AIRIS_INSTALL_DIR:-$HOME/.airis-mcp-gateway}"
REPO_URL="https://github.com/agiletec-inc/airis-mcp-gateway.git"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           AIRIS MCP Gateway - Quick Install                ║"
echo "║     90% token reduction for Claude Code & Cursor           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Check prerequisites
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo ""
    echo "Please install Docker first:"
    echo "  macOS:   brew install --cask docker"
    echo "  Linux:   https://docs.docker.com/engine/install/"
    echo "  Windows: https://docs.docker.com/desktop/windows/install/"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo -e "${RED}❌ Git not found${NC}"
    echo "Please install git first."
    exit 1
fi

echo -e "${GREEN}✅ Docker and Git found${NC}"

# Step 2: Clone or update repository
echo -e "${BLUE}[2/5] Setting up repository...${NC}"

if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Repository exists at $INSTALL_DIR"
    echo "Pulling latest changes..."
    cd "$INSTALL_DIR"
    git pull --ff-only || {
        echo -e "${YELLOW}⚠️ Could not pull (local changes?). Continuing with existing version.${NC}"
    }
else
    echo "Cloning to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo -e "${GREEN}✅ Repository ready${NC}"

# Step 3: Run main install script
echo -e "${BLUE}[3/5] Running installation...${NC}"
bash "$INSTALL_DIR/scripts/install.sh"

# Step 4: Wait for health check
echo -e "${BLUE}[4/5] Waiting for gateway to be ready...${NC}"

MAX_ATTEMPTS=30
ATTEMPT=0
HEALTH_URL="http://api.gateway.localhost:9400/health"

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Gateway is healthy${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -n "."
    sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo ""
    echo -e "${YELLOW}⚠️ Gateway health check timed out${NC}"
    echo "The gateway may still be starting. Check: docker compose logs"
fi

# Step 5: Register with Claude Code
echo -e "${BLUE}[5/5] Registering with Claude Code...${NC}"

if command -v claude >/dev/null 2>&1; then
    # Check if already registered
    if claude mcp list 2>/dev/null | grep -q "airis-mcp-gateway"; then
        echo -e "${GREEN}✅ Already registered with Claude Code${NC}"
    else
        claude mcp add --transport http airis-mcp-gateway http://api.gateway.localhost:9400/api/v1/mcp 2>/dev/null && \
            echo -e "${GREEN}✅ Registered with Claude Code${NC}" || \
            echo -e "${YELLOW}⚠️ Could not register with Claude Code (may already exist)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Claude Code CLI not found${NC}"
    echo "To register manually, run:"
    echo "  claude mcp add --transport http airis-mcp-gateway http://api.gateway.localhost:9400/api/v1/mcp"
fi

# Done
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               ✅ Installation Complete!                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "📍 Installed to: $INSTALL_DIR"
echo ""
echo "🔗 Access URLs:"
echo "   Gateway API:   http://api.gateway.localhost:9400"
echo "   Settings UI:   http://ui.gateway.localhost:5273"
echo "   Health Check:  http://api.gateway.localhost:9400/health"
echo ""
echo "🛠️  Useful commands:"
echo "   cd $INSTALL_DIR && docker compose ps      # Check status"
echo "   cd $INSTALL_DIR && docker compose logs -f # View logs"
echo "   cd $INSTALL_DIR && docker compose down    # Stop services"
echo "   cd $INSTALL_DIR && git pull && docker compose up -d --build  # Update"
echo ""
echo "📚 Next steps:"
echo "   1. Restart Claude Code / Cursor / your IDE"
echo "   2. Start using confidence_check, deep_research, and 25+ MCP tools"
echo ""

#!/bin/bash
# install.sh - Unified setup for AIRIS MCP Gateway
# Usage: ./install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_DIR="$(dirname "$SCRIPT_DIR")"
cd "$GATEWAY_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌉 AIRIS MCP Gateway Installation${NC}"
echo ""

# Step 1: Check prerequisites
echo "Checking prerequisites..."
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Step 2: Generate .env if not exists
if [ ! -f "$GATEWAY_DIR/.env" ]; then
    echo -e "${BLUE}📝 Creating .env from .env.example...${NC}"
    cp "$GATEWAY_DIR/.env.example" "$GATEWAY_DIR/.env"

    # Add dynamic paths
    echo "" >> "$GATEWAY_DIR/.env"
    echo "# Auto-generated paths ($(date))" >> "$GATEWAY_DIR/.env"
    echo "HOST_REPO_DIR=$GATEWAY_DIR" >> "$GATEWAY_DIR/.env"
    echo "HOST_WORKSPACE_DIR=$(dirname "$GATEWAY_DIR")" >> "$GATEWAY_DIR/.env"
    echo -e "${GREEN}✅ .env created${NC}"
else
    echo -e "${GREEN}✅ .env already exists${NC}"
fi

# Step 3: Create required .env files for services
echo -e "${BLUE}📝 Creating service .env files...${NC}"

# apps/api/.env
if [ ! -f "$GATEWAY_DIR/apps/api/.env" ]; then
    if [ -f "$GATEWAY_DIR/apps/api/.env.example" ]; then
        cp "$GATEWAY_DIR/apps/api/.env.example" "$GATEWAY_DIR/apps/api/.env"
    else
        touch "$GATEWAY_DIR/apps/api/.env"
    fi
fi

# apps/settings/.env
if [ ! -f "$GATEWAY_DIR/apps/settings/.env" ]; then
    if [ -f "$GATEWAY_DIR/apps/settings/.env.example" ]; then
        cp "$GATEWAY_DIR/apps/settings/.env.example" "$GATEWAY_DIR/apps/settings/.env"
    else
        touch "$GATEWAY_DIR/apps/settings/.env"
    fi
fi


# servers/mindbase/.env (if directory exists)
if [ -d "$GATEWAY_DIR/servers/mindbase" ] && [ ! -f "$GATEWAY_DIR/servers/mindbase/.env" ]; then
    if [ -f "$GATEWAY_DIR/servers/mindbase/.env.example" ]; then
        cp "$GATEWAY_DIR/servers/mindbase/.env.example" "$GATEWAY_DIR/servers/mindbase/.env"
    else
        touch "$GATEWAY_DIR/servers/mindbase/.env"
    fi
fi

# servers/airis-mcp-gateway-control/.env (if directory exists)
if [ -d "$GATEWAY_DIR/servers/airis-mcp-gateway-control" ] && [ ! -f "$GATEWAY_DIR/servers/airis-mcp-gateway-control/.env" ]; then
    if [ -f "$GATEWAY_DIR/servers/airis-mcp-gateway-control/.env.example" ]; then
        cp "$GATEWAY_DIR/servers/airis-mcp-gateway-control/.env.example" "$GATEWAY_DIR/servers/airis-mcp-gateway-control/.env"
    else
        touch "$GATEWAY_DIR/servers/airis-mcp-gateway-control/.env"
    fi
fi

echo -e "${GREEN}✅ Service .env files created${NC}"

# Step 4: Load environment
set -a
source "$GATEWAY_DIR/.env"
set +a

export HOST_REPO_DIR="${HOST_REPO_DIR:-$GATEWAY_DIR}"
export HOST_WORKSPACE_DIR="${HOST_WORKSPACE_DIR:-$(dirname "$GATEWAY_DIR")}"
export GATEWAY_PUBLIC_URL="${GATEWAY_PUBLIC_URL:-http://gateway.localhost:9390}"
export GATEWAY_API_URL="${GATEWAY_API_URL:-http://api.gateway.localhost:9400/api}"
export UI_PUBLIC_URL="${UI_PUBLIC_URL:-http://ui.gateway.localhost:5273}"

# Step 5: Start Docker containers
echo ""
echo -e "${BLUE}🚀 Starting Docker containers...${NC}"
if docker compose up -d; then
    echo -e "${GREEN}✅ Docker containers started${NC}"
else
    status=$?
    echo -e "${RED}❌ Failed to start Docker containers (exit code: ${status})${NC}"
    echo "Check Docker status and re-run this script."
    exit "$status"
fi

# Step 6: Configure editors (optional)
echo ""
echo -e "${BLUE}🔧 Configuring editors...${NC}"
if command -v python3 >/dev/null 2>&1; then
    if python3 "$GATEWAY_DIR/scripts/install_all_editors.py"; then
        echo -e "${GREEN}✅ Editors configured${NC}"
    else
        echo -e "${YELLOW}⚠️ Editor configuration skipped (script failed)${NC}"
    fi
elif command -v python >/dev/null 2>&1; then
    if python "$GATEWAY_DIR/scripts/install_all_editors.py"; then
        echo -e "${GREEN}✅ Editors configured${NC}"
    else
        echo -e "${YELLOW}⚠️ Editor configuration skipped (script failed)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Python not found - skipping editor configuration${NC}"
    echo "Run 'python scripts/install_all_editors.py' manually to configure editors."
fi

# Done
echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart your editors (Claude Code, Cursor, Zed, etc.)"
echo "  2. Test MCP tools in any editor"
echo "  3. Access Settings UI: ${UI_PUBLIC_URL}"
echo ""
echo "Useful commands:"
echo "  docker compose ps       # Check status"
echo "  docker compose logs -f  # View logs"
echo "  docker compose down     # Stop containers"

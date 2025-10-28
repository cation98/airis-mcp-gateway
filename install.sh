#!/bin/bash
# install.sh - One-command AIRIS MCP Gateway installation for Claude Code
# Usage: ./install.sh

set -euo pipefail

GATEWAY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_CONFIG="$HOME/.claude/mcp.json"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌉 AIRIS MCP Gateway Installation${NC}"
echo ""

# Step 1: Check Docker
echo "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Please install Docker: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Step 2: Check if already running
if docker ps --format '{{.Names}}' | grep -q "^airis-mcp-gateway$"; then
    echo -e "${YELLOW}⚠️  Gateway is already running${NC}"
    read -p "Do you want to restart it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Restarting Gateway..."
        cd "$GATEWAY_DIR"
        docker compose restart
    fi
else
    # Step 3: Start Gateway
    echo "Starting Gateway..."
    cd "$GATEWAY_DIR"
    docker compose up -d
    echo -e "${GREEN}✅ Gateway starting${NC}"
fi

# Step 4: Wait for healthy
echo "Waiting for Gateway to become healthy (max 60s)..."
for i in {1..60}; do
    STATUS=$(docker inspect --format '{{.State.Health.Status}}' airis-mcp-gateway 2>/dev/null || echo "starting")
    if [ "$STATUS" == "healthy" ]; then
        echo -e "${GREEN}✅ Gateway healthy${NC}"
        break
    fi
    printf "."
    sleep 1
    if [ $i -eq 60 ]; then
        echo ""
        echo -e "${RED}❌ Gateway failed to become healthy${NC}"
        echo "Check logs: docker logs airis-mcp-gateway"
        exit 1
    fi
done
echo ""

# Step 5: Create symlink
echo "Configuring Claude Code..."
mkdir -p "$(dirname "$MCP_CONFIG")"
if [ -e "$MCP_CONFIG" ] || [ -L "$MCP_CONFIG" ]; then
    # Backup existing config
    if [ ! -L "$MCP_CONFIG" ] && [ -f "$MCP_CONFIG" ]; then
        BACKUP="$MCP_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${YELLOW}⚠️  Backing up existing config to: $BACKUP${NC}"
        cp "$MCP_CONFIG" "$BACKUP"
    fi
    rm -f "$MCP_CONFIG"
fi
ln -s "$GATEWAY_DIR/mcp.json" "$MCP_CONFIG"
echo -e "${GREEN}✅ Configuration symlink created${NC}"

# Step 6: Verify
echo "Verifying installation..."
if curl -sf "$GATEWAY_PUBLIC_URL/" > /dev/null; then
    echo -e "${GREEN}✅ Gateway responding${NC}"
else
    echo -e "${YELLOW}⚠️  Gateway may need more time to start${NC}"
    echo "Wait a moment and check: curl $GATEWAY_PUBLIC_URL/"
fi

# Step 7: Display container status
echo ""
echo "Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|airis"

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. ${YELLOW}Restart Claude Code completely${NC}"
echo "  2. Run: ${BLUE}/mcp${NC}"
echo "  3. Verify: ${GREEN}airis-mcp-gateway${NC} appears in the list"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  Gateway:     $GATEWAY_PUBLIC_URL"
echo "  Settings UI: $UI_PUBLIC_URL"
echo "  API Docs:    $GATEWAY_API_URL/docs"
echo ""
echo "💡 Want internal-only mode? Run 'make up-dev' in the repository."
echo ""
echo -e "${BLUE}Management Commands:${NC}"
echo "  Status:   ${BLUE}docker ps${NC}"
echo "  Logs:     ${BLUE}docker logs airis-mcp-gateway${NC}"
echo "  Restart:  ${BLUE}docker compose restart${NC}"
echo "  Stop:     ${BLUE}docker compose down${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "$GATEWAY_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$GATEWAY_DIR/.env"
    set +a
fi

GATEWAY_PUBLIC_URL="${GATEWAY_PUBLIC_URL:-http://gateway.localhost:9090}"
UI_PUBLIC_URL="${UI_PUBLIC_URL:-http://ui.gateway.localhost:5173}"
GATEWAY_API_URL="${GATEWAY_API_URL:-http://gateway.localhost:9090/api}"

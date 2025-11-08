#!/bin/bash
# install.sh - Delegates to `make install` for a unified setup experience.
# Usage: ./install.sh

set -euo pipefail

GATEWAY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$GATEWAY_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌉 AIRIS MCP Gateway Installation${NC}"
echo ""

# Load optional .env overrides before running make
if [ -f "$GATEWAY_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$GATEWAY_DIR/.env"
    set +a
fi

export GATEWAY_PUBLIC_URL="${GATEWAY_PUBLIC_URL:-http://gateway.localhost:9390}"
export GATEWAY_API_URL="${GATEWAY_API_URL:-http://api.gateway.localhost:9400/api}"
export UI_PUBLIC_URL="${UI_PUBLIC_URL:-http://ui.gateway.localhost:5173}"

echo "Checking prerequisites..."
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

echo ""
echo -e "${BLUE}🚀 Running unified installer (make install)...${NC}"
echo ""

if make install; then
    echo ""
    echo -e "${GREEN}🎉 All done!${NC}"
    echo "👉 For future installs, run ${BLUE}make install${NC} directly."
else
    status=$?
    echo ""
    echo -e "${RED}❌ Installation failed (exit code: ${status})${NC}"
    echo "Check Docker status and re-run this script once resolved."
    exit "$status"
fi

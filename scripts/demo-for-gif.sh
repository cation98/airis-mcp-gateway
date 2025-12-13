#!/bin/bash
# Demo script for recording GIF
# Run this script and record with Kap/CleanShot X

set -e
cd "$(dirname "$0")/.."

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear

echo -e "${CYAN}# AIRIS MCP Gateway - Quick Start${NC}"
echo ""
sleep 1

# Step 1: Start
echo -e "${YELLOW}$ docker compose up -d${NC}"
sleep 0.5
docker compose up -d 2>&1
sleep 1

# Step 2: Show logs
echo ""
echo -e "${YELLOW}$ docker compose logs --tail 20${NC}"
sleep 0.5
docker compose logs --tail 20 2>&1 | tail -15
sleep 1

# Step 3: Register command
echo ""
echo -e "${YELLOW}$ claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse${NC}"
sleep 0.5
echo -e "${GREEN}Added sse server airis-mcp-gateway for user with url: http://localhost:9400/sse${NC}"
sleep 1

# Done
echo ""
echo -e "${GREEN}Done! 34+ tools ready.${NC}"
sleep 2

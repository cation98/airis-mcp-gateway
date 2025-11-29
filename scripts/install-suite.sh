#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# AIRIS OSS Suite - Unified Installer
# ─────────────────────────────────────────────────────────────
# Installs all AIRIS OSS repositories in one command.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/agiletec-inc/airis-mcp-gateway/main/scripts/install-suite.sh | bash
#
# Or with options:
#   bash install-suite.sh --root ~/airis --up
#
# Options:
#   --root <dir>    Install directory (default: ~/airis-suite)
#   --update        Pull latest if repo exists
#   --up            Start docker compose after install
#   --minimal       Only install airis-mcp-gateway
#   --ssh           Use SSH for git clone (default: HTTPS)
#   --help          Show this help
# ─────────────────────────────────────────────────────────────

ROOT="${HOME}/airis-suite"
DO_UPDATE=false
DO_UP=false
MINIMAL=false
USE_SSH=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

say()  { echo -e "${BLUE}➤${NC} $*"; }
ok()   { echo -e "  ${GREEN}✔${NC} $*"; }
warn() { echo -e "  ${YELLOW}!${NC} $*"; }
err()  { echo -e "  ${RED}✖${NC} $*" >&2; }
die()  { err "$*"; exit 1; }

usage() {
  cat << 'EOF'
AIRIS OSS Suite - Unified Installer

Installs all AIRIS OSS repositories in one command.

Usage:
  curl -fsSL https://raw.githubusercontent.com/agiletec-inc/airis-mcp-gateway/main/scripts/install-suite.sh | bash

Or with options:
  bash install-suite.sh --root ~/airis --up

Options:
  --root <dir>    Install directory (default: ~/airis-suite)
  --update        Pull latest if repo exists
  --up            Start docker compose after install
  --minimal       Only install airis-mcp-gateway
  --ssh           Use SSH for git clone (default: HTTPS)
  --help          Show this help

Repositories installed:
  - airis-mcp-gateway    MCP unified gateway (25+ servers)
  - airiscode            Terminal coding agent (local Ollama)
  - airis-workspace      Monorepo management tools
  - airis-agent          MCP custom agent
EOF
  exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)    ROOT="$2"; shift 2 ;;
    --update)  DO_UPDATE=true; shift ;;
    --up)      DO_UP=true; shift ;;
    --minimal) MINIMAL=true; shift ;;
    --ssh)     USE_SSH=true; shift ;;
    -h|--help) usage ;;
    *) die "Unknown option: $1" ;;
  esac
done

# Check prerequisites
command -v git >/dev/null 2>&1 || die "git is required"
command -v docker >/dev/null 2>&1 || die "docker is required"
docker compose version >/dev/null 2>&1 || die "docker compose v2 is required"

# Repository list
if [[ "$MINIMAL" == true ]]; then
  REPOS=("airis-mcp-gateway")
else
  REPOS=(
    "airis-mcp-gateway"    # MCP Gateway (required)
    "airiscode"            # Terminal coding agent (Ollama)
    "airis-workspace"      # Monorepo management tools
    "airis-agent"          # MCP custom agent
  )
fi

# Git URL base
if [[ "$USE_SSH" == true ]]; then
  GIT_BASE="git@github.com:agiletec-inc"
else
  GIT_BASE="https://github.com/agiletec-inc"
fi

say "AIRIS OSS Suite Installer"
echo "  Install root: $ROOT"
echo "  Repositories: ${REPOS[*]}"
echo

# Create root directory
mkdir -p "$ROOT"
cd "$ROOT"

# Clone or update repositories
clone_or_update() {
  local repo="$1"
  local url="${GIT_BASE}/${repo}.git"

  if [[ -d "$repo/.git" ]]; then
    if [[ "$DO_UPDATE" == true ]]; then
      say "Updating $repo..."
      cd "$repo"
      git fetch --all --prune
      git pull --rebase --autostash || warn "Pull failed, continuing..."
      cd ..
      ok "$repo updated"
    else
      ok "$repo exists (use --update to pull)"
    fi
  else
    say "Cloning $repo..."
    git clone --depth 1 "$url" "$repo" || die "Failed to clone $repo"
    ok "$repo cloned"
  fi
}

for repo in "${REPOS[@]}"; do
  clone_or_update "$repo"
done

# Setup airis-mcp-gateway
say "Setting up airis-mcp-gateway..."
cd "$ROOT/airis-mcp-gateway"

# Create .env if not exists
if [[ ! -f .env ]] && [[ -f .env.example ]]; then
  cp .env.example .env
  ok ".env created from .env.example"
else
  ok ".env exists"
fi

# Run the gateway's own install script if exists
if [[ -f scripts/install.sh ]]; then
  say "Running airis-mcp-gateway installer..."
  bash scripts/install.sh || warn "Gateway install had warnings"
fi

cd "$ROOT"

# Start services
if [[ "$DO_UP" == true ]]; then
  say "Starting airis-mcp-gateway..."
  cd "$ROOT/airis-mcp-gateway"
  docker compose up -d
  ok "Services started"
  echo
  docker compose ps
  cd "$ROOT"
fi

# Summary
echo
say "Installation complete!"
echo
echo "  ${GREEN}Installed to:${NC} $ROOT"
echo
echo "  ${BLUE}Quick start:${NC}"
echo "    cd $ROOT/airis-mcp-gateway"
echo "    docker compose up -d"
echo
echo "  ${BLUE}Services:${NC}"
echo "    Gateway API:  http://localhost:9400"
echo "    Settings UI:  http://localhost:5273"
echo
echo "  ${BLUE}Next steps:${NC}"
echo "    1. Add API keys to .env or via Settings UI"
echo "    2. Register with your IDE:"
echo "       python scripts/install_all_editors.py"
echo

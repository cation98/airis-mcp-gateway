#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# AIRIS OSS Suite - Unified Installer
# ─────────────────────────────────────────────────────────────

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

say()  { echo -e "${BLUE}➤${NC} $*"; }
ok()   { echo -e "  ${GREEN}✔${NC} $*"; }
warn() { echo -e "  ${YELLOW}!${NC} $*"; }
err()  { echo -e "  ${RED}✖${NC} $*" >&2; }
die()  { err "$*"; exit 1; }

usage() {
  cat << 'EOF'
AIRIS OSS Suite - Unified Installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/agiletec-inc/airis-mcp-gateway/main/scripts/install-suite.sh | bash

Options:
  --all           Install all AIRIS tools (default)
  --gateway       Install airis-mcp-gateway only
  --cli           Install CLI tools only (airiscode, airis-workspace)
  --up            Start docker services after install
  --no-brew       Force git clone even if Homebrew is available
  --help          Show this help

Components:
  Docker Services (docker compose):
    - airis-mcp-gateway    MCP unified gateway (25+ servers)

  CLI Tools (brew install):
    - airiscode            Terminal coding agent (local Ollama)
    - airis-workspace      Monorepo management tools
EOF
  exit 0
}

# Defaults
INSTALL_ALL=true
INSTALL_GATEWAY=false
INSTALL_CLI=false
DO_UP=false
NO_BREW=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)      INSTALL_ALL=true; shift ;;
    --gateway)  INSTALL_ALL=false; INSTALL_GATEWAY=true; shift ;;
    --cli)      INSTALL_ALL=false; INSTALL_CLI=true; shift ;;
    --up)       DO_UP=true; shift ;;
    --no-brew)  NO_BREW=true; shift ;;
    -h|--help)  usage ;;
    *)          die "Unknown option: $1" ;;
  esac
done

# Detect available tools
HAS_BREW=false
HAS_DOCKER=false

if command -v brew &>/dev/null; then
  HAS_BREW=true
fi

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  HAS_DOCKER=true
fi

# Validate requirements
if [[ "$NO_BREW" == true ]]; then
  HAS_BREW=false
fi

if [[ "$HAS_BREW" == false && "$HAS_DOCKER" == false ]]; then
  die "Either Homebrew or Docker is required. Install one and try again."
fi

say "AIRIS OSS Suite Installer"
echo "  Homebrew: $([ "$HAS_BREW" == true ] && echo "available" || echo "not found")"
echo "  Docker:   $([ "$HAS_DOCKER" == true ] && echo "available" || echo "not found")"
echo

# ─────────────────────────────────────────────────────────────
# Install Functions
# ─────────────────────────────────────────────────────────────

install_brew_tap() {
  if [[ "$HAS_BREW" == true ]]; then
    say "Adding Homebrew tap..."
    brew tap agiletec-inc/tap 2>/dev/null || true
    ok "agiletec-inc/tap added"
  fi
}

install_gateway_brew() {
  say "Installing airis-mcp-gateway via Homebrew..."
  brew install airis-mcp-gateway
  ok "airis-mcp-gateway installed"

  say "Running gateway setup..."
  airis-gateway install || warn "Setup had warnings"
}

install_gateway_docker() {
  local INSTALL_DIR="${HOME}/.airis-mcp-gateway"

  say "Installing airis-mcp-gateway via Docker..."

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    say "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --rebase --autostash || warn "Pull failed"
  else
    say "Cloning repository..."
    git clone --depth 1 https://github.com/agiletec-inc/airis-mcp-gateway.git "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"

  # Setup .env
  if [[ ! -f .env ]] && [[ -f .env.example ]]; then
    cp .env.example .env
    ok ".env created"
  fi

  # Run install script if exists
  if [[ -f scripts/install.sh ]]; then
    bash scripts/install.sh || warn "Install script had warnings"
  fi

  ok "airis-mcp-gateway installed to $INSTALL_DIR"
}

install_airiscode() {
  if [[ "$HAS_BREW" == true ]]; then
    say "Installing airiscode via Homebrew..."
    brew install airiscode 2>/dev/null || {
      warn "airiscode formula not yet available in tap"
      warn "Install manually: https://github.com/agiletec-inc/airiscode"
    }
  else
    warn "airiscode requires Homebrew. Skipping."
    warn "Install manually: https://github.com/agiletec-inc/airiscode"
  fi
}

install_airis_workspace() {
  if [[ "$HAS_BREW" == true ]]; then
    say "Installing airis-workspace via Homebrew..."
    brew install airis-workspace || warn "airis-workspace install failed"
    ok "airis-workspace installed"
  else
    warn "airis-workspace requires Homebrew. Skipping."
    warn "Install manually: https://github.com/agiletec-inc/airis-workspace"
  fi
}

start_services() {
  local INSTALL_DIR="${HOME}/.airis-mcp-gateway"

  if [[ -d "$INSTALL_DIR" ]]; then
    say "Starting Docker services..."
    cd "$INSTALL_DIR"
    docker compose up -d
    echo
    docker compose ps
    ok "Services started"
  else
    warn "Gateway not found at $INSTALL_DIR. Run without --up first."
  fi
}

# ─────────────────────────────────────────────────────────────
# Main Installation Logic
# ─────────────────────────────────────────────────────────────

if [[ "$INSTALL_ALL" == true ]]; then
  INSTALL_GATEWAY=true
  INSTALL_CLI=true
fi

# Add tap if using brew
if [[ "$HAS_BREW" == true ]] && [[ "$INSTALL_GATEWAY" == true || "$INSTALL_CLI" == true ]]; then
  install_brew_tap
fi

# Install Gateway
if [[ "$INSTALL_GATEWAY" == true ]]; then
  if [[ "$HAS_BREW" == true ]]; then
    install_gateway_brew
  elif [[ "$HAS_DOCKER" == true ]]; then
    install_gateway_docker
  else
    die "airis-mcp-gateway requires Homebrew or Docker"
  fi
fi

# Install CLI tools
if [[ "$INSTALL_CLI" == true ]]; then
  install_airiscode
  install_airis_workspace
fi

# Start services
if [[ "$DO_UP" == true ]]; then
  if [[ "$HAS_DOCKER" == true ]]; then
    start_services
  else
    warn "--up requires Docker. Skipping service start."
  fi
fi

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────

echo
say "Installation complete!"
echo
echo "  ${BLUE}Services:${NC}"
echo "    Gateway API:  http://localhost:9400"
echo "    Settings UI:  http://localhost:5273"
echo
echo "  ${BLUE}Commands:${NC}"
if [[ "$HAS_BREW" == true ]]; then
echo "    airis-gateway --help     # Gateway CLI"
echo "    airis-workspace --help   # Workspace management"
fi
if [[ "$HAS_DOCKER" == true ]]; then
echo "    cd ~/.airis-mcp-gateway && docker compose up -d"
fi
echo
echo "  ${BLUE}Next steps:${NC}"
echo "    1. Add API keys via Settings UI or .env"
echo "    2. Restart your IDE to load MCP servers"
echo

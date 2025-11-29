#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# AIRIS OSS Suite - Unified Installer
# ─────────────────────────────────────────────────────────────

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
  # macOS (Homebrew)
  brew tap agiletec-inc/tap && brew install airis-suite

  # Linux / WSL2
  curl -fsSL https://raw.githubusercontent.com/agiletec-inc/airis-mcp-gateway/main/scripts/install-suite.sh | bash

Options:
  --gateway-only  Install airis-mcp-gateway only
  --up            Start services after install
  --help          Show this help

Components:
  - airis-mcp-gateway    MCP unified gateway (25+ servers)
  - mindbase             AI conversation knowledge management
  - airiscode            Terminal-first autonomous coding runner
  - airis-agent          Claude Code enhancement framework
EOF
  exit 0
}

# Defaults
GATEWAY_ONLY=false
DO_UP=false
INSTALL_DIR="${HOME}/.airis-suite"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --gateway-only) GATEWAY_ONLY=true; shift ;;
    --up)           DO_UP=true; shift ;;
    -h|--help)      usage ;;
    *)              die "Unknown option: $1" ;;
  esac
done

# ─────────────────────────────────────────────────────────────
# Platform Detection
# ─────────────────────────────────────────────────────────────

detect_platform() {
  case "$(uname -s)" in
    Darwin)
      if [[ "$(uname -m)" == "arm64" ]]; then
        echo "macos-arm"
      else
        echo "macos-intel"
      fi
      ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "windows"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

PLATFORM=$(detect_platform)

say "AIRIS OSS Suite Installer"
echo "  Platform: $PLATFORM"
echo

# ─────────────────────────────────────────────────────────────
# macOS: Use Homebrew
# ─────────────────────────────────────────────────────────────

if [[ "$PLATFORM" == "macos-arm" || "$PLATFORM" == "macos-intel" ]]; then
  if ! command -v brew &>/dev/null; then
    die "Homebrew not found. Install from https://brew.sh"
  fi

  say "macOS detected. Using Homebrew..."
  echo ""
  echo "Run the following commands:"
  echo ""
  echo "  ${GREEN}brew tap agiletec-inc/tap${NC}"
  if [[ "$GATEWAY_ONLY" == true ]]; then
    echo "  ${GREEN}brew install airis-mcp-gateway${NC}"
  else
    echo "  ${GREEN}brew install airis-suite${NC}"
  fi
  echo ""
  echo "Or run directly:"
  echo ""

  read -p "Install now? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    brew tap agiletec-inc/tap
    if [[ "$GATEWAY_ONLY" == true ]]; then
      brew install airis-mcp-gateway
    else
      brew install airis-suite
    fi
    ok "Installation complete!"
  else
    echo "Skipped. Run the commands above when ready."
  fi
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# Windows (native): Show instructions
# ─────────────────────────────────────────────────────────────

if [[ "$PLATFORM" == "windows" ]]; then
  say "Windows detected."
  echo ""
  echo "Recommended: Use WSL2 for best experience."
  echo ""
  echo "  1. Install WSL2: wsl --install"
  echo "  2. Install Docker Desktop with WSL2 backend"
  echo "  3. Run this script inside WSL2"
  echo ""
  echo "Or use Docker Compose directly:"
  echo ""
  echo "  git clone https://github.com/agiletec-inc/airis-mcp-gateway"
  echo "  cd airis-mcp-gateway"
  echo "  docker compose up -d"
  echo ""
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# Linux / WSL2: Direct installation
# ─────────────────────────────────────────────────────────────

if [[ "$PLATFORM" == "linux" || "$PLATFORM" == "wsl" ]]; then
  # Check Docker
  if ! command -v docker &>/dev/null; then
    die "Docker not found. Install from https://docs.docker.com/engine/install/"
  fi

  if ! docker compose version &>/dev/null; then
    die "Docker Compose v2 not found."
  fi

  say "Linux/WSL2 detected. Installing directly..."

  mkdir -p "$INSTALL_DIR"
  cd "$INSTALL_DIR"

  # Clone repositories
  REPOS=("airis-mcp-gateway")
  if [[ "$GATEWAY_ONLY" == false ]]; then
    REPOS+=("mindbase" "airiscode" "airis-agent")
  fi

  for repo in "${REPOS[@]}"; do
    if [[ -d "$repo/.git" ]]; then
      say "Updating $repo..."
      git -C "$repo" pull --rebase || warn "Pull failed"
      ok "$repo updated"
    else
      say "Cloning $repo..."
      git clone --depth 1 "https://github.com/agiletec-inc/$repo.git" "$repo"
      ok "$repo cloned"
    fi
  done

  # Setup airis-mcp-gateway
  cd "$INSTALL_DIR/airis-mcp-gateway"
  if [[ ! -f .env ]] && [[ -f .env.example ]]; then
    cp .env.example .env
    ok ".env created"
  fi

  # Start services
  if [[ "$DO_UP" == true ]]; then
    say "Starting services..."
    docker compose up -d
    ok "Services started"
    docker compose ps
  fi

  # Summary
  echo ""
  say "Installation complete!"
  echo ""
  echo "  Installed to: $INSTALL_DIR"
  echo ""
  echo "  Quick start:"
  echo "    cd $INSTALL_DIR/airis-mcp-gateway"
  echo "    docker compose up -d"
  echo ""
  echo "  Access:"
  echo "    Gateway:     http://localhost:9390"
  echo "    Settings UI: http://localhost:5273"
  echo ""
  exit 0
fi

# Unknown platform
die "Unsupported platform: $PLATFORM"

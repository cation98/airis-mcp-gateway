class AirisMcpGateway < Formula
  desc "Unified MCP server management for Claude Code, Cursor, Zed, and more"
  homepage "https://github.com/agiletec-inc/airis-mcp-gateway"
  url "https://github.com/agiletec-inc/airis-mcp-gateway/releases/download/v1.3.4/airis-mcp-gateway-1.3.4-universal.tar.gz"
  sha256 "PLACEHOLDER"
  license "MIT"

  depends_on "node"

  # Note: Requires Docker-compatible runtime (OrbStack, Docker Desktop, Colima, etc.)
  # Not enforced as dependency to allow flexibility in runtime choice

  def install
    # Pre-built tarball includes: bin, dist, node_modules, scripts
    # No pnpm install or build needed - just copy files

    # Install CLI files
    prefix.install Dir["*"]

    # Create symlink for CLI
    bin.install_symlink prefix/"bin/airis-gateway.js" => "airis-gateway"
    bin.install_symlink prefix/"bin/airis-gateway.js" => "airis-mcp"
  end

  def post_install
    # Auto-import existing IDE MCP configurations
    ohai "Importing existing IDE MCP configurations..."
    system "python3", prefix/"scripts/import_existing_configs.py"
  rescue StandardError => e
    opoo "IDE config import failed: #{e.message}"
    opoo "You can manually import later with: airis-gateway install"
  end

  def caveats
    <<~EOS
      AIRIS MCP Gateway has been installed!

      ✨ Your existing IDE MCP configurations have been automatically imported!

      Prerequisites:
        - Docker-compatible runtime required (OrbStack, Docker Desktop, Colima, etc.)
        - Ensure your Docker runtime is running before starting

      Quick Start:
        1. Run: airis-gateway install
        2. Restart your editors (Claude Code, Cursor, Zed, etc.)

      What was imported:
        - Claude Desktop, Cursor, Windsurf, Zed configs (if installed)
        - All MCP servers merged into unified Gateway

      Access URLs:
        Gateway:     http://localhost:9390
        Settings UI: http://localhost:5273
        API Docs:    http://localhost:9400/docs

      Documentation: https://github.com/agiletec-inc/airis-mcp-gateway
    EOS
  end

  test do
    system "#{bin}/airis-gateway", "--version"
  end
end

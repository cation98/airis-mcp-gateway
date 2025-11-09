class AirisMcpGateway < Formula
  desc "Unified MCP server management for Claude Code, Cursor, Zed, and more"
  homepage "https://github.com/agiletec-inc/airis-mcp-gateway"
  url "https://github.com/agiletec-inc/airis-mcp-gateway/archive/refs/tags/v1.2.0.tar.gz"
  sha256 "f8714303bf03102b02b79d147110f9fe03777afceb2f521d42a72c3da96d815d"
  license "MIT"
  head "https://github.com/agiletec-inc/airis-mcp-gateway.git", branch: "master"

  depends_on "node" => :build
  depends_on "pnpm" => :build

  # Note: Requires Docker-compatible runtime (OrbStack, Docker Desktop, Colima, etc.)
  # Not enforced as dependency to allow flexibility in runtime choice

  def install
    # Install npm dependencies
    system "pnpm", "install", "--frozen-lockfile"

    # Build CLI package
    cd "packages/cli" do
      system "pnpm", "build"
    end

    # Install CLI globally
    prefix.install Dir["*"]

    # Create symlink for CLI
    bin.install_symlink prefix/"packages/cli/bin/airis-gateway.js" => "airis-gateway"
    bin.install_symlink prefix/"packages/cli/bin/airis-gateway.js" => "airis-mcp"
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

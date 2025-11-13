#!/bin/bash
# Update Homebrew Formula (manual script for testing)
# Usage: ./scripts/update_homebrew_formula.sh v1.3.0

set -e

VERSION="${1#v}"
if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.3.0"
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOMEBREW_TAP_PATH="${HOMEBREW_TAP_PATH:-$HOME/github/homebrew-tap}"

echo "🔍 Calculating SHA256 for version ${VERSION}..."
TARBALL_URL="https://github.com/agiletec-inc/airis-mcp-gateway/archive/refs/tags/v${VERSION}.tar.gz"

# Download and calculate SHA256
TMP_FILE=$(mktemp)
curl -sL "$TARBALL_URL" -o "$TMP_FILE"
SHA256=$(shasum -a 256 "$TMP_FILE" | awk '{print $1}')
rm "$TMP_FILE"

echo "✅ SHA256: ${SHA256}"

if [ ! -d "$HOMEBREW_TAP_PATH" ]; then
    echo "❌ Homebrew tap not found at: $HOMEBREW_TAP_PATH"
    echo "   Clone it first: git clone git@github.com:agiletec-inc/homebrew-tap.git $HOMEBREW_TAP_PATH"
    exit 1
fi

echo "📝 Updating Formula at: $HOMEBREW_TAP_PATH/Formula/airis-mcp-gateway.rb"

cat > "$HOMEBREW_TAP_PATH/Formula/airis-mcp-gateway.rb" <<EOF
class AirisMcpGateway < Formula
  desc "Unified MCP server management with 90% token reduction via lazy loading"
  homepage "https://github.com/agiletec-inc/airis-mcp-gateway"
  url "https://github.com/agiletec-inc/airis-mcp-gateway/archive/refs/tags/v${VERSION}.tar.gz"
  sha256 "${SHA256}"
  license "MIT"

  depends_on "docker"
  depends_on "python@3.11"

  def install
    # Install entire project structure
    prefix.install Dir["*"]

    # Create wrapper script
    (bin/"airis-gateway").write <<~EOS
      #!/bin/bash
      cd "#{prefix}" && make "\$@"
    EOS

    chmod 0755, bin/"airis-gateway"
  end

  def post_install
    ohai "Setting up AIRIS MCP Gateway..."

    # Create data directory
    (var/"airis-mcp-gateway").mkpath

    # Auto-import existing IDE configs
    system "python3", prefix/"scripts/import_existing_configs.py" rescue nil
  end

  def caveats
    <<~EOS
      AIRIS MCP Gateway has been installed!

      📋 Quick Start:
        1. Ensure Docker is running
        2. Run: cd #{prefix} && make init
        3. Restart your editors (Claude Code, Cursor, Zed, etc.)

      🔧 Commands:
        make init       # Full installation (build + start + register editors)
        make up         # Start services
        make down       # Stop services
        make logs       # View logs
        make dev        # Start UI dev server

      📚 Documentation:
        #{prefix}/CLAUDE.md          # Full guide
        #{prefix}/PROJECT_INDEX.md   # Repository structure

      🌐 Access URLs:
        Gateway:     http://localhost:9390
        Settings UI: http://ui.gateway.localhost:5273
        API:         http://api.gateway.localhost:9400
    EOS
  end

  test do
    system "test", "-f", prefix/"Makefile"
    system "test", "-f", prefix/"docker-compose.yml"
  end
end
EOF

echo "✅ Formula updated successfully!"
echo ""
echo "📋 Next steps:"
echo "   cd $HOMEBREW_TAP_PATH"
echo "   git add Formula/airis-mcp-gateway.rb"
echo "   git commit -m 'chore: update airis-mcp-gateway to v${VERSION}'"
echo "   git push"

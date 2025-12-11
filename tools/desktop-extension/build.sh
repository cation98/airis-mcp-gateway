#!/bin/bash
set -e

# Build .mcpb Desktop Extension for AIRIS MCP Gateway
# Following Anthropic's mcpb specification: https://github.com/anthropics/mcpb

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$SCRIPT_DIR"
BUILD_DIR="$EXTENSION_DIR/build"
OUTPUT_FILE="$PROJECT_ROOT/config/airis-mcp-gateway.mcpb"

echo "🔨 Building AIRIS MCP Gateway Desktop Extension"
echo "================================================"

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy necessary files
echo "📦 Copying files..."
cp "$EXTENSION_DIR/manifest.json" "$BUILD_DIR/"
cp "$PROJECT_ROOT/docker-compose.yml" "$BUILD_DIR/"
cp "$PROJECT_ROOT/mcp-config.json" "$BUILD_DIR/"
cp "$PROJECT_ROOT/README.md" "$BUILD_DIR/"
cp "$PROJECT_ROOT/SECRETS.md" "$BUILD_DIR/"

# Copy icon if exists
if [ -f "$EXTENSION_DIR/icon.png" ]; then
  cp "$EXTENSION_DIR/icon.png" "$BUILD_DIR/"
else
  echo "⚠️  Warning: icon.png not found, extension will use default icon"
fi

# Create .mcpb archive (zip format)
echo "📦 Creating .mcpb package..."
cd "$BUILD_DIR"
zip -r "$OUTPUT_FILE" ./*

echo "✅ Desktop Extension built successfully!"
echo "📦 Output: $OUTPUT_FILE"
echo ""
echo "To install:"
echo "  1. Open Claude Desktop"
echo "  2. Navigate to Settings > Extensions"
echo "  3. Click 'Install Extension...'"
echo "  4. Select config/airis-mcp-gateway.mcpb"
echo ""
echo "Documentation: https://github.com/anthropics/mcpb"

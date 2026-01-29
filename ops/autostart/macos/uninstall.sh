#!/bin/bash
# macOS LaunchAgent uninstaller for airis-mcp-gateway

set -e

PLIST_NAME="com.agiletec.airis-mcp-gateway.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo "=== AIRIS MCP Gateway Auto-Start Uninstaller ==="
echo ""

# Check if installed
if [ ! -f "$PLIST_PATH" ]; then
    echo "Auto-start is not installed."
    echo "  Expected: $PLIST_PATH"
    exit 0
fi

# Unload LaunchAgent
echo "Unloading LaunchAgent..."
if launchctl list 2>/dev/null | grep -q "com.agiletec.airis-mcp-gateway"; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    echo "  Unloaded successfully"
else
    echo "  LaunchAgent was not running"
fi

# Remove plist
echo "Removing plist file..."
rm -f "$PLIST_PATH"
echo "  Removed: $PLIST_PATH"

echo ""
echo "=== Uninstallation Complete ==="
echo ""
echo "The AIRIS MCP Gateway will no longer start automatically."
echo ""
echo "Note: Running containers are NOT stopped."
echo "To stop containers: task docker:down"

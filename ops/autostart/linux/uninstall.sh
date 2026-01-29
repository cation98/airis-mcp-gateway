#!/bin/bash
# Linux systemd service uninstaller for airis-mcp-gateway

set -e

SERVICE_NAME="airis-mcp-gateway.service"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_PATH="$SYSTEMD_USER_DIR/$SERVICE_NAME"

echo "=== AIRIS MCP Gateway Auto-Start Uninstaller (Linux) ==="
echo ""

# Check if installed
if [ ! -f "$SERVICE_PATH" ]; then
    echo "Auto-start is not installed."
    echo "  Expected: $SERVICE_PATH"
    exit 0
fi

# Stop service if running
if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Stopping service..."
    systemctl --user stop "$SERVICE_NAME"
    echo "  Stopped successfully"
else
    echo "  Service was not running"
fi

# Disable service
if systemctl --user is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Disabling service..."
    systemctl --user disable "$SERVICE_NAME"
    echo "  Disabled successfully"
fi

# Remove service file
echo "Removing service file..."
rm -f "$SERVICE_PATH"
echo "  Removed: $SERVICE_PATH"

# Reload systemd
echo "Reloading systemd..."
systemctl --user daemon-reload

echo ""
echo "=== Uninstallation Complete ==="
echo ""
echo "The AIRIS MCP Gateway will no longer start automatically."
echo ""
echo "Note: Running containers are NOT stopped."
echo "To stop containers: task docker:down"

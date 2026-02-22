#!/bin/bash
# Entrypoint wrapper for patched Serena image
# 1. Patches Roslyn LS runtimeconfig.json for pre-release .NET runtime
# 2. Delegates to original Serena entrypoint (venv activation + command)

set -e

ROSLYN_BASE="/workspaces/serena/config/language_servers/static/CSharpLanguageServer"

# Background watcher: patch runtimeconfig.json when Roslyn LS is downloaded
# (Roslyn LS binary is downloaded dynamically on first C# project activation)
(
    while true; do
        for config in $(find "$ROSLYN_BASE" -name "*.runtimeconfig.json" 2>/dev/null); do
            if grep -q '"version": "10.0.0"' "$config" 2>/dev/null; then
                sed -i 's/"rollForward": "Major"/"rollForward": "LatestMajor"/' "$config"
                echo "[serena-patch] Patched rollForward in $config"
            fi
        done
        sleep 2
    done
) &

# Enable pre-release rollforward
export DOTNET_ROLL_FORWARD_TO_PRERELEASE=1

# Delegate to original entrypoint
cd /workspaces/serena
source .venv/bin/activate
exec "$@"

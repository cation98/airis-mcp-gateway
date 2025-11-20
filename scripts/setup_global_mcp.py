#!/usr/bin/env python3
"""
Setup global MCP servers for airis-mcp-gateway.

This script installs essential MCP servers into ~/.claude/mcp.json
so they're available across all projects.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any


# Gateway-only configuration for global MCP
# All other MCP servers (airis-agent, airis-workspace, context7, etc.)
# are managed internally by the gateway via mcp-config.json
ESSENTIAL_SERVERS = {
    "airis-mcp-gateway": {
        "url": "http://api.gateway.localhost:9400/api/v1/mcp",
        "transport": "http"
    }
}


def load_existing_config(config_path: Path) -> Dict[str, Any]:
    """Load existing mcp.json if it exists."""
    if not config_path.exists():
        return {"mcpServers": {}}

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️  Warning: Could not read existing config: {e}")
        return {"mcpServers": {}}


def merge_servers(existing: Dict[str, Any], essential: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge essential servers with existing config.

    Essential servers take precedence (to ensure correct configuration).
    """
    merged = existing.copy()
    servers = merged.setdefault("mcpServers", {})

    for name, config in essential.items():
        servers[name] = config

    return merged


def setup_global_mcp(force: bool = False) -> bool:
    """
    Setup global MCP servers in ~/.claude/mcp.json.

    Args:
        force: If True, overwrite existing servers. If False, merge.

    Returns:
        True if successful, False otherwise.
    """
    config_path = Path.home() / ".claude" / "mcp.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)

    print("🔧 Setting up global MCP servers...")
    print(f"📍 Config path: {config_path}")

    if force:
        print("⚠️  Force mode: Overwriting existing configuration")
        config = {"mcpServers": ESSENTIAL_SERVERS}
    else:
        print("🔄 Merge mode: Preserving existing servers")
        existing = load_existing_config(config_path)
        config = merge_servers(existing, ESSENTIAL_SERVERS)

    # Write config
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
            f.write('\n')

        print(f"\n✅ Installed {len(ESSENTIAL_SERVERS)} essential MCP servers:")
        for name in ESSENTIAL_SERVERS:
            print(f"   - {name}")

        print(f"\n📦 Total servers in config: {len(config['mcpServers'])}")

        if not force and len(config['mcpServers']) > len(ESSENTIAL_SERVERS):
            preserved = set(config['mcpServers']) - set(ESSENTIAL_SERVERS)
            print(f"   (Preserved {len(preserved)} existing servers)")

        print("\n🎉 Global MCP setup complete!")
        print("   These servers are now available in all projects.")
        print("   Use project-specific .mcp.json for additional servers.")

        return True

    except (IOError, OSError) as e:
        print(f"\n❌ Failed to write config: {e}")
        return False


def list_servers() -> None:
    """List currently installed global servers."""
    config_path = Path.home() / ".claude" / "mcp.json"

    if not config_path.exists():
        print("❌ No global MCP config found")
        print(f"   Expected: {config_path}")
        return

    config = load_existing_config(config_path)
    servers = config.get("mcpServers", {})

    if not servers:
        print("📭 No MCP servers configured")
        return

    print(f"📋 Global MCP servers ({len(servers)}):\n")

    for name, server_config in servers.items():
        essential = "✨ ESSENTIAL" if name in ESSENTIAL_SERVERS else ""
        print(f"  • {name} {essential}")

        if "command" in server_config:
            cmd = server_config["command"]
            args = " ".join(server_config.get("args", []))
            print(f"    Command: {cmd} {args}")
        elif "url" in server_config:
            print(f"    URL: {server_config['url']}")

        print()


def main():
    """Main entry point."""
    import sys

    if len(sys.argv) > 1:
        cmd = sys.argv[1]

        if cmd == "list":
            list_servers()
        elif cmd == "install":
            force = "--force" in sys.argv
            success = setup_global_mcp(force=force)
            sys.exit(0 if success else 1)
        elif cmd == "help":
            print("Usage:")
            print("  python setup_global_mcp.py install [--force]")
            print("  python setup_global_mcp.py list")
            print("  python setup_global_mcp.py help")
        else:
            print(f"❌ Unknown command: {cmd}")
            print("   Run 'python setup_global_mcp.py help' for usage")
            sys.exit(1)
    else:
        # Default: install
        success = setup_global_mcp(force=False)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

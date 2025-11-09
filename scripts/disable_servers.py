#!/usr/bin/env python3
"""Disable specific MCP servers in mcp-config.json"""

import json
import sys

def disable_servers(config_path, servers_to_disable):
    with open(config_path, 'r') as f:
        config = json.load(f)

    if "mcpServers" not in config:
        print("Error: mcpServers not found in config", file=sys.stderr)
        return False

    disabled_count = 0
    for server in servers_to_disable:
        if server in config["mcpServers"]:
            config["mcpServers"][server]["enabled"] = False
            disabled_count += 1
            print(f"  🔴 {server} disabled")

    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

    return True

if __name__ == "__main__":
    servers = ["mindbase", "playwright", "puppeteer", "chrome-devtools", "sqlite", "magic"]
    if disable_servers("mcp-config.json", servers):
        sys.exit(0)
    else:
        sys.exit(1)

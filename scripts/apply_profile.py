#!/usr/bin/env python3
"""
Apply MCP Gateway profile to docker-compose.yml

This script reads a profile JSON and updates the --servers flags in docker-compose.yml
to match the profile's gateway_servers configuration.
"""

import json
import sys
from pathlib import Path
from typing import List


def load_profile(profile_name: str) -> dict:
    """Load profile JSON from config/profiles/{profile_name}.json"""
    profile_path = Path(__file__).parent.parent / "config" / "profiles" / f"{profile_name}.json"

    if not profile_path.exists():
        print(f"❌ Profile not found: {profile_path}", file=sys.stderr)
        sys.exit(1)

    with open(profile_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_enabled_servers(profile: dict) -> List[str]:
    """Extract list of servers that should be enabled"""
    return profile.get("gateway_servers", [])


def update_docker_compose(servers: List[str]) -> None:
    """Update docker-compose.yml with new server list"""
    compose_path = Path(__file__).parent.parent / "docker-compose.yml"

    if not compose_path.exists():
        print(f"❌ docker-compose.yml not found: {compose_path}", file=sys.stderr)
        sys.exit(1)

    with open(compose_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Generate new --servers lines
    server_lines = [f"      - --servers={server}\n" for server in servers]

    # Find and replace --servers sections
    new_lines = []
    in_servers_section = False
    servers_replaced_count = 0

    for i, line in enumerate(lines):
        # Detect start of --servers section (line before first --servers)
        if line.strip().startswith("- --servers=") and not in_servers_section:
            in_servers_section = True
            # Insert all server lines at once
            new_lines.extend(server_lines)
            servers_replaced_count += 1
            continue

        # Skip subsequent --servers lines in this section
        if in_servers_section and line.strip().startswith("- --servers="):
            continue

        # End of --servers section
        if in_servers_section and not line.strip().startswith("- --servers="):
            in_servers_section = False

        new_lines.append(line)

    # Write back
    with open(compose_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"✅ Updated docker-compose.yml ({servers_replaced_count} services)")
    print(f"   Enabled servers: {', '.join(servers)}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python apply_profile.py <profile_name>", file=sys.stderr)
        print("Example: python apply_profile.py dynamic", file=sys.stderr)
        sys.exit(1)

    profile_name = sys.argv[1]

    print(f"📋 Loading profile: {profile_name}")
    profile = load_profile(profile_name)

    servers = get_enabled_servers(profile)
    print(f"🔧 Servers to enable: {servers}")

    update_docker_compose(servers)

    print("\n✅ Profile applied successfully!")
    print("💡 Run 'docker compose restart mcp-gateway mcp-gateway-stream' to apply changes")


if __name__ == "__main__":
    main()

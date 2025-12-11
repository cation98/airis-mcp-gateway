#!/usr/bin/env python3
"""
Import existing MCP server configurations from installed IDEs.

Detects and merges MCP server configs from:
- Claude Desktop
- Cursor
- Windsurf
- Zed

Merges them into AIRIS mcp-config.json with deduplication.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

# IDE configuration paths
IDE_CONFIGS = {
    "Claude Desktop": Path.home() / "Library/Application Support/Claude/claude_desktop_config.json",
    "Cursor": Path.home() / ".cursor/mcp.json",
    "Windsurf": Path.home() / ".windsurf/mcp.json",
    "Zed": Path.home() / ".config/zed/mcp.json",
}

# AIRIS Gateway configuration
AIRIS_CONFIG_PATH = Path(__file__).parent.parent / "mcp-config.json"
SUMMARY_PATH = Path("/tmp/airis_import_summary.txt")


def detect_ide_configs() -> Dict[str, Path]:
    """Detect which IDE config files exist."""
    detected = {}
    for ide_name, config_path in IDE_CONFIGS.items():
        if config_path.exists():
            detected[ide_name] = config_path
            print(f"✅ Found: {ide_name} ({config_path})")
        else:
            print(f"⏭️  Skip: {ide_name} (not installed)")
    return detected


def parse_mcp_config(config_path: Path, ide_name: str) -> Dict[str, dict]:
    """Parse MCP server configuration from IDE config file."""
    try:
        with open(config_path) as f:
            config = json.load(f)

        # Extract mcpServers section
        servers = config.get("mcpServers", {})

        # Filter out AIRIS Gateway itself (to avoid circular import)
        servers = {
            name: cfg
            for name, cfg in servers.items()
            if name != "airis-mcp-gateway" and not name.startswith("__")
        }

        print(f"   📦 {ide_name}: Found {len(servers)} MCP servers")
        for server_name in servers.keys():
            print(f"      - {server_name}")

        return servers
    except Exception as e:
        print(f"   ⚠️  Error parsing {ide_name} config: {e}")
        return {}


def merge_servers(all_servers: List[Dict[str, dict]]) -> Dict[str, dict]:
    """Merge server configs with deduplication."""
    merged = {}
    duplicates = []

    for servers in all_servers:
        for name, config in servers.items():
            if name in merged:
                # Duplicate detected
                duplicates.append(name)
                print(f"   🔄 Duplicate: {name} (using first definition)")
            else:
                merged[name] = config

    return merged, duplicates


def update_airis_config(new_servers: Dict[str, dict]):
    """Update AIRIS mcp-config.json with new servers."""
    # Read existing AIRIS config
    with open(AIRIS_CONFIG_PATH) as f:
        airis_config = json.load(f)

    # Get existing servers
    existing_servers = airis_config.get("mcpServers", {})

    # Merge new servers (existing ones take priority)
    added_count = 0
    for name, config in new_servers.items():
        # Skip if server already exists in AIRIS config
        if name in existing_servers or f"__disabled_{name}" in existing_servers:
            print(f"   ⏭️  Skip: {name} (already in AIRIS config)")
            continue

        # Add new server as disabled by default (user can enable via UI)
        existing_servers[f"__disabled_{name}"] = config
        added_count += 1
        print(f"   ➕ Added: {name} (disabled by default)")

    # Update config
    airis_config["mcpServers"] = existing_servers

    # Write back
    with open(AIRIS_CONFIG_PATH, "w") as f:
        json.dump(airis_config, f, indent=2)

    return added_count


def generate_summary(
    detected_ides: Dict[str, Path],
    all_found_servers: Dict[str, List[str]],
    added_count: int,
    duplicates: List[str]
):
    """Generate import summary report."""
    summary_lines = []
    summary_lines.append("=" * 60)
    summary_lines.append("AIRIS MCP Gateway - Import Summary")
    summary_lines.append("=" * 60)
    summary_lines.append("")

    # Detected IDEs
    summary_lines.append(f"📱 Detected IDEs ({len(detected_ides)}):")
    for ide_name in detected_ides.keys():
        summary_lines.append(f"   ✅ {ide_name}")
    summary_lines.append("")

    # Found servers
    total_servers = sum(len(servers) for servers in all_found_servers.values())
    summary_lines.append(f"📦 Found MCP Servers ({total_servers} total):")
    for ide_name, server_names in all_found_servers.items():
        if server_names:
            summary_lines.append(f"   {ide_name}:")
            for server_name in server_names:
                summary_lines.append(f"      - {server_name}")
    summary_lines.append("")

    # Added servers
    summary_lines.append(f"➕ Added to AIRIS Gateway: {added_count} servers")
    summary_lines.append("   (Disabled by default - enable via Settings UI)")
    summary_lines.append("")

    # Duplicates
    if duplicates:
        summary_lines.append(f"🔄 Duplicates (merged): {len(duplicates)}")
        for dup in set(duplicates):
            summary_lines.append(f"   - {dup}")
        summary_lines.append("")

    summary_lines.append("=" * 60)
    summary_lines.append("✅ Import complete! Restart editors to use unified Gateway.")
    summary_lines.append("=" * 60)

    summary = "\n".join(summary_lines)

    # Write to file
    with open(SUMMARY_PATH, "w") as f:
        f.write(summary)

    # Print to console
    print("\n" + summary)


def main():
    """Main import workflow."""
    print("=" * 60)
    print("📥 Importing existing IDE MCP configurations")
    print("=" * 60)
    print()

    # Step 1: Detect IDE configs
    print("🔍 Step 1: Detecting IDE configurations...")
    detected_ides = detect_ide_configs()
    print()

    if not detected_ides:
        print("⚠️  No existing IDE configurations found.")
        print("   Nothing to import.")
        return

    # Step 2: Parse configs
    print("📖 Step 2: Parsing MCP server configurations...")
    all_servers = []
    all_found_servers = {}

    for ide_name, config_path in detected_ides.items():
        servers = parse_mcp_config(config_path, ide_name)
        all_servers.append(servers)
        all_found_servers[ide_name] = list(servers.keys())
    print()

    # Step 3: Merge and deduplicate
    print("🔄 Step 3: Merging and deduplicating...")
    merged_servers, duplicates = merge_servers(all_servers)
    print(f"   📦 Unique servers: {len(merged_servers)}")
    print()

    # Step 4: Update AIRIS config
    print("💾 Step 4: Updating AIRIS mcp-config.json...")
    added_count = update_airis_config(merged_servers)
    print()

    # Step 5: Generate summary
    print("📊 Step 5: Generating summary...")
    generate_summary(detected_ides, all_found_servers, added_count, duplicates)


if __name__ == "__main__":
    main()

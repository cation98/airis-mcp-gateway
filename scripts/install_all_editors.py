"""AIRIS MCP Gateway unified installer (modular edition)."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

from installers import (
    ClaudeCodeInstaller,
    ClaudeDesktopInstaller,
    CodexInstaller,
    CursorInstaller,
    ZedInstaller,
)
from installers.base import GatewayContext, EditorInstaller


REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = REPO_ROOT / ".env"
INSTALLED_INFO_FILE = REPO_ROOT / ".installed_editors.json"


def _load_env_defaults(env_path: Path) -> None:
    """Backfill os.environ with values from .env (mirrors original script)."""
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue

        cleaned = value.strip().strip('\'"')
        expanded = os.path.expandvars(cleaned)
        os.environ[key] = expanded


def _resolve_server_name(config: Dict) -> str:
    servers = config.get("mcpServers") if isinstance(config, dict) else None
    if isinstance(servers, dict) and servers:
        return next(iter(servers.keys()))
    return "airis-mcp-gateway"


def _build_gateway_context(repo_root: Path) -> GatewayContext:
    mcp_json = repo_root / "mcp.json"
    if not mcp_json.exists():
        print("❌ Gateway mcp.json not found")
        print(f"   Expected: {mcp_json}")
        print("   Run 'make generate-mcp-config' first")
        sys.exit(1)

    with open(mcp_json, "r", encoding="utf-8") as handle:
        gateway_config = json.load(handle)

    # Read from .env with proper port expansion
    gateway_api_port = os.getenv("GATEWAY_API_PORT", "9400")
    gateway_api = os.getenv("GATEWAY_API_URL", f"http://localhost:{gateway_api_port}/api").rstrip("/")
    http_url = f"{gateway_api}/v1/mcp"
    sse_url = f"{gateway_api}/v1/mcp/sse"

    return GatewayContext(
        repo_root=repo_root,
        mcp_json=mcp_json,
        config=gateway_config,
        http_url=http_url,
        sse_url=sse_url,
        server_name=_resolve_server_name(gateway_config),
    )


def _build_installers(context: GatewayContext, backup_dir: Path) -> List[EditorInstaller]:
    return [
        ClaudeCodeInstaller(context, backup_dir),
        ClaudeDesktopInstaller(context, backup_dir),
        CursorInstaller(context, backup_dir),
        ZedInstaller(context, backup_dir),
        CodexInstaller(context, backup_dir),
    ]


def install_all(installers: Iterable[EditorInstaller], backup_dir: Path, info_file: Path) -> bool:
    print("🌉 AIRIS MCP Gateway - Unified Editor Installer")
    print("=" * 60)

    print("\n🔍 Detecting installed editors...")
    detected = [installer for installer in installers if installer.is_available()]
    for installer in detected:
        print(f"✅ Found: {installer.name()} at {installer.config_path()}")

    if not detected:
        print("\n⚠️  No MCP-compatible editors found")
        print("   Supported: Claude Code, Claude Desktop, Cursor, Zed, Codex CLI")
        return False

    print(f"\n✅ Found {len(detected)} editor(s)")

    print("\n📦 Backing up original configurations...")
    backup_dir.mkdir(parents=True, exist_ok=True)
    print(f"📦 Creating backups in: {backup_dir}")

    backups: Dict[str, str] = {}
    for installer in detected:
        backup_path = installer.backup()
        if backup_path:
            backups[installer.slug] = str(backup_path)
            print(f"   ✅ Backed up: {installer.name()}")

    print("\n🔄 Replacing configs with AIRIS Gateway...")
    success_count = 0
    failed: List[str] = []

    for installer in detected:
        print(f"   Updating {installer.name()}...", end=" ")
        if installer.install():
            print("✅")
            success_count += 1
        else:
            print("❌")
            failed.append(installer.name())

    install_info = {
        "installed_at": datetime.now().isoformat(),
        "editors": [
            {
                "slug": installer.slug,
                "name": installer.name(),
                "config_path": str(installer.config_path()),
            }
            for installer in detected
        ],
        "backups": backups,
        "backup_dir": str(backup_dir),
        "gateway_dir": str(REPO_ROOT),
    }

    info_file.write_text(json.dumps(install_info, indent=2), encoding="utf-8")

    print("\n" + "=" * 60)
    if failed:
        print(f"⚠️  Partially completed: {success_count}/{len(detected)} editors")
        print(f"   Failed: {', '.join(failed)}")
    else:
        print(f"🎉 Successfully unified {success_count} editor(s)!")

    print(f"\n📦 Backups saved to: {backup_dir}")
    print(f"📝 Installation info: {info_file}")

    print("\n🔄 Next steps:")
    print("   1. Restart all editors (Claude Desktop, Cursor, Zed, etc.)")
    print("   2. Verify Gateway is running: docker ps | grep airis-mcp-gateway")
    print("   3. Test MCP tools in any editor")

    return success_count > 0


def uninstall_all(installers: Iterable[EditorInstaller], info_file: Path) -> bool:
    if not info_file.exists():
        print("⚠️  No installation info found")
        print("   AIRIS Gateway was not installed via install_all_editors")
        return False

    info = json.loads(info_file.read_text(encoding="utf-8"))
    backups = info.get("backups", {})
    target_slugs = {entry["slug"] for entry in info.get("editors", [])}

    print("🔄 Restoring original editor configurations...")
    print("=" * 60)

    restored_count = 0
    for installer in installers:
        if installer.slug not in target_slugs:
            continue

        backup_ref = backups.get(installer.slug)
        backup_path = Path(backup_ref) if backup_ref else None

        if installer.uninstall(backup_path):
            print(f"✅ Restored: {installer.name()}")
            restored_count += 1

    info_file.unlink(missing_ok=True)

    print("\n" + "=" * 60)
    print(f"✅ Restored {restored_count} editor(s)")
    print("\n🔄 Restart all editors to apply changes")

    return restored_count > 0


def list_editors(installers: Iterable[EditorInstaller], info_file: Path) -> None:
    print("🔍 Scanning for MCP-compatible editors...\n")

    for installer in installers:
        status = "✅ Installed" if installer.is_available() else "❌ Not found"
        print(f"{installer.name():20s} {status:15s} {installer.config_path()}")

    if info_file.exists():
        info = json.loads(info_file.read_text(encoding="utf-8"))
        print("\n📝 Last unified:")
        print(f"   When: {info.get('installed_at', 'unknown')}")
        names = ", ".join(entry.get("name", entry.get("slug", "")) for entry in info.get("editors", []))
        if names:
            print(f"   Editors: {names}")


def main() -> None:
    _load_env_defaults(ENV_FILE)

    context = _build_gateway_context(REPO_ROOT)
    backup_dir = REPO_ROOT / "backups" / datetime.now().strftime("%Y%m%d_%H%M%S")
    installers = _build_installers(context, backup_dir)

    command = sys.argv[1] if len(sys.argv) > 1 else "install"

    if command == "install":
        success = install_all(installers, backup_dir, INSTALLED_INFO_FILE)
        sys.exit(0 if success else 1)
    if command == "uninstall":
        success = uninstall_all(installers, INSTALLED_INFO_FILE)
        sys.exit(0 if success else 1)
    if command == "list":
        list_editors(installers, INSTALLED_INFO_FILE)
        sys.exit(0)

    print(f"Unknown command: {command}")
    print("Usage: install_all_editors.py [install|uninstall|list]")
    sys.exit(1)


if __name__ == "__main__":
    main()

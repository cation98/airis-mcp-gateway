#!/usr/bin/env python3
"""
AIRIS MCP Gateway - Unified Editor Installer
Automatically replaces all editor MCP configs with AIRIS Gateway
"""

import json
import os
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List


GATEWAY_API_URL = os.getenv("GATEWAY_API_URL", "http://api.gateway.localhost:9100/api")
GATEWAY_SSE_URL = f"{GATEWAY_API_URL.rstrip('/')}/v1/mcp/sse"


class EditorInstaller:
    """Unified installer for all MCP-compatible editors"""

    GATEWAY_CONFIG = {
        "mcpServers": {
            "airis-mcp-gateway": {
                "url": GATEWAY_SSE_URL,
                "description": "All MCP servers via unified Gateway (25 servers, zero-token baseline)"
            }
        }
    }
    GATEWAY_SERVER_NAME = "airis-mcp-gateway"

    EDITOR_CONFIGS = {
        "claude-code": {
            "name": "Claude Code",
            "path": "~/.claude/mcp.json",
            "format": "mcp_json",
        },
        "claude-desktop": {
            "name": "Claude Desktop",
            "path": "~/Library/Application Support/Claude/claude_desktop_config.json",
            "format": "claude_desktop_json",
        },
        "cursor": {
            "name": "Cursor",
            "path": "~/.cursor/mcp.json",
            "format": "mcp_json",
        },
        "zed": {
            "name": "Zed",
            "path": "~/.config/zed/settings.json",
            "format": "zed_settings",
        },
        "codex": {
            "name": "Codex CLI",
            "path": "~/.codex/config.toml",
            "format": "codex_toml",
        },
    }

    def __init__(self, gateway_dir: Path):
        self.gateway_dir = gateway_dir
        self.backup_dir = gateway_dir / "backups" / datetime.now().strftime("%Y%m%d_%H%M%S")
        self.installed_info_file = gateway_dir / ".installed_editors.json"

    def detect_editors(self) -> List[Dict]:
        """Detect installed editors with MCP configs"""
        detected = []

        for editor_id, config in self.EDITOR_CONFIGS.items():
            path = Path(config["path"]).expanduser()
            if path.exists():
                detected.append({
                    "id": editor_id,
                    "name": config["name"],
                    "path": str(path),
                    "format": config["format"],
                    "original_exists": True,
                })
                print(f"✅ Found: {config['name']} at {path}")

        return detected

    def backup_configs(self, editors: List[Dict]) -> Dict[str, str]:
        """Backup all editor configs before modification"""
        backups = {}

        if not editors:
            print("ℹ️  No editors to backup")
            return backups

        self.backup_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n📦 Creating backups in: {self.backup_dir}")

        for editor in editors:
            src = Path(editor["path"])
            backup_name = f"{editor['id']}-{src.name}"
            dst = self.backup_dir / backup_name

            try:
                shutil.copy2(src, dst)
                backups[editor["id"]] = str(dst)
                print(f"   ✅ Backed up: {editor['name']}")
            except Exception as e:
                print(f"   ⚠️  Failed to backup {editor['name']}: {e}")

        return backups

    def replace_config(self, editor: Dict) -> bool:
        """Replace editor config with AIRIS Gateway config"""
        path = Path(editor["path"])

        try:
            if editor["format"] == "codex_toml":
                return self._install_codex_config(path)

            if editor["format"] == "mcp_json":
                # Simple replacement: mcp.json format
                with open(path, "w") as f:
                    json.dump(self.GATEWAY_CONFIG, f, indent=2)
                    f.write("\n")

            elif editor["format"] == "claude_desktop_json":
                # Claude Desktop: keep globalShortcut if exists
                try:
                    with open(path, "r") as f:
                        original = json.load(f)

                    new_config = self.GATEWAY_CONFIG.copy()
                    if "globalShortcut" in original:
                        new_config["globalShortcut"] = original["globalShortcut"]

                    with open(path, "w") as f:
                        json.dump(new_config, f, indent=2)
                        f.write("\n")
                except:
                    # Fallback: simple replacement
                    with open(path, "w") as f:
                        json.dump(self.GATEWAY_CONFIG, f, indent=2)
                        f.write("\n")

            elif editor["format"] == "zed_settings":
                # Zed: preserve all settings except context_servers
                with open(path, "r") as f:
                    settings = json.load(f)

                # Replace only context_servers section
                settings["context_servers"] = {
                    "airis-mcp-gateway": {
                        "command": "curl",
                        "args": ["-N", GATEWAY_SSE_URL]
                    }
                }

                with open(path, "w") as f:
                    json.dump(settings, f, indent=2)
                    f.write("\n")

            return True

        except Exception as e:
            print(f"   ❌ Failed to update {editor['name']}: {e}")
            return False

    def _install_codex_config(self, path: Path) -> bool:
        """Install AIRIS Gateway into Codex CLI config via codex mcp commands"""
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            existing_text = path.read_text(encoding="utf-8") if path.exists() else ""
        except Exception as exc:
            print(f"   ❌ Failed to read Codex config: {exc}")
            return False

        updated_text = self._ensure_codex_feature_flags(existing_text)
        if updated_text != existing_text:
            try:
                path.write_text(updated_text, encoding="utf-8")
            except Exception as exc:
                print(f"   ❌ Failed to update Codex config: {exc}")
                return False

        try:
            get_proc = subprocess.run(
                ["codex", "mcp", "get", self.GATEWAY_SERVER_NAME],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        except FileNotFoundError:
            print("   ❌ Codex CLI not found on PATH (expected 'codex').")
            return False

        if get_proc.returncode == 0:
            subprocess.run(
                ["codex", "mcp", "remove", self.GATEWAY_SERVER_NAME],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )

        codex_url = os.getenv("CODEX_GATEWAY_URL")
        if not codex_url:
            codex_url = self.GATEWAY_CONFIG["mcpServers"][self.GATEWAY_SERVER_NAME]["url"].rstrip("/")
            if codex_url.endswith("/sse"):
                codex_url = codex_url[: -len("/sse")]
        add_proc = subprocess.run(
            [
                "codex",
                "mcp",
                "add",
                "--enable",
                "rmcp_client",
                "--url",
                codex_url,
                self.GATEWAY_SERVER_NAME,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        if add_proc.returncode != 0:
            error_msg = (add_proc.stderr or add_proc.stdout).strip()
            print(f"   ❌ Failed to register Codex MCP server: {error_msg or 'unknown error'}")
            return False

        return True

    @staticmethod
    def _ensure_codex_feature_flags(text: str) -> str:
        """Ensure Codex config enables rmcp_client and drops deprecated flags"""
        pattern = re.compile(r"^\s*experimental_use_rmcp_client\s*=.*$", re.MULTILINE)
        text = pattern.sub("", text)

        lines = text.splitlines()
        output_lines = []
        features_found = False
        rmcp_set = False
        i = 0

        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            if stripped == "[features]":
                features_found = True
                output_lines.append(line)
                i += 1
                while i < len(lines):
                    next_line = lines[i]
                    next_stripped = next_line.strip()
                    if next_stripped.startswith("[") and next_stripped.endswith("]"):
                        if not rmcp_set:
                            output_lines.append("rmcp_client = true")
                            rmcp_set = True
                        break
                    if next_stripped.startswith("rmcp_client"):
                        output_lines.append("rmcp_client = true")
                        rmcp_set = True
                    else:
                        output_lines.append(next_line)
                    i += 1
                else:
                    if not rmcp_set:
                        output_lines.append("rmcp_client = true")
                        rmcp_set = True
                continue

            output_lines.append(line)
            i += 1

        if not features_found:
            if output_lines and output_lines[-1].strip():
                output_lines.append("")
            output_lines.append("[features]")
            output_lines.append("rmcp_client = true")
        elif not rmcp_set:
            output_lines.append("rmcp_client = true")

        result = "\n".join(output_lines)
        if not result.endswith("\n"):
            result += "\n"
        return result

    def install_all(self) -> bool:
        """Main installation flow"""
        print("🌉 AIRIS MCP Gateway - Unified Editor Installer")
        print("=" * 60)

        # Step 1: Detect editors
        print("\n🔍 Detecting installed editors...")
        detected = self.detect_editors()

        if not detected:
            print("\n⚠️  No MCP-compatible editors found")
            print("   Supported: Claude Code, Claude Desktop, Cursor, Zed")
            return False

        print(f"\n✅ Found {len(detected)} editor(s)")

        # Step 2: Backup configs
        print("\n📦 Backing up original configurations...")
        backups = self.backup_configs(detected)

        # Step 3: Replace configs
        print("\n🔄 Replacing configs with AIRIS Gateway...")
        success_count = 0
        failed = []

        for editor in detected:
            print(f"   Updating {editor['name']}...", end=" ")
            if self.replace_config(editor):
                print("✅")
                success_count += 1
            else:
                print("❌")
                failed.append(editor["name"])

        # Step 4: Save installation info
        install_info = {
            "installed_at": datetime.now().isoformat(),
            "editors": detected,
            "backups": backups,
            "gateway_dir": str(self.gateway_dir),
        }

        with open(self.installed_info_file, "w") as f:
            json.dump(install_info, f, indent=2)

        # Summary
        print("\n" + "=" * 60)
        if failed:
            print(f"⚠️  Partially completed: {success_count}/{len(detected)} editors")
            print(f"   Failed: {', '.join(failed)}")
        else:
            print(f"🎉 Successfully unified {success_count} editor(s)!")

        print(f"\n📦 Backups saved to: {self.backup_dir}")
        print(f"📝 Installation info: {self.installed_info_file}")

        print("\n🔄 Next steps:")
        print("   1. Restart all editors (Claude Desktop, Cursor, Zed, etc.)")
        print("   2. Verify Gateway is running: docker ps | grep airis-mcp-gateway")
        print("   3. Test MCP tools in any editor")

        return success_count > 0

    def list_editors(self):
        """List detected editors and their status"""
        print("🔍 Scanning for MCP-compatible editors...\n")

        for editor_id, config in self.EDITOR_CONFIGS.items():
            path = Path(config["path"]).expanduser()
            status = "✅ Installed" if path.exists() else "❌ Not found"

            print(f"{config['name']:20s} {status:15s} {path}")

        print(f"\n📁 Gateway directory: {self.gateway_dir}")
        if self.installed_info_file.exists():
            with open(self.installed_info_file) as f:
                info = json.load(f)
            print(f"📝 Last unified: {info['installed_at']}")
            print(f"   Editors: {', '.join([e['name'] for e in info['editors']])}")

    def uninstall(self) -> bool:
        """Restore original configs from backup"""
        if not self.installed_info_file.exists():
            print("⚠️  No installation info found")
            print("   AIRIS Gateway was not installed via install_all_editors")
            return False

        with open(self.installed_info_file) as f:
            info = json.load(f)

        print("🔄 Restoring original editor configurations...")
        print("=" * 60)

        restored_count = 0
        for editor_id, backup_path in info["backups"].items():
            editor_info = next((e for e in info["editors"] if e["id"] == editor_id), None)
            if not editor_info:
                continue

            src = Path(backup_path)
            dst = Path(editor_info["path"])

            if not src.exists():
                print(f"⚠️  Backup not found: {editor_info['name']}")
                continue

            try:
                shutil.copy2(src, dst)
                print(f"✅ Restored: {editor_info['name']}")
                restored_count += 1
            except Exception as e:
                print(f"❌ Failed to restore {editor_info['name']}: {e}")

        # Remove installation info
        self.installed_info_file.unlink()

        print("\n" + "=" * 60)
        print(f"✅ Restored {restored_count} editor(s)")
        print(f"📦 Backups remain at: {info['backups']}")
        print("\n🔄 Restart all editors to apply changes")

        return restored_count > 0


def main():
    import sys

    gateway_dir = Path(__file__).parent.parent.resolve()
    installer = EditorInstaller(gateway_dir)

    command = sys.argv[1] if len(sys.argv) > 1 else "install"

    if command == "install":
        success = installer.install_all()
        sys.exit(0 if success else 1)

    elif command == "uninstall":
        success = installer.uninstall()
        sys.exit(0 if success else 1)

    elif command == "list":
        installer.list_editors()
        sys.exit(0)

    else:
        print(f"Unknown command: {command}")
        print("Usage: install_all_editors.py [install|uninstall|list]")
        sys.exit(1)


if __name__ == "__main__":
    main()

"""Claude Code and Claude Desktop installers."""

from pathlib import Path
import os
import json

from .base import EditorInstaller


class ClaudeCodeInstaller(EditorInstaller):
    """Claude Code installer - just symlink mcp.json"""

    def name(self) -> str:
        return "Claude Code"

    def config_path(self) -> Path:
        return Path.home() / ".claude" / "mcp.json"

    def is_available(self) -> bool:
        """Check if .claude directory exists (not just mcp.json)."""
        return self.config_path().parent.exists()

    def install(self) -> bool:
        """Create a symlink to the repository mcp.json."""
        config = self.config_path()
        config.parent.mkdir(parents=True, exist_ok=True)

        try:
            if config.exists() or config.is_symlink():
                config.unlink()

            os.symlink(self.context.mcp_json, config)
            self._update_legacy_claude_json()
            return True
        except Exception as exc:
            print(f"   ❌ Failed: {exc}")
            return False

    def _legacy_config_path(self) -> Path:
        return Path.home() / ".claude.json"

    def _update_legacy_claude_json(self) -> None:
        """Ensure older Claude builds pick up the updated MCP server."""
        legacy = self._legacy_config_path()
        if not legacy.exists():
            return

        try:
            with open(legacy, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except Exception as exc:
            print(f"   ⚠️  Could not update {legacy}: {exc}")
            return

        servers = data.setdefault("mcpServers", {})
        servers[self.context.server_name] = {
            "type": "sse",
            "url": self.context.sse_url,
        }

        try:
            with open(legacy, "w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=2)
                handle.write("\n")
        except Exception as exc:
            print(f"   ⚠️  Failed to write {legacy}: {exc}")

    def _remove_from_legacy_claude_json(self) -> None:
        """Remove AIRIS Gateway from .claude.json."""
        legacy = self._legacy_config_path()
        if not legacy.exists():
            return

        try:
            with open(legacy, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except Exception:
            return

        servers = data.get("mcpServers", {})
        if self.context.server_name in servers:
            del servers[self.context.server_name]
            try:
                with open(legacy, "w", encoding="utf-8") as handle:
                    json.dump(data, handle, indent=2)
                    handle.write("\n")
            except Exception as exc:
                print(f"   ⚠️  Failed to update {legacy}: {exc}")

    def uninstall(self, backup_path) -> bool:
        """Remove symlink and clean up legacy config."""
        config = self.config_path()
        if config.is_symlink() or config.exists():
            config.unlink(missing_ok=True)
        self._remove_from_legacy_claude_json()
        return True


class ClaudeDesktopInstaller(EditorInstaller):
    """Claude Desktop installer - copy mcp.json content into claude_desktop_config.json"""

    def name(self) -> str:
        return "Claude Desktop"

    def config_path(self) -> Path:
        return Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"

    def install(self) -> bool:
        """Copy the gateway config, preserving globalShortcut if present."""
        config = self.config_path()
        config.parent.mkdir(parents=True, exist_ok=True)

        try:
            gateway_config = self.context.config.copy()

            if config.exists():
                with open(config) as handle:
                    existing = json.load(handle)
                if "globalShortcut" in existing:
                    gateway_config["globalShortcut"] = existing["globalShortcut"]

            with open(config, "w") as handle:
                json.dump(gateway_config, handle, indent=2)
                handle.write("\n")

            return True
        except Exception as exc:
            print(f"   ❌ Failed: {exc}")
            return False

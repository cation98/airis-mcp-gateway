"""Cursor installer."""

from pathlib import Path
import os

from .base import EditorInstaller


class CursorInstaller(EditorInstaller):
    """Cursor installer - just symlink mcp.json"""

    def name(self) -> str:
        return "Cursor"

    def config_path(self) -> Path:
        return Path.home() / ".cursor" / "mcp.json"

    def is_available(self) -> bool:
        """Check if .cursor directory exists (not just mcp.json)."""
        return self.config_path().parent.exists()

    def install(self) -> bool:
        """Create a symlink to the repository mcp.json."""
        config = self.config_path()
        config.parent.mkdir(parents=True, exist_ok=True)

        try:
            if config.exists() or config.is_symlink():
                config.unlink()

            os.symlink(self.context.mcp_json, config)
            return True
        except Exception as exc:
            print(f"   ❌ Failed: {exc}")
            return False

    def uninstall(self, backup_path) -> bool:
        """Remove symlink."""
        config = self.config_path()
        if config.is_symlink() or config.exists():
            config.unlink(missing_ok=True)
        return True

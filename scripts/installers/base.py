"""Base classes shared by the modular installer suite."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional
import shutil


@dataclass(frozen=True)
class GatewayContext:
    """Runtime configuration shared by every installer."""

    repo_root: Path
    mcp_json: Path
    config: Dict[str, Any]
    http_url: str
    sse_url: str
    server_name: str = "airis-mcp-gateway"


class EditorInstaller(ABC):
    """Base class for individual editor installers."""

    def __init__(self, context: GatewayContext, backup_dir: Path):
        self.context = context
        self.backup_dir = backup_dir

    @property
    def slug(self) -> str:
        """Machine-friendly identifier used in metadata files."""
        return self.name().strip().lower().replace(" ", "-")

    @abstractmethod
    def name(self) -> str:
        """Human-friendly editor name (e.g., 'Claude Code')."""

    @abstractmethod
    def config_path(self) -> Path:
        """Location of the editor's MCP configuration file."""

    def is_available(self) -> bool:
        """Return True if the editor looks installed on this machine."""
        return self.config_path().exists()

    def backup(self) -> Optional[Path]:
        """Copy the original configuration so we can restore it later."""
        config = self.config_path()
        if not config.exists():
            return None

        self.backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = self.backup_dir / f"{self.slug}-{config.name}"

        try:
            shutil.copy2(config, backup_path)
            return backup_path
        except Exception as exc:
            print(f"   ⚠️  Backup failed: {exc}")
            return None

    @abstractmethod
    def install(self) -> bool:
        """Perform the editor-specific installation steps."""

    def uninstall(self, backup_path: Optional[Path]) -> bool:
        """Restore the previous configuration from a backup file."""
        if not backup_path or not backup_path.exists():
            print(f"   ⚠️  No backup found for {self.name()}")
            return False

        try:
            shutil.copy2(backup_path, self.config_path())
            return True
        except Exception as exc:
            print(f"   ❌ Restore failed: {exc}")
            return False

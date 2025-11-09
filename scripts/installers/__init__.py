"""Editor installers for AIRIS MCP Gateway."""

from .claude import ClaudeCodeInstaller, ClaudeDesktopInstaller
from .cursor import CursorInstaller
from .zed import ZedInstaller
from .codex import CodexInstaller

__all__ = [
    "ClaudeCodeInstaller",
    "ClaudeDesktopInstaller",
    "CursorInstaller",
    "ZedInstaller",
    "CodexInstaller",
]

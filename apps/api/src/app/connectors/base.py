from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

from ..core.credentials_provider import CredentialProvider


class BaseConnector(ABC):
    """Base class for MCP connector clients."""

    def __init__(self, connector_id: str, creds: CredentialProvider):
        self.connector_id = connector_id
        self._creds = creds

    @abstractmethod
    async def light_probe(self) -> None:
        """Perform a lightweight call verifying credentials."""

    @abstractmethod
    async def invoke(self, tool: str, args: Dict[str, Any]) -> Any:
        """Invoke the specified tool with arguments."""

    def reset_auth(self) -> None:
        """Reset cached auth (default no-op)."""
        # Connectors relying on cached tokens can override.
        return None

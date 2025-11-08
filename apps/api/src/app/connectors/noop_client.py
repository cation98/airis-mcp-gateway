from __future__ import annotations

from typing import Any, Dict

from .base import BaseConnector


class NoopConnector(BaseConnector):
    """Connector placeholder signalling unsupported operations."""

    async def light_probe(self) -> None:
        raise NotImplementedError(
            f"Connector '{self.connector_id}' does not support probe yet."
        )

    async def invoke(self, tool: str, args: Dict[str, Any]) -> Any:
        raise NotImplementedError(
            f"Connector '{self.connector_id}' invoke is not implemented."
        )

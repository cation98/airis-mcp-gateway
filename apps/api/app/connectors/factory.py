from __future__ import annotations

from typing import Dict, Type

from ..core.credentials_provider import CredentialProvider
from .base import BaseConnector
from .noop_client import NoopConnector
from .openai_client import OpenAIClient

_REGISTRY: Dict[str, Type[BaseConnector]] = {
    "openai": OpenAIClient,
}


def build_connector(connector_id: str, creds: CredentialProvider) -> BaseConnector:
    """Factory returning connector instance for id."""
    cls = _REGISTRY.get(connector_id.lower(), NoopConnector)
    return cls(connector_id, creds)

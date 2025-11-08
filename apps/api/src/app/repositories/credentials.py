from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..core.crypto import AESEncryption
from ..models import MCPCredential


class CredentialRepository:
    """Persistence layer for encrypted MCP credentials."""

    def __init__(
        self,
        session_factory: async_sessionmaker,
        cipher: AESEncryption,
    ):
        self._session_factory = session_factory
        self._cipher = cipher

    async def load(self, credential_id: str) -> Optional[dict[str, Any]]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(MCPCredential).where(MCPCredential.id == credential_id)
            )
            row = result.scalar_one_or_none()
            if row is None:
                return None

            decrypted = self._cipher.decrypt(row.enc_key).decode()
            return {
                "id": row.id,
                "provider": row.provider,
                "value": decrypted,
                "version": row.key_version,
                "updated_at": row.updated_at,
            }

    async def save(
        self,
        credential_id: str,
        provider: str,
        value: str,
        actor: str | None = None,
    ) -> dict[str, Any]:
        payload = value.encode()
        encrypted = self._cipher.encrypt(payload)

        async with self._session_factory() as session:
            existing = await session.get(MCPCredential, credential_id)
            if existing:
                existing.provider = provider
                existing.enc_key = encrypted
                existing.key_version = (existing.key_version or 0) + 1
                existing.updated_at = datetime.utcnow()
                existing.updated_by = actor
            else:
                existing = MCPCredential(
                    id=credential_id,
                    provider=provider,
                    enc_key=encrypted,
                    key_version=1,
                    updated_by=actor,
                )
                session.add(existing)

            await session.commit()

            return {
                "id": existing.id,
                "provider": existing.provider,
                "version": existing.key_version,
                "updated_at": existing.updated_at,
            }

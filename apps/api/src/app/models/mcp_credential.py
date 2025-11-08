from datetime import datetime

from sqlalchemy import LargeBinary, String, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class MCPCredential(Base):
    """Encrypted credential entry for an MCP connector."""

    __tablename__ = "mcp_credentials"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    enc_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    key_version: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="1"
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    updated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<MCPCredential id={self.id} provider={self.provider}>"

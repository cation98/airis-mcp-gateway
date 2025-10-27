from datetime import datetime

from sqlalchemy import Boolean, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class MCPSetting(Base):
    """Runtime toggle/configuration metadata for MCP connectors."""

    __tablename__ = "mcp_settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="FALSE"
    )
    config_json: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="'{}'"
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<MCPSetting id={self.id} enabled={self.enabled}>"

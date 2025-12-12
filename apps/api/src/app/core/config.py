import os
from pydantic_settings import BaseSettings
from pathlib import Path

DEFAULT_PROJECT_ROOT = Path(
    os.getenv(
        "CONTAINER_PROJECT_ROOT",
        os.getenv("PROJECT_ROOT", "/workspace/project")
    )
)
DEFAULT_MCP_CONFIG = Path(
    os.getenv("MCP_CONFIG_PATH", str(DEFAULT_PROJECT_ROOT / "mcp-config.json"))
)


class Settings(BaseSettings):
    """Application settings"""

    # Mode: lite (no DB) or full (with DB)
    GATEWAY_MODE: str = os.getenv("GATEWAY_MODE", "lite")

    # Database (optional - only used in "full" mode)
    DATABASE_URL: str | None = os.getenv("DATABASE_URL", None)

    # Simple auth for single-user mode
    AIRIS_API_KEY: str | None = os.getenv("AIRIS_API_KEY", None)

    @property
    def is_lite_mode(self) -> bool:
        """Check if running in lite (stateless) mode"""
        return self.GATEWAY_MODE == "lite" or not self.DATABASE_URL

    # MCP Gateway
    PROJECT_ROOT: Path = DEFAULT_PROJECT_ROOT
    MCP_CONFIG_PATH: Path = DEFAULT_MCP_CONFIG
    MCP_GATEWAY_URL: str = os.getenv("MCP_GATEWAY_URL", "http://mcp-gateway:9390")
    MCP_STREAM_GATEWAY_URL: str = os.getenv("MCP_STREAM_GATEWAY_URL", "http://mcp-gateway:9390/mcp")
    GATEWAY_PUBLIC_URL: str = os.getenv("GATEWAY_PUBLIC_URL", "http://gateway.localhost:9390")
    GATEWAY_API_URL: str = os.getenv("GATEWAY_API_URL", "http://localhost:9400/api")
    UI_PUBLIC_URL: str = os.getenv("UI_PUBLIC_URL", "http://ui.gateway.localhost:5273")
    MASTER_KEY_HEX: str | None = None

    # API
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "AIRIS MCP Gateway API"
    DEBUG: bool = True

    # CORS
    CORS_ORIGINS: list[str] = []

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"


settings = Settings()

if not settings.CORS_ORIGINS:
    settings.CORS_ORIGINS = [
        settings.UI_PUBLIC_URL,
        settings.GATEWAY_PUBLIC_URL,
    ]

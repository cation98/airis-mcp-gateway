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

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/mcp_gateway"

    # MCP Gateway
    PROJECT_ROOT: Path = DEFAULT_PROJECT_ROOT
    MCP_CONFIG_PATH: Path = DEFAULT_MCP_CONFIG
    MCP_GATEWAY_URL: str = "http://mcp-gateway:9090"
    MCP_STREAM_GATEWAY_URL: str = "http://mcp-gateway-stream:9091/mcp"
    GATEWAY_PUBLIC_URL: str = "http://gateway.localhost:9090"
    GATEWAY_API_URL: str = "http://api.gateway.localhost:9100/api"
    UI_PUBLIC_URL: str = "http://ui.gateway.localhost:5173"
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

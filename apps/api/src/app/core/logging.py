"""
Logging configuration for AIRIS MCP Gateway.

Provides structured logging with configurable levels and formats.
"""
import logging
import os
import sys
from typing import Optional


def setup_logging(
    level: Optional[str] = None,
    format_style: str = "standard"
) -> None:
    """
    Configure application-wide logging.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR). Defaults to LOG_LEVEL env var or INFO.
        format_style: "standard" for human-readable, "json" for structured logging
    """
    log_level = level or os.getenv("LOG_LEVEL", "INFO").upper()

    # Validate log level
    numeric_level = getattr(logging, log_level, None)
    if not isinstance(numeric_level, int):
        numeric_level = logging.INFO

    # Format configuration
    if format_style == "json":
        # JSON format for production (easy to parse by log aggregators)
        log_format = (
            '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
            '"logger": "%(name)s", "message": "%(message)s"}'
        )
    else:
        # Human-readable format for development
        log_format = "[%(asctime)s] %(levelname)s %(name)s: %(message)s"

    # Configure root logger
    logging.basicConfig(
        level=numeric_level,
        format=log_format,
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
        force=True  # Override any existing configuration
    )

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name.

    Args:
        name: Logger name (typically __name__ of the module)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


# Module-level loggers for convenience
# Usage: from app.core.logging import logger
logger = get_logger("airis")

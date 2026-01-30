"""
Logging configuration for AIRIS MCP Gateway.

Provides structured logging with configurable levels and formats.
Supports request_id context for request tracing.
"""
import json
import logging
import os
import sys
from contextvars import ContextVar
from typing import Optional


# Context variable for request ID - set by logging_context middleware
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


class RequestIDFilter(logging.Filter):
    """
    Filter that adds request_id to log records.

    Reads from ContextVar set by logging_context middleware.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get() or "-"
        return True


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.

    Output format:
    {"timestamp": "...", "level": "...", "logger": "...", "request_id": "...", "message": "..."}
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": record.getMessage(),
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)


def setup_logging(
    level: Optional[str] = None,
    format_style: Optional[str] = None
) -> None:
    """
    Configure application-wide logging.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR).
               Defaults to LOG_LEVEL env var or INFO.
        format_style: "standard" for human-readable, "json" for structured logging.
                      Defaults to LOG_FORMAT env var or "json" (production default).
    """
    log_level = level or os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = format_style or os.getenv("LOG_FORMAT", "json").lower()

    # Validate log level
    numeric_level = getattr(logging, log_level, None)
    if not isinstance(numeric_level, int):
        numeric_level = logging.INFO

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)

    # Add request ID filter
    handler.addFilter(RequestIDFilter())

    # Configure formatter based on format style
    if log_format == "json":
        handler.setFormatter(JSONFormatter(datefmt="%Y-%m-%dT%H:%M:%S"))
    else:
        # Human-readable format for development
        handler.setFormatter(logging.Formatter(
            "[%(asctime)s] %(levelname)s %(name)s [%(request_id)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))

    root_logger.addHandler(handler)

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


def set_request_id(request_id: Optional[str]) -> None:
    """
    Set the request ID for the current context.

    Called by logging_context middleware at the start of each request.

    Args:
        request_id: The request ID to set
    """
    request_id_var.set(request_id)


def get_request_id() -> Optional[str]:
    """
    Get the request ID from the current context.

    Returns:
        The current request ID, or None if not set
    """
    return request_id_var.get()


# Module-level loggers for convenience
# Usage: from app.core.logging import logger
logger = get_logger("airis")

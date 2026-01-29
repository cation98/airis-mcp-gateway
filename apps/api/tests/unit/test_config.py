"""
Tests for configuration settings.
"""
import os
import pytest


def test_debug_mode_default_is_false():
    """Test that DEBUG mode defaults to False (not hardcoded True)."""
    # Remove DEBUG env var if set
    original = os.environ.pop("DEBUG", None)
    try:
        # Re-import to get fresh settings
        import importlib
        from app.core import config
        importlib.reload(config)

        # Default should be False
        assert config.settings.DEBUG is False
    finally:
        if original is not None:
            os.environ["DEBUG"] = original


def test_debug_mode_can_be_enabled_via_env():
    """Test that DEBUG can be enabled via environment variable."""
    original = os.environ.get("DEBUG")
    try:
        os.environ["DEBUG"] = "true"

        import importlib
        from app.core import config
        importlib.reload(config)

        assert config.settings.DEBUG is True
    finally:
        if original is not None:
            os.environ["DEBUG"] = original
        else:
            os.environ.pop("DEBUG", None)


def test_dynamic_mcp_default_is_true():
    """Test that DYNAMIC_MCP defaults to True (as documented)."""
    original = os.environ.pop("DYNAMIC_MCP", None)
    try:
        import importlib
        from app.core import config
        importlib.reload(config)

        # Default should be True per documentation
        assert config.settings.DYNAMIC_MCP is True
    finally:
        if original is not None:
            os.environ["DYNAMIC_MCP"] = original


def test_dynamic_mcp_can_be_disabled_via_env():
    """Test that DYNAMIC_MCP can be disabled via environment variable."""
    original = os.environ.get("DYNAMIC_MCP")
    try:
        os.environ["DYNAMIC_MCP"] = "false"

        import importlib
        from app.core import config
        importlib.reload(config)

        assert config.settings.DYNAMIC_MCP is False
    finally:
        if original is not None:
            os.environ["DYNAMIC_MCP"] = original
        else:
            os.environ.pop("DYNAMIC_MCP", None)

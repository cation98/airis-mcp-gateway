"""
Pytest configuration and fixtures
"""
import pytest
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture
def sample_mcp_config():
    """Sample MCP configuration for testing"""
    return {
        "servers": [
            {
                "id": "tavily",
                "name": "Tavily Search",
                "description": "Web search and research",
                "enabled": False,
                "apiKeyRequired": True,
                "category": "search",
                "recommended": True,
                "builtin": False
            },
            {
                "id": "supabase",
                "name": "Supabase",
                "description": "Backend as a service",
                "enabled": False,
                "apiKeyRequired": True,
                "category": "database",
                "recommended": False,
                "builtin": False
            }
        ]
    }


@pytest.fixture
def valid_tavily_config():
    """Valid Tavily configuration"""
    return {
        "TAVILY_API_KEY": "tvly_abcdefghijklmnopqrstuvwxyz1234567890"
    }


@pytest.fixture
def valid_supabase_config():
    """Valid Supabase configuration"""
    return {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test"
    }


@pytest.fixture
def valid_twilio_config():
    """Valid Twilio configuration"""
    return {
        "TWILIO_ACCOUNT_SID": "AC" + "a" * 32,
        "TWILIO_API_KEY": "SK" + "b" * 32,
        "TWILIO_API_SECRET": "c" * 32
    }


@pytest.fixture
def invalid_tavily_config():
    """Invalid Tavily configuration"""
    return {
        "TAVILY_API_KEY": "tvly-invalid"
    }

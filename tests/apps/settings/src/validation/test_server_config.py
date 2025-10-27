"""
Tests for Zod validation schemas
"""
import pytest


def test_tavily_schema_valid():
    """Test valid Tavily API key"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "TAVILY_API_KEY": "tvly_abcdefghijklmnopqrstuvwxyz1234567890"
    }

    result = validateServerConfig("tavily", config)
    assert result["success"] is True
    assert result.get("errors") is None


def test_tavily_schema_invalid_format():
    """Test invalid Tavily API key format"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "TAVILY_API_KEY": "invalid_key_format"
    }

    result = validateServerConfig("tavily", config)
    assert result["success"] is False
    assert "TAVILY_API_KEY" in result["errors"]
    assert "format" in result["errors"]["TAVILY_API_KEY"].lower()


def test_stripe_schema_valid():
    """Test valid Stripe secret key"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "STRIPE_SECRET_KEY": "sk_test_abcdefghijklmnopqrstuvwxyz"
    }

    result = validateServerConfig("stripe", config)
    assert result["success"] is True


def test_github_schema_valid():
    """Test valid GitHub token"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_abcdefghijklmnopqrstuvwxyz123456789012"
    }

    result = validateServerConfig("github", config)
    assert result["success"] is True


def test_supabase_schema_valid():
    """Test valid Supabase configuration"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "SUPABASE_URL": "https://abc123.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.test"
    }

    result = validateServerConfig("supabase", config)
    assert result["success"] is True


def test_supabase_schema_invalid_url():
    """Test invalid Supabase URL"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "SUPABASE_URL": "https://invalid-domain.com",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
    }

    result = validateServerConfig("supabase", config)
    assert result["success"] is False
    assert "SUPABASE_URL" in result["errors"]


def test_supabase_selfhost_schema_valid():
    """Test valid Supabase self-host configuration"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "PG_DSN": "postgres://mcp_ro:password@postgres:5432/postgres",
        "POSTGREST_URL": "http://postgrest:3000/rest/v1",
        "POSTGREST_JWT": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature",
        "READ_ONLY": "true",
        "FEATURES": "database,docs,postgrest"
    }

    result = validateServerConfig("supabase-selfhost", config)
    assert result["success"] is True


def test_supabase_selfhost_schema_invalid_dsn():
    """Test invalid Supabase self-host DSN"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "PG_DSN": "invalid_dsn",
        "POSTGREST_URL": "http://postgrest:3000/rest/v1",
        "POSTGREST_JWT": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature"
    }

    result = validateServerConfig("supabase-selfhost", config)
    assert result["success"] is False
    assert "PG_DSN" in result["errors"]


def test_twilio_schema_valid():
    """Test valid Twilio configuration"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "TWILIO_ACCOUNT_SID": "AC" + "a" * 32,
        "TWILIO_API_KEY": "SK" + "b" * 32,
        "TWILIO_API_SECRET": "c" * 32
    }

    result = validateServerConfig("twilio", config)
    assert result["success"] is True


def test_twilio_schema_invalid_account_sid():
    """Test invalid Twilio Account SID"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "TWILIO_ACCOUNT_SID": "invalid_sid",
        "TWILIO_API_KEY": "SK" + "b" * 32,
        "TWILIO_API_SECRET": "c" * 32
    }

    result = validateServerConfig("twilio", config)
    assert result["success"] is False
    assert "TWILIO_ACCOUNT_SID" in result["errors"]


def test_slack_schema_valid():
    """Test valid Slack configuration"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "SLACK_BOT_TOKEN": "xoxb-123-456-abc",
        "SLACK_TEAM_ID": "T12345678"
    }

    result = validateServerConfig("slack", config)
    assert result["success"] is True


def test_sentry_schema_valid():
    """Test valid Sentry configuration"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "SENTRY_AUTH_TOKEN": "sntrys_abcdefghijklmnopqrstuvwxyz",
        "SENTRY_ORG": "test-org"
    }

    result = validateServerConfig("sentry", config)
    assert result["success"] is True


def test_mongodb_schema_valid():
    """Test valid MongoDB connection string"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017/test"
    }

    result = validateServerConfig("mongodb", config)
    assert result["success"] is True


def test_postgresql_schema_valid():
    """Test valid PostgreSQL connection string"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost:5432/db"
    }

    result = validateServerConfig("postgresql", config)
    assert result["success"] is True


def test_validate_field_success():
    """Test single field validation - success case"""
    from apps.settings.src.validation.server_config import validateField

    result = validateField("tavily", "TAVILY_API_KEY", "tvly_abcdefghijklmnopqrstuvwxyz1234567890")

    assert result["valid"] is True
    assert result.get("error") is None


def test_validate_field_failure():
    """Test single field validation - failure case"""
    from apps.settings.src.validation.server_config import validateField

    result = validateField("tavily", "TAVILY_API_KEY", "invalid_format")

    assert result["valid"] is False
    assert result.get("error") is not None
    assert "format" in result["error"].lower()


def test_validate_missing_required_field():
    """Test validation with missing required field"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {
        "SUPABASE_URL": "https://abc123.supabase.co"
        # Missing SUPABASE_ANON_KEY
    }

    result = validateServerConfig("supabase", config)
    assert result["success"] is False
    assert "SUPABASE_ANON_KEY" in result["errors"]


def test_validate_unknown_server():
    """Test validation for server without schema"""
    from apps.settings.src.validation.server_config import validateServerConfig

    config = {"SOME_KEY": "some_value"}

    result = validateServerConfig("unknown_server", config)
    # Should return success if no schema exists
    assert result["success"] is True

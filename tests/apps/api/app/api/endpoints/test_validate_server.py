"""
Tests for server validation endpoint
"""
import pytest
from httpx import AsyncClient, Response
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_validate_supabase_success():
    """Test successful Supabase validation"""
    config = {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.test"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        # Import here to use mocked httpx
        from apps.api.app.api.endpoints.validate_server import validate_supabase

        result = await validate_supabase(config)

        assert result["valid"] is True
        assert "successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_supabase_invalid_url():
    """Test Supabase validation with invalid URL"""
    config = {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_ANON_KEY": "invalid_key"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_get.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_supabase

        result = await validate_supabase(config)

        assert result["valid"] is False
        assert "failed" in result["message"].lower() or "unauthorized" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_supabase_selfhost_success():
    """Test successful Supabase self-host validation"""
    config = {
        "PG_DSN": "postgres://user:pass@localhost:5432/postgres",
        "POSTGREST_URL": "http://localhost:54321/rest/v1",
        "POSTGREST_JWT": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.payload"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_supabase_selfhost

        result = await validate_supabase_selfhost(config)

        assert result["valid"] is True
        assert "postgrest" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_supabase_selfhost_missing_fields():
    """Test Supabase self-host validation with missing configuration"""
    config = {
        "PG_DSN": "postgres://user:pass@localhost:5432/postgres",
        "POSTGREST_URL": "",
        "POSTGREST_JWT": ""
    }

    from apps.api.app.api.endpoints.validate_server import validate_supabase_selfhost

    result = await validate_supabase_selfhost(config)

    assert result["valid"] is False
    assert "missing" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_stripe_success():
    """Test successful Stripe validation"""
    config = {
        "STRIPE_SECRET_KEY": "sk_test_abcdefghijklmnopqrstuvwxyz123456"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"object": "balance"}
        mock_get.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_stripe

        result = await validate_stripe(config)

        assert result["valid"] is True
        assert "successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_github_success():
    """Test successful GitHub validation"""
    config = {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_abcdefghijklmnopqrstuvwxyz123456789012"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"login": "testuser"}
        mock_get.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_github

        result = await validate_github(config)

        assert result["valid"] is True
        assert "successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_twilio_success():
    """Test successful Twilio validation"""
    config = {
        "TWILIO_ACCOUNT_SID": "AC" + "a" * 32,
        "TWILIO_API_KEY": "SK" + "b" * 32,
        "TWILIO_API_SECRET": "c" * 32
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_twilio

        result = await validate_twilio(config)

        assert result["valid"] is True
        assert "successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_slack_success():
    """Test successful Slack validation"""
    config = {
        "SLACK_BOT_TOKEN": "xoxb-123-456-abc",
        "SLACK_TEAM_ID": "T12345678"
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": True}
        mock_post.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_slack

        result = await validate_slack(config)

        assert result["valid"] is True
        assert "successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_notion_success():
    """Test successful Notion validation"""
    config = {
        "NOTION_API_KEY": "secret_abcdefghijklmnopqrstuvwxyz"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_notion

        result = await validate_notion(config)

        assert result["valid"] is True
        assert "successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_sentry_success():
    """Test successful Sentry validation"""
    config = {
        "SENTRY_AUTH_TOKEN": "sntrys_abcdefghijklmnopqrstuvwxyz",
        "SENTRY_ORG": "test-org"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"name": "test-org"}
        mock_get.return_value = mock_response

        from apps.api.app.api.endpoints.validate_server import validate_sentry

        result = await validate_sentry(config)

        assert result["valid"] is True
        assert "successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_missing_config_key():
    """Test validation with missing required configuration key"""
    config = {
        "SUPABASE_URL": "https://test.supabase.co"
        # Missing SUPABASE_ANON_KEY
    }

    from apps.api.app.api.endpoints.validate_server import validate_supabase

    result = await validate_supabase(config)

    assert result["valid"] is False
    assert "missing" in result["message"].lower() or "required" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_network_error():
    """Test validation handling network errors"""
    config = {
        "STRIPE_SECRET_KEY": "sk_test_abcdefghijklmnopqrstuvwxyz123456"
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.side_effect = Exception("Network error")

        from apps.api.app.api.endpoints.validate_server import validate_stripe

        result = await validate_stripe(config)

        assert result["valid"] is False
        assert "error" in result["message"].lower() or "failed" in result["message"].lower()


@pytest.mark.asyncio
async def test_validate_unknown_server():
    """Test validation endpoint with unknown server ID"""
    from apps.api.app.api.endpoints.validate_server import VALIDATORS

    # Ensure unknown server has no validator
    assert "unknown_server_xyz" not in VALIDATORS

"""API endpoints for MCP configuration"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from pathlib import Path
import json
import os

router = APIRouter(tags=["mcp-config"])


class MCPServerInfo(BaseModel):
    """MCP Server information from config"""
    id: str
    name: str
    description: str
    category: str
    apiKeyRequired: bool
    recommended: bool
    builtin: bool
    command: str
    args: list[str]
    env: dict[str, str] | None = None


class MCPConfigResponse(BaseModel):
    """Response schema for MCP configuration"""
    servers: list[MCPServerInfo]
    total: int


# Server metadata mapping
SERVER_METADATA = {
    # Built-in servers (via --servers flag)
    "time": {
        "name": "Time",
        "description": "時間と日付の操作",
        "category": "builtin",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": True
    },
    "fetch": {
        "name": "Fetch",
        "description": "HTTP リクエストとAPI呼び出し",
        "category": "builtin",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": True
    },
    "git": {
        "name": "Git",
        "description": "ローカルGitリポジトリ管理と操作",
        "category": "builtin",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": True
    },
    "memory": {
        "name": "Memory",
        "description": "セッション間でのデータ永続化",
        "category": "builtin",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": True
    },
    "sequentialthinking": {
        "name": "Sequential Thinking",
        "description": "段階的思考と体系的分析",
        "category": "builtin",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": True
    },

    # Gateway servers (no auth)
    "filesystem": {
        "name": "File System",
        "description": "ローカルファイルシステム操作（必須）",
        "category": "gateway",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": False
    },
    "context7": {
        "name": "Context7",
        "description": "公式ライブラリドキュメントとコード例（必須）",
        "category": "gateway",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": False
    },
    "serena": {
        "name": "Serena",
        "description": "セマンティックコード分析とインテリジェント編集（推奨）",
        "category": "gateway",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": False
    },
    "mindbase": {
        "name": "Mindbase",
        "description": "長期記憶・失敗学習システム（推奨）",
        "category": "gateway",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": False
    },
    "self-management": {
        "name": "Self Management",
        "description": "自己管理とプロファイルシステム",
        "category": "gateway",
        "apiKeyRequired": False,
        "recommended": True,
        "builtin": False
    },
    "puppeteer": {
        "name": "Puppeteer",
        "description": "ヘッドレスブラウザ自動化（E2Eテスト時のみ）",
        "category": "gateway",
        "apiKeyRequired": False,
        "recommended": False,
        "builtin": False
    },
    "sqlite": {
        "name": "SQLite",
        "description": "SQLiteデータベース操作（DB操作時のみ）",
        "category": "gateway",
        "apiKeyRequired": False,
        "recommended": False,
        "builtin": False
    },

    # Auth required servers
    "tavily": {
        "name": "Tavily",
        "description": "AI検索とリアルタイム情報取得（Fetch無効化推奨）",
        "category": "auth-required",
        "apiKeyRequired": True,
        "recommended": True,
        "builtin": False
    },
    "stripe": {
        "name": "Stripe",
        "description": "Stripe決済とサブスクリプション管理",
        "category": "auth-required",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "figma": {
        "name": "Figma",
        "description": "Figmaデザインファイルとプロトタイプ管理",
        "category": "auth-required",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },

    # Disabled but available
    "supabase": {
        "name": "Supabase",
        "description": "Supabaseデータベースと認証（Supabase開発時）",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": True,
        "builtin": False
    },
    "supabase-selfhost": {
        "name": "Supabase Self-host",
        "description": "Self-hosted Supabase（PostgREST + PostgreSQL）連携",
        "category": "custom",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "slack": {
        "name": "Slack",
        "description": "Slackメッセージとチャンネル管理",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "github": {
        "name": "GitHub",
        "description": "GitHubリポジトリとIssue管理（GitHub操作時）",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": True,
        "builtin": False
    },
    "notion": {
        "name": "Notion",
        "description": "Notionページとデータベース操作",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "brave-search": {
        "name": "Brave Search",
        "description": "プライバシー重視のウェブ検索（Tavily併用時は非推奨）",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "sentry": {
        "name": "Sentry",
        "description": "エラー追跡とパフォーマンス監視",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "twilio": {
        "name": "Twilio",
        "description": "SMS/音声通話API",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "mongodb": {
        "name": "MongoDB",
        "description": "MongoDBデータベース接続",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    },
    "mcp-postgres-server": {
        "name": "PostgreSQL",
        "description": "PostgreSQLデータベース接続",
        "category": "disabled",
        "apiKeyRequired": True,
        "recommended": False,
        "builtin": False
    }
}


@router.get(
    "/servers",
    response_model=MCPConfigResponse
)
async def get_mcp_servers():
    """
    Get list of available MCP servers from mcp-config.json
    Returns both enabled and disabled servers with metadata
    """
    try:
        # Read mcp-config.json from project root
        project_root = Path(
            os.getenv(
                'CONTAINER_PROJECT_ROOT',
                os.getenv('PROJECT_ROOT', '/workspace/project')
            )
        )
        default_config_path = project_root / 'mcp-config.json'
        config_path = Path(
            os.getenv('MCP_CONFIG_PATH', str(default_config_path))
        )
        with open(config_path, 'r') as f:
            config = json.load(f)

        mcp_servers = config.get("mcpServers", {})

        # Filter out comment keys and extract real servers
        servers = []
        for server_id, server_config in mcp_servers.items():
            if server_id.startswith("__"):
                continue  # Skip comment keys

            # Get metadata
            metadata = SERVER_METADATA.get(server_id, {
                "name": server_id.replace("-", " ").title(),
                "description": f"{server_id} MCP server",
                "category": "custom",
                "apiKeyRequired": True,
                "recommended": False,
                "builtin": False
            })

            command = str(server_config.get("command", ""))
            args = server_config.get("args", [])
            env = server_config.get("env")

            if not isinstance(args, list):
                args = []
            else:
                args = [str(arg) for arg in args]
            if env is not None and not isinstance(env, dict):
                env = None

            servers.append(MCPServerInfo(
                id=server_id,
                command=command,
                args=args,
                env=env,
                **metadata
            ))

        # Add built-in servers (time, fetch, git, memory, sequentialthinking)
        builtin_servers = ["time", "fetch", "git", "memory", "sequentialthinking"]
        for builtin_id in builtin_servers:
            if not any(s.id == builtin_id for s in servers):
                metadata = SERVER_METADATA[builtin_id]
                servers.append(MCPServerInfo(
                    id=builtin_id,
                    command="",
                    args=[],
                    env=None,
                    **metadata
                ))

        return {
            "servers": servers,
            "total": len(servers)
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="mcp-config.json not found"
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid JSON in mcp-config.json"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading MCP configuration: {str(e)}"
        )

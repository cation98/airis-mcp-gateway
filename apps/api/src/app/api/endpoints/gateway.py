"""Gateway control endpoints"""
from fastapi import APIRouter, HTTPException, status
import subprocess
import os

router = APIRouter(tags=["gateway"])


@router.post("/restart", response_model=dict)
async def restart_gateway():
    """Restart MCP Gateway to apply new secrets"""
    try:
        # Docker Compose restart command
        project_root = os.getenv(
            "PROJECT_ROOT",
            os.getenv("CONTAINER_PROJECT_ROOT", "/workspace/project")
        )

        result = subprocess.run(
            ["docker", "compose", "restart", "mcp-gateway"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to restart gateway: {result.stderr}"
            )

        return {
            "status": "success",
            "message": "MCP Gateway restarted successfully",
            "output": result.stdout
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Gateway restart timeout"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@router.get("/status", response_model=dict)
async def gateway_status():
    """Get MCP Gateway status"""
    try:
        project_root = os.getenv(
            "PROJECT_ROOT",
            os.getenv("CONTAINER_PROJECT_ROOT", "/workspace/project")
        )

        result = subprocess.run(
            ["docker", "compose", "ps", "mcp-gateway"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=10
        )

        is_running = "Up" in result.stdout

        return {
            "status": "running" if is_running else "stopped",
            "details": result.stdout
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get gateway status: {str(e)}"
        )

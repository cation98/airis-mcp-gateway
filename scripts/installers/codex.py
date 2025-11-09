"""Codex CLI installer."""

from __future__ import annotations

from pathlib import Path
import os
import re
import shlex
import subprocess
from typing import Optional

from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from .base import EditorInstaller


def normalize_http_url_to_http_mcp(url: Optional[str], default_http_url: str) -> str:
    """Normalize any provided URL to the Streamable HTTP MCP base."""
    target = url or default_http_url
    normalized = target.rstrip("/")
    if normalized.endswith("/sse"):
        normalized = normalized[: -len("/sse")]
    if not normalized.endswith("/mcp"):
        normalized = f"{normalized}/mcp"
    return normalized


def ensure_trailing_newline(text: str) -> str:
    return text if text.endswith("\n") else f"{text}\n"


def ensure_codex_bearer_env(text: str, server_name: str, env_name: str) -> str:
    """Ensure the Codex config includes bearer_token_env_var for our server."""
    section_header = f"[mcp_servers.{server_name}]"
    key_prefix = "bearer_token_env_var"

    lines = text.splitlines()
    section_index: Optional[int] = None

    for idx, line in enumerate(lines):
        if line.strip() == section_header:
            section_index = idx
            break

    if section_index is None:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append(section_header)
        lines.append(f'{key_prefix} = "{env_name}"')
        return ensure_trailing_newline("\n".join(lines))

    insert_pos = section_index + 1
    replaced = False

    while insert_pos < len(lines):
        stripped = lines[insert_pos].strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            break
        if stripped.startswith(key_prefix):
            lines[insert_pos] = f'{key_prefix} = "{env_name}"'
            replaced = True
            break
        insert_pos += 1

    if not replaced:
        lines.insert(insert_pos, f'{key_prefix} = "{env_name}"')

    return ensure_trailing_newline("\n".join(lines))


def probe_http_transport(url: str, bearer_env: Optional[str]) -> bool:
    """Issue a lightweight GET probe to confirm the HTTP MCP endpoint responds."""
    request_obj = urllib_request.Request(url, method="GET")

    if bearer_env:
        token = os.getenv(bearer_env)
        if token:
            request_obj.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib_request.urlopen(request_obj, timeout=5) as response:
            return 200 <= response.status < 400
    except HTTPError as exc:
        return exc.code in {401, 403, 405}
    except URLError:
        return False


def build_default_stdio_command(target_url: str, bearer_env: Optional[str]) -> str:
    """Return the default STDIO bridge command for Codex."""
    parts = [
        "npx",
        "-y",
        "mcp-proxy",
        "stdio-to-http",
        "--target",
        target_url,
    ]

    token = os.getenv(bearer_env) if bearer_env else None
    if token:
        parts.extend(["--header", f"Authorization: Bearer {token}"])

    return " ".join(shlex.quote(part) for part in parts)


class CodexInstaller(EditorInstaller):
    """Codex CLI installer that mirrors the previous monolithic script."""

    def name(self) -> str:
        return "Codex CLI"

    def config_path(self) -> Path:
        return Path.home() / ".codex" / "config.toml"

    # ------------------------------------------------------------------
    # Helpers copied from the legacy installer logic
    def _ensure_codex_feature_flags(self, text: str) -> str:
        pattern = re.compile(r"^\s*experimental_use_rmcp_client\s*=.*$", re.MULTILINE)
        text = pattern.sub("", text)

        lines = text.splitlines()
        output_lines = []
        features_found = False
        rmcp_set = False
        i = 0

        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            if stripped == "[features]":
                features_found = True
                output_lines.append(line)
                i += 1
                while i < len(lines):
                    next_line = lines[i]
                    next_stripped = next_line.strip()
                    if next_stripped.startswith("[") and next_stripped.endswith("]"):
                        if not rmcp_set:
                            output_lines.append("rmcp_client = true")
                            rmcp_set = True
                        break
                    if next_stripped.startswith("rmcp_client"):
                        output_lines.append("rmcp_client = true")
                        rmcp_set = True
                    else:
                        output_lines.append(next_line)
                    i += 1
                else:
                    if not rmcp_set:
                        output_lines.append("rmcp_client = true")
                        rmcp_set = True
                continue

            output_lines.append(line)
            i += 1

        if not features_found:
            if output_lines and output_lines[-1].strip():
                output_lines.append("")
            output_lines.append("[features]")
            output_lines.append("rmcp_client = true")
        elif not rmcp_set:
            output_lines.append("rmcp_client = true")

        result = "\n".join(output_lines)
        if not result.endswith("\n"):
            result += "\n"
        return result

    def _codex_cli_available(self) -> bool:
        try:
            subprocess.run(
                ["codex", "--version"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            return True
        except FileNotFoundError:
            print("   ❌ Codex CLI not found on PATH (expected 'codex').")
            return False

    def _remove_codex_server(self) -> None:
        subprocess.run(
            ["codex", "mcp", "remove", self.context.server_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    def _register_codex_http(self, url: str, bearer_env: Optional[str]) -> bool:
        if not probe_http_transport(url, bearer_env):
            print(f"   ⚠️ Streamable HTTP MCP probe failed for {url}")
            return False

        add_proc = subprocess.run(
            [
                "codex",
                "mcp",
                "add",
                "--enable",
                "rmcp_client",
                "--url",
                url,
                self.context.server_name,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        if add_proc.returncode != 0:
            error_msg = (add_proc.stderr or add_proc.stdout or "").strip()
            print(f"   ❌ Failed to register Codex HTTP MCP server: {error_msg or 'unknown error'}")
            return False

        return True

    def _register_codex_stdio(self, stdio_cmd: Optional[str]) -> bool:
        if not stdio_cmd:
            print("   ❌ CODEX_STDIO_CMD not set; cannot fall back to STDIO.")
            return False

        stdio_args = shlex.split(stdio_cmd)
        if not stdio_args:
            print("   ❌ CODEX_STDIO_CMD is empty; cannot register STDIO transport.")
            return False

        add_proc = subprocess.run(
            [
                "codex",
                "mcp",
                "add",
                "--enable",
                "rmcp_client",
                self.context.server_name,
                "--",
                *stdio_args,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        if add_proc.returncode != 0:
            error_msg = (add_proc.stderr or add_proc.stdout or "").strip()
            print(f"   ❌ Failed to register Codex STDIO MCP server: {error_msg or 'unknown error'}")
            return False

        return True

    # ------------------------------------------------------------------
    def install(self) -> bool:
        path = self.config_path()
        path.parent.mkdir(parents=True, exist_ok=True)

        try:
            existing_text = path.read_text(encoding="utf-8") if path.exists() else ""
        except Exception as exc:
            print(f"   ❌ Failed to read Codex config: {exc}")
            return False

        bearer_env_name = os.getenv("CODEX_GATEWAY_BEARER_ENV")
        if bearer_env_name and not os.getenv(bearer_env_name):
            print(f"   ⚠️ Environment variable '{bearer_env_name}' is not set; Codex HTTP auth may fail.")

        updated_text = self._ensure_codex_feature_flags(existing_text)
        if bearer_env_name:
            updated_text = ensure_codex_bearer_env(
                updated_text,
                self.context.server_name,
                bearer_env_name,
            )

        if updated_text != existing_text:
            try:
                path.write_text(updated_text, encoding="utf-8")
            except Exception as exc:
                print(f"   ❌ Failed to update Codex config: {exc}")
                return False

        if not self._codex_cli_available():
            return False

        codex_url = normalize_http_url_to_http_mcp(
            os.getenv("CODEX_GATEWAY_URL"),
            self.context.http_url,
        )

        stdio_cmd = os.getenv("CODEX_STDIO_CMD")
        if not stdio_cmd:
            stdio_cmd = build_default_stdio_command(codex_url, bearer_env_name)

        self._remove_codex_server()
        http_registered = self._register_codex_http(codex_url, bearer_env_name)
        if http_registered:
            return True

        print("   ⚠️ Streamable HTTP registration failed; attempting STDIO fallback...")
        self._remove_codex_server()
        return self._register_codex_stdio(stdio_cmd)

    def uninstall(self, backup_path: Optional[Path]) -> bool:
        """Remove the AIRIS Gateway server from Codex CLI."""
        if not self._codex_cli_available():
            return False

        print(f"   🗑️  Removing {self.context.server_name} from Codex CLI...")
        self._remove_codex_server()
        print(f"   ✅ Removed from Codex")
        return True

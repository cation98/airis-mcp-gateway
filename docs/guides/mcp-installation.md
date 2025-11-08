# MCP Installation Playbook

Practical checklist for installing and registering the AIRIS MCP Gateway across all supported editors. Use this when onboarding teammates or refreshing a local machine—the steps below consolidate the older research notes into one maintained guide.

---

## 1. Preferred One-Command Flows

| Scenario | Command | What It Does |
|----------|---------|--------------|
| All editors (Claude Desktop/Code, Cursor, Zed) | `make install` | Builds bundled MCP servers, imports existing configs, starts Docker stack, waits for health, registers every editor via `scripts/install_all_editors.py` |
| Claude-only quick setup | `make install-claude` | Delegates to `make install` but prints Claude-specific next steps |
| Development mode (UI + API extras) | `make install-dev` | Same as `make install` plus ensures Settings UI + FastAPI are running for local tweaking |
| Shell-friendly wrapper | `./scripts/install.sh` | Runs the same `make install` sequence after verifying Docker and sourcing `.env` overrides |

**After running any installer**
1. Restart every editor so they pick up the refreshed `mcp.json` symlink.
2. Run `/mcp` (Claude) or open the MCP panel (Cursor/Zed) to confirm `airis-mcp-gateway` is listed.
3. Use `make verify-claude` if you only need to confirm the Claude binding without restarting everything else.

---

## 2. Manual Registration Reference

When a teammate prefers hand-tuning their configs, point them here. The Gateway exposes:
- **Streamable HTTP MCP** (Codex) → `http://localhost:9100/api/v1/mcp` (or `http://api.gateway.localhost:9100/api/v1/mcp` inside Docker).
- **SSE transport** (Claude, Cursor, Zed) → `http://localhost:9090/api/v1/mcp/sse`.

### 2.1 Claude Code / Claude Desktop

```bash
claude mcp add --transport sse airis-mcp-gateway http://localhost:9090/api/v1/mcp/sse
```

Config file locations:

| Scope | Path |
|-------|------|
| User | `~/.claude/mcp.json` |
| Project | `./.mcp.json` (per repository) |
| Desktop managed file | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `C:\\Users\\<you>\\AppData\\Roaming\\Claude\\claude_desktop_config.json` (Windows) |

The Make targets create a symlink from `~/github/airis-mcp-gateway/mcp.json` to the correct scope so that local edits remain the single source of truth.

### 2.2 Cursor & Zed

| Editor | File |
|--------|------|
| Cursor | `~/.cursor/mcp.json` |
| Zed | `~/.config/zed/settings.json` (see `mcpServers` block) |

Both editors pick up changes immediately after restart. `scripts/install_all_editors.py` already writes these files, but keep the mapping handy for manual edits.

### 2.3 Codex CLI (Streamable HTTP + STDIO fallback)

```bash
# HTTP transport (preferred)
codex mcp remove airis-mcp-gateway 2>/dev/null || true
codex --enable rmcp_client mcp add airis-mcp-gateway --url http://api.gateway.localhost:9100/api/v1/mcp

# Optional: supply auth
export AIRIS_MCP_TOKEN="<token>"
export CODEX_GATEWAY_BEARER_ENV=AIRIS_MCP_TOKEN
```

If Codex cannot complete the HTTP handshake (returns 400/handshake failed), fall back to STDIO:

```bash
codex mcp remove airis-mcp-gateway 2>/dev/null || true
codex --enable rmcp_client mcp add airis-mcp-gateway -- npx -y mcp-proxy stdio-to-http \
  --target http://api.gateway.localhost:9100/api/v1/mcp \
  --header "Authorization: Bearer ${AIRIS_MCP_TOKEN}"
```

リポジトリ付属のインストーラも同じフローを自動化しています。まず HTTP 接続を試し、失敗したら `npx -y mcp-proxy stdio-to-http` へ切り替え、`CODEX_GATEWAY_BEARER_ENV` で指定したトークンがあれば `Authorization` ヘッダに載せます。別の STDIO コマンドを使いたいときだけ `CODEX_STDIO_CMD` を上書きしてください。

---

## 3. Health Checks & Troubleshooting

1. **Docker status** – `docker ps | grep airis-mcp-gateway` should show `healthy`. If it is still `starting`, rerun `make up` and wait ~60s.
2. **SSE probe** – `curl -I http://localhost:9090/api/v1/mcp/sse` must return `200/302`. Anything else means the FastAPI proxy is down.
3. **Config drift** – If editors are still talking to old servers, delete their `mcp.json` and rerun `make install` (the installer recreates symlinks safely).
4. **SuperClaude installer** – When embedding AIRIS via SuperClaude’s own installer, add a 60 s health-check loop (see `scripts/install_all_editors.py` for reference) so the SSE probe waits for Docker to finish booting.
5. **Uninstall / reset** – `make uninstall` rolls back the config import and stops Docker containers.

---

## 4. Automation Snippets

Use these snippets when integrating the Gateway into other installers or CI pipelines.

### scripts/install.sh

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo "Docker required"; exit 1; }
make install
```

The real script prints colored status output and loads `.env` overrides, but the logic boils down to “ensure Docker, then run `make install`”.

### Health-check loop (Python)

```python
for _ in range(60):
    status = subprocess.run(
        ["docker", "inspect", "--format", "{{.State.Health.Status}}", "airis-mcp-gateway"],
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip()
    if status == "healthy":
        break
    time.sleep(1)
else:
    raise RuntimeError("Gateway never became healthy")
```

Reuse this snippet inside external installers (SuperClaude, Codex CLI, etc.) before hitting the SSE endpoint.

---

## 5. Related Reading

- `docs/guides/mcp-best-practices.md` – Recommended server enablement/disablement and time-check workflow.
- `docs/research/mcp_installation_best_practices_20251018.md` – Historical research on ecosystem-wide installer patterns.
- `scripts/install_all_editors.py` – Source of truth for how we import/merge existing editor configs.

Need to update the playbook? Edit this file so we keep a single canonical reference instead of scattering notes across the repo.

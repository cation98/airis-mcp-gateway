# Augmentor Integration Playbook

This guide shows how to run the same augmentor package through both AIRIS MCP Gateway and local CLI adapters (SuperClaude / Codex). It is a companion to `docs/augmentor_abi.md`.

---

## 1. Repository Roles

| Repo | Responsibility |
| --- | --- |
| `airis-mcp-gateway` | Hosts the shared ABI, runtime helpers, and MCP deployment surface |
| `superagent` | Provides SuperClaude-specific UX (slash commands, prompts) but will consume augmentors via the ABI |

Both repos point at the same augmentor packages published to npm/PyPI or checked out locally.

---

## 2. Deployment Patterns

### Pattern A – Shared MCP Server (Recommended)

```
SuperClaude CLI  ┐
Codex CLI        ├─▶ MCP Client Adapter ─▶ AIRIS Gateway ─▶ Augmentor process
Other editors    ┘
```

1. AIRIS runs the augmentor as an MCP server (either via `mcp-config.json` or on-the-fly through the Settings UI).
2. SuperClaude and Codex use their native MCP clients to connect to the Gateway.
3. Schema partitioning + secret injection remain centralized, so augmentor authors only care about the ABI.

### Pattern B – Local CLI Adapter (Optional)

```
SuperClaude CLI ─▶ Augmentor Loader ─▶ Commands/Agents registered locally
Codex CLI      ─▶ Augmentor Loader ─▶ (same package)
```

1. CLI scans `~/.superclaude/augmentors` or `~/.codex/augmentors` for `augmentor.toml` files.
2. Loader imports the `entry` symbol and registers commands/agents directly inside the CLI process.
3. Optional MCP fallback: if the manifest exposes `mcp` metadata, the CLI can also proxy to AIRIS Gateway when available.

---

## 3. Adapter Checklist

### SuperClaude
- [ ] Watch `~/.superclaude/augmentors/*/augmentor.toml` and hot reload on change.
- [ ] Map `commands[].name` to `/sc:<name>` slash commands.
- [ ] Pass conversation history via `ctx.history` for agents.
- [ ] Surface `permissions` as consent prompts inside Claude Code.

### Codex CLI
- [ ] Provide `codex augment install path/to/package` that copies/links manifest + code.
- [ ] Register commands in the CLI plugin registry and expose them as MCP tools when `--enable rmcp_client` is on.
- [ ] Reuse AIRIS Gateway connection details from `mcp.json` if present; otherwise run augmentor locally.

### AIRIS MCP Gateway
- [ ] Extend `mcp-config.json` schema to allow `augmentor` entries (command: `npx @airis-mcp/augmentor-runtime serve ./augmentor.toml`).
- [ ] Auto-generate MCP tool schemas from `commands[].schema`.
- [ ] Apply existing schema-partitioning + auth flows so augmentors “just work” for any MCP-compatible IDE.

---

## 4. Minimal Flow Demo

1. **Authoring** – In `superagent` (or a standalone repo) create `augmentor.toml` + package using the runtime helpers.
2. **Local Test** – Run `pnpm --filter @airis-mcp/augmentor-runtime build` and execute the sample factory via node/python to ensure it returns `AugmentorPackage`.
3. **MCP Wiring** – Add the package to `mcp-config.json`:

```json
"super-echo": {
  "command": "node",
  "args": ["./node_modules/.bin/augmentor-cli", "serve", "./augmentors/super-echo/augmentor.toml"],
  "enabled": true
}
```

4. **CLI Wiring** – Point SuperClaude/Codex adapters at the same manifest. If AIRIS Gateway is running, they can simply connect over MCP; otherwise they load the package locally.

This dual-path demo proves that augmentors load in both environments without code changes.

---

## 5. Next Work Items

1. Implement the `augmentor-cli serve` command (wraps the runtime and exposes MCP transports).
2. Port existing SuperClaude commands (pm, research, design…) onto the ABI to validate ergonomics.
3. Create automated contract tests (`tests/augmentor_contract/`) that execute a fixture augmentor via both adapters and compare results.

Use this playbook as the living reference while we continue migrating logic from `superagent` into the shared ABI and runtime layers.


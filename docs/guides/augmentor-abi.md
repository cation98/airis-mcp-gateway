# Augmentor ABI Specification (Draft)

Defines the neutral interface between SuperClaude/SuperAgent style plugins and any host runtime (Codex CLI, AIRIS MCP Gateway, Claude Code). The goal is “write once, run anywhere”: the same augmentor package can be loaded as a CLI extension **or** exposed via MCP tools without rewriting business logic.

---

## 1. Design Goals

- **Neutral ABI:** No Anthropic/Codex specific imports inside plugin logic.
- **Manifest driven:** Declarative discovery that works for Python and Node runtimes.
- **Deterministic IO:** Explicit schemas for command arguments, agent messages, streaming events.
- **MCP friendly:** Each augmentor can be projected into `tools/list` / `tools/call` without extra glue.
- **Sandbox aware:** Hosts can deny file/network access up front via capabilities flags.

---

## 2. Manifest Schema (`augmentor.toml`)

```toml
name = "biddb"
version = "0.2.0"
description = "Bid database + PM assistant"
entry = "biddb.factory"
runtime = "python"  # "python" | "node"
caps = ["command", "agent", "stream"]

[permissions]
filesystem = "read"
network = "https"
secrets = ["TAVILY_API_KEY"]

[mcp]
tool_prefix = "biddb"
```

| Field | Description |
| --- | --- |
| `entry` | Python import path or Node export that returns an `AugmentorPackage` |
| `caps` | Optional capabilities: `command`, `agent`, `tool`, `stream`, `memory` |
| `permissions` | Declarative hint for host prompts (auto maps to Codex “allow” dialogue) |
| `mcp.tool_prefix` | Optional namespace for derived MCP tool IDs |

The manifest lives alongside the package (`augmentor.toml + src/…` in Python, `augmentor.toml + package.json` for Node). Hosts cache the parsed document and hot‑reload when the file changes.

---

## 3. Runtime Interfaces

### 3.1 Python Protocols

```python
from typing import Protocol, TypedDict, Any, Optional

class AugmentorContext(TypedDict, total=False):
    run_id: str
    cwd: str
    env: dict[str, str]
    mcp_client: "MCPClient"
    telemetry: dict[str, Any]

class AugmentorCommand(Protocol):
    name: str
    schema: dict[str, Any]

    async def run(self, args: dict[str, Any], ctx: AugmentorContext) -> dict[str, Any]: ...

class AugmentorAgent(Protocol):
    id: str
    schema: dict[str, Any]

    async def handle(
        self, message: str, ctx: AugmentorContext, *, history: Optional[list[dict]] = None
    ) -> dict[str, Any]: ...

class AugmentorPackage(TypedDict):
    commands: list[AugmentorCommand]
    agents: list[AugmentorAgent]
    tools: list[dict[str, Any]]  # Optional MCP projections
```

### 3.2 TypeScript Interfaces

```ts
export interface AugmentorContext {
  runId: string;
  cwd: string;
  env: Record<string, string>;
  mcpClient?: McpClient;
  telemetry?: Record<string, unknown>;
}

export interface AugmentorCommand {
  name: string;
  schema: JSONSchema;
  run(args: unknown, ctx: AugmentorContext): Promise<unknown>;
}

export interface AugmentorAgent {
  id: string;
  schema: JSONSchema;
  handle(input: AgentInput, ctx: AugmentorContext): Promise<AgentOutput>;
}

export interface AugmentorPackage {
  commands?: AugmentorCommand[];
  agents?: AugmentorAgent[];
  tools?: McpToolDescriptor[];
}
```

Hosts only depend on the interface; the package may internally use FastAPI, LangChain, etc., as long as it satisfies the protocol.

---

## 4. Lifecycle & Event Flow

1. **Discovery:** Host scans `augmentor.toml` files (local path, npm/pip installed package, or MCP server bundle metadata).
2. **Load:** Host imports `entry` and calls `factory(**host_hooks)`; result must be an `AugmentorPackage`.
3. **Registration:**
   - CLI hosts map `commands` to slash commands or subcommands.
   - MCP hosts create `tools/list` entries from `commands`/`tools` with `tool_prefix`.
4. **Invocation:** Host assembles `AugmentorContext` (run id, working dir, env, handles to MCP, persistent stores) and calls `run`/`handle`.
5. **Streaming (optional):** If `"stream" in caps`, host passes a `stream` callback inside `ctx` so augmentors can emit partial tokens.
6. **Teardown:** Hosts may call optional `shutdown()` exported by the package when the CLI exits.

Error contract: Commands raise `AugmentorError(code: str, message: str, data: dict | None)`; hosts translate into CLI/MCP errors with consistent JSON structure.

---

## 5. Adapter Responsibilities

| Host | Adapter Duties |
| --- | --- |
| **SuperClaude CLI** | Load augmentors from `~/.superclaude/augmentors`, mirror `/sc:*` commands, map `ctx.cwd` to active workspace, expose Claude chat history via `history` parameter. |
| **Codex CLI** | Register commands via `codex plugin install`, forward tool permissions to augmentor via `ctx.env["CODEX_PERMISSION_*"]`, translate function-calling payloads to ABI schema. |
| **AIRIS MCP Gateway** | Run augmentors as MCP server processes. Each augmentor becomes a tool; Gateway handles schema partitioning + secret injection. |

Both CLI adapters can also operate as thin MCP clients that dial into AIRIS Gateway. This dual-path design keeps augmentors host-agnostic while allowing Codex to pick either “local plugin” or “remote MCP” mode.

---

## 6. Packaging Layout

```text
my-augmentor/
├── augmentor.toml
├── pyproject.toml (or package.json)
├── src/
│   └── my_augmentor/__init__.py
└── README.md
```

Distribute via PyPI (`pip install my-augmentor`) and npm (`npm install my-augmentor`). The same source tree can house both by sharing manifest + core logic, then exporting thin Python/Node bindings where necessary.

---

## 7. Minimal Examples

### Python

```python
# src/example_augmentor/__init__.py
from typing import Any

class EchoCommand:
    name = "echo"
    schema = {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
    }

    async def run(self, args: dict[str, Any], ctx):
        return {"output": args["text"], "cwd": ctx.get("cwd")}


def factory(**_kwargs):  # entry = "example_augmentor.factory"
    return {"commands": [EchoCommand()], "agents": []}
```

### Node

```ts
// src/index.ts, entry = "dist/index.factory"
export function factory() {
  const echo = {
    name: "echo",
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    async run(args, ctx) {
      return { output: args.text, cwd: ctx.cwd };
    },
  };

  return { commands: [echo], agents: [] };
}
```

---

## 8. Next Steps

1. Publish `augmentor-runtime` helper packages (`packages/augmentor-runtime` in this repo) providing:
   - Schema validation helpers (Zod/pydantic wrappers)
   - Context shaping utilities (MCP client injection)
   - Error helpers (`raise AugmentorError(code, message, data)`).
2. Build Codex + SuperClaude adapters atop the runtime.
3. Convert existing SuperClaude slash commands into augmentors (mechanical refactor).

Once the ABI stabilizes we can formalize versioning (`abi = "1.0"` field in manifest) and ship validation tooling that runs in CI for new augmentors.


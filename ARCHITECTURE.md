# AIRIS Architecture

## Responsibility = Repository = OCI Image

Each repository has ONE responsibility and produces ONE OCI image.

| Repository | Responsibility | Image |
|------------|---------------|-------|
| `airis-mcp-gateway` | MCP routing/proxy | `ghcr.io/agiletec-inc/airis-mcp-gateway` |
| `airis-agent` | PM logic (Confidence, Self-Check, Reflexion, PDCA) | `ghcr.io/agiletec-inc/airis-agent` |
| `mindbase` | Long-term memory storage | `ghcr.io/agiletec-inc/mindbase` |
| `airis-workspace` | Toolchain (monorepo management) | `ghcr.io/agiletec-inc/airis-workspace` |

## airis-mcp-gateway (This Repository)

### Allowed Responsibilities

- MCP server registration and multiplexing
- SSE/JSON-RPC transport proxy
- Process server management (lazy loading, idle kill)
- Schema partitioning for token optimization
- Server enable/disable at runtime
- Prometheus metrics
- Rate limiting and auth (future)
- Audit logging (future)

### Prohibited

- **NO PM Logic**: ConfidenceChecker, SelfCheckProtocol, ReflexionPattern
- **NO Intent Detection**: 7-verb intent routing
- **NO Capability Routing**: Decision logic for which server to use
- **NO Orchestration**: PDCA cycles, multi-step workflows

These belong in `airis-agent`.

## Cross-Repository Communication

Services communicate via **API/MCP only**. No git submodules.

```
Claude Code
    |
    v
airis-mcp-gateway (port 9400)
    |
    +-- MCP proxy --> Docker MCP Gateway --> mindbase, time, etc.
    |
    +-- Process mgmt --> airis-agent (uvx)
                         |
                         +-- PM logic (Confidence, Self-Check, Reflexion)
                         +-- 7-verb Intent Routing
                         +-- PDCA Orchestrator
```

## Deployment

### Lite Mode (Default)

Gateway + process-based MCP servers (uvx/npx):

```bash
docker compose up -d
```

### Full Mode

All services as Docker containers:

```bash
docker compose -f infra/compose.yaml --profile full up -d
```

## Adding New Features

### If the feature is routing/proxy related:

Add to `airis-mcp-gateway`.

### If the feature involves decision-making, learning, or orchestration:

Add to `airis-agent` and expose via MCP tool.

### If the feature involves persistent storage or memory:

Add to `mindbase` and expose via MCP tool.

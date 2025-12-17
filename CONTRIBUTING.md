# Contributing to airis-mcp-gateway

## Repository Scope

This repository is **routing/proxy only**. Before contributing, read [ARCHITECTURE.md](./ARCHITECTURE.md).

## What Belongs Here

- MCP transport (SSE, JSON-RPC, stdio)
- Server lifecycle management (start, stop, health check)
- Request routing and proxying
- Schema partitioning and token optimization
- Metrics and observability
- Rate limiting and authentication

## What Does NOT Belong Here

| Feature | Correct Repository |
|---------|-------------------|
| Intent detection | `airis-agent` |
| Capability routing | `airis-agent` |
| ConfidenceChecker | `airis-agent` |
| SelfCheckProtocol | `airis-agent` |
| ReflexionPattern | `airis-agent` |
| PDCA Orchestrator | `airis-agent` |
| Memory storage | `mindbase` |
| Graph relationships | `mindbase` |

## Pull Request Checklist

- [ ] Does this change add PM logic? If yes, submit to `airis-agent` instead.
- [ ] Does this change add storage logic? If yes, submit to `mindbase` instead.
- [ ] Is the change routing/proxy focused?
- [ ] Are tests included?
- [ ] Is documentation updated?

## Development

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f api

# Run tests
cd apps/api && pytest tests/

# Restart after config changes
docker compose restart api
```

## Commit Convention

```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code restructuring
- docs: Documentation
- test: Tests
- chore: Maintenance
```

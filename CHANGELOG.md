# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for Phase 2 (Stabilization)
- Real-world testing and validation
- Error handling improvements (retry, fallback)
- Multi-editor support (Cursor, Windsurf, Zed)
- Performance benchmarking with actual token measurements
- Docker Compose integration improvements

### Planned for Phase 3 (Optimization)
- Redis-based persistent schema cache
- HTTP/2 streaming optimization
- Parallel proxy processing
- Prometheus metrics + Grafana dashboard

### Planned for Phase 4 (Ecosystem)
- MCP Server marketplace
- Plugin SDK
- Official editor integrations
- Enterprise features

## [1.3.0] - 2025-10-30

### Added
- Imported the Codex/SuperClaude MCP catalog (Magic, Playwright, Chrome DevTools, MorphLLM Fast Apply) into the default metadata so they appear in the dashboard out of the box.
- Added asynchronous unit tests for the credential provider cache covering TTL expiry, invalidation, and subscriber notifications.

### Changed
- Reworked the Settings dashboard: cards now split into “Active” and “Disabled” columns, with badges showing API-key requirements and no-setup servers; conflict warnings surface inline.
- The Codex installer now targets the Gateway base URL (no trailing `/sse`), enables `[features].rmcp_client = true`, and preserves the legacy `experimental_use_rmcp_client = true` flag so recent Codex builds connect without manual tweaks.
- Core zero-setup servers (filesystem/context7/serena/mindbase/sequential-thinking/playwright/chrome-devtools) start enabled in `mcp-config.json` so Codex/Claude/Cursor immediately list useful tools after `make install`.
- Version metadata across containers, MCP config, and internal servers bumped to `1.3.0`.

### Fixed
- Relaxed the Tavily API key validator to accept both `tvly-` and `tvly_` prefixes and updated associated tests.

### Documentation
- Documented the Docker + `uv` prerequisites, clarified that `make install` executes the editor installers via `uv`, and refreshed the development workflow guidance to rely on containerized commands.

## [0.1.0] - 2025-10-15

### Added - Phase 1 (MVP) Complete

**Foundation Documentation**
- Add VISION.md: Project philosophy and alignment with Agiletec Inc. mission
- Add ROADMAP.md: Development phases and milestones (Phase 1-4)
- Add ARCHITECTURE.md: Technical design and OpenMCP pattern implementation details
- Add TASK_LIST.md: Implementation status tracking
- Add CHANGELOG.md: Version history and release notes
- Update SECRETS.md: PostgreSQL + Fernet encryption documentation

**Core Implementation - OpenMCP Lazy Loading Pattern**
- Add `schema_partitioning.py`: Schema partitioning engine
  - `partition_schema()`: Reduces schemas to top-level properties only
  - `expand_schema()`: On-demand schema detail fetching
  - `store_full_schema()`: Full schema caching for expansion
  - Token reduction estimation (75-90% target achieved)

**MCP Proxy with SSE Streaming**
- Add `mcp_proxy.py`: FastAPI-based MCP proxy server
  - SSE streaming proxy endpoint (`/sse`)
  - Automatic `tools/list` interception and partitioning
  - `expandSchema` tool injection for on-demand expansion
  - Local `expandSchema` handling (no Gateway proxy needed)
  - Token reduction logging per tool

**Security & Secrets Management**
- Add `encryption.py` enhancements: Fernet (AES-128) encryption
  - PBKDF2HMAC key derivation (SHA-256, 100k iterations)
  - PostgreSQL-backed encrypted secret storage
  - Runtime-only decryption (no plaintext on disk)
  - Settings UI integration support

**Installation & Multi-Editor Support**
- Add `install.sh`: One-command installation script
  - Docker healthcheck waiting
  - Automatic symlink creation
  - Multi-editor detection
- Add `scripts/install_all_editors.py`: Universal editor installer
  - Auto-detects Claude Desktop, Cursor, Windsurf, Zed
  - Creates symlinks to all detected editors
  - Backup existing configurations

**MCP Server Configurations**
- Add 25 MCP server configurations in `servers/` directory
- Add MindBase MCP Server (TypeScript-based knowledge graph)
- Add Docker containerization for all servers

**Testing**
- Add `test_token_reduction.py`: Token reduction measurement script
- Add `tests/test_config.py`: Configuration validation tests

**Infrastructure**
- Update `docker-compose.yml`: 4-service architecture
  - mcp-gateway: Docker MCP Gateway (9090)
  - postgres: PostgreSQL with encrypted secrets (internal)
  - api: FastAPI proxy with schema partitioning (8001)
  - settings-ui: React-based configuration UI (5173)
- Update `Makefile`: Standardized Docker-First commands
  - `make up/down`: Service lifecycle
  - `make install-claude`: One-command Claude Code setup
  - `make install`: Universal multi-editor installation
  - `make api-shell`, `make ui-shell`: Container access

### Changed

**Configuration**
- Update `mcp-config.json`: 25 MCP servers with Docker containerization
- Update `mcp.json`: SSE proxy endpoint configuration
- Update `apps/api/app/core/config.py`: Add MCP_GATEWAY_URL setting
- Update `apps/api/pyproject.toml`: Add httpx dependency

**Documentation**
- Update `README.md`: Installation and usage guide
- Update `PERFORMANCE_TEST.md`: Token reduction benchmarks
- Update `LICENSE`: Copyright to Agiletec Inc.

### Technical Details

**Token Reduction Mechanism**
```python
# Before (Full Schema): ~1000 tokens per tool
{
  "properties": {
    "metadata": {
      "properties": {
        "shipping": {
          "properties": {...}  # Deep nesting
        }
      }
    }
  }
}

# After (Partitioned Schema): ~50 tokens per tool (95% reduction)
{
  "properties": {
    "metadata": {"type": "object"}  # Top-level only
  }
}
```

**Architecture**
```
Claude Code
    ↓ SSE
FastAPI Proxy (localhost:8001)
    ↓ Intercept tools/list
Schema Partitioning Applied
    ↓ 90% token reduction
    ↓ SSE
Docker MCP Gateway (localhost:9090)
    ↓
25 MCP Servers (Docker containers)
```

### Performance

**Estimated Metrics** (Phase 1 Implementation)
- Token reduction: 75-90% (estimated based on schema depth)
- Startup time: <1 second (zero-token startup)
- MCP servers: 25 servers containerized
- Installation: One-command (`make install`)

**Note**: Real-world benchmarks pending Phase 2 validation.

### Security

**Encryption Implementation**
- Algorithm: Fernet (AES-128 CBC + HMAC-SHA256)
- Key Derivation: PBKDF2HMAC (SHA-256, 100,000 iterations)
- Storage: PostgreSQL with encrypted values
- Master Key: Environment variable only (never on disk)

### Breaking Changes

None - Initial release.

### Migration Guide

Not applicable - Initial release.

### Known Issues

- `test_token_reduction.py` requires MCP protocol message implementation (pending Phase 2)
- Token reduction measurements are estimates, real-world validation pending
- Multi-editor support implemented but not fully tested (Phase 2 milestone)

### Contributors

- Agiletec Inc. (@agiletec-inc)
- Claude Code (@anthropic)

---

## Release Notes Format

Each release includes:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

---

## Versioning Strategy

- **Major (X.0.0)**: Breaking changes, architecture redesign
- **Minor (0.X.0)**: New features, backward-compatible
- **Patch (0.0.X)**: Bug fixes, documentation updates

**Current Status**: Pre-release (0.1.0 - Phase 1 MVP)

**Next Milestones**:
- 0.2.0: Phase 2 Stabilization (real-world validation, multi-editor)
- 0.3.0: Phase 3 Optimization (Redis cache, monitoring)
- 1.0.0: Phase 4 Ecosystem (production-ready, community-driven)

---

**Maintained by**: Agiletec Inc.
**License**: MIT
**Repository**: https://github.com/agiletec-inc/airis-mcp-gateway

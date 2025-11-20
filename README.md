# AIRIS MCP Gateway

**All-in-one MCP hub that gives you access to 15+ AI tools through a single connection.**

Just start the Gateway and connect Claude Code - no separate installations needed.

---

## 🎯 What You Get

The Gateway automatically provides these MCP servers when you connect:

### Intelligence & Analysis
- **airis-agent** (10 tools) - Confidence checks, deep research, repo indexing, self-review, MCP server management
- **context7** - Official documentation search for frameworks and libraries

### Workspace Management
- **airis-workspace** (5 tools) - Initialize, validate, and sync monorepo workspaces

### Memory & Context
- **mindbase** - Cross-session memory with semantic search
- **serena** - Session management and project context
- **memory** - Conversation memory

### Utilities
- **filesystem** - File operations
- **git** - Git operations
- **fetch** - Web fetching
- **time** - Current timestamp
- **sequential-thinking** - Structured reasoning

**All managed from one place.** The Gateway handles installation, updates, and orchestration.

## 🚀 Quick Install (3 Steps)

```bash
# 1. Clone and enter directory
git clone https://github.com/agiletec-inc/airis-mcp-gateway.git
cd airis-mcp-gateway

# 2. Start the Gateway
docker compose up -d

# 3. Connect to Claude Code
claude mcp add --transport http airis-mcp-gateway http://api.gateway.localhost:9400/api/v1/mcp
```

**That's it!** All 15+ MCP tools are now available in Claude Code.

### What This Enables

- ✅ **Confidence checks** before implementation (25-250x token savings)
- ✅ **Deep research** with evidence synthesis and source tracking
- ✅ **Repository indexing** with 94% token reduction
- ✅ **Workspace management** for monorepos (init, validate, sync)
- ✅ **Cross-session memory** that persists across conversations
- ✅ **Self-review** and post-implementation validation
- ✅ **Dynamic MCP server control** (enable/disable tools on demand)

---

## Requirements

- **Docker** (Desktop, OrbStack, or Docker Engine + Compose v2)
- **Git** (preinstalled on macOS)
- **Claude Code** (for connecting to the Gateway)

That's all you need. The Gateway manages everything else.

---

## 🔧 Advanced Configuration

### Environment Variables

Copy `.env.example` to `.env` to customize:
- Ports (`GATEWAY_LISTEN_PORT`, `API_LISTEN_PORT`, etc.)
- Database credentials
- MCP server settings

```bash
cp .env.example .env
# Edit .env as needed
docker compose up -d
```

### MCP Server Management

Edit `mcp-config.json` to enable/disable specific servers:

```json
{
  "mcpServers": {
    "airis-agent": { "enabled": true },
    "context7": { "enabled": false }
  }
}
```

Or use the **self-management tools** to control servers dynamically:
- `list_mcp_servers` - See all available servers
- `enable_mcp_server` - Enable a server on-demand
- `disable_mcp_server` - Disable to reduce token usage

### Endpoints

Once running, these are available:
- **MCP HTTP**: `http://api.gateway.localhost:9400/api/v1/mcp`
- **API docs**: `http://api.gateway.localhost:9400/docs`
- **Settings UI**: `http://ui.gateway.localhost:5273`

---

## 📋 Common Commands

```bash
# Start/stop
docker compose up -d          # Start all services
docker compose down           # Stop all services
docker compose restart        # Restart all services

# View status and logs
docker compose ps             # Show running containers
docker compose logs -f        # Follow all logs
docker compose logs -f api    # Follow specific service

# Development
docker compose exec workspace sh    # Enter workspace shell
docker compose exec api sh          # Enter API shell
```

---

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Containers won't start** | `docker compose logs <service>` to see errors, then `docker system prune` |
| **Ports already in use** | Edit `.env` to change ports, then `docker compose down && docker compose up -d` |
| **Claude Code not seeing tools** | Ensure Gateway is running (`docker compose ps`) and reconnect |
| **Tools not appearing** | Check `mcp-config.json` - ensure servers have `"enabled": true` |

---

## 🤝 Contributing

1. Fork and create a branch from `main`
2. Make your changes
3. Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, etc.)
4. Test locally with `docker compose up -d`
5. Submit a pull request

---

## 📚 Learn More

- [AIRIS Agent](https://github.com/agiletec-inc/airis-agent) - Intelligence layer and MCP tools
- [AIRIS Workspace](https://github.com/agiletec-inc/airis-workspace) - Monorepo workspace manager
- [MindBase](https://github.com/kazukinakai/mindbase) - Cross-session memory
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification

---

**Built with ❤️ by [Agiletec](https://github.com/agiletec-inc)**

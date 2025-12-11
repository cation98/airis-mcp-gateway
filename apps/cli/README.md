# @agiletec/airis-mcp-gateway

**AIRIS MCP Gateway** - Unified MCP server management for Claude Code, Claude Desktop, Cursor, Zed, and more.

Centralized management for 25+ MCP servers. Solves token explosion and editor configuration hell.

## Quick Install

```bash
# Install globally
npm install -g @agiletec/airis-mcp-gateway

# Install and configure all editors
airis-gateway install

# Or use npx (no installation required)
npx @agiletec/airis-mcp-gateway install
```

**That's it!** Restart your editors and 25 MCP servers are ready everywhere.

## Features

- ✅ **Zero-Token Startup**: Tool definitions loaded on-demand only
- ✅ **Multi-Editor Support**: Claude Code, Claude Desktop, Cursor, Zed
- ✅ **One-Command Install**: Automatic setup for all editors
- ✅ **Docker-First**: All servers run in isolated containers
- ✅ **Secure Secret Management**: Docker Secrets + encrypted PostgreSQL
- ✅ **State Persistence**: Settings saved across sessions

## Commands

### Installation

```bash
# Install to all supported editors
airis-gateway install

# Install to Claude Code only
airis-gateway install --claude-only

# Uninstall and restore original configs
airis-gateway uninstall
```

### Management

```bash
# Start Gateway
airis-gateway start

# Stop Gateway
airis-gateway stop

# Check status
airis-gateway status

# View logs
airis-gateway logs
airis-gateway logs --follow  # Follow log output

# Update to latest version
airis-gateway update
```

## Access URLs

After installation:
- **Gateway**: http://gateway.localhost:9390
- **Settings UI**: http://ui.gateway.localhost:5273
- **API Docs**: http://api.gateway.localhost:9400/docs
- *(Need internal-only networking? Remove host port bindings in `docker-compose.yml` before running `just up`.)*

## Requirements

- **Docker**: Required (Docker Desktop or OrbStack on macOS)
- **Node.js**: >= 18.0.0
- **Git**: For repository cloning

## Available MCP Servers (25 Total)

### Core Tools
- `filesystem`, `context7`, `serena`, `mindbase`
- `time`, `fetch`, `git`, `memory`, `sequential-thinking`

### Search & AI
- `tavily`, `brave-search`

### Databases
- `supabase`, `postgres`, `mongodb`, `sqlite`

### Productivity
- `notion`, `slack`, `figma`

### Development
- `github`, `puppeteer`, `sentry`

### Payments & APIs
- `stripe`, `twilio`

[See full list with descriptions →](https://github.com/agiletec-inc/airis-mcp-gateway#-available-mcp-servers-25-total)

## Profile Management

AIRIS Gateway provides curated profiles to optimize your workflow:

```bash
# After installation, switch profiles via Makefile
cd ~/.airis-mcp-gateway

# Recommended Profile (long-term projects)
just profile-recommended
just restart

# Minimal Profile (quick tasks, low resources)
just profile-minimal
just restart
```

| Profile | Servers | Memory | Use Case |
|---------|---------|--------|----------|
| **Recommended** | filesystem, context7, serena, mindbase | ~500MB | Long-term projects, LLM failure learning |
| **Minimal** | filesystem, context7 | ~50MB | Short tasks, resource constraints |

## Troubleshooting

### Gateway not starting

```bash
# Check Docker status
docker ps

# View Gateway logs
airis-gateway logs

# Restart Gateway
airis-gateway stop
airis-gateway start
```

### Editor not recognizing MCP servers

1. Ensure Gateway is running: `airis-gateway status`
2. Restart your editor completely
3. Check editor-specific MCP configuration:
   - Claude Code: Run `/mcp` command
   - Claude Desktop: Check Settings > Extensions
   - Cursor: Settings > Features > MCP Servers

### Permission errors

```bash
# Ensure executable permissions
chmod +x ~/.airis-mcp-gateway/scripts/install_all_editors.py
```

## Documentation

- [Full README](https://github.com/agiletec-inc/airis-mcp-gateway)
- [Secret Management Guide](https://github.com/agiletec-inc/airis-mcp-gateway/blob/master/SECRETS.md)
- [MCP Best Practices](https://github.com/agiletec-inc/airis-mcp-gateway/blob/master/docs/guides/mcp-best-practices.md)

## Support

If AIRIS Gateway helps your workflow:

- ☕ [Ko-fi](https://ko-fi.com/kazukinakai)
- 🎯 [Patreon](https://www.patreon.com/kazukinakai)
- 💜 [GitHub Sponsors](https://github.com/sponsors/kazukinakad)

## License

MIT License - Free to use commercially

---

**Created by**: [Agiletec Inc.](https://github.com/agiletec-inc)

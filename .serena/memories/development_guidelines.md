# Development Guidelines

## Platform-Specific Notes (macOS/Darwin)

### System Commands
- **Package Manager**: Homebrew (standard macOS package manager)
- **Docker**: OrbStack (Mac-native Docker runtime)
- **Shell**: zsh (default macOS shell)
- **File System**: Case-insensitive by default (APFS)

### Standard Unix Commands Available
```bash
ls, cd, grep, find, cat, less, tail, head
git, docker, docker compose
curl, wget (if installed)
```

### macOS-Specific Considerations
- Use `lsof -i :<port>` to check port usage (not `netstat`)
- `.DS_Store` files must be gitignored
- File paths: `/Users/kazuki/github` (not `/home/`)
- Docker socket: `/var/run/docker.sock` (OrbStack compatible)

## Design Patterns

### Gateway Pattern
**Problem**: Token explosion from loading all MCP tool descriptions
**Solution**: Single Gateway URL that dynamically loads tools on demand
**Benefits**:
- Zero token consumption until tools are used
- Unified configuration across all editors
- Single point of control for all MCP servers

### Docker-First Architecture
**Principle**: Zero host pollution - all dependencies run in containers
**Implementation**:
- Gateway runs all MCP servers internally
- `npx` and `uvx` execute inside Gateway container
- Host only needs Docker/OrbStack installed
- No Node.js, Python, or other runtimes on Mac

### Symlink Configuration Management
**Pattern**: Master config with symlinks to all editors/projects
**Structure**:
```
~/github/airis-mcp-gateway/mcp.json (master)
    ↓ symlink
├─ ~/.claude/mcp.json (global)
├─ ~/github/project1/mcp.json
└─ ~/github/project2/mcp.json
```
**Benefits**:
- Single point of configuration
- Changes propagate automatically
- Editor-agnostic design

### Secrets Management
**Preferred**: Docker secrets (encrypted, runtime-only injection)
**Fallback**: .env file (gitignored)
**Never**: Hardcoded in configuration files

## Security Guidelines

### API Key Handling
✅ **Correct**:
```json
{
  "env": {
    "API_KEY": "${API_KEY}"
  }
}
```
```bash
docker mcp secret set API_KEY=value
```

❌ **Wrong**:
```json
{
  "env": {
    "API_KEY": "sk_live_actual_key_here"
  }
}
```

### Secrets Storage
- **Docker secrets**: Encrypted in Docker Desktop/OrbStack
- **Environment variables**: From .env file (gitignored)
- **Never commit**: `.env` files or actual secret values
- **Safe to commit**: `.env.example`, `mcp-config.json`, `mcp.json`

### Secret Injection Pattern
```bash
# Bash command wrapper for reading secrets
"command": "bash",
"args": ["-c", "API_KEY=$(cat /run/secrets/key || echo ${API_KEY}) npx server"]
```
Fallback order: Docker secret → Environment variable

## Project-Specific Patterns

### MCP Server Configuration
**Naming Conventions**:
- Active servers: `"server-name": { ... }`
- Disabled servers: `"__disabled_server-name": { ... }`
- Comments: `"__comment_section": "description"`

**Configuration Structure**:
```json
{
  "mcpServers": {
    "__comment_category": "=== CATEGORY NAME ===",
    "active-server": {
      "command": "npx",
      "args": ["-y", "package-name"],
      "env": { "KEY": "${VALUE}" }
    },
    "__disabled_inactive": { ... }
  }
}
```

### Docker Compose Patterns
**Multi-stage Services**:
1. Base service (docker-compose.yml)
2. Override for local dev (docker-compose.override.yml)
3. Traefik routing in override

**Health Checks**:
- All services must have health checks
- Standard: 30s interval, 10s timeout, 3 retries
- Gateway: 40s start period (longer initialization)

**Volume Strategy**:
- Persistent data: Named volumes (`claude-memory`)
- Source code: Host mounts (`:rw` for read-write)
- Configs: Read-only mounts (`:ro`)

### Frontend (React) Patterns

**Component Organization** (assumed standard):
```
src/
├── components/     # Reusable UI components
├── pages/          # Route-level pages
├── hooks/          # Custom React hooks
├── utils/          # Helper functions
├── types/          # TypeScript definitions
└── i18n/           # Internationalization
```

**i18n Pattern**:
- i18next + react-i18next
- Browser language detection
- Bilingual support (EN + JA)
- Keep documentation in sync with UI translations

**Build Configuration**:
- Vite for fast dev server and optimized builds
- SWC for fast TypeScript compilation
- Tailwind for utility-first styling
- ESLint for code quality

## Error Handling

### Gateway Issues
```bash
# 1. Check if running
docker ps | grep mcp-gateway

# 2. View logs
docker logs docker-mcp-gateway

# 3. Check config validity
cat mcp-config.json | python3 -m json.tool

# 4. Restart
just restart
```

### Settings UI Issues
```bash
# 1. Check health
docker inspect airis-settings-ui | grep -A 5 Health

# 2. View logs
just ui-logs

# 3. Rebuild if needed
just ui-build && just ui-up
```

### Network Issues
```bash
# Check port availability
lsof -i :9090
lsof -i :5173

# Test endpoints
curl http://localhost:9090/
curl http://localhost:5173/

# Check Traefik routing (if configured)
curl http://settings.airis.traefik
```

## Testing Strategy

### Manual Testing
- Test in development mode first (`just ui-up`)
- Access via both port (5173) and Traefik domain
- Test Gateway communication if MCP changes
- Verify health checks pass

### Build Testing
- Ensure TypeScript compiles (`npx tsc --noEmit`)
- Run ESLint (`npm run lint`)
- Test production build (`npm run build`)
- Verify Docker image builds (`just ui-build`)

### Integration Testing
- Test with fresh containers (`just clean && just up`)
- Verify symlinked `mcp.json` works across editors
- Test API key injection (Docker secrets)
- Verify Gateway serves MCP servers correctly

## Best Practices

### Docker
- Always use health checks
- Prefer named volumes over bind mounts for data
- Use read-only mounts for configs
- Tag images with versions (not just `latest`)

### Git
- Use conventional commit format (feat/fix/docs/chore/refactor)
- Keep commits atomic and focused
- Update both README.md and README.ja.md
- Never commit secrets or .env files

### Configuration
- Keep configs DRY (Don't Repeat Yourself)
- Use environment variables for secrets
- Document all configuration options
- Provide .example files for secrets

### Documentation
- Maintain bilingual documentation (EN + JA)
- Use clear section headings with emojis
- Provide working examples
- Include troubleshooting sections
- Keep documentation close to code

### Code Quality
- TypeScript strict mode
- ESLint for consistent style
- Prettier for formatting (if configured)
- No console.log in production
- Remove unused imports

## Project Evolution

### Recent Changes (from git history)
1. Disabled Serena MCP auto-browser launch
2. Moved all MCP servers to Gateway (zero host pollution)
3. Added comprehensive MCP server collection (18 servers)
4. Clarified token explosion problem
5. Unified mcp.json configuration
6. OSS release with bilingual README

### Design Decisions
- **Context7 via npx**: Docker version has bugs, use editor-side
- **Gateway-first**: All servers in Gateway except problematic ones
- **Docker secrets**: Preferred over .env for security
- **Symlink strategy**: Master config for multi-editor support
- **Bilingual docs**: Both English and Japanese maintained
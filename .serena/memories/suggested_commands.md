# Suggested Commands

## Development Workflow

### Service Management
```bash
# Start all services (Gateway + Settings UI)
just up

# Stop all services
just down

# Restart services (after config changes)
just restart

# Show all logs (follow mode)
just logs

# Show logs for specific service
just logs-mcp-gateway
just logs-settings-ui

# Check running containers
just ps

# Clean up (⚠️ destroys volumes)
just clean

# Show available MCP servers
just info
```

### Settings UI Operations
```bash
# Build Settings UI image
just ui-build

# Start only Settings UI
just ui-up

# Stop Settings UI
just ui-down

# Show Settings UI logs
just ui-logs

# Enter Settings UI container shell
just ui-shell
```

## Docker Commands

### Gateway Operations
```bash
# View Gateway logs
docker logs docker-mcp-gateway

# Follow Gateway logs
docker logs -f docker-mcp-gateway

# Restart Gateway only
docker restart docker-mcp-gateway

# Inspect Gateway container
docker inspect docker-mcp-gateway
```

### Settings UI Operations
```bash
# View Settings UI logs
docker logs airis-settings-ui

# Enter Settings UI container
docker exec -it airis-settings-ui sh

# Check Settings UI health
docker inspect airis-settings-ui | grep -A 5 Health
```

### Docker Compose
```bash
# Show service status with resource usage
docker compose ps

# Show service configuration (merged compose files)
docker compose config

# Pull latest images
docker compose pull

# Rebuild services
docker compose build

# Force recreate containers
docker compose up -d --force-recreate
```

## API Key Management

### Docker Secrets (Recommended)
```bash
# Set secrets
docker mcp secret set STRIPE_SECRET_KEY=sk_...
docker mcp secret set TWILIO_ACCOUNT_SID=AC...
docker mcp secret set TWILIO_API_KEY=SK...
docker mcp secret set TWILIO_API_SECRET=...
docker mcp secret set FIGMA_ACCESS_TOKEN=figd_...

# List secrets
docker mcp secret ls

# Remove secrets
docker mcp secret rm STRIPE_SECRET_KEY
```

### Environment File (Fallback)
```bash
# Copy template
cp .env.example .env

# Edit secrets
vim .env

# Restart to apply
just restart
```

## MCP Server Configuration

### Enable/Disable Servers
```bash
# Edit Gateway config
vim mcp-config.json

# To disable: rename "server" → "__disabled_server"
# To enable: rename "__disabled_server" → "server"

# Apply changes
just restart
```

## Git Workflow

```bash
# Check status
git status

# View recent commits
git log --oneline -10

# Create feature branch
git checkout -b feature/new-mcp-server

# Commit with conventional format
git commit -m "feat: add new MCP server integration"
git commit -m "fix: resolve Gateway startup issue"
git commit -m "docs: update README with new server"

# Push changes
git push origin feature/new-mcp-server
```

## Editor Integration

### Symlink mcp.json
```bash
# Global config (recommended)
ln -sf ~/github/airis-mcp-gateway/mcp.json ~/.claude/mcp.json

# Per-project config
ln -sf ~/github/airis-mcp-gateway/mcp.json ~/github/your-project/mcp.json

# Verify symlink
ls -la ~/.claude/mcp.json
```

### Restart Editor
After changes to `mcp.json` or starting/stopping Gateway:
1. Close editor
2. Restart editor
3. Gateway remains running (no restart needed when switching projects)

## Troubleshooting

### Gateway Not Starting
```bash
# Check logs
docker logs docker-mcp-gateway

# Check compose status
just ps

# Clean restart
just clean
just up
```

### Settings UI Issues
```bash
# Check health
docker inspect airis-settings-ui | grep -A 10 Health

# View logs
just ui-logs

# Rebuild and restart
just ui-build
just ui-up
```

### Network Issues
```bash
# Test Gateway endpoint
curl http://localhost:9090/

# Test Settings UI
curl http://localhost:5173/

# Check Traefik routing (if configured)
curl http://settings.airis.traefik
```

## Access URLs

### Development
- **Gateway**: http://localhost:9090
- **Settings UI (port)**: http://localhost:5173
- **Settings UI (Traefik)**: http://settings.airis.traefik

### Health Checks
- **Gateway health**: http://localhost:9090/
- **Settings UI health**: http://localhost:5173/ (internal: port 80)
# Code Style and Conventions

## Project Structure

```
airis-mcp-gateway/
├── apps/
│   └── settings/          # React frontend (Settings UI)
├── docker-compose.yml     # Service orchestration
├── docker-compose.override.yml  # Traefik routing overrides
├── mcp-config.json        # Gateway internal config (MCP servers)
├── mcp.json               # Client config (editor-side)
├── Makefile               # Build automation
├── figma-catalog.yaml     # Figma MCP configuration
├── .gitignore             # Git ignore patterns
├── LICENSE                # MIT License
├── SECRETS.md             # API key management guide
├── README.md              # English documentation
└── README.ja.md           # Japanese documentation
```

## Docker Conventions

### Container Naming
- Gateway: `docker-mcp-gateway`
- Settings UI: `airis-settings-ui`

### Volumes
- `claude-memory`: Persistent MCP memory storage
- `/Users/kazuki/github:/workspace/github:rw`: Host source code mount

### Health Checks
- All services have health checks with 30s interval, 10s timeout, 3 retries
- Gateway: `http://localhost:9090/`
- Settings UI: `http://localhost:80/`

### Port Mapping
- Gateway: 9090:9090
- Settings UI: 5173:80

## Frontend (React + TypeScript)

### File Organization
- **Entry Point**: `index.html`
- **Source**: `apps/settings/src/`
- **TypeScript Configs**: 
  - `tsconfig.json` (base)
  - `tsconfig.app.json` (app)
  - `tsconfig.node.json` (Vite config)

### Naming Conventions
- **Components**: PascalCase (implied React standard)
- **Files**: Likely kebab-case or PascalCase.tsx
- **Config Files**: kebab-case (vite.config.ts, tailwind.config.ts)

### TypeScript
- Strict mode enabled (TypeScript 5.8.3)
- React 19 types (@types/react 19.1.8)

### Styling
- Tailwind CSS utility-first approach
- PostCSS for processing
- Autoprefixer for browser compatibility

## MCP Configuration

### mcp-config.json (Gateway Internal)
- JSON format with comments (prefixed with `__comment_`)
- Disabled servers prefixed with `__disabled_`
- Structure:
  ```json
  {
    "mcpGateway": { "addr", "baseURL", "name", "version", "type" },
    "mcpServers": { "server-name": { "command", "args", "env" } },
    "log": { "level" }
  }
  ```

### mcp.json (Client Config)
- Simple JSON structure
- Gateway URL: `http://localhost:9090/sse`
- Editor-side npx servers (context7)

## Git Workflow

### Commit Message Format
- Conventional Commits style:
  - `fix:` for bug fixes
  - `feat:` for new features
  - `docs:` for documentation
  - `chore:` for maintenance
  - `refactor:` for code refactoring

### Example Commits
```
fix: disable Serena MCP auto-browser launch
feat: add comprehensive MCP server collection (18 servers)
docs: update English README with comprehensive MCP server list
refactor: move all MCP servers to Gateway (zero host pollution)
chore: clean up MCP config
```

### Ignored Files
- `.env` and `.env.*` (except `.env.example`)
- Logs: `*.log`, `*.tmp`
- Docker volumes: `data/`, `logs/`, `claude-memory/`
- Context7 cache: `context7/`
- Nested repos: `original-repos/`
- System files: `.DS_Store`

## Docker-First Development

### Build Commands
- Development: `npm run dev` (Vite dev server)
- Production: `npm run build` (Vite build)
- Preview: `npm run preview` (production preview)

### Container Execution
- All npm/npx commands run inside Docker containers
- No dependencies installed on Mac host
- Gateway container has Node.js, Python (uvx), and npx

## Configuration Management

### API Keys
- **Recommended**: Docker secrets (`docker mcp secret set`)
- **Fallback**: `.env` file (gitignored)
- **Never**: Hardcoded in `mcp-config.json`

### Enabling/Disabling Servers
1. Edit `mcp-config.json`
2. Rename key: `"server"` → `"__disabled_server"`
3. Run `just restart`

## Documentation Standards

### Bilingual Documentation
- English: `README.md`
- Japanese: `README.ja.md`
- Both maintained in parallel

### Documentation Sections
1. Problem statement (🎯)
2. Solution (✨)
3. Quick start (🚀)
4. Configuration (🔧)
5. Commands (🛠️)
6. Troubleshooting (🐛)
7. Contributing (🤝)

### Emoji Usage
- Consistent emoji prefixes for sections
- Visual hierarchy for readability
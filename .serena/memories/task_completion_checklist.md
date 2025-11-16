# Task Completion Checklist

## When a Development Task is Completed

### 1. Code Quality
- [ ] **Linting**: Run ESLint on modified TypeScript/JavaScript files
  ```bash
  # In Settings UI container
  docker exec -it airis-settings-ui npm run lint
  ```
- [ ] **Type Checking**: Verify TypeScript types compile without errors
  ```bash
  # TypeScript compilation check
  docker exec -it airis-settings-ui npx tsc --noEmit
  ```
- [ ] **Build Test**: Ensure production build succeeds
  ```bash
  docker exec -it airis-settings-ui npm run build
  ```

### 2. Testing
- [ ] **Manual Testing**: Test changes in development mode
  ```bash
  just ui-up
  # Visit http://localhost:5173
  ```
- [ ] **Health Check**: Verify service health after changes
  ```bash
  docker inspect airis-settings-ui | grep -A 5 Health
  ```
- [ ] **Gateway Integration**: Test Gateway communication if applicable
  ```bash
  curl http://localhost:9090/
  ```

### 3. Configuration Changes

#### MCP Server Changes
- [ ] **Config Validation**: Verify `mcp-config.json` is valid JSON
  ```bash
  cat mcp-config.json | python3 -m json.tool
  ```
- [ ] **Gateway Restart**: Apply changes
  ```bash
  just restart
  ```
- [ ] **Verify Servers**: Check available servers
  ```bash
  just info
  ```

#### Docker Compose Changes
- [ ] **Config Test**: Validate compose configuration
  ```bash
  docker compose config
  ```
- [ ] **Service Restart**: Apply changes
  ```bash
  just down && just up
  ```

### 4. Documentation
- [ ] **Update README**: If user-facing features changed
  - Update both `README.md` (English) and `README.ja.md` (Japanese)
- [ ] **Update SECRETS.md**: If new API keys or secrets added
- [ ] **Code Comments**: Add comments for complex logic
- [ ] **Commit Message**: Use conventional commits format
  ```bash
  git commit -m "feat: add new feature"
  git commit -m "fix: resolve bug"
  git commit -m "docs: update documentation"
  ```

### 5. Git Workflow
- [ ] **Status Check**: Review staged changes
  ```bash
  git status
  git diff
  ```
- [ ] **Commit**: Create meaningful commit with conventional format
  ```bash
  git add .
  git commit -m "feat: description of changes"
  ```
- [ ] **Branch Check**: Ensure on correct branch
  ```bash
  git branch
  ```

### 6. Cleanup
- [ ] **Remove Debug Code**: No console.log, debugger statements in production
- [ ] **Remove Unused Imports**: Clean up unused dependencies
- [ ] **Environment Variables**: Ensure no secrets hardcoded
  ```bash
  # Check for accidental secrets
  grep -r "sk_live" .
  grep -r "STRIPE_SECRET_KEY=" .
  ```
- [ ] **Temporary Files**: Remove any test files or temporary artifacts
  ```bash
  find . -name "*.tmp" -o -name "*.log"
  ```

### 7. Container Health
- [ ] **Check Logs**: No errors in service logs
  ```bash
  just logs
  ```
- [ ] **Resource Usage**: Verify reasonable CPU/memory usage
  ```bash
  docker stats docker-mcp-gateway airis-settings-ui
  ```

## Before Pushing to Repository

### Pre-Push Checklist
- [ ] All tests pass (manual testing completed)
- [ ] Build succeeds without warnings
- [ ] Documentation updated (if applicable)
- [ ] No secrets or sensitive data in commits
- [ ] Commit messages follow conventional format
- [ ] No unnecessary files included (check .gitignore)

### Push Command
```bash
git push origin <branch-name>
```

## For Major Changes

### Additional Steps
- [ ] **Backup**: Create backup of working state
  ```bash
  docker compose ps > backup-services.txt
  cp mcp-config.json mcp-config.json.backup
  ```
- [ ] **Rollback Plan**: Know how to revert changes
  ```bash
  git log --oneline -5  # Note last working commit
  ```
- [ ] **Testing on Clean State**: Test with fresh containers
  ```bash
  just clean
  just up
  ```
- [ ] **Multi-Editor Testing**: If changing `mcp.json`, test across editors
  - Claude Code
  - Cursor (if available)
  - Windsurf (if available)

## Environment-Specific

### Darwin (macOS)
- [ ] **OrbStack Check**: Ensure OrbStack is running
  ```bash
  docker ps
  ```
- [ ] **Port Conflicts**: Verify no port conflicts (9090, 5173)
  ```bash
  lsof -i :9090
  lsof -i :5173
  ```

### Docker Secrets (if using)
- [ ] **Secrets Exist**: Verify required secrets are set
  ```bash
  docker mcp secret ls
  ```
- [ ] **Secret Injection**: Test environment variable injection
  ```bash
  docker exec docker-mcp-gateway env | grep -i stripe
  ```

## Quality Standards

### Code Quality Metrics
- TypeScript: 0 compilation errors
- ESLint: 0 critical errors (warnings acceptable with justification)
- Build: Success with no breaking errors

### Documentation Quality
- All new features documented
- Bilingual documentation maintained (EN + JA)
- Examples provided where applicable
- Clear and concise explanations

### Security
- No hardcoded secrets
- API keys via Docker secrets or .env
- .env file in .gitignore
- Security-sensitive changes reviewed carefully
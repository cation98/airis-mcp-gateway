# Google Antigravity Integration Guide

## Overview

AIRIS MCP Gateway integrates seamlessly with Google Antigravity IDE, providing:

- **90% Token Reduction**: Schema partitioning reduces initial tool list from 12.5K → 1.25K tokens
- **Pre-Implementation Confidence Gate**: `confidence_check` prevents wrong-direction execution (25-250x ROI)
- **Official Docs Verification**: `context7` MCP ensures official reference before coding
- **Multi-Model Support**: Optimized for Claude Sonnet 4.5, GPT-OSS (200k context) in addition to Gemini 3

## Why AIRIS + Antigravity?

| Feature | Antigravity Alone | Antigravity + AIRIS Gateway |
|---------|-------------------|----------------------------|
| Token Efficiency | 1M context (brute-force) | 90% reduction via partitioning |
| Pre-Implementation Gate | ❌ | ✅ (confidence_check) |
| Official Docs Verification | ⚠️ Optional | ✅ Mandatory gate |
| Claude/GPT-OSS Support | Limited (token constraints) | ✅ Optimized |
| Self-Hosting | ❌ | ✅ |
| MCP Servers | Individual config | 25+ unified gateway |

## Quick Start (5 minutes)

### Prerequisites

1. Docker Desktop or OrbStack running
2. Antigravity IDE installed (`/Applications/Antigravity.app`)
3. AIRIS MCP Gateway repository cloned

### Step 1: Start AIRIS MCP Gateway

```bash
cd airis-mcp-gateway
just up
```

Verify services are healthy:

```bash
docker compose ps
# All services should show "(healthy)" status
```

### Step 2: Locate Antigravity Config Directory

Start Antigravity IDE once to initialize config directory:

```bash
open -a Antigravity
```

The config location depends on your OS:

- **macOS**: `~/Library/Application Support/Antigravity/User/globalStorage/mcp_config.json`
- **Linux**: `~/.config/Antigravity/User/globalStorage/mcp_config.json`
- **Windows**: `%APPDATA%\Antigravity\User\globalStorage\mcp_config.json`

Alternatively, in Antigravity:
1. Click "…" dropdown in Agent pane
2. Select "MCP Servers"
3. Click "Manage MCP Servers"
4. Click "View raw config" → Note the file path

### Step 3: Configure AIRIS MCP Servers

**Option A: Direct Gateway Connection (Recommended)**

```bash
# Copy template to Antigravity config
cp config/antigravity-mcp.json ~/Library/Application\ Support/Antigravity/User/globalStorage/mcp_config.json

# Edit filesystem path
# Replace /Users/YOUR_USERNAME/projects with your actual workspace path
```

**Option B: Individual Server Registration**

If you prefer registering each MCP server individually:

```json
{
  "mcpServers": {
    "airis-agent": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/agiletec-inc/airis-agent", "airis-agent-mcp"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

### Step 4: Restart Antigravity

Close and reopen Antigravity IDE for changes to take effect.

### Step 5: Verify Integration

In Antigravity Agent pane:

1. Open MCP Servers panel
2. Verify servers are connected:
   - ✅ `airis-agent` (confidence_check, deep_research)
   - ✅ `context7` (15,000+ library docs)
   - ✅ `sequential-thinking` (multi-step reasoning)
   - ✅ `filesystem`, `git`, `memory`

3. Test a simple query:
   ```
   Use confidence_check to verify if we should implement a custom authentication system or use Supabase Auth.
   ```

Expected response:
```
Confidence Check Results:
- Score: 0.25 (Low confidence)
- Action: STOP and investigate
- Missing: Official docs verification, duplicate check

Recommendation: Before implementing, check:
1. Does Supabase Auth already solve this? (duplicate check)
2. Read Supabase Auth official docs (context7)
3. Search for OSS implementations
```

## Token Efficiency Demonstration

### Before (Antigravity alone)

```bash
# Antigravity loads all 25 MCP servers
# tools/list response: 12,500 tokens (500 tokens/server × 25 servers)
# Gemini 3's 1M context handles it, but inefficient for Claude/GPT-OSS
```

### After (Antigravity + AIRIS Gateway)

```bash
# AIRIS Gateway intercepts tools/list
# Partitioned schema: 1,250 tokens (125 tokens/server × 10 core servers)
# On-demand expansion: expandSchema tool retrieves details only when needed
# Result: 90% reduction, Claude/GPT-OSS viable
```

**Token Savings Per Session**: 11,250 tokens
**100 Sessions**: 1,125,000 tokens saved

## Advanced Workflows

### Workflow 1: Pre-Implementation Confidence Gate

```markdown
**Task**: Add user authentication to Next.js app

**Antigravity Agent Workflow**:
1. Agent calls `confidence_check` tool (100 tokens)
   - duplicate_check_complete: false
   - official_docs_verified: false
   - architecture_check_complete: false

2. Confidence score: 0.25 → Action: STOP

3. Agent performs investigation:
   - Search codebase for existing auth (Glob/Grep)
   - Query context7 for Next.js auth patterns
   - Check if Supabase already configured

4. Re-run confidence_check (100 tokens)
   - Score: 0.95 → Action: PROCEED

5. Implementation starts (verified direction)

**ROI**: 200 tokens (2× confidence_check) vs 5,000 tokens (wrong implementation)
**Savings**: 24x
```

### Workflow 2: Official Docs Verification

```markdown
**Task**: Implement server-side rendering in Next.js

**Antigravity Agent Workflow**:
1. Agent calls `context7` MCP: "Next.js server-side rendering"

2. Context7 returns official Next.js docs excerpt:
   - `getServerSideProps` (Pages Router)
   - React Server Components (App Router)
   - Trade-offs and recommendations

3. Agent calls `confidence_check`:
   - official_docs_verified: true
   - Score: 0.9 → PROCEED

4. Implementation follows official patterns

**ROI**: No hallucinated patterns, no deprecated APIs
```

### Workflow 3: Multi-Agent Orchestration

Antigravity's multi-agent system + AIRIS tooling:

```markdown
**Task**: Refactor monolith to microservices

**Agent 1** (Backend Refactoring):
- Uses `serena` MCP for semantic code search
- Calls `confidence_check` before extracting services
- Verifies architecture compliance

**Agent 2** (Frontend Updates):
- Uses `context7` for API client patterns
- Calls `deep_research` for GraphQL vs REST trade-offs
- Updates components in parallel

**Agent 3** (Documentation):
- Uses `airis-workspace` for manifest sync
- Generates PROJECT_INDEX.md (94% token reduction)
- Updates CLAUDE.md with new architecture

**Result**: 3 agents work asynchronously, all using AIRIS MCP tools
```

## Hybrid Best Practices

### 1. Use Confidence Gate for Greenfield Features

```javascript
// Antigravity Agent → before implementing new feature
confidence_check({
  task: "Add real-time chat with WebSocket",
  duplicate_check_complete: true,  // checked existing code
  architecture_check_complete: true,  // verified tech stack
  official_docs_verified: true,  // read Socket.IO docs via context7
  oss_reference_complete: true,  // found working OSS example
  root_cause_identified: true  // clear requirements
})

// Score: 1.0 → PROCEED immediately
```

### 2. Use Deep Research for Unknown Domains

```javascript
// Antigravity Agent → researching new technology
deep_research({
  query: "Implement OAuth 2.0 PKCE flow for mobile app",
  depth: "deep",  // 3 waves, 6 queries/wave
  constraints: ["official RFC", "security best practices", "TypeScript examples"],
  seed_sources: ["https://oauth.net/2/pkce/"]
})

// Returns: Multi-wave research plan, official sources, confidence score
```

### 3. Use Sequential Thinking for Complex Refactoring

```javascript
// Antigravity Agent → multi-step migration
sequential_thinking({
  task: "Migrate from REST to GraphQL",
  steps: [
    "Analyze existing REST endpoints (serena semantic search)",
    "Design GraphQL schema (context7 Apollo docs)",
    "Verify compatibility (confidence_check)",
    "Implement resolvers (step-by-step)",
    "Update frontend queries (parallel agent)",
    "Test integration (airis-workspace test runner)"
  ]
})
```

## Troubleshooting

### MCP Servers Not Appearing in Antigravity

**Symptom**: `airis-agent` or other servers not listed in MCP panel

**Solutions**:

1. **Check AIRIS Gateway is running**:
   ```bash
   curl http://api.gateway.localhost:9400/health
   # Expected: {"status": "ok"}
   ```

2. **Check mcp_config.json syntax**:
   ```bash
   # Validate JSON
   cat ~/Library/Application\ Support/Antigravity/User/globalStorage/mcp_config.json | jq .
   ```

3. **Check Antigravity logs**:
   - Open Antigravity Developer Console: `Cmd+Option+I` (macOS)
   - Look for MCP connection errors

4. **Restart Antigravity** after config changes

### Tools Not Loading (Schema Partitioning Issue)

**Symptom**: Tools appear but details are missing

**Solution**: This is expected behavior with schema partitioning. Use `expandSchema` tool:

```javascript
// Antigravity Agent should automatically call expandSchema when needed
expandSchema({
  toolName: "confidence_check",
  path: "properties.task"  // Expand specific property
})
```

### High Token Usage (Gateway Not Active)

**Symptom**: Token count not reduced as expected

**Diagnosis**:

```bash
# Check protocol logs (if DEBUG=true in .env)
tail -f apps/api/logs/protocol_messages.jsonl | jq .
```

Look for:
- `tools/list` responses with `expandSchema` injected
- Schema partitioning applied (top-level only)

## Performance Comparison

| Metric | Antigravity Alone | Antigravity + AIRIS |
|--------|-------------------|---------------------|
| Startup tokens | 12,500 | 1,250 |
| tools/list latency | <200ms | <300ms (+100ms partitioning) |
| expandSchema latency | N/A | <10ms (cached) |
| Memory overhead | 0 | ~50MB (schema cache) |
| Claude/GPT-OSS viability | Limited | ✅ Full support |

## Conclusion

Antigravity + AIRIS MCP Gateway provides:

1. **Token Efficiency**: 90% reduction for Claude/GPT-OSS models
2. **Quality Gates**: confidence_check prevents wrong-direction execution
3. **Official Sources**: context7 ensures accurate documentation
4. **Multi-Model Flexibility**: Not locked to Gemini 3's 1M context

**Recommended for**:
- Teams using multiple AI models (Gemini 3, Claude, GPT-OSS)
- Projects requiring pre-implementation verification
- Self-hosted environments (data sovereignty)
- Token-conscious workflows (Claude's 200k context)

**Next Steps**:
1. Test confidence_check with real task
2. Compare token usage (with/without Gateway)
3. Integrate deep_research for unknown domains
4. Set up CI/CD with airis-workspace manifest sync

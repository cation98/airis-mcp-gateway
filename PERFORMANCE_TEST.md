# Performance Test Report: AIRIS MCP Gateway

## Test Objective

Verify the zero-token baseline and on-demand loading benefits of Gateway architecture.

## Test Methodology

### Before: Individual MCP Servers (従来方式)

**Configuration**:
```json
// ~/.claude.json
{
  "mcpServers": {
    "magic": {...},
    "morphllm-fast-apply": {...},
    "serena": {...},
    "playwright": {...},
    "chrome-devtools": {...},
    "context7": {...},
    "sequential-thinking": {...},
    "tavily": {...}
  }
}
```

**Characteristics**:
- Each server registered individually via `claude mcp add`
- All tool definitions loaded at Claude Code startup
- Token consumption occurs at session initialization
- Tool definitions sent even if never used

### After: Gateway Architecture (Gateway方式)

**Configuration**:
```json
// ~/.claude/mcp.json (symlink to ~/github/airis-mcp-gateway/mcp.json)
{
  "mcpServers": {
    "airis-mcp-gateway": {
      "url": "http://localhost:9090/api/v1/mcp/sse",
      "description": "All MCP servers via unified Gateway (25 servers, zero-token baseline, on-demand loading)"
    }
  }
}
```

**Characteristics**:
- Single Gateway URL entry
- Zero tool definitions at startup (0 tokens)
- Tool definitions loaded on-demand only
- Dynamic server access through Gateway

## Test Execution

### Step 1: Verify Current Configuration

```bash
# Check Gateway status
cd ~/github/airis-mcp-gateway && make ps

# Verify mcp.json symlink
ls -la ~/.claude/mcp.json

# Check Gateway connectivity
curl -s http://localhost:9090/ | head -5
```

### Step 2: Claude Code Restart

1. Completely quit Claude Code
2. Restart Claude Code
3. Wait for initialization complete

### Step 3: Measure Startup Behavior

**Run `/mcp` command** to check connected servers:

Expected Output (After - Gateway):
```
1. airis-mcp-gateway  ✔ connected
```

Expected Tool Count:
- airis-mcp-gateway: **0 tools at startup** (on-demand loading)

### Step 4: Verify On-Demand Loading

Test tool access through Gateway:

1. Request file operations → filesystem server loaded
2. Request code analysis → serena server loaded
3. Request web automation → puppeteer server loaded

**Expected Behavior**:
- Servers load only when explicitly requested
- No upfront token consumption for unused servers

## Metrics to Collect

### Quantitative Metrics

| Metric | Before (Individual) | After (Gateway) | Improvement |
|--------|--------------------|-----------------| ------------|
| MCP Servers Registered | 8 | 1 (Gateway ONLY) | -87.5% |
| Tools at Startup | ~100+ | 0 | -100% |
| Startup Token Consumption | High | Zero-baseline | ~100% |
| Tool Definition Load Time | All upfront | On-demand | Lazy loading |

### Qualitative Benefits

1. **Zero-Token Baseline**: No tool definitions sent until explicitly used
2. **On-Demand Loading**: Tools loaded only when needed
3. **Clean Configuration**: Single Gateway URL vs multiple server configs
4. **Unified Management**: All servers accessible through Gateway

## Expected Results

### Token Consumption Pattern

**Before (Individual Servers)**:
```
Session Start → Load all tool definitions (100+ tools)
              → High token consumption
              → Many unused tools wasting tokens
```

**After (Gateway)**:
```
Session Start → Gateway URL only (0 tools)
              → Zero token consumption
              → Tools loaded on first use
```

### Performance Improvement

- **Startup Speed**: Faster (no tool definition processing)
- **Token Efficiency**: ~100% reduction at startup
- **Memory Usage**: Lower (deferred tool loading)
- **Scalability**: Add servers without affecting startup

## Validation Criteria

✅ **Pass Criteria**:
1. Gateway shows as single connected server
2. No tool definitions at startup (`/mcp` shows 0 tools for Gateway)
3. Tools accessible on-demand (functional test)
4. Startup significantly faster than individual server mode

❌ **Fail Criteria**:
1. Multiple individual servers still connected
2. Tool definitions loaded at startup
3. Gateway not responding
4. On-demand loading not working

## Test Results

### Current Status: ✅ Ready for Testing

**Preparation Complete**:
- ✅ Gateway running (airis-mcp-gateway healthy)
- ✅ mcp.json configured correctly
- ✅ Individual servers removed from ~/.claude.json
- ✅ Tests passing (6/6 passed)

**Next Action**:
Claude Code restart required to measure actual performance impact.

---

## Data Collection Template

### Before Data (Reference - Completed)
```
Date: 2025-10-14
Claude Code Version: [version]
Number of MCP Servers: 8 individual servers
Estimated Tools at Startup: ~100+
Startup Behavior: All tool definitions loaded
```

### After Data (To Measure)
```
Date: 2025-10-14
Claude Code Version: [version]
Number of MCP Servers: 1 (Gateway ONLY)
Tools at Startup: [to measure via /mcp]
Startup Behavior: [to observe]
Gateway Response Time: [to measure]
On-Demand Loading: [to verify]
```

### Comparison Summary
```
Token Reduction: [calculate]
Startup Speed: [observe]
Configuration Simplicity: Improved (single Gateway URL)
Management Overhead: Reduced (unified configuration)
```

## Conclusion Template

Based on measured data:

1. **Token Efficiency**: [quantified improvement]
2. **Startup Performance**: [observed improvement]
3. **Developer Experience**: [qualitative assessment]
4. **Recommendation**: [Gateway adoption decision]

---

**Test Status**: Ready for execution after Claude Code restart
**Date Prepared**: 2025-10-14
**Prepared By**: Claude (AI Assistant)

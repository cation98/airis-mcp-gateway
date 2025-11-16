# Token Measurement Guide - OpenMCP Pattern Validation

## Overview

This guide explains how to measure the actual token reduction achieved by the OpenMCP Pattern (Expand-on-Intent Architecture).

**Goal**: Validate theoretical 90% token reduction with real-world measurements.

## Quick Start

```bash
# 1. Clear previous measurements (optional)
just measure-clear

# 2. Restart Gateway to enable logging
just restart

# 3. Use Claude Desktop/Code to trigger some MCP operations
# (e.g., search files, call tools, etc.)

# 4. Run measurement
just measure-tokens
```

## Architecture

```
Claude Desktop/Code
    ↓
FastAPI SSE Proxy (with ProtocolLogger)
    ↓
apps/api/logs/protocol_messages.jsonl
    ↓
measure_token_reduction.py (Docker)
    ↓
metrics/token_measurement.json + docs/research/token_measurement_report.md
```

## What Gets Measured

### Phase 1: Initialize
- **What**: MCP protocol initialization
- **Measured**: Total tokens in initialize request/response
- **Expected**: Minimal (protocol overhead only)

### Phase 2: tools/list
- **What**: Tool schema discovery
- **Baseline**: Full schemas for all tools (~3000 tokens)
- **OpenMCP**: Partitioned schemas (~300 tokens)
- **Expected Reduction**: ~90%

### Phase 3: expandSchema (optional)
- **What**: On-demand schema expansion
- **Triggered**: When Claude needs detailed parameter info
- **Measured**: Tokens per expandSchema call
- **Expected**: Small, targeted expansions

## Measurement Phases

### Baseline Measurement (Without OpenMCP)

To measure baseline (full schema) token usage:

1. **Disable Schema Partitioning** (temporarily):
   ```python
   # In apps/api/app/api/endpoints/mcp_proxy.py
   # Comment out partitioning:
   # data = await apply_schema_partitioning(data)
   ```

2. **Restart and Measure**:
   ```bash
   just restart
   just measure-clear
   # Use Claude Desktop/Code
   just measure-tokens
   ```

3. **Save Baseline Results**:
   ```bash
   cp metrics/token_measurement.json metrics/baseline_measurement.json
   cp docs/research/token_measurement_report.md docs/research/baseline_report.md
   ```

### OpenMCP Measurement (With Partitioning)

1. **Re-enable Schema Partitioning**:
   ```python
   # In apps/api/app/api/endpoints/mcp_proxy.py
   # Uncomment:
   data = await apply_schema_partitioning(data)
   ```

2. **Restart and Measure**:
   ```bash
   just restart
   just measure-clear
   # Use Claude Desktop/Code
   just measure-tokens
   ```

3. **Save OpenMCP Results**:
   ```bash
   cp metrics/token_measurement.json metrics/openmcp_measurement.json
   cp docs/research/token_measurement_report.md docs/research/openmcp_report.md
   ```

## Comparing Results

### Manual Comparison

```bash
# View baseline
cat docs/research/baseline_report.md

# View OpenMCP
cat docs/research/openmcp_report.md
```

### Key Metrics to Compare

| Metric | Baseline | OpenMCP | Expected Reduction |
|--------|----------|---------|-------------------|
| **Initialize Tokens** | ~100 | ~100 | 0% (same) |
| **tools/list Response** | ~3000 | ~300 | ~90% |
| **Total (init + tools/list)** | ~3100 | ~400 | ~87% |

### Example Calculation

```python
# Baseline
baseline_total = 3100 tokens

# OpenMCP
openmcp_total = 400 tokens

# Reduction
reduction = ((baseline_total - openmcp_total) / baseline_total) * 100
# = ((3100 - 400) / 3100) * 100
# = 87.1% reduction
```

## Representative Server Testing

### Target Servers

Test with these 3 representative servers:

1. **context7** (Medium schema ~800 tokens)
   - Documentation lookup
   - Moderate complexity

2. **playwright** (Large schema ~1500 tokens)
   - Browser automation
   - High complexity

3. **sequential** (Small schema ~300 tokens)
   - Reasoning engine
   - Low complexity

### Testing Workflow

```bash
# 1. Configure Gateway for target servers only
# Edit mcp-config.json to enable only:
# - context7
# - playwright
# - sequential

# 2. Restart Gateway
just restart

# 3. Clear measurements
just measure-clear

# 4. Use Claude Desktop/Code to:
#    - Call context7 (e.g., "search React documentation")
#    - Call playwright (e.g., "screenshot this page")
#    - Call sequential (e.g., "analyze this problem")

# 5. Measure
just measure-tokens

# 6. Review report
cat docs/research/token_measurement_report.md
```

## Multi-Hop Analysis

### Purpose
Measure cache effectiveness across multiple tool calls.

### Expected Behavior

| Call | Description | Expected Tokens |
|------|-------------|----------------|
| **1st call** | Lazy load + execution | ~150 (schema expansion) |
| **2nd call** | Cache hit | ~30 (request only) |
| **3rd+ calls** | Pure cache | ~30 (request only) |

### Testing Multi-Hop

```bash
# Clear logs
just measure-clear

# Use Claude Desktop/Code to call same tool 3+ times
# Example: "search React hooks" → "search Vue composition" → "search Angular services"

# Measure
just measure-tokens

# Check expandSchema section in report
cat docs/research/token_measurement_report.md
```

## Files and Directories

```
airis-mcp-gateway/
├── apps/api/
│   ├── app/core/protocol_logger.py           # ProtocolLogger implementation
│   └── logs/protocol_messages.jsonl          # Raw protocol log
├── tools/measurement/
│   ├── measure_token_reduction.py            # Measurement script
│   ├── requirements.txt                       # tiktoken dependency
│   └── Dockerfile                             # Measurement container
├── metrics/
│   ├── token_measurement.json                # Latest measurement
│   ├── baseline_measurement.json             # Baseline (no partitioning)
│   └── openmcp_measurement.json              # OpenMCP (with partitioning)
└── docs/research/
    ├── token_measurement_report.md           # Latest report (Markdown)
    ├── baseline_report.md                    # Baseline report
    ├── openmcp_report.md                     # OpenMCP report
    └── token-measurement-guide.md            # This file
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `just measure-tokens` | Run token measurement |
| `just measure-clear` | Clear logs and start fresh |
| `just restart` | Restart Gateway (enables new logging) |

## Troubleshooting

### Error: No protocol log found

**Problem**: `apps/api/logs/protocol_messages.jsonl` doesn't exist

**Solutions**:
1. Ensure Gateway is running: `just up`
2. Ensure Claude Desktop/Code is connected
3. Trigger some MCP operations (search files, call tools)
4. Check SSE Proxy logs: `just logs-api`

### Error: Empty measurement results

**Problem**: Log file exists but has no entries

**Solutions**:
1. Verify Claude Desktop/Code is using Gateway
2. Check mcp.json points to correct URL
3. Restart Claude Desktop/Code
4. Verify Gateway health: `docker inspect airis-mcp-gateway`

### Inconsistent token counts

**Problem**: Multiple runs show different token counts

**Explanation**: Normal - depends on:
- Which tools were called
- Number of calls per tool
- expandSchema usage

**Solution**:
- Use consistent test scenarios
- Focus on percentage reduction, not absolute values

## Next Steps (Phase 3)

After validating token reduction:

1. **Git Cleanup**: Remove profile UI diff artifacts
2. **Integration Tests**: Automated test suite
3. **Multi-Editor Compatibility**: Test with Cursor, Windsurf, Zed
4. **OSS Contribution**: Submit OpenMCP Pattern to official MCP repository

## References

- **OpenMCP Pattern Spec**: `docs/architecture/openmcp-pattern.md`
- **Expand-on-Intent Architecture**: `docs/architecture/expand-on-intent.md`
- **Schema Partitioning Implementation**: `apps/api/app/core/schema_partitioning.py`
- **Protocol Logger**: `apps/api/app/core/protocol_logger.py`

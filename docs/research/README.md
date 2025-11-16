# Research Documentation

This directory contains research reports, measurement data, and analysis documentation for the AIRIS MCP Gateway project.

## Token Measurement (Phase 2)

### Quick Start

```bash
just measure-tokens
```

### Documentation

- **[Token Measurement Guide](./token-measurement-guide.md)** - Complete guide for measuring token reduction
- **token_measurement_report.md** - Latest measurement report (auto-generated)
- **baseline_report.md** - Baseline measurement (without OpenMCP)
- **openmcp_report.md** - OpenMCP measurement (with schema partitioning)

### Workflow

```
1. Clear logs → 2. Use Claude Desktop → 3. Measure → 4. Review report
   make              (trigger MCP ops)       make           cat report
   measure-clear                             measure-tokens
```

### Expected Results

| Metric | Baseline | OpenMCP | Reduction |
|--------|----------|---------|-----------|
| Initialize | ~100 tokens | ~100 tokens | 0% |
| tools/list | ~3000 tokens | ~300 tokens | ~90% |
| **Total** | **~3100 tokens** | **~400 tokens** | **~87%** |

## Architecture Documentation

- **[OpenMCP Pattern Spec](../architecture/openmcp-pattern.md)** - Pattern specification
- **[Expand-on-Intent Architecture](../architecture/expand-on-intent.md)** - Lazy loading design

## Measurements Directory Structure

```
docs/research/
├── README.md                        # This file
├── token-measurement-guide.md       # Complete measurement guide
├── token_measurement_report.md      # Latest report (auto-generated)
├── baseline_report.md               # Baseline measurement
└── openmcp_report.md                # OpenMCP measurement

metrics/
├── token_measurement.json           # Latest measurement data
├── baseline_measurement.json        # Baseline data
└── openmcp_measurement.json         # OpenMCP data

apps/api/logs/
└── protocol_messages.jsonl          # Raw protocol log (JSONL)
```

## Next Steps (Phase 2 → Phase 3)

1. ✅ **ProtocolLogger implemented** - Message capture working
2. ✅ **Measurement script created** - Token counting ready
3. ✅ **Docker integration** - Measurement container configured
4. ✅ **Documentation complete** - Usage guide written
5. 🔄 **Test workflow** - End-to-end validation
6. ⏳ **Run measurements** - Baseline vs OpenMCP comparison
7. ⏳ **Git cleanup** - Remove profile UI diff artifacts
8. ⏳ **Integration tests** - Automated test suite
9. ⏳ **Multi-editor compatibility** - Cursor, Windsurf, Zed testing

## Commands Reference

```bash
# Measurement
just measure-tokens      # Run measurement
just measure-clear       # Clear logs and start fresh

# Gateway
just up                  # Start Gateway
just restart             # Restart Gateway (enables new logging)
just logs-api            # View API logs (ProtocolLogger output)

# Reports
cat docs/research/token_measurement_report.md    # View latest report
cat metrics/token_measurement.json               # View raw data
```

## Troubleshooting

See [Token Measurement Guide](./token-measurement-guide.md#troubleshooting) for common issues and solutions.

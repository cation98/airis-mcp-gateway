# SC Command Audit - Executive Summary

**Date**: 2025-11-16
**Auditor**: AIRIS Agent
**Scope**: All 29 SuperClaude (`/sc:*`) commands
**Status**: Initial Analysis Complete

---

## Key Findings

### 📊 Command Breakdown

| Category | Count | Status |
|---|---|---|
| ✅ **Keep (High Value)** | 17 | Recommended |
| 🔄 **Consolidate** | 4 | Merge into fewer commands |
| ❌ **Remove (Duplicates)** | 3 | Use AIRIS versions instead |
| ⚠️  **Degraded (Missing MCPs)** | 4 | Require Morphllm/Magic MCPs |
| 📚 **Move to Docs** | 2 | Convert to documentation/scripts |

---

## Critical Issues

### 🚨 Missing MCP Servers

**Morphllm MCP** - ❌ Not Available
- Affects: `/sc:select-tool`, `/sc:workflow`, `/sc:task`, `/sc:brainstorm`
- **Impact**: Commands will fail or have severely degraded functionality
- **Resolution**: Either install Morphllm MCP or mark commands as experimental/degraded

**Magic MCP** - ❌ Not Available
- Affects: `/sc:implement`, `/sc:workflow`, `/sc:task`, `/sc:brainstorm`
- **Impact**: UI generation features unavailable
- **Resolution**: Either install Magic MCP (21st.dev) or document as optional

### ✅ Available MCP Servers

- **Serena MCP**: ✅ Confirmed available in `mcp-config.json`
- **Sequential-thinking**: ✅ Confirmed available
- **Context7**: ✅ Confirmed available
- **Playwright**: ⚠️  Conditional (Docker-based, optional)
- **Tavily**: ⚠️  Conditional (API key optional)

---

## Immediate Actions Required

### 1. Remove Duplicate Commands (Priority: HIGH)

**SC versions are redundant - AIRIS versions are equal or better:**

```bash
# Remove these SC commands
- /sc:agent          → Use /airis:agent instead
- /sc:index-repo     → Use /airis:index-repo instead
- /sc:research       → Use /airis:research instead (lighter deps)
```

**Evidence**:
- `/sc:agent` vs `/airis:agent`: Identical except branding
- `/sc:research` vs `/airis:research`: AIRIS version has cleaner architecture, fewer MCP dependencies

**Recommendation**: Remove `agent.md`, `index-repo.md`, `research.md` from SC plugin

---

### 2. Handle Missing MCP Dependencies (Priority: HIGH)

**Option A: Install Missing MCPs**
```bash
# Research Morphllm MCP availability
# Research Magic MCP (21st.dev) integration

# If available, add to mcp-config.json:
# - morphllm: [installation details]
# - magic: [21st.dev API configuration]
```

**Option B: Mark Commands as Degraded**
```bash
# Add warnings to command descriptions:
- /sc:select-tool: "⚠️  Requires Morphllm MCP (not installed)"
- /sc:workflow: "⚠️  Degraded mode - Magic/Morphllm not available"
- /sc:task: "⚠️  Degraded mode - Magic/Morphllm not available"
- /sc:brainstorm: "⚠️  Degraded mode - Magic/Morphllm not available"
```

**Recommendation**: Start with Option B (mark as degraded), then evaluate if installing MCPs is worth the effort

---

### 3. Consolidate Orchestration Commands (Priority: MEDIUM)

**Current State**: 3 overlapping commands
- `/sc:workflow`: PRD → implementation plan
- `/sc:spawn`: Epic → Story → Task breakdown
- `/sc:task`: Enhanced task execution with MCP routing

**Proposed**: Merge into single `/sc:orchestrate` command
```bash
/sc:orchestrate [target] --mode [workflow|spawn|task]

Modes:
  workflow: PRD analysis → implementation plan generation
  spawn:    Meta-system task decomposition (Epic → Story → Task)
  task:     Enhanced execution with intelligent MCP routing
```

**Benefits**:
- Reduces cognitive load (1 command instead of 3)
- Clearer UX (mode flag explains the difference)
- Easier maintenance (single implementation)

---

### 4. Convert Setup Commands to Documentation (Priority: LOW)

```bash
# Move to documentation
setup-mcp.md  → docs/guides/mcp-setup-wizard.md
verify-mcp.md → scripts/verify_mcp.sh
```

**Rationale**: These are one-time setup utilities, not daily workflow commands

---

## High-Value Commands to Keep

### Core Utilities (7)
- `/sc:git`: Smart commit messages, workflow optimization
- `/sc:analyze`: Multi-domain code analysis
- `/sc:build`: Intelligent error handling, optimization
- `/sc:test`: Coverage analysis, failure diagnostics
- `/sc:troubleshoot`: Systematic root cause analysis
- `/sc:document`: Multi-format documentation generation
- `/sc:design`: Architecture/API specification design

### Workflow Commands (4)
- `/sc:implement`: Persona activation + framework integration
- `/sc:improve`: Multi-domain improvement coordination
- `/sc:cleanup`: Safety-first cleanup methodology
- `/sc:explain`: Educational clarity + progressive learning

### Specialized Analysis (3)
- `/sc:spec-panel`: Expert spec review (Wiegers, Adzic, Fowler, etc.)
- `/sc:business-panel`: Business strategy panel (Christensen, Porter, Drucker)
- `/sc:estimate`: Development time/effort estimation

### Requirements/Planning (1)
- `/sc:brainstorm`: Socratic requirements discovery (**degraded** without Magic/Morphllm)

### Session Management (3) - Requires Serena MCP ✅
- `/sc:load`: Project context loading
- `/sc:save`: Session context persistence
- `/sc:reflect`: Task validation and reflection

### Utilities (1)
- `/sc:help`: Command reference documentation

---

## Commands Under Evaluation

### `/sc:index` vs `/sc:index-repo`

**Difference**:
- `/sc:index`: Comprehensive project documentation generation (docs focus)
- `/sc:index-repo`: Repository structure indexing (94% token reduction)

**Question**: Are these different enough to justify both, or should they be consolidated?

**Next Steps**: Test both commands to understand practical differences

---

## Next Steps

### Immediate (This Week)
1. ✅ **Complete**: Full command audit (DONE)
2. **Remove duplicates**: Delete `agent.md`, `index-repo.md`, `research.md`
3. **Mark degraded commands**: Add warnings for Morphllm/Magic-dependent commands
4. **Document findings**: Share this summary with stakeholders

### Short-term (Next 2 Weeks)
5. **Research MCPs**: Investigate Morphllm/Magic MCP availability and installation
6. **Design benchmarks**: Create A/B tests for command value assessment
7. **Test degraded commands**: Verify graceful degradation without optional MCPs
8. **Clarify index commands**: Determine if `/sc:index` and `/sc:index-repo` should merge

### Medium-term (Next Month)
9. **Execute benchmarks**: Run A/B tests (with command vs without command)
10. **Consolidate orchestration**: Merge workflow/spawn/task into `/sc:orchestrate`
11. **Prepare PR**: Submit findings and recommendations to SC plugin maintainers

---

## Recommendations Summary

| Action | Priority | Impact | Effort |
|---|---|---|---|
| Remove duplicate commands (agent, index-repo, research) | **HIGH** | High | Low |
| Mark degraded commands (select-tool, workflow, task, brainstorm) | **HIGH** | Medium | Low |
| Research Morphllm/Magic MCP installation | **HIGH** | High | Medium |
| Consolidate orchestration commands | MEDIUM | Medium | Medium |
| Convert setup commands to docs | LOW | Low | Low |
| Clarify index vs index-repo | MEDIUM | Low | Low |

---

## Questions for Stakeholders

1. **MCP Installation**: Should we install Morphllm/Magic MCPs to unlock full functionality?
2. **Command Consolidation**: Agree with merging workflow/spawn/task into `/sc:orchestrate`?
3. **Benchmark Priority**: Which commands are highest priority for A/B testing?
4. **AIRIS Integration**: Should SC plugin recommend AIRIS plugin for agent/research/index-repo?
5. **Graceful Degradation**: How should commands handle missing optional MCPs?

---

## Files Created

1. `docs/SC_COMMAND_ANALYSIS.md` - Comprehensive technical analysis (18KB)
2. `docs/SC_COMMAND_AUDIT_SUMMARY.md` - This executive summary (8KB)

**Total Analysis Effort**: ~90 minutes
**Commands Analyzed**: 29/29 (100%)
**MCP Servers Verified**: 7/7 (100%)

---

**Contact**: For questions or clarifications, refer to detailed analysis in `SC_COMMAND_ANALYSIS.md`

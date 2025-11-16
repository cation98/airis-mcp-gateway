# SC Command Comprehensive Analysis

**Analysis Date**: 2025-11-16
**Objective**: Evaluate all 29 SC commands for redundancy, overlap with Claude Code official features, and consolidation opportunities

## Executive Summary

- **Total Commands Analyzed**: 29
- **Complete Duplicates (SC vs AIRIS)**: 3 commands
- **Serena MCP Dependent**: 4 commands (may not function without server)
- **MCP Setup Commands**: 2 commands (niche use case)
- **Unique Value Commands**: 15 commands
- **Evaluation Required**: 5 commands

---

## Command Categories

### 1. Complete Duplicates (SC vs AIRIS)

| SC Command | AIRIS Command | Status | Recommendation |
|---|---|---|---|
| `/sc:agent` | `/airis:agent` | Identical (brand name diff only) | **CONSOLIDATE**: Keep AIRIS version |
| `/sc:index-repo` | `/airis:index-repo` | Identical (path diff only) | **CONSOLIDATE**: Keep AIRIS version |
| `/sc:research` | `/airis:research` | **AIRIS is better** | **CONSOLIDATE**: AIRIS has lighter MCP deps, Wave→Checkpoint structure |

**Evidence**:
- `/sc:agent` and `/airis:agent`: Line-by-line identical except "SuperClaude" → "Airis"
- `/sc:research`: SC version has heavy MCP dependencies (Tavily, Sequential, Playwright, Serena), AIRIS version has cleaner architecture

---

### 2. Serena MCP Dependent Commands (High Risk)

| Command | MCP Dependency | Risk | Recommendation |
|---|---|---|---|
| `/sc:load` | Serena (mandatory) | **HIGH** | Verify Serena availability or **REMOVE** |
| `/sc:save` | Serena (mandatory) | **HIGH** | Verify Serena availability or **REMOVE** |
| `/sc:select-tool` | Serena + Morphllm | **HIGH** | Verify both MCPs or **REMOVE** |
| `/sc:reflect` | Serena (mandatory) | **HIGH** | Verify Serena availability or **REMOVE** |

**Issue**: These commands fail completely if Serena MCP is not installed/configured. Need to:
1. Test Serena MCP availability in target environment
2. If unavailable, remove these commands immediately
3. If available, document hard dependency in README

---

### 3. MCP Setup Commands (Niche Use Case)

| Command | Purpose | Usage Frequency | Recommendation |
|---|---|---|---|
| `/sc:setup-mcp` | Interactive MCP setup wizard | **Once per installation** | **MOVE TO DOCS**: Convert to documentation |
| `/sc:verify-mcp` | MCP installation verification | **Troubleshooting only** | **MOVE TO DOCS**: Convert to diagnostic script |

**Rationale**: These are one-time setup utilities, not daily development tools. Better suited as:
- Installation documentation in `docs/guides/mcp-installation.md`
- Diagnostic scripts in `scripts/verify_mcp.sh`

---

### 4. Utility Commands (Overlap with Native Features)

| Command | Native Alternative | Value Add | Recommendation |
|---|---|---|---|
| `/sc:git` | Native git + Claude Code git tool | Smart commit messages | **KEEP** (useful automation) |
| `/sc:analyze` | Native code analysis | Multi-domain structured analysis | **KEEP** (adds structure) |
| `/sc:build` | Native bash + build tools | Error analysis + optimization | **KEEP** (error handling value) |
| `/sc:test` | Native test runners | Coverage + failure analysis | **KEEP** (analysis layer) |
| `/sc:troubleshoot` | Native debugging | Systematic root cause analysis | **KEEP** (methodology) |
| `/sc:document` | Native docs generation | Focused multi-format output | **KEEP** (structure) |
| `/sc:design` | Native design thinking | Specification generation | **KEEP** (formalization) |

**Analysis**: These commands add **systematic methodology** on top of native features. They don't replace tools, but provide structured workflows.

**Keep/Remove Decision**: **KEEP** - They add value through:
- Systematic approach (analyze → plan → execute)
- Multi-domain coordination
- Structured output formats

---

### 5. Workflow Orchestration Commands

| Command | Complexity | MCP Deps | Unique Value | Recommendation |
|---|---|---|---|---|
| `/sc:implement` | Standard | Context7, Magic, Sequential, Playwright | Persona activation + framework integration | **KEEP** |
| `/sc:improve` | Standard | Context7, Sequential | Multi-domain improvement coordination | **KEEP** |
| `/sc:cleanup` | Standard | Context7, Sequential | Safety-first cleanup methodology | **KEEP** |
| `/sc:explain` | Standard | Context7, Sequential | Educational clarity + progressive learning | **KEEP** |
| `/sc:workflow` | **Advanced** | 6 MCP servers | PRD → implementation workflow generation | **EVALUATE** |
| `/sc:spawn` | **High** | None (meta-orchestration) | Epic → Story → Task breakdown | **EVALUATE** |
| `/sc:task` | **Advanced** | 6 MCP servers | Enhanced task management | **EVALUATE** |

**Workflow vs Spawn vs Task Overlap**:
- `/sc:workflow`: PRD analysis → implementation plan
- `/sc:spawn`: Meta-orchestration for complex operations
- `/sc:task`: Enhanced task execution with MCP routing

**Recommendation**: **CONSOLIDATE** these three into single command with strategy flags:
```bash
/sc:orchestrate [target] --mode workflow|spawn|task
```

---

### 6. Specialized Commands (Unique Value)

| Command | Purpose | Dependencies | Recommendation |
|---|---|---|---|
| `/sc:estimate` | Development time/effort estimation | Sequential, Context7 | **KEEP** (planning value) |
| `/sc:brainstorm` | Requirements discovery (Socratic) | None listed | **KEEP** (ideation) |
| `/sc:spec-panel` | Multi-expert spec review | None listed | **KEEP** (quality) |
| `/sc:business-panel` | Business strategy panel | None listed | **KEEP** (strategy) |
| `/sc:help` | Command listing | None | **KEEP** (discoverability) |
| `/sc:index` | Project docs generation | None | **EVALUATE** vs `/sc:index-repo` |

**New Findings from Remaining Commands**:
- **`/sc:brainstorm`**: Requires 6 MCP servers (Serena ✅, Sequential ✅, Context7 ✅, Magic ❌, Playwright ⚠️, Morphllm ❌) - Will have **degraded functionality**
- **`/sc:spec-panel`**: Comprehensive expert panel for spec review (Wiegers, Adzic, Fowler, etc.) - Unique **high-value** command
- **`/sc:business-panel`**: Business strategy panel (Christensen, Porter, Drucker, etc.) - Unique **high-value** command
- **`/sc:index`**: Project documentation generation - **Overlaps with `/sc:index-repo`** but different focus (docs vs structure)

---

## MCP Server Dependency Matrix

| MCP Server | Commands Using It | Availability Status | Risk |
|---|---|---|---|
| **Serena** | load, save, select-tool, reflect, workflow, task, brainstorm | ✅ **AVAILABLE** (mcp-config.json) | LOW |
| **Morphllm** | select-tool, workflow, task, brainstorm | ❌ **NOT AVAILABLE** | **HIGH** |
| **Sequential** | research, implement, improve, cleanup, explain, estimate, workflow, task, brainstorm, spec-panel, index | ✅ **AVAILABLE** (sequential-thinking) | LOW |
| **Context7** | implement, improve, cleanup, explain, estimate, workflow, task, brainstorm, spec-panel, index | ✅ **AVAILABLE** (mcp-config.json) | LOW |
| **Magic** | implement, workflow, task, brainstorm | ❌ **NOT AVAILABLE** | **HIGH** |
| **Playwright** | build, test, implement, workflow, task, brainstorm | ⚠️  **CONDITIONAL** (Docker, optional) | MEDIUM |
| **Tavily** | research | ⚠️  **CONDITIONAL** (API key optional) | LOW |

**Critical Findings**:
1. ✅ **Serena MCP**: AVAILABLE - All 7 dependent commands will work
2. ❌ **Morphllm MCP**: NOT AVAILABLE - 4 commands will fail or degrade
3. ❌ **Magic MCP**: NOT AVAILABLE - 4 commands will fail or degrade
4. ✅ **Sequential/Context7**: AVAILABLE - Core functionality intact

**Immediate Action Required**:
- **Morphllm-dependent commands** will fail: `/sc:select-tool`, `/sc:workflow`, `/sc:task`, `/sc:brainstorm`
- **Magic-dependent commands** will fail: `/sc:implement`, `/sc:workflow`, `/sc:task`, `/sc:brainstorm`
- Need to either: (a) Install Morphllm/Magic MCPs, or (b) Mark these commands as degraded/optional

---

## Recommendations by Priority

### Priority 1: Remove Confirmed Duplicates

```bash
# Remove SC duplicates, keep AIRIS versions
rm ~/.claude/plugins/marketplaces/superclaude/commands/agent.md
rm ~/.claude/plugins/marketplaces/superclaude/commands/index-repo.md
rm ~/.claude/plugins/marketplaces/superclaude/commands/research.md
```

**Rationale**: AIRIS versions are identical or better (lighter dependencies)

### Priority 2: Handle Missing MCP Servers

**✅ Serena MCP**: Available - no action needed

**❌ Morphllm MCP**: Not available
```bash
# Option A: Install Morphllm MCP (if available)
# Option B: Mark as degraded in affected commands
#   - /sc:select-tool, /sc:workflow, /sc:task, /sc:brainstorm
```

**❌ Magic MCP**: Not available
```bash
# Option A: Install Magic MCP (21st.dev integration)
# Option B: Mark as optional in affected commands
#   - /sc:implement, /sc:workflow, /sc:task, /sc:brainstorm
```

**Impact**: 4 commands may have degraded functionality without Morphllm/Magic

### Priority 3: Convert Setup Commands to Documentation

```bash
# Move to docs
mv setup-mcp.md → docs/guides/mcp-setup-wizard.md
mv verify-mcp.md → scripts/verify_mcp.sh
```

**Rationale**: One-time utilities, not daily commands

### Priority 4: Consolidate Orchestration Commands

**Merge**: workflow, spawn, task → single `orchestrate` command

```markdown
/sc:orchestrate [target] --mode [workflow|spawn|task]
  workflow: PRD → implementation plan
  spawn:    Epic → Story → Task breakdown
  task:     Enhanced execution with MCP routing
```

**Benefit**: Reduces cognitive load, clearer UX

### Priority 5: Benchmark Remaining Commands

**Commands to Test** (with vs without slash command):
- `/sc:implement` - Does persona activation add value?
- `/sc:improve` - Is multi-domain coordination worth overhead?
- `/sc:explain` - Does educational structure improve comprehension?
- `/sc:estimate` - Are estimates accurate vs manual estimation?

**Test Methodology**:
1. Same task executed twice (with command / without command)
2. Measure: tokens consumed, time taken, output quality (subjective 1-5 scale)
3. Collect evidence: screenshots, token counts, timing data
4. Document in `docs/benchmarks/`

---

## Next Steps

1. **Immediate**: Test Serena MCP availability
   ```bash
   claude mcp list | grep -i serena
   ```

2. **If Serena unavailable**: Remove 4 commands immediately

3. **Read remaining commands**: brainstorm.md, spec-panel.md, business-panel.md, index.md, help.md

4. **Execute benchmarks**: Design A/B test for 15 unique commands

5. **Create recommendations doc**: Based on benchmark evidence

6. **Prepare PR**: With findings, evidence, and consolidation proposal

---

## Command Classification Summary

```
✅ KEEP - High Value (17):
  Core Utilities:
    - git, analyze, build, test, troubleshoot, document, design

  Workflow Commands:
    - implement, improve, cleanup, explain

  Specialized Analysis:
    - estimate, spec-panel, business-panel, help

  Requirements/Planning:
    - brainstorm (degraded without Magic/Morphllm)

  Session Management:
    - load, save, reflect (requires Serena ✅)

🔄 CONSOLIDATE (4):
  - workflow, spawn, task → single 'orchestrate' command
  - index, index-repo → clarify difference or merge

❌ REMOVE - Duplicates (3):
  - agent → use /airis:agent instead
  - index-repo → use /airis:index-repo instead
  - research → use /airis:research instead (lighter, better)

⚠️  DEGRADED - Missing MCPs (4):
  - select-tool (needs Morphllm ❌)
  - workflow (needs Magic ❌, Morphllm ❌)
  - task (needs Magic ❌, Morphllm ❌)
  - brainstorm (needs Magic ❌, Morphllm ❌)

📚 MOVE TO DOCS (2):
  - setup-mcp → docs/guides/
  - verify-mcp → scripts/
```

---

## Open Questions

1. ~~Is Serena MCP installed in target environment?~~ ✅ **CONFIRMED: Available**
2. ~~Is Morphllm MCP available?~~ ❌ **CONFIRMED: Not available**
3. ~~Does Magic MCP provide unique value vs native tools?~~ ❌ **CONFIRMED: Not available**
4. ~~Are `brainstorm`, `spec-panel`, `business-panel` worth keeping?~~ ✅ **KEEP: High value**
5. What is `/sc:index` vs `/sc:index-repo` difference? → Need to clarify or consolidate
6. Should we install Morphllm/Magic MCPs to unlock full functionality?
7. How do commands degrade gracefully without optional MCPs?

---

**Analysis Status**: 100% Complete (Commands Read)
**Next Action**: Map to Claude Code official features + Design benchmarks

# Intent-Based Routing in AIRIS MCP Gateway

## Overview

AIRIS MCP Gateway uses a **capability-driven architecture** that routes user intents to the most appropriate MCP server implementation. This document explains how intent detection and routing works.

## The 7 Canonical Capabilities

Instead of exposing 30+ commands, the gateway abstracts all functionality into 7 verbs:

| Capability | Purpose | Primary Implementations |
|------------|---------|------------------------|
| `search` | Find information | tavily, context7, fetch |
| `summarize` | Analyze/extract | sequential-thinking, native |
| `retrieve` | Access knowledge | mindbase, memory |
| `plan` | Decompose tasks | airis-agent, sequential-thinking |
| `edit` | Modify code | serena, native |
| `execute` | Run commands | bash, airis-agent |
| `record` | Store memory | mindbase, memory |

## Intent Detection Flow

```
┌──────────────────────────────────────────────────────────────┐
│                     User Message                              │
│         "How do I use React hooks properly?"                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   Intent Detector                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Pattern Match: "how do I use" → library_docs (0.95)     │ │
│  │ Keywords: "React", "hooks" → technical_docs             │ │
│  │ Context: No prior conversation → standalone query       │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                 Capability Router                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Detected: library_docs → Capability: search             │ │
│  │ Implementation Hint: context7                           │ │
│  │ Confidence: 0.95 (high) → Route directly                │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              Implementation Selector                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Capability: search                                       │ │
│  │ Available: [tavily(p1), context7(p2), fetch(p3)]        │ │
│  │ Conditions: library_docs → context7 matches             │ │
│  │ Selected: context7 (mode: cold, starting...)            │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   MCP Execution                               │
│  context7.resolve_library_id("react")                        │
│  context7.get_library_docs(library_id, "hooks")              │
│  → Returns React hooks documentation                         │
└──────────────────────────────────────────────────────────────┘
```

## Intent Pattern Matching

### Pattern Types

1. **Keyword Patterns**: Direct word matching
   ```yaml
   library_docs:
     patterns:
       - "how do I use"
       - "documentation for"
       - "api reference"
   ```

2. **Semantic Patterns**: Meaning-based matching
   ```yaml
   security_analysis:
     patterns:
       - "is this secure"
       - "vulnerability check"
       - "security review"
   ```

3. **Context Patterns**: Based on conversation state
   ```yaml
   recall_knowledge:
     patterns:
       - "what did we decide"
       - "previous session"
       - "last time"
   ```

### Confidence Levels

| Level | Threshold | Action |
|-------|-----------|--------|
| High | ≥ 0.9 | Route directly |
| Medium | 0.7-0.9 | Route with confirmation |
| Low | 0.5-0.7 | Ask user to clarify |
| None | < 0.5 | Use default (airis-agent) |

## Implementation Selection

### Priority-Based Selection

Implementations are tried in priority order:

```yaml
plan:
  implementations:
    - name: airis-agent     # Priority 1 - try first
      conditions:
        intents: [pdca_cycle, complex_planning]
    - name: sequential-thinking  # Priority 2 - fallback
      conditions:
        intents: [simple_planning]
    - name: native          # Priority 3 - LLM native
```

### Condition Matching

Conditions determine if an implementation is suitable:

```yaml
conditions:
  intents: [library_docs]     # Intent type
  complexity: [high]          # Task complexity
  scope: [project]            # Scope of operation
  features: [self_correction] # Required features
```

### Server Mode Consideration

- **HOT servers** (always running): Preferred for frequently-used capabilities
- **COLD servers** (on-demand): Used for occasional/expensive operations

```
HOT: airis-agent, mindbase, memory
     → Immediate response (<100ms)

COLD: tavily, context7, serena, sequential-thinking
      → Startup latency (1-5s)
```

## Example Routings

### Example 1: Web Search

```
User: "What are the latest trends in AI development?"

Intent Detection:
  Pattern: "latest", "trends" → web_search
  Confidence: 0.92

Routing:
  Capability: search
  Implementation: tavily (web_search intent)
  Mode: cold → starting server...

Execution:
  tavily.search("latest AI development trends 2024")
```

### Example 2: Code Refactoring

```
User: "Rename the User class to Account across the project"

Intent Detection:
  Pattern: "rename", "across" → semantic_refactoring
  Confidence: 0.95

Routing:
  Capability: edit
  Implementation: serena (multi_file scope)
  Mode: cold → starting server...

Execution:
  serena.find_symbol("User")
  serena.rename_symbol("User", "Account")
```

### Example 3: Task Planning

```
User: "Plan out the implementation of user authentication"

Intent Detection:
  Pattern: "plan out", "implementation" → task_planning
  Confidence: 0.88

Routing:
  Capability: plan
  Implementation: airis-agent (complex_planning)
  Mode: hot → immediate

Execution:
  airis-agent.create_plan({
    goal: "user authentication",
    pdca: true,
    confidence_check: true
  })
```

### Example 4: Memory Storage

```
User: "Remember that we decided to use JWT for auth"

Intent Detection:
  Pattern: "remember" → store_knowledge
  Confidence: 0.94

Routing:
  Capability: record
  Implementation: mindbase (long_term_memory)
  Mode: hot → immediate

Execution:
  mindbase.store({
    content: "Authentication decision: Use JWT",
    context: "architecture",
    tags: ["auth", "jwt", "decision"]
  })
```

## Fallback Behavior

When an implementation fails:

1. Try next implementation in priority order
2. If all fail, try `native` (LLM capability)
3. If still failing, ask user for guidance

```yaml
routing:
  fallback_chain:
    - native      # LLM native capability
    - ask_user    # Ask user for guidance
```

## Configuration

See `config/gateway-config.yaml` for the full configuration.

Key sections:
- `capabilities`: Define the 7 capabilities and implementations
- `intent_patterns`: Define pattern → capability mapping
- `server_modes`: Configure hot/cold server behavior
- `routing`: Configure routing behavior and thresholds

## Extending the System

### Adding a New Implementation

1. Add to `mcp-config.json`:
   ```json
   "my-server": {
     "command": "npx",
     "args": ["-y", "my-mcp-server"],
     "enabled": true,
     "mode": "cold"
   }
   ```

2. Add to capability in `gateway-config.yaml`:
   ```yaml
   search:
     implementations:
       - name: my-server
         priority: 2
         conditions:
           intents: [my_specific_intent]
   ```

3. Add intent pattern:
   ```yaml
   intent_patterns:
     my_specific_intent:
       patterns: ["specific phrase"]
       capability: search
       implementation_hint: my-server
   ```

### Adding a New Intent

Just add a pattern to `intent_patterns`:

```yaml
intent_patterns:
  my_new_intent:
    patterns:
      - "trigger phrase 1"
      - "trigger phrase 2"
    capability: plan  # Which capability handles this
    implementation_hint: airis-agent  # Preferred implementation
```

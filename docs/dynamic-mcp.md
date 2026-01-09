# Dynamic MCP Architecture

## Overview

AIRIS MCP Gateway uses **Dynamic MCP** - a token-efficient architecture that reduces context usage by 98% while providing access to 60+ tools.

## The Problem: Tool Bloat

Traditional MCP exposes all tools directly:

```
tools/list → 60+ tools × ~700 tokens each = ~42,000 tokens
```

This bloats the LLM's context window, reducing available space for actual work.

## The Solution: Meta-Tools

Dynamic MCP exposes only 3 meta-tools:

| Meta-Tool | Purpose |
|-----------|---------|
| `airis-find` | Discover servers and tools |
| `airis-exec` | Execute any tool |
| `airis-schema` | Get tool input schema |

```
tools/list → 3 tools × ~200 tokens each = ~600 tokens (98% reduction)
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LLM Context                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  3 Meta-Tools (600 tokens)                      │    │
│  │  ├─ airis-find                                  │    │
│  │  ├─ airis-exec                                  │    │
│  │  └─ airis-schema                                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Dynamic MCP Layer                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tool Cache (in-memory)                         │    │
│  │  ├─ All servers (enabled + disabled)            │    │
│  │  ├─ HOT server tools (pre-loaded)               │    │
│  │  └─ COLD server tools (loaded on-demand)        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  ProcessManager                          │
│  ├─ HOT servers: Always running                         │
│  ├─ COLD servers: Start on-demand, idle-kill           │
│  └─ Disabled servers: Auto-enable on airis-exec        │
└─────────────────────────────────────────────────────────┘
```

## Tool Discovery Flow

### 1. airis-find

Search for tools and servers:

```
LLM: airis-find query="stripe"

Response:
Found 2 tools across 24 servers

## Servers
- **stripe** (cold, enabled): 50 tools

## Tools
- **stripe:create_customer** - Create a new customer
- **stripe:create_payment_intent** - Create payment intent
```

### 2. airis-schema

Get full input schema before execution:

```
LLM: airis-schema tool="stripe:create_customer"

Response:
# stripe:create_customer

**Server:** stripe
**Description:** Create a new customer in Stripe

## Input Schema
{
  "type": "object",
  "properties": {
    "email": { "type": "string" },
    "name": { "type": "string" },
    "metadata": { "type": "object" }
  },
  "required": ["email"]
}
```

### 3. airis-exec

Execute the tool:

```
LLM: airis-exec tool="stripe:create_customer" arguments={"email": "user@example.com"}

Response:
{ "id": "cus_xxx", "email": "user@example.com", ... }
```

## Auto-Enable Feature

Disabled servers are discoverable but not running. When `airis-exec` is called:

1. **Server is auto-enabled** - No manual intervention needed
2. **Tools are loaded** - Cached for future calls
3. **Tool is executed** - Seamlessly

```
LLM: airis-find query="github"
→ github (cold, disabled): 30 tools

LLM: airis-exec tool="github:create_issue" arguments={...}
→ [Server auto-enabled]
→ [Tools loaded]
→ { "id": 123, "title": "...", ... }
```

## Server Modes

| Mode | Behavior |
|------|----------|
| **HOT** | Always running, immediate response |
| **COLD** | Start on-demand, idle-kill after timeout |
| **Disabled** | Not running, auto-enable on airis-exec |

### Why Disabled Servers?

- **Resource efficiency**: Don't run servers you rarely use
- **API key management**: Servers requiring API keys start disabled
- **On-demand activation**: LLM enables when needed

## Cache Behavior

### Startup

1. Cache ALL server metadata (enabled + disabled)
2. Load tools from HOT servers only
3. COLD/disabled server tools loaded on-demand

### On airis-find

1. Return cached server list (all servers)
2. If specific server queried: load its tools on-demand
3. Update cache with loaded tools

### On airis-exec

1. Parse tool reference (e.g., `stripe:create_customer`)
2. If server disabled: auto-enable
3. If tools not cached: load on-demand
4. Execute tool
5. Return result

## Configuration

### Enable/Disable Servers

Edit `mcp-config.json`:

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--api-key", "${STRIPE_SECRET_KEY}"],
      "enabled": true,
      "mode": "cold"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" },
      "enabled": false,
      "mode": "cold"
    }
  }
}
```

### Disable Dynamic MCP

For legacy mode (all tools exposed):

```bash
DYNAMIC_MCP=false docker compose up -d
```

## Comparison

| Aspect | Traditional MCP | Dynamic MCP |
|--------|-----------------|-------------|
| Context usage | ~42,000 tokens | ~600 tokens |
| Tool discovery | Implicit (all in context) | Explicit (airis-find) |
| Server management | Manual enable/disable | Auto-enable on use |
| Cold start | User waits | Happens during airis-exec |

## Best Practices

1. **Use airis-find first** - Discover what's available
2. **Use airis-schema for complex tools** - Understand required arguments
3. **Let airis-exec auto-enable** - Don't manually manage servers
4. **Keep rarely-used servers disabled** - Resource efficiency

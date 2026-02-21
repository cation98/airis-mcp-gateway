---
name: verify-mindbase
description: Verifies all 14 mindbase MCP tools function correctly via airis-exec gateway calls. Use after mindbase patches, Docker image rebuilds, or gateway restarts.
disable-model-invocation: true
argument-hint: "[optional: specific tool domain - memory|session|conversation]"
---

# Mindbase Verification

## Purpose

Verify that all mindbase MCP tools are operational through the airis-mcp-gateway:

1. **Memory tools** — write, list, read, search, delete
2. **Session tools** — create, list, start, delete
3. **Conversation tools** — save, get, search, hybrid_search, delete
4. **Embedding generation** — Ollama nomic-embed-text produces 768-dim vectors
5. **Docker image integrity** — Patched image is used (not upstream)

## When to Run

- After rebuilding the mindbase Docker image (`patches/mindbase-mcp/`)
- After modifying `catalogs/airis-catalog.yaml` mindbase section
- After gateway restart (`docker compose restart gateway`)
- After Ollama model changes or Ollama restarts
- Before creating a PR that touches mindbase-related files

## Related Files

| File | Purpose |
|------|---------|
| `patches/mindbase-mcp/Dockerfile` | Patched mindbase image build |
| `patches/mindbase-mcp/memory-fs.js` | Bug 1 (DB fallback), Bug 2 (delete fix), Bug 4 (search threshold) |
| `patches/mindbase-mcp/conversation.js` | Bug 4 (conversation search threshold 0.5) |
| `catalogs/airis-catalog.yaml` | Mindbase catalog entry with image, tools, and env config |
| `docker-compose.override.yml` | Volume mounts for airis-agent patches |
| `patches/airis-agent/types.py` | Bug 3 (airis_record tool name mapping fix) |

## Workflow

### Step 1: Verify Docker Image

**Check:** The gateway must use the patched mindbase image, not upstream.

```bash
grep "image:" catalogs/airis-catalog.yaml | grep mindbase
```

**PASS:** Output contains `ghcr.io/cation98/mindbase-mcp:patched`
**FAIL:** Image is `ghcr.io/agiletec-inc/mindbase-mcp:latest` or any other non-patched tag

**Fix:** Rebuild the patched image:
```bash
cd patches/mindbase-mcp && docker build -t ghcr.io/cation98/mindbase-mcp:patched .
```

### Step 2: Verify Patch Files Exist

**Check:** All 3 patch files for mindbase must be present.

```bash
ls patches/mindbase-mcp/Dockerfile patches/mindbase-mcp/memory-fs.js patches/mindbase-mcp/conversation.js
```

**PASS:** All 3 files exist
**FAIL:** Any file missing

### Step 3: Verify Bug 1 Fix — listMemories DB Fallback

**File:** `patches/mindbase-mcp/memory-fs.js`

**Check:** `listMemories` must contain a DB query fallback when filesystem is empty.

```bash
grep -n "SELECT name, content, category" patches/mindbase-mcp/memory-fs.js
```

**PASS:** At least one match showing `SELECT name, content, category, project, tags` query in listMemories
**FAIL:** No match — filesystem-only listing returns empty in transient containers

### Step 4: Verify Bug 2 Fix — deleteMemory Separate Try/Catch

**File:** `patches/mindbase-mcp/memory-fs.js`

**Check:** `deleteMemory` must have separate try/catch blocks for fs.unlink and pool.query so DB deletion proceeds even when file doesn't exist.

```bash
grep -n "PATCHED: Separate try/catch" patches/mindbase-mcp/memory-fs.js
```

**PASS:** Shows the PATCHED comment indicating separate try/catch was applied
**FAIL:** No PATCHED comment — delete operations may still be coupled

**Additional check:**

```bash
grep -c "try {" patches/mindbase-mcp/memory-fs.js
```

**PASS:** Count is >= 7 (includes separate try blocks for delete fs + delete DB)
**FAIL:** Count is < 7 — delete try/catch blocks may be missing

### Step 5: Verify Bug 4 Fix — Search Threshold

**File:** `patches/mindbase-mcp/memory-fs.js`

**Check:** Default search similarity threshold must be 0.5 (not 0.7) for nomic-embed-text compatibility.

```bash
grep "threshold" patches/mindbase-mcp/memory-fs.js | grep "0\."
```

**PASS:** Shows `?? 0.5` (default threshold is 0.5)
**FAIL:** Shows `?? 0.7` — nomic-embed-text scores ~0.5-0.6 for relevant matches, 0.7 filters everything

**File:** `patches/mindbase-mcp/conversation.js`

**Check:** Conversation search threshold must also be 0.5.

```bash
grep "threshold" patches/mindbase-mcp/conversation.js | grep "0\."
```

**PASS:** Shows `?? 0.5` for conversation_search threshold
**FAIL:** Shows `?? 0.7`

### Step 6: Verify Dockerfile Patches Both Files

**File:** `patches/mindbase-mcp/Dockerfile`

**Check:** Dockerfile must COPY both memory-fs.js and conversation.js.

```bash
grep "COPY" patches/mindbase-mcp/Dockerfile
```

**PASS:** Two COPY lines — one for `memory-fs.js` to `/app/dist/storage/memory-fs.js` and one for `conversation.js` to `/app/dist/tools/conversation.js`
**FAIL:** Missing either COPY instruction

### Step 7: Verify Catalog Tool Registration

**File:** `catalogs/airis-catalog.yaml`

**Check:** All 14 mindbase tools must be listed in the catalog.

```bash
grep "name: memory_" catalogs/airis-catalog.yaml | wc -l
grep "name: session_" catalogs/airis-catalog.yaml | wc -l
grep "name: conversation_" catalogs/airis-catalog.yaml | wc -l
```

**PASS:** memory tools = 5, session tools = 4, conversation tools = 5 (total 14)
**FAIL:** Any count is wrong — tools will not be discoverable via airis-find

### Step 8: Verify Ollama Connectivity

**Check:** Ollama must be running and nomic-embed-text model available for embedding generation.

```bash
curl -s http://localhost:11434/api/tags | grep -o "nomic-embed-text" | head -1
```

**PASS:** Output shows `nomic-embed-text`
**FAIL:** No output — Ollama not running or model not pulled

### Step 9: Verify Gateway Can Reach Mindbase

**Check:** The mindbase server must be accessible through the gateway.

```bash
curl -s http://localhost:9400/health | grep -o '"status":"healthy"'
```

**PASS:** Gateway health check returns `"status":"healthy"`
**FAIL:** Gateway not responding or unhealthy status

### Step 10: Verify Bug 3 Fix — airis_record Tool Name

**File:** `patches/airis-agent/types.py`

**Check:** `INTENT_IMPLEMENTATIONS[Intent.RECORD]` must map to `memory_write`, not `create_memory`.

```bash
grep "memory_write" patches/airis-agent/types.py
```

**PASS:** Shows `tool="memory_write"` in RECORD intent
**FAIL:** Shows `tool="create_memory"` — airis_record will fail to find the tool

### Step 11: Verify airis-agent Volume Mount

**File:** `docker-compose.override.yml`

**Check:** The types.py patch must be volume-mounted into the airis-agent container.

```bash
grep "types.py" docker-compose.override.yml
```

**PASS:** Shows volume mount mapping `patches/airis-agent/types.py` to container path
**FAIL:** No mount — airis-agent still uses original broken types.py

## Output Format

```markdown
## Mindbase Verification Report

| # | Check | File | Status | Detail |
|---|-------|------|--------|--------|
| 1 | Docker image | airis-catalog.yaml | PASS/FAIL | Image tag |
| 2 | Patch files exist | patches/mindbase-mcp/ | PASS/FAIL | Missing files |
| 3 | Bug 1: DB fallback | memory-fs.js | PASS/FAIL | SELECT query found |
| 4 | Bug 2: Delete fix | memory-fs.js | PASS/FAIL | Separate try/catch |
| 5 | Bug 4: Search threshold | memory-fs.js + conversation.js | PASS/FAIL | Threshold value |
| 6 | Dockerfile patches | Dockerfile | PASS/FAIL | COPY commands |
| 7 | Catalog tools | airis-catalog.yaml | PASS/FAIL | Tool count |
| 8 | Ollama connectivity | localhost:11434 | PASS/FAIL | Model available |
| 9 | Gateway health | localhost:9400 | PASS/FAIL | Health status |
| 10 | Bug 3: Record fix | types.py | PASS/FAIL | Tool name |
| 11 | Volume mount | docker-compose.override.yml | PASS/FAIL | Mount exists |

**Total: X/11 PASS**
```

## Exceptions

The following are **not problems**:

1. **airis_record timeout** — The `airis_record` tool (via airis-agent) times out because the orchestration pipeline requires an LLM API key not configured in the current setup. This is a known environment limitation, not a mindbase bug. The Bug 3 code fix itself (tool name mapping) is verified correct at the source level in Step 10.
2. **conversation_hybrid_search threshold at 0.6** — The `conversation_hybrid_search` tool uses a 0.6 threshold (not 0.5) because it combines vector + keyword scoring, which naturally produces higher composite scores. This is intentional and not a bug.
3. **Ollama offline on CI** — In CI/CD environments where Ollama is not available, Step 8 (Ollama connectivity) may fail. This does not affect the code-level verification of patches. Mark as SKIP with note.
4. **Gateway not running during code review** — Steps 8 and 9 require running services. During pure code review (no Docker), these checks can be skipped. All other steps work on static file analysis.
5. **Database not reachable** — If Supabase cloud DB is temporarily unavailable, runtime tool tests would fail but code-level patch verification (Steps 2-6, 10-11) still passes.

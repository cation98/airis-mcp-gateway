---
name: manage-skills
description: Analyzes session changes to detect missing verification skill coverage. Dynamically discovers existing skills, creates new ones or updates existing ones, and manages CLAUDE.md.
disable-model-invocation: true
argument-hint: "[optional: specific skill name or area to focus on]"
---

# Session-Based Skill Maintenance

## Purpose

Analyze changes from the current session to detect and fix verification skill drift:

1. **Missing coverage** — Changed files not referenced by any verify skill
2. **Invalid references** — Skills referencing deleted or moved files
3. **Missing checks** — New patterns/rules not covered by existing checks
4. **Stale values** — Config values or detection commands that no longer match

## When to Run

- After implementing a feature that introduces new patterns or rules
- When you want to modify an existing verify skill and check consistency
- Before a PR to confirm verify skills cover the changed areas
- When a validation run misses an issue you expected to catch
- Periodically to align skills with codebase changes

## Registered Verification Skills

The list of verification skills registered for this project. Update this list when creating or deleting skills.

| Skill | Description | Covered File Patterns |
|-------|-------------|----------------------|
| verify-mindbase | Verifies all 14 mindbase MCP tools function correctly via airis-exec gateway calls | `patches/mindbase-mcp/*`, `catalogs/airis-catalog.yaml`, `docker-compose.override.yml`, `patches/airis-agent/types.py` |

## Workflow

### Step 1: Analyze Session Changes

Collect all files changed in the current session:

```bash
# Uncommitted changes
git diff HEAD --name-only

# Commits on current branch (if branched from main)
git log --oneline main..HEAD 2>/dev/null

# All changes since branching from main
git diff main...HEAD --name-only 2>/dev/null
```

Merge into a deduplicated list. If a skill name or area is specified as an optional argument, filter to only relevant files.

**Display:** Group files by top-level directory (first 1-2 path segments):

```markdown
## Session Changes Detected

**N files changed in this session:**

| Directory | Files |
|-----------|-------|
| src/components | `Button.tsx`, `Modal.tsx` |
| src/server | `router.ts`, `handler.ts` |
| tests | `api.test.ts` |
| (root) | `package.json`, `.eslintrc.js` |
```

### Step 2: Map Changed Files to Registered Skills

Build a file-to-skill mapping by referencing the **Registered Verification Skills** section above.

#### Sub-step 2a: Check Registered Skills

Read each skill's name and covered file patterns from the **Registered Verification Skills** table.

If 0 skills are registered, jump directly to Step 4 (CREATE vs UPDATE decision). All changed files are treated as "UNCOVERED."

If 1 or more skills are registered, read each skill's `.claude/skills/verify-<name>/SKILL.md` and extract additional file path patterns from:

1. **Related Files** section — Parse the table for file paths and glob patterns
2. **Workflow** section — Extract file paths from grep/glob/read commands

#### Sub-step 2b: Match Changed Files to Skills

For each changed file collected in Step 1, compare against registered skill patterns. A file matches a skill when:

- It matches that skill's covered file patterns
- It lives within a directory referenced by that skill
- It matches regex/string patterns used in that skill's detection commands

#### Sub-step 2c: Display the Mapping

```markdown
### File → Skill Mapping

| Skill | Trigger Files (changed files) | Action |
|-------|-------------------------------|--------|
| verify-api | `router.ts`, `handler.ts` | CHECK |
| verify-ui | `Button.tsx` | CHECK |
| (no skill) | `package.json`, `.eslintrc.js` | UNCOVERED |
```

### Step 3: Analyze Coverage Gaps for Affected Skills

For each AFFECTED skill (a skill with matching changed files), read its full SKILL.md and check:

1. **Missing file references** — Are changed files relevant to this skill's domain missing from the Related Files section?
2. **Stale detection commands** — Do the skill's grep/glob patterns still match the current file structure? Run sample commands to test.
3. **Uncovered new patterns** — Read the changed files and identify new rules, configs, or patterns the skill doesn't check. Look for:
   - New type definitions, enum variants, or exported symbols
   - New registrations or configurations
   - New file naming or directory conventions
4. **Stale references to deleted files** — Are files in the skill's Related Files no longer present in the codebase?
5. **Changed values** — Have specific values the skill checks (identifiers, config keys, type names) changed in the modified files?

Record each gap found:

```markdown
| Skill | Gap Type | Detail |
|-------|----------|--------|
| verify-api | Missing file | `src/server/newHandler.ts` not in Related Files |
| verify-ui | New pattern | New component uses a rule not being checked |
| verify-test | Stale value | Test runner pattern changed in config file |
```

### Step 4: CREATE vs UPDATE Decision

Apply the following decision tree:

```
For each group of uncovered files:
    IF files are related to an existing skill's domain:
        → Decision: UPDATE existing skill (expand coverage)
    ELSE IF 3 or more related files share a common rule/pattern:
        → Decision: CREATE a new verify skill
    ELSE:
        → Mark as "exempt" (no skill needed)
```

Present results to the user:

```markdown
### Proposed Actions

**Decision: UPDATE existing skills** (N)
- `verify-api` — Add 2 missing file references, update detection patterns
- `verify-test` — Update detection commands for new config pattern

**Decision: CREATE new skills** (M)
- New skill needed — Covers <pattern description> (X uncovered files)

**No action needed:**
- `package.json` — Config file, exempt
- `README.md` — Documentation, exempt
```

Use `AskUserQuestion` to confirm:
- Which existing skills to update
- Whether to create the proposed new skills
- Option to skip entirely

### Step 5: Update Existing Skills

For each skill the user approves updating, read the current SKILL.md and apply targeted edits:

**Rules:**
- **Add/modify only** — Never remove existing checks that still work
- Add new file paths to the **Related Files** table
- Add new detection commands for patterns found in changed files
- Add new workflow steps or sub-steps for uncovered rules
- Remove references to files confirmed deleted from the codebase
- Update specific values (identifiers, config keys, type names) that have changed

**Example — Adding a file to Related Files:**

```markdown
## Related Files

| File | Purpose |
|------|---------|
| ... existing entries ... |
| `src/server/newHandler.ts` | New request handler with validation |
```

**Example — Adding a detection command:**

````markdown
### Step N: Verify New Pattern

**File:** `path/to/file.ts`

**Check:** Description of what to verify.

```bash
grep -n "pattern" path/to/file.ts
```

**Violation:** What it looks like when wrong.
````

### Step 6: Create New Skills

**Important:** When creating a new skill, you must confirm the skill name with the user.

For each skill to be created:

1. **Explore** — Read the relevant changed files to deeply understand the patterns

2. **Confirm skill name with user** — Use `AskUserQuestion`:

   Present the pattern/domain the skill will cover and ask the user to provide or confirm a name.

   **Naming rules:**
   - The name must start with `verify-` (e.g., `verify-auth`, `verify-api`, `verify-caching`)
   - If the user provides a name without the `verify-` prefix, add it automatically and inform the user
   - Use kebab-case (e.g., `verify-error-handling`, not `verify_error_handling`)

3. **Create** — Write `.claude/skills/verify-<name>/SKILL.md` using the following template:

```yaml
---
name: verify-<name>
description: <one-line description>. Use after <trigger condition>.
---
```

Required sections:
- **Purpose** — 2-5 numbered verification categories
- **When to Run** — 3-5 trigger conditions
- **Related Files** — Table of real file paths from the codebase (verified with `ls`, no placeholders)
- **Workflow** — Check steps, each specifying:
  - Tool to use (Grep, Glob, Read, Bash)
  - Exact file path or pattern
  - PASS/FAIL criteria
  - How to fix on failure
- **Output Format** — Markdown table for results
- **Exceptions** — At least 2-3 realistic "not a violation" cases

4. **Update associated skill files** — After creating a new skill, you must update these 3 files:

   **4a. Update this file itself (`manage-skills/SKILL.md`):**
   - Add a new row to the **Registered Verification Skills** section table
   - On first skill addition, remove the "(No verification skills registered yet)" text and HTML comment and replace with the table
   - Format: `| verify-<name> | <description> | <covered file patterns> |`

   **4b. Update `verify-implementation/SKILL.md`:**
   - Add a new row to the **Skills to Run** section table
   - On first skill addition, remove the "(No verification skills registered yet)" text and HTML comment and replace with the table
   - Format: `| <number> | verify-<name> | <description> |`

   **4c. Update `CLAUDE.md`:**
   - Add a new row to the `## Skills` table
   - Format: `| verify-<name> | <one-line description> |`

### Step 7: Validation

After all edits:

1. Re-read all modified SKILL.md files
2. Verify markdown formatting is correct (unclosed code blocks, consistent table columns)
3. Check for broken file references — verify each path in Related Files exists:

```bash
ls <file-path> 2>/dev/null || echo "MISSING: <file-path>"
```

4. Dry-run one detection command from each updated skill to validate syntax
5. Confirm the **Registered Verification Skills** table and **Skills to Run** table are in sync

### Step 8: Summary Report

Display the final report:

```markdown
## Session Skill Maintenance Report

### Changed Files Analyzed: N

### Skills Updated: X
- `verify-<name>`: Added N new checks, updated Related Files
- `verify-<name>`: Updated detection commands for new patterns

### Skills Created: Y
- `verify-<name>`: Covers <pattern>

### Associated Files Updated:
- `manage-skills/SKILL.md`: Registered Verification Skills table updated
- `verify-implementation/SKILL.md`: Skills to Run table updated
- `CLAUDE.md`: Skills table updated

### Unaffected Skills: Z
- (no related changes)

### Uncovered Changes (no applicable skill):
- `path/to/file` — exempt (reason)
```

---

## Quality Criteria for Created/Updated Skills

All created or updated skills must have:

- **Real file paths from the codebase** (verified with `ls`), not placeholders
- **Working detection commands** — actual grep/glob patterns that match current files
- **PASS/FAIL criteria** — clear conditions for pass and fail for each check
- **At least 2-3 realistic exceptions** — explanation of what is not a violation
- **Consistent formatting** — same as existing skills (frontmatter, section headers, table structure)

---

## Related Files

| File | Purpose |
|------|---------|
| `.claude/skills/verify-implementation/SKILL.md` | Unified verification skill (this skill manages the list of skills to run) |
| `.claude/skills/manage-skills/SKILL.md` | This file itself (manages the registered verification skills list) |
| `CLAUDE.md` | Project instructions (this skill manages the Skills section) |

## Exceptions

The following are **not problems**:

1. **Lock files and generated files** — `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, auto-generated migration files, and build outputs do not need skill coverage
2. **One-off config changes** — Version bumps in `package.json`/`Cargo.toml`, minor changes to linter/formatter configs do not need new skills
3. **Documentation files** — `README.md`, `CHANGELOG.md`, `LICENSE`, etc. are not code patterns requiring verification
4. **Test fixture files** — Files in directories used as test fixtures (e.g., `fixtures/`, `__fixtures__/`, `test-data/`) are not production code
5. **Unaffected skills** — Skills marked UNAFFECTED do not need review; most skills in most sessions fall into this category
6. **CLAUDE.md itself** — Changes to CLAUDE.md are documentation updates, not code patterns requiring verification
7. **Vendor/third-party code** — Files in `vendor/`, `node_modules/`, or copied library directories follow external rules
8. **CI/CD configuration** — `.github/`, `.gitlab-ci.yml`, `Dockerfile`, etc. are infrastructure, not application patterns requiring verification skills

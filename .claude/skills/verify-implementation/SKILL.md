---
name: verify-implementation
description: Runs all registered verify skills sequentially to produce a unified validation report. Use after implementing a feature, before a PR, or during code review.
disable-model-invocation: true
argument-hint: "[optional: specific verify skill name]"
---

# Implementation Verification

## Purpose

Run all registered `verify-*` skills sequentially to perform unified validation:

- Execute the checks defined in each skill's Workflow
- Reference each skill's Exceptions to avoid false positives
- Suggest fixes for discovered issues
- Apply fixes after user approval and re-verify

## When to Run

- After implementing a new feature
- Before creating a Pull Request
- During code review
- When auditing codebase rule compliance

## Skills to Run

The list of verification skills this skill runs sequentially. `/manage-skills` automatically updates this list when skills are created or deleted.

| # | Skill | Description |
|---|-------|-------------|
| 1 | verify-mindbase | Verifies all 14 mindbase MCP tools function correctly via airis-exec gateway calls |

## Workflow

### Step 1: Introduction

Check the skills listed in the **Skills to Run** section above.

If an optional argument is provided, filter to only that skill.

**If 0 skills are registered:**

```markdown
## Implementation Verification

No verification skills found. Run `/manage-skills` to create verification skills for this project.
```

Exit the workflow in this case.

**If 1 or more skills are registered:**

Display the contents of the Skills to Run table:

```markdown
## Implementation Verification

Running the following verification skills sequentially:

| # | Skill | Description |
|---|-------|-------------|
| 1 | verify-<name1> | <description1> |
| 2 | verify-<name2> | <description2> |

Starting verification...
```

### Step 2: Sequential Execution

For each skill listed in the **Skills to Run** table:

#### 2a. Read the Skill's SKILL.md

Read `.claude/skills/verify-<name>/SKILL.md` for that skill and parse the following sections:

- **Workflow** — Check steps and detection commands to execute
- **Exceptions** — Patterns that are not considered violations
- **Related Files** — List of files to check

#### 2b. Execute the Checks

Run each check defined in the Workflow section in order:

1. Use the tool specified in the check (Grep, Glob, Read, Bash) to detect patterns
2. Compare detected results against that skill's PASS/FAIL criteria
3. Exempt patterns that match the Exceptions section
4. On FAIL, record the issue:
   - File path and line number
   - Problem description
   - Recommended fix (with code example)

#### 2c. Record Per-Skill Results

After each skill completes, display progress:

```markdown
### verify-<name> Verification Complete

- Checks run: N
- Passed: X
- Issues: Y
- Exempted: Z

[Moving to next skill...]
```

### Step 3: Unified Report

After all skills complete, consolidate results into a single report:

```markdown
## Implementation Verification Report

### Summary

| Verification Skill | Status | Issues | Detail |
|--------------------|--------|--------|--------|
| verify-<name1> | PASS / X issues | N | Detail... |
| verify-<name2> | PASS / X issues | N | Detail... |

**Total issues found: X**
```

**If all checks pass:**

```markdown
All verifications passed!

The implementation complies with all project rules:

- verify-<name1>: <summary of what passed>
- verify-<name2>: <summary of what passed>

Ready for code review.
```

**If issues are found:**

List each issue with file path, problem description, and recommended fix:

```markdown
### Issues Found

| # | Skill | File | Problem | Fix |
|---|-------|------|---------|-----|
| 1 | verify-<name1> | `path/to/file.ts:42` | Problem description | Fix code example |
| 2 | verify-<name2> | `path/to/file.tsx:15` | Problem description | Fix code example |
```

### Step 4: Confirm User Action

If issues are found, use `AskUserQuestion` to confirm with the user:

```markdown
---

### Fix Options

**X issues found. How would you like to proceed?**

1. **Fix all** - Automatically apply all recommended fixes
2. **Fix individually** - Review and apply each fix one at a time
3. **Skip** - Exit without changes
```

### Step 5: Apply Fixes

Apply fixes based on the user's selection.

**If "Fix all" is selected:**

Apply all fixes in order and display progress:

```markdown
## Applying fixes...

- [1/X] verify-<name1>: `path/to/file.ts` fixed
- [2/X] verify-<name2>: `path/to/file.tsx` fixed

X fixes applied.
```

**If "Fix individually" is selected:**

Show each fix's content and confirm approval with `AskUserQuestion` for each issue.

### Step 6: Re-verify After Fixes

If fixes were applied, re-run only the skills that had issues and compare before/after:

```markdown
## Re-verification After Fixes

Re-running skills that had issues...

| Verification Skill | Before | After |
|--------------------|--------|-------|
| verify-<name1> | X issues | PASS |
| verify-<name2> | Y issues | PASS |

All verifications passed!
```

**If issues remain:**

```markdown
### Remaining Issues

| # | Skill | File | Problem |
|---|-------|------|---------|
| 1 | verify-<name> | `path/to/file.ts:42` | Cannot auto-fix — manual review required |

Resolve manually, then run `/verify-implementation` again.
```

---

## Exceptions

The following are **not problems**:

1. **Projects with no registered skills** — Display a guidance message and exit, not an error
2. **Each skill's own exceptions** — Patterns defined in a verify skill's Exceptions section are not reported as issues
3. **verify-implementation itself** — Do not include this skill in its own list of skills to run
4. **manage-skills** — Does not start with `verify-`, so it is not included in the run list

## Related Files

| File | Purpose |
|------|---------|
| `.claude/skills/manage-skills/SKILL.md` | Skill maintenance (manages the Skills to Run list in this file) |
| `CLAUDE.md` | Project instructions |

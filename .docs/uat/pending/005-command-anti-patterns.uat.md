# UAT: Command Anti-Patterns Guide and Tackle/UAT Verification Split

> **Source task**: [`.docs/tasks/active/005-command-anti-patterns.md`](../../tasks/active/005-command-anti-patterns.md)
> **Generated**: 2026-04-22

---

## Prerequisites

- [ ] Working directory is the project root (`/workspaces/basic-project-setup` or equivalent)
- [ ] Git is initialized and clean (or with known pending changes — the gitignore test just needs `git status` to work)

---

## Document Review Tests

### UAT-DOC-001: New guide exists and has correct header structure
- **File**: `.docs/guides/command-anti-patterns.md`
- **Description**: Verify the guide was created with the required title, Purpose line, and `---`-separated sections mirroring the `mcp-tools.md` style.
- **Steps**:
  1. Open `.docs/guides/command-anti-patterns.md`
  2. Confirm the first line is a `# command-anti-patterns.md` title
  3. Confirm the second non-blank line is a `**Purpose**: Shell-command and file-operation hygiene rules for AI agents running verification, setup, and one-off tasks.` line
  4. Confirm sections are separated by `---` dividers
- **Expected Result**: Title present, Purpose line present, all 7 sections separated by `---` dividers (no section immediately follows another without a divider)
- [ ] Pass

### UAT-DOC-002: Guide section — TOP RULE with bad/good examples
- **File**: `.docs/guides/command-anti-patterns.md`
- **Description**: The TOP RULE section must include a concrete bad example (the real `mktemp`-based incident) and a good example showing three separate invocations.
- **Steps**:
  1. Navigate to `## TOP RULE — One command, one job`
  2. Confirm the **Bad** block contains `mktemp -d` and multiple `&&`-chained commands ending with `cat /tmp/scratch_path.txt`
  3. Confirm the **Good** description shows three separate steps: `mkdir -p ./tmp/scratch`, `./sync-docs-scaffold.sh ./tmp/scratch`, then `mcp__serena__list_dir`
- **Expected Result**: Both examples present; bad example matches the real incident; good example demonstrates one-job-per-invocation with `./tmp/` as the scratch location
- [ ] Pass

### UAT-DOC-003: Guide section — project-local scratch over /tmp/
- **File**: `.docs/guides/command-anti-patterns.md`
- **Description**: The scratch-dir section must state the rule, explain why (Serena scope, safety), and include a two-invocation bash snippet.
- **Steps**:
  1. Navigate to `## Prefer project-local scratch`
  2. Confirm the rule says to use `./tmp/<purpose>/` and to add `tmp/` to `.gitignore`
  3. Confirm the three reasons are listed: (a) visible to Serena, (b) inspectable without leaving project tree, (c) safe to delete
  4. Confirm the bash snippet shows two separate lines (`mkdir -p ./tmp/scratch` then `./sync-docs-scaffold.sh ./tmp/scratch`)
- **Expected Result**: Rule, three-part rationale, and two-invocation snippet all present
- [ ] Pass

### UAT-DOC-004: Guide section — Verification belongs to the right phase
- **File**: `.docs/guides/command-anti-patterns.md`
- **Description**: The verification-phase section must accurately define what `/tackle` permits, what it prohibits, and where prohibited things belong.
- **Steps**:
  1. Navigate to `## Verification belongs to the right phase`
  2. Confirm the definition of `/tackle` verification: "static gates only" with examples `bash -n`, typecheck, lint, unit tests
  3. Confirm the NOT-allowed list includes: scratch dirs, running scripts against real paths, temp dirs, rsync dry-runs, curl calls, spawning servers, fixture seeding, asserting on output contents
  4. Confirm the redirect: "Everything above belongs in **UAT**"
  5. Confirm the rule of thumb: if the verification step needs more than one command, or creates any file, or reads any file's contents — move it to UAT
- **Expected Result**: All five elements present and accurate
- [ ] Pass

### UAT-DOC-005: tackle.md — Verification scope callout and tightened subagent item 3
- **File**: `.claude/commands/tackle.md`
- **Description**: Verify the two changes to tackle.md are present and coherent.
- **Steps**:
  1. Open `.claude/commands/tackle.md`
  2. Find the "Verification scope" callout (should be near line 68, just after the MCP Serena mandatory tools table and Exceptions paragraph): confirm it reads "Static gates only (bash -n, typecheck, lint, unit tests). Runtime/E2E verification is the UAT phase's job" and links to `command-anti-patterns.md#verification-belongs-to-the-right-phase`
  3. Find `### Subagent Requirements` → item 3: confirm it says "Run **static gates only**" not "Run quality gates"
  4. Confirm item 3 lists `bash -n` as the shell-script gate
  5. Confirm item 3 includes the `[DEFERRED-TO-UAT]` marker instruction for steps that call for runtime verification
  6. Confirm the "ALL type errors are caused by your changes" and "NEVER run `git stash`" sub-points are still present
- **Expected Result**: Callout present near top; item 3 leads with static-gates-only framing; DEFERRED-TO-UAT marker documented; prior type-error and stash-ban rules retained
- [ ] Pass

### UAT-DOC-006: uat-generator.md — Runtime verification ownership paragraph and new bullets
- **File**: `.claude/commands/uat-generator.md`
- **Description**: Verify the three additions to uat-generator.md are present and coherent.
- **Steps**:
  1. Open `.claude/commands/uat-generator.md`
  2. Near line 14, confirm the opening paragraph states: "UAT is the phase that owns **runtime and end-to-end verification**" and explicitly contrasts with `/tackle`'s static-only gates, with a link to `command-anti-patterns.md`
  3. In Step 4 "Coverage Categories", find the "**Shell scripts and helpers**" bullet: confirm it says UAT is the right place to execute scripts against `./tmp/` and explicitly says "Do NOT try to do this in `/tackle`"
  4. In the "Curl command standards" block, find the "**Scratch paths**" bullet: confirm it requires `./tmp/<purpose>/`, prohibits `/tmp/` and `$(mktemp -d)`, and explains Serena-scope as the reason
- **Expected Result**: All three additions present with accurate content
- [ ] Pass

---

## Edge Case Tests

### UAT-EDGE-001: `tmp/` is gitignored — new scratch dirs don't appear in git status
- **Scenario**: A developer follows the guide and creates `./tmp/scratch/` for testing. The `.gitignore` entry added in this task should prevent `git status` from tracking it.
- **Steps**:
  1. Create a test scratch directory:
     ```bash
     mkdir -p ./tmp/uat-edge-001
     ```
  2. Check git status:
     ```bash
     git status --porcelain
     ```
  3. Clean up:
     ```bash
     rm -rf ./tmp/uat-edge-001
     ```
- **Expected Result**: Step 2 output does NOT contain any line mentioning `tmp/` or `uat-edge-001`. The directory is silently ignored by git. (Other pending changes may appear — that is fine; only verify `tmp/` is absent from the output.)
- [ ] Pass

---

## Integration Tests

### UAT-INT-001: Cross-link ecosystem — guide, mcp-tools.md, and command files all reference each other correctly
- **Description**: Verify the cross-link web is coherent: command-anti-patterns.md links to mcp-tools.md and task-lifecycle.md; mcp-tools.md links back to command-anti-patterns.md; tackle.md and uat-generator.md both reference command-anti-patterns.md.
- **Steps**:
  1. Open `.docs/guides/command-anti-patterns.md` → `## See also` section: confirm links to `./mcp-tools.md` and `./task-lifecycle.md`
  2. Confirm both linked files actually exist: navigate to `.docs/guides/mcp-tools.md` and `.docs/guides/task-lifecycle.md`
  3. Open `.docs/guides/mcp-tools.md` → end of "### Common anti-patterns and their fixes" section: confirm the "**See also**" line links to `./command-anti-patterns.md`
  4. Open `.claude/commands/tackle.md`: confirm the "Verification scope" callout links to `.docs/guides/command-anti-patterns.md#verification-belongs-to-the-right-phase`
  5. Open `.claude/commands/uat-generator.md`: confirm the opening runtime-verification paragraph ends with a link to `.docs/guides/command-anti-patterns.md`
- **Expected Result**: All five link targets exist; no broken references; the cross-link circle is complete (guide ↔ mcp-tools, guide ← tackle, guide ← uat-generator)
- [ ] Pass

### UAT-INT-002: Phase-split accuracy — static vs runtime distinction is consistently stated across all changed files
- **Description**: The core rule ("tackle = static gates; UAT = runtime/E2E") must be stated consistently and without contradiction across the new guide, tackle.md, and uat-generator.md.
- **Steps**:
  1. In `command-anti-patterns.md` → `## Verification belongs to the right phase`: note the definition of "static gates" (`bash -n`, typecheck, lint, unit tests)
  2. In `tackle.md` → Subagent Requirements item 3: confirm the same four permitted gates are listed (shell syntax check, typecheck, lint, unit tests) and runtime operations are explicitly banned
  3. In `uat-generator.md` → opening paragraph: confirm it says `/tackle` only runs the same static gates, and that runtime behavior belongs in UAT
  4. Confirm no file says anything that contradicts another (e.g., one file should not call curl a "static gate" while another bans it)
- **Expected Result**: All three files agree on the same definition of static gates; no contradictions; the phase boundary is unambiguous
- [ ] Pass

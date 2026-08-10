---
id: UAT-048
title: "UAT: /bootstrap-config skill — view, edit, and reset stored preferences"
status: passed
task: TASK-048
created: 2026-08-07
updated: 2026-08-07
---

# UAT-048 — UAT: /bootstrap-config skill — view, edit, and reset stored preferences

implements::[[TASK-048]]

> **Source task**: [[TASK-048]]
> **Generated**: 2026-08-07

---

## Scope

TASK-048 created **exactly one file**: `lib/skills/bootstrap-config/SKILL.md`. It
touched no helper, no schema, no installer script, and no other skill. This UAT
therefore verifies the file itself and, critically, **the joins** — the skill is
markdown that a model executes, so every helper flag it spells must exist, every
value it offers must come from the schema, and every factual claim it makes about
the helper's behaviour must still be true. Those three drift independently of the
skill and nothing else in the suite notices.

Registration in `lib/skills/README.md` and the `CLAUDE.md` Custom Commands table
is **ROADMAP-005 Phase 4** and is deliberately out of scope; one test below pins
that boundary so it becomes visible when Phase 4 lands.

---

## Prerequisites

- [ ] `node` and `bash` on `PATH`; run from the repo root
- [ ] No network required
- [ ] **Never run `install-global.sh` against the real `$HOME`**, and never read or
      write the real `~/.claude/bootstrap-prefs.json` — every helper invocation
      below runs against an `fs.mkdtemp` scratch HOME removed in a `finally`

---

## Test Cases

### UAT-EDGE-001: frontmatter matches the specified keys and values exactly
- **Scenario**: `name` is how the command is invoked and `user-invocable: true` is
  what makes it appear at all, so drift here silently *removes* the command
  rather than altering it.
- **Steps**: Compare the first nine lines against the eight specified keys.
- **Command**:
  ```bash
  node --test --test-name-pattern="frontmatter matches the specified keys" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. All eight keys present with the exact
  specified values, including `model: claude-haiku-4-5-20251001` and
  `argument-hint: [view | edit | reset] [--global | --project]`.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-002: line 10 is the short `**Prereqs:**` form
- **Scenario**: `serena-config` is the structural template and carries its
  Prereqs line at the same position. The `/primer` clause is deliberately absent
  here because this command reads no codebase.
- **Steps**: Assert line 10 is exactly ``**Prereqs:** obey `wiki/guides/mcp-tools.md`.``
- **Command**:
  ```bash
  node --test --test-name-pattern="line 10 is the short Prereqs form" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-003: every helper flag the skill spells actually exists in the helper
- **Scenario**: The skill's `node <helper> …` lines are executed verbatim. A flag
  the helper does not know is a hard usage error at run time — surfaced to the
  user as a raw error from a tool they never invoked.
- **Steps**: Extract every `--flag` from every `node <helper>` invocation in the
  skill and confirm each appears in the helper's usage block.
- **Command**:
  ```bash
  node --test --test-name-pattern="every helper flag the skill spells" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Every extracted flag (`--list`, `--get`,
  `--set`, `--unset`, `--value`, `--global`, `--project`, `--target`, `--schema`,
  `--section-key`) resolves.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-004: `--set`/`--unset` are always shown with exactly one layer selector
- **Scenario**: Zero selectors and two selectors are both usage errors — the
  helper refuses to guess which file to write. A skill example carrying either
  would teach a command that cannot run.
- **Steps**: Count selectors on every `--set`/`--unset` example, then confirm the
  helper really does reject a zero-selector `--set`.
- **Command**:
  ```bash
  node --test --test-name-pattern="always shown with exactly one layer selector" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Every example carries exactly one; the
  helper exits **1** with
  `--set requires exactly one of --global, --project <dir>, --target <path>`.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-005: the layer annotations the skill names are the ones `--list` emits
- **Scenario**: The skill instructs the reader to carry `[project]` / `[global]` /
  `[default]` / `[unset]` / `[target]` through verbatim. An invented annotation
  would have the user hunting for a bracket that never appears.
- **Steps**: Assert all five appear in the skill and all five are produced by the helper.
- **Command**:
  ```bash
  node --test --test-name-pattern="layer annotations the skill names" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-006: the abort message for a missing helper is present verbatim
- **Scenario**: The message names the two commands that fix the situation. A
  vaguer message leaves the user with a dead command and no next step.
- **Steps**: Assert the exact sentence is present.
- **Command**:
  ```bash
  node --test --test-name-pattern="abort message for a missing helper" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-007: the `consumer: skill` population named in the skill matches the schema exactly
- **Scenario**: Step D attaches a heavier warning banner to `consumer: skill`
  keys, because changing one changes what a slash command *does* rather than
  merely whether the installer prompts. A key that gained `consumer: skill` and
  was not added here would silently get the lighter framing; a key listed here
  that is not `consumer: skill` would over-warn and train the user to ignore the
  banner.
- **Steps**: Compare Step D's inline population against the schema in **both**
  directions.
- **Command**:
  ```bash
  node --test --test-name-pattern="consumer: skill population named in the skill" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass across all five keys — `gitCommit.versionBump`,
  `gitCommit.autoPush`, `research.persistToRaw`, `uatGenerate.promoteTests`,
  `gitignore.offerSectionUpdates` — with no extras.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-008: every value the skill offers traces back to a schema `values` string
- **Scenario**: The schema is the single source of truth and the helper validates
  against it, so an option the grammar omits is guaranteed to exit 1. Two
  grammars are called out by name because both are traps: `gitCommit.versionBump`
  is `auto | confirm | never` (**`confirm` IS the ask state** — there is no
  separate `ask`), and `gitignore.section.*` is `false` only (a remembered `true`
  would let a later template version append to a project's `.gitignore` without
  asking).
- **Steps**: Compare both quoted grammars against the schema, then confirm
  behaviourally that the helper rejects the two tempting widenings.
- **Command**:
  ```bash
  node --test --test-name-pattern="every value the skill offers traces back" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Both grammars match the schema; `--set
  gitCommit.versionBump --value ask` exits **1**; `--set gitignore.section.example
  --value true` exits **1**.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-009: `unset` and `null` are refused as values, with the pointer the skill promises
- **Scenario**: Absence is the entire representation of `unset`. If the refusal
  stopped being true the skill would be teaching a workaround for a problem that
  no longer exists — or hiding one that does.
- **Steps**: Attempt both, assert exit 1 and the `--unset` pointer, and confirm
  the skill still documents the refusal.
- **Command**:
  ```bash
  node --test --test-name-pattern="are refused as values" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. Both exit **1** with
  `is not a storable value — absence is how a key is unset` and a
  `--unset gitCommit.autoPush` pointer.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-001: the skill's claim that `--set` does not enforce `scope` is accurate
- **Scenario**: **The finding this UAT exists to confirm.** Step E.2 states that
  `--set` does not enforce `scope` — it will happily write a `global`-scope key
  into a project file where nothing reads it — and that the skill's own layer
  offer is therefore *the only guard*. That sentence is load-bearing prose: it
  justifies why the skill computes legal layers itself instead of letting the
  helper reject a bad combination. Pinned in **both** directions, so if the
  helper is ever taught to enforce `scope` this test fails and points at the
  prose that just became wrong.
- **Steps**:
  1. Write `mcp.braveSearch` (a `scope: global` key) into a scratch **project** layer.
  2. Confirm the write succeeds, lands on disk, and reads back as `unset`.
  3. Confirm only the generated companion flags it.
- **Command**:
  ```bash
  node --test --test-name-pattern="does not enforce scope is still accurate" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. `--set … --project` exits **0** and prints
  a success line; the key is present in the project values file; `--get` returns
  **`unset`**; and `bootstrap-prefs.README.md` lists it under **Unrecognized
  keys** with the reason `scope is global … this layer never consults it`. The
  skill's claim is therefore accurate as written.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-002: the two safety rules are stated, and stated before the first `AskUserQuestion`
- **Scenario**: Both rules are inherited from `serena-config` and both have silent
  failure modes — prompting against an unread store produces a confident question
  about state nobody looked at, and writing the values file directly bypasses
  value validation, `true`/`false` JSON coercion, atomic writes, and the
  regenerated companion all at once. Ordering matters: a reader following the
  file top-down must meet the rule before the thing it forbids.
- **Steps**: Assert both rule blocks exist, that the ordering rule precedes the
  first `AskUserQuestion` mention, and that the mandatory `No changes` escape is
  offered.
- **Command**:
  ```bash
  node --test --test-name-pattern="two safety rules are stated" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. `**CRITICAL ORDERING RULE**` and
  `**Writes go through the helper.**` both present; the ordering rule's index is
  lower than the first `AskUserQuestion`; `No changes` promises to write nothing.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-003: `install-global.sh --skip-mcps` syncs the skill into a redirected `~/.claude/skills/`
- **Scenario**: TASK-048 step 12's `[DEFERRED-TO-UAT]` item — a skill edit is not
  live until the installer runs. **Verified against a scratch HOME, never the
  developer's real `~/.claude/skills/`**, which is theirs to update when they
  choose. What this proves is that the sync mechanism picks the new skill up;
  whether it is live on any given machine is that machine's business.
- **Steps**: Run the installer with `HOME` redirected to an `fs.mkdtemp` dir and
  confirm the skill lands there byte-identical to the repo source.
- **Command**:
  ```bash
  node --test --test-name-pattern="syncs the skill into a redirected" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass. `<scratch>/.claude/skills/bootstrap-config/SKILL.md`
  exists and matches `lib/skills/bootstrap-config/SKILL.md` exactly.
  **The real `~/.claude/skills/bootstrap-config/` remains absent** — `/bootstrap-config`
  is not live for the user until they run the installer themselves.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-010: registration is still Phase 4 — the skill is not listed in README or CLAUDE.md
- **Scenario**: TASK-048 excluded both files explicitly so a concurrent Phase 4
  pass owns them and a duplicate edit cannot collide. This test makes the
  boundary visible when Phase 4 lands: it fails, and the correct fix is to delete
  it.
- **Steps**: Assert neither `lib/skills/README.md` nor `CLAUDE.md` mentions
  `bootstrap-config`.
- **Command**:
  ```bash
  node --test --test-name-pattern="registration is still Phase 4" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass — neither file mentions it.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-011: the skill directory holds exactly the one file TASK-048 was scoped to create
- **Scenario**: The task states it creates one file only. An extra file in the
  directory is unreviewed scope.
- **Steps**: List `lib/skills/bootstrap-config/` and assert it is exactly `["SKILL.md"]`.
- **Command**:
  ```bash
  node --test --test-name-pattern="holds exactly the one file" test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: 1 test, 1 pass.
- **Repeatable Unit Test**: Created: `test/bootstrap-config-skill.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-INT-004: the full suite is green with zero skips
- **Scenario**: The invariant is **0 fail and 0 skipped** — a new skip would
  silently retire a check.
- **Steps**: Run the full suite from the repo root.
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `fail 0` and `skipped 0`. Count is **290** (the 264
  baseline, plus 12 promoted by UAT-030, plus 14 promoted here).
- **Repeatable Unit Test**: Not applicable: this *is* the suite.
- [x] Pass <!-- 2026-08-07 -->

---

## Out of Scope

- `bootstrap-prefs.js` and the schema (ROADMAP-005 Phase 1)
- The installer preferences pass (TASK-030 / UAT-030)
- Registering `/bootstrap-config` in `lib/skills/README.md` and `CLAUDE.md` (Phase 4)
- Interactive behaviour of the skill at run time — the `AskUserQuestion` flow needs
  a human and a live model; what is testable without one is the contract with the
  helper and the schema, which is what this UAT covers

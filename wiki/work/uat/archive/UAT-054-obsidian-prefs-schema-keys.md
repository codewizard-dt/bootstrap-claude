---
id: UAT-054
aliases: [UAT-054]
title: "UAT: Add obsidian.installApp + obsidian.plugins keys to bootstrap-prefs-schema.json"
status: passed
task: TASK-054
created: 2026-08-13
updated: 2026-08-14
---

# UAT-054 — UAT: Add obsidian.installApp + obsidian.plugins keys to bootstrap-prefs-schema.json

implements::[[TASK-054]]

> **Source task**: [[TASK-054]]
> **Generated**: 2026-08-13

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js available on `PATH` (the suite runs `node --test`)
- [ ] `lib/scripts/templates/bootstrap-prefs-schema.json` contains `obsidian.installApp` and `obsidian.plugins`

**Scope note.** TASK-054 is a documentation-only change to one data file: two new entries in `lib/scripts/templates/bootstrap-prefs-schema.json`. No script, reader, or wiring code was added or changed here — `lib/scripts/install-obsidian.sh` (TASK-053) and its wiring (TASK-055) are separate, parallel/sequenced tasks and are out of scope. These tests assert facts about the schema file's shape and content, and about the existing generic schema-invariant test suite's coverage of it — not about installer behavior.

**Safety.** Every check below is a read-only static assertion against the repo's checked-in files. No test touches `~/.claude/bootstrap-prefs.json` or `~/.claude/settings.json`, and none runs any installer.

---

## Test Cases

### UAT-EDGE-001: Both new entries carry their documented field shape
- **Scenario**: The task's Approach section specifies exact `scope`, `consumer`, `values`, `default`, and `askedBy` for each key — `obsidian.installApp` global (machine-wide app, matching `mcp.playwright`), `obsidian.plugins` project (files live in this project's `.obsidian/`, matching `guides.*`). A swapped or mistyped field would pass casual reading of the JSON but ask the wrong question at the wrong layer.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));const a=s["obsidian.installApp"],b=s["obsidian.plugins"];console.log("installApp:",JSON.stringify({scope:a.scope,consumer:a.consumer,values:a.values,default:a.default,askedBy:a.askedBy}));console.log("plugins:",JSON.stringify({scope:b.scope,consumer:b.consumer,values:b.values,default:b.default,askedBy:b.askedBy}))'
  ```
- **Expected Result**: Prints `installApp: {"scope":"global","consumer":"installer","values":"true | false","default":null,"askedBy":"install-obsidian.sh"}` and `plugins: {"scope":"project","consumer":"installer","values":"true | false","default":null,"askedBy":"install-obsidian.sh"}`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`schema: obsidian.installApp and obsidian.plugins carry their documented shape and sit between mcp.playwright and skills.pruneOrphans`) — new test added in this UAT generation, verified passing before this file was written.
- **Unit Test Command**: `node --test --test-name-pattern='obsidian.installApp and obsidian.plugins carry their documented shape' test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-002: The pair sits directly after `mcp.playwright` and before `skills.pruneOrphans`
- **Scenario**: TASK-054 step 1 records inserting both keys "directly after `mcp.playwright` and before `skills.pruneOrphans`" so the pair reads naturally alongside the other `mcp.*`/`guides.*` entries per the file's rough thematic (not strictly-scope-sorted) grouping. A later edit that separates the pair or relocates it elsewhere would still leave valid JSON — this is a documentation-quality claim, not a parse-time one.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));const keys=Object.keys(s);const i=keys.indexOf("mcp.playwright");console.log("run:",JSON.stringify(keys.slice(i,i+4)))'
  ```
- **Expected Result**: Prints `run: ["mcp.playwright","obsidian.installApp","obsidian.plugins","skills.pruneOrphans"]` — an unbroken four-key run in that exact order.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (same test as UAT-EDGE-001 — it asserts shape and placement together)
- **Unit Test Command**: `node --test --test-name-pattern='obsidian.installApp and obsidian.plugins carry their documented shape' test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-003: The existing generic schema-invariant suite already covers both new keys, with zero suite edits required for those checks
- **Scenario**: `test/bootstrap-prefs.test.js` carries a family of loop-based tests driven by `schemaEntries()` that iterate every key in the file — required fields present, `scope`/`consumer` are legal enum values, no `consumer:"installer"` key carries a non-null default, every `askedBy` names a real `lib/scripts/` file, no key can hold a secret, and the file stays a flat JSON map. Because both new keys are ordinary `consumer:"installer"` entries with a closed `true | false` grammar and `default: null`, these generic loops already exercise them correctly with no changes to the loops themselves — confirmed by running them after the schema edit.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node --test --test-name-pattern='every entry carries all seven required fields|every scope is global.project.either|no consumer:.installer. key carries a non-null default|every askedBy names a real|no preference key can hold a secret|flat map of key' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 6`, `fail 0`. All six generic checks pass with `obsidian.installApp` and `obsidian.plugins` present in the schema.
- **Repeatable Unit Test**: Not applicable: this case verifies that pre-existing generic tests already provide coverage — nothing new to create; the assertion is that the loop-based tests require no edit to extend to the new keys, which is what the Unit Test Command demonstrates directly.
- **Unit Test Command**: `node --test --test-name-pattern='every entry carries all seven required fields|every scope is global.project.either|no consumer:.installer. key carries a non-null default|every askedBy names a real|no preference key can hold a secret|flat map of key' test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-13 -->

### UAT-EDGE-004: `obsidian.installApp`'s detail documents mechanism, consequence, and the scope rationale
- **Scenario**: Per the task's Approach, the `detail` prose must explain: what gates (app not yet installed), the mechanism (native package manager — brew/flatpak), the standard sticky-prompt semantics (true keeps offering until present; false stops offering until changed via `/bootstrap-config`), and why the key is global scope (matching `mcp.playwright`'s scope choice, since the app is machine-wide).
- **Steps**:
  1. Read `obsidian.installApp.detail` in `lib/scripts/templates/bootstrap-prefs-schema.json`
  2. Confirm it names `brew` and `flatpak`, references sticky-prompt semantics, names `/bootstrap-config`, and cites `mcp.playwright`'s scope choice
- **Expected Result**: All five elements are present in the prose.
- **Repeatable Unit Test**: Not applicable: asserts explanatory prose in `detail`, which is deliberately free text meant to be rewritten as understanding improves (matches this repo's prior schema-documentation UATs, e.g. UAT-040 EDGE-005/EDGE-013/EDGE-014); pinning exact wording would ossify the one field intended to stay editable, and no business logic or parseable contract sits behind it.
- [x] Pass <!-- 2026-08-14 -->

### UAT-EDGE-005: `obsidian.plugins`'s detail documents the bundled-prompt rationale and the scope rationale
- **Scenario**: Per the task's Approach, the `detail` prose must explain: this is a single bundled prompt (not one key per plugin) covering Dataview, Graph Link Types, and Breadcrumbs together, because Dataview is a hard prerequisite the other two read indexed fields from; the mechanism (installs into `.obsidian/plugins/` and enables via `.obsidian/community-plugins.json`); and why the key is project scope (matching `guides.*`'s scope choice, since plugin files live inside this project's own `.obsidian/`).
- **Steps**:
  1. Read `obsidian.plugins.detail` in `lib/scripts/templates/bootstrap-prefs-schema.json`
  2. Confirm it names all three plugins, states the single-bundled-prompt design and the Dataview-prerequisite reasoning, names `.obsidian/community-plugins.json`, and cites `guides.*`'s scope choice
- **Expected Result**: All five elements are present in the prose.
- **Repeatable Unit Test**: Not applicable: asserts explanatory prose in `detail` for the same reason as UAT-EDGE-004 — free text by design, not a business-logic contract.
- [x] Pass <!-- 2026-08-14 -->

### UAT-EDGE-006: The whole file is still valid, flat JSON with no syntax damage from the insertion
- **Scenario**: The task's own step 1 records verifying this with `python3 -m json.tool` after the edit. Two new entries inserted mid-file are the classic place to leave a missing/extra comma — either breaks every one of the schema's three independent readers (all bare `JSON.parse`), not just the two new keys.
- **Steps**:
  1. Run the command below
- **Command**:
  ```bash
  node -e 'const s=JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));console.log("keys:",Object.keys(s).length,"| array?",Array.isArray(s),"| has both new keys:",Object.prototype.hasOwnProperty.call(s,"obsidian.installApp")&&Object.prototype.hasOwnProperty.call(s,"obsidian.plugins"))'
  ```
- **Expected Result**: Parses with no error and prints `keys: 21 | array? false | has both new keys: true`.

  > **Gap note.** Running the full `test/bootstrap-prefs.test.js` file (`node --test test/bootstrap-prefs.test.js`) at generation time shows `pass 72, fail 1` — the one failure (`schema: every script:line citation in a detail still points at the line it claims`) is a **pre-existing citation drift** in the unrelated `mcp.context7Scope` entry, whose `detail` cites `lib.sh:387` but that line no longer holds `"Scope for $name"`. This is unrelated to `obsidian.*` (confirmed: the failure message names `mcp.context7Scope`, not either new key) and almost certainly caused by a concurrent sibling task editing `lib.sh` while this UAT was generated. TASK-054's own Notes explicitly forbid editing `lib/scripts/lib.sh` here, so this failure is out of scope to fix from this task and is reported as a gap rather than silently worked around.
- **Repeatable Unit Test**: Not applicable: the JSON-validity/key-count snapshot above is a point-in-time sanity check, already subsumed by UAT-EDGE-003's generic `flat map of key` assertion, which runs on every `npm test`.
- [x] Pass <!-- 2026-08-13 -->

---

## Gaps

- **Pre-existing, unrelated test failure observed at generation time.** `test/bootstrap-prefs.test.js`'s `schema: every script:line citation in a detail still points at the line it claims` test fails because `mcp.context7Scope`'s `detail` cites `lib.sh:387`, which no longer contains `"Scope for $name"`. This is not caused by, and not fixable within, TASK-054's scope (schema-file-only; `lib.sh` is explicitly off-limits per the task's Notes) — most likely caused by a concurrent sibling task's edit to `lib.sh` landing while this UAT was generated. Flagging for the orchestrator / a follow-up citation-repair task; do not let it block TASK-054's own UAT judging, since neither failing assertion names `obsidian.installApp` or `obsidian.plugins`.
- **`detail` prose quality is not asserted**, per this repo's established practice for free-text schema documentation fields (UAT-EDGE-004, UAT-EDGE-005; see UAT-040 EDGE-005/EDGE-013/EDGE-014 for precedent) — only presence of the required explanatory elements is checked, not writing quality. This is intentional, not a shortfall: `detail` is meant to be revised as understanding improves, and a human reviewer is the right judge of whether the explanation actually reads well.
- **No integration/UI tests**: this task changes a single JSON data file with no reader, endpoint, or UI surface of its own (TASK-055 wires `install-obsidian.sh` into the sync flow separately), so no UAT-API or UAT-UI cases apply.

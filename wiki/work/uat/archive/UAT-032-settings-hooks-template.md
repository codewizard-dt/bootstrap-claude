---
id: UAT-032
aliases: [UAT-032]
title: "UAT: Extract canonical hooks wiring into settings-hooks.json"
status: passed
task: TASK-032
created: 2026-07-31
updated: 2026-07-31
---

# UAT-032 — UAT: Extract canonical hooks wiring into settings-hooks.json

implements::[[TASK-032]]

> **Source task**: [[TASK-032]]
> **Generated**: 2026-07-31

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`; every command below assumes `cwd` is the repo root.
- [ ] `node` (v18+) on `PATH`.
- [ ] `npm` on `PATH` (only needed for UAT-FILE-005's packaging check).
- [ ] The working tree may carry unrelated, in-flight changes from sibling ROADMAP-004 tasks (TASK-033–038) running concurrently. These tests only read `lib/scripts/templates/settings-hooks.json`, `lib/hooks/README.md`, `lib/hooks/*.js`, and `package.json`, and are unaffected by edits elsewhere.

---

## Test Cases

### UAT-FILE-001: template is a bare hooks-value object with exactly the four expected top-level keys

Per the task's approach, the template must **not** be wrapped in a top-level `"hooks"` key (mirroring `settings-deny.json` shipping as a bare array rather than `{"deny": [...]}`).

- **Scenario**: Static inspection of the shipped template file.
- **Repeatable Unit Test**: Not applicable: reserved for TASK-034 (`test/settings-hooks.test.js`), which owns template invariants; captured here as a re-runnable inline command instead of duplicating that suite.
- **Steps**:
  1. ```bash
     node -e '
     const fs = require("fs");
     const t = JSON.parse(fs.readFileSync("lib/scripts/templates/settings-hooks.json", "utf8"));
     const keys = Object.keys(t).sort().join(",");
     const expected = ["PostToolUse","PostToolUseFailure","PreToolUse","SessionStart"].join(",");
     if (keys !== expected) throw new Error("unexpected top-level keys: " + keys);
     if ("hooks" in t) throw new Error("template must not be wrapped in a top-level hooks key");
     console.log("ok: top-level keys are exactly SessionStart, PreToolUse, PostToolUse, PostToolUseFailure (unwrapped)");
     '
     ```
- **Expected Result**: Prints `ok: top-level keys are exactly SessionStart, PreToolUse, PostToolUse, PostToolUseFailure (unwrapped)`. The file parses as valid JSON and has no top-level `hooks` key.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-FILE-002: template content is structurally identical to the README's inline JSON block

The extraction must be byte-for-byte (no paraphrasing, reordering, or reformatting of keys/values) — later tasks depend on this equivalence for a byte-diff-style verification.

- **Scenario**: Compare the template against the JSON object currently fenced under `## Required ~/.claude/settings.json wiring` in `lib/hooks/README.md`, unwrapping the README's outer `"hooks"` key before comparing.
- **Repeatable Unit Test**: Not applicable: reserved for TASK-034 (`test/settings-hooks.test.js`), which owns template invariants; captured here as a re-runnable inline command instead of duplicating that suite.
- **Steps**:
  1. ```bash
     node -e '
     const fs = require("fs");
     const assert = require("assert");
     const md = fs.readFileSync("lib/hooks/README.md", "utf8");
     const headingIdx = md.indexOf("Required");
     if (headingIdx === -1) throw new Error("heading not found");
     const startBrace = md.indexOf("{", headingIdx);
     let depth = 0, end = -1;
     for (let i = startBrace; i < md.length; i++) {
       if (md[i] === "{") depth++;
       else if (md[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
     }
     if (end === -1) throw new Error("no matching closing brace found");
     const readmeHooks = JSON.parse(md.slice(startBrace, end + 1)).hooks;
     const template = JSON.parse(fs.readFileSync("lib/scripts/templates/settings-hooks.json", "utf8"));
     assert.deepStrictEqual(template, readmeHooks);
     console.log("ok: template matches README hooks block exactly (byte-for-byte structural equivalence)");
     '
     ```
- **Expected Result**: Prints `ok: template matches README hooks block exactly (byte-for-byte structural equivalence)`. `assert.deepStrictEqual` does not throw — every event, matcher, hook `command`, and the `if` conditional are identical, in the same order, between the README's fenced block and the extracted template.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-FILE-003: the `mv-absolute-path-block.js` entry retains its `if: "Bash(mv *)"` conditional filter

This is the one hook entry in the whole set that carries a conditional `if` filter; it must survive extraction unaltered.

- **Scenario**: Locate the `mv-absolute-path-block.js` command inside `PreToolUse` and check its `if` field.
- **Repeatable Unit Test**: Not applicable: reserved for TASK-034 (`test/settings-hooks.test.js`), which owns template invariants; captured here as a re-runnable inline command instead of duplicating that suite.
- **Steps**:
  1. ```bash
     node -e '
     const fs = require("fs");
     const assert = require("assert");
     const t = JSON.parse(fs.readFileSync("lib/scripts/templates/settings-hooks.json", "utf8"));
     let found = null;
     for (const block of t.PreToolUse) {
       for (const h of block.hooks) {
         if (h.command && h.command.includes("mv-absolute-path-block.js")) found = h;
       }
     }
     assert.ok(found, "mv-absolute-path-block.js hook entry not found under PreToolUse");
     assert.strictEqual(found.if, "Bash(mv *)");
     console.log("ok: mv-absolute-path-block.js retains its if: Bash(mv *) conditional filter");
     '
     ```
- **Expected Result**: Prints `ok: mv-absolute-path-block.js retains its if: Bash(mv *) conditional filter`. No assertion throws.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-FILE-004: bijection between the 18 `lib/hooks/*.js` scripts and the commands referenced in the template

Every hook script actually shipped must be wired at least once, every command in the template must resolve to a real script, and `serena-usage-tracker.js` — the one script referenced from two different events — must appear exactly twice while every other basename appears exactly once.

- **Scenario**: List the `.js` files directly inside `lib/hooks/` (excluding the `lib/hooks/lib/` subdirectory and `README.md`) and cross-check against every `command` string in the template.
- **Repeatable Unit Test**: Not applicable: reserved for TASK-034 (`test/settings-hooks.test.js`), which explicitly owns the hooks↔template bijection as a unit-tested invariant; captured here as a re-runnable inline command instead of duplicating that suite.
- **Steps**:
  1. ```bash
     node -e '
     const fs = require("fs");
     const assert = require("assert");
     function isJs(f) { return f.slice(-3) === ".js"; }
     const basenames = fs.readdirSync("lib/hooks").filter(isJs);
     assert.strictEqual(basenames.length, 18, "expected 18 hook scripts directly in lib/hooks, found " + basenames.length);
     const template = JSON.parse(fs.readFileSync("lib/scripts/templates/settings-hooks.json", "utf8"));
     const counts = {};
     for (const b of basenames) counts[b] = 0;
     for (const event of Object.keys(template)) {
       for (const block of template[event]) {
         for (const h of block.hooks) {
           const m = h.command.match(/([\w.-]+\.js)$/);
           if (!m) throw new Error("unparseable command string: " + h.command);
           const name = m[1];
           if (!(name in counts)) throw new Error("template references a hook file not present in lib/hooks: " + name);
           counts[name]++;
         }
       }
     }
     for (const b of basenames) {
       const expected = b === "serena-usage-tracker.js" ? 2 : 1;
       assert.strictEqual(counts[b], expected, b + " expected " + expected + " reference(s), found " + counts[b]);
     }
     console.log("ok: bijection verified across all " + basenames.length + " hook scripts (serena-usage-tracker.js x2, all others x1)");
     '
     ```
- **Expected Result**: Prints `ok: bijection verified across all 18 hook scripts (serena-usage-tracker.js x2, all others x1)`. No assertion throws — every basename resolves, `serena-usage-tracker.js` counts exactly 2, every other basename counts exactly 1.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-FILE-005: the template ships in the npm tarball via `package.json`'s unqualified `lib/` entry

`package.json`'s `files` array lists `lib/` unqualified alongside negations for `raw/research/`, `raw/companies/`, and `raw/*.pdf` — none of which touch `lib/scripts/templates/`. The new template must actually appear in the packed file list, not just be assumed safe.

- **Scenario**: Dry-run the npm pack and inspect the resulting file manifest.
- **Repeatable Unit Test**: Not applicable: requires the real `npm pack` packaging pipeline, not repo code in isolation.
- **Steps**:
  1. ```bash
     npm pack --dry-run --json | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const files=j[0].files.map(f=>f.path);if(!files.includes('lib/scripts/templates/settings-hooks.json')){throw new Error('template missing from npm tarball file list');}console.log('ok: template ships in npm tarball ('+files.length+' files total)');})"
     ```
- **Expected Result**: Prints `ok: template ships in npm tarball (<N> files total)` with no thrown error — `lib/scripts/templates/settings-hooks.json` is present in the packed manifest.
- [x] Pass <!-- 2026-07-31 -->

---

### UAT-EDGE-001: scope boundary respected — no merge script, README untouched

This task is a pure extraction: no merge logic (`lib/scripts/merge-settings-hooks.js`, TASK-033's deliverable) and no README rewrite (TASK-034+/later work) should exist yet.

- **Scenario**: Confirm `lib/scripts/merge-settings-hooks.js` does not exist and `lib/hooks/README.md` still carries its own inline JSON block (i.e. it was not replaced with a pointer to the new template).
- **Repeatable Unit Test**: Not applicable: reserved for TASK-034 (`test/settings-hooks.test.js`); captured here as a re-runnable inline command instead of duplicating that suite.
- **Steps**:
  1. ```bash
     node -e '
     const fs = require("fs");
     if (fs.existsSync("lib/scripts/merge-settings-hooks.js")) {
       throw new Error("merge-settings-hooks.js should not exist yet - that is TASK-033 scope");
     }
     const md = fs.readFileSync("lib/hooks/README.md", "utf8");
     const headingIdx = md.indexOf("Required");
     if (headingIdx === -1) throw new Error("README heading missing");
     const braceIdx = md.indexOf("{", headingIdx);
     if (braceIdx === -1) throw new Error("README no longer contains its inline hooks JSON block - this task must not touch README.md");
     console.log("ok: scope boundary intact - no merge script created yet, README inline JSON block left untouched");
     '
     ```
- **Expected Result**: Prints `ok: scope boundary intact - no merge script created yet, README inline JSON block left untouched`. No assertion throws.
- [x] Pass <!-- 2026-07-31 -->

---

## Notes on scope

- These tests cover only TASK-032's extraction deliverable (`lib/scripts/templates/settings-hooks.json`) and its scope boundary. Merge behavior (append/idempotency/malformed-target handling) is TASK-033's `merge-settings-hooks.js`, and its comprehensive invariant + bijection test suite is TASK-034's `test/settings-hooks.test.js` — neither is duplicated here.
- No new unit test file was created by this UAT: every assertion above is deterministic and would normally be unit-test promotable, but `test/settings-hooks.test.js` is explicitly reserved as TASK-034's deliverable, so the assertions are kept as re-runnable inline commands in this file instead.

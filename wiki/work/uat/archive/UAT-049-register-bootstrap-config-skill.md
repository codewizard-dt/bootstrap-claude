---
id: UAT-049
aliases: [UAT-049]
title: "UAT: Register /bootstrap-config in lib/skills/README.md and the CLAUDE.md Custom Commands table"
status: passed
task: TASK-049
created: 2026-08-07
updated: 2026-08-07
---

# UAT-049 — UAT: Register /bootstrap-config in lib/skills/README.md and the CLAUDE.md Custom Commands table

implements::[[TASK-049]]

> **Source task**: [[TASK-049]]
> **Generated**: 2026-08-07

---

## Scope

TASK-049 edited **exactly two files** — `lib/skills/README.md` and `CLAUDE.md` —
and deleted one test block plus its orphaned banner from
`test/bootstrap-config-skill.test.js`. There is no runtime behaviour to exercise:
every claim is a static-text claim about a markdown table or the absence of a
deleted test. This UAT therefore verifies four things the task can get wrong
silently:

1. the row landed in the **right table** with the **right local convention**
   (bare name in `lib/skills/README.md`, leading slash + argument hint in
   `CLAUDE.md`) and its Purpose cell still traces to the SKILL.md `description`;
2. the `CLAUDE.md` row **renders as two cells** — the task names unescaped pipes
   as its single most likely defect;
3. the tripwire was **deleted**, not skipped or inverted — a skipped test reads
   as a passing one;
4. the two deliberately out-of-scope files were **not** touched.

Test 5 and 6 pin the suite totals, because the tripwire's removal is supposed to
move the count 290 → 289 and nothing else.

**Note on unit-test promotion.** Cases 1–4 are promotable in principle — they are
pure static-text assertions and `test/bootstrap-config-skill.test.js` is exactly
the right home. They are deliberately **not** promoted: TASK-049 step 4 states
"Do **not** replace it with a skip, an inverted assertion, or a 'now it must be
listed' test. If a positive registration check is wanted, that is a separate
decision — the tripwire's stated resolution is deletion." Adding the inverse
assertion here would contradict the task's explicit scope. Recorded as a gap
below so the decision stays visible.

---

## Prerequisites

- [ ] `node` on `PATH`; all commands run from the repo root
- [ ] No network, no `$HOME` access, no scratch dirs — every command below reads
      repo files only and writes nothing
- [ ] Working tree as left by TASK-049 (no `package.json` mutation in flight)

---

## Test Cases

### UAT-EDGE-001: the `lib/skills/README.md` row is in `## Misc utility`, bare-named, and traces to the SKILL.md description
- **Scenario**: The README's tables are topical and its rows use a **bare** skill
  name in backticks with no leading slash. The skill's own `category: executing`
  is Claude Code frontmatter, not a README section — putting the row under the
  wrong heading, or writing it as `/bootstrap-config`, both render fine and are
  invisible to every existing test. The Purpose cell must be the SKILL.md
  `description` verbatim, since that frontmatter is the task's stated source of
  truth for every cell.
- **Steps**:
  1. Locate the `## Misc utility` heading and the `serena-config` row.
  2. Assert the `bootstrap-config` row sits immediately after it, under that
     heading, has exactly two cells, carries no leading slash, and that its
     Purpose equals `description` read from the SKILL.md frontmatter.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const B="\x60";const L=fs.readFileSync("lib/skills/README.md","utf8").split("\n");const misc=L.indexOf("## Misc utility");const j=L.findIndex(x=>x.startsWith("| "+B+"serena-config"+B));const i=L.findIndex(x=>x.startsWith("| "+B+"bootstrap-config"+B));const d=fs.readFileSync("lib/skills/bootstrap-config/SKILL.md","utf8").match(/^description: (.+)$/m)[1];a.ok(misc>=0,"no ## Misc utility heading");a.ok(i>=0,"no bootstrap-config row");a.ok(i>misc,"row is not under ## Misc utility");a.strictEqual(i,j+1,"row is not directly after serena-config");const c=L[i].split("|").slice(1,-1);a.strictEqual(c.length,2,"row has "+c.length+" cells, expected 2");a.strictEqual(c[1].trim(),d,"purpose cell does not match the SKILL.md description");a.ok(!L[i].includes(B+"/bootstrap-config"),"bare name required, found a leading slash");console.log("PASS lib/skills/README.md:"+(i+1));'
  ```
- **Expected Result**: exits 0, prints `PASS lib/skills/README.md:137`.
- **Repeatable Unit Test**: Not applicable: TASK-049 step 4 explicitly forbids
  adding a positive registration test in place of the deleted tripwire ("that is
  a separate decision")
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS lib/skills/README.md:137 — row directly after serena-config (136), under ## Misc utility (130), 2 cells, bare name, purpose == SKILL.md description verbatim -->


### UAT-EDGE-002: the `CLAUDE.md` row carries the argument hint with escaped pipes and renders as exactly two cells
- **Scenario**: The task names this as "the single most likely defect in this
  task". The `argument-hint` contains three `|` characters; unescaped, each one
  terminates a markdown cell and the row silently renders with 5 cells instead of
  2 — the table looks broken to a human but no test notices. This asserts on the
  **rendered** cell count after masking the escaped pipes, which is the only way
  to catch a partially-escaped row.
- **Steps**:
  1. Find the `/bootstrap-config` row and confirm it is under `## Custom Commands`.
  2. Assert both bracketed groups are written with `\|`.
  3. Mask every `\|`, split on the remaining `|`, and assert exactly 2 cells.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const B="\x60";const L=fs.readFileSync("CLAUDE.md","utf8").split("\n");const cc=L.indexOf("## Custom Commands");const i=L.findIndex(x=>x.includes(B+"/bootstrap-config"));a.ok(i>=0,"no /bootstrap-config row in CLAUDE.md");a.ok(cc>=0&&i>cc,"row is not under ## Custom Commands");const row=L[i];a.ok(row.includes("[view \\| edit \\| reset]"),"argument-hint pipes are not escaped");a.ok(row.includes("[--global \\| --project]"),"scope-flag pipes are not escaped");const cells=row.replace(/\\\|/g,"").split("|").slice(1,-1);a.strictEqual(cells.length,2,"row renders as "+cells.length+" cells, expected 2");a.ok(cells[0].includes("/bootstrap-config"),"command cell lost its command");console.log("PASS CLAUDE.md:"+(i+1)+" renders 2 cells");'
  ```
- **Expected Result**: exits 0, prints `PASS CLAUDE.md:99 renders 2 cells`.
- **Repeatable Unit Test**: Not applicable: same TASK-049 step 4 prohibition as
  UAT-EDGE-001
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS CLAUDE.md:99 renders 2 cells — both bracketed groups escaped \| ; masked-pipe split yields exactly 2 -->


### UAT-EDGE-003: the Phase 3/4 tripwire is deleted outright — not skipped, not inverted, and its banner is gone
- **Scenario**: The tripwire's own failure message specifies deletion as the
  resolution. The failure modes that would pass a naive check are: leaving a
  `{ skip: ... }` option (a skipped test reads as a passing one in the summary
  line), inverting the assertion into a "now it must be listed" test (explicitly
  out of scope), or deleting the test but orphaning the `// Phase boundary`
  section banner above it.
- **Steps**: Assert none of the tripwire's identifying strings survive, and that
  no skip construct was introduced anywhere in the file.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const t=fs.readFileSync("test/bootstrap-config-skill.test.js","utf8");a.ok(!/registration is still Phase 4/.test(t),"the tripwire test is still present");a.ok(!/Phase boundary/.test(t),"the orphaned Phase boundary banner is still present");a.ok(!/\{\s*skip\s*:/.test(t),"a skip option was introduced");a.ok(!/\b(test|it|describe)\.skip\b/.test(t),"a .skip() test was introduced");a.ok(!/now mentions bootstrap-config/.test(t),"the tripwire failure message survives");console.log("PASS tripwire deleted, banner removed, no skip introduced");'
  ```
- **Expected Result**: exits 0, prints
  `PASS tripwire deleted, banner removed, no skip introduced`.
- **Repeatable Unit Test**: Not applicable: this asserts on the *absence* of a
  test; encoding it as a unit test in the same file would recreate the tripwire
  the task deleted
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS tripwire deleted, banner removed, no skip introduced — no test name, no "Phase boundary", no { skip: }, no .skip() -->


### UAT-EDGE-004: the two deliberately out-of-scope files were not touched
- **Scenario**: The task checked both files and ruled them out with reasons —
  `lib/scripts/templates/CLAUDE-wiki.md` is delivered into *target* projects and
  lists wiki operations only; the root `README.md` has no command list at all. An
  over-eager "register it everywhere" pass would add a row to either and nothing
  would fail. `lib/scripts/README.md` is TASK-050's file and must not carry a
  duplicate registration row from this task.
- **Steps**: Assert `bootstrap-config` appears in neither out-of-scope file, and
  that `lib/scripts/README.md` gained no `| bootstrap-config |`-style table row.
- **Command**:
  ```bash
  node -e 'const fs=require("fs"),a=require("assert");const B="\x60";for(const f of ["lib/scripts/templates/CLAUDE-wiki.md","README.md"]){a.ok(!fs.readFileSync(f,"utf8").includes("bootstrap-config"),f+" mentions bootstrap-config but was declared out of scope");}const re=new RegExp("^\\|\\s*"+B+"?/?bootstrap-config"+B+"?\\s*\\|");const s=fs.readFileSync("lib/scripts/README.md","utf8").split("\n").filter(x=>re.test(x));a.strictEqual(s.length,0,"lib/scripts/README.md gained a bootstrap-config registration row (TASK-050 owns that file)");console.log("PASS out-of-scope files clean");'
  ```
- **Expected Result**: exits 0, prints `PASS out-of-scope files clean`.
- **Repeatable Unit Test**: Not applicable: asserts the absence of edits to files
  outside the task's scope; belongs to the task boundary, not the product
- [x] Pass <!-- 2026-08-07 -->
  <!-- PASS out-of-scope files clean — CLAUDE-wiki.md and root README.md contain no "bootstrap-config"; lib/scripts/README.md has no registration row -->


### UAT-INT-001: `test/bootstrap-config-skill.test.js` runs 13/13 after losing exactly one test
- **Scenario**: The file held 14 tests; deleting the tripwire leaves 13. A count
  other than 13 means either the tripwire survived (14) or the deletion took a
  neighbouring test with it (12) — the deletion spanned a banner plus a block, so
  an off-by-a-few-lines cut is the realistic failure.
- **Steps**: Run the single test file and read the summary counters.
- **Command**:
  ```bash
  node --test test/bootstrap-config-skill.test.js
  ```
- **Expected Result**: `# tests 13`, `# pass 13`, `# fail 0`, `# skipped 0`,
  exit 0.
- **Repeatable Unit Test**: Not applicable: this *is* the unit-test file being run
- [x] Pass <!-- 2026-08-07 -->
  <!-- tests 13 / pass 13 / fail 0 / skipped 0 / todo 0, exit 0 -->


### UAT-INT-002: the full suite is 289/289 with zero skipped
- **Scenario**: The task's stated expectation is that the suite total drops by
  exactly 1 (290 → 289) with 0 failures and 0 skipped. A failure count above zero
  here almost certainly means the tripwire was left in place; a skipped count
  above zero means it was neutered rather than deleted.
- **Steps**: Run the whole suite from the repo root and read the summary block.
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `# tests 289`, `# pass 289`, `# fail 0`, `# skipped 0`,
  exit 0.
- **Repeatable Unit Test**: Not applicable: this is the suite runner itself
- [x] Pass <!-- 2026-08-07 -->
  <!-- tests 289 / pass 289 / fail 0 / skipped 0 / todo 0, exit 0 — the 290 -> 289 drop is the tripwire and nothing else -->


---

## Gaps

- **Positive registration checks are not promoted to unit tests.** Cases 1–4 meet
  every promotion criterion (deterministic, no harness needed, expected result
  known, obvious home in `test/bootstrap-config-skill.test.js`) but are blocked by
  an explicit instruction in TASK-049 step 4: the tripwire's stated resolution is
  deletion, and a "now it must be listed" replacement is called out as a separate
  decision. If that decision is later taken, these four assertions are the ready
  specification for it.

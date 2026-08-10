---
id: UAT-039
title: "UAT: Add extensive inline comments to the hook scripts"
status: pending
task: TASK-039
created: 2026-08-06
updated: 2026-08-06
---

# UAT-039 — UAT: Add extensive inline comments to the hook scripts

implements::[[TASK-039]]

> **Source task**: [[TASK-039]]
> **Generated**: 2026-08-06

TASK-039 was a comments-only documentation pass over `lib/hooks/` (+1445/−78 across 17 `.js` files). Two requirements carry all the risk, and every case below serves one of them:

1. **The comments must not change behavior.** A comment pass over security-critical guards is only safe if the executable bytes are untouched. `UAT-BEHAVIOR-*` covers this.
2. **The comments must survive.** The whole point of `lib/hooks/README.md` § Commenting standard is that a future agent must not strip them as slop. `UAT-DOC-*`, `UAT-SYNTAX-*`, and `UAT-SCOPE-*` cover this.

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`, Node 18+ on `PATH`, `git` available
- [ ] TASK-039's changes present (working tree or committed) — `lib/hooks/README.md` contains `## Commenting standard`
- [ ] `npm test` baseline green before starting (see UAT-DOC-006 for the count)
- [ ] Scratch directory available for the two throwaway scripts these tests write

---

## Test Cases

### UAT-BEHAVIOR-001: Every changed line in `lib/hooks/**/*.js` is a comment or blank line
- **Scenario**: The decisive acceptance gate for a comments-only pass — behavior cannot have moved if no executable line moved. This is the check that actually caught the near-miss during the task (a header edit that swallowed `require`s), which `node --check` did not.
- **Steps**:
  1. Write this script to the scratch directory as `uat-039-diff-audit.js`:
     ```js
     const { spawnSync } = require('child_process');
     const BASE = process.env.BASE || 'HEAD';
     const REPO = '/Users/davidtaylor/Repositories/bootstrap-claude';
     const res = spawnSync('git', ['diff', '-U0', BASE, '--', 'lib/hooks'],
       { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
     if (res.status !== 0) { console.error(res.stderr); process.exit(1); }
     const COMMENTISH = /^\s*(\/\/|\/\*|\*|\*\/)/;
     let file = null; const offenders = []; let changed = 0;
     for (const line of res.stdout.split('\n')) {
       if (line.startsWith('diff --git ')) { file = line.split(' b/')[1]; continue; }
       if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
       if (!/^[+-]/.test(line)) continue;
       if (!file || !file.endsWith('.js')) continue;
       const body = line.slice(1); changed++;
       if (body.trim() === '' || COMMENTISH.test(body)) continue;
       offenders.push(`${file}: ${line}`);
     }
     console.log(`BASE=${BASE}  changed .js lines: ${changed}  non-comment: ${offenders.length}`);
     for (const o of offenders.slice(0, 20)) console.log(o);
     process.exit(offenders.length === 0 ? 0 : 1);
     ```
  2. Run it. While TASK-039 is uncommitted, `BASE` defaults to `HEAD`. **Once it is committed, set `BASE` to the last commit before TASK-039** (`b85cbe9`) — against a `HEAD` that already contains the work the comparison is empty and therefore meaningless.
- **Command**:
  ```bash
  BASE=HEAD node "$SCRATCH/uat-039-diff-audit.js"
  ```
- **Expected Result**: exit 0, and `changed .js lines: 1523  non-comment: 0`. The count may differ if other work has landed in `lib/hooks/` since; **`non-comment: 0` is the assertion**, the total is context. Any offender line printed is a behavioral change that TASK-039 was not permitted to make.
- **Repeatable Unit Test**: Not applicable: a one-time acceptance check, not a regression test. It is defined relative to git history — once TASK-039 is committed, `HEAD` *is* the commented version and a permanent test would pass vacuously forever; pinning `BASE=b85cbe9` in a test file would instead re-audit an ever-growing unrelated diff on every future commit to `lib/hooks/`. The permanent replacements are UAT-BEHAVIOR-002/004 and UAT-SYNTAX-001.
- [x] Pass <!-- 2026-08-07 -->

### UAT-BEHAVIOR-002: The six command-class guards still decide identically
- **Scenario**: `interpreter-indirection-guard`, `package-install-consent`, `absolute-path-guard`, `protected-write-guard`, `claude-settings-guard`, and `env-content-read-guard` were all edited. Their pre-existing decision harness fires each as a real child process and asserts the verdict — it is the permanent net for "the comments changed nothing".
- **Steps**:
  1. Run the command-class suite on its own so a failure is unambiguous.
- **Command**:
  ```bash
  node --test test/command-class-hooks.test.js
  ```
- **Expected Result**: all tests pass, 0 fail. A failure here means a comment edit altered a guard's verdict, its exit code, or its deny envelope.
- **Repeatable Unit Test**: Not applicable: already covered by the pre-existing `test/command-class-hooks.test.js` (~100 decision assertions across the six guards). TASK-039 introduced no behavior for a *new* test to assert; adding one would duplicate that file.
- [x] Pass <!-- 2026-08-07 -->

### UAT-BEHAVIOR-003: The Serena-first guards still fire after the heaviest edits
- **Scenario**: `serena-bash-grep-block.js` (501→964 lines), `serena-first-guard.js`, `serena-first-glob-guard.js`, `serena-first-read-guard.js`, `serena-write-guard.js`, `serena-pre-delegation.js`, and `lib/serena.js` took the largest edits in the task and have **no unit coverage at all**. This is the runtime spot-check that they still block.
- **Steps**:
  1. Fire the glob guard with a PascalCase symbol pattern (must block) and with an extension pattern (must pass).
  2. Read the verdict from stdout: a `{"decision":"block",…}` envelope versus no stdout at all.
- **Command**:
  ```bash
  printf '%s' '{"tool_name":"Glob","tool_input":{"pattern":"**/*UserService*.ts"},"cwd":"'"$PWD"'"}' | node lib/hooks/serena-first-glob-guard.js
  ```
- **Expected Result**: stderr shows the `SERENA-FIRST BLOCK` banner naming `UserService`; stdout is a JSON envelope with `"decision":"block"` and `find_symbol` suggestions. Re-running with `"pattern":"src/**/*.ts"` must produce **no output at all** (allow). Note the fail-open precondition: if `~/.claude/state/lsp-ready-<md5(cwd)>` records `health.should_enforce === false`, the guard passes everything through by design — clear or refresh that state before judging a non-block a failure.
- **Repeatable Unit Test**: Blocked: the guard resolves its enforcement state from the ambient environment (`getStateFilePath()` → `~/.claude/state/lsp-ready-<md5(process.cwd())>`) with no injection point, so a unit test's verdict would depend on the developer's live Serena health file. Making this promotable needs a state-path or `HOME` override in `lib/hooks/lib/serena.js` — a behavior change, out of scope for a comments-only task.
- [x] Pass <!-- 2026-08-07 -->

### UAT-BEHAVIOR-004: `env-file-guard.js` still enforces the `.env` policy
- **Scenario**: This file went 45→87 lines with a brand-new 29-line block header sitting directly above a hand-rolled stdin handler — the exact shape that swallows code when a `*/` is lost. Its decision must still match the policy in `CLAUDE.md` and `README.md` § Safety / policy hooks: `.env` and every `.env.*` blocked, `.env.example` alone permitted.
- **Steps**:
  1. Run the promoted unit test, which fires the guard as a child process across 8 payloads (Read/Write/Edit/MultiEdit denials plus the `.env.example`, non-env, and `source .env` allows).
- **Command**:
  ```bash
  node --test test/hook-comments.test.js
  ```
- **Expected Result**: `env-file-guard still decides the .env policy after its header rewrite` passes; every payload exits 0 (a PreToolUse hook must never exit non-zero) with the expected `deny` / no-output verdict.
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-DOC-001: `lib/hooks/README.md` records the commenting standard
- **Scenario**: The standard is the only thing that stops a future agent deleting 1445 lines of rationale as slop. It must state the exception, scope it to `lib/hooks/`, refuse to widen, and carry the header-block template.
- **Steps**:
  1. Open `lib/hooks/README.md` and locate `## Commenting standard` (currently at line 35).
  2. Confirm it says the repo-wide no-comments default is suspended **here only**, that the exception does not extend to `lib/scripts/`, `lib/skills/`, or `bin/`, and that the comments must not be "cleaned up".
  3. Confirm the header-block template lists `Blocks:`, `Why a hook:`, `Fails:`, and `False positives:`.
- **Expected Result**: All present. The `Fails:` bullet must describe the *corrected* finding — the infrastructure fails **open** across nearly every guard, an ambiguous *match* fails closed, and `interpreter-indirection-guard.js` is the sole genuinely fail-closed guard.
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js`
- [FAIL: auto-judge: manual test requires human verification — no machine-executable command; the unit test proves the section exists but asserts nothing about the corrected fails-open/fails-closed prose] <!-- 2026-08-07 -->

### UAT-DOC-002: `CLAUDE.md` records the exception and points at the standard
- **Scenario**: An agent reading `CLAUDE.md` must learn about the exception before it opens a hook file, otherwise the README section is discovered only after the damage.
- **Steps**:
  1. Find the `- \`lib/hooks/\`` bullet in `CLAUDE.md`'s Key Files list.
  2. Confirm it names the deliberate exception to the repo-wide no-comments default, scopes it to `lib/hooks/` alone, points at `lib/hooks/README.md` § Commenting standard, and says not to strip the comments.
- **Expected Result**: All four elements present in that one bullet.
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js`
- [FAIL: auto-judge: manual test requires human verification — no machine-executable command; the unit test covers "names the exception + points at the README", not all four required elements] <!-- 2026-08-07 -->

### UAT-DOC-003: Every hook file opens with a header block naming itself
- **Scenario**: The standard's signpost requirement. A file whose prologue does not identify it (`<file>.js — <event> / <matcher>`) has either lost its header or had one copy-pasted from a sibling — and the matcher line is load-bearing, because the wrong matcher makes a hook silently inert.
- **Steps**:
  1. Run the promoted test.
  2. Spot-check two shapes by eye: `env-file-guard.js:4-32` (JSDoc block) and `absolute-path-guard.js:3-53` (two `//` paragraphs). Both forms are accepted — the standard's template is a content contract, not a syntax one.
- **Command**:
  ```bash
  node --test test/hook-comments.test.js
  ```
- **Expected Result**: `every lib/hooks/**/*.js opens with a header comment naming its own file` passes for all 21 files (18 hooks + 3 shared modules under `lib/hooks/lib/`).
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-DOC-004: Every blocking hook declares `Fails: open|closed`
- **Scenario**: The standard makes `Fails:` mandatory for anything that can block a call, because it is never inferable from a skim and the answer is rarely the one you would guess. Non-blocking hooks (`serena-usage-tracker.js`, `serena-session-reset.js`) and the shared modules under `lib/` are exempt.
- **Steps**:
  1. Run the promoted test, which reads each file's full comment prologue (`absolute-path-guard.js` carries its `Fails:` line in a second `//` paragraph, so a first-block-only check would miss it).
- **Command**:
  ```bash
  node --test test/hook-comments.test.js
  ```
- **Expected Result**: `every blocking hook declares "Fails: open|closed" in its header` passes. The test is a **ratchet**: the set of blocking hooks missing the field must equal exactly `git-protected-ops-block.js` and `serena-edit-guard.js` — the two files outside TASK-039's scope. A new file missing it fails; fixing one of these two also fails, and the fix is to delete its name from `FAILS_FIELD_GAPS`. The list may only shrink.
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-DOC-005: The comments survive — no file has been stripped back
- **Scenario**: The regression this whole task exists to prevent: an agent applying the repo-wide no-comments default to `lib/hooks/` and deleting the rationale.
- **Steps**:
  1. Run the promoted test, which measures comment lines as a share of non-blank lines per file.
- **Command**:
  ```bash
  node --test test/hook-comments.test.js
  ```
- **Expected Result**: `every lib/hooks/**/*.js keeps a substantial comment share` passes — every file at or above the 25% floor. Current spread is 28% (`serena-edit-guard.js`, untouched by the task) to 70% (`mv-absolute-path-block.js`); the floor sits below the lowest deliberately, so ordinary edits never trip it and only a stripping pass does.
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-DOC-006: The full suite is green and the count grew by exactly the new tests
- **Scenario**: The task's own Step 5 gate — the suite must be unchanged in pass state, and the comment pass must not have broken an unrelated test.
- **Steps**:
  1. Run the configured suite (`node --test 'test/*.test.js'`, not `node --test test/`, which picks up files the glob deliberately excludes).
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: 0 fail, 0 cancelled. The count at generation time was **218 tests / 217 pass / 1 skipped** — 209 before this UAT added 9. Other sessions were landing TASK-043…047 tests concurrently, so treat the *pass/fail state*, not the absolute number, as the assertion. **Known unrelated failure:** a re-run minutes later showed 1 failure, `schema: every script:line citation in a detail still points at the line it claims` in `test/bootstrap-prefs.test.js` — a concurrent session's in-flight `lib/scripts/` edits invalidating its own citation pins. It touches nothing in `lib/hooks/`; verify by running `node --test test/hook-comments.test.js test/command-class-hooks.test.js`, which must be fully green.
- **Repeatable Unit Test**: Not applicable: this case *is* the test runner; a test asserting its own suite's count would be circular and would fail on every unrelated test added.
- [x] Pass <!-- 2026-08-07 -->

### UAT-SYNTAX-001: No hook file has an unterminated block comment
- **Scenario**: The actual near-miss during TASK-039. An agent's header edit consumed the closing `*/`; the block comment ran on to the next `*/`, silently commenting out the `require`s and a constant — **and `node --check` still passed**, because the file remains valid JavaScript. Only a deleted-line audit caught it. The guard promoted here is the precise, permanent version of that audit.
- **Steps**:
  1. Run the promoted test.
  2. To confirm the guard is not inert, mutate a copy: delete the first ` */` from a copy of `lib/hooks/serena-first-read-guard.js` and re-run the detector against it.
- **Command**:
  ```bash
  node --test test/hook-comments.test.js
  ```
- **Expected Result**: `prologue carries no swallowed executable code` and `node --check passes for every lib/hooks/**/*.js` both pass. On the mutated copy the detector must report swallowed code **while `node --check` still exits 0** — that divergence is the whole reason the check exists (verified at generation time on `serena-first-read-guard.js`).
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js` — note that a naive `/*` vs `*/` occurrence count is deliberately *not* used: these files are dense with regex literals, so counting reports 15 opens / 10 closes on the perfectly healthy `serena-first-glob-guard.js`.
- [x] Pass <!-- 2026-08-07 -->

### UAT-BUGS-001: BUG-0001…BUG-0008 exist and the active ones are indexed
- **Scenario**: The hook comments annotate 8 divergences in place and cite each by bug id. If the bug files vanish, the annotations point at nothing.
- **Steps**:
  1. Run the promoted test (checks `wiki/work/bugs/` and `wiki/work/bugs/archive/`, and requires each still-active bug to appear in `wiki/work/bugs/index.md`).
  2. Spot-check one annotation ↔ bug pair by eye: `env-file-guard.js:43` cites BUG-0007, and `BUG-0007-env-predicate-duplicated-across-guards.md` exists.
- **Command**:
  ```bash
  node --test test/hook-comments.test.js
  ```
- **Expected Result**: All 8 bug files present (active *or* archived — the test tolerates archiving, since terminal items move but are never deleted), and every active one listed in the family index.
- **Repeatable Unit Test**: Created: `test/hook-comments.test.js`
- [x] Pass <!-- 2026-08-07 -->

### UAT-SCOPE-001: The exception did not widen beyond `lib/hooks/`
- **Scenario**: TASK-039's stated scope boundary. Silently commenting `lib/scripts/`, `lib/skills/`, or `bin/` would be a real regression, because the no-comments default still holds everywhere else.
- **Steps**:
  1. List the files the task changed and confirm no source file outside `lib/hooks/` gained comments (`CLAUDE.md`, `wiki/`, and `test/` changes are expected).
- **Command**:
  ```bash
  git diff --stat HEAD -- lib/scripts lib/skills bin
  ```
- **Expected Result**: empty output. If TASK-039 is already committed, run the same command against the pre-task commit (`git diff --stat b85cbe9 -- lib/scripts lib/skills bin`) and confirm any changes shown belong to other tasks, not to a comment pass.
- **Repeatable Unit Test**: Not applicable: defined relative to git history, like UAT-BEHAVIOR-001 — after commit there is no diff to inspect, and a permanent "no comments in lib/scripts" test would be a new repo-wide style rule that TASK-039 never asked for.
- [FAIL: auto-judge: expected empty output, got 14 files / +1563 −90 across lib/scripts + lib/skills — the working tree now also carries ROADMAP-005, so this git-relative command can no longer isolate TASK-039's scope] <!-- 2026-08-07 -->

### UAT-INSTALL-001: The commented hooks are synced to `~/.claude/hooks/`
- **Scenario**: `~/.claude/hooks/` is an rsync target that does not update itself; the installed copy is what actually runs. The task ran `install-global.sh --skip-mcps` to sync — this confirms the sync landed.
- **Steps**:
  1. Compare one heavily-edited hook's installed copy against the repo copy by line count and by the presence of a comment only the new version has.
- **Command**:
  ```bash
  node -e "const fs=require('fs'),os=require('os');const a=fs.readFileSync('lib/hooks/serena-pre-delegation.js','utf8');const b=fs.readFileSync(os.homedir()+'/.claude/hooks/serena-pre-delegation.js','utf8');console.log(a===b?'IDENTICAL':'DIFFERENT '+a.split('\n').length+' vs '+b.split('\n').length)"
  ```
- **Expected Result**: `IDENTICAL` (repo copy is 240 lines; a stale install shows 117). A `DIFFERENT` result means the sync never ran; re-run `./lib/scripts/install-global.sh --skip-mcps`. Do **not** rewrite this command to compare `serena-bash-grep-block.js`: `\bgrep\b` matches that file's own name, so the live guard blocks the command — a live false positive already documented in TASK-039.
- **Repeatable Unit Test**: Not applicable: asserts machine-local install state under `$HOME`, which no unit test may depend on or write to (`test/command-class-hooks.test.js:12-14` states the same rule for its own payloads).
- [x] Pass <!-- 2026-08-07 -->

---

## Gaps found while generating this UAT

Recorded here rather than silently omitted; none block the UAT.

1. **Two blocking hooks have no `Fails:` field.** `git-protected-ops-block.js` and `serena-edit-guard.js` are the only two blocking hooks whose headers omit it, and `serena-edit-guard.js` (28% comments) carries no standard fields at all. Both were outside TASK-039's 17-file scope, so this is a pre-existing gap against the README's "every file" wording, not a regression. Tracked as a shrink-only ratchet in `test/hook-comments.test.js` (`FAILS_FIELD_GAPS`) rather than dropped.
2. **The corrected README line citations are not permanently guarded.** TASK-039 fixed 5 stale `<file>.js:<line>` citations (`serena-bash-grep-block.js:312/393/454`, `env-file-guard.js:81`, `:48-55` — all spot-checked correct at generation time). No test pins them: every remaining non-`.js` citation in that README is uniformly off by one against 1-based numbering, which TASK-039 read as a 0-based generation convention and deliberately left alone. Enforcing 1-based for `.js` citations only would half-flip the file to a second convention; the task's own close-out note asks for a deliberate decision first.
3. **The Serena-first guards remain without unit coverage.** Seven files took the largest edits in the task and their verdicts are still verified only by hand (UAT-BEHAVIOR-003). Closing this needs an injection point for `getStateFilePath()` / `HOME` in `lib/hooks/lib/serena.js` — a behavior change, correctly out of scope for a comments-only task, but worth a follow-up.

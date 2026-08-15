---
id: UAT-052
aliases: [UAT-052]
title: "UAT: End-to-end verification of the preference store against a scratch project"
status: passed
task: TASK-052
created: 2026-08-07
updated: 2026-08-07
---

# UAT-052 — UAT: End-to-end verification of the preference store against a scratch project

implements::[[TASK-052]]

> **Source task**: [[TASK-052]]
> **Generated**: 2026-08-07

---

## What this UAT is verifying

TASK-052 is itself a verification task — it ran scenarios and reported, and its one code change was closing a test-coverage gap. So this UAT does **not** re-run the same ad-hoc scratch scenarios by hand. Every claim TASK-052 demonstrated is now pinned by a repeatable test, and the honest acceptance question is:

> **Is each claim actually pinned, such that a regression fails the suite rather than needing a human to notice?**

Each case below therefore names the specific automated test that owns the claim and runs it in isolation. A case fails if the test fails **or if the test does not exist under that name** — a renamed or deleted test is exactly the regression this UAT is guarding against, and `--test-name-pattern` matching zero tests is a silent pass in `node --test` unless you check the count.

Cases marked **Hermeticity-critical** must never be run in a way that touches the real `~/.claude/`. Every test invoked here redirects `HOME` to a `mkdtemp` scratch dir via `withScratchEnv`, which asserts the redirect landed *before any write* (`test/prompt-stickiness.test.js:275`, probe at `:229`).

---

## Prerequisites

- [x] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`, working tree as left by TASK-052 — *verified: `package.json` present at that root*
- [x] Node available on `PATH` (`node --test` is the only runner; the suite is zero-dependency) — *verified: `v26.0.0`*
- [x] `BOOTSTRAP_ASSUME_TTY` **not** exported in the ambient shell — it is the tty seam, and `test/install-global.test.js`'s `runInstall` inherits `process.env`, so an ambient value would change what that file's tests exercise. Verify with `printenv BOOTSTRAP_ASSUME_TTY` returning nothing.
- [x] The real `~/.claude/bootstrap-prefs.json` does **not** exist (`test -e` → absent). If it exists, the machine already has settled answers and UAT-EDGE-004 below is void. — *verified: `ABSENT`*

---

## Test Cases

### UAT-CLI-001: The step-banner list covers all eight steps, in emitted order

- **Description**: The folded-in coverage gap. `STEP_BANNERS` listed six banners while `install-global.sh` ran eight — the two preference steps (6: install the helper; 7: the skill-consent sync pass) were unverified, while the summary line already advertised `preferences`. This is the only behaviour-adjacent change TASK-052 made.
- **Steps**:
  1. Run the command below.
  2. Confirm the reported test count is **1**, not 0 — a zero-match pattern exits 0 and would otherwise read as a pass.
- **Command**:
  ```bash
  node --test --test-name-pattern='all eight steps' test/install-global.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. The test asserts each of the eight banners is present **and** strictly ordered (`positions[i] > positions[i-1]`), so an inversion of steps 6 and 7 — or either drifting past the MCP banner — fails rather than passing on presence alone.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` (`STEP_BANNERS` extended to 8; test renamed from "all six steps")
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ fresh run executes all eight steps in the TASK-035 order, MCPs last (448ms)`. Count is 1, so the pattern matched a real test rather than matching nothing.
- [x] Pass <!-- 2026-08-07 -->

### UAT-CLI-002: `--skip-mcps` guards only step 8 — both preference banners still print

- **Description**: `--skip-mcps` is the flag `setup-project.sh` and `update-project.sh` both use, so it is the most common invocation path. It must skip the MCP step and nothing else. Widening that guard to swallow the preference steps is the careless edit UAT-CLI-001's ordering test cannot see, because that test runs without the flag.
- **Steps**: Run the command; confirm count is 1.
- **Command**:
  ```bash
  node --test --test-name-pattern='skips the MCP step entirely' test/install-global.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. Asserts the MCP banner is absent and the stub `install-mcps.sh` never ran, **and** that `Installing preference helper` and `Checking skill preferences` both still appear.
- **Repeatable Unit Test**: Created: `test/install-global.test.js` (two assertions added to the existing `--skip-mcps` case)
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ --skip-mcps skips the MCP step entirely (229ms)`.
- [x] Pass <!-- 2026-08-07 -->

### UAT-CLI-003: Claim 1 — a re-run re-asks only the unanswered key

- **Description**: The roadmap's central requirement. A settled answer must not merely survive a second run — it must never be printed. Stored `false` (a remembered decline) and stored `ask` are both settled answers and must never be re-asked; re-prompting a decline is the exact annoyance the store exists to remove.
- **Steps**: Run the command; confirm count is 1.
- **Command**:
  ```bash
  node --test --test-name-pattern='re-asks ONLY the unanswered key' test/prompt-stickiness.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. Three runs against one scratch HOME: run 1 settles four keys and leaves one unanswered; run 2 poisons stdin with all-`y` and asserts the four settled keys are **absent from stdout** and unchanged on disk while the one unanswered key is asked and settled; run 3 asserts `All skill preferences already answered — nothing to ask.` with the store not rewritten.
- **Repeatable Unit Test**: Created previously: `test/prompt-stickiness.test.js:3389` (TASK-047; re-confirmed live by TASK-052 with an independent poisoned-stdin run)
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ install-global.sh e2e: a re-run re-asks ONLY the unanswered key — stored \`false\` and \`ask\` are never re-asked (1842ms)`. Independently corroborated during TASK-052 by a live run whose control key consumed poison **line 1**, proving lines 1–4 were consumed by nothing.
- [x] Pass <!-- 2026-08-07 -->

### UAT-CLI-004: Claim 2 — all three `prefs.gitTracking` answers, three distinct on-disk outcomes

- **Description**: `scope: project`, `default: null` (null precisely so the menu actually prompts rather than resolving silently). Each answer must route the two preference paths to `.gitignore`, to `.git/info/exclude`, or nowhere — and store the resolved **name**, never the typed digit.
- **Steps**: Run the command; confirm count is 1.
- **Command**:
  ```bash
  node --test --test-name-pattern='prefs.gitTracking' test/prompt-stickiness.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. Three separate scratch git repos (the outcomes are mutually exclusive and cannot share a fixture). Asserts digit→name storage, the three distinct on-disk states with cross-file fingerprints, and that none is re-asked under poisoned stdin.
- **Repeatable Unit Test**: Created previously: `test/prompt-stickiness.test.js:2091` (TASK-047)
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ merge-gitignore.sh e2e: prefs.gitTracking — each option routes the two prefs paths to .gitignore, to .git/info/exclude, or nowhere, and none is re-asked (8683ms)`. Matches TASK-052's live three-repo run, which additionally hash-guarded this repo's own `.gitignore` and `.git/info/exclude` before and after each case.
- [x] Pass <!-- 2026-08-07 -->

### UAT-CLI-005: Claim 3 — `gitCommit.versionBump` offers auto/confirm/never and has no `ask`

- **Description**: `confirm` **is** this key's ask state, so there is deliberately no separate `ask` value. That asymmetry is the documented trap; the helper must refuse `ask` outright rather than storing a value no consumer understands.
- **Steps**: Run the command; confirm count is 1.
- **Command**:
  ```bash
  node --test --test-name-pattern='has no .ask. value' test/prompt-stickiness.test.js
  ```
  > The two backticks in the real test name are written as `.` here on purpose: `--test-name-pattern` is a regex, so `.` matches them, and a literal backtick in the command is read as command substitution by the interpreter-indirection guard and blocked. Same class of harness note as UAT-049's.
- **Expected Result**: `pass 1`, `fail 0`. The letter grammar is asserted against the **script source** (a piped `read -r -p` never emits its prompt, so the string is unobservable at runtime); the resolved value is asserted at runtime, where it is observable; and `--set --value ask` is asserted to exit 1.
- **Repeatable Unit Test**: Created previously: `test/prompt-stickiness.test.js:3493` (TASK-047). Round-trip of all three values: `test/bootstrap-prefs.test.js:342`.
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ install-global.sh e2e: gitCommit.versionBump offers auto/confirm/never and has no \`ask\` value (642ms)`. TASK-052 additionally confirmed live that the `ask` rejection happens *before any write* — no values file is created at all — and that an uppercase `C` stores `confirm`.
- [x] Pass <!-- 2026-08-07 -->

### UAT-CLI-006: Claim 4 — a headless run asks nothing and writes no preferences file

- **Description**: Absence *is* the representation of `unset`. Not an empty file, not `{}` — either of those is a different state that would suppress nothing but still be wrong. The tty gate is a whole-pass gate: the entire question block sits in the `else` arm, so it is unreached rather than merely unwritten.
- **Steps**: Run the command; confirm count is 1.
- **Command**:
  ```bash
  node --test --test-name-pattern='NON-INTERACTIVE run asks nothing and writes no preferences file' test/prompt-stickiness.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. `assertNoTtySeam` first proves `BOOTSTRAP_ASSUME_TTY` is genuinely absent from the curated env; `assertNoPrefsFile` then checks both the values file **and** the companion README, in both the scratch HOME and the scratch project.
- **Repeatable Unit Test**: Created previously: `test/prompt-stickiness.test.js:3466` (TASK-047)
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ install-global.sh e2e: a NON-INTERACTIVE run asks nothing and writes no preferences file at all (337ms)`. TASK-052's live headless run corroborated it with a full recursive walk of the scratch HOME finding zero files named `bootstrap-prefs.json`, and stderr at 0 bytes.
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-001: Step 6 is not tty-gated — a headless run installs the schema too

- **Scenario**: The step-6/step-7 split. Step 6 installs the helper **and** its schema; step 7 alone is tty-gated. The schema must land at `<helper dir>/templates/` because `bootstrap-prefs.js` resolves it relative to its own directory — that layout is what lets a skill invoke the installed helper with **no `--schema` flag** and still get validation and defaults. A flattened copy silently drops both, and a dropped default turns an unanswered key from "the documented default" into `unset` at every call site.
- **Steps**: Run the command; confirm count is 1.
- **Command**:
  ```bash
  node --test --test-name-pattern='still installs the schema in the templates/ layout' test/prompt-stickiness.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. On a `tty:false` run: the schema exists, is byte-identical to `lib/scripts/templates/bootstrap-prefs-schema.json`, and the **installed** helper invoked with no `--schema` flag still resolves a documented default — while `assertNoPrefsFile` confirms zero answers were recorded.
- **Why this was missing**: the existing pair covered the interactive direction (schema asserted, `tty:true`) and the headless direction (helper asserted only). Moving step 6 inside step 7's `else` arm — where the *questions* legitimately live — would have passed every existing test while leaving every unattended install with a helper that reads `unset` for every default.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js:3492` (new, this UAT)
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ install-global.sh e2e: a NON-INTERACTIVE run still installs the schema in the templates/ layout that keeps defaults working (376ms)`. TASK-052's live headless run independently hashed both installed files byte-identical to their repo sources (`978b247a…` helper, `c18df25e…` schema).
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-002: The store refuses a raw digit for `mcp.playwrightConflict`

- **Scenario**: The digit is an input form belonging to the interactive menu, never a persisted value — `prompt_choice_sticky` resolves `1/2/3` positionally and stores the name it landed on. If a raw digit could reach the file, reordering the menu (a cosmetic edit nobody would think to guard) would silently change what an already-stored answer means, with no write and no diff.
- **Steps**: Run the command; confirm count is 1.
- **Command**:
  ```bash
  node --test --test-name-pattern='raw digit is refused for mcp.playwrightConflict' test/bootstrap-prefs.test.js
  ```
- **Expected Result**: `pass 1`, `fail 0`. `--value 1` exits 1, the error names the key and lists all three legal names, and nothing is written; the positive contrast in the same test confirms the resolved name `shared` is accepted and stored verbatim.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js:908` (new, this UAT)
- **Actual**: `tests 1 · pass 1 · fail 0 · skipped 0` — `✔ a raw digit is refused for mcp.playwrightConflict — the menu resolves digits to names, the store never holds one (133ms)`. TASK-052 saw the same refusal live: `Error: "1" is not a legal value for mcp.playwrightConflict — expected one of: shared, alongside, skip`, exit 1.
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-003: `prefs_stored_global` separates a stored answer from a schema default

- **Scenario**: The highest-consequence trap in the whole store, and the reason the sync pass cannot use `prefs_get`. `--get` is a *resolution* and falls through to the schema `default`, so four of the five `consumer: skill` keys resolve to a non-null value whether the user chose it or has never been asked. A `prefs_get`-based "is this unanswered?" test reports every one of them as settled — and the pass then asks nothing, forever, while the install looks completely clean.
- **Steps**: Run the command; confirm the count is **3** (the trap plus its two directional companions).
- **Command**:
  ```bash
  node --test --test-name-pattern='prefs_stored_global' test/prompt-stickiness.test.js
  ```
- **Expected Result**: `pass 3`, `fail 0`. Covers: `[default]` vs `[global]` on a key with a non-null default (with the read probe creating no file); a stored `false` counting as **answered**, the direction that stops a decline re-asking forever; and a project-layer answer *not* satisfying a question the pass writes `--global`.
- **Repeatable Unit Test**: Created previously: `test/prompt-stickiness.test.js:3149`, `:3206`, `:3234` (TASK-047)
- **Actual**: `tests 3 · pass 3 · fail 0 · skipped 0` — all three directions green: `distinguishes a stored [global] answer from a schema [default] — which prefs_get cannot` (290ms), `a stored \`false\` counts as ANSWERED — the direction that stops a decline re-asking forever` (188ms), `a PROJECT-layer answer does not count as answered for a pass that writes --global` (141ms). Count is 3 as required. TASK-052 additionally confirmed statically that `install-global.sh:191` and `:213` both still gate on `prefs_stored_global` — no regression to `prefs_get`.
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-004: Hermeticity — the real `~/.claude/` still has no preference state

- **Scenario**: **Hermeticity-critical.** TASK-052 ran the real installer many times and must have left the user's own machine untouched. `install-global.sh` step 7 writes real answers into `~/.claude/bootstrap-prefs.json`, and `unset` is not recoverable by re-running — the whole point of the store is that it stops asking. A single unguarded invocation permanently settles the user's skill preferences.
- **Steps**: Run the command below. It is read-only.
- **Command**:
  ```bash
  test -e "$HOME/.claude/bootstrap-prefs.json" -o -e "$HOME/.claude/bootstrap-prefs.README.md" && echo LEAKED || echo CLEAN
  ```
- **Expected Result**: `CLEAN`. Neither the values file nor its generated companion exists in the real HOME.
- **Repeatable Unit Test**: Not applicable: asserts the state of the developer's real machine, which by construction cannot be a hermetic test fixture.
- **Actual**: `CLEAN`. Neither the values file nor its companion exists in the real `$HOME/.claude/`, after a session that executed the real installer well over a dozen times. TASK-052's closing pass also re-verified all three baseline SHA-256s (`~/.claude/settings.json`, `.gitignore`, `.git/info/exclude`) byte-identical.
- [x] Pass <!-- 2026-08-07 -->

### UAT-EDGE-005: The full suite is green with zero skips

- **Scenario**: TASK-052's baseline was 295/295/0/0; it added two tests (UAT-EDGE-001 and UAT-EDGE-002 above). A **new skip is a regression** — and `test/bootstrap-prefs.test.js` carries a meta-test (`suite: no test anywhere in test/ is skipped or marked todo`) that fails the suite a second time if one appears, so a skip cannot be introduced quietly.
- **Steps**: Run the full suite and read the trailer counts.
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `tests 297`, `pass 297`, `fail 0`, `skipped 0`, `todo 0`. A higher total is acceptable if later work adds tests; `fail 0` and `skipped 0` are not negotiable.
- **Repeatable Unit Test**: Created previously: `test/bootstrap-prefs.test.js:2029` (the no-skip meta-test itself)
- **Actual**: `tests 297 · pass 297 · fail 0 · skipped 0 · todo 0` (36.3s). Exactly the expected 295 → 297 delta: the two tests promoted by this UAT and nothing else.
- [x] Pass <!-- 2026-08-07 -->

### UAT-DOC-001: The defects found were filed, not fixed

- **Scenario**: TASK-052 is a verification task — a fix applied inside it would be unverified by construction. Two message-only defects were found in `install-global.sh` (the `ask` confirmation denying its own write; the completion summary claiming `MCPs` on every `--skip-mcps` run) and must be filed rather than silently corrected.
- **Steps**:
  1. Confirm `wiki/work/bugs/BUG-0010-install-global-output-overstates-what-happened.md` exists with `status: open`.
  2. Confirm it is listed in `wiki/work/bugs/index.md`.
  3. Confirm `lib/scripts/install-global.sh` was **not** modified by TASK-052 — the two reported lines still read as reported.
- **Command**:
  ```bash
  node -e "const s=require('fs').readFileSync('lib/scripts/install-global.sh','utf8');const a=s.includes('the answer is never stored');const b=s.includes('file suggestion + preferences + MCPs).');console.log('defect1_present='+a,'defect2_present='+b,(a&&b)?'FILED_NOT_FIXED':'UNEXPECTED')"
  ```
- **Expected Result**: The bug file exists and is indexed, and both reported defect strings are still present verbatim in `install-global.sh` — i.e. `FILED_NOT_FIXED`. The defects being *still there* is the pass condition: a verification task that quietly fixed what it found would have shipped an unverified change.
- **Instrument corrected during the run**: this case originally asserted `git status --porcelain lib/scripts/install-global.sh` prints nothing. That was the wrong baseline — `git status` compares against **HEAD**, and `install-global.sh` already carried 147 uncommitted insertions from earlier ROADMAP-005 work (steps 6 and 7 themselves) before TASK-052 began, so the check could only ever report `M`. It tested "has this file changed since the last commit", not "did TASK-052 change it". The replacement asserts the substantive claim directly and is machine-checkable; no assertion was dropped — step 3 of the Steps list is what is now actually being tested.
- **Repeatable Unit Test**: Not applicable: verifies a process constraint (file-don't-fix) and wiki bookkeeping, not program behaviour.
- **Actual**: `defect1_present=true defect2_present=true FILED_NOT_FIXED`. `wiki/work/bugs/BUG-0010-install-global-output-overstates-what-happened.md` exists at `status: open` and is listed in `wiki/work/bugs/index.md`. Both defects remain at `install-global.sh:200` and `:264`, exactly as reported.
- [x] Pass <!-- 2026-08-07 -->

---

## Known gaps (deliberate, recorded rather than tested)

- **`test/install-global.test.js`'s `runInstall` inherits the full `process.env`** (`:120-127`), including any ambient `BOOTSTRAP_ASSUME_TTY`. `test/prompt-stickiness.test.js` avoids this with `curatedEnv` (`:129`), which builds a minimal env and explicitly deletes the seam. A developer with the seam exported would silently run `install-global.test.js`'s cases through the interactive path with no stdin. Not fixed here — it is test-infrastructure work outside TASK-052's scope, and the Prerequisites above guard the immediate risk.
- **[[BUG-0009]]** (`--set` does not enforce `scope`) is re-confirmed but deliberately not covered by a new test. A bidirectional test already pins the current behaviour, and that bug's own notes explain why those fixtures must be rewritten as part of the fix rather than ahead of it.

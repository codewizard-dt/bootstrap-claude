---
id: UAT-077
aliases: [UAT-077]
title: "UAT: Gate package-install-consent.js on a new packageInstall.consent preference"
status: pending
task: TASK-075
created: 2026-08-27
updated: 2026-08-27
---

# UAT-077 — UAT: Gate `package-install-consent.js` on a new `packageInstall.consent` preference

implements::[[TASK-075]]

> **Source task**: [[TASK-075]]
> **Generated**: 2026-08-27

**Numbering note**: this UAT is `UAT-077`, not `UAT-075`, because `UAT-075`/`UAT-076` were already claimed by an earlier `/power-mode` run's `/uat-skip` batch (sequentially numbered rather than task-mirrored — `UAT-075-docker-harness-node-lts-pin`, `UAT-076-docker-harness-accept-path-decision`, both archived). Recorded here rather than silently deviating.

**Scope note.** TASK-075 is a hook + schema change: a new `packageInstall.consent` bootstrap-prefs key, new `allow()`/`defer()` helpers in `lib/hooks/lib/command-parse.js`, the preference check wired into `lib/hooks/package-install-consent.js`, and doc updates. `/tackle`'s own Step 5 already added 9 new tests (7 in `test/command-class-hooks.test.js`, exercising the real hook via `spawnSync` against a real `bootstrap-prefs.js` subprocess in a scratch `$HOME`/project — never mocked; plus schema-side coverage in `test/bootstrap-prefs.test.js`), and this UAT independently re-verified every one of them by running its unit test command directly rather than trusting the task file's own notes. Every case below is **EDGE** except one **Manual** case: whether Claude Code's *real* hook-dispatch pipeline actually honors `permissionDecision: "allow"`/`"defer"` the way the JSON-shape tests assume — no existing hook in this codebase has ever emitted either value before (every prior hook only ever emits `"deny"`), so this is genuinely unverified by any subprocess test, which only checks the JSON shape the hook script itself produces, not how the live Claude Code harness interprets it.

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ available on `PATH`
- [ ] `npm test` baseline green before starting
- [ ] For UAT-MANUAL-001 only: the hook must actually be registered in a real `~/.claude/settings.json` (run `./lib/scripts/install-global.sh --skip-mcps` first if `package-install-consent.js` isn't already wired), and a real Claude Code session with a scratch project directory

**Safety.** All EDGE cases run the real `package-install-consent.js` and the real `bootstrap-prefs.js` against scratch `$HOME`/project directories created via `fs.mkdtempSync` — no case touches the developer's real `~/.claude/` store or spawns a real `npm`/`pip` process (the hook denies/allows/defers before any package manager would actually run). UAT-MANUAL-001 is the one case that touches a real Claude Code session and a real scratch project; it still never runs an actual `npm install` to completion unless the tester chooses to let it, since the point is observing the *permission decision*, not the install.

---

## Test Cases

### UAT-EDGE-001: `packageInstall.consent` unset or `false` — the hook still denies exactly as before
- **Scenario**: The default/no-op path. A project that has never touched this preference (or has explicitly set it to `false`) must see byte-for-byte the same deny behavior as before TASK-075.
- **Steps**:
  1. Run the unit test commands below.
  2. Confirm each spawns the real `package-install-consent.js` via `spawnSync` against a scratch `$HOME` carrying a real `bootstrap-prefs.js` + schema, and a scratch project dir.
  3. Confirm both report `permissionDecision: "deny"`.
- **Expected Result**: Exit 0 from the hook process; `permissionDecision === "deny"` in both the unset and explicit-`false` cases.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (tests: `packageInstall.consent unset: the gate still denies exactly as before`, `packageInstall.consent = false: the gate denies exactly as before`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="packageInstall.consent unset|packageInstall.consent = false" test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-002: `packageInstall.consent = ask` — the hook emits `defer`, never `deny`
- **Scenario**: The new opt-out's middle ground — hand the decision back to Claude Code's own native permission prompt instead of denying outright.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds the scratch project's `packageInstall.consent=ask` via a real `bootstrap-prefs.js --set` call, then fires the hook.
  3. Confirm the hook's JSON output has `permissionDecision === "defer"` with a non-empty `permissionDecisionReason`, and that `deny()` was never reached.
- **Expected Result**: Exit 0; `permissionDecision === "defer"`; reason present.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (test: `packageInstall.consent = ask: the gate defers, and never denies`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="packageInstall.consent = ask" test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-003: `packageInstall.consent = true` — the hook emits `allow` outright
- **Scenario**: The full opt-in — a project that has decided to stop being asked entirely.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it seeds `packageInstall.consent=true`, fires the hook, and confirms `permissionDecision === "allow"` with a non-empty reason.
- **Expected Result**: Exit 0; `permissionDecision === "allow"`; reason present; `deny()` never reached.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (test: `packageInstall.consent = true: the gate allows outright, and never denies`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="packageInstall.consent = true" test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-004: A missing `bootstrap-prefs.js` helper still denies — never treated as an allow
- **Scenario**: The fail-safe direction under a genuinely broken environment (no preference helper installed at all). This is the case that most directly protects the security invariant: a read failure must never be interpreted as consent.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it points `HOME` at a scratch dir with **no** `.claude/bootstrap-prefs.js` at all (so `execFileSync` throws `ENOENT`), fires the hook, and confirms it still denies.
- **Expected Result**: Exit 0; `permissionDecision === "deny"` — a missing helper never loosens the default.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (test: `a missing bootstrap-prefs.js (no PREFS_SCRIPT at all) still denies, never allows`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="a missing bootstrap-prefs.js" test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-005: A corrupt project preferences file still denies — never treated as an allow
- **Scenario**: The other fail-safe direction — the helper exists and works, but the *project's own* `bootstrap-prefs.json` has been hand-corrupted into invalid JSON. `bootstrap-prefs.js`'s own contract degrades this to `unset` (exit 0, not 1); this case confirms the hook reads that degraded `unset` as a deny, not as an error to swallow some other way.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it hand-writes invalid JSON into the scratch project's `.claude/bootstrap-prefs.json`, fires the hook, and confirms it still denies.
- **Expected Result**: Exit 0; `permissionDecision === "deny"`.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (test: `a corrupt project preferences file still denies, never allows`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="a corrupt project preferences file" test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-006: The deny message names the `packageInstall.consent` escape hatch
- **Scenario**: The deny reason is the hook's only user-facing surface — it must actually tell a denied user how to opt out, not just that they were denied.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm the deny reason string contains the literal `bootstrap-prefs.js --set packageInstall.consent` escape-hatch text.
- **Expected Result**: The deny reason includes the exact escape-hatch command.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (test: `the deny reason names the packageInstall.consent escape hatch`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="the deny reason names the packageInstall.consent escape hatch" test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-007: `allow`/`defer` are structurally identical to `deny` in `command-parse.js`, and correctly exported
- **Scenario**: The new shared helpers must match the existing `deny()`'s exact JSON envelope (`hookSpecificOutput.hookEventName`, `permissionDecision`, `permissionDecisionReason`) and be part of the module's public surface, or every hook that might want to reuse them later inherits a subtly wrong shape.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm `module.exports` from `lib/hooks/lib/command-parse.js` includes `allow` and `defer` alongside `deny`, and that invoking each produces the documented shape.
- **Expected Result**: `command-parse.js`'s exports include `allow`/`defer`; their JSON output shape matches `deny`'s exactly except for `permissionDecision`.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (the pre-existing exact-shape pin on `command-parse.js`'s `module.exports`, updated by this task to include `allow`/`defer`) — verified passing as part of the full suite.
- **Unit Test Command**: `node --test test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-EDGE-008: The schema entry is correctly registered, discoverable by the registry's bijection scan, and documented consistently
- **Scenario**: `packageInstall.consent` must round-trip through every surface this repo's preference-schema tooling cross-checks: the `consumer:"skill"` population growth-guard, the `askedBy`-resolves-to-a-real-command check, `lib/scripts/README.md`'s hand-transcribed registry, and — genuinely new territory — the schema-registry test suite's own key-usage bijection scan, which previously had no extractor capable of seeing a `lib/hooks/*.js` array-literal invocation at all.
- **Steps**:
  1. Run the unit test commands below.
  2. Confirm the `consumer:"skill"` population test lists exactly the current 8 keys (including `packageInstall.consent`), the generic per-key shape/`askedBy` loops pass for it, the new `extractHookKeys` fixture test correctly extracts `packageInstall.consent` from a real-shaped array literal and nothing from adjacent non-matching lines, and the `scripts -> schema` bijection test confirms `package-install-consent.js`'s actual call site resolves against the schema.
- **Expected Result**: All listed assertions pass; `lib/scripts/README.md`'s registry row for `packageInstall.consent` matches the schema's `summary` field verbatim (per `test/scripts-readme-prefs-docs.test.js`'s cross-check convention).
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (tests: `schema: the consumer:"skill" population is exactly the eight behavior-changing keys`, `extractHookKeys pulls the key literal out of the hook array-literal invocation form, and nothing out of the rest`, `scripts -> schema: every key literal passed to bootstrap-prefs.js resolves through the schema`) — verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="consumer:\"skill\" population is exactly the eight|extractHookKeys pulls the key literal|scripts -> schema: every key literal" test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-27 -->

### UAT-MANUAL-001: A real Claude Code session honors `allow`/`defer` from this hook — the one thing no subprocess test can verify
- **Scenario**: Every EDGE case above verifies the JSON *shape* the hook script itself emits by spawning it directly with synthesized stdin — none of them go through Claude Code's actual hook-dispatch/permission pipeline. `allow` and `defer` are decision values **no hook in this codebase has ever emitted before** (every prior hook only ever emits `deny`), so whether the real Claude Code harness interprets them exactly as documented (`allow` → the tool call proceeds with no prompt; `defer` → the normal native "allow this?" prompt appears, or the call proceeds silently under `bypassPermissions`) is genuinely unverified until observed live.
- **Steps**:
  1. Confirm `package-install-consent.js` is registered as a `PreToolUse` hook in a real `~/.claude/settings.json` (run `install-global.sh` first if not).
  2. In a scratch project directory, set `node ~/.claude/bootstrap-prefs.js --set packageInstall.consent --value true --project <scratch-dir>`.
  3. In a real interactive Claude Code session with that scratch directory as the working directory, ask Claude to run `npm install left-pad` (a small, harmless real package). Observe: does the command proceed with **no** permission prompt at all?
  4. Re-set the same key to `ask` (`--value ask`) and repeat step 3. Observe: does Claude Code's **native** permission prompt appear (not this hook's old deny message), and does approving it let the install proceed?
  5. Re-set the key to `false` (or `--unset` it) and repeat step 3 once more. Observe: does the original deny message reappear, including the escape-hatch text?
- **Expected Result**: Step 3 (`true`) — install proceeds with no prompt. Step 4 (`ask`) — Claude Code's own native permission UI appears (not a hook-authored message), and approving it allows the install. Step 5 (`false`/unset) — the original deny message reappears verbatim, including the `bootstrap-prefs.js --set packageInstall.consent` escape hatch.
- **Repeatable Unit Test**: Not applicable: requires a real Claude Code session and its live hook-dispatch/permission-mode pipeline — no subprocess harness can observe how the host interprets a returned `permissionDecision`, only what the hook script itself emitted.
- [FAIL: auto-judge: manual test requires human verification] <!-- 2026-08-27 -->

---

## Gaps

- **None outstanding beyond UAT-MANUAL-001 itself**, which is the one case genuinely deferred to a human — see its Scenario above for why it can't be automated.
- **Not covered here, out of TASK-075's scope**: whether Claude Code's documented `deny` > `ask` > `allow` precedence (when a settings-level `permissions.ask`/`deny` rule also matches the same command) interacts correctly with this hook's new `allow`/`defer` outputs. This repo has no existing `permissions.deny`/`ask` rule targeting package-manager installs (the hook is the only control), so the interaction is moot today, but would need re-checking if one were ever added.

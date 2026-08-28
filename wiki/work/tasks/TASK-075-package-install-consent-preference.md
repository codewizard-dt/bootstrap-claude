---
id: TASK-075
aliases: [TASK-075]
title: "Gate package-install-consent.js on a new packageInstall.consent preference"
status: pending-uat
created: 2026-08-27
updated: 2026-08-27
depends_on: []
blocks: []
parallel_safe_with: [TASK-031, TASK-039, TASK-060, TASK-067, TASK-071, TASK-072, TASK-073, TASK-074]
uat: "[[UAT-077]]"
tags: [hooks, preferences, package-management, security]
---

# TASK-075 — Gate `package-install-consent.js` on a new `packageInstall.consent` preference

implements::[[package-install-consent-gating]]

## Objective

`lib/hooks/package-install-consent.js` currently denies every package-manager install command (`npm install`, `pip install`, `uvx --from`, etc.) unconditionally, with one hardcoded exception (Serena's own repo) — documented in `lib/hooks/README.md` as deliberate friction, not a bug, but with no escape hatch beyond "run it yourself." This makes routine project scaffolding and dependency updates genuinely painful. Add a new, project-scoped `packageInstall.consent` preference (`true | false | ask`, default `false`) that the hook consults before denying, so a user can deliberately opt one project into "don't ask me every time" without weakening the consent guarantee anywhere else.

Full research and rationale: `wiki/knowledge/sources/package-install-consent-gating.md` and `raw/research/package-install-consent-gating/index.md`. This task implements that research's recommendation directly — do not re-derive the design, follow it.

## Approach

**Grammar and defaults**: `packageInstall.consent`, `scope: "project"`, `values: "true | false | ask"`, `default: false` — today's unconditional-deny behavior is exactly preserved for every project that never touches this key. `consumer: "skill"` is the closest existing category (there is no `"hook"` consumer value in the schema today — `test/bootstrap-prefs.test.js`'s `LEGAL_CONSUMERS = ['installer', 'skill']` — and this task deliberately does **not** extend that taxonomy; see the research's "Alternative if constraints change" section for when that would become worth doing).

**askedBy**: `/bootstrap-config` — confirmed with the user. There is no scripted installer moment that naturally owns asking this (a brand-new project has no `.claude/bootstrap-prefs.json` yet when someone first hits the block), so the only way to answer it is manually.

**Decision states, precisely** (per the research's Claude Code hook-contract findings — `permissionDecision` legally takes `"allow" | "deny" | "ask" | "defer"`, confirmed both by direct doc fetch and by this repo's own already-vetted `wiki/knowledge/entities/components/bootstrap-claude-hooks.md`):
- `false` (default) or `unset`, **or any failure reading the preference** (missing bootstrap-prefs.js, malformed JSON, non-zero exit, etc.) → today's `deny()` exactly as now. A broken preference read must never *grant* an install — it only ever falls back to the safe, existing default.
- `ask` → emit `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "defer", "permissionDecisionReason": "..."}}` — the officially-documented way to hand the decision back to Claude Code's own native permission handling (interactive: the normal "allow this?" prompt; headless/`bypassPermissions`: proceeds, the same trade-off every other already-permitted command accepts under bypass — this is *not* a regression of the hook's original headless-safety rationale, since it's Claude Code's own permission system making that call, not this hook forcing a wait).
- `true` → emit `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "..."}}`.

**Where the preference is read**: only *after* `matchedInstall()` already returns non-null (i.e., only on an already-install-shaped command) — never on every `Bash` call — so the added subprocess-spawn cost is negligible in practice. Read via `node ~/.claude/bootstrap-prefs.js --get packageInstall.consent --project <cwd>`, matching exactly how every bash installer already consults this store (no new integration pattern, just a new caller of the existing one).

## Steps

### 1. Add the schema entry <!-- agent: general-purpose -->

- [x] In `lib/scripts/templates/bootstrap-prefs-schema.json`, add `packageInstall.consent`: `scope: "project"`, `consumer: "skill"`, `values: "true | false | ask"`, `default: false`, `askedBy: "/bootstrap-config"`. Write a `summary` (one line) and a `detail` field that explains all three states, explicitly restates the headless-safety reasoning (`ask`/`defer` is safe under bypass because it's Claude Code's own permission system deciding, not this hook blocking), and names `package-install-consent.js` as the consumer. Follow the exact field style of neighboring entries (e.g. `gitCommit.autoPush`) — do not invent a new field shape.

### 2. Add `allow()`/`defer()` helpers <!-- agent: general-purpose -->

- [x] In `lib/hooks/lib/command-parse.js`, add `allow(reason)` and `defer(reason)` functions mirroring the existing `deny(reason)` exactly (same `console.log(JSON.stringify(...))` + `process.exit(0)` shape), differing only in `permissionDecision` (`"allow"` / `"defer"`) — `defer`'s reason is optional per the hook contract (check whether `permissionDecisionReason` is meaningful for a `defer` decision before deciding whether to pass one; if the field only matters for `deny`, omit it for `defer` rather than inventing filler text). Export both alongside the existing `deny` in `module.exports`.

### 3. Wire the preference check into `package-install-consent.js` <!-- agent: general-purpose -->

- [x] Update `lib/hooks/lib/command-parse.js`'s import line in `package-install-consent.js` to also pull in `allow`/`defer`.
- [x] Where `matchedInstall(tokens)` currently returns non-null and the code unconditionally calls `deny(...)`, add a preference check first: synchronously spawn `node <path-to-bootstrap-prefs.js> --get packageInstall.consent --project <cwd>` (resolve `cwd` from `data.cwd` in the hook's own tool-input payload if present, else `process.cwd()` — check what field the hook input actually carries for this; do not assume without confirming). Resolve the installed `bootstrap-prefs.js` path the same way this repo's other cross-references to it do (`~/.claude/bootstrap-prefs.js`).
- [x] Branch on the trimmed stdout: `"true"` → `allow(...)`; `"ask"` → `defer(...)`; anything else (`"false"`, `"unset"`, empty, non-zero exit, a thrown error) → fall through to the existing `deny(...)` call unchanged. Wrap the subprocess call in try/catch so any failure (missing helper, corrupt JSON, non-zero exit) is treated identically to `"false"`/`"unset"` — never treated as `"true"`.
- [x] Update the `deny()` call's message to name the escape hatch inline, mirroring this repo's own stated hook-writing convention (see `lib/hooks/README.md`'s "escape hatch" framing): append something like *"...or stop this gate from asking for this project's future installs: `node ~/.claude/bootstrap-prefs.js --set packageInstall.consent --value ask --project .` (or `--value true` to skip the prompt entirely)."*

### 4. Update docs <!-- agent: general-purpose -->

- [x] `lib/hooks/README.md`'s `package-install-consent.js` section: change "Known friction, real and expected" framing to describe the new opt-out (still deny-by-default, but no longer *only* resolvable by running the command yourself). Add this preference to the file's escape-hatch documentation pattern alongside the existing command-rephrasing ones.
- [x] `wiki/knowledge/entities/components/bootstrap-claude-hooks.md`'s "Contested, now with a third position" note (added by the research ingest): update it to record that this is now **implemented**, not just proposed — reference this task.
- [x] `lib/skills/bootstrap-config/SKILL.md`'s Step D population list (the `consumer: skill` key list with the heavier banner): add `packageInstall.consent` to the named population, matching the exact pattern used for the other keys there.

### 5. Tests <!-- agent: general-purpose -->

- [x] Schema shape test: extend `test/bootstrap-prefs.test.js`'s relevant coverage (the `consumer: "skill"` population growth-guard test, the per-key shape-pin tests, and the `askedBy`-resolves test — `/bootstrap-config` should already satisfy the existing `/slash-command` branch, confirm rather than assume) for the new key.
- [x] Hook behavior tests: add coverage (new test file or an addition to an existing hook test file — check whether `lib/hooks/*.js` already has an established test-file convention before choosing) for all branches: `false`/`unset` → still denies exactly as before; `ask` → emits `defer`, no `deny`; `true` → emits `allow`, no `deny`; a missing/corrupt preference read → still denies (never allows).
- [x] `/bootstrap-config`'s own test (`test/bootstrap-config-skill.test.js`, the "Step D population list matches the schema" check) — confirm it passes once `packageInstall.consent` is added to both the schema and the SKILL.md list.
- [x] Run the full suite (`npm test`) and confirm it passes before marking this task's implementation complete.

## Notes

Implementation note (2026-08-27): Step 1 added `packageInstall.consent` to `lib/scripts/templates/bootstrap-prefs-schema.json` right after `gitCommit.lint`, matching `gitCommit.autoPush`'s exact field order/style. JSON validated. Confirmed `askedBy: "/bootstrap-config"` resolves per `test/bootstrap-prefs.test.js`'s rule (slash-command → `lib/skills/bootstrap-config/SKILL.md`, which exists).

Implementation note (2026-08-27): Step 2 added `allow(reason)`/`defer(reason)` to `lib/hooks/lib/command-parse.js`, structurally identical to the existing `deny(reason)`, both exported. `defer` keeps passing `permissionDecisionReason` through (no authoritative source found saying the field is ignored for `defer`; the research's own recommended outline includes it). `node -c` syntax check passed.

Implementation note (2026-08-27): Step 3 wired `packageInstallConsent(cwd)` into `lib/hooks/package-install-consent.js` — `execFileSync(process.execPath, [PREFS_SCRIPT, '--get', 'packageInstall.consent', '--project', cwd], { timeout: 2000 })`, array-form args (no shell interpolation), wrapped in try/catch returning `null` on any failure. `PREFS_SCRIPT` resolves via `path.join(os.homedir(), '.claude', 'bootstrap-prefs.js')` (not `__dirname`-relative, since the hook runs from `~/.claude/hooks/` post-install). `cwd` is read from the hook payload's top-level `data.cwd` field (confirmed via `protected-write-guard.js:189` / `claude-settings-guard.js:192`'s existing convention — `data.tool_input` carries no `cwd` for `Bash` calls), falling back to `process.cwd()`. Branch order: `"true"` → `allow(...)`, `"ask"` → `defer(...)`, everything else (including the `null` from a caught failure) falls through unchanged to the existing `deny(...)`, whose message now appends the `bootstrap-prefs.js --set` escape hatch. `node -c` syntax check passed; no runtime/E2E exercised, per this task's verification-scope rules.

Implementation note (2026-08-27): Step 4 updated `lib/hooks/README.md`'s package-install-consent.js section (opt-out now documented alongside the existing escape-hatch style), `bootstrap-claude-hooks.md`'s "Contested" note (marked implemented, references this task), and `bootstrap-config/SKILL.md`'s Step D population sentence (added `packageInstall.consent` after `gitCommit.lint`). Synced `lib/skills/bootstrap-config/SKILL.md` to `~/.claude/skills/bootstrap-config/SKILL.md` directly (consistent with this session's earlier precedent for the same file, rather than waiting on a full `install-global.sh` re-run).

Implementation note (2026-08-27): Step 5 tests.
- Schema shape: added `packageInstall.consent` to `test/bootstrap-prefs.test.js`'s `SKILL_KEYS` growth-guard array (with a dedicated comment, matching `gitCommit.lint`'s precedent) and updated the "seven" → "eight" wording in that test's title/comments. Confirmed (did not assume) that the generic per-key loops — `REQUIRED_FIELDS`/`LEGAL_SCOPES`/`LEGAL_CONSUMERS` — and the generic `askedBy`-resolution test already cover the new key's field shape and its `/bootstrap-config` resolution with zero changes needed; no per-key shape-pin test exists for `gitCommit.lint` either, so none was added here (that pattern is reserved for the three `obsidian.*` keys' TASK-063 case).
- Hook behavior: the established convention is `test/command-class-hooks.test.js` (spawnSync against synthesized stdin JSON payloads, a shared `fire()` helper) — added a new section there rather than a new file. Built `scratchPrefsHome()`/`scratchProjectDir()`/`firePackageWithHome()`/`setProjectConsent()` fixtures that install a REAL copy of `bootstrap-prefs.js` + its schema into a scratch `$HOME` (mirroring `install-global.sh`'s own `~/.claude/bootstrap-prefs.js` + `~/.claude/templates/bootstrap-prefs-schema.json` layout) and seed a scratch project's `.claude/bootstrap-prefs.json` via the real helper, so the tests exercise the real `execFileSync(...bootstrap-prefs.js --get...)` subprocess path rather than a stub. Covered all branches: unset → deny, `false` → deny, `ask` → defer (no deny), `true` → allow (no deny), a missing `~/.claude/bootstrap-prefs.js` → deny, a corrupt project `bootstrap-prefs.json` → deny, and the deny reason naming the escape hatch. Also fixed a now-stale exact-shape pin in the same file (`command-parse.js`'s `module.exports` keys) to include `allow`/`defer`.
- Fixing `npm test` to green surfaced two more pre-existing exact-bijection/documentation tests that legitimately needed updating for the new key (not pre-anticipated by this task's steps, but required by its own "run the full suite and confirm it passes" bar): `test/bootstrap-prefs.test.js`'s `schema -> scripts` reference-bijection scan only walked `lib/scripts/*.sh` and `lib/skills/*/SKILL.md`, so `packageInstall.consent`'s only call site (`lib/hooks/package-install-consent.js`, a JS array-literal invocation) was invisible to it — added a third named/fixture-tested extractor, `extractHookKeys`, covering `lib/hooks/*.js` the same way `extractPrefKeys`/`extractWrapperKeys` cover the other two shapes. And `lib/scripts/README.md`'s hand-transcribed key registry (`test/scripts-readme-prefs-docs.test.js`) needed a new row, its entry/section counts bumped 24→25 and 7→8, and two now-inaccurate prose claims corrected: `packageInstall.consent` breaks "the `scope: either` and `consumer: skill` populations coincide" (it's `scope: project`) and "every `consumer: skill` key names `install-global.sh`" (it names `/bootstrap-config`) — both reworded to state it as the documented exception with its stated rationale, rather than silently left wrong.
- `/bootstrap-config`'s own test needed no changes — SKILL.md's Step D list already carried `packageInstall.consent` from Step 4, and the schema entry already existed from Step 1, so the generic "Step D population list matches the schema" join test passed as soon as both were confirmed present.
- Full suite: `npm test` — 423/423 passing, 0 failures, 0 skipped.

<!-- Updated: 2026-08-27 HH:MM -->


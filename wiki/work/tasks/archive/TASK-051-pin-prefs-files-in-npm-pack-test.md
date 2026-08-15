---
id: TASK-051
aliases: [TASK-051]
title: "Pin bootstrap-prefs.js and bootstrap-prefs-schema.json into test/npm-pack-contents.test.js"
status: done
created: 2026-08-07
updated: 2026-08-07
part_of: ROADMAP-005
depends_on: []
blocks: [TASK-052]
parallel_safe_with: [TASK-049, TASK-050]
uat: "[[UAT-051]]"
tags: [prefs, tests, release, roadmap-005]
---

# TASK-051 — Pin bootstrap-prefs.js and bootstrap-prefs-schema.json into test/npm-pack-contents.test.js

part_of::[[ROADMAP-005]]

## Objective

`test/npm-pack-contents.test.js` guards the published tarball's file listing, pinning the hooks-wiring artifacts (ROADMAP-004's release gate) so a `package.json` `files` regression cannot silently ship a broken package. ROADMAP-005 added a second subsystem with exactly the same failure mode — `bootstrap-prefs.js` and `bootstrap-prefs-schema.json` are installed into `~/.claude/` by `install-global.sh` step 6, so if either is missing from the tarball, `npx @codewizard-dt/bootstrap install` fails at step 6 for every consumer while this repo's own tests stay green.

This task adds those two paths to the tarball pin. **It edits exactly one file:** `test/npm-pack-contents.test.js`.

## Approach

**Both files pack correctly today — this is a regression guard, not a fix.** Verified against `npm pack --dry-run --json` at commit `b85cbe9` (191 files):

```
PACKED   lib/scripts/bootstrap-prefs.js
PACKED   lib/scripts/templates/bootstrap-prefs-schema.json
```

They pack because `package.json`'s `files` field includes a blanket `"lib/"` (`package.json:23`), with negations only under `raw/`. So a new file under `lib/` is included by default and nothing needs adding to `files`.

**That is exactly why the pin is worth having, and also why it is easy to write a useless one.** The current inclusion is incidental — it follows from a broad `lib/` glob, not from anything naming these files. The realistic regression is someone narrowing `files` (the same instinct that produced the `raw/` negations in commit `99f3bba`, which cut the tarball 210 → 185 files) and not realising two runtime-critical files went with it. A test that passes today and would keep passing under that change is worthless, so **step 3's falsifiability check is the real deliverable**, not the assertion itself.

**Extend the existing required-paths test rather than adding a new one.** `test/npm-pack-contents.test.js:40-50` already loops a list of required paths through one `assert.ok(files.includes(required))`. The two new paths are the same kind of claim with the same failure mode. Adding them to that array — and generalising the test name, which currently says "hooks-wiring artifacts" — keeps one list of "files whose absence breaks a consumer install" instead of two lists that drift.

Rename it to something covering both, e.g.:

```js
test('tarball ships the runtime artifacts a consumer install depends on', () => {
```

Keep `packedPaths()` and the single module-level `npm pack` (`:24-27`) as they are — one pack per suite run is deliberate, and adding a second would roughly double this file's runtime for no gain.

**Say *why* in the code, not just *what*.** The existing entries carry their provenance in the file header (`:7-12`: promoted from UAT-038, guarding against a real leak). Add a short comment beside the two new paths recording that they are consumed by `install-global.sh` step 6 (helper → `~/.claude/bootstrap-prefs.js`, schema → `~/.claude/templates/bootstrap-prefs-schema.json`) and that the failure is invisible in-repo: the install breaks only for a consumer installing from the registry.

**Scope note — `lib/skills/bootstrap-config/SKILL.md` also packs today** and was checked. It is deliberately **not** added here: the roadmap item names two files, skills ship as a directory tree covered by the same `lib/` glob, and pinning one skill file invites the question of why the other ~50 are not pinned. Leave it.

## Steps

### 1. Read the test file <!-- agent: general-purpose -->

- [x] Read `test/npm-pack-contents.test.js` in full (57 lines) — the header comment (`:7-12`), the module-level `npm pack --dry-run --json` (`:24-27`), the `packedPaths()` helper (`:36-38`), and the required-paths test (`:40-50`).
- [x] Note the suite is zero-dependency (`node:test` + `node:assert` only) and matches the sibling suites. Keep it that way — no new imports.

<!-- Updated: 2026-08-07 — confirmed 57 lines, 4 Node-builtin imports (node:test, node:assert, node:path, node:child_process), zero third-party deps. Incidental finding (not in scope, left alone): header `:10` cites commit `99fbba` but the real SHA is `99f3bba`. -->


### 2. Add the two paths and generalise the test name <!-- agent: general-purpose -->

- [x] `Edit` the required-paths array at `:42-47`, appending:
  ```js
  'lib/scripts/bootstrap-prefs.js',
  'lib/scripts/templates/bootstrap-prefs-schema.json',
  ```
- [x] Rename the test from `'tarball ships the hooks-wiring artifacts alongside the deny template'` to a name covering both subsystems, e.g. `'tarball ships the runtime artifacts a consumer install depends on'`.
- [x] Add a brief comment above the two new entries stating what consumes them and why the failure is invisible in-repo: `install-global.sh` step 6 installs the helper to `~/.claude/bootstrap-prefs.js` and the schema to `~/.claude/templates/bootstrap-prefs-schema.json`; a missing file breaks `npx @codewizard-dt/bootstrap install` for consumers only.
- [x] Extend the file header (`:7-12`) with one sentence noting the ROADMAP-005 additions, so the file's provenance stays complete.

<!-- Updated: 2026-08-07 — test renamed to 'tarball ships the runtime artifacts a consumer install depends on'; two paths appended with a 4-line provenance comment; header extended with the ROADMAP-005 sentence. `node --check` passed. No new imports, no new test() block. -->


### 3. Prove the assertion can actually fail <!-- agent: general-purpose -->

This is the point of the task. A pin that cannot fail is a tautology that costs runtime and buys nothing.

- [x] Temporarily narrow `package.json`'s `files` field to exclude the helper — e.g. add `"!lib/scripts/bootstrap-prefs.js"` after `"lib/"`.
- [x] Run `npm test` and confirm the assertion fails with a message naming the missing path (`tarball is missing lib/scripts/bootstrap-prefs.js`). <!-- ran narrow `node --test test/npm-pack-contents.test.js` instead of full `npm test`, to minimise the window in which package.json was broken for concurrent TASK-049/050 agents; full `npm test` run in step 4 with package.json restored -->
- [x] Repeat for `"!lib/scripts/templates/bootstrap-prefs-schema.json"` and confirm the second path fails the same way — both must be independently falsifiable, not just the first one in the list.
- [x] **Restore `package.json` and verify it is byte-identical** (SHA-256 before and after). Do not leave a negation behind; a stray `!lib/...` in `files` is the exact regression this test exists to catch and would ship silently.

<!-- Updated: 2026-08-07 — falsifiability proven independently for both paths (negations applied separately, restored between).
     A: AssertionError `tarball is missing lib/scripts/bootstrap-prefs.js` — tests 3 / pass 2 / fail 1
     B: AssertionError `tarball is missing lib/scripts/templates/bootstrap-prefs-schema.json` — tests 3 / pass 2 / fail 1
     package.json SHA-256 before AND after: d7fa2645dc4f4c424c0cde53425905759ae09e313eb0c6896e72324ca80bc2f8 (byte-identical). -->


### 4. Verify <!-- agent: general-purpose -->

- [x] Run `npm test` — 0 failures, suite total up by **0** (the two paths join an existing test's loop; no new `test()` is added). <!-- observed: tests 289 / pass 289 / fail 0. Delta vs. the 290 baseline is TASK-049 removing its tripwire block, not this task — this task added 0 test() blocks. -->
- [x] Confirm `npm pack --dry-run` still reports 191 files, i.e. nothing was added to or removed from the tarball by this task.
- [x] Confirm `package.json` is unmodified in `git diff`. <!-- `git status --porcelain package.json` and `git diff --stat package.json` both empty; SHA-256 matches the pre-mutation hash. -->
- [x] Do **not** edit `lib/skills/README.md` / `CLAUDE.md` (TASK-049) or `lib/scripts/README.md` (TASK-050). <!-- confirmed via full `git status --porcelain`: those files are modified by their owning concurrent tasks; this task touched only `test/npm-pack-contents.test.js`. -->

<!-- Updated: 2026-08-07 — verification complete. npm test: tests 289 / pass 289 / fail 0. npm pack --dry-run: 191 files, both prefs paths present. package.json byte-identical + git-clean. -->


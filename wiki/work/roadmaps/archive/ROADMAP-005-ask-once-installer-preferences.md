---
id: ROADMAP-005
title: Preference store — ask once, remember, and stop skills acting without consent
status: done
created: 2026-08-06
updated: 2026-08-07
owner: David Taylor
linked_requirements: []
linked_decisions: []
tags: [install, prefs, skills, consent]
---

# Roadmap 005: Preference store — ask once, remember, and stop skills acting without consent

## Goal

One preference store, answered once and never re-asked, serving two populations of question that today both misbehave:

1. **Installer prompts re-ask forever when declined.** Stickiness is currently inferred from side effects ("the guide exists", "the MCP is registered"), which is one-directional — accepting a prompt stops it, declining it does not. The worst case is the Playwright conflict menu, which re-asks even after you answer it.
2. **Skills take consequential actions nobody agreed to** — `/git-commit` bumps every manifest's version on every commit, `/research` always writes to `raw/research/`.

Every key is one of four states — `unset` / a settled value / `false` / `ask` — where absence means unset and `ask` means "keep prompting me, don't persist". Values live in a project file and a global file, project winning per key. A new `/bootstrap-config` skill views, edits, and resets them.

This roadmap **absorbs TASK-030**, which designed the skill-consent half. Its four-state model and its consumer list are adopted wholesale; the store it specified moves into Phase 1 here, so TASK-030 narrows to the sync prompt pass plus wiring the consumers.

Implementation detail lives in the approved plan at `~/.claude/plans/ensure-that-all-of-luminous-simon.md`.

### Reconciled decisions (differences resolved 2026-08-06)

| Question | Resolution |
|---|---|
| Store filenames | `~/.claude/bootstrap-prefs.json` + `<project>/.claude/bootstrap-prefs.json`; helper `lib/scripts/bootstrap-prefs.js`. Renamed from TASK-030's `bootstrap-preferences.json` / `preferences.js` / repo-root project file — `.claude/` is already the agent-state directory |
| Is the project file ever committed? | **Superseded.** TASK-030 required "never committed"; a new `prefs.gitTracking` preference now offers `.gitignore` / `.git/info/exclude` / neither, so committing it is a deliberate opt-in for teams wanting shared answers |
| SemVer bump | `gitCommit.versionBump` with `auto` / `confirm` / `never` — richer than TASK-030's boolean. `confirm` *is* the `ask` state for this key, so the two do not both exist |
| Who prompts | The schema's `consumer` field decides: `skill` keys are prompted once by `install-global.sh`'s preferences pass; `installer` keys are asked in situ by the script that owns them |

## Phase 1: Foundation

- [x] [[TASK-040: Canonical preference key registry — bootstrap-prefs-schema.json]]
- [x] [[TASK-041: bootstrap-prefs.js — four-state preference helper]]
- [x] [[TASK-042: test/bootstrap-prefs.test.js — four-state and schema-bijection coverage]]

## Phase 2: Installer stickiness

- [x] [[TASK-043: Sticky prompt helpers in lib.sh — prompt_yn_sticky, prompt_choice_sticky, BOOTSTRAP_ASSUME_TTY]]
- [x] [[TASK-044: Wire the install-mcps.sh prompt sites to the preference store]]
- [x] [[TASK-045: Wire the sync-wiki-scaffold.sh, install-global.sh, and update-project.sh prompt sites]]
- [x] [[TASK-046: merge-gitignore.sh — prefs.gitTracking three-way prompt and declines-only wiring]]
- [x] [[TASK-047: test/prompt-stickiness.test.js — sticky-prompt coverage and the bijection un-skip]]
  - **Un-skip the `schema -> scripts` bijection test** in `test/bootstrap-prefs.test.js` (TASK-042 step 8) — delete the `{ skip: ... }` option from `test('schema -> scripts: every non-dynamic schema key is referenced by at least one script or skill', ...)`. Its body is complete and needs no edit; it is skipped only because Phase 1 leaves the helper with zero call sites, so all 17 non-dynamic keys would report unreferenced at once. Once the first wave of Phase 2 call sites lands it becomes the live anti-drift check in both directions

## Phase 3: Skill consent

- [x] [[TASK-030: User preferences: stop skills doing consequential things without consent]]
- [x] [[TASK-048: /bootstrap-config skill — view, edit, and reset stored preferences]]

## Phase 4: Docs & Release

- [x] [[TASK-049: Register /bootstrap-config in lib/skills/README.md and the CLAUDE.md Custom Commands table]]
- [x] [[TASK-050: Document the helper, the four-state model, and the full key registry in lib/scripts/README.md]]
- [x] [[TASK-051: Pin bootstrap-prefs.js and bootstrap-prefs-schema.json into test/npm-pack-contents.test.js]]
- [x] [[TASK-052: End-to-end verification of the preference store against a scratch project]]

## Notes

**Closed 2026-08-07 — 14/14.** TASK-052 was the release gate, and all four of its claims passed against real captured output under a redirected `HOME`: ask-once across a re-run, all three `prefs.gitTracking` answers, all three `gitCommit.versionBump` values, and a headless run that writes no preferences file. Every trap the roadmap accumulated was re-confirmed closed — the sync pass gates on `prefs_stored_global` rather than `prefs_get`; stored `false` and stored `ask` are never re-asked; `gitCommit.autoPush`'s `unset` means do not push; `mcp.playwrightConflict` stores names and rejects digits at the persistence layer; `prefs.gitTracking`'s menu genuinely prompts. Suite **295 → 297** (0 fail, 0 skipped), the delta being two tests promoted by UAT-052 to close the last two coverage gaps: the schema half of the headless step-6 contract, and the store's refusal of a raw digit.

Two items are deliberately left open rather than folded in:

- [[BUG-0009]] — `--set` does not enforce `scope`, so a `global`-scope key can be written into a project file where `--get` and `--list` both show no trace. A bidirectional test pins the current behaviour, and that bug's own notes explain why those fixtures must be rewritten as part of the fix rather than ahead of it.
- [[BUG-0010]] — two message-only defects in `install-global.sh` found during TASK-052's verification: the `ask` confirmation denies its own write, and the completion summary claims `MCPs` on every `--skip-mcps` run (i.e. every `setup` and every `update`). Filed rather than fixed, because a fix applied inside a verification task would be unverified by construction.

**Not yet live for the user.** `/bootstrap-config`, `bootstrap-prefs.js`, and the post-TASK-030 `uat-generate` are not in the real `~/.claude/` until the user runs `./lib/scripts/install-global.sh --skip-mcps` themselves. TASK-052 deliberately did not perform that run: step 7 would permanently settle their real skill preferences, and `unset` is not recoverable by re-running.


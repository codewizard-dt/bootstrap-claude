---
id: BUG-0010
title: install-global.sh output overstates what happened — two message-only defects
status: verified
severity: low
priority: P3
created: 2026-08-07
updated: 2026-08-14
reporter: David Taylor
assignee: David Taylor
tags: install-global, messaging
linked_task: "—"
---

# BUG-0010 — `install-global.sh` output overstates what happened

Two **message-only** defects found during TASK-052's end-to-end verification of
the preference store. Neither changes behaviour, state, or any stored value —
both were found while asserting on real captured stdout, and in each case the
script did the right thing and then described it wrongly.

Filed together, following [[BUG-0008]]'s precedent for message-only findings in
a single component: they share one root shape — a line printed unconditionally
that describes a branch that did not run — and a fixer touching one will be
looking at the other.

## Summary

| # | Site | The claim | The reality |
|---|---|---|---|
| 1 | `lib/scripts/install-global.sh:200` | `ask (you will be prompted every run; the answer is never stored)` | `ask` **is** stored, at layer `[global]` — and the next line of output says `Stored in …` |
| 2 | `lib/scripts/install-global.sh:264` | `Global setup complete (… + MCPs).` | Under `--skip-mcps` no MCP code ran at all |

## Environment

- Platform: macOS 26.3, Node v26.0.0 (not platform-specific)
- Component: `lib/scripts/install-global.sh`
- Version: repo at 2.17.0, commit `b85cbe9`

## Defect 1 — the `ask` confirmation denies its own write

`install-global.sh:200`, inside `settle_skill_pref`:

```sh
ask)  prefs_set "$key" --global ask ;   echo "    $key = ask (you will be prompted every run; the answer is never stored)" ;;
```

### Steps to Reproduce

```sh
printf 'n\nn\na\ny\ns\n' | env HOME=/tmp/repro/home BOOTSTRAP_ASSUME_TTY=1 \
  bash lib/scripts/install-global.sh --skip-mcps
env HOME=/tmp/repro/home node lib/scripts/bootstrap-prefs.js --list --global
```

### Actual Behavior

```
    research.persistToRaw = ask (you will be prompted every run; the answer is never stored)
…
  Stored in /tmp/repro/home/.claude/bootstrap-prefs.json (see bootstrap-prefs.README.md beside it for what each key does).
```

and the store contains it:

```
  research.persistToRaw = ask  [global]
```

### Expected Behavior

The sentence is *technically* defensible — `lib.sh:526` defines `ask` as "a
settled 'keep asking' — prompt, and record NOTHING", so "the answer" means the
per-invocation answer given at skill runtime, not the `ask` state itself. But
placed immediately after `key = ask` and immediately before `Stored in …`, it
reads as "nothing was persisted", which is the opposite of what happened.

The user-visible risk is that it invites the belief that the installer will
re-ask this key next sync. It will not — `ask` is a settled answer and
`prefs_stored_global` sees it (verified: two poisoned re-runs never mentioned
the key). A user expecting to be re-prompted at install time has no way to
discover that `/bootstrap-config` is now the only way to change it.

Suggested wording, preserving the real distinction:

> `ask` (the skill will prompt you each time it runs; that per-run answer is never stored)

## Defect 2 — the summary line claims MCPs on a run that skipped them

`install-global.sh:264` is a bare unconditional `echo`, outside the
`if [ "$SKIP_MCPS" = false ]` guard that opens at `:256`:

```sh
echo "Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences + MCPs)."
```

### Steps to Reproduce

```sh
env -u BOOTSTRAP_ASSUME_TTY HOME=/tmp/repro/home2 \
  bash lib/scripts/install-global.sh --skip-mcps < /dev/null
```

### Actual Behavior

Captured stdout ends:

```
Checking skill preferences (~/.claude/bootstrap-prefs.json)...
  Non-interactive terminal: skipping the preference questions. Every unanswered key keeps today's behavior.

Global setup complete (hooks + skills + deny list + hooks wiring + file suggestion + preferences + MCPs).
```

The `Checking global MCP servers (user scope)...` banner never printed, because
step 8 was skipped — yet the summary lists `MCPs`. On the same run `preferences`
is also listed, on a pass that deliberately recorded zero preferences.

### Impact

This is the **most common invocation path**, not an edge case: both
`setup-project.sh` and `update-project.sh` call `install-global.sh --skip-mcps`
(they run the interactive MCP install themselves, separately). So on every
`setup` and every `update`, the user is told MCPs were part of "global setup
complete" when this script ran none.

Low severity — nothing is mis-installed, and the callers do handle MCPs. The
cost is that the line is not usable as evidence of what ran, which is exactly
what a completion summary is for.

### Expected Behavior

Build the summary from what actually ran. Minimally, drop the `+ MCPs` token
when `SKIP_MCPS` is true. `preferences` deserves the same treatment: it is
accurate when the pass ran (whether or not anything was asked, since step 6
always installs the helper), so it can stay unconditional — but say so in a
comment, otherwise the asymmetry with `MCPs` looks like an oversight.

## Reproducibility

- `always` — deterministic, no timing or environment dependence
- First seen: 2026-08-07 (TASK-052 verification)
- Last seen: 2026-08-07

## Workaround

> Read the step banners rather than the summary line. They are accurate and
> complete, and `test/install-global.test.js`'s `STEP_BANNERS` now pins all
> eight of them in order — including the two preference steps, added by
> TASK-052.

## Notes for the fixer

- Both fixes are local to `lib/scripts/install-global.sh`; neither touches the
  helper, the schema, or `lib.sh`.
- Defect 2 has a test consequence worth planning for:
  `test/install-global.test.js` asserts the exact summary string at **three**
  sites — the eight-step ordering test, the guarded-MCP-failure test, and the
  fresh-run test. A conditional summary needs those updated to expect the
  variant matching each case's flags. The `--skip-mcps` case currently makes no
  summary assertion at all; adding one is the natural way to pin the new
  behaviour.
- Defect 1 is a string change with no test coupling.

## Root Cause Analysis

Both defects share the same shape: a line printed unconditionally that describes a branch the script did not (necessarily) take, written when the surrounding logic was simpler than it later became. Defect 1's wording ("the answer is never stored") was accurate about the *per-invocation prompt* — `ask` really does mean "keep asking" rather than settling a fixed answer — but was phrased as though it described the *stored state*, and placed directly between `key = ask` and `Stored in …` it reads as the opposite of what happened. Defect 2's `echo` predates `--skip-mcps` being a real branch point with its own effect on what ran; the line was written once, for the case where every step always ran, and never revisited when step 8 became conditionally skippable — so it kept claiming a step that, on the most common invocation path (every `setup` and every `update`), never executes.

## Resolution

| Field | Value |
|-------|-------|
| Fix commit | `9722eb8` |
| Fix version | — |
| Linked PR | — |
| Linked task | — |
| Regression test | `test/install-global.test.js` — added a summary-line assertion (both the correct no-MCPs variant present, and the MCPs-included variant absent) to the existing `'--skip-mcps skips the MCP step entirely'` test, which previously made no summary assertion at all |

Fix: (1) reworded the `ask` confirmation to "the skill will prompt you each time it runs; that per-run answer is never stored" — preserves the real distinction (the *answer* isn't stored per-run; the `ask` *state* is) without reading as a denial of storage. (2) Made the completion summary's `+ MCPs` token conditional on `SKIP_MCPS`, with a comment explaining `preferences` deliberately stays unconditional (step 6 always installs the helper, whether or not anything was asked). Both of the pre-existing tests that assert the exact summary string continue to pass unmodified, since neither passes `--skip-mcps` (MCPs genuinely runs in both). Verified: `test/install-global.test.js` 7/7, full suite 341/341.

## Related

- Sites: `lib/scripts/install-global.sh:200` (defect 1), `:256` and `:264`
  (defect 2)
- Definition of the `ask` state that defect 1 misdescribes:
  `lib/scripts/lib.sh:526`, `_sticky_lookup` at `:547`
- Tests that pin the summary string: `test/install-global.test.js`
- Found during: TASK-052 (end-to-end verification of the preference store)
- Sibling message-only checklist: [[BUG-0008]]

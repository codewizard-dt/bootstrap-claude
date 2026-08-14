---
id: BUG-0009
title: --set reports success writing a key into a layer that never reads it
status: verified
severity: medium
priority: P2
created: 2026-08-07
updated: 2026-08-14
reporter: David Taylor
assignee: David Taylor
tags: preferences, bootstrap-prefs, scope
linked_task: "—"
---

# BUG-0009 — `--set` reports success writing a key into a layer that never reads it

`lib/scripts/bootstrap-prefs.js` validates a key's **value grammar** on `--set`
but never its **`scope`**. A `global`-scope key can be written into a project
values file; the write succeeds, prints an affirmative line, and exits `0`. The
key lands on disk and is then ignored by every consumer.

## Summary

The schema gives each key a `scope` (`global | project | either`). Resolution
honours it — `resolve()` (`bootstrap-prefs.js:353-379`) picks which layer files
to walk based on `entry.scope`. The write path does not.

`scopePermitsLayer` (`bootstrap-prefs.js:396-401`) is the function that encodes
the rule, and it is referenced at **exactly one** site:
`renderCompanion` (`bootstrap-prefs.js:417`). The `--set` handler
(`bootstrap-prefs.js:673-713`) checks three things — the literal values `unset` /
`null` (`:674`), schema membership (`:682-687`, warn-only by design for forward
compatibility), and the value grammar (`:689-695`) — then writes
unconditionally at `:705`. `scopePermitsLayer` is never called on this path.

The result is a preference that is **inert but looks saved**, and the two
surfaces a user would check to confirm both fail to mention it.

## Environment

- Platform: macOS 26.3, Node v26.0.0 (not platform-specific)
- Component: `lib/scripts/bootstrap-prefs.js`
- Schema: `lib/scripts/templates/bootstrap-prefs-schema.json`
- Version: repo at 2.17.0, commit `b85cbe9`

## Steps to Reproduce

Run against a redirected `HOME` and a scratch project so the real
`~/.claude/bootstrap-prefs.json` is untouched. `mcp.braveSearch` is
`scope: global` (`bootstrap-prefs-schema.json:84-92`).

```sh
export HOME=/tmp/repro/home            # redirected
node lib/scripts/bootstrap-prefs.js \
  --set mcp.braveSearch --value true --project /tmp/repro/proj
```

Then check each surface:

```sh
node lib/scripts/bootstrap-prefs.js --get  mcp.braveSearch --project /tmp/repro/proj
node lib/scripts/bootstrap-prefs.js --list                 --project /tmp/repro/proj
cat /tmp/repro/proj/.claude/bootstrap-prefs.json
cat /tmp/repro/proj/.claude/bootstrap-prefs.README.md
```

## Expected Behavior

`--set` should refuse to write a key into a layer that key's `scope` forbids,
exiting non-zero with a message naming the scope and the layer that would
actually be consulted — the same shape as the existing illegal-value refusal
(`:691-694`). Writing an answer into a file no consumer will ever read is not a
recoverable state the user can be expected to notice, and the helper already
owns the fact needed to refuse (`scopePermitsLayer`).

`--target <path>` should remain exempt: it is the explicit single-file escape
hatch, and `scopePermitsLayer` already returns `true` unconditionally for the
`target` layer (`:397`).

## Actual Behavior

Confirmed by running the steps above:

1. **`--set` — affirmative, exit 0:**

   ```
   project: mcp.braveSearch = true
   exit=0
   ```

2. **On disk** — `/tmp/repro/proj/.claude/bootstrap-prefs.json`:

   ```json
   {
     "mcp.braveSearch": true
   }
   ```

3. **`--get` — `unset`, exit 0.** Resolution *is* scope-constrained, so it
   never looks in the project file for a `global`-scope key. The value the user
   just set is invisible here.

4. **`--list --project`** renders the row with no trace of the stored value:

   ```
     mcp.braveSearch = unset  [unset]
         Install the Brave Search MCP globally for web research
   ```

5. **Only the generated companion reveals it** —
   `.claude/bootstrap-prefs.README.md`, under `## Unrecognized keys`:

   ```
   - `mcp.braveSearch` = `true` — scope is `global` — this layer never consults it, so it has no effect here
   ```

So the write announces success, and both interrogation surfaces (`--get`,
`--list`) report `unset`. The single place the truth appears is a generated
markdown file the user has no reason to open after a command that said it
worked.

## Reproducibility

- `always` — deterministic, no timing or environment dependence
- First seen: 2026-08-07
- Last seen: 2026-08-07

## Impact

A user, or the `/bootstrap-config` skill, can create a preference that appears
saved and does nothing. The affected keys are the ones that gate installer
behaviour, so the realistic failure is a declined install that quietly
re-prompts — or, inverted, a user who believes they have recorded a machine-wide
answer per-checkout.

Today the **only** guard against this is prose: `/bootstrap-config`'s Step E
(`lib/skills/bootstrap-config/SKILL.md:115-121`), which instructs the model to
offer only layers the key's `scope` permits and states plainly that *"The
helper's `--set` does not enforce scope."* That is a documented instruction to
an LLM, not a code-level control — nothing stops a direct CLI invocation, a
script, or a model that skips the step.

Severity `medium`: no data loss and no security impact, but a silent failure at
both surfaces a user would use to verify, with only a prose guard behind it.

## Workaround

> Check the generated `bootstrap-prefs.README.md` companion after any `--set`
> you are unsure about — a key under `## Unrecognized keys` with a
> `scope is ...` reason was written into a layer that will never read it.
> Remove it with `--unset <key>` and re-set it against the correct layer.

## Notes for the fixer

- The fix is small: call `scopePermitsLayer(entry, targetLayer)` in the `--set`
  handler (`bootstrap-prefs.js:673-713`), inside the `entry !== null` branch at
  `:688-696` where the value grammar is already checked, and exit `1` with a
  message naming the scope and the layer that would be consulted instead.
  Keep the `entry === null` path warn-only — unfamiliar keys are deliberately
  permitted for forward compatibility (`:684-687`).
- Leave `--target` exempt (`scopePermitsLayer` already handles this at `:397`).
- Decide whether `--unset` needs the same treatment. It is the weaker case:
  unsetting a key from a layer that never read it is harmless, and refusing it
  would make the workaround above impossible. Recommendation: leave `--unset`
  permissive, and say so in a comment so the asymmetry reads as deliberate.

### This fix breaks a test that pins the current behaviour — on purpose

`test/bootstrap-prefs.test.js` contains a **deliberately bidirectional** test
that depends on `--set` being scope-permissive, because writing a scope-inert
key is how it constructs its fixture:

- `test/bootstrap-prefs.test.js:649-671` — *"scope `global`: a value parked in
  the project file is never consulted"*. Its comment at `:651` states the
  contract verbatim: *"Legal to write (`--set` enforces the value grammar, not
  the scope)."* It calls `setLayer(L, 'project', GLOBAL_UNSET_KEY, 'true')`
  (`:655`), which shells out to `--set`.
- `test/bootstrap-prefs.test.js:1700-1800` — the two-population companion test,
  which needs a scope-inert key to exist in a project file to assert the
  `## Unrecognized keys` reason string (`:1716`, `:1740-1742`), plus its
  `--target` contrast case (`:1788-1798`).

Both will fail once `--set` enforces scope. **That is the intended signal, not
collateral damage** — the failures are the pointer to the rest of the work:

1. Rewrite those fixtures to write the inert key directly into the values JSON
   (bypassing the CLI) rather than via `--set`, so they still cover the
   *resolution* and *companion* behaviour, which remain correct and must not
   regress. The scope-inert population must stay reachable — it is still a real
   state, produced by a hand-edited file or by a values file written by a newer
   bootstrap.
2. Add a new test asserting the refusal: `--set` of a `global`-scope key with
   `--project` exits `1` and writes **nothing** — model it on the existing
   no-selector test at `:932`.
3. **Update the now-stale skill prose.**
   `lib/skills/bootstrap-config/SKILL.md:120` asserts that the helper does not
   enforce scope and frames Step E as *"the guard against creating that
   situation."* Once the helper enforces it, that sentence is wrong and Step E
   becomes a nicety (a better prompt) rather than the only control. Rewrite it
   to say the helper refuses, and that Step E exists to avoid offering a layer
   that would be refused. `SKILL.md:24` makes the same claim in shorter form
   (*"subject to the per-key `scope` check in Step E"*) and should be reworded
   to point at the helper.
4. Consider whether `lib/scripts/README.md` should document the refusal once
   the helper is documented there at all — that documentation does not exist
   yet (it is separate ROADMAP-005 Phase 4 work).

## Root Cause Analysis

`scopePermitsLayer` already existed as the single source of truth for whether a layer may hold a given key, and `resolve()` already used it correctly for reads. But the function was wired into exactly one write-adjacent site — `renderCompanion`, which uses it only to *explain* an inert key after the fact — and was never called from the `--set` handler itself. The handler's write path checked two things before writing (the literal `unset`/`null` sentinel, and the value grammar via `allowedValues`) and then wrote unconditionally; nothing in that sequence asked whether the resolved `targetLayer` was one the key's `scope` actually permitted. This was an omission in the write path, not an incorrect check anywhere — the correct logic already existed and was simply never invoked at the one place that needed it to prevent, rather than merely explain, the inert state.

## Resolution

| Field | Value |
|-------|-------|
| Fix commit | `9722eb8` |
| Fix version | — |
| Linked PR | — |
| Linked task | — |
| Regression test | `test/bootstrap-prefs.test.js` — 3 new tests: "--set of a global-scope key with --project exits 1 and writes nothing (BUG-0009)", "--set of a project-scope key with --global exits 1 and writes nothing (BUG-0009)", "--set of a global-scope key via --target is legal — the escape hatch is exempt from the scope check (BUG-0009)" |

Fix: call `scopePermitsLayer(entry, targetLayer)` inside the `--set` handler's `entry !== null` branch, right after the value-grammar check, and exit `1` with a message naming the actual scope and the correct selector when the layer doesn't permit it. `--target` stays exempt (as `scopePermitsLayer` already returns `true` unconditionally for it); `--unset` was deliberately left permissive, per the bug's own recommendation, since unsetting an inert key from the wrong layer is harmless and is the documented workaround for a key already stuck there. Two existing test fixtures that constructed a scope-inert key via plain `--set` were rewritten to use `--target` at the resolved file path instead — this still exercises the real write path (including companion regeneration) while bypassing only the new, deliberate refusal. Updated `lib/skills/bootstrap-config/SKILL.md` (Step E.2 and its argument-hint note) and `lib/scripts/README.md` (the preference-helper table row and the "Known gap" section, now reworded as a positive statement of the enforcement) to stop describing the old gap as intentional. Removed a self-aware tripwire test in `test/bootstrap-config-skill.test.js` that pinned the pre-fix claim and explicitly asked to be deleted once the helper was fixed, replacing it with a test asserting the actual refusal. Verified: all 3 new tests pass, full suite 341/341.

## Related

- Helper: `lib/scripts/bootstrap-prefs.js:396-401` (`scopePermitsLayer`),
  `:353-379` (`resolve`), `:673-713` (the `--set` handler)
- Schema: `lib/scripts/templates/bootstrap-prefs-schema.json:84-92`
  (`mcp.braveSearch`, the `scope: global` key used in the reproduction)
- Prose guard that must be updated with any fix:
  `lib/skills/bootstrap-config/SKILL.md:24`, `:115-121`
- Tests that pin the current behaviour: `test/bootstrap-prefs.test.js:649-671`,
  `:1700-1800`

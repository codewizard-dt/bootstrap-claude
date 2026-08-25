---
id: TASK-067
aliases: [TASK-067]
title: "Per-key sticky refresh for .obsidian/graph.json instead of whole-file skip-if-present"
status: pending-uat
created: 2026-08-21
updated: 2026-08-21
depends_on: []
blocks: []
parallel_safe_with: [TASK-031, TASK-039, TASK-060]
uat: "[[UAT-067]]"
tags: [obsidian, tooling, graph-view]
---

# TASK-067 — Per-key sticky refresh for `.obsidian/graph.json` instead of whole-file skip-if-present

## Objective

`_install_obsidian_graph_defaults` in `lib/scripts/install-obsidian.sh` currently treats **any** existing `.obsidian/graph.json` as fully user-owned and skips it outright (`.obsidian/graph.json already present — leaving your customization in place, skipping.`), even when the file is byte-identical to what this same installer wrote on a prior `setup`/`update` and the user never touched it. Reported via `/debug-logs`: a user answered "y" to the install prompt and got the skip message anyway, because the file already existed from an earlier run. Replace the whole-file check with a **per-key** comparison so template-owned keys (`search`, `colorGroups`, the boilerplate display flags) stay in sync across releases, while any key the user has actually diverged from our last-delivered value is never silently clobbered — and instead of just leaving diverged keys alone forever, the installer offers to update them, sticky per key so a decline isn't re-asked until the template's value for that key changes again.

## Approach

**Do not do a single whole-file hash compare** — the user explicitly wants granularity at the key level: if someone tweaks `centerStrength` (a force/layout key this template never writes in the first place, so it's always left alone regardless) that must not block `colorGroups` from refreshing when `colorGroups` itself is untouched.

**Fingerprint sidecar**: `.obsidian/.graph-defaults-fingerprint.json`, written next to `graph.json`. Shape: `{ "<key>": { "offeredHash": "<sha256 of JSON.stringify(value) we last delivered/offered>", "declinedHash": "<sha256 of the template value the user explicitly declined, if any>" } }`. Use Node's `crypto.createHash('sha256')` (already available — no new dependency) over `JSON.stringify(value)`.

**Per-key decision, evaluated independently for every key present in the packaged template** (`search`, `colorGroups`, `collapse-filter`, `showTags`, `showAttachments`, `hideUnresolved`, `showOrphans`, `collapse-color-groups`, `collapse-display`, `showArrow`, `collapse-forces` — the exact key set TASK-061 shipped in `lib/scripts/templates/obsidian/graph.json`; force/layout keys like `centerStrength`/`repelStrength`/`linkStrength`/`linkDistance`/`scale`/`nodeSizeMultiplier`/`lineSizeMultiplier`/`textFadeMultiplier`/`close` are never in the template, so they're structurally never touched — no special-case needed):

1. **Key absent from the existing file** (or file doesn't exist at all) → write the template's current value for that key; set `offeredHash = hash(templateValue)`, clear any `declinedHash`. No prompt.
2. **Key present, `offeredHash` recorded, and `hash(fileValue) === offeredHash`** → file still holds exactly what we last delivered — user hasn't touched it since. Silently refresh: set `fileValue = templateValue` (even if unchanged, this keeps the fingerprint current), `offeredHash = hash(templateValue)`. No prompt — this is the template evolving its own previously-delivered value, not overriding a user choice.
3. **Key present, no `offeredHash` recorded yet** (first run after this change ships, upgrading an existing pre-TASK-067 install with no sidecar) → bootstrap case. If `hash(fileValue) === hash(templateValue)` (the file already matches today's template — the common case for someone who never touched it, like the reporter) → treat as case 2: silently confirmed unmodified, write `offeredHash = hash(templateValue)`, no prompt. Otherwise treat as case 4 (diverged, decide whether to ask).
4. **Key present and diverged from what we last offered** (`hash(fileValue) !== offeredHash`, or bootstrapped-diverged from step 3) →
   - If `declinedHash` is already recorded **and** `hash(templateValue) === declinedHash` → the user already declined exactly this template value for this key. Stay sticky: leave the file alone, no prompt (matches this repo's `prompt_yn_sticky` convention elsewhere in this script).
   - Otherwise there's a template value for this key the user hasn't been asked about yet (first divergence, or the template itself changed since the last decline):
     - **Interactive mode**: prompt per key, e.g. `"  graph.json key 'colorGroups' differs from your saved customization — update to the new default? [y/N]: "`. On yes: `fileValue = templateValue`, `offeredHash = hash(templateValue)`, clear `declinedHash`. On no: leave `fileValue` untouched, set `declinedHash = hash(templateValue)` (do **not** touch `offeredHash`, so a future re-divergence check on step 2/3 still correctly compares against what was actually last *delivered*, not what was merely *offered and declined*).
     - **Non-interactive mode** (no tty, mirrors the "optional guide missing → default no, skip silently" convention documented in `sync-wiki-scaffold.sh`): leave `fileValue` untouched, do **not** record a `declinedHash` (so the next *interactive* run still asks — a non-interactive run shouldn't permanently foreclose the offer on the user's behalf).

Any key present in the user's `graph.json` that isn't part of our template set (e.g. force/layout keys, or something a plugin wrote) is always left completely untouched and never appears in the fingerprint sidecar.

**Implementation shape**: follow this file's existing inline `node -e` JSON-manipulation pattern (see `_enable_obsidian_plugin`, `lib/scripts/install-obsidian.sh:~200-245`) — pass `vault_dir`, the packaged template path, and (for the interactive prompt) read/write via stdin/stdout so the surrounding bash can still drive the actual TTY prompt, OR do the whole per-key loop in one Node invocation using Node's own `readline`/`process.stdin` for the y/n prompt if that's simpler than shelling back out to bash per key — pick whichever keeps the diff smallest given how `_enable_obsidian_plugin` is structured. Preserve the existing `mkdir -p`-fails / `cp`-fails warn-and-return contract (never abort the calling script).

## Steps

### 1. Author the per-key fingerprint/refresh logic <!-- agent: general-purpose -->

- [x] In `lib/scripts/install-obsidian.sh`, rewrite `_install_obsidian_graph_defaults` (currently `lib/scripts/install-obsidian.sh:248-265`) to implement the per-key decision table above instead of the current `[ -f ... ]` whole-file skip check.
  - Keep the existing `mkdir -p "$vault_dir/.obsidian"` guard (warn + return on failure) at the top, unchanged.
  - Add a `_TEMPLATE_KEYS` list (or derive it from `Object.keys()` of the packaged `lib/scripts/templates/obsidian/graph.json`) — do not hardcode a key list that can drift from the actual template file.
  - Read/write `.obsidian/.graph-defaults-fingerprint.json` via Node (`fs.readFileSync`/`writeFileSync`, same style as the existing plugin-enable code), tolerating a missing or malformed sidecar by treating it as `{}` (never crash on a corrupt fingerprint file — warn to stderr and proceed as if no fingerprint existed for any key).
  - Implement cases 1-4 exactly as specified in Approach, including the sticky-decline behavior and the non-interactive no-prompt/no-record behavior. Detect interactivity the same way the rest of this script already does (check how `$INTERACTIVE` / tty detection is threaded into `install-obsidian.sh` today and reuse it — do not invent a second interactivity signal).
  - Update the log messages: report per-key outcomes concisely, e.g. `"  graph.json: colorGroups refreshed, search unchanged, 1 customization kept (centerStrength n/a)."` — keep it to one summary line per invocation rather than one line per key, unless a key was actually asked about (that prompt itself is the per-key line).
  - Write the merged `graph.json` atomically (tmp file + rename, matching the pattern already used in the plugin-enable Node snippet at `lib/scripts/install-obsidian.sh:~241-243`) whenever any key changes; skip the write entirely if nothing changed (avoid bumping mtime for a no-op run).

### 2. Update tests <!-- agent: general-purpose -->

- [x] In `test/install-obsidian.test.js`, replace/extend the existing TASK-061 regression cases (fresh install; existing file left byte-for-byte unchanged) with:
  - Fresh vault (no `graph.json`, no sidecar) → file written with all template keys, sidecar written with `offeredHash` for every key.
  - Existing `graph.json` that exactly matches the current template, **no sidecar present** (simulates an upgrade from before this task) → self-heals silently: sidecar gets created, no prompt, file unchanged (already matched).
  - Existing `graph.json` with one key (e.g. `colorGroups`) hand-edited by the user, sidecar has a matching `offeredHash` for the other keys but none for the edited key → interactive run prompts for that key only; assert `y` applies the new value and clears `declinedHash`, `n` leaves it and sets `declinedHash`.
  - Same diverged-key scenario run again after a decline, template value unchanged → no prompt (sticky decline), file still holds the user's value.
  - A key with a stale `offeredHash` that matches the current file (untouched since last delivery) but whose template value has since changed → silently refreshed to the new template value, no prompt.
  - Non-interactive run against a diverged key → left untouched, no `declinedHash` recorded (so a later interactive run still offers it).
  - A non-templated key the user added (e.g. a custom top-level key, or a `colorGroups` sibling this template never defines) → always preserved untouched and never appears in the sidecar.
- [x] Run the full suite (`npm test`) and confirm it passes before marking this task's implementation complete.

### 3. Docs <!-- agent: general-purpose -->

- [x] Check `lib/scripts/README.md`'s preference-registry row (and any prose elsewhere in that file) describing `obsidian.graphDefaults` / the graph-defaults installer as "write-if-absent, never overwrite" — update it to describe the per-key sticky-refresh behavior instead, matching whatever level of detail nearby rows use (see the `merge-settings-hooks.js` row for the closest existing "template owns its blocks" phrasing style to mirror).
- [x] Update `lib/scripts/templates/bootstrap-prefs-schema.json`'s `obsidian.graphDefaults` entry `detail` field if it also describes the old never-overwrite semantics.

Implementation note (2026-08-21): Step 1 landed as a shared `_graph_defaults_node` helper (new lines ~248-416, replacing the old lines 248-265) — a `node -e` snippet with `plan`/`apply` modes implementing cases 1-4 against the fingerprint sidecar, plus a rewritten `_install_obsidian_graph_defaults` (~418-457) that calls `plan` in interactive mode, prompts per diverged key via the existing `prompt_yn`, then calls `apply`; non-interactive mode calls `apply` directly with empty decisions. `bash -n lib/scripts/install-obsidian.sh` passes. This leaves `test/install-obsidian.test.js`'s old whole-file-skip assertions out of date — expected, addressed by Step 2 below.

Implementation note (2026-08-21): Step 2 replaced the two obsolete TASK-061 whole-file tests with 8 cases covering fresh install (+ sidecar), self-heal on upgrade (no prior sidecar), diverged-key prompt (`y`/`n`), sticky decline, stale-`offeredHash` silent refresh, non-interactive no-record, and non-templated-key preservation. `node --test test/install-obsidian.test.js` → 28/28; full `npm test` → 389/389 passing.

Implementation note (2026-08-21): Step 3 updated `lib/scripts/README.md`'s `obsidian.graphDefaults` preference-registry row (line ~398) and `lib/scripts/templates/bootstrap-prefs-schema.json`'s `obsidian.graphDefaults.detail` field to describe the per-key sticky-refresh behavior instead of the old write-if-absent/never-overwrite semantics; no other stale mentions found. JSON re-validated as parseable after the edit.

Fix during UAT generation (2026-08-21): the Step 3 sub-agent had put the long per-key-refresh description into the README table's "What it does" cell, but `test/scripts-readme-prefs-docs.test.js` cross-checks that column against the schema's short `summary` field (not `detail`) verbatim — this broke `npm test` (388/389). Reverted the README cell to match `summary` exactly ("Install default graph-view styling (`.obsidian/graph.json`)"); the fuller behavior description correctly stays in the schema's `detail` field only. Full suite re-verified green at 389/389.

<!-- Updated: 2026-08-21 HH:MM -->

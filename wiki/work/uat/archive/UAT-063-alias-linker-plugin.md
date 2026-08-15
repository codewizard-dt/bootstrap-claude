---
id: UAT-063
aliases: [UAT-063]
title: "UAT: Bundle the Alias Linker plugin into install-obsidian.sh's plugin bundle"
status: passed
task: TASK-063
created: 2026-08-15
updated: 2026-08-15
---

# UAT-063 — UAT: Bundle the Alias Linker plugin into install-obsidian.sh's plugin bundle

implements::[[TASK-063]]

> **Source task**: [[TASK-063]]
> **Generated**: 2026-08-15

**Scope note.** TASK-063 is a shell-script + JSON-schema + docs + test change — the plugin half of ROADMAP-008 Phase 3: `johannrichard/alias-linker` joins the existing 4-plugin bundle in `lib/scripts/install-obsidian.sh`. There is no HTTP endpoint or browser UI here — every test case below is an **EDGE** case (installer/CLI behavior and static-text-shape assertions), following the same convention as UAT-054/UAT-059/UAT-061 for this same script.

All five "Steps" checkboxes in the task are already marked complete, including "Verify" (`npm test` reported 349/349 passing per the task's own Notes at generation time). This UAT independently re-verified that claim rather than trusting it, found two real coverage gaps, and closed both during generation (see UAT-EDGE-002 and UAT-EDGE-003 below) — full suite now 358/358 (359 counting UAT-EDGE-004's own re-run assertion).

---

## Prerequisites

- [ ] Repo root is `/Users/davidtaylor/Repositories/bootstrap-claude`; all commands run from there
- [ ] Node.js 18+ and `bash` available on `PATH` (the suite runs `node --test`)
- [ ] `lib/scripts/install-obsidian.sh`, `lib/scripts/templates/bootstrap-prefs-schema.json`, and `lib/scripts/README.md` exist at their documented paths
- [ ] `npm test` baseline green before starting

**Safety.** Every installer-level case below runs the real `lib/scripts/install-obsidian.sh` against a scratch `$HOME` and scratch project directory (`fs.mkdtempSync`), with a curated `PATH`/`HOME` env and a stubbed `curl` — no case touches this repo's own `.obsidian/`, the real `~/.claude/bootstrap-prefs.json`, or the live network/GitHub API.

---

## Test Cases

### UAT-EDGE-001: The plugin bundle installs and enables all five plugins (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker) with distinct ids
- **Scenario**: TASK-063 step 1 adds `PLUGIN_ALIAS_LINKER="johannrichard/alias-linker"` as the 5th entry in the `for plugin_repo in ...` loop. This is the flagship end-to-end proof that the constant is actually wired into the loop, not just declared — a stub GitHub Releases API + manifest.json response is served per repo, and the real `_install_obsidian_plugin`/`_enable_obsidian_plugin` functions run unmodified.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it invokes the real, unmodified `install-obsidian.sh --project-dir <scratch>` against a scratch project dir, with a repo-aware `curl` stub serving a distinct release/manifest/main.js per plugin repo (including `johannrichard/alias-linker` → id `alias-linker`).
  3. Confirm the process exits 0, `.obsidian/community-plugins.json` contains exactly 5 distinct ids (one per plugin, including `alias-linker`), and the Front Matter Title manual-toggle note still prints (unaffected by the 5th plugin).
- **Expected Result**: Exit 0; exactly 5 enabled ids, no duplicates, `alias-linker` among them; manual-toggle note present.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: the plugin bundle installs and enables all five plugins (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker) with distinct ids, and prints the Front Matter Title manual-toggle note`) — pre-existing test extended from 4 to 5 plugins as part of TASK-063 step 4, verified passing.
- **Unit Test Command**: `node --test --test-name-pattern="all five plugins \(Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker\) with distinct ids" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-002: PLUGIN_ALIAS_LINKER is wired into the constant, the 5-element loop, and the interactive prompt text
- **Scenario**: **Coverage gap found during this UAT generation.** UAT-EDGE-001 proves the *runtime effect* (alias-linker gets installed/enabled) but takes the non-interactive path, so it never observes the interactive prompt string TASK-063 step 1 required to be updated (`"Install recommended Obsidian plugins (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker) into this project's vault config? [Y/n]: "`). Confirmed by direct experiment that bash's `read -p` never displays its prompt text at all when stdin is a pipe rather than a real terminal — this repo's `BOOTSTRAP_ASSUME_TTY=1` override only flips the script's own branch-selection logic (`has_tty`), it cannot make bash itself echo the `-p` prompt over a piped `stdin`. That makes the prompt string's content structurally unobservable from any spawned-process test in this suite, no matter how the input is simulated. A static source-text check is the only way to pin it. This same check also covers the inline experimental/trust-risk comment TASK-063 step 1 required next to the constant (mirroring `PLUGIN_BREADCRUMBS`'s maintainer-transition comment).
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/scripts/install-obsidian.sh`'s source directly (no installer run needed — pure static-text assertion) and checks: the `PLUGIN_ALIAS_LINKER="johannrichard/alias-linker"` constant is present; the inline comment mentions verifying `johannrichard/alias-linker` is still maintained; the 5-element `for plugin_repo in ...` loop line includes `"$PLUGIN_ALIAS_LINKER"` in the correct position; the interactive prompt string names all five plugins verbatim.
- **Expected Result**: All four substrings/patterns present in the script's current source.
- **Repeatable Unit Test**: Created: `test/install-obsidian.test.js` (test: `install-obsidian.sh: PLUGIN_ALIAS_LINKER is wired into the constant, the 5-plugin loop, and the interactive prompt text (TASK-063)`) — **new test added during this UAT generation** to close the gap described above.
- **Unit Test Command**: `node --test --test-name-pattern="PLUGIN_ALIAS_LINKER is wired into the constant" test/install-obsidian.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-003: `obsidian.plugins` schema summary/detail document Alias Linker's name, missing Dataview dependency, and experimental status
- **Scenario**: **Second coverage gap found during this UAT generation.** TASK-063 step 2 requires specific prose facts in `lib/scripts/templates/bootstrap-prefs-schema.json`'s `obsidian.plugins` entry: the plugin's name in `summary`; "all five recommended community plugins" and "all five plugin folders" in `detail`; a sentence explaining Alias Linker has no Dataview dependency; and its self-described "experimental" upstream status as the reason it stays under the single consent gate. The pre-existing schema shape test (`test/bootstrap-prefs.test.js`, line ~2451) only checks `scope`/`consumer`/`values`/`default`/`askedBy` — it never reads `summary` or `detail` at all, so any of these five prose facts could silently regress with zero test failures.
- **Steps**:
  1. Run the unit test command below.
  2. Confirm it reads `lib/scripts/templates/bootstrap-prefs-schema.json` directly and checks the `obsidian.plugins` entry's exact `summary` string, plus four `detail` substrings/patterns: "all five recommended community plugins", "all five plugin folders", the no-Dataview-dependency sentence, and the "experimental" upstream callout.
- **Expected Result**: `summary` matches exactly; all four `detail` patterns present.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (test: `schema: obsidian.plugins summary/detail document Alias Linker as the 5th bundled plugin, its missing Dataview dependency, and its experimental status (TASK-063)`) — **new test added during this UAT generation** to close the gap described above.
- **Unit Test Command**: `node --test --test-name-pattern="obsidian.plugins summary/detail document Alias Linker" test/bootstrap-prefs.test.js`
- [x] Pass <!-- 2026-08-15 -->

### UAT-EDGE-004: Full suite is green after the two new tests, and `lib/scripts/README.md`'s preferences-registry row names all five plugins
- **Scenario**: TASK-063 step 3 requires the `obsidian.plugins` row in `lib/scripts/README.md`'s preferences registry table to mention all five plugins, mirroring the schema summary. `lib/scripts/README.md` is plain prose with no parser or consumer anywhere in the codebase (unlike the generated `bootstrap-prefs.README.md` companion, which is a different file entirely) — there is no deterministic, hermetic assertion point for its content, so this is verified by direct inspection rather than a unit test. Combined here with the full-suite regression check TASK-063 step 5 requires, now covering the two tests added by UAT-EDGE-002/003.
- **Steps**:
  1. Open `lib/scripts/README.md` and locate the `obsidian.plugins` row in the preferences registry table.
  2. Confirm its description column reads `Install the bundled Obsidian plugin set (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker)`.
  3. Run `npm test` and confirm the full suite passes.
- **Expected Result**: README row names all five plugins; full suite reports 0 failures.
- **Repeatable Unit Test**: Not applicable: `lib/scripts/README.md` prose has no reader/parser in this codebase to assert against — confirmed by inspection during generation (current line 397 reads exactly as expected).
- [x] Pass <!-- 2026-08-15 -->

---

## Gaps

- **None outstanding.** Two genuine coverage gaps were found during generation — the interactive prompt string's content (unobservable via the piped-input TTY simulation this suite otherwise relies on) and the schema's `summary`/`detail` prose facts (untouched by the pre-existing shape-only schema test) — and both were closed immediately with new unit tests (UAT-EDGE-002, UAT-EDGE-003) rather than left as open gaps.
- **No live-Obsidian verification**: no case here installs Alias Linker into a running Obsidian vault and confirms `[[TASK-NNN]]`-style wikilinks actually resolve via its alias fallback — that is explicitly out of scope per the task's own Notes ("verifying Alias Linker's actual link-resolution behavior inside a running Obsidian vault"), matching this repo's established convention for `install-obsidian.sh` UATs (installer mechanics only, not runtime plugin behavior).
- **No GitHub-release-content verification**: no case fetches the real `johannrichard/alias-linker` GitHub release to confirm it currently ships a `manifest.json`/`main.js` pair matching the shared `_install_obsidian_plugin` contract — all cases use a stubbed release response, matching every other plugin in the bundle's existing test coverage (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title are equally untested against the live network).

---

Next steps:
```
To walk through tests interactively:  /uat-walk wiki/work/uat/UAT-063-alias-linker-plugin.md
To run tests headlessly:              /uat-auto wiki/work/uat/UAT-063-alias-linker-plugin.md
```

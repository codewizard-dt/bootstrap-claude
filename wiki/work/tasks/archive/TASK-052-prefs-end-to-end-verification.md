---
id: TASK-052
aliases: [TASK-052]
title: "End-to-end verification of the preference store against a scratch project"
status: done
created: 2026-08-07
updated: 2026-08-07
part_of: ROADMAP-005
depends_on: [TASK-049, TASK-050, TASK-051]
blocks: []
parallel_safe_with: []
uat: "[[UAT-052]]"
tags: [prefs, verification, release, roadmap-005]
---

# TASK-052 — End-to-end verification of the preference store against a scratch project

part_of::[[ROADMAP-005]]

## Objective

ROADMAP-005's four phases were each verified in isolation — Phase 1's helper against its own CLI surface, Phase 2's stickiness against `lib.sh` wrappers, Phase 3's sync pass and skill against scratch homes. Nothing has yet exercised the whole store **as a user meets it**: a real installer run, a re-run that must not re-ask, and the specific value families the roadmap named. This task is the release gate — the last item in Phase 4 and in the roadmap.

Four claims must be demonstrated end to end:

1. **Ask-once across a re-run** — a settled answer is not merely unchanged on the second run, it is never printed.
2. **All three `prefs.gitTracking` answers** — `gitignore`, `exclude`, `neither` — each producing its distinct on-disk outcome.
3. **All three `gitCommit.versionBump` values** — `auto`, `confirm`, `never`.
4. **A non-interactive run writes no preferences file at all.**

This task runs and reports; it does not implement features. Any defect found is filed with `/bug-file`, not fixed inline.

## Approach

### Hermeticity is the hard requirement, not a nicety

Every run happens under a **redirected `HOME`** pointing at a scratch directory, against **scratch projects** created for the run.

> **Do NOT run `./lib/scripts/install-global.sh` against the real `$HOME`.** It rsyncs hooks, installs skills, merges `~/.claude/settings.json` twice, installs the preference helper, and — in step 7 — writes real answers into `~/.claude/bootstrap-prefs.json`. A single unguarded invocation permanently settles the user's own skill preferences, and `unset` is not recoverable by re-running: the whole point of the store is that it stops asking.

Bound the run the way UAT-030/046/048 did:

- `HOME="$SCRATCH/home"` on every invocation, exported per-command rather than for the session.
- SHA-256 the real `~/.claude/settings.json`, this repo's `.gitignore`, and `.git/info/exclude` before and after the whole run; assert byte-identical.
- Assert the real `~/.claude/bootstrap-prefs.json` is **absent before and absent after**. It is absent today; if it exists before the run starts, stop and report rather than proceeding.
- Scratch projects go under the session scratchpad, never `/tmp` directly and never inside this repo.

### The TTY seam is how interactive paths get reached at all

`has_tty()` (`lib/scripts/lib.sh:191-193`) is `[ -t 0 ] || [ "${BOOTSTRAP_ASSUME_TTY:-}" = "1" ]`. Under any harness the child gets a pipe, so `[ -t 0 ]` is false and every prompt body is unreachable. Set `BOOTSTRAP_ASSUME_TTY=1` to drive the interactive cases, and **unset it** for claim 4 — that case is specifically about the real non-interactive path.

Note the seam gates *detection only*: `read` still runs, so supplying no stdin takes the genuine EOF path.

### Known trap — prompt strings are unobservable, so assert on effects

Recorded during UAT-030: `read -r -p` prints its prompt **only when stdin is a terminal**. Driving a script through a pipe means the `[a]uto / [c]onfirm / [n]ever` prompt text never appears on stdout, even with `BOOTSTRAP_ASSUME_TTY=1`. Assert on **what was stored and what changed on disk**, not on prompt text. Where the grammar itself needs checking, assert it against the script source; where behaviour needs checking, assert it at runtime.

This directly shapes claim 1: "was not re-asked" cannot be tested by looking for an absent prompt string. Test it as **the key was never printed in the second run's output and its stored value did not change**, with stdin poisoned so that *any* prompt reached would have been answered differently.

### As of this task's creation, the skill is not live for the user

The user's real `~/.claude/` has no `bootstrap-config/SKILL.md`, no `bootstrap-prefs.js`, and a pre-TASK-030 copy of `uat-generate`. Making them live requires the user's own `./lib/scripts/install-global.sh --skip-mcps` run.

**Recommend it in the final report; do not perform it.** That is the one legitimate real-`HOME` invocation in this whole area, and it is the user's call, not this task's — see the hermeticity rule above.

## Steps

### 1. Preflight and baseline <!-- agent: general-purpose -->

- [x] Confirm TASK-049, TASK-050, and TASK-051 are all complete — this task verifies the state they leave behind. *(all three archived at `status: done`; ROADMAP-005 has them `[x]`)*
- [x] Run `npm test` on the repo as-is and record the total. A red suite before verification starts makes every later result ambiguous. *(baseline: tests 295 / pass 295 / fail 0 / skipped 0)*
- [x] Record SHA-256 of the real `~/.claude/settings.json`, `.gitignore`, and `.git/info/exclude`. *(`cd03d48c…`, `d2be0b6b…`, `014438e1…`)*
- [x] Confirm the real `~/.claude/bootstrap-prefs.json` does **not** exist. If it does, stop and report — do not proceed against a machine that already has settled answers. *(ABSENT; `bootstrap-prefs.js` and `skills/bootstrap-config/` also absent — the user has not run the installer since this work landed)*
- [x] Create the scratch root under the session scratchpad, with `home/` and per-case project dirs. *(`scratchpad/task052/` with `home/`, `claim1/`–`claim4/`)*

### 2. Claim 1 — ask-once across a re-run <!-- agent: general-purpose -->

- [x] Run `bash lib/scripts/install-global.sh --skip-mcps` with `HOME` redirected and `BOOTSTRAP_ASSUME_TTY=1`, answering step 7's skill-preference questions with a **mixed** set: at least one settled value, one `false` (a remembered decline), and one `ask`. `--skip-mcps` keeps the run offline and fast. *(stdin `n,n,a,y,s` → `versionBump=never`, `autoPush=false`, `persistToRaw=ask`, `promoteTests=true`, `offerSectionUpdates` left unanswered as the control)*
- [x] Record the resulting `$HOME/.claude/bootstrap-prefs.json` verbatim and SHA-256 it. *(`bda08cd1f9781b4f385167a81dd28161f068251e1c392c02257cb8bc45888edd`)*
- [x] Re-run the identical command with **stdin poisoned** — every line answering differently from run 1 (e.g. all `y`). This is what makes the claim falsifiable: if a settled key were re-asked, the poisoned stdin would change it. *(stdin `a,y,y,y,y,y,y,y`)*
- [x] Assert for every key settled in run 1: it does not appear in run 2's stdout at all, and its stored value is unchanged. *Unchanged alone is insufficient* — a re-asked question answered identically is still a re-asked question. *(all four keys: 0 occurrences in run 2 stdout; `--list` diff is exactly one line, the control key)*
- [x] Assert the `false` key and the `ask` key both survive: `false` is a remembered decline (not `unset`) and must not be re-asked; `ask` is stored and means "keep prompting", so confirm its documented behaviour holds rather than assuming it matches the others. *(`autoPush=false [global]`, `persistToRaw=ask [global]`; `ask` is settled for the installer and delegates prompting to skill runtime per `lib.sh:526`/`_sticky_lookup`)*
- [x] Run a third time with no unanswered keys and confirm the pass reports that everything is already answered and leaves the store byte-identical. *(`All skill preferences already answered — nothing to ask.`; SHA-256 identical to post-run-2 `3814b9f6…`)*

**Evidence stronger than the plan required.** The control key consumed poison **line 1** (`a` → `ask`), not line 5 (`y` → `true`). Prompts consume stdin in order, so lines 1–4 were consumed by nothing at all — positive proof the four settled keys were never asked, independent of the stdout-absence check. A separate falsifiability control (copied HOME, `--unset gitCommit.autoPush`, identical poison) re-opened the question and the poison did settle it, proving the poison was live and destructive.

### 3. Claim 2 — all three `prefs.gitTracking` answers <!-- agent: general-purpose -->

`prefs.gitTracking` is `scope: project`, `values: gitignore | exclude | neither`, `default: null`, asked by `merge-gitignore.sh`.

- [x] Use **three separate scratch git repos**, one per answer — the outcomes are mutually exclusive on-disk states and cannot share a fixture. *(`case1`/`case2`/`case3`, each with its own redirected HOME)*
- [x] Drive `merge-gitignore.sh` with `BOOTSTRAP_ASSUME_TTY=1` and redirected `HOME`, answering `gitignore` / `exclude` / `neither` respectively. The prompt is a numbered choice; assert each digit resolves to its **name** in the store, not to the digit. *(raw project files read `"prefs.gitTracking": "gitignore" / "exclude" / "neither"` — never a digit)*
- [x] Assert the distinct outcome per answer: the project values file is listed in `.gitignore` / in `.git/info/exclude` / in neither. *(case 1 wrote both governed paths under a `# bootstrap preferences (remembered installer answers)` header into a `.gitignore` that did not previously exist; case 2 wrote them under `# bootstrap preferences (machine-local)` into `.git/info/exclude` and never created a `.gitignore`; case 3 wrote nothing to either)*
- [x] Assert each run stored the expected `prefs.gitTracking` value in the **project** layer (it is `scope: project`; a global write would be inert — see `[[BUG-0009]]`). *(all three at `[project]`; the scratch **global** prefs file was never created in any of the three runs)*
- [x] Confirm this repo's own `.gitignore` and `.git/info/exclude` are untouched — hash-guard around each of the three cases, not only around the whole task. *(six readings — before+after each case — all `d2be0b6b…` / `014438e1…`)*

The two earlier prompt passes were suppressed by pre-seeding `gitignore.offerSectionUpdates=false` and `gitignore.infoExclude=false` at the project layer, leaving the `[1/2/3]` menu as the first and only prompt — so the digit consumed is unambiguous. All three captures contain the three `echo`'d menu lines and **no** `using remembered answer` line, confirming the menu genuinely prompted rather than resolving to a default (`prefs.gitTracking` schema `default` is `null`, verified).

### 4. Claim 3 — all three `gitCommit.versionBump` values <!-- agent: general-purpose -->

`gitCommit.versionBump` is `scope: either`, `consumer: skill`, `values: auto | confirm | never`, `default: "auto"`, settled by `install-global.sh`'s step 7.

- [x] Settle it to each of `auto`, `confirm`, `never` in turn (fresh scratch `HOME` per value) and assert the stored value each time. *(all three settled at layer `[global]`; each store contained ONLY that key, proving the four trailing `s` answers left the others genuinely unanswered)*
- [x] **`confirm` IS this key's ask state** — there is deliberately no separate `ask`. Assert the helper rejects it: `--set gitCommit.versionBump --value ask` must exit 1 and list the legal values. This is the trap the skill and the docs both call out, and it is the one worth proving live. *(`Error: "ask" is not a legal value for gitCommit.versionBump — expected one of: auto, confirm, never`, exit 1, and **no values file was created at all** — the rejection precedes any write; `--value auto` on the same HOME then succeeds)*
- [x] Assert the prompt's letter grammar (`[a]uto / [c]onfirm / [n]ever`) against the **script source**, since the prompt string is unobservable through a pipe (see the trap above), while asserting the resolved value at runtime where it *is* observable. *(`install-global.sh:217` — `prompt_letter_choice skip "    [a]uto / [c]onfirm each time / [n]ever / [s]kip for now: " auto confirm never skip`; the positional list order is what binds a letter to a value, not the menu text)*
- [x] Confirm the stored value is the full word, not the letter typed. *(no `a`/`c`/`n` ever reaches disk; an extra uppercase-`C` case proved case-insensitivity is real rather than assumed — stored `confirm`)*

**`mcp.playwrightConflict` stores names, not digits — confirmed both ways.** Statically, `install-mcps.sh:500` passes the trailing NAME list `shared alongside skip` to `prompt_choice_sticky`, matching the schema's `"shared | alongside | skip"`. At runtime (no network, `install-mcps.sh` not run), `--set mcp.playwrightConflict --value shared` succeeds while `--value 1` is **rejected** with exit 1 — the digit is an input form for the menu only, and the persistence layer refuses it, so a stored value cannot change meaning if the menu is ever reordered.

### 5. Claim 4 — a non-interactive run writes no preferences file <!-- agent: general-purpose -->

- [x] With `HOME` redirected and `BOOTSTRAP_ASSUME_TTY` **unset**, run `bash lib/scripts/install-global.sh --skip-mcps` with stdin closed or from `/dev/null`. *(`env -u BOOTSTRAP_ASSUME_TTY HOME=<scratch> bash … --skip-mcps < /dev/null`; an env probe confirmed the seam was genuinely absent)*
- [x] Assert the run exits 0 and prints the non-interactive notice ("skipping the preference questions; every unanswered key keeps today's behavior" or equivalent). *(exit 0, **stderr 0 bytes**, notice verbatim at stdout line 291)*
- [x] Assert `$HOME/.claude/bootstrap-prefs.json` **does not exist** afterwards. Not "exists and is empty" and not "exists as `{}`" — absence is the entire representation of `unset`, and an empty file is a different state that would suppress nothing but would still be wrong. *(recursive walk of the scratch HOME found zero files named `bootstrap-prefs.json`; the companion `bootstrap-prefs.README.md` is likewise absent)*
- [x] Assert step 6 still ran despite the tty gate: `$HOME/.claude/bootstrap-prefs.js` and `$HOME/.claude/templates/bootstrap-prefs-schema.json` both exist. Step 6 is deliberately **not** tty-gated — a headless run installs the helper while writing no answers — and that split is the thing most likely to be broken by a careless edit. *(both present and **byte-identical** to their repo sources — `978b247a…` and `c18df25e…`)*
- [x] Confirm hooks, skills, and the settings merges all still completed in the headless run. *(20 hook entries; 61 skills including `bootstrap-config/SKILL.md`; `settings.json` with 116 deny entries, 4 hook events, and the `fileSuggestion` key; `file-suggestion.sh` mode 0755)*

The gate is a **whole-pass** gate, not per-key: the entire question block including every `prefs_stored_global` probe sits in the `else` arm, so it is unreached rather than merely unwritten. A second sub-case ran the headless install against an already-settled store and left both `bootstrap-prefs.json` and its generated `bootstrap-prefs.README.md` byte-identical. The `--list` probe was separately proven read-only at runtime: against a fresh empty HOME it created neither the values file nor `~/.claude` itself, while listing all five skill keys as `[default]` — exactly the reading that would make a `prefs_get`-based check ask nothing forever.

### 6. Close the `STEP_BANNERS` coverage gap <!-- agent: general-purpose -->

Folded in from TASK-050's UAT, which flagged it as this task's pickup. `STEP_BANNERS` at `test/install-global.test.js:36-43` still lists **six** banners and its test is still named "all six steps", but `install-global.sh` now runs **eight**. Step 6 prints `Installing preference helper (~/.claude/bootstrap-prefs.js)...` and step 7 prints `Checking skill preferences (~/.claude/bootstrap-prefs.json)...`; neither is in the list. The summary line already advertises `preferences` while nothing verifies those two steps run, or run in the right order.

This is the one place this task edits code rather than only observing it — it closes a **coverage** gap, not a behaviour defect, so it is not a `/bug-file` case.

- [x] Add both missing banners to `STEP_BANNERS` in their real emitted positions (6 and 7, before the MCP banner) and rename the test from "all six steps" to match the real count. *(now eight entries; test renamed to `fresh run executes all eight steps in the TASK-035 order, MCPs last`)*
- [x] Confirm the existing ordering assertion now pins steps 6 and 7 between `fileSuggestion` and `Checking global MCP servers`. *(the strict-increase loop iterates the whole array, so an inversion of 6 and 7 — or either drifting past the MCP banner — now fails the **ordering** assert, not merely the presence assert)*
- [x] Re-run `npm test`; the total must rise or hold with zero new failures and zero new skips. *(295 / 295 / 0 / 0 — held exactly; assertions were added to existing cases rather than new cases)*

The rewritten comment records why steps 6 and 7 are **ordered** rather than merely present-checked: step 6 installs `~/.claude/bootstrap-prefs.js` and the step-7 consent pass reads every stored answer *through* that helper, so an inversion would leave step 7 probing a helper that is not there yet — which degrades to "no key is stored" and re-asks questions the user already answered, while a presence-only check would call that a pass. Two assertions were also added to the `--skip-mcps` case: that flag guards only step 8, so both prefs banners must still print, and the full-run ordering test cannot see a widened guard.

### 7. Report <!-- agent: general-purpose -->

- [x] Verify the closing hermeticity assertions: all three baseline SHA-256s unchanged, real `~/.claude/bootstrap-prefs.json` still absent, no scratch dirs leaked outside the scratchpad. *(3/3 hashes MATCH, checked twice; 5/5 real-HOME prefs artifacts ABSENT; zero scratch residue — the node test harness's own `mkdtempSync` dirs were all reaped by `cleanup()`; `git status --porcelain` shows no unclassified entry and neither `.gitignore` nor `.git/info/exclude`)*
- [x] Report per claim: pass/fail with the evidence that decided it. *(all four claims **PASS** — see the per-step evidence recorded inline above)*
- [x] File any defect found with `/bug-file`. Do not fix inline — this is a verification task, and a fix here would be unverified by construction. *(`[[BUG-0010]]` — two message-only defects in `install-global.sh`: the `ask` confirmation denies its own write (`:200`), and the completion summary claims `MCPs` on every `--skip-mcps` run i.e. every setup and update (`:264`). Filed as one bug per [[BUG-0008]]'s message-only-checklist precedent — same file, same root shape. `[[BUG-0009]]` was re-confirmed in passing and deliberately not chased.)*
- [x] **Recommend, do not run:** tell the user that `/bootstrap-config`, `bootstrap-prefs.js`, and the post-TASK-030 `uat-generate` are not live in their real `~/.claude/` until they run `./lib/scripts/install-global.sh --skip-mcps` themselves. State plainly that this task deliberately did not run it, and why: step 7 would settle their real skill preferences permanently. *(carried into the final report. Confirmed still true at close: all five prefs artifacts absent from the real `~/.claude/`, and the live `uat-generate/SKILL.md` hashes `e5e6e30e…` against the repo's `b1c0b5e1…` — the globally installed skills are stale relative to this repo.)*
- [x] If all four claims pass, note that ROADMAP-005 Phase 4 item 4 of 4 is complete and the roadmap is ready to flip to `status: done` via `/roadmap-next`. *(all four pass; noted.)*

## Outcome

All four claims verified against real captured output under redirected `HOME`, plus the folded-in `STEP_BANNERS` coverage gap closed. `npm test` held at **295 / 295 / 0 / 0** — no new failures, no new skips. Every previously-found trap was re-confirmed closed: `prefs_stored_global` (not `prefs_get`) gates the sync pass; stored `false` and stored `ask` are never re-asked; `gitCommit.autoPush`'s schema default is `false`; `mcp.playwrightConflict` stores names and *rejects* digits at the persistence layer; and `prefs.gitTracking`'s menu genuinely prompts.

Two defects found, both message-only and both filed as `[[BUG-0010]]` rather than fixed — this is a verification task, and a fix here would be unverified by construction.

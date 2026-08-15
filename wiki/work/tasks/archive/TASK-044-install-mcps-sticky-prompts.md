---
id: TASK-044
aliases: [TASK-044]
title: "Wire the install-mcps.sh prompt sites to the preference store"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [TASK-043]
blocks: [TASK-047]
parallel_safe_with: [TASK-045, TASK-046, TASK-031, TASK-039]
uat: "[[UAT-044]]"
tags: [prefs, install, mcp, consent, shell, roadmap-005]
---

# TASK-044 — Wire the install-mcps.sh prompt sites to the preference store

part_of::[[ROADMAP-005]]

## Objective

Route every prompt in `lib/scripts/install-mcps.sh` through the sticky helpers TASK-043 adds, so each MCP question is asked once and its answer remembered. This covers seven prompt sites and eight preference keys — `mcp.serenaMigrate`, `mcp.serena`, `mcp.braveSearch`, `mcp.context7`, `mcp.context7Scope`, `mcp.playwright`, `mcp.playwrightConflict`, `mcp.playwrightReplace` — including the three-way Playwright conflict menu, the single worst offender in the whole roadmap: it re-asks on **every** run even after being answered, because options 1 and 2 both leave a registered `playwright-shared` plus a live project `playwright` and the gating condition cannot tell those end states apart.

## Approach

**The roadmap says "six prompt sites"; there are seven, plus a shared scope prompt.** That count predates the schema. The authority is `bootstrap-prefs-schema.json`: seven keys carry `askedBy: install-mcps.sh`, and `mcp.context7Scope` carries `askedBy: lib.sh` because its question lives in `prompt_scope`. Wire all eight. Do not "fix" the roadmap's number.

**Selector per key comes from the schema's `scope`, and nothing else.**

| Key | Scope | Selector | Site |
|---|---|---|---|
| `mcp.serenaMigrate` | project | `"$PROJECT_DIR"` | `:286` |
| `mcp.serena` | project | `"$PROJECT_DIR"` | `:295` |
| `mcp.braveSearch` | global | `--global` | `:310-311` (via `register_optional_mcp`) |
| `mcp.context7` | global | `--global` | `:313-314` (via `register_optional_mcp`) |
| `mcp.context7Scope` | global | `--global` | `prompt_scope`, called from `register_optional_mcp:95` |
| `mcp.playwright` | global | `--global` | `:371` |
| `mcp.playwrightConflict` | project | `"$PROJECT_DIR"` | `:415` |
| `mcp.playwrightReplace` | project | `"$PROJECT_DIR"` | `:434` |

Every project-scope site is already inside a block that guarantees a non-empty `PROJECT_DIR` (`:281` for the Serena pair, `:402`'s guard for both Playwright conflict paths). Assert that rather than adding a second check — but never pass an empty `PROJECT_DIR` as a selector, which would write `<cwd>/.claude/bootstrap-prefs.json` into whatever directory the installer happened to be run from.

**`mcp.playwrightConflict` stores NAMES, and `:415` reads DIGITS. This is the one hand-off finding that silently breaks.** The schema's grammar is `shared | alongside | skip` — stored by name so a stored answer survives a menu reorder. The existing `case "$choice"` at `:416` branches on `1`, `2`, `*`. Feeding a stored name straight into that comparison falls through **every** branch to `*)` and silently behaves like `skip` — the user's "register it as playwright-shared" answer quietly becomes "do nothing", with no error and no visible difference from a correct run. So the `case` must be rewritten to branch on the **names** (`shared|alongside|skip`), with `prompt_choice_sticky` doing the digit→name resolution at input time. Digits stay an input form only; no digit ever reaches a branch or the store.

Map exactly: `[1]` → `shared` (register `playwright-shared` + disable the project entry machine-locally), `[2]` → `alongside` (register `playwright-shared`, both active), `[3]` → `skip` (touch nothing, and the default).

**No declines-only rule here.** That rule belongs to the three `gitignore.*` keys (TASK-046) and is enforced in the schema data, not at call sites. Every key in this task records in both directions: a remembered `true` installs without re-asking, a remembered `false` stops the offer. That is what each key's `detail` documents.

**Only record an answer that was actually asked interactively.** A non-interactive auto-answer must never be persisted — one CI run would bake in a permanent "no" and there would be no prompt left to change it with. TASK-043 makes this structural inside the helpers, so the rule is honoured by using them and violated only by hand-rolling a `read` next to a `--set`. Do not hand-roll one.

**The non-interactive install path must honour a stored decline, and must ask nothing.** `install-global.sh` runs `install-mcps.sh` **without** `--interactive`, and today that branch installs every missing MCP unprompted (`:100-104`). A user who declined Brave Search during an interactive `setup` should not have it silently installed by the next `bootstrap install`. So in the non-interactive branch, read the key with `prefs_get` directly (never through a prompt helper): a stored `false` skips with a one-line note naming the key; `true`, `ask` and `unset` keep today's behavior exactly. Nothing is ever written on this path.

**`register_optional_mcp` grows two optional parameters, it does not get forked.** It is already the shared wrapper for brave-search and context7 (`:72`). Append `pref_key` as `$6` and `scope_pref_key` as `$7`, both defaulting to empty; empty means "no preference, behave as today", which keeps any future caller working unchanged. bash 3.2, so positional only.

**The `mcp_installed` short-circuit stays first.** Side-effect stickiness (`:74`) is still the cheapest and most accurate signal for "already installed"; preferences only decide what happens when it is *not* installed. Do not reorder these — a preference read that fires before the install check would add a prefs lookup to the common no-op path for no benefit.

**API keys never touch the store.** `_add_brave` (`:111`) and `_add_context7` (`:146`) prompt for `BRAVE_API_KEY` / `CONTEXT7_API_KEY` with a bare `read`. Those stay exactly as they are. No preference key holds a secret and none may be added.

## Steps

### 1. Read the ground truth  <!-- agent: general-purpose -->

- [x] Read `lib/scripts/install-mcps.sh` in full — `register_optional_mcp` (`:72-105`), the Serena block (`:281-305`), the two `register_optional_mcp` calls (`:310-314`), and `_install_playwright_flow` (`:352-441`)
- [x] Read the finished `prompt_yn_sticky` / `prompt_choice_sticky` / `prefs_get` / `has_tty` in `lib/scripts/lib.sh` (TASK-043) — argument order, return protocol, and which of them print to stdout
- [x] Read the eight relevant entries in `lib/scripts/templates/bootstrap-prefs-schema.json`; each `detail` states what `true` and `false` must do, and the implementation must match it rather than the other way round

### 2. Wire the Serena pair  <!-- agent: general-purpose -->

- [x] `:286` — replace `[ "$INTERACTIVE" = true ] && prompt_yn "  serena: found in this project's .mcp.json …"` with the sticky form keyed `mcp.serenaMigrate`, selector `"$PROJECT_DIR"`, keeping the `[ "$INTERACTIVE" = true ] &&` guard and the exact prompt text
- [x] Keep the `else` branch's message verbatim — declining still leaves the `.mcp.json` entry working
- [x] `:295` — replace `prompt_yn "Install Serena MCP …"` with the sticky form keyed `mcp.serena`, selector `"$PROJECT_DIR"`
- [x] Note in a comment that the `serena_installed` check at `:292` still wins: an installed Serena short-circuits before any preference is consulted

### 3. Wire `register_optional_mcp` (brave-search, context7, and the scope prompt)  <!-- agent: general-purpose -->

- [x] Extend the signature to `register_optional_mcp <name> <prompt> <adder> [expected] [fixed_scope] [pref_key] [scope_pref_key]`, with both new params defaulting to empty
- [x] Interactive branch (`:90-99`): when `pref_key` is non-empty use `prompt_yn_sticky "$pref_key" --global "$prompt"`; when empty fall back to `prompt_yn "$prompt"` unchanged
- [x] Scope prompt (`:95`): when `scope_pref_key` is non-empty, pass it and `--global` through to `prompt_scope`; otherwise call `prompt_scope "$name"` exactly as today
- [x] Non-interactive branch (`:100-104`): when `pref_key` is non-empty and `prefs_get` returns `false`, print `  $name: skipped (remembered decline — change with /bootstrap-config)` and return 0 without installing. Every other value keeps today's unconditional install. **Write nothing on this path**
- [x] Update the two call sites: brave-search (`:310`) gains `mcp.braveSearch`; context7 (`:313`) gains `mcp.context7` and `mcp.context7Scope`. Pass `""` for any positional slot in between that the call does not use

### 4. Wire the Playwright fresh-install prompt  <!-- agent: general-purpose -->

- [x] `:371` inside `_install_playwright_flow` — replace `prompt_yn "Install Playwright MCP …"` with the sticky form keyed `mcp.playwright`, selector `--global`
- [x] The non-interactive `else` (`:375-379`) gets the same stored-`false` skip as step 3, read with `prefs_get`, writing nothing
- [x] Leave the rename-back branch (`:360-366`) and the user-scope upgrade branch (`:385-398`) alone — neither prompts, and neither should start

### 5. Wire the Playwright conflict menu — names, not digits  <!-- agent: general-purpose -->

- [x] `:411-427` — keep the three `echo` menu lines exactly as they are (they are the only place the options are explained), then replace the `read -r -p "  How should we proceed? [1/2/3]: " choice || choice=3` with:
  `choice="$(prompt_choice_sticky mcp.playwrightConflict "$PROJECT_DIR" skip "  How should we proceed? [1/2/3]: " shared alongside skip)"`
- [x] Rewrite the `case` to branch on **names**: `shared)` → `_add_playwright user "$PLAYWRIGHT_MCP_ALT_NAME"` + `_disable_project_playwright_locally`; `alongside)` → `_add_playwright user "$PLAYWRIGHT_MCP_ALT_NAME"`; `skip|*)` → the existing `playwright: left untouched.` message
- [x] Add a comment recording why: the store holds `shared|alongside|skip` and the old `case` matched `1`/`2`/`*`, so a stored name fed into the digit comparison would fall through to `*` and silently behave like `skip` — the user's answer discarded with no error. TASK-041's hand-off calls this out explicitly
- [x] Confirm the name order passed to `prompt_choice_sticky` matches the printed menu order — the digit→name resolution is positional, so a mismatch here silently swaps two answers
- [x] Also confirm this is the branch that made the prompt re-ask forever, and say so in the comment: `shared` and `alongside` both leave a registered `playwright-shared` plus a live project `playwright`, which the gating condition at `:368`/`:383` cannot tell apart. **Remembering the answer is the entire fix** — do not attempt to make the gating condition smarter

### 6. Wire the machine-local replace prompt  <!-- agent: general-purpose -->

- [x] `:434` — replace `prompt_yn "  Replace it with the bootstrap shared server …"` with the sticky form keyed `mcp.playwrightReplace`, selector `"$PROJECT_DIR"`, keeping the prompt text (including its `(no = keep it and register ours as '$PLAYWRIGHT_MCP_ALT_NAME')` tail) verbatim
- [x] Leave both branch bodies unchanged

### 7. Adopt the tty seam  <!-- agent: general-purpose -->

- [x] Replace the bare `[ ! -t 0 ]` in the conflict guard at `:402` with `! has_tty` so TASK-047 can drive the conflict flow
- [x] Sweep the file for any other bare `-t 0` test and convert it the same way; leave the `INTERACTIVE` flag logic alone — the seam is about tty detection, not about the flag — swept: the conflict guard was the only one, and the sole remaining `-t 0` in the file is inside the comment explaining the change

### 8. Repair the schema citations this task moves  <!-- agent: general-purpose -->

- [x] After the edits, re-find each of these four prompts and record its new line number: `serena: found in this project's .mcp.json` (`:286` → `:328`), `Install Serena MCP` (`:295` → `:341`), `How should we proceed? [1/2/3]` (`:415` → `:501`), `Replace it with the bootstrap shared server` (`:434` → `:522`)
- [x] Update the `install-mcps.sh:NNN` citations inside `mcp.serenaMigrate.detail`, `mcp.serena.detail`, `mcp.playwrightConflict.detail`, and `mcp.playwrightReplace.detail` in `lib/scripts/templates/bootstrap-prefs-schema.json`
- [x] Update the four matching rows in `CITATION_PINS` (`test/bootstrap-prefs.test.js:~2371`), keeping each pin substring exactly as it is — the pin is what proves the new line number is right
- [x] **Shared-file hazard.** TASK-045 and TASK-046 run concurrently and edit *other* rows of these same two files. Use targeted `Edit` calls on your four rows only, never `Write`, and re-read immediately before each edit. Do not touch a row whose citation names a script this task does not modify
- [x] Run the citation test on its own to confirm: `node --test test/bootstrap-prefs.test.js` — 64 pass / 0 fail / 1 skipped

### 9. Verify  <!-- agent: general-purpose -->

- [x] `bash -n lib/scripts/install-mcps.sh` — passes
- [x] Drive the conflict menu by hand in a scratch project with `BOOTSTRAP_ASSUME_TTY=1`: answer `1`, confirm `<scratch>/.claude/bootstrap-prefs.json` holds `"mcp.playwrightConflict": "shared"` — **the name, not the digit `1`** — and that the `shared` branch actually ran — confirmed: store held `"mcp.playwrightConflict": "shared"`, and both `claude mcp add --scope user playwright-shared` and `playwright: project entry disabled on this machine` fired
- [x] Re-run the same flow and confirm the menu is not re-asked and the `shared` branch runs again from the stored answer. This is the roadmap's headline bug; it is not fixed until this exact re-run is clean — confirmed with **empty stdin**: `mcp.playwrightConflict: using remembered answer (shared)` and an identical `claude mcp add` line
- [x] Confirm a stored `skip` produces the `left untouched` message and no registration — confirmed: `playwright: left untouched.`, zero `mcp add` calls
- [x] Confirm a non-interactive run (no tty, no `BOOTSTRAP_ASSUME_TTY`) creates no preferences file at all — confirmed: neither the global nor the project prefs file existed after the run
- [x] Confirm a stored `mcp.braveSearch: false` suppresses both the interactive prompt and the non-interactive auto-install — confirmed: interactive printed `using remembered answer (no)`; non-interactive printed `brave-search: skipped (remembered decline — change with /bootstrap-config)` with no brave `mcp add`, and the store was left byte-identical
- [x] **Never run this against the real `~/.claude/bootstrap-prefs.json`, and never let a test run register a real MCP** — use a scratch project dir and a redirected `HOME`, and stub `claude` on `PATH` where a registration would otherwise fire — hermetic: redirected `HOME`, scratch git project, stubbed `claude` (logs only), and a stubbed `uname` returning `Linux` so `_add_playwright` took the stdio branch and never ran `npm install -g` or `launchctl`. `~/.claude/bootstrap-prefs.json` still does not exist
- [x] `npm test` green — 209 tests: 208 pass, 0 fail, 1 skipped (baseline unchanged)
- [x] Extra: verified the 8th key `mcp.context7Scope` end to end — accepting context7 and answering `p` stored `"mcp.context7Scope": "project"` and issued `claude mcp add --scope project`; the re-run replayed both from the store. This also proves `prompt_scope`'s remembered-answer notice goes to **stderr** and is not captured as the scope value

## Notes

<!-- Updated: 2026-08-06 -->

**Final wiring — eight keys, seven prompt sites plus the shared scope question.**

| Key | Line | Helper | Selector |
|---|---|---|---|
| `mcp.serenaMigrate` | `install-mcps.sh:328` | `prompt_yn_sticky` | `"$PROJECT_DIR"` |
| `mcp.serena` | `install-mcps.sh:341` | `prompt_yn_sticky` | `"$PROJECT_DIR"` |
| `mcp.braveSearch` | call site `install-mcps.sh:361`, asked at `:110` | `prompt_yn_sticky` via `register_optional_mcp` `$6` | `--global` |
| `mcp.context7` | call site `install-mcps.sh:367`, asked at `:110` | `prompt_yn_sticky` via `register_optional_mcp` `$6` | `--global` |
| `mcp.context7Scope` | call site `install-mcps.sh:367`, asked at `:118` → `lib.sh` `prompt_scope` | `prompt_scope` 3-arg form via `register_optional_mcp` `$7` | `--global` |
| `mcp.playwright` | `install-mcps.sh:426` | `prompt_yn_sticky` | `--global` |
| `mcp.playwrightConflict` | `install-mcps.sh:501` | `prompt_choice_sticky` | `"$PROJECT_DIR"` |
| `mcp.playwrightReplace` | `install-mcps.sh:522` | `prompt_yn_sticky` | `"$PROJECT_DIR"` |

**Gotcha for whoever renumbers citations next.** Serena's `search_for_pattern` reports **0-based** line numbers, but `CITATION_PINS` and the schema `detail` citations are **1-based** (as an editor shows them). Renumbering straight from a Serena search result lands every pin one line early — it failed exactly that way on the first attempt here. Compute the number from the file itself (`split('\n')` index + 1) and let `node --test test/bootstrap-prefs.test.js` confirm it.

**Left deliberately un-skipped:** the `schema -> scripts: every non-dynamic schema key is referenced` test. Its skip comment says to un-skip at ROADMAP-005 Phase 2, but TASK-045 and TASK-046 still have unwired keys, so un-skipping now would fail on theirs. It belongs to whichever task lands last in the phase (TASK-047).
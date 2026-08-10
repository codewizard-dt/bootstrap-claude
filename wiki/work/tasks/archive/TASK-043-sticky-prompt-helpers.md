---
id: TASK-043
title: "Sticky prompt helpers in lib.sh — prompt_yn_sticky, prompt_choice_sticky, BOOTSTRAP_ASSUME_TTY"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
blocks: [TASK-044, TASK-045, TASK-046, TASK-047]
parallel_safe_with: [TASK-031, TASK-039]
uat: "[[UAT-043]]"
tags: [prefs, install, consent, shell, roadmap-005]
---

# TASK-043 — Sticky prompt helpers in lib.sh — prompt_yn_sticky, prompt_choice_sticky, BOOTSTRAP_ASSUME_TTY

part_of::[[ROADMAP-005]]

## Objective

Add the two sticky prompt helpers every other Phase 2 task calls — `prompt_yn_sticky` and `prompt_choice_sticky` — plus the `BOOTSTRAP_ASSUME_TTY` test seam, to `lib/scripts/lib.sh`. They are the single choke point where a stored answer is read (via `bootstrap-prefs.js --get`), a fresh answer is asked (via the existing `prompt_yn` / `read`), and an answer is recorded (via `bootstrap-prefs.js --set`). Putting all three in one place is what makes the load-bearing rule — **only record an answer that was actually asked interactively** — impossible for a call site to get wrong. This task adds no call sites; TASK-044, TASK-045 and TASK-046 supply those.

## Approach

**The helper is the policy, the call site is just data.** Every rule that could be violated lives inside these two functions: the tty check, the "never persist a non-interactive auto-answer" rule, the "remembered" notice, and the choice of layer selector. A call site passes a key, a layer selector, a prompt, and (for choices) a default plus the legal names. It never touches `bootstrap-prefs.js` directly except where a key literal must be computed at run time (`--section-key`, `guides.*`).

**Signature — one selector argument, used for BOTH the read and the write.**

```bash
prompt_yn_sticky     <key> <selector> <prompt>
prompt_choice_sticky <key> <selector> <default-name> <prompt> <name>...
```

`<selector>` is either the literal string `--global` or an absolute project directory. It maps to `--global` or `--project <dir>` on every `bootstrap-prefs.js` call.

Using the same selector on read and write is deliberate. `bootstrap-prefs.js` resolution is already scope-constrained (`bootstrap-prefs.js:348-368`): a `global`-scope key read with `--project <dir>` skips the project file anyway, and a `project`-scope key read with `--project <dir>` never consults the global one. So passing the write layer on the read is always correct for the `global` and `project` scoped keys, which is every key these helpers ask. **The one case it is NOT correct is a `scope: either` key** — there, `--project <dir>` must be used on the read so both layers plus the schema default are consulted. Only one Phase 2 call site reads an `either` key (`gitignore.offerSectionUpdates`, TASK-046) and it reads it directly rather than through these helpers, so no special case is added here. Say so in a comment, or someone will "simplify" the selector away.

**Return protocol, chosen to match what already exists:**

- `prompt_yn_sticky` returns 0 for yes and 1 for no, exactly like `prompt_yn` (`lib.sh:173`), so call sites stay `if prompt_yn_sticky ...; then`.
- `prompt_choice_sticky` **prints the resolved name to stdout** and returns 0, exactly like `prompt_scope` (`lib.sh:194`), so call sites stay `answer="$(prompt_choice_sticky ...)"`. Diagnostics from a stdout-printing function must go to **stderr**, or the "remembered" notice ends up captured as the answer. This is the single easiest thing to get wrong in this task.

**Three states arrive from `--get`, and they are not two.** `--get` prints exactly one line: `true`, `false`, a string value, or the literal word `unset` (never an empty line — `bootstrap-prefs.js:566-570`). The helpers branch on:

| `--get` prints | `prompt_yn_sticky` | `prompt_choice_sticky` |
|---|---|---|
| `true` | return 0, print the remembered notice, do not prompt | n/a |
| `false` | return 1, print the remembered notice, do not prompt | n/a |
| a legal name | n/a | echo it, print the remembered notice, do not prompt |
| `ask` | prompt every run, **record nothing** | prompt every run, **record nothing** |
| `unset` | prompt, then record the answer | prompt, then record the answer |
| anything else | treat as `unset` and warn on stderr | treat as `unset` and warn on stderr |

`ask` and `unset` are not the same state and must not be collapsed: `unset` is an unanswered question the next answer should settle; `ask` is a settled answer whose content is "keep asking, never persist". Collapsing them makes a user's explicit `ask` silently overwritten by their next reply. `test/bootstrap-prefs.test.js` calls this the conflation trap and pins it on the helper side; TASK-047 pins it on this side.

**Only record an answer that was actually asked interactively.** If the tty check fails, the helper returns the non-interactive default (`no` for `prompt_yn_sticky`, `<default-name>` for `prompt_choice_sticky`) and **returns before any `--set`**. One CI run must never bake a `false` into a user's store — an unattended decline that persists is strictly worse than the re-prompting this roadmap exists to remove, because there is no prompt left to change your mind with. The `--set` must be unreachable from the non-interactive branch, not merely skipped by a flag.

**`BOOTSTRAP_ASSUME_TTY` is a tty override, not a prompt bypass.** `spawnSync` gives the child a pipe, so `[ -t 0 ]` is false and no test can drive a prompt today. Add one predicate — `has_tty()` — used by `prompt_yn`, `prompt_scope` and both new helpers, so a test sets `BOOTSTRAP_ASSUME_TTY=1` and pipes an answer on stdin. It must gate only the tty *detection*: `read` still runs, and a test that supplies no stdin still gets the real EOF path.

**Reads must never abort the caller.** Every consumer runs under `set -euo pipefail`. `bootstrap-prefs.js` exits 0 on every read path by design (`bootstrap-prefs.js:15-23`), so no `|| true` is needed — but the command substitution must still be written so a *missing node* or a *missing helper file* degrades to `unset` rather than killing the install. Guard the invocation, do not assume the file is there.

**Locating the helper.** `lib.sh` is sourced with `SCRIPT_DIR` already resolved by the sourcing script, but `SCRIPT_DIR` belongs to the *caller*, not to `lib.sh`, and `install-global.sh` computes it differently (`dirname "$0"`) from the others (`dirname "${BASH_SOURCE[0]}"`). Resolve the helper path from `lib.sh`'s **own** `${BASH_SOURCE[0]}` into a `BOOTSTRAP_PREFS_JS` variable at source time, so a call site's `SCRIPT_DIR` conventions cannot break it.

**bash 3.2 only** (`lib.sh:7-9`): no `local -n`, no associative arrays, no `${var,,}`. `prompt_choice_sticky` takes its legal names as trailing positional arguments and iterates with `shift`.

## Steps

### 1. Read the ground truth  <!-- agent: general-purpose -->

- [x] Read `lib/scripts/lib.sh` in full — specifically `prompt_yn` (`:173-186`) and `prompt_scope` (`:194-206`), and the bash 3.2 constraint banner at `:7-9`
- [x] Read `lib/scripts/bootstrap-prefs.js` header comment (`:1-51`) for the CLI surface and the exit-code contract; note that `--get` prints the literal word `unset` and that `--set`/`--unset` require exactly one layer selector
- [x] Read the schema at `lib/scripts/templates/bootstrap-prefs-schema.json` — every key's `scope` decides which selector its call site must pass

**Findings (ground truth for steps 2-7):**
- `lib.sh` is 206 lines total; `prompt_scope` ends at `:206` = EOF. `[ -t 0 ]` appears at `:176` (`prompt_yn`) and `:197` (`prompt_scope`) — those two only.
- `lib.sh` has NO shebang (line 1 is `# shellcheck shell=bash`), sets NO shell options, and declares NO globals — every var is `local`. A new global must be namespaced.
- `prompt_yn` prints its non-interactive note to **stdout** (`echo "  Non-interactive terminal: skipping prompt, answering no."`). `prompt_scope` prints NO non-interactive note (silently `reply="u"`).
- `bootstrap-prefs.js` `resolve()` (`:354-380`): for a `scope: project` key, a `--get` with NO `--project <dir>` consults **no file at all** → always `unset`. The selector is mandatory on reads too.
- `--set`/`--unset` require **exactly one** layer selector (0 → exit 1, ≥2 → exit 1). `--value unset`/`--value null` and any value outside the key's grammar → exit 1.
- `--get` never creates `.claude/` or the values file (`readLayer` guards on `fs.existsSync`).
- `CITATION_PINS` row is `test/bootstrap-prefs.test.js:2385` — `'lib.sh:198': 'Scope for $name'`, asserted against `lines[n-1]`.

### 2. Add the tty seam  <!-- agent: general-purpose -->

- [x] Add `has_tty()` to `lib/scripts/lib.sh`: returns 0 when `[ -t 0 ]` OR `[ "${BOOTSTRAP_ASSUME_TTY:-}" = "1" ]`
  - Comment why it exists: `spawnSync` hands the child a pipe, so without this seam no test can reach any prompt body
- [x] Replace the `[ -t 0 ]` test in `prompt_yn` (`:176`) with `has_tty`
- [x] Replace the `[ -t 0 ]` test in `prompt_scope` (`:197`) with `has_tty`
- [x] Do NOT change either function's existing answers, prompt text, or return values — TASK-047 and the existing suite both assert on today's behavior

**Done:** `has_tty()` added at `lib.sh:167-180` (banner 167-177, body 178-180), immediately above the `prompt_yn` banner. `prompt_yn:191` and `prompt_scope:212` now call `has_tty`. `bash -n` clean; predicate returns NOTTY bare / TTY under `BOOTSTRAP_ASSUME_TTY=1`. lib.sh 206 → 221 lines; the `Scope for $name` prompt moved 198 → 213 (step 7 repairs the citation).

### 3. Add `BOOTSTRAP_PREFS_JS` and the two thin wrappers  <!-- agent: general-purpose -->

- [x] Near the top of `lib/scripts/lib.sh`, resolve the helper from `lib.sh`'s own location:
  `BOOTSTRAP_PREFS_JS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bootstrap-prefs.js"`
  - Comment: `SCRIPT_DIR` belongs to the sourcing script and is computed two different ways across the callers; this must not depend on it
- [x] Add `_prefs_selector_args <selector>` — prints `--global` for the literal `--global`, else `--project <selector>`. Used by both the read and the write so the two can never diverge
- [x] Add `prefs_get <key> <selector>` — prints the resolved value, or `unset`
  - If `BOOTSTRAP_PREFS_JS` is not a file, or `node` is not on `PATH`, print `unset` and return 0 (a partial install must not break an installer run)
  - Capture stdout only; let the helper's own stderr warnings through
- [x] Add `prefs_set <key> <selector> <value>` — runs `--set <key> --value <value>` with the selector args
  - `bootstrap-prefs.js` exits 1 on an illegal value (a bug in the calling script). Do NOT swallow it silently: print the helper's stderr, and do not let the non-zero status abort the installer under `set -euo pipefail` (guard the call). A typo'd value must be visible in the log, not fatal to the user's setup

**Done:** `BOOTSTRAP_PREFS_JS` at `lib.sh:11-23`; `_prefs_selector_args` `:237-258`; `prefs_get` `:260-286`; `prefs_set` `:288-317`. lib.sh 221 → 317 lines; the `Scope for $name` prompt moved 213 → **227**. `prefs_set` suppresses the helper's success line (`<layer>: <key> = <value>`) with `>/dev/null` — the sticky helpers print their own notice — but leaves stderr visible. Smoke-tested under a redirected `HOME` in a `mktemp -d`: an illegal `--value` surfaced `Error: "bogusvalue" is not a legal value for mcp.serena` plus the wrapper warning, did NOT abort the `set -euo pipefail` shell, and left the prior value intact; `prefs_get` created no store file; a missing `BOOTSTRAP_PREFS_JS` degraded to `unset` / return 0.

### 4. Implement `prompt_yn_sticky`  <!-- agent: general-purpose -->

- [x] `prompt_yn_sticky <key> <selector> <prompt>`, placed immediately after `prompt_yn` so the pair reads as one unit
- [x] Read the stored value with `prefs_get`. Branch:
  - `true` → print `  <key>: using remembered answer (yes) — change with /bootstrap-config` and `return 0`
  - `false` → print `  <key>: using remembered answer (no) — change with /bootstrap-config` and `return 1`
  - `ask` → fall through to the prompt, and set an internal flag so **nothing is recorded** afterwards
  - `unset` → fall through to the prompt, recording enabled
  - anything else → warn on stderr naming the key and the value, then treat as `unset`
- [x] If `has_tty` is false: print the existing non-interactive note, `return 1` (no), and **record nothing** — the `--set` must be unreachable on this path
- [x] Otherwise delegate to `prompt_yn "$prompt"`, capture its status, and when recording is enabled call `prefs_set <key> <selector> true|false` before returning that same status
- [x] Comment the load-bearing rule verbatim above the function: only an answer that was actually asked interactively is ever recorded; one CI run must not bake in a permanent `no`

**Done:** `prompt_yn_sticky` at `lib.sh:217-305` (banner 217-250, body 251-305), immediately after `prompt_yn`. lib.sh 317 → 408 lines; the `Scope for $name` prompt moved 227 → **317**. All seven smoke cases verified under a redirected `HOME`: (a) unset+`y` → 0 and records `true`; (b) re-run → remembered notice, no prompt; (c) `--unset` → prompts again; (d) `n` → 1 and records `false`; (e) **non-interactive on a fresh project → returns 1 and `<proj>/.claude` was never created** (the `return 1` makes `prefs_set` unreachable, and the note prints exactly once because the sticky `has_tty` check fires before delegating); (f) stored `ask` → prompts, returns the live answer, store byte-identical; (g) stored garbage → stderr warning, behaves as `unset`.

### 5. Implement `prompt_choice_sticky`  <!-- agent: general-purpose -->

- [x] `prompt_choice_sticky <key> <selector> <default-name> <prompt> <name>...`, placed after `prompt_scope`
- [x] **All diagnostics go to stderr.** This function's stdout IS its return value; a remembered-answer notice on stdout would be captured by the caller as the answer
- [x] Read the stored value with `prefs_get`. If it exactly matches one of the trailing `<name>` arguments, echo it, note the remembered answer on stderr, and return 0. `ask` → prompt without recording. `unset` → prompt and record. A stored value matching no name → warn on stderr and treat as `unset` (the menu was reordered or the schema changed under a stored answer)
- [x] If `has_tty` is false: echo `<default-name>`, note it on stderr, record nothing, return 0
- [x] Otherwise `read -r -p "$prompt" reply` and resolve the reply to a name:
  - a digit `N` → the Nth `<name>` (1-based, in the order given) — menus are printed as `[1]/[2]/[3]` and users type digits
  - an exact `<name>` match → that name
  - empty, EOF, or anything else → `<default-name>`
- [x] Record the resolved name with `prefs_set` when recording is enabled, then echo it
- [x] Comment why values are **names not digits**: `mcp.playwrightConflict` stores `shared | alongside | skip` so a stored answer survives a menu reorder. The digit is an input form, never a stored value

**Done:** `prompt_choice_sticky` at `lib.sh:328-450` (body 368-450), between `prompt_scope` and `_prefs_selector_args` — so the `Scope for $name` line did NOT move. lib.sh 408 → 532 lines. 16/16 assertions passed under a redirected `HOME`: (a) piped `2` → stdout exactly `alongside`, store `alongside`; (b) re-run → stdout byte-for-byte `alongside\n`, remembered notice on **stderr only**, no prompt; (c) exact name reply honoured; (d) EOF under `ASSUME_TTY=1` → default `skip`, **and it IS recorded** — `has_tty` was true, so this was a real interactive ask that hit EOF, which is what the checkbox asks for; (e) **non-interactive → stdout exactly `skip` and `<proj>/.claude` never created** (recursive listing shows only `.`/`..`); (f) stored `ask` → stdout `shared`, store still byte-identical `{"mcp.playwrightConflict":"ask"}`; (g) unrecognized stored value → stderr warning, genuinely re-asks (re-run with a discriminating reply proved the reply wins); (h) out-of-range digit `9` → default.
  - Bonus for step 6: `for name in "$@"` with zero trailing names does not trip `set -u` on bash 3.2 — an empty name list degrades to the default rather than crashing.

### 6. Make `prompt_scope` sticky, without moving its prompt  <!-- agent: general-purpose -->

- [x] Extend to `prompt_scope <name> [<pref-key> <selector>]`. With no extra args, behave exactly as today (no prefs call at all — `bootstrap-serena.sh` and any other caller must be unaffected)
- [x] With a key and selector, run the same stored/ask/unset logic as `prompt_choice_sticky` around the existing question, with legal names `user project` and default `user`
- [x] **Keep the prompt text `  Scope for $name — [u]ser (default) or [p]roject? ` on one line and keep its two-answer semantics** (anything not starting with `p`/`P` is `user`). `bootstrap-prefs-schema.json`'s `mcp.context7Scope.detail` describes exactly this behavior and `test/bootstrap-prefs.test.js` pins the substring `Scope for $name` to the cited line
- [x] Reuse `prompt_choice_sticky` internally if it comes out clean; do not duplicate the stored/ask/unset ladder a third time

**Done, with a documented design departure.** Reuse was done by extracting the ladder, NOT by calling `prompt_choice_sticky` — because the two resolvers genuinely differ. `prompt_choice_sticky` matches by digit index or exact name; `prompt_scope` matches by first letter (`[pP]*`). Routing `prompt_scope` through `prompt_choice_sticky` would silently regress `p` → `user` and `pineapple` → `user`, and the schema's own prose at `bootstrap-prefs-schema.json:106` publishes the first-letter rule as the contract ("any reply that does not begin with p or P falls through to user"). So the stored/ask/unset ladder was factored into a new `_sticky_lookup <key> <selector> <name>...` (prints `hit:<name>` | `ask` | `unset`, owns the remembered notice and the unrecognized-value warning, both on stderr) and each resolver kept. The ladder now lives in exactly two places, not three — `prompt_yn_sticky` keeps its own because its grammar is `true`/`false`, not a name list, and its notice goes to stdout since it returns via exit status. Rationale recorded in the `prompt_scope` banner under `WHY THIS DOES NOT SIMPLY CALL prompt_choice_sticky`.
  - Line ranges: `prompt_scope` **308-398** (banner 308-346, body 347-398, was 308-326); `prompt_choice_sticky` **440-516** (locals/ladder 440-465 rewritten to delegate); new `_sticky_lookup` **517-575**. lib.sh 532 → 657 lines.
  - The prompt line is now `lib.sh:387` and gained a trailing `|| reply=""` — additive only; the prompt text, two leading spaces, em dash and trailing space are byte-identical and the pinned substring `Scope for $name` is intact. The guard exists so an EOF cannot abort a consumer under `set -euo pipefail` (today's code would).
  - 63/63 hermetic assertions pass. Zero-prefs-call proof used a **spy shim**: `BOOTSTRAP_PREFS_JS` pointed at a fake that logs its argv — across replies `p P project u '' garbage EOF` the log stayed empty and `$HOME/.claude` was never created. Resolver parity confirmed (`p`/`P`/`project`/`pineapple` → `project`; `u`/empty/`garbage`/EOF → `user`), including on the sticky path. Non-interactive with key+selector → `user` and no store file. Round-trip: interactive `p` records `project`, next run prints the notice on stderr with stdout exactly `project`. Prompt rendered under a real pty (via `script`) on one line as `  Scope for context7 — [u]ser (default) or [p]roject? `. `BOOTSTRAP_ASSUME_TTY=0` leaves `p` unconsumed on stdin, proving `read` never ran.
  - API detail for TASK-044/045: stickiness engages only when **both** `<pref-key>` and `<selector>` are non-empty; a key with no selector warns on stderr, answers normally, and makes no prefs call. `install-mcps.sh:94`'s existing `prompt_scope "$name"` is unaffected.

### 7. Repair the schema citation this task moves  <!-- agent: general-purpose -->

- [x] Adding functions above `prompt_scope` shifts its line number. Find the new line of the `Scope for $name` prompt in `lib/scripts/lib.sh`
- [x] Update the `lib.sh:198` citation inside `mcp.context7Scope.detail` in `lib/scripts/templates/bootstrap-prefs-schema.json` to the new line number
- [x] Update the matching `'lib.sh:198'` row in `CITATION_PINS` (`test/bootstrap-prefs.test.js:~2371`) to the new key, keeping the pin substring `Scope for $name`
- [x] Use targeted `Edit`s on those two rows only. TASK-044/045/046 run concurrently and edit **other** rows of these same two files — never rewrite either file wholesale, and re-read immediately before editing

**Done:** new 1-based line is **387**, confirmed by a native `Read` (which prints 1-based) cross-checked against Serena's 0-based 386; exactly one occurrence of `Scope for $name` in the file. Two single targeted `Edit`s: `bootstrap-prefs-schema.json:107` `lib.sh:198` → `lib.sh:387` inside `mcp.context7Scope.detail`, and `test/bootstrap-prefs.test.js:2385` key `'lib.sh:198'` → `'lib.sh:387'` with the pin value `'Scope for $name'` unchanged. `node --test test/bootstrap-prefs.test.js` → 65 tests, 64 pass, 0 fail, 1 skipped (the pre-existing TASK-042 bijection skip); the citation test passes. No other citation is stale.

### 8. Verify  <!-- agent: general-purpose -->

- [x] `bash -n lib/scripts/lib.sh`
- [x] Source `lib.sh` in a throwaway `bash` and exercise both helpers against a scratch project dir (`mktemp -d`) with `BOOTSTRAP_ASSUME_TTY=1` and a piped answer: unset → prompts and records; re-run → prints the remembered notice and does not prompt; `--unset` the key → prompts again
- [x] Confirm the non-interactive path (no `BOOTSTRAP_ASSUME_TTY`, no tty) answers no / the default AND leaves `<scratch>/.claude/bootstrap-prefs.json` non-existent
- [x] Confirm `prompt_choice_sticky` output captured with `$( )` contains ONLY the resolved name — no notice text, no prompt echo
- [x] Confirm a stored `ask` prompts and writes nothing
- [x] **Never run any of this against the real `~/.claude/bootstrap-prefs.json`** — always a scratch project dir, or a redirected `HOME`
- [x] `npm test` green — this task adds no test (TASK-047 does), but the schema-citation test above will fail if step 7 was skipped

**Done — independent re-verification, 47/47 assertions pass, no code changes needed.** One consolidated hermetic script (single `mktemp -d`, `HOME` redirected into it, a FRESH project subdir per case, `set -euo pipefail` in the shell that sources `lib.sh`) covered: A round trip on `mcp.serena` (unset+`y` → 0 and stores `true`; re-run → stdout is exactly the remembered-(yes) notice with **empty stderr**, which is what proves no `read -r -p` fired, verified both with and without the tty seam; `--unset` → asks again; `n` → 1 and stores `false`; re-run → remembered-(no)). B non-interactive → status 1, note on stdout, and a recursive bash-glob listing of the project dir came back **completely empty** — no `.claude/`, no values file. C stored `ask` → prompts, live answer wins, values file byte-identical by `cmp`, and no companion README generated. D `prompt_choice_sticky` stdout purity captured with plain `$( )` and **stderr deliberately unredirected**: `alongside` both fresh and remembered, `od -c` shows exactly 9 bytes `a l o n g s i d e` with no trailing newline in the capture, and the remembered notice appeared on the terminal (stderr) rather than in the capture; non-interactive → `skip`, note on stderr, no store. E `prompt_scope`: bare form gave `project project project user user user user` for `p P project u '' garbage EOF` with the argv-logging spy shim's log **empty** and `$HOME/.claude` never created; sticky `--global` form stored and replayed `project` with the notice on stderr only; non-interactive → `user`, no file. F the real `~/.claude/bootstrap-prefs.json` was `absent` before and after (checked by `stat` metadata only, never read).
  - `bash -n lib/scripts/lib.sh` → exit 0. `bash -n` on all 15 shell scripts under `lib/scripts/` (every lib.sh consumer plus `templates/file-suggestion.sh`) → exit 0 each.
  - `npm test` → `tests 209 / suites 0 / pass 208 / fail 0 / cancelled 0 / skipped 1 / todo 0 / duration_ms 27759.9`. Exactly the expected baseline; the one skip is the pre-existing TASK-042 bijection skip.

## Notes

<!-- Updated: 2026-08-06 20:40 -->

**Implementation complete — all 8 steps `[x]`, `npm test` at baseline (209 tests / 208 pass / 0 fail / 1 skipped).** Nothing was committed.

**Final shape of `lib/scripts/lib.sh` (206 → 657 lines):**

| Symbol | Lines | Signature |
|---|---|---|
| `BOOTSTRAP_PREFS_JS` | 11-23 | global, resolved from lib.sh's own `${BASH_SOURCE[0]}` |
| `has_tty` | 167-180 | `has_tty` |
| `prompt_yn_sticky` | 217-305 | `prompt_yn_sticky <key> <selector> <prompt>` → returns 0 yes / 1 no |
| `prompt_scope` | 308-398 | `prompt_scope <name> [<pref-key> <selector>]` → prints `user`\|`project` |
| `prompt_choice_sticky` | 440-516 | `prompt_choice_sticky <key> <selector> <default-name> <prompt> <name>...` → prints the resolved name |
| `_sticky_lookup` | 517-575 | `_sticky_lookup <key> <selector> <name>...` → prints `hit:<name>`\|`ask`\|`unset` |
| `_prefs_selector_args` | 578-597 | `_prefs_selector_args <selector>` → `--global` or `--project <dir>` |
| `prefs_get` | 600-626 | `prefs_get <key> <selector>` → value or `unset` |
| `prefs_set` | 628-657 | `prefs_set <key> <selector> <value>` |

**Departure from the task file (one, deliberate):** step 6 said "Reuse `prompt_choice_sticky` internally if it comes out clean". It did not come out clean — `prompt_choice_sticky` resolves by digit index or exact name, `prompt_scope` resolves by first letter (`[pP]*`), and routing one through the other would have regressed `p` → `user` and `pineapple` → `user`, contradicting the schema's own published prose at `bootstrap-prefs-schema.json:106`. The ladder was extracted into `_sticky_lookup` instead, honouring the checkbox's actual intent ("do not duplicate the stored/ask/unset ladder a third time"). It now lives in two places, not three: `prompt_yn_sticky` keeps its own because its grammar is `true`/`false` rather than a name list, and its notice goes to stdout since it returns via exit status.

**Also additive, worth knowing:** the `Scope for $name` prompt line gained a trailing `|| reply=""` so an EOF cannot abort a consumer under `set -euo pipefail` (today's code would). Prompt text is byte-identical; the pinned substring is intact.

**Known asymmetry, intentional and documented in `_sticky_lookup`'s banner:** `prompt_yn_sticky`'s remembered notice goes to **stdout**; `prompt_scope`'s and `prompt_choice_sticky`'s go to **stderr**. The two stdout-printing functions must keep their stdout clean because it IS their return value; `prompt_yn_sticky` returns via exit status, so its stdout is free. A future call site that captured `prompt_yn_sticky` with `$( )` would pick up the notice — no such call site exists, and the contract is `if prompt_yn_sticky ...; then`.

**For TASK-044/045/046:** stickiness on `prompt_scope` engages only when **both** `<pref-key>` and `<selector>` are non-empty; a key with no selector warns on stderr, answers normally, and makes zero prefs calls. `install-mcps.sh:94`'s bare `prompt_scope "$name"` is provably unaffected (verified with an argv-logging spy shim).

**For TASK-047:** the `BOOTSTRAP_ASSUME_TTY=1` seam plus a piped answer is what makes every prompt body reachable from `spawnSync`. `prompt_choice_sticky`'s stdout under `$( )` is exactly the resolved name with no trailing newline. The citation `lib.sh:387` will move again if anything is inserted above it.

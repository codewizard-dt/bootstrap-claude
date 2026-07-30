---
id: TASK-028
title: "Rework interpreter-indirection-guard from blanket deny to recursive re-evaluation"
status: pending-uat
created: 2026-07-29
updated: 2026-07-29
depends_on: [TASK-027]
blocks: []
parallel_safe_with: [TASK-025]
uat: "[[UAT-028]]"
tags: [security, hooks, permissions]
---

# TASK-028 — Rework interpreter-indirection-guard: recursive re-evaluation instead of blanket deny

## Objective

Replace `lib/hooks/interpreter-indirection-guard.js`'s outright deny of every `bash -c` / `node -e` / `python3 -c` invocation with **recursive re-evaluation**: extract the inline payload, unquote one level, and evaluate it as if it were a standalone Bash command against the other command-class guards. Block only if the payload would have been blocked when typed directly. The rule becomes *"you may not use `bash -c` to do something you couldn't do without it."*

## Approach

**Why the current blanket deny is not justified — the argument that overturns it.** The deny message names an escape hatch: *write the script to a file and run the file*. That escape hatch is also the hook's **complete bypass** — `printf '…' > /tmp/x.sh && bash /tmp/x.sh` runs the identical program and never touches this guard. So the hook was never an adversarial control and cannot become one. It is a guardrail against a careless one-liner.

That reframing dissolves the objection recorded in TASK-027 step 2, which rejected payload inspection on the grounds that `bash -c 'c=cur;l=l;$c$l http://x'` defeats it. True — but obfuscation only matters against an adversary, and against an adversary the whole hook already fails via its own documented escape hatch. Blanket deny therefore buys nothing extra against the threat it cannot stop, while charging real friction against the mistake it actually catches (`node -e`, `python3 -c` one-liners are routine and were made unavailable).

**Why re-evaluation rather than a substring blocklist.** A fixed danger list (`.env`, `~/.zshrc`, `rm -rf`, …) is a *second* matching vocabulary that will drift out of sync with the guards it duplicates. Re-evaluating the payload through the existing guards is exactly as strong as the direct-command path by construction, needs no new vocabulary, has near-zero false positives (anything permitted directly is permitted inside `-c`), and fails only where the direct guards already fail — a consistency, not a new hole.

**Mechanism: spawn the sibling guards as subprocesses, do NOT refactor them.** The interpreter guard synthesizes a PreToolUse payload for the extracted script (`{"tool_name":"Bash","tool_input":{"command":"<payload>"},"cwd":"<cwd>"}`) and pipes it to each sibling guard, treating any `permissionDecision: "deny"` as a deny. This is deliberately chosen over extracting each guard's logic into shared pure functions: those four guards are **shipped, globally installed controls**, and TASK-027 step 7 established the principle that a working control should not be migrated onto newer code to save a few lines. Subprocess re-evaluation requires zero changes to them, uses them exactly as Claude Code does, and stays in sync automatically. Cost is ~4 short-lived spawns, and only on a segment that actually contains an interpreter plus an eval flag. The pure-function extraction is the better *eventual* refactor — note it as a follow-up, do not do it here.

## Steps

### 1. Extract and unquote the inline payload  <!-- agent: general-purpose -->

- [x] Read `lib/hooks/interpreter-indirection-guard.js` in full (Serena — it is code), plus `lib/hooks/lib/command-parse.js`
- [x] Add payload extraction: for a matched interpreter + eval flag, capture the script argument in all the spellings the guard already recognizes — spaced (`bash -c 'cmd'`), fused (`-c'cmd'`), and `--eval=code`
  - Strip **one** layer of surrounding quotes (`'…'` or `"…"`) — the shell already consumed it, so `tool_input.command` carries it literally
  - If no payload can be isolated (e.g. the flag is last, or the argument is unbalanced), **fall back to deny** with the current message — an unparseable payload is not an allowed payload
- [x] Keep the existing **command-substitution rule as an unconditional deny**: `bash -c "$(curl x)"` and the backtick form stay blocked with no re-evaluation. The program does not exist until runtime, so there is genuinely nothing to inspect. Say so in the deny reason

<!-- Updated: 2026-07-29 -->
> **Step 1 done.** Extraction added to `interpreter-indirection-guard.js` (+112). `lib/command-parse.js` deliberately **unmodified** — `test/command-class-hooks.test.js:768` pins its export surface to exactly `['deny','readHookInput','splitSegments','tokenize']`, so adding to it breaks that assertion.
> - New: `segmentsWithOffsets` / `tokensWithOffsets` (offset-preserving counterparts, same boundaries via a capturing split), `findClosingQuote` (single quotes take no escapes; `\"` does not close a double), `extractPayload → {interpreter, flag, payload, quote} | null`.
> - **This task's brief was wrong about reconstruction, and the agent corrected it.** I said rebuild from the raw *segment*; that still truncates, because `splitSegments` cuts on `;`/`|` with no regard for quoting — `bash -c 'echo a; echo b'` is already severed *before* tokenizing, so the segment itself holds only `bash -c 'echo a`. Extraction therefore carries the flag token's absolute offset into the **full command string** and quote-balances there, crossing segment boundaries. Detection stays segment-scoped (semantics unchanged).
> - **Latent bug found and fixed:** `matchedEvalFlag` used `.find(f => token.startsWith(f))` against `['-e','--eval']`, so `--eval=1` matched `-e` and set the payload boundary mid-flag (`val=1`). Now takes the **longest** matching prefix. Detection unaffected; only the flag string in the deny message changes for `--eval` forms.
> - Three spellings handled off `flagStart + flag.length`: `=` → skip one (`--eval=code`); whitespace run → spaced (`-c 'cmd'`); already-a-quote → fused (`-c'cmd'`). Unquoted payloads (`sh -c ls`) take the non-whitespace run.
> - Unparseable → `null` → falls through to the existing blanket deny: flag-is-last (`bash -c`), unbalanced quote (`bash -c 'oops`), glued concatenation (`bash -c 'echo '"$X"`, where the program is not the quoted span alone).
> - Command substitution denies **before** anything else, with a dedicated reason and no re-evaluation path.
> - **Seam for step 2:** a local named `inline` at the deny point carries `{interpreter, flag, payload, quote}`. Blanket-deny behavior fully intact — everything that denied before still denies.
> - **Honest limitation:** payload *contents* are currently unobservable from outside (both branches deny), so the suite proves no-regression, not extraction correctness. That becomes observable in step 2 and is what step 4's must-allow/must-deny table actually pins. Spellings were verified by walking the code, not by execution.
> - Gates: `node --check` clean, `npm test` 77/77.

### 2. Re-evaluate the payload through the sibling guards  <!-- agent: general-purpose -->

- [x] Synthesize a PreToolUse payload for the extracted script: `{"tool_name":"Bash","tool_input":{"command":"<payload>"},"cwd":"<original cwd>"}`. Carry `cwd` through from the original call — `protected-write-guard.js` resolves relative redirect targets against it, so dropping it would silently weaken that check
- [x] Pipe it synchronously (`child_process.spawnSync`, `input:` option) to each sibling guard resolved **relative to this script's own directory** (`__dirname`), so it works both in the repo and in `~/.claude/hooks/`:
  - `absolute-path-guard.js`
  - `protected-write-guard.js`
  - `env-content-read-guard.js`
  - `package-install-consent.js`
  - `git-protected-ops-block.js`
- [x] Treat a sibling's `permissionDecision: "deny"` on stdout as a deny; surface **that guard's own reason** rather than a generic one, prefixed to make the nesting clear (e.g. ``Blocked inside `bash -c` — <sibling's reason>``). The user should learn what was actually wrong, not just that something was
- [x] **Recursion cap:** if the extracted payload itself contains an interpreter + eval flag, allow one further level, then deny. `bash -c "bash -c '…'"` is legitimate almost never and is a plausible evasion shape. Implement the cap by depth counter, not by refusing to nest at all
- [x] **Fail closed on subprocess trouble** — a spawn that errors, times out, or returns a non-zero exit *with* deny output must be treated as a deny, not an allow. A guard that silently degrades to permissive under load is worse than one that occasionally over-blocks. Set a short timeout (~2s) so a wedged sibling cannot hang the tool call

<!-- Updated: 2026-07-29 -->
> **Step 2 done — the hook now allows-unless-blocked.** Two temporary states, both expected, both closed by later steps:
> - 🔴 **`bash -c 'rm -rf ~'` is ALLOWED right now** (confirmed by execution). No *sibling* denies bare `rm -rf ~` — `absolute-path-guard` fires on evasive *spelling*, so `/bin/rm` denies and plain `rm` is left to the deny list. **Step 3 closes this.** Until then the hook is weaker than blanket deny for deny-list-only commands.
> - 🔴 **`npm test` is 74/77** — 3 interpreter cases still pin the blanket deny this task removes. **Step 4 owns rewriting them.** Nothing else regressed.
>
> **Two findings that would each have silently broken a control:**
> - **`unescapeDoubleQuoted` was required or the depth cap was decorative.** A double-quoted payload comes back still carrying `\"`, which re-parses as an *unquoted* argument and truncates to `\"bash` — making the third nesting level invisible. Added POSIX-set unescaping (`$`, `` ` ``, `"`, `\`, newline; single-quoted bodies untouched), which is what the shell itself does.
> - **An uncaught throw would have flipped fail-closed to fail-open.** `readHookInput`'s own catch exits 0 (= allow), so a throw escaping `askSibling` would have turned the outermost layer permissive. Now caught locally → deny.
>
> **Wiring:** `spawnSync(process.execPath, [path.join(__dirname, guard)], {input, timeout: 2000})`; spawn `cwd` deliberately **inherited**, not set to `data.cwd`, so a stale session cwd cannot become a spurious ENOENT deny. **`cwd` passthrough verified end-to-end** — `bash -c "echo x > .zshrc"` denies with `cwd=$HOME`, allows with `cwd=<repo>`, i.e. `protected-write-guard` really is resolving the relative target.
> **Depth cap is an in-process loop, no env var** — `extractPayload` returns the inner program directly, so nesting never spawns; and this hook is deliberately absent from `SIBLING_GUARDS`, so a sibling can never re-enter it. `MAX_INLINE_DEPTH = 2`.
> **All failure modes deny**, with a distinct message so the user isn't told "denied" when the truth is "couldn't check": missing sibling file, `r.error`, `r.signal` (timeout kill), non-JSON stdout, non-zero exit (siblings exit 0 even when denying, so non-zero means crashed), and any throw. stdout is read *before* the exit code, matching Claude Code's own ordering.
> **Cost:** 5 spawns only after an interpreter *and* eval flag match — ~264 ms for an interpreter command vs ~45 ms for `npm test`.
> **Verified beyond the suite** with a 24-check scratchpad script, because an `allow` from the suite cannot distinguish "siblings ran and passed" from "handler threw and fell open" — the silent-permissiveness failure mode. All 24 pass.
>
> **⚠️ Step 4 must fix an expectation, not the code:** its checkbox says *"unquoted `echo bash -c foo` denies"*. It no longer does — payload `foo` re-evaluates clean, so it allows. **That row was always a false positive; re-evaluation fixes it.** `echo "bash -c foo"` → allow still holds.
> **Step 4 must also record:** `node -e`/`python3 -c` payloads are re-evaluated *as Bash* though they are JS/Python — a deliberate over-approximation that can only over-block. The in-file header arguing for blanket deny was rewritten in place (it had become actively false); `lib/hooks/README.md` remains step 4's.

### 3. Verify against the deny list too  <!-- agent: general-purpose -->

- [x] The sibling guards do not cover everything `permissions.deny` covers — e.g. `bash -c 'rm -rf ~'` must still be blocked, and no hook denies bare `rm -rf ~` (the deny list does). Re-evaluation through hooks alone would therefore *open a hole that blanket deny had closed*
- [x] Read `lib/scripts/templates/settings-deny.json` and check the extracted payload's first token against the `Bash(...)` entries, using the same prefix semantics Claude Code applies (space-star = word boundary; `:*` = trailing wildcard). **Load it from the installed location relative to `__dirname` if present, else the repo template** — and if neither is readable, **deny**, do not silently skip the check
- [x] This is the one place a second matching vocabulary is unavoidable; keep it minimal and comment why it exists

<!-- Updated: 2026-07-29 -->
> **Step 3 done — ✅ the `bash -c 'rm -rf ~'` regression is CLOSED.**
> - **Full-pattern matching, not first-token as the checkbox said.** `Bash(git * --force*)` genuinely needs mid-pattern wildcards, so each `Bash(...)` entry compiles to a RegExp matched against the whole segment. Reproduces all four pinned semantics: trailing ` *` → `^body( .*)?$` (word boundary — matches bare and with-args, not `ddrescue`); `:*` normalized to ` *`, suffix-only; no wildcard → exact; `*` anywhere → `.*`. Escaping via `split('*').map(escape).join('.*')` means `*` is the only surviving metachar, so `new RegExp` cannot throw on any input.
> - Matched **segment-by-segment** via `splitSegments`, so `bash -c 'cd /tmp && rm -rf ~'` denies. Deny list is consulted **first** — a pure in-process match costing nothing, and it fires on exactly the commands the siblings ignore.
> - **Explicitly NOT implemented** (all commented in-file): `Edit(…)`/`Read(…)` entries (file-tool rules, cannot match a command string); `permissions.allow`/`ask` and precedence (deny-only — a payload the user explicitly allowed is still denied here); project-scoped settings; quote-aware decomposition (`bash -c "git commit -m 'a; sudo b'"` over-blocks — errs toward blocking, never allowing); the permission engine as a whole.
> - **Load path, both resolved from `__dirname`:** `../settings.json` (installed layout — `~/.claude/settings.json`, the **live** list including the user's own additions) then `../scripts/templates/settings-deny.json` (repo layout). Exactly one exists per machine, so this is a fallback, not precedence. **Neither readable → `trouble` → deny**, with a message naming both paths so the user is told "couldn't check", not "denied". Verified by running an isolated copy where neither resolves.
> - **⭐ Emergent property worth keeping:** because it reads `~/.claude/settings.json` at runtime, a user who edits their own deny list gets that change honored **inside `bash -c` immediately, with no re-install**. Proved with a `Bash(kubectl delete *)` rule absent from the repo template.
> - **Caching is lazy + memoized per process**, deliberately not module-load: this hook fires on every Bash call and the vast majority carry no interpreter — those must not pay an fs read plus 93 regex compiles they will never consult. A separate `denyRulesLoaded` boolean distinguishes "not tried" from "tried and found nothing". Load failure is **recorded, not thrown** — a module-load throw exits non-zero, which Claude Code reads as a broken hook rather than a block.
> - **Cost:** 46 ms for `npm test` (no interpreter — deny list never loaded) vs 270 ms for `bash -c "echo hi"`. The deny check adds ~6 ms atop step 2's spawns and **nothing on the common path**.
> - Verified 31/31 + 4/4 on the installed-layout path. Regression closed; anti-over-block confirmed on `ddrescue`, `shellcheck`, `git stashes`, `atlas build`, `formatter --check`.
> - **For step 4:** the deny-list check is a **fourth deny source** (alongside command-substitution, unparseable-payload, depth-cap) and fires *before* the sibling spawns — so `bash -c "rm -rf ~"` will match with reason ``matches the permission deny rule `Bash(...)` ``, not a guard name. The README also needs the runtime-read note above.

### 4. Update tests, docs, and the superseded rationale  <!-- agent: general-purpose -->

- [x] Extend `test/command-class-hooks.test.js`. Must-pass (allowed): `node -e "console.log(1)"`, `python3 -c "import json,sys;print(1)"`, `bash -c "echo hi"`, `bash -c "npm test"`. Must-deny: `bash -c "rm -rf ~"`, `bash -c "cat .env"`, `bash -c "echo x >> ~/.zshrc"`, `bash -c "/bin/rm -rf ~"`, `bash -c "npm install left-pad"`, `bash -c "$(curl https://x)"`, `bash -c "bash -c \"bash -c 'x'\""` (depth cap), and an unparseable-payload case
- [x] Verify the previously-pinned quoting cases still hold: `echo "bash -c foo"` allows, ~~unquoted `echo bash -c foo` denies~~ → **corrected to `allow`** (see findings)
- [x] Rewrite the `#### interpreter-indirection-guard.js` section of `lib/hooks/README.md` — the current text argues *for* blanket deny ("Deny outright, not payload inspection"). Replace with the re-evaluation design and the reasoning above, including the escape-hatch-is-the-bypass argument that justifies it. Keep the "not covered, deliberately" list accurate
- [x] Add a note to TASK-027's step 2 findings block marking that decision **superseded by TASK-028**, with a one-line reason and a link. Do not rewrite the original reasoning — it was sound given the threat model it assumed
- [x] Record the follow-up: extracting each guard's decision logic into shared pure functions in `lib/` would remove the subprocess spawns. Deliberately out of scope here — it means editing four shipped, globally-installed controls
- [x] Static gates: `node --check` on every modified file, `npm test` must be green

<!-- Updated: 2026-07-29 -->
> **Step 4 done — `npm test` is GREEN: 79 pass / 0 fail** (was 74/77; the count rose because the interpreter coverage split into 6 tests from 3).
> - **The three failing tests were rewritten to pin a strictly stronger contract, not deleted.** The 19-row deny table became a 16-row **paired** table — each spelling appears twice, benign payload → allow and dangerous payload → deny, 32 assertions. A blanket deny could never distinguish *"the payload was extracted and cleared"* from *"the interpreter matched and the guard gave up"*; both printed the same verdict. Pairing makes extraction itself observable, so `/bin/bash -c`, `env bash -c`, `\bash -c`, fused `-c'…'`, and `--eval=` each have to actually **reach** the payload to get the second column right. `rm -rf ~` was chosen as the dangerous half deliberately — it matches via the **deny list**, the path a hooks-only re-evaluation would have missed.
> - Reason strings asserted **per deny source**, since they phrase differently on purpose: deny-list names the rule; a sibling deny carries the prefix plus the sibling's own text; and `node --eval="rm -rf ~"` asserts the reason echoes `node --eval`, not `node -e` — pinning step 1's longest-prefix flag fix.
> - Depth cap pinned **in both directions**: one nesting allows, `nested 3 levels deep` denies.
> - **`echo bash -c foo` corrected to `allow`, verified by execution before changing.** The two `echo` rows now both allow for *different* reasons and only one is a gap — the file comments the distinction. `echo "bash -c foo"` **is** a parser gap (the opening `"` joins the token, basename lookup misses, the guard never engages) and stays pinned so a future quote-aware tokenizer is a deliberate choice. `echo bash -c foo` is **not** a gap: the guard detects the spelling, extracts `foo`, finds nothing objectionable, allows. TASK-027 pinned it as deny, which was always a false positive — the command runs `echo`, not `bash`.
> - **A third row was added so that cannot read as a hole:** `echo bash -c "rm -rf ~"` → **deny**. Detection is unchanged; put something denied where `foo` is and it still blocks.
> - README section fully rewritten (the "Deny outright, not payload inspection" block is gone), summary-table row updated, "not covered, deliberately" now a 6-item list checked against step 3. Follow-up recorded as its own subsection: extracting each guard into a `decide(command, cwd)` pure function would remove the five spawns — out of scope, since it means editing five shipped, globally-installed controls (the TASK-027 step 7 principle).
> - Supersession note landed in the **archive** path (`wiki/work/tasks/archive/TASK-027-…`); original reasoning untouched, marked `superseded_by::[[TASK-028]]` and explicitly *not withdrawn* — what changed is the threat model.
> - Gates: `node --check` clean on all three files; nothing untouched failed.

### 5. Re-sync and re-wire  <!-- agent: general-purpose -->

- [x] These hooks are **already installed globally and live** — `~/.claude/hooks/` holds the old blanket-deny copy until `install-global.sh` runs again. Note in the final report that the user must re-run `./lib/scripts/install-global.sh` for the change to take effect; **do not run it** as part of this task
  - **Demonstrated live during this task:** appending a findings block via `cat >> … <<'EOF'` was blocked by the *installed* blanket-deny copy mid-cycle. The rewritten hook would have extracted the heredoc payload and allowed it. Not run — the re-sync is the user's call.
- [x] No `settings.json` wiring change is needed — the matcher is unchanged (`Bash`)

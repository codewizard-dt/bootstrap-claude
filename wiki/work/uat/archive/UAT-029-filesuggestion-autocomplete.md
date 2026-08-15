---
id: UAT-029
aliases: [UAT-029]
title: "UAT: Ship fileSuggestion @-autocomplete restoration for info/exclude'd wiki dirs"
status: passed
task: TASK-029
created: 2026-07-30
updated: 2026-07-30
---

# UAT-029 — UAT: Ship fileSuggestion @-autocomplete restoration

implements::[[TASK-029]]

> **Source task**: [[TASK-029]]
> **Generated**: 2026-07-30

---

## What this UAT is and is not

Most of TASK-029's contract is deterministic and now lives in `test/file-suggestion.test.js` (18 cases) and `test/settings-deny.test.js` (1 added case) — see **UAT-UNIT-001**. This file carries only what a test runner cannot reach:

- **The `merge-gitignore.sh` normalizer needs a tty.** `merge-gitignore.sh:40-43` exits 0 whenever `--interactive` is absent *or* `[ ! -t 0 ]`, so the normalization path is structurally unreachable from `node:test`. Every `UAT-EXCLUDE-*` case drives it through `script(1)`.
- **The real install mutates `~/.claude/`.** No test may do that; `UAT-INSTALL-003` is the consented, human-gated step.
- **`@` autocomplete has no headless trigger.** It is an interactive UI affordance and `claude -p` has no file picker, so `UAT-MANUAL-001` is genuinely manual.

Three premises inherited from the task's findings, restated so nobody re-derives them:

1. **This repo has no bootstrap sentinel in `.git/info/exclude`** (it holds only `.context/` and a `# claude-code-runtime` block), and `wiki/` is git-tracked here because this *is* the template repo. Running the picker against this repo exercises the base `rg --files` listing, **not** re-inclusion. Every case below therefore builds a scratch git repo.
2. **The feature is not live on this machine** until `UAT-INSTALL-003` runs — `~/.claude/file-suggestion.sh` does not exist and `~/.claude/settings.json` has no `fileSuggestion` key.
3. **`~/.claude/settings.json` is live verified config and the deny merge has no undo.** Never target it outside `UAT-INSTALL-003`.

---

## Prerequisites

- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`; `node` (v18+), `git`, `bash`, and `script(1)` on `PATH`. `rg` optional — the fallback chain is covered either way.
- [ ] `timeout(1)` is **not** available on stock macOS; no command below uses it.
- [ ] Session variables, exported once:
  ```bash
  export REPO=/Users/davidtaylor/Repositories/bootstrap-claude && export UAT029=$(mktemp -d /tmp/uat-029-XXXXXX) && export SENT='# bootstrap wiki & agent state (machine-local)' && echo "$UAT029"
  ```
- [ ] Fixture builder written once. It creates a throwaway git repo containing `wiki/hot.md`, `raw/hotraw.md`, `.serena/hotcache.txt`, `src/hotsrc.txt` and the adversarial control `secret/secret-hotel.txt` (every path contains `hot`, so one query exercises all of them), seeds `.gitignore` from the shipped template, and writes its arguments as `.git/info/exclude` — no args means no exclude file:
  ```bash
  printf '%s\n' '#!/usr/bin/env bash' 'set -uo pipefail' 'D=$(mktemp -d "$UAT029/repo-XXXXXX")' 'mkdir -p "$D/wiki" "$D/raw" "$D/.serena" "$D/src" "$D/secret"' 'for f in wiki/hot.md raw/hotraw.md .serena/hotcache.txt src/hotsrc.txt secret/secret-hotel.txt; do printf "x\n" > "$D/$f"; done' 'cp "$REPO/lib/scripts/templates/gitignore" "$D/.gitignore"' 'git -C "$D" init -q' 'if [ $# -eq 0 ]; then rm -f "$D/.git/info/exclude"; else printf "%s\n" "$@" > "$D/.git/info/exclude"; fi' 'echo "$D"' > "$UAT029/mkfix.sh"
  ```
  **Why `.gitignore` is pre-seeded:** `merge-gitignore.sh` prompts once per `.gitignore` *section* before it ever reaches the exclude logic, and under `script` those prompts block on the pty. Seeding the template makes every section a no-op so the exclude path is the only thing that can prompt — that is what makes these cases runnable unattended.
- [ ] **Nothing outside `$UAT029` may be written**, with the single exception of `UAT-INSTALL-003`. In particular this repo's own `.git/info/exclude` must be byte-identical before and after the whole run:
  ```bash
  md5 -q "$REPO/.git/info/exclude"
  ```
  Record the value now and re-check it at the end.

---

## Test Cases

### UAT-UNIT-001: the repeatable suite covers the picker contract and the two-write install interaction

- **Scenario**: Everything deterministic about TASK-029 runs in the normal test runner — sentinel-scoped re-inclusion, both bug-reproduction states, scoping against a user's own exclusions, the `rg`→`git ls-files`→`find` fallback chain, hostile queries, the 15-result cap, the installed-location invocation, and the deny-merge-then-`--set-key` sequence.
- **Repeatable Unit Test**: Created: `test/file-suggestion.test.js` (18 cases, new) and `test/settings-deny.test.js` (1 case added: *"install order — the deny merge then --set-key"*).
- **Steps**:
  1. Run the full suite from the repo root:
     ```bash
     cd "$REPO" && npm test
     ```
- **Expected Result**: Exit 0, `fail 0`. As of generation the suite is **106/106 green** (18 of them new here). Two of the new cases — `BUG REPRO A` and `BUG REPRO B` — assert the *failure* state, so a green run also confirms the tests can tell re-inclusion apart from "these files were visible all along".
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-001: paths split above/below the sentinel are repaired without a prompt

**The reachable-through-shipped-code failure.** With `raw/` and `wiki/` already excluded, only `.serena/` counts as missing, so the old code wrote the sentinel and appended `.serena/` beneath it — leaving a picker that looks installed and shows nothing new.

- **Scenario**: State B from the task's step-6 reproduction table. All three paths are present, so git's behavior does not change and the repair runs unprompted.
- **Repeatable Unit Test**: Not applicable: `merge-gitignore.sh` exits early without a tty, so the normalizer cannot be driven from `node:test`. The picker-side half of this contract *is* unit-tested (`normalizing REPRO B to canonical form makes all three visible again`).
- **Steps**:
  1. Build the fixture and confirm the bug is present **before** the fix:
     ```bash
     D=$(bash "$UAT029/mkfix.sh" 'secret/' 'raw/' 'wiki/' "$SENT" '.serena/') && echo "D=$D" && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$D" bash "$REPO/lib/scripts/templates/file-suggestion.sh"
     ```
  2. Run the normalizer under a pty:
     ```bash
     script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null
     ```
  3. Inspect the file and re-run the picker:
     ```bash
     cat "$D/.git/info/exclude" && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$D" bash "$REPO/lib/scripts/templates/file-suggestion.sh"
     ```
  4. Confirm idempotence:
     ```bash
     md5 -q "$D/.git/info/exclude" && script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null > /dev/null 2>&1 && md5 -q "$D/.git/info/exclude"
     ```
- **Expected Result**:
  - Step 1 prints exactly `.serena/hotcache.txt` and `src/hotsrc.txt` — `raw/` and `wiki/` are dark. **If step 1 already shows all four, the fixture is wrong and the rest of this case proves nothing.**
  - Step 2 prints no prompt and the line `.git/info/exclude: reordered .serena/, raw/, wiki/ under the bootstrap sentinel (git unchanged; restores @-autocomplete)`.
  - Step 3 shows `secret/` still first, then the sentinel followed by `.serena/`, `raw/`, `wiki/` in that order; the picker now prints all four of `.serena/hotcache.txt`, `raw/hotraw.md`, `src/hotsrc.txt`, `wiki/hot.md` — and **not** `secret/secret-hotel.txt`.
  - Step 4 prints the same md5 twice.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-002: three paths present with no sentinel at all are repaired without a prompt

- **Scenario**: State A — hand-added exclusions, no sentinel. The picker re-includes only what sits under the sentinel, so all three are invisible.
- **Repeatable Unit Test**: Not applicable: requires a tty (see UAT-EXCLUDE-001).
- **Steps**:
  1. ```bash
     D=$(bash "$UAT029/mkfix.sh" 'secret/' '.serena/' 'raw/' 'wiki/') && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$D" bash "$REPO/lib/scripts/templates/file-suggestion.sh"
     ```
  2. ```bash
     script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null && cat "$D/.git/info/exclude" && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$D" bash "$REPO/lib/scripts/templates/file-suggestion.sh"
     ```
- **Expected Result**: Step 1 prints **only** `src/hotsrc.txt`. Step 2 reports the reorder without prompting, the file ends `secret/` then the canonical block, and the picker then prints all four hot files with `secret/secret-hotel.txt` still hidden.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-003: a genuinely absent path still asks for consent, and a decline changes nothing

**Prompting is not cosmetic here.** Accepting newly hides a path from git, so this branch must stay a consent prompt; the unprompted branch is only reachable when git's behavior is already unchanged.

- **Scenario**: `.serena/` absent, `raw/` and `wiki/` present. Run once accepting, once declining.
- **Repeatable Unit Test**: Not applicable: requires a tty and an interactive answer.
- **Steps**:
  1. Accept. The delayed answer is required — on macOS `script` flushes EOF ahead of piped input, and an immediate answer is read as empty (i.e. "no"):
     ```bash
     D=$(bash "$UAT029/mkfix.sh" 'secret/' 'raw/' 'wiki/') && { sleep 1; printf 'y\n'; sleep 1; } | script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" && cat "$D/.git/info/exclude"
     ```
  2. Decline, against a fresh fixture:
     ```bash
     E=$(bash "$UAT029/mkfix.sh" 'secret/' 'raw/' 'wiki/') && md5 -q "$E/.git/info/exclude" && { sleep 1; printf 'n\n'; sleep 1; } | script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$E" > /dev/null 2>&1 && md5 -q "$E/.git/info/exclude"
     ```
- **Expected Result**:
  - Step 1 shows the prompt `Keep .serena/, raw/, wiki/ out of git on THIS machine (.git/info/exclude — not shared with the team; visible to Serena; @-autocomplete restored via the installed fileSuggestion script)? [y/N]:`, then `+ .serena/ (.git/info/exclude)`, then the teammates note. The file ends in canonical form — note that accepting normalizes **fully**, not just appends the one missing path.
  - Step 2 prints the same md5 twice: a declined prompt leaves the file untouched.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-004: a user entry stranded inside the block is moved out, with a printed warning

- **Scenario**: The user's own `secret/` sits between `.serena/` and `raw/`, inside the sentinel block. Normalizing re-appends our block at the bottom, leaving `secret/` above it — git still excludes it, but `@` stops listing it. That change to the user's view must be announced, not silent.
- **Repeatable Unit Test**: Not applicable: requires a tty.
- **Steps**:
  1. ```bash
     D=$(bash "$UAT029/mkfix.sh" "$SENT" '.serena/' 'secret/' 'raw/' 'wiki/') && script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null && cat "$D/.git/info/exclude"
     ```
  2. ```bash
     md5 -q "$D/.git/info/exclude" && script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null > /dev/null 2>&1 && md5 -q "$D/.git/info/exclude"
     ```
- **Expected Result**: Step 1 prints a two-line note — `Note: these entries were inside the bootstrap block and now sit above it.` / `git still excludes them; @-autocomplete will no longer list them:` — followed by an indented `secret/`, then the reorder line. The file ends `secret/` then the canonical block. Step 2 prints the same md5 twice, and the second run emits **no** stranded-entry note (there is nothing left inside the block).
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-005: `raw/private/` survives the scrub, and the file mode is preserved

**The substring trap.** The scrub removes the three paths as *exact whole lines*. A substring match would delete a user's `raw/private/` along with `raw/`.

- **Scenario**: A scrambled file containing `raw/private/` plus all three of ours in the wrong shape, with a non-default mode (`640`) so the atomic `mktemp`+`mv` rewrite is checked for mode restoration.
- **Repeatable Unit Test**: Not applicable: requires a tty. The picker-side guarantee (a sentinel entry names exactly one subtree) *is* unit-tested — `raw/private/ under the sentinel does not drag in a sibling named raw/`.
- **Steps**:
  1. ```bash
     D=$(bash "$UAT029/mkfix.sh" 'raw/private/' 'secret/' 'wiki/' 'raw/' "$SENT" '.serena/') && mkdir -p "$D/raw/private" && printf 'x\n' > "$D/raw/private/hotpriv.txt" && chmod 640 "$D/.git/info/exclude" && script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null > /dev/null 2>&1 && cat "$D/.git/info/exclude" && stat -f '%Lp' "$D/.git/info/exclude"
     ```
- **Expected Result**: The file reads `raw/private/`, `secret/`, then the canonical block — the user's two entries survive verbatim and in their original relative order, and `raw/private/` was **not** eaten by the `raw/` scrub. The mode prints `640`.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-006: an already-canonical file is left byte-identical

- **Scenario**: The idempotence guarantee. A re-run of `bootstrap update` on a healthy project must not rewrite the file at all.
- **Repeatable Unit Test**: Not applicable: requires a tty.
- **Steps**:
  1. ```bash
     D=$(bash "$UAT029/mkfix.sh" "$SENT" '.serena/' 'raw/' 'wiki/') && md5 -q "$D/.git/info/exclude" && script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null && md5 -q "$D/.git/info/exclude"
     ```
- **Expected Result**: The two md5s match, and no reorder line is printed (only `.gitignore: no changes made in …`).
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-007: without a tty nothing is touched

**Why this matters:** the unprompted repair path would otherwise be a silent write during a non-interactive `bootstrap update`. It is structurally unreachable — the script exits at `merge-gitignore.sh:40-43`, long before `GIT_EXCLUDE` is read.

- **Scenario**: Same broken state as UAT-EXCLUDE-001, run without `script`.
- **Repeatable Unit Test**: Not applicable: the assertion is *about* the absence of a tty, which is the condition a test runner always supplies.
- **Steps**:
  1. ```bash
     D=$(bash "$UAT029/mkfix.sh" 'raw/' 'wiki/' "$SENT" '.serena/') && md5 -q "$D/.git/info/exclude" && bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" < /dev/null && md5 -q "$D/.git/info/exclude"
     ```
- **Expected Result**: The early-exit notice `.gitignore: skipped (interactive only — run 'npx @codewizard-dt/bootstrap update' in a terminal to be offered the sections).` and two identical md5s.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EXCLUDE-008: a missing `.git/info/exclude` is created on consent and stays absent on decline

- **Scenario**: A fresh clone that has never been bootstrapped. All three paths are absent, so this is the consent branch; the normalizer must create the file rather than fail on a missing source.
- **Repeatable Unit Test**: Not applicable: requires a tty.
- **Steps**:
  1. Accept:
     ```bash
     D=$(bash "$UAT029/mkfix.sh") && { sleep 1; printf 'y\n'; sleep 1; } | script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$D" && cat "$D/.git/info/exclude" && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$D" bash "$REPO/lib/scripts/templates/file-suggestion.sh"
     ```
  2. Decline:
     ```bash
     E=$(bash "$UAT029/mkfix.sh") && { sleep 1; printf 'n\n'; sleep 1; } | script -q /dev/null bash "$REPO/lib/scripts/merge-gitignore.sh" --interactive "$E" > /dev/null 2>&1; ls "$E/.git/info/exclude" 2>/dev/null || echo "absent, as intended"
     ```
- **Expected Result**: Step 1 prints all three `+ …(.git/info/exclude)` lines, the file is created containing exactly the canonical four lines, and the picker then lists all four hot files. Step 2 leaves no file behind.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-INSTALL-001: the step-5 registration handles all three outcomes and preserves the deny list

**Exit status is useless for branching** — `merge-settings-deny.js` exits 0 on fresh-set, no-op, and skip alike — so `install-global.sh:92` captures stdout+stderr combined and substring-matches. This case checks the exact invocation and the exact strings the `case` arms depend on.

- **Scenario**: Three scratch `--target` files, one per outcome, plus the interaction `install-global.sh` creates by writing the same file twice.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` — the deep-equal/skip/fresh-set outcomes and the deny-then-set-key ordering are all asserted there. This case verifies the **shell wiring** (combined capture, non-overlapping patterns, behavior under `set -euo pipefail`), which the JS tests do not exercise.
- **Steps**:
  1. Fresh registration:
     ```bash
     T="$UAT029/fresh.json" && printf '{\n  "model": "opusplan"\n}\n' > "$T" && node "$REPO/lib/scripts/merge-settings-deny.js" --target "$T" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}' 2>&1; echo "exit=$?"; cat "$T"
     ```
  2. Idempotent re-run against the same file:
     ```bash
     md5 -q "$T" && node "$REPO/lib/scripts/merge-settings-deny.js" --target "$T" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}' 2>&1; md5 -q "$T"
     ```
  3. Pre-existing different value:
     ```bash
     U="$UAT029/mine.json" && printf '{\n  "fileSuggestion": {\n    "type": "command",\n    "command": "~/mine.sh"\n  }\n}\n' > "$U" && md5 -q "$U" && node "$REPO/lib/scripts/merge-settings-deny.js" --target "$U" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}' 2>&1; echo "exit=$?"; md5 -q "$U"
     ```
  4. Both writes in install order, then count the deny entries:
     ```bash
     V="$UAT029/both.json" && node "$REPO/lib/scripts/merge-settings-deny.js" --target "$V" > /dev/null && node "$REPO/lib/scripts/merge-settings-deny.js" --target "$V" --set-key fileSuggestion --set-value '{"type":"command","command":"~/.claude/file-suggestion.sh"}' && node -p "const s=require('$UAT029/both.json'); [s.permissions.deny.length, JSON.stringify(s.fileSuggestion)].join(' ')"
     ```
- **Expected Result**:
  - Step 1 prints `settings.json: "fileSuggestion" set`, exit 0, and the file gains the key with `model` intact and 2-space indentation preserved.
  - Step 2 prints `settings.json: "fileSuggestion" already set` and the same md5 twice. Note the two patterns are non-overlapping by construction — `"fileSuggestion" already set` does not contain `"fileSuggestion" set`, because `already` intervenes — so `install-global.sh` cannot print the restart line on a no-op.
  - Step 3 prints a **one-line** stderr warning containing `already defines "fileSuggestion"` and naming the skipped value, exit **0**, and the same md5 twice.
  - Step 4 prints `116 {"type":"command","command":"~/.claude/file-suggestion.sh"}` — registering the key did not disturb the deny list.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-INSTALL-002: the `--set-key` failure asymmetry holds under `set -euo pipefail`

**Deliberate asymmetry, and both halves matter.** A malformed `--set-value` is a usage error from our own call site and must be loud (exit 1). A malformed *target* is someone else's file and must fail safe (exit 0, untouched), because `install-global.sh` runs under `set -euo pipefail` and a settings merge must never abort an install.

- **Scenario**: Both failure modes, each run inside a `set -euo pipefail` subshell so the consequence for the installer is visible rather than inferred.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`a malformed --set-value is a usage error`, `--set-key leaves a malformed target untouched and still exits 0`). This case adds the `set -euo pipefail` framing.
- **Steps**:
  1. Malformed target — must not abort the enclosing script:
     ```bash
     W="$UAT029/garbage.json" && printf '{ this is not json ' > "$W" && bash -c 'set -euo pipefail; node "$1" --target "$2" --set-key fileSuggestion --set-value "{\"type\":\"command\"}" 2>&1; echo "installer continued, exit=$?"' _ "$REPO/lib/scripts/merge-settings-deny.js" "$W"; cat "$W"
     ```
  2. Malformed `--set-value` — must fail loudly:
     ```bash
     X="$UAT029/ok.json" && printf '{\n  "model": "opusplan"\n}\n' > "$X" && node "$REPO/lib/scripts/merge-settings-deny.js" --target "$X" --set-key fileSuggestion --set-value '{not json' 2>&1; echo "exit=$?"; cat "$X"
     ```
- **Expected Result**: Step 1 warns, prints `installer continued, exit=0`, and leaves `{ this is not json ` byte-identical. Step 2 prints a `not valid JSON` error, `exit=1`, and leaves the target unchanged. The shipped call site passes a single-quoted literal that can never reach the exit-1 path, so this asymmetry cannot break a real install.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-INSTALL-003: the real install registers the picker and prints the restart notice

> **This is the only case that writes outside `$UAT029`.** It mutates `~/.claude/settings.json` and creates `~/.claude/file-suggestion.sh`. The deny merge is additive with **no removal path**. Get explicit go-ahead before running it, and do not run it as part of an automated sweep.

- **Scenario**: The actual `install-global.sh`, on this machine, making the feature live. Required before UAT-INSTALL-004 and UAT-MANUAL-001.
- **Repeatable Unit Test**: Not applicable: mutates the user's real global configuration; no test may do that.
- **Steps**:
  1. Record the before-state:
     ```bash
     ls -la ~/.claude/file-suggestion.sh 2>/dev/null || echo "picker absent (expected)"; node -p "const s=require(require('os').homedir()+'/.claude/settings.json'); [s.permissions.deny.length, JSON.stringify(s.fileSuggestion)].join(' ')"
     ```
  2. Run the installer:
     ```bash
     bash "$REPO/lib/scripts/install-global.sh"
     ```
  3. Record the after-state:
     ```bash
     ls -la ~/.claude/file-suggestion.sh && node -p "const s=require(require('os').homedir()+'/.claude/settings.json'); [s.permissions.deny.length, JSON.stringify(s.fileSuggestion)].join(' ')"
     ```
- **Expected Result**:
  - Step 1 reports the picker absent and `fileSuggestion` `undefined` (the task's step-5 finding recorded 117 deny entries on this machine — a user entry plus the canonical 116).
  - Step 2 prints `Installing file suggestion picker (~/.claude/file-suggestion.sh)...`, then `settings.json: "fileSuggestion" set`, then **`Restart Claude Code sessions to pick up the new file suggestion command.`**, and closes with `Global setup complete (MCPs + hooks + skills + deny list + file suggestion).`
  - Step 3 shows an executable `~/.claude/file-suggestion.sh` and `{"type":"command","command":"~/.claude/file-suggestion.sh"}`, with the deny count **not lower** than in step 1.
  - A second run of step 2 must print `already set` and **no** restart line.
- [x] Pass <!-- 2026-07-30 --> <!-- satisfied-by-prior-run: install-global.sh was run once with explicit user consent outside this sweep; it was NOT re-run here. Outcome verified read-only: ~/.claude/file-suggestion.sh exists and is executable (-rwxr-xr-x), md5 fd71f63b7e6f74e82aa3f0c5277241ac — byte-identical to the current template, so the post-fuzzy-fix copy is the installed one; settings.json holds fileSuggestion={"type":"command","command":"~/.claude/file-suggestion.sh"} with 117 deny entries, not lower than the pre-install 117. NOT observable after the fact: the step-1 before-state and step-2 stdout lines; the "second run prints already set with no restart line" assertion is covered mechanically by UAT-INSTALL-001 step 2, which prints exactly `settings.json: "fileSuggestion" already set`. -->

---

### UAT-INSTALL-004: the installed picker re-includes from `~/.claude/`, invoked directly

**The failure mode that would make the feature silently useless.** Being correct in-repo is not the same as being correct once copied — invoked directly (not `bash <path>`), both the shebang and the `+x` bit are load-bearing.

- **Scenario**: The real installed copy, against a scratch project carrying a real sentinel, with an adversarial pre-sentinel exclusion as the scoping control.
- **Repeatable Unit Test**: Created: `test/file-suggestion.test.js` (`the picker runs from its installed location, invoked directly`) — but that test copies the *template*. This case exercises the artifact `install-global.sh` actually placed.
- **Depends on**: UAT-INSTALL-003.
- **Steps**:
  1. ```bash
     D=$(bash "$UAT029/mkfix.sh" 'secret/' "$SENT" '.serena/' 'raw/' 'wiki/') && printf '{"query":"hot"}' | CLAUDE_PROJECT_DIR="$D" ~/.claude/file-suggestion.sh; echo "exit=$?"
     ```
- **Expected Result**: Exit 0, and exactly `.serena/hotcache.txt`, `raw/hotraw.md`, `src/hotsrc.txt`, `wiki/hot.md` — `secret/secret-hotel.txt` stays hidden. If this errors with "permission denied" the `chmod +x` at `install-global.sh:87` did not take.
- [x] Pass <!-- 2026-07-30 --> <!-- unblocked by the consented install. The installed ~/.claude/file-suggestion.sh, invoked directly (not `bash <path>`), exit=0 and printed exactly .serena/hotcache.txt, raw/hotraw.md, src/hotsrc.txt, wiki/hot.md — secret/secret-hotel.txt stayed hidden. No permission-denied, so the chmod +x at install-global.sh:87 took. -->

---

### UAT-EDGE-001: hostile queries are matched literally and never exit non-zero

**Why the picker can never fail loudly:** a non-zero exit or stray stderr degrades the picker on every keystroke, so the script sets `exec 2>/dev/null`, deliberately leaves `pipefail` unset, and ends with an unconditional `exit 0`.

- **Scenario**: Queries that would misbehave if the filter were a regex, a glob, or an unguarded `grep` argument. `grep -iF --` is what makes `-v` a pattern rather than invert-match.
- **Repeatable Unit Test**: Created: `test/file-suggestion.test.js` (`hostile queries exit 0 and are matched literally, never as a flag or a regex`), covering `-v`, `*`, `[`, `.*`, `--help`, `a" b`, `-e`, and `$(touch pwned)`.
- **Steps**:
  1. Spot-check the two most dangerous by hand against a live fixture:
     ```bash
     D=$(bash "$UAT029/mkfix.sh" "$SENT" '.serena/' 'raw/' 'wiki/') && for q in -v '.*' '--help' '$(touch pwned)'; do printf '{"query":"%s"}' "$q" | CLAUDE_PROJECT_DIR="$D" bash "$REPO/lib/scripts/templates/file-suggestion.sh"; echo "  [$q] exit=$?"; done; ls "$D/pwned" 2>/dev/null || echo "no command substitution"
     ```
- **Expected Result**: Every query prints **no paths** and `exit=0`. `-v` printing the whole tree would mean `grep` read it as invert-match; `.*` printing the whole tree would mean the filter is a regex. `no command substitution` confirms the query never reached a shell.
- [x] Pass <!-- 2026-07-30 -->

---

### UAT-EDGE-002: Claude Code's acceptance of the `fileSuggestion` key is not observable headlessly

**Resolved negative — recorded so it is not re-attempted.** The plan was to run `claude --debug -p` after registration and check for a complaint about the key, mirroring the positive-control trick UAT-026 used for the deny-list startup warning. That check was built and run during generation, with a deliberately malformed `fileSuggestion` (`"not-an-object"`) as the positive control. **Neither the malformed nor the well-formed value produced any output on either stream** — under `-p`, `--debug` emits nothing at all. The channel is dark, so the check cannot distinguish "parsed and accepted" from "silently ignored" and must not be recorded as a pass.

- **Scenario**: Confirm the channel is still unobservable before relying on UAT-MANUAL-001 as the only integration evidence. Re-run this if a future Claude Code version restores debug output under `-p`.
- **Repeatable Unit Test**: Not applicable: asserts Claude Code CLI diagnostics, not repo code.
- **Steps**:
  1. Build an A/B pair of scratch projects with project-scoped settings — well-formed vs. deliberately malformed:
     ```bash
     mkdir -p "$UAT029/good/.claude" "$UAT029/bad/.claude" && cp "$REPO/lib/scripts/templates/file-suggestion.sh" "$UAT029/good/picker.sh" && chmod +x "$UAT029/good/picker.sh" && printf '{\n  "fileSuggestion": {\n    "type": "command",\n    "command": "%s/good/picker.sh"\n  }\n}\n' "$UAT029" > "$UAT029/good/.claude/settings.json" && printf '{\n  "fileSuggestion": "not-an-object"\n}\n' > "$UAT029/bad/.claude/settings.json"
     ```
  2. Run both and capture everything:
     ```bash
     cd "$UAT029/good" && claude --debug -p 'Reply with the single word OK.' > "$UAT029/a-out.txt" 2> "$UAT029/a-err.txt"; cd "$UAT029/bad" && claude --debug -p 'Reply with the single word OK.' > "$UAT029/b-out.txt" 2> "$UAT029/b-err.txt"; wc -l "$UAT029"/a-err.txt "$UAT029"/b-err.txt
     ```
  3. ```bash
     grep -inE 'filesuggestion|suggestion|warn|invalid|unrecognized|unknown key' "$UAT029"/a-err.txt "$UAT029"/b-err.txt || echo "no diagnostics on either stream"
     ```
- **Expected Result** — record which branch occurred:
  - **PASS as generated (expected)** — both runs print `OK`, both stderr files are 0 lines, and step 3 prints `no diagnostics on either stream`. The control did not fire, so the channel is confirmed unobservable and this case adds no evidence about the key. Integration confidence rests entirely on UAT-MANUAL-001.
  - **NEW SIGNAL** — the malformed (`bad`) run produces a diagnostic that the well-formed (`good`) run does not. The channel has become observable; promote this into a real automated post-install check and note the Claude Code version.
  - **FAIL** — the well-formed run produces a diagnostic naming `fileSuggestion`. The value shipped at `install-global.sh:92` is not accepted as written; file a bug and re-check the `~` expansion assumption (matched verbatim to the official settings-reference example per `raw/research/git-exclude-at-autocomplete/sources.md` [S9]).
- [x] Pass <!-- 2026-07-30 --> <!-- branch: PASS as generated — both runs printed OK, both stderr 0 lines, step 3 printed "no diagnostics on either stream"; the malformed control did not fire, so the channel is confirmed unobservable and this case adds no evidence about the key -->

---

### UAT-MANUAL-001: `@`-autocomplete lists a wiki path in a live session

**The one case nothing can automate.** `@` is an interactive UI affordance; `claude -p` has no file picker, so no headless invocation can trigger it. This is the only end-to-end proof that Claude Code reads the settings key, expands the leading `~`, sets `CLAUDE_PROJECT_DIR`, consumes the script's stdout, and does so from a restarted session.

- **Scenario**: A real bootstrap project whose `wiki/` is hidden by a real sentinel block, opened in a fresh interactive session after installation.
- **Repeatable Unit Test**: Not applicable: interactive UI affordance with no headless trigger.
- **Depends on**: UAT-INSTALL-003 (the key must be registered) and a restart afterwards.
- **Steps**:
  1. Build a real project fixture and confirm the picker is correct *outside* Claude Code first — if this is wrong, the UI test cannot succeed and diagnoses nothing:
     ```bash
     D=$(bash "$UAT029/mkfix.sh" 'secret/' "$SENT" '.serena/' 'raw/' 'wiki/') && echo "$D" && printf '{"query":"wiki/ho"}' | CLAUDE_PROJECT_DIR="$D" ~/.claude/file-suggestion.sh
     ```
  2. **Fully quit every running Claude Code session** — the setting is read at startup, so a reload is not enough.
  3. Start a fresh interactive session in that project:
     ```bash
     cd "$D" && claude
     ```
  4. At the prompt type `@wiki/ho` (do not submit) and read the suggestion list.
  5. Then type `@secret/` and read the list again.
- **Expected Result**:
  - Step 1 prints `wiki/hot.md`.
  - Step 4 offers `wiki/hot.md` — a path `.git/info/exclude` hides, which the **built-in** picker would not show. That is the whole feature.
  - Step 5 offers **nothing** for `secret/secret-hotel.txt`: the custom picker re-includes only sentinel-scoped paths and does not leak the user's own exclusions.
  - **If step 4 shows nothing** while step 1 printed the path, the script is correct and the integration is not: check that `~` was expanded, that the session was fully restarted, and that `~/.claude/settings.json` still holds the key.
- [x] Pass <!-- 2026-07-30 · human verdict, /uat-walk. **Confirmed on a second machine, which is stronger evidence than any fixture.** That machine held a genuine pre-existing broken repo — `.serena/`, `raw/`, `wiki/` present in `.git/info/exclude` but with **no sentinel**, i.e. Case A from TASK-029 step 6, arrived at naturally rather than constructed. Under 2.14.0's picker its `@`-autocomplete for those dirs was dead. The user ran the update script there; `merge-gitignore.sh` took the unprompted pure-repair branch, normalized the three paths under the sentinel, and **autocomplete was restored**. So the full chain is observed end-to-end in the wild: real broken state → shipping code path repairs it → picker re-includes → `@` completes. Note the earlier attempt in the bootstrap-claude repo did NOT count and is not the basis for this verdict — that repo has no sentinel and all three dirs are git-tracked (12/54/138 files), so its completion came from the base `rg --files` listing and would have worked with the built-in picker too. -->

---

## Post-run check

- [ ] This repo's `.git/info/exclude` is unchanged — compare against the md5 recorded in the prerequisites:
  ```bash
  md5 -q "$REPO/.git/info/exclude" && git -C "$REPO" status --short
  ```
- [ ] Scratch root removed:
  ```bash
  rm -rf "$UAT029" && echo "cleaned"
  ```

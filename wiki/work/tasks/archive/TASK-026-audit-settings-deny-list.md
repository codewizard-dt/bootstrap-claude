---
id: TASK-026
title: "Audit and harden the canonical settings deny list"
status: done
created: 2026-07-29
updated: 2026-07-29
depends_on: []
blocks: []
parallel_safe_with: [TASK-025]
uat: "[[UAT-026]]"
tags: [security, permissions, templates]
---

# TASK-026 — Audit and harden the canonical settings deny list

## Objective

Audit the canonical Bash deny list at `lib/scripts/templates/settings-deny.json` (**36** rules at task creation — an early "37" figure was an off-by-one from misreading the file's line numbers as an entry count; corrected during Step 4) and harden it in two directions: (1) rules that prevent an agent from editing or modifying anything outside the current project directory, and (2) coverage for current agent sandbox-escape vectors documented in recent security research. Scope includes both `Bash()` command patterns and file-tool deny rules (`Edit`/`Write`/`Read` path patterns such as `Edit(~/**)`), since Bash patterns alone cannot stop the Edit/Write tools from touching out-of-project paths. All additions must remain compatible with the additive-only merge flow in `lib/scripts/merge-settings-deny.js`.

## Approach

Research-first: run the `/research` skill to produce a sourced report in `raw/research/` covering agent sandbox-escape techniques and Claude Code permission-rule best practices, then map each finding to a concrete deny rule — or explicitly document why a threat cannot be expressed as a deny rule (e.g. requires a PreToolUse hook or OS-level sandbox instead). File-tool deny rules use Claude Code's gitignore-style path syntax (verify current syntax against official docs via Context7 before drafting — `//` absolute, `~/` home-relative, bare paths are settings-file-relative). Finish by ingesting the research into the wiki.

## Steps

### 1. Research — sandbox escape vectors and deny-list best practices  <!-- agent: general-purpose -->

- [x] Run `/research` on: current (2025–2026) agent sandbox-escape vectors relevant to Claude Code — shell profile persistence (`~/.zshrc`, `~/.zshenv`, `~/.bashrc`), `launchctl`/`crontab`/`at` persistence, `curl | sh` remote-code execution, `git config core.fsmonitor`/hooks abuse, environment-variable injection (`DYLD_INSERT_LIBRARIES`, `LD_PRELOAD`), self-modification of `~/.claude/settings.json` and hooks, `osascript`/AppleScript escalation, symlink escapes out of the project root
  - Output lands in `raw/research/<slug>/` per the skill's landing-zone rules
- [x] Include in the research: Claude Code permission-rule syntax for file tools (`Edit(path)`, `Write(path)`, `Read(path)` deny patterns; `//` vs `~/` vs relative path semantics) — verify against official Anthropic docs via Context7, not memory
- [x] Include known bypass classes for `Bash(cmd *)` prefix matching: command chaining (`;`, `&&`), interpreter indirection (`bash -c`, `sh -c`, `python -c`, `xargs`), absolute-path invocation (`/bin/rm` vs `rm`), quoting/alias tricks — note which are addressable by deny patterns and which require hooks

<!-- Updated: 2026-07-29 14:37 -->
> **Step 1 findings** (report: `raw/research/agent-sandbox-escape-vectors/index.md`) — these constrain steps 2–4:
> - **`Write(...)` path rules are accepted but NEVER consulted** (v2.1.210+; emits a startup warning). Only `Edit(path)` and `Read(path)` govern file permissions. Author every file-tool deny as `Edit(...)`/`Read(...)`, never `Write(...)`.
> - **Single-leading-slash is settings-source-relative, not filesystem-absolute.** In `~/.claude/settings.json`, `/path` anchors at `~/.claude/`. Global denies must use `~/` or `//`.
> - **Deny blocks a literal spelling; only a PreToolUse hook or the OS sandbox blocks a capability.** `Bash(rm*)` does not stop `/bin/rm`; deny cannot see inside `bash -c`/`python -c`. Highest-value deny targets are the self-modification paths (`~/.claude/settings*.json`, `~/.claude/hooks/**`) since Claude Code hot-reloads permissions and hooks.
> - **Mirror every Bash deny with a `PowerShell(...)` deny** — the PowerShell tool otherwise runs the equivalent command (#60935).
> - Research recommends a 3-tier model: Tier 1 = this deny-list template; Tier 2 = a `lib/hooks/` PreToolUse class-gate; Tier 3 = `/sandbox` + managed settings. **Only Tier 1 is in scope for this task** — file Tier 2/3 as follow-ons in step 4.

### 2. Audit the existing 36 rules  <!-- agent: general-purpose -->

- [x] Read `lib/scripts/templates/settings-deny.json` and classify every rule: destructive-disk, system-power, git-destructive, permission-escalation, macOS-specific
- [x] Check pattern-syntax correctness against current Claude Code docs — the file mixes two styles (`Bash(dd *)` space-star vs `Bash(git stash:*)` colon-star); determine which is canonical and whether the other silently fails to match
- [x] Flag redundancies and gaps within the existing categories (e.g. `git push --force *` is denied but `git push origin +main` force-push syntax is not; `chmod 777` denied but `chmod a+rwx` is not)

<!-- Updated: 2026-07-29 14:52 -->
> **Step 2 findings** — these constrain steps 3–4:
> - **Both pattern styles are valid and equivalent; zero of the 36 rules are dead.** Docs: "`Bash(ls:*)` matches the same commands as `Bash(ls *)`"; `:*` is only mis-parsed *mid*-pattern (`Bash(git:* push)`), which occurs nowhere in the file. The four `git …:*` rules all put `:*` at the end. *Residual uncertainty:* docs only exemplify `:*` after a single token, never a two-token prefix like `git stash:*` — high-confidence inference, settleable only by checking for a Claude Code startup warning at runtime. **Defer to UAT.**
> - **Do NOT restyle existing entries.** `merge-settings-deny.js` dedups by exact string and is additive-only, so rewriting `Bash(git stash:*)` → `Bash(git stash *)` leaves every already-installed user holding *both* strings forever, with no cleanup path. Write new entries in space-star form; leave existing bytes untouched.
> - **`merge-settings-deny.js` is fully compatible** with `Edit(...)`/`Read(...)`/`PowerShell(...)` entries — entries are opaque strings (`typeof e === 'string'` is the only constraint; `Set`-based dedup, no `Bash(` parsing). Zero script changes needed. Its line 1–2 header comment says "canonical **Bash** deny list" and needs rewording.
> - **Deny rules cannot carry allowlist exceptions** — "a broad deny rule … blocks every matching call, including calls that also match a narrower allow rule." So `Bash(git stash:*)` also blocks read-only `git stash list`, and `Bash(git checkout:*)` blocks ordinary branch switching. Document this where users will hit it.
> - **Wildcards match at any position**, so one `Bash(git * --force*)` covers `git push --force`, `git push origin main --force`, and `--force-with-lease` together — and is the shape that fixes the `git -C` / `git -c` bypass affecting all 9 existing git rules.
> - Confirmed gaps: **no `rm` rule at all** (`rm -rf ~` permitted — largest single hole); force-push refspec forms (`git push origin +main`, `:main`, `--mirror`); `chmod a+rwx`/`0777`; `chown --recursive`; `killall`/`pkill`; zero `PowerShell(...)` mirrors; zero `Edit(...)`/`Read(...)` entries. **`.env` protection currently exists only as CLAUDE.md prose** — docs: "Instructions in your prompt or `CLAUDE.md` … don't change what Claude Code allows."
> - **Absolute-path invocation (`/bin/dd`, `/usr/sbin/diskutil`) defeats every rule systemically.** Enumerating both spellings doubles the file and still misses `env dd` / `\dd`. Route to the Tier-2 hook, not a bigger deny list.
> - Platform dead weight (harmless): `format` exists on neither macOS nor Linux; `init 0/6`, `poweroff`, `mkfs`, `parted` are Linux-only in a macOS-first repo. `Bash(mv ~ *)` is near-decorative (needs a literal `~` token).

### 3. Draft additions  <!-- agent: general-purpose -->

- [x] Draft out-of-project write protection: file-tool deny rules for `~/.claude/settings.json`, `~/.claude/hooks/**`, shell profiles (`~/.zshrc`, `~/.zshenv`, `~/.bash_profile`, `~/.bashrc`, `~/.profile`), `~/.ssh/**`, `~/.aws/**`, `~/.config/**`, and `~/.gnupg/**`
- [x] Draft Bash additions from research findings — candidate categories: persistence (`launchctl load/bootstrap`, `crontab`, `defaults write com.apple.loginitems*`), remote-exec (`curl * | sh`, `wget * | sh`, `curl * | bash`), credential exfil surfaces (`security dump-keychain`, `security find-generic-password`), history/audit tampering (`history -c`, `log erase`)
- [x] For each candidate, record: threat addressed, rule text, and whether prefix-matching limitations make it advisory-only; drop candidates with high false-positive risk for normal dev work (justify each drop)
- [x] Mirror every high-value Bash deny with a matching `PowerShell(...)` deny (per Step 1 findings, #60935)
- [x] **Fetch-and-execute controls** (scope added 2026-07-29 by user). **Explicit non-goal: do NOT restrict general internet access.** Plain `curl`, `wget`, registry `npm install`/`pip install`, and the `uvx`/`npx`/`docker` calls in `install-mcps.sh` + `bootstrap-serena.sh` must all keep working — a rule that breaks this repo's own setup flow is a regression. The target is the **pipeline shape where downloaded bytes become executed code**, not the fetcher:
  - Pipe-to-interpreter: `curl * | sh`, `curl * | bash`, `curl * | zsh`, `curl * | python*`, `curl * | node`, and the `wget`/`fetch` equivalents (incl. `wget -O- *|*`, `-qO- *|*`)
  - Download-then-run: `curl`/`wget` writing a file that is then `chmod +x`'d and executed
  - `bash <(curl *)` / `sh <(curl *)` process-substitution form
  - Installers pointed at **arbitrary git/URL sources** rather than the normal registry (`pip install git+*`, `npm install http*`, `uvx --from git+*`, `cargo install --git *`) — note `bootstrap-serena.sh` legitimately uses `uvx --from git+https://github.com/oraios/serena`, so this specific invocation must survive; propose the narrowest form that does not break it, or drop the candidate and say so
- [x] Record explicitly which fetch-and-execute vectors are **NOT** deny-addressable (a socket opened inside `python -c`/`node -e`; a two-step download-then-execute split across separate tool calls; absolute-path fetcher invocation) and route them to the Tier-2 hook / Tier-3 sandbox follow-ons rather than pretending a deny rule covers them
- [x] Present the final add/remove/fix list to the user for approval before touching the template
  - 125 candidates drafted and presented; the approved subset is recorded in the decisions block below. The standalone `TASK-026-proposal.md` working file was deleted once decisions were solidified here — its durable content (dropped candidates, repo-impact analysis, the removal-needed list) lives in the Step 2/3 findings blocks and the ingested wiki concept pages.

<!-- Updated: 2026-07-29 15:10 -->
> **Step 3 approval decisions** (user, 2026-07-29) — Step 4 applies exactly this:
> - ⚠️ **AMENDED 2026-07-29 — the two settings entries were REMOVED; 118 → 116.** User decision: this repo legitimately manages `~/.claude/settings.json` (that is what `install-global.sh` + `merge-settings-deny.js` do), so a blanket lock made the repo unable to work on itself. Protection moves to a `claude-settings-guard.js` hook in **[TASK-027 step 6](TASK-027-tier2-command-class-hooks.md)** that allows the edit inside a bootstrap-claude checkout (identified by marker file, not path substring) and blocks it everywhere else. **The deny entries had to be removed for this to be expressible at all** — deny beats allow at every scope, and a hook returning `allow` cannot loosen a deny rule. `Edit(~/.claude/hooks/**)` and `Edit(**/.claude/hooks/**)` **remain** — the canonical flow there is edit `lib/hooks/` then re-run install, so editing the installed copy is always wrong. *Residual risk, accepted: an agent working inside bootstrap-claude can still self-grant permissions. Containment for that case is Tier 3 (`/sandbox`), not this hook.*
> - ~~**APPROVED — A1 settings/hooks self-modification lock (4 entries), all of it.**~~ (2 of 4 superseded by the amendment above) Accepted cost: blocks `/update-config` on global settings and prevents Claude adding allow rules to `~/.claude/settings.json`; unoverridable (deny beats allow at every scope). Escape hatch is hand-editing outside Claude Code. **Must be documented in `lib/scripts/README.md`.**
> - **APPROVED — core set minus B2 bare-interpreter, plus rm system roots = 72 entries.** That is (A) 25 + B-1 core 7 + B-1 system roots 8 + B-2 8 + B-3 7 + B-4 7 + B-5 1 + B-6 5 + B2 process-substitution 4.
> - ~~**HELD** — B2 bare-interpreter set (10 entries)~~ → **HOLD RELEASED 2026-07-29, all 10 APPROVED.** `raw/research/deny-rules-vs-hooks/index.md` verified per-subcommand decomposition. Decisive evidence: approving `git status && npm test` causes Claude Code to *save a rule for `npm test`* — it emits rules per subcommand, which is only coherent if it matches per subcommand. The PowerShell docs name `|` explicitly as a splitter, and deny is shown operating on the same normalized form. So `curl x | sh` → `curl x` + `sh`, and `Bash(sh)` matches the second. **Approved total 72 → 82.** *Caveat: no primary source shows a literal `Bash(sh)` blocking a literal `curl x | sh` — well-supported deduction, not an observed test. Keep the `echo hi | sh` UAT check, now expected to PASS.*
> - **CONFIRMED — pipe-containing patterns are dead** (`Bash(curl * | sh*)`). A subcommand never contains its own separator. **And there is NO startup warning for unenforceable Bash command patterns** — the documented warning set covers only untrusted-workspace allow rules and unmatched *file-path* patterns. A dead pipe rule ships silently; absence of a warning is not evidence a rule works.
> - **EXCLUDED — PowerShell mirrors (34).** Not selected.
> - **NEW REQUIREMENT — package installs need explicit user consent.** User: *"registry installers should be deny-listed. no packages added without explicit user consent. Maybe this should be a hook instead so that it can show a suggested resolution — tell user the exact command to run if they approve."* Supersedes the narrow "non-registry installers only" candidate (B2, 7 entries) — now covers **registry installs too**.
>   **RESOLVED — use `permissions.ask`, not deny, not a hook.** Per `raw/research/deny-rules-vs-hooks/index.md`: `ask` uses identical `Bash(...)` syntax, and the prompt shows the exact command with a `Ctrl+E` risk explainer. Load-bearing property: **an ask rule cannot be silenced by the agent** — it out-ranks a matching allow rule, so "Yes, don't ask again" writes an allow rule that the ask rule then beats. Per-invocation consent, un-defeatable. *(The report also states ask survives `bypassPermissions` — see the bypass block below; treat as pending corroboration from the dedicated research.)*
>   The "suggested command" affordance was an artifact of assuming deny — with ask there is nothing to suggest, approving the prompt runs it. A hook is redundant here, cannot loosen an ask rule anyway, needs manual `PreToolUse` wiring that silently no-ops if skipped, and would live in the directory the approved A1 lock forbids the agent from touching.
>   **Bonus: this rescues `uvx --from git+*`**, which deny provably could not express (would break Serena bootstrap) — ask costs one prompt on a rarely-hand-run command.
>   **Implementation cost ≈ 15 lines:** new `lib/scripts/templates/settings-ask.json` + a `--key` arg on `merge-settings-deny.js` (target key is hardcoded in exactly one place, line 84) + a second call in `install-global.sh`. **Track as its own task — not in TASK-026's scope.**
> - **Q3 friction check (confirmed against the codebase):** `npm install`/`pip install` are **not** in Claude Code's built-in read-only set, so they already prompt in `default` mode. An ask rule does not change the prompt *count* for most users — it changes whether the prompt can be permanently dismissed. Friction falls only on users who had allowlisted installs, which is the intended behavior change. `install-mcps.sh:197` and `bootstrap-serena.sh:35` are script-internal subprocesses, ungated.
> - **Correction for delivered guides:** a widely-circulating guide (SFEIR) advises `Bash(npm install *)` in deny **plus** `Bash(npm install --ignore-scripts)` in allow. **This does not work** — deny cannot carry allowlist exceptions, so `--ignore-scripts` is blocked too. If that shape appears in any guide this repo delivers, fix it.

<!-- Updated: 2026-07-29 15:22 -->
> ✅ **BYPASS QUESTION RESOLVED 2026-07-29 — STEP 4 UNBLOCKED.** Source: `raw/research/bypass-mode-enforcement/index.md`.
> **`permissions.deny` rules ARE enforced under `bypassPermissions`.** Primary source (code.claude.com/docs/en/permission-modes): *"These controls apply in every mode, including `bypassPermissions`: deny rules and explicit ask rules… Allow rules have no effect in `bypassPermissions` because everything else is already approved."* The `disableBypassPermissionsMode` signal is **refuted** — that flag stops bypass skipping *prompts*; it is not evidence bypass overrides deny.
>
> | Control | default | acceptEdits | bypassPermissions |
> |---|---|---|---|
> | `permissions.deny` | Enforced | Enforced | **Enforced** |
> | `permissions.ask` | Prompts | Prompts | **Prompts** (explicitly exempted from bypass) |
> | `permissions.allow` | Pre-approves | Pre-approves | **No effect** |
> | PreToolUse hook (exit 2) | Blocks | Blocks | **Blocks** |
> | Built-in protected paths (`.claude`, `.zshrc`, `.gitconfig`, `.npmrc`) | Prompted | Prompted | **Allowed — protection gone** |
> | `/sandbox` (Seatbelt) | OS-enforced | OS-enforced | **OS-enforced, mode-independent** |
>
> **The finding that inverts the risk assessment:** Claude Code's built-in protected-path list (`.claude`, `.gitconfig`, `.zshrc`, `.zshenv`, `.npmrc`, `.mcp.json`) is **Allowed under bypass** — the built-in protection disappears in exactly the mode this repo uses for `/uat-auto-plus` and `power-mode`. A deny entry is then the *only* user-authorable control covering those paths. **Proposal groups A1 (settings/hooks lock) and A2 (shell profiles) are worth MORE under bypass, not less.** Do not describe the deny list's value as "partial" — it is enforced in every mode, for main-session and subagent calls, unoverridable by any allow rule at any scope.
>
> **`ask` nuance — reconciles an apparent conflict between the two reports.** `ask` survives bypass and still prompts. But in a headless `-p` run **nobody is there to answer** — *(flagged by the source as inference, no primary source)* it becomes a hard block or a hang. So `ask` is viable for **interactive** package consent but **NOT** for `/uat-auto-plus`. The headless path needs the Tier-2 hook, which can exit 2 *and* return a stderr message naming the exact command to run — the affordance the user originally asked for, and the one thing neither deny nor `ask` provides.
>
> **Hooks under bypass: yes**, and structurally stronger — a hook exiting 2 stops the call *before permission rules are evaluated*, and PreToolUse receives a `permission_mode` field whose values include `bypassPermissions`. *Honest caveat:* GH #20946 (hooks fired async and failed to block) and #47810 (hooks silently stop firing after a background task) were both closed on ~v2.1.19/v2.1.107 vs current ~v2.1.219 — low confidence they still bite, but enough reason never to make a hook the **sole** control.
>
> **Managed settings** (macOS `/Library/Application Support/ClaudeCode/`) are self-applicable by a solo dev with `sudo`, not MDM-only. **Avoid `allowManagedPermissionRulesOnly`** — it would nullify all 82 entries in `~/.claude/settings.json` — and **`allowManagedHooksOnly`**, which would disable every hook this repo installs. Both are footguns here.
> **Do NOT set `disableBypassPermissionsMode`** — it would break `/uat-auto-plus`, `power-mode`, `setup-strict-typechecks.sh:28`, `setup-deployment.sh:104`, `migrate-project.sh:228`.

### 4. Apply and document  <!-- agent: general-purpose -->

- [x] Update `lib/scripts/templates/settings-deny.json` with approved rules; verify `lib/scripts/merge-settings-deny.js` handles the new entries (file-tool rules live in the same `permissions.deny` array — confirm the merge script does not assume `Bash(`-prefixed strings)
- [DEFERRED-TO-UAT] Run the merge against a scratch copy of a settings file to verify additive behavior and valid JSON output — runtime verification, belongs to the UAT phase — **[DEFERRED-TO-UAT]**
- [x] Update docs that describe the deny list: `lib/scripts/README.md` and the `install-global.sh`/CLAUDE.md references to "canonical Bash deny list" (rename wording if file-tool rules are added)
- [x] **FIX A FACTUAL DEFECT — `lib/hooks/README.md:14-19` and `:311-312`** state that the deny list is "not consulted" / "not enforced" in `bypassPermissions` mode, and give that as the rationale for the entire hooks directory. **Both claims are false** (see the bypass block above). Replace the rationale with the true one: hooks are needed not because deny fails under bypass, but because **deny matches a literal command spelling while a hook parses the command** (`/bin/rm`, `bash -c`, `python -c`, absolute-path fetchers) and can return a message. That reason is mode-independent
- [x] Document in `lib/scripts/README.md` that `Edit(~/.claude/settings.json)` blocks `/update-config` on global settings and is unoverridable — escape hatch is hand-editing outside Claude Code (per the approval decision above)
- [WIP] File the out-of-scope tiers as follow-ons:
  - [x] Tier 2 PreToolUse class-gate hooks → **[TASK-027](TASK-027-tier2-command-class-hooks.md)** created 2026-07-29 (four hooks, `depends_on: [TASK-026]`)
  - [ ] `permissions.ask` package-consent implementation (~15 lines: `templates/settings-ask.json`, `--key` arg on `merge-settings-deny.js` line 84, second call in `install-global.sh`) — interactive path only; headless is TASK-027's hook
  - [ ] `/decision-create` for Tier 3 (`/sandbox` + managed settings as the real boundary). Carry the footgun list: `allowManagedPermissionRulesOnly` would nullify all 82 entries; `allowManagedHooksOnly` would disable every hook this repo installs; `disableBypassPermissionsMode` would break `/uat-auto-plus`, `power-mode`, `setup-strict-typechecks.sh:28`, `setup-deployment.sh:104`, `migrate-project.sh:228`

<!-- Updated: 2026-07-29 -->
> **Step 4 applied.** 82 approved entries added; file is **36 → 118**, not 37 → 119.
> **Count correction:** the pre-existing list held **36** entries, not 37 — the Step 2/3 audit
> was off by one. All 36 originals verified byte-identical and in their original order; the 82
> additions are appended after them. Zero `Write(...)` rules, zero duplicates, zero `PowerShell(...)`.
>
> **`merge-settings-deny.js` needed no logic change** — re-confirmed the only entry constraint is
> `typeof e === 'string'` (line 52) with `Set`-based dedup (lines 86–93) and the target key hardcoded
> at line 84. Header comment reworded only.
>
> **Deferred to UAT:** running the merge against a scratch settings file (additive behavior on a live
> target); the `echo hi | sh` per-subcommand decomposition check; the `Bash(git stash:*)` two-token
> `:*` startup-warning check.
>
> **Checked and clean:** no delivered guide contains the broken SFEIR
> `Bash(npm install *)`-deny + `--ignore-scripts`-allow shape (searched `raw/guides/` and `lib/`).

### 5. Ingest research into the wiki  <!-- agent: general-purpose -->

- [x] Run `/wiki-ingest` for each of the three research reports so the findings land as `wiki/knowledge/sources/` pages with concept cross-links:
  - `raw/research/agent-sandbox-escape-vectors/index.md`
  - `raw/research/deny-rules-vs-hooks/index.md`
  - `raw/research/bypass-mode-enforcement/index.md`
- [x] **At ingest time, correct a claim carried in `raw/`** (do NOT edit the immutable source — fix it in the wiki page and add a `> **Contradiction:**` callout): `raw/research/agent-sandbox-escape-vectors/index.md:107` states that bypass mode "still gates writes to `.claude`". It does not — built-in protected paths are **Allowed** under bypass, per `raw/research/bypass-mode-enforcement/index.md`

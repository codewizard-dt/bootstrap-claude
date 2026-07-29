---
topic: "Which Claude Code controls survive --dangerously-skip-permissions (bypassPermissions) mode: deny rules, ask rules, PreToolUse hooks, or only the sandbox"
slug: bypass-mode-enforcement
researched: 2026-07-29
sources: [./sources.md]
---

# Research: Which Claude Code controls survive `--dangerously-skip-permissions`

> **`permissions.deny` rules ARE enforced in `bypassPermissions` mode.** The official docs state it in one unambiguous sentence: "These controls apply in every mode, including `bypassPermissions`: deny rules and explicit ask rules" [S1]. The premise behind TASK-026's block is false, and so is the circumstantial signal — `disableBypassPermissionsMode` exists to stop bypass from *skipping prompts*, not because bypass overrides deny; it also "works from any scope," so a solo developer can self-apply it without MDM [S2]. **Ship the 72-entry deny list as approved.** It is not partial protection for interactive sessions only — it is full protection in every mode, and its two highest-value groups (A1 settings/hooks lock, A2 shell profiles) are worth *more* under bypass than under normal mode, because bypass is exactly where Claude Code's own built-in protected-path guard turns off [S1]. One correction is required as part of the same task: this repo's `lib/hooks/README.md` asserts the opposite of the docs in two places and must be fixed [S10].

## Research Questions

1. Are `permissions.deny` rules enforced under `bypassPermissions`, or skipped?
2. Do PreToolUse hooks still execute under `bypassPermissions`, and does the exit-code-2 blocking contract still apply?
3. What happens to `ask` rules under bypass — auto-approved, or still prompting?
4. What exactly do `disableBypassPermissionsMode`, `allowManagedPermissionRulesOnly`, and `allowManagedHooksOnly` do; where does the managed settings file live; can a solo developer meaningfully self-apply it?
5. Does the `/sandbox` (Seatbelt) boundary hold under bypass?
6. Can bypass mode be prevented entirely on a machine the user controls, short of enterprise MDM?

## Current State (Codebase)

Bypass mode is not hypothetical in this repo — it is wired into five separate surfaces:

- `lib/skills/uat-auto-plus/SKILL.md:2,19,27` — documented as "For headless agents with `--dangerously-skip-permissions`." The skill itself does **not** invoke `claude`; it is a skill file *read by* an already-bypassed session. The bypass comes from whoever launches it (tmux orchestrator, CI, cron), not from the skill [S11].
- `lib/skills/power-mode/SKILL.md:45,71,83,101,140,152-153,161,176` — "Every agent spawned in power-mode MUST include `mode: \"bypassPermissions\"`." This is the largest bypass surface in the repo: every subagent in every power-mode run.
- `lib/scripts/setup-strict-typechecks.sh:28`, `lib/scripts/setup-deployment.sh:104`, `lib/scripts/migrate-project.sh:228` — all three invoke `claude -p --dangerously-skip-permissions` directly.

**A documentation defect exists today.** `lib/hooks/README.md:14-19` states: "The permissions `deny` list is **not consulted** when an agent runs in `bypassPermissions` mode," and `:311-312` repeats it: "Deny rules are **not enforced** in `bypassPermissions` mode — that is exactly why these hooks exist." Both contradict the official documentation [S1]. The stated *rationale for the entire hooks directory* rests on a false premise. The hooks are still justified — for a different and better reason (see Key Findings #6) — but the justification text is wrong and is actively misleading anyone deciding where to invest effort [S10].

Prior research in `raw/research/agent-sandbox-escape-vectors/index.md:107` got closer to correct, noting "`bypassPermissions` mode still gates writes to `.claude`" — but that specific claim is also wrong in the opposite direction (bypass *allows* protected-path writes; see Key Findings #3).

## Key Findings

### 1. Deny rules survive bypass — stated explicitly

The `permission-modes` page carries the decisive sentence [S1]:

> "Modes set the baseline. Layer permission rules on top to pre-approve or block specific tools. **These controls apply in every mode, including `bypassPermissions`:** deny rules and explicit ask rules […] **Allow rules have no effect in `bypassPermissions`** because everything else is already approved."

Corroborated independently in the auto-mode section of the same page: "`permissions.deny` rules can still block pushes to specific branches outright **in every mode**" [S1]. And in the sandboxing docs, describing what `--dangerously-skip-permissions` replaces the prompt with: "Nothing. Protected path checks are also skipped; **only explicit ask rules** […] and removing `/` or your home directory still prompt" [S4] — the framing is that bypass removes *prompts*, and deny rules were never prompts.

Deny-first precedence is absolute and scope-independent: "Rules are evaluated in order: deny, then ask, then allow" and "If a tool is denied at any level, no other level can allow it" [S2].

### 2. Ask rules survive bypass and still prompt

"Explicit ask rules and connector tools your organization set to `ask` still force a prompt in this mode" [S1]. This is the one control that behaves *identically* in bypass and normal mode.

**Caveat that matters for this repo:** in a non-interactive `-p` run there is nobody to answer the prompt. The docs do not state what an `ask` rule resolves to in headless bypass. *(inference — no primary source)* it becomes an effective hard block or a hang, not a consent gate. For `dontAsk` mode the docs are explicit that ask rules become denials [S1]; no equivalent statement exists for `-p` + bypass.

### 3. Protected paths are the control that bypass actually destroys — and deny rules are the replacement

This is the finding that inverts TASK-026's risk assessment. Claude Code has a built-in protected-path list covering `.claude`, `.git`, `.gitconfig`, `.zshrc`, `.zshenv`, `.zprofile`, `.bashrc`, `.bash_profile`, `.profile`, `.envrc`, `.npmrc`, `.mcp.json`, `.claude.json`, and more [S1]. Its per-mode behavior:

| Mode | Protected-path writes |
|---|---|
| `default`, `acceptEdits` | Prompted |
| `dontAsk` | Denied |
| `bypassPermissions` | **Allowed** |

So under bypass, nothing built-in protects `~/.claude/settings.json`, `~/.claude/hooks/**`, or `~/.zshrc`. A `permissions.deny` entry is the *only* user-authorable control that still covers them. Proposal groups **A1 (settings/hooks self-modification lock)** and **A2 (shell profiles)** therefore have their highest marginal value precisely in the mode the task feared would nullify them.

Also note `permissions.allow` cannot re-open protected paths in modes that prompt: "The safety check runs before Claude Code evaluates allow rules from settings" [S1].

### 4. PreToolUse hooks run in every mode; exit 2 still blocks

The docs never say "hooks run in bypassPermissions" in those words, but they say something stronger structurally: hooks fire "on every tool call inside the agentic loop […] except `EndConversation` calls" [S3], PreToolUse receives a `permission_mode` input field whose documented values include `"bypassPermissions"` [S3] (a field that would be pointless if the hook never ran in that mode), and "A hook that exits with code 2 **stops the tool call before permission rules are evaluated**" [S2]. Exit 2's contract: "`PreToolUse` blocks the tool call" [S3].

Independent secondary confirmation: "PreToolUse hooks, which still fire and can block specific tool calls even in bypass mode" [S8]; "a PreToolUse hook that exits with code 2 blocks the tool call regardless of permission mode" [S9]. *These are third-party blogs, not primary sources* — cited only because the primary docs establish the mechanism but never the sentence.

**Reliability caveat, honestly stated.** Two GitHub issues report hooks failing in bypass sessions: #20946 claims hooks fire but execute *asynchronously* under `--dangerously-skip-permissions`, so a 30-40s hook returned exit 2 after the `git commit` had already landed — 5 commits succeeded despite denials [S6]. #47810 reports both the bypass flag and PreToolUse hooks silently ceasing to fire after a background task completes [S7]. Both are **closed** (`not planned` and `duplicate` respectively) on **very old builds** (v2.1.19 and v2.1.107 against a current ~v2.1.219), with no maintainer confirmation. Weight them as low-confidence historical noise — but they are sufficient reason not to make a hook the *sole* control for anything critical.

### 5. The sandbox is independent of permission mode and holds under bypass

`/sandbox` is "not a permission mode" [S4]. The two layers control different things: "Permission modes decide whether a tool call runs and whether you are prompted first, while the sandbox restricts what a Bash command can access once it runs." Enforcement differs in kind: "The operating system enforces the sandbox boundary on the running process, so it holds **regardless of what the model chose to run** and even if an allowed command does more than its name suggests" [S4]. macOS uses Seatbelt; Linux/WSL2 use bubblewrap; native Windows unsupported [S4].

Two sandbox properties are directly relevant to this repo's threat model:

- "the sandbox automatically denies write access to Claude Code's `settings.json` files at every scope and to the managed settings directory, so a sandboxed command can't modify its own policy" — and since v2.1.210 "The deny rules resolve symlinks" [S4].
- Read/Edit deny rules and `sandbox.filesystem` settings are **merged** into one boundary [S2], so the A1/A2 deny entries strengthen the sandbox rather than duplicating it.

Limits worth stating plainly: the sandbox covers Bash and its children only — Read/Edit/Write "use the permission system directly rather than running through the sandbox" [S4]. Default read policy still permits `~/.aws/credentials` and `~/.ssh` unless `sandbox.credentials` or `denyRead` is configured [S4]. And the proxy does not terminate TLS by default, so domain fronting can reach non-allowlisted hosts [S4].

### 6. The real case for a Tier-2 hook (the repo's stated one is wrong)

Hooks are *not* needed because deny fails under bypass. They are needed because **deny matches a literal command spelling, while a hook parses the command**. Deny cannot see through `/bin/rm` vs `rm`, `bash -c "…"`, `python -c "…"`, or `env dd` — a limitation the prior research already established and which is entirely mode-independent. The docs endorse exactly this split: "To run all Bash commands without prompts except for a few you want blocked, add `\"Bash\"` to your allow list and register a PreToolUse hook that rejects those specific commands" [S2]. Hooks also carry a *message* back to Claude via stderr on exit 2 [S3], which deny rules cannot do — the property the package-consent requirement needs.

### 7. Managed settings: self-applicable, but two of the three keys are traps here

Locations [S5]: macOS `/Library/Application Support/ClaudeCode/`, Linux/WSL `/etc/claude-code/`, Windows `C:\Program Files\ClaudeCode\`. A `managed-settings.d/` drop-in directory is also supported. Precedence: managed is highest and "can't be overridden by anything," including command-line arguments [S2][S5].

*(inference — no primary source)* Writing to `/Library/Application Support/ClaudeCode/` on macOS requires `sudo`; it is a system-wide path, not per-user. Nothing in the docs restricts the file to MDM delivery — it is described as a plain settings file with a fixed path — so **a solo developer can self-apply it with one `sudo tee`**. It is not an enterprise-only mechanism.

Per-key assessment for this user:

| Key | What it does [S2] | Verdict here |
|---|---|---|
| `disableBypassPermissionsMode: "disable"` | Prevents bypass mode being used | **Do not use.** Would break `/uat-auto-plus`, `power-mode`, and 3 setup scripts. Note: it "works from any scope," so `~/.claude/settings.json` suffices — no managed file needed [S2] |
| `allowManagedPermissionRulesOnly: true` | "prevents user and project settings from defining `allow`, `ask`, or `deny` permission rules. Only rules in managed settings apply" | **Footgun.** Would silently nullify all 72 entries in `~/.claude/settings.json` unless the whole list is relocated into managed settings |
| `allowManagedHooksOnly: true` | "Only managed hooks, SDK hooks, and hooks from plugins force-enabled in managed settings […] are loaded. User, project, and all other plugin hooks are blocked" | **Footgun.** Would disable every hook this repo installs to `~/.claude/hooks/` |

### 8. Preventing bypass without MDM — answered, but not recommended

Yes: set `"permissions": {"disableBypassPermissionsMode": "disable"}` in `~/.claude/settings.json`. "A user can set it in their own settings to lock themselves out of bypass mode" [S2]. Two ambient guards also exist without configuration: Claude Code "refuses to start in this mode when running as root or under `sudo`" on Linux/macOS [S1], and Claude Code on the web "does not honor `defaultMode: \"bypassPermissions\"` […] from your settings files, so a repository's checked-in settings cannot start a cloud session in bypass-permissions mode" [S1].

## Constraints

- Deny rules cannot carry exceptions — "a broad deny rule […] blocks every matching call, including calls that also match a narrower allow rule" [S2]. Mode-independent.
- File permission checks consult **only** `Edit(path)` and `Read(path)`; `Write(...)` rules are accepted but never consulted and warn at startup [S2]. Confirms the prior research's constraint.
- Read/Edit deny rules "don't apply to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself" [S2]. Only the sandbox is OS-level.
- Hook exit-2 blocking is documented but has two (old, closed, unconfirmed) reports of failing under bypass [S6][S7].
- A hook must be *registered* in `~/.claude/settings.json` to run; `install-global.sh` copies scripts but does not wire them (`lib/hooks/README.md:7-10`) [S10]. Any hook-tier deliverable inherits this manual step.

## Control-survival table

| Control | `default` (Manual) | `acceptEdits` | `bypassPermissions` | Source |
|---|---|---|---|---|
| `permissions.deny` | Enforced | Enforced | **Enforced** — applies in every mode | [S1][S2] |
| `permissions.ask` | Prompts | Prompts | **Prompts** — explicitly exempted from bypass | [S1] |
| `permissions.allow` | Pre-approves | Pre-approves | **No effect** (everything already approved) | [S1] |
| PreToolUse hook (exit 2) | Blocks | Blocks | **Blocks** — runs on every tool call; exit 2 stops the call before permission rules are evaluated | [S2][S3] |
| Built-in protected paths (`.claude`, `.zshrc`, `.gitconfig`, `.npmrc`, …) | Prompted | Prompted | **Allowed — protection gone** | [S1] |
| `rm -rf /` / `rm -rf ~` circuit breaker | Prompts | Prompts | **Prompts** (incl. inside `$(…)`/`<(…)` since v2.1.208) | [S1] |
| `/sandbox` (Seatbelt / bubblewrap) | OS-enforced | OS-enforced | **OS-enforced — independent of permission mode** | [S4] |
| Managed settings | Highest precedence | Highest precedence | **Highest precedence**; `disableBypassPermissionsMode` blocks entry to the mode entirely | [S2][S5] |
| `CLAUDE.md` prose | No enforcement | No enforcement | No enforcement | [S2] |

## Recommendation

**Ship the 72-entry deny list, unblocked, exactly as approved.** No re-scoping is needed. The consequence branch written into TASK-026 ("If deny survives bypass → proceed with Step 4 as approved") is the one that fires.

Do not quantify the deny list's value as "real but partial." It is not partial — it is enforced in `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, and `bypassPermissions` alike, for main-session and subagent tool calls, and it cannot be overridden by any allow rule at any scope. The honest framing is the reverse of the task's worry: **A1 and A2 are worth more under bypass than under normal mode**, because bypass switches off the built-in protected-path guard that partially covers those same paths in every other mode.

**Correct layering for this user:**

1. **Tier 1 — deny list (ship now).** 72 entries. Highest-value groups A1 and A2 for the reason above. Enforced everywhere; zero configuration burden on users; already has an additive merge path.
2. **Tier 2 — PreToolUse hook (still worth building, better rationale).** Not because deny fails under bypass, but because deny matches literal spellings and a hook parses commands (`/bin/rm`, `bash -c`, `python -c`, absolute-path fetchers) and can return a *message*. This is the correct home for the package-consent requirement: exit 2 with stderr naming the exact command for the user to run satisfies "tell user the exact command to run if they approve" in a way neither deny nor `ask` can. Prefer it over an `ask` rule, which in a headless `-p` bypass run has nobody to answer.
3. **Tier 3 — `/sandbox` for headless runs.** The only OS-level boundary, and the only control that holds when Claude executes something whose literal text no rule anticipated. Recommend enabling it for the `power-mode` / `uat-auto-plus` path specifically, since that is where 100% of this repo's bypass usage lives. Managed settings are self-applicable via `sudo` on macOS, but avoid `allowManagedPermissionRulesOnly` and `allowManagedHooksOnly` — both would nullify this repo's own deliverables.
4. **Do not set `disableBypassPermissionsMode`.** It would break three setup scripts and two shipped skills.

**Required fix, same task.** `lib/hooks/README.md:14-19` and `:311-312` state that deny rules are not enforced under bypass. This is false and should be corrected in TASK-026 step 4 alongside the "canonical Bash deny list" rewording already on the checklist. Replace the rationale with the parsing/message argument from Tier 2 above. Also worth correcting: `raw/research/agent-sandbox-escape-vectors/index.md:107` claims bypass "still gates writes to `.claude`" — it does not; bypass allows protected-path writes. (That file is immutable `raw/`; note the correction in the wiki page produced by `/wiki-ingest`, do not edit the source.)

**Risks and mitigations.**

- *Hooks may degrade in long bypass sessions* [S6][S7] — old, closed, unconfirmed. Mitigation: never make a hook the sole control for anything the deny list could also cover; keep both.
- *Ask rules deadlock headless runs* — mitigation: do not use `ask` for the package-consent requirement in this repo; use the hook.
- *B2 bare-interpreter set stays held* — this research does not settle per-subcommand decomposition. That remains the open `deny-rules-vs-hooks` question.

## Next Steps

- Unblock and run TASK-026 step 4 with the 72 approved entries; add the `lib/hooks/README.md` correction to that step's doc checklist.
- `/task-add` the Tier-2 PreToolUse class-gate hook in `lib/hooks/`, scoped to (a) interpreter/absolute-path indirection and (b) the package-install consent gate with a suggested-command message.
- `/decision-create` for Tier 3: enable `/sandbox` for `power-mode` and `uat-auto-plus` runs, given those are the repo's entire bypass surface.
- Re-dispatch the held `deny-rules-vs-hooks` research (blocked by the 2026-07-29 API incident) to settle B2.
- `/wiki-ingest raw/research/bypass-mode-enforcement/index.md`.

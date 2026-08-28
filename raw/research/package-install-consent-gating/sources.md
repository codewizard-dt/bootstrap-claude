---
topic: A way to gate the npm/package install-consent hook (lib/hooks/package-install-consent.js) using a sentinel file or a stored user preference instead of always outright blocking npm install/uninstall
slug: package-install-consent-gating
researched: 2026-08-27
---

# Primary Sources — Gating `package-install-consent.js` via a Sentinel/Preference

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/hooks/package-install-consent.js` (header comments + `matchedInstall`/`readHookInput` body) | 2026-08-27 | Full current behavior: manager/subcommand table, Serena allowlist, "why a hook not a deny rule", "why not permissions.ask", "not gated by construction" (installs inside scripts), "Fails: open" contract |
| S2 | codebase | `lib/hooks/lib/command-parse.js::deny` | 2026-08-27 | The exact `deny()` implementation — `permissionDecision: 'deny'`, `process.exit(0)`; confirms no sibling `allow()` helper exists in the shared lib |
| S3 | codebase | `lib/hooks/README.md` (package-install-consent.js section, "Known friction, real and expected") | 2026-08-27 | Confirms the friction is explicitly documented as deliberate, not a bug, with the `frontend-taste` skill's `npm i` as the one named in-repo friction point |
| S4 | codebase | `lib/scripts/README.md` (Preference helper notes, Preference-schema notes, the key registry) | 2026-08-27 | Four-state model (`unset`/settled/`false`/`ask`), scope/consumer/askedBy field contract, `gitCommit.autoPush`'s `detail` field as the "why this default" documentation pattern, "one binary every consumer goes through" design philosophy |
| S5 | codebase | `test/bootstrap-prefs.test.js:2075` (`LEGAL_CONSUMERS`) | 2026-08-27 | Confirms `consumer` is a hardcoded two-value enum (`installer`, `skill`) with no accommodation for a hook-consumed key |
| S6 | codebase | `test/bootstrap-prefs.test.js:2599-2630` (`schema: every askedBy names a real lib/scripts/ file or a real lib/skills/ command`) | 2026-08-27 | The exact `askedBy` resolution rule: `/name` → `lib/skills/<name>/SKILL.md` must exist; bare name (no `/`) → `lib/scripts/<name>` must exist. Neither branch resolves a `lib/hooks/*.js` path |
| S7 | codebase | `lib/scripts/bootstrap-prefs.js` (file header + `resolve()` body; searched for `module.exports`/`require.main`, zero matches) | 2026-08-27 | Confirms this is a pure CLI script with no programmatic export surface — every consumer invokes it as a subprocess |
| S8 | codebase | `search_for_pattern` across `lib/hooks/*.js` and `lib/hooks/README.md` for `bootstrap-prefs`, `sentinel`, `escape hatch` | 2026-08-27 | Confirms zero existing hooks read `bootstrap-prefs`; every documented "escape hatch" for the command-class guards is a command-rephrasing trick, never a stored preference or sentinel file |
| S9 | web | https://code.claude.com/docs/en/hooks | 2026-08-27 | Primary-source confirmation of the `PreToolUse` `hookSpecificOutput` JSON shape and that `permissionDecision` legally takes `"allow"` and `"deny"` (fetched directly; page content did not enumerate `"ask"` in the excerpt retrieved, corroborated separately by S10) |
| S10 | web (search-engine synthesis, secondary) | Brave/web search summarizing `platform.claude.com/docs/en/agent-sdk/hooks`, `code.claude.com/docs/en/hooks`, and third-party guides (pushary.com, blakecrosley.com) | 2026-08-27 | `permissionDecision` supports `"allow"`, `"deny"`, `"ask"`, and `"defer"`; a hook's `deny` holds even under `bypassPermissions`; a hook's `allow` cannot override an existing `permissions.deny` settings rule. **Marked lower-confidence than S9**: this is a search-engine AI summary of multiple secondary sources, not a direct quote verified against Anthropic's primary docs page |
| S11 | codebase (wiki, already-vetted) | `wiki/knowledge/entities/components/bootstrap-claude-hooks.md` | 2026-08-27 | Independently corroborates the full four-value `permissionDecision` enum (`"allow" \| "deny" \| "ask" \| "defer"`) from a prior, separately-researched wiki page — raises S10's `defer` claim from a single lower-confidence secondary source to cross-corroborated. Also surfaces that this exact hook (package-install consent) was already flagged **"Contested"** between two earlier research reports (`deny-rules-vs-hooks` vs. `bypass-mode-enforcement`) over hook-vs-`permissions.ask`, unresolved until this report |

## Excerpts

### S1 — `lib/hooks/package-install-consent.js`
`lib/hooks/package-install-consent.js:19-27`
> Why not `permissions.ask`: `ask` is the natural fit for consent and it works correctly in an interactive session. But this repo routinely runs headless (`claude -p` under /uat-auto-plus and power-mode), where there is no one to answer the prompt — the call then either blocks or hangs, and a consent gate that hangs an unattended run is worse than one that denies with instructions.

`lib/hooks/package-install-consent.js:40-43`
> Fails: open — matching is pure token inspection with no external input, and a throw exits 0 via lib/command-parse.js. The asymmetry that matters here is coverage rather than failure: a manager or invocation form absent from the tables below is allowed, which is also why the scope note above holds.

### S3 — `lib/hooks/README.md`
`lib/hooks/README.md:344-348`
> **Known friction, real and expected.** `lib/skills/frontend-taste/SKILL.md:29` instructs Claude to run `cd ~/code/house-style/preview && npm i && npm run dev`. That command *is* hook-visible and will be gated. It is the one genuine friction point this gate introduces in-repo — not a bug. Approve it by running it yourself.

### S6 — `test/bootstrap-prefs.test.js`
`test/bootstrap-prefs.test.js:2625-2629`
> assert.ok(!askedBy.includes('/'), `${key}.askedBy: "${askedBy}" must be a bare filename or a /slash-command`);
> assert.ok(
>   fs.existsSync(path.join(REPO, 'lib', 'scripts', askedBy)),
>   `${key}.askedBy: lib/scripts/${askedBy} does not exist — the prompt was renamed or removed`
> );

### S9 — Claude Code Docs: Hooks reference
https://code.claude.com/docs/en/hooks
> Example PreToolUse hook JSON output: `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Destructive command blocked by hook"}}`. Returning this JSON with `"permissionDecision": "deny"` blocks the tool call even though the process exits 0.

### S10 — Web search synthesis (Brave/web search results)
(No single URL — aggregated from https://platform.claude.com/docs/en/agent-sdk/hooks, https://code.claude.com/docs/en/hooks, and secondary guides)
> The permissionDecision supports "allow" (runs the tool), "deny" (blocks it), "ask" (escalates to the user)... Hooks fire before permission-mode checks, so a hook's "deny" holds even in bypassPermissions mode — but a hook's "allow" cannot override a settings deny rule. When multiple hooks or permission rules apply, deny takes priority over ask, which takes priority over allow.

### S11 — `wiki/knowledge/entities/components/bootstrap-claude-hooks.md`
> **Structured output**: `hookSpecificOutput.permissionDecision` accepts `"allow" | "deny" | "ask" | "defer"` with a `permissionDecisionReason` (goes to Claude), and a top-level `systemMessage` (goes to the **user**). So a hook can deny-with-explanation rather than blocking silently.
>
> **Contested**: package-install consent. relates_to::[[deny-rules-vs-hooks]] says use `permissions.ask` and do not build a hook (a hook cannot relax an ask rule anyway); relates_to::[[bypass-mode-enforcement]] says use a hook, because an `ask` rule in a headless `-p` bypass run has nobody to answer, and exit-2 stderr can name the exact command for the user to run. Unresolved — the callout on derived_from::[[consent-requires-a-yes-path]] carries both positions.

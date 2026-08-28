---
id: claude-code-authentication
title: Claude Code Authentication & Credential Storage
aliases: [CLAUDE_CODE_OAUTH_TOKEN, claude setup-token, CLAUDE_CONFIG_DIR]
updated: 2026-08-27
sources:
  - ../../../../raw/research/docker-claude-auth-token/index.md
confidence: extracted
tags: [claude-code, authentication, credentials, security]
---

# Claude Code Authentication & Credential Storage

How the `claude` CLI stores and supplies authentication, and the supported ways to authenticate a *separate* environment (CI, a script, a container) against an existing subscription without copying the primary login.

**Storage differs by OS.** macOS keeps the login in the encrypted system **Keychain** — not a file. Linux stores `~/.claude/.credentials.json` (mode `0600`, plaintext JSON, readable by any same-UID process). Windows uses `%USERPROFILE%\.claude\.credentials.json`. Setting `CLAUDE_CONFIG_DIR` relocates `.credentials.json` on Linux/Windows only; it is undocumented whether it also relocates `settings.json`, hooks, MCP registrations, or `projects/` transcripts — treat that as an open question, not a verified isolation boundary.

**Portable credential for headless use: `claude setup-token`.** Runs the same OAuth flow as `/login`, then prints a one-year token to the terminal (never auto-saved). Set as `CLAUDE_CODE_OAUTH_TOKEN` in any environment, it authenticates `claude -p` there using the subscription's included usage. Requires Pro/Max/Team/Enterprise (not a bare API-key account); the token "can only make model requests" — no Remote Control, no claude.ai connectors; doesn't work under `--bare`.

**`ANTHROPIC_API_KEY` is a different credential with different billing**, not a reuse of an existing subscription: it outranks OAuth in Claude Code's authentication precedence and switches billing to standalone pay-as-you-go API usage (sent as the `X-Api-Key` header). Other non-interactive paths that don't require an API key: `CLAUDE_CODE_USE_BEDROCK`/`_VERTEX`/`_FOUNDRY` (cloud-provider credentials) and `ANTHROPIC_AUTH_TOKEN` (bearer token for a gateway/proxy).

**Security notes.** Session transcripts (`~/.claude/projects/<project>/<session>.jsonl`) are not encrypted at rest — anything a tool reads or a command prints ends up there, so a probe session should never be asked to print a token. The docs don't describe independent revocation/scoping for a `setup-token` token short of its one-year expiry.

**Practical use in this repo:** relates_to::[[docker-fresh-machine-test-harness]] — a `CLAUDE_CODE_OAUTH_TOKEN` forwarded as a value-less `docker run -e` (mirroring the existing `BRAVE_API_KEY` forwarding pattern) is the recommended way to run a real, authenticated `claude -p` session inside an otherwise-fresh container, e.g. to verify a PreToolUse hook's `allow`/`defer` decisions are actually honored by Claude Code's live permission pipeline. This repo's `run.sh live-hook` mode (`test/docker/fresh-machine/README.md`) is the concrete implementation — TASK-076. See derived_from::[[docker-claude-auth-token]] for the full analysis. Policy-layer counterpart: relates_to::[[claude-code-permission-system]]; process-isolation counterpart: relates_to::[[claude-code-sandbox]].

**Storing the token on the host.** A `setup-token` token is a real, year-long credential — do not put it in a shell profile or a `.env` file. On macOS, save it to Keychain under a fixed service name and only export it into the shell for the run that needs it:

```sh
security add-generic-password -a "$USER" -s "claude-code-oauth-token-live-hook" -w "<the token>"
# ...later, only when actually running run.sh live-hook:
export CLAUDE_CODE_OAUTH_TOKEN="$(security find-generic-password -a "$USER" -s "claude-code-oauth-token-live-hook" -w)"
```

`claude-code-oauth-token-live-hook` is this repo's standing Keychain service name for this specific token — reuse it rather than inventing a new name, so it stays discoverable (`security delete-generic-password -a "$USER" -s "claude-code-oauth-token-live-hook"` to remove it later).

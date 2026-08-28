---
topic: "Can you piggy back the existing auth we have on the host machine without necessarily copying the related settings"
slug: docker-claude-auth-token
researched: 2026-08-27
---

# Primary Sources — Authenticating a throwaway Docker `claude` session without copying host `~/.claude/`

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `test/docker/fresh-machine/Dockerfile` | 2026-08-27 | Confirms the fresh-machine image is `ubuntu:24.04`, installs `@anthropic-ai/claude-code` globally as root, then runs as non-root `tester` (`HOME=/home/tester`) with no credential ever populated |
| S2 | codebase | `lib/scripts/bootstrap-serena.sh` (lines 41-56) | 2026-08-27 | Shows the existing non-interactive `claude --print "exit"` call, its `\|\| true` swallow, and the downstream `.serena/project.yml`-missing error the harness already tolerates |
| S3 | codebase | `lib/scripts/setup-strict-typechecks.sh:28`, `lib/scripts/setup-deployment.sh:104`, `lib/scripts/migrate-project.sh:228` | 2026-08-27 | Confirms this repo already runs `claude -p --dangerously-skip-permissions` headlessly on the host in three other scripts — established pattern, just never yet done inside the auth-less container |
| S4 | web | https://code.claude.com/docs/en/authentication.md#credential-management | 2026-08-27 | Credential storage locations: macOS Keychain (encrypted, not a file); Linux `~/.claude/.credentials.json` mode `0600`; Windows `%USERPROFILE%\.claude\.credentials.json`; `CLAUDE_CONFIG_DIR` relocates `.credentials.json` on Linux/Windows only |
| S5 | web | https://code.claude.com/docs/en/authentication.md#generate-a-long-lived-token | 2026-08-27 | `claude setup-token` generates a one-year OAuth token via the same `/login` flow, printed to terminal (never auto-saved), settable as `CLAUDE_CODE_OAUTH_TOKEN`; requires Pro/Max/Team/Enterprise; limited to model requests only (no Remote Control, no claude.ai connectors); does not work under `--bare` |
| S6 | web | https://code.claude.com/docs/en/authentication.md#authentication-precedence ; https://platform.claude.com/docs/en/get-api-key.md | 2026-08-27 | `ANTHROPIC_API_KEY` ranks above subscription OAuth in precedence and is billed as standalone pay-as-you-go API usage — sent as the `X-Api-Key` header — distinct from a Pro/Max subscription's included usage |
| S7 | web | https://code.claude.com/docs/en/claude-directory.md | 2026-08-27 | Session transcripts (`~/.claude/projects/<project>/<session>.jsonl`) are not encrypted at rest and will contain any credential a tool reads or a command prints during a session; docs are silent on independent token revocation/scoping beyond expiry |

## Excerpts

### S4 — Claude Code authentication docs, Credential management
https://code.claude.com/docs/en/authentication.md#credential-management
> If you've set the CLAUDE_CONFIG_DIR environment variable on Linux or Windows, the .credentials.json file lives under that directory instead.

### S5 — Claude Code authentication docs, Generate a long-lived token
https://code.claude.com/docs/en/authentication.md#generate-a-long-lived-token
> claude setup-token ... can only make model requests, so it can't establish Remote Control sessions or fetch claude.ai connectors.

### S6 — Claude API get-api-key docs
https://platform.claude.com/docs/en/get-api-key.md
> ANTHROPIC_API_KEY environment variable. Sent as the X-Api-Key header. Use this for direct Anthropic API access with a key from the Claude Console.

### S7 — Claude Code `~/.claude` directory docs
https://code.claude.com/docs/en/claude-directory.md
> Transcripts and history are not encrypted at rest. OS file permissions are the only protection. If a tool reads a .env file or a command prints a credential, that value is written to projects/<project>/<session>.jsonl.

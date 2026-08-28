---
id: docker-claude-auth-token
title: "Research: Authenticating a throwaway Docker claude session without copying host ~/.claude/"
updated: 2026-08-27
sources:
  - ../../../raw/research/docker-claude-auth-token/index.md
confidence: extracted
tags: [claude-code, authentication, docker, fresh-machine-harness]
---

# Research: Authenticating a throwaway Docker `claude` session without copying host `~/.claude/`

Prompted by wanting to exercise the **real** Claude Code hook-dispatch/permission pipeline inside relates_to::[[docker-fresh-machine-test-harness]] (needed to close UAT-MANUAL-001 for TASK-075's `packageInstall.consent` gate — see derived_from::[[package-install-consent-gating]]), without exposing or copying the host's actual login into a container.

**`claude setup-token`** is the documented, purpose-built answer: it runs the normal OAuth login flow once and prints a portable, one-year token that authenticates a *separate* environment against the same Pro/Max/Team/Enterprise subscription — no `~/.claude/` copying, no standalone API-key billing. Set as `CLAUDE_CODE_OAUTH_TOKEN` in the container, it lets `claude -p` run headlessly there with the subscription's included usage. Its only real limitations: it can't establish Remote Control sessions or fetch claude.ai connectors, and it needs a subscription plan (not a bare API-key account) — neither matters for a scripted install-permission probe.

**Why not just copy the credential file.** On macOS the login lives in the encrypted system Keychain, not a file, so there is nothing to copy. On Linux it's `~/.claude/.credentials.json` (mode `0600`) — a broad, unscoped secret that becomes readable by any same-UID process the moment it's mounted into a container. `CLAUDE_CONFIG_DIR` can relocate that file on Linux/Windows, but Anthropic's docs don't state whether it also relocates `settings.json`/hooks/MCP registrations/transcripts, so it isn't a documented "auth-only" isolation knob.

**Billing distinction that matters for "piggybacking."** `ANTHROPIC_API_KEY` outranks subscription OAuth in Claude Code's auth precedence and switches billing to standalone pay-as-you-go API usage — setting it is a *different* credential, not a reuse of the existing subscription. `CLAUDE_CODE_OAUTH_TOKEN` (from `setup-token`) is the option that actually reuses what the host already pays for.

See the full report — `raw/research/docker-claude-auth-token/index.md` — for the harness-integration recommendation (a new opt-in `run.sh live-hook` mode) and `sources.md` for citations.

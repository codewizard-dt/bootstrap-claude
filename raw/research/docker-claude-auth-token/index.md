---
topic: "Can you piggy back the existing auth we have on the host machine without necessarily copying the related settings"
slug: docker-claude-auth-token
researched: 2026-08-27
sources: [./sources.md]
---

# Research: Authenticating a throwaway Docker `claude` session without copying host `~/.claude/`

> **Answer:** Yes. Run `claude setup-token` once on the host to mint a portable, one-year OAuth token (subscription-billed, not a standalone API key), then pass it into the container as a single environment variable — `CLAUDE_CODE_OAUTH_TOKEN=<token> claude -p ...`. This authenticates the container's `claude` CLI using the host's Pro/Max subscription without copying `~/.claude/settings.json`, hooks, MCP registrations, or session transcripts, and without ever exposing the host's actual login credential (macOS Keychain entry or Linux `.credentials.json`) to the container.

## Research Questions

- Where does Claude Code store its authentication state, and is that file/entry itself safely copyable into a container?
- Is there a supported way to relocate/isolate Claude Code's config directory (`CLAUDE_CONFIG_DIR`) so a container could get *just* auth without the rest of `~/.claude/`?
- Is there a supported mechanism to mint a portable credential separate from the interactive login, for exactly this kind of headless/CI/container use case?
- Does using `ANTHROPIC_API_KEY` change the billing model away from an existing Pro/Max subscription?
- What are the risks of this approach, and how does it interact with this repo's Docker fresh-machine harness (`test/docker/fresh-machine/`)?

## Current State (Codebase)

- `test/docker/fresh-machine/Dockerfile` builds a plain `ubuntu:24.04` image, installs `@anthropic-ai/claude-code` globally as root, then switches to a non-root `tester` user (`HOME=/home/tester`) [S1]. Nothing in the image or `run.sh` populates `/home/tester/.claude/` with any credential — the container's Claude Code config starts completely empty on every run.
- `lib/scripts/bootstrap-serena.sh:44-56` already calls `claude --print "exit" >/dev/null 2>&1 || true` non-interactively and treats a missing `.serena/project.yml` afterward as the (expected, tolerated) failure mode inside the fresh-machine harness [S2]. Because stdout/stderr are discarded, the harness cannot currently distinguish "failed because Serena wasn't interactively approved" from "failed because there is no login at all" — both are true simultaneously today, since the container has neither.
- This repo already runs `claude -p --dangerously-skip-permissions` non-interactively in three other places on the **host** machine, where a real login already exists: `lib/scripts/setup-strict-typechecks.sh:28`, `lib/scripts/setup-deployment.sh:104`, and `lib/scripts/migrate-project.sh:228` [S3]. So headless `claude -p` invocation is an established, trusted pattern in this codebase — the only new piece is getting a valid credential into an environment that starts with none.
- No existing wiki page or `raw/research/` report covers Claude Code's credential storage, `CLAUDE_CONFIG_DIR`, or `claude setup-token` — confirmed via `search_for_pattern` across `wiki/` (zero matches) and a directory listing of `raw/research/` (21 existing topics, none overlapping) [codebase check, no source id].

## Key Findings

1. **Where the host's real login lives, and why it isn't portable anyway.** macOS stores it in the encrypted system Keychain — not a file at all, so `~/.claude/.credentials.json` may not even exist on macOS. Linux stores it as plaintext JSON at `~/.claude/.credentials.json`, mode `0600` — readable by any process running as the same UID once copied into a container [S4]. Windows stores the same file shape under `%USERPROFILE%\.claude\`. This directly answers "piggyback without copying settings": the raw credential store is either non-portable (Keychain) or a broad, sensitive secret with no scoping (Linux) — not something to mount into a container even if you wanted only auth and nothing else.

2. **`CLAUDE_CONFIG_DIR` relocates the credential file, but its exact scope beyond that is undocumented.** Anthropic's own docs confirm it moves `.credentials.json` on Linux/Windows (not macOS, where Keychain is used regardless) [S4], but do **not** state whether it also relocates `settings.json`, hooks, MCP registrations, or `projects/` transcripts. Treating it as "the knob that isolates just auth" would be relying on undocumented, unverified behavior — worth flagging as a gap rather than asserting.

3. **`claude setup-token` is the documented, purpose-built mechanism for exactly this use case.** It runs the same OAuth browser flow as `/login`, then prints a long-lived (one-year) token to the terminal — it is not saved anywhere by the CLI itself, so the user copies it out deliberately [S5]. Set as `CLAUDE_CODE_OAUTH_TOKEN` in any environment (CI, script, container), it authenticates `claude -p` using the **subscription's** included usage, with none of `~/.claude/`'s other state required or touched. Two real constraints: it requires a Pro/Max/Team/Enterprise plan (not a standalone API-key account), and it "can only make model requests" — no Remote Control sessions, no claude.ai connectors [S5]. Neither limitation matters for a scripted `claude -p "npm install left-pad"` probe.

4. **`ANTHROPIC_API_KEY` is a different, higher-precedence auth path that switches billing.** Anthropic's authentication precedence ranks a set API key above subscription OAuth entirely, and it bills as standalone pay-as-you-go API usage, not the subscription's included usage [S6]. This is *not* "piggybacking existing auth" in the sense the question asked — it's a separate credential with separate billing. `CLAUDE_CODE_OAUTH_TOKEN` (from `setup-token`) is the option that actually reuses the existing subscription.

5. **The one-line env-var handoff has no `~/.claude/` copy step at all.** `docker run --rm -e CLAUDE_CODE_OAUTH_TOKEN ... image claude -p "..."` (or the value forwarded via `docker run -e CLAUDE_CODE_OAUTH_TOKEN=<token>`) is sufficient — the container's own `~/.claude/` stays exactly as fresh as it is today (no settings.json, no hooks, no MCP registrations, no transcripts), and only the token itself crosses the boundary. This is the cleanest match to "piggyback the auth without necessarily copying the related settings."

## Constraints

- The token is a real, live credential once minted — even though it's not the host's primary login, it's a genuine bearer of the subscription's usage for up to a year. It should be treated with the same care as any secret: not baked into the Docker image, not committed, not printed to a log the container might persist, and passed only as a transient `-e` at `docker run` time (mirroring this repo's existing pattern for `BRAVE_API_KEY` in `install-mcps.sh`, which is also forwarded value-less at exec time rather than baked in [codebase pattern, no source id]).
- Anthropic's docs are silent on whether `setup-token` tokens can be scoped, IP-bound, or individually revoked short of waiting out the one-year expiry or rotating the underlying login — there is no documented "revoke this one token" command distinct from revoking the whole session [S7]. A one-off probe token should be treated as a standing secret until manually invalidated (e.g. by a full re-login on the host, which typically invalidates prior tokens for that account — not independently confirmed by the docs).
- Session transcripts can leak secrets that get printed or read during a session (`~/.claude/projects/<project>/<session>.jsonl`) [S7] — irrelevant to the token itself (never printed by design) but a reason not to have the container's probe prompt ask `claude` to `echo` or `env` the token.
- This only unblocks the `packageInstall.consent = true → allow` verification path from the earlier discussion. It does **not** resolve whether the `ask → defer` case's *interactive native prompt* can be observed — `claude -p` is headless by construction regardless of what credential authenticates it.

## Recommendation

**Add a new, explicit-opt-in mode to the fresh-machine harness** (e.g. `run.sh live-hook`) rather than touching the existing `setup`/`update`/`stale`/`idempotency` modes:

1. Document (in `test/docker/fresh-machine/README.md` or inline) that this mode requires the operator to run `claude setup-token` on the host once and export the result as `CLAUDE_CODE_OAUTH_TOKEN` before invoking `run.sh live-hook`.
2. `run.sh` forwards it with `docker run --rm -e CLAUDE_CODE_OAUTH_TOKEN ...` (value-less `-e`, matching the `BRAVE_API_KEY` pattern already in this repo) — never bake it into the image, never write it to a file inside the container.
3. Inside the container: install this repo's hooks via `install-global.sh --skip-mcps` (registers `package-install-consent.js` for real), seed a scratch project's `packageInstall.consent=true` via `bootstrap-prefs.js`, then run `claude -p "npm install left-pad" --output-format stream-json` (no `--dangerously-skip-permissions`, since the point is to exercise the real permission pipeline) and assert `node_modules/left-pad` exists afterward with zero prompts recorded in the stream.
4. Treat the `ask/defer` case as still human-only — do not attempt to automate observation of an interactive prompt inside a headless `claude -p` run; note this explicitly rather than building a probe that can't actually test it.

**Risks and mitigations:** the token is a real secret for up to a year — mitigate by requiring it as an operator-supplied env var per invocation (never stored in the repo or the image), and by scoping the new harness mode to `--rm` ephemeral containers only (consistent with every existing mode). **Alternative if constraints change:** if Anthropic later documents `CLAUDE_CONFIG_DIR`'s full scope (finding 2), a future revision could isolate the token even further (a per-run tmp config dir containing only `.credentials.json`-equivalent state) — not worth building against undocumented behavior today.

## Next Steps

- `/task-add Add a run.sh live-hook mode to the Docker fresh-machine harness that accepts CLAUDE_CODE_OAUTH_TOKEN, installs this repo's hooks for real, and headlessly verifies packageInstall.consent=true actually lets npm install proceed with zero prompts` — this would close UAT-MANUAL-001's `true`/`allow` gap with real evidence, leaving only the `ask`/`defer` interactive-prompt sub-case as human-only.
- Run `/wiki-ingest raw/research/docker-claude-auth-token/index.md` to fold this into the knowledge base (a natural home would be a new `wiki/knowledge/entities/tools/claude-code-authentication.md` page, cross-linked from `claude-code-sandbox.md` and the Docker harness's component page).

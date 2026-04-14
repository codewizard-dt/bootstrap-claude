# /uat-auth Credential Hygiene Contract

Non-obvious rules that govern `/uat-auth` and any command that consumes its output (`/uat-auto`, `/uat-generator`). These exist because every literal string in a Bash tool call lands in the conversation transcript — which is persistent, cached, and sometimes exported.

## Hard rules
- **No literal credentials ever.** Passwords, tokens, and test-user emails must only appear as env-var expansions (`"$UAT_TEST_PASSWORD"`, `"$UAT_AUTH_TOKEN"`) in Bash calls. Never a literal value in any tool argument, thinking block, or user-facing text.
- **Stable test emails, reused across runs, no teardown.** `uat-user@example.test` / `uat-guest@example.test`. One junk row max per role in dev DB. Masked in all summaries as `test-***@example.test`.
- **Disk usage only in `/tmp/`.** Cookie jars and curl response files go to `/tmp/uat-auth-*.jar` / `/tmp/uat-auth-*.json` at mode 0600, deleted in Phase 6 cleanup.
- **UI auth is cookie injection, never form typing.** API-login first, then `puppeteer_set_cookies`. `puppeteer_type` on password fields is banned. Apps without API login fail-closed (form-only not supported in v1).
- **Never screenshot the login form** or any pre-auth state — screenshots only post-navigation to authenticated pages.

## Scope (v1)
- Roles: `user` (default) + `guest` only. Admin is out of scope — too risky.
- Auth schemes: API login + API signup only. OAuth/SSO out of scope.
- On any fail-closed condition, emit `[FAIL: uat-auth: <reason>]` and exit non-zero.

## Integration points
- `/uat-auto` Step 2.5 scans eligible tests for four auth signals: literal `Authorization:` header, `Bearer` reference, `Auth-Required: true` metadata, or `Page:` URL under configured auth-gated prefix. Any match → invoke `/uat-auth` with role from `Auth-Role:` metadata (default `user`) and `--inject-cookie` when any UI test is eligible.
- `/uat-auto` Step 6 cleanup runs `unset UAT_AUTH_TOKEN UAT_TEST_EMAIL UAT_TEST_PASSWORD UAT_SESSION_COOKIE; rm -f /tmp/uat-auth-*.jar /tmp/uat-auth-*.json` regardless of pass/fail.
- `/uat-generator` emits `Auth-Required: true` + `Auth-Role: user|guest` metadata on auth-gated tests, uses `-H "Authorization: Bearer $UAT_AUTH_TOKEN"` (double quotes for shell expansion), and never writes literal credentials into generated UAT files.

## Why this matters
A false pass is worse than a false fail (ships broken auth). A leaked credential is worse than either (compromises test infrastructure, can be cached indefinitely). The credential-hygiene rules above are load-bearing — do not relax them when editing these commands.

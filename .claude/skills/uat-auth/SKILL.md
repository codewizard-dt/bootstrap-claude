---
name: uat-auth
description: Authenticate a test user and export UAT_AUTH_TOKEN for UAT tools; auto-invoked by /uat-auto on auth-gated tests
model: claude-sonnet-4-6
argument-hint: [--role=user|guest] [--base-url=<url>] [--framework=<better-auth|next-auth|supabase|lucia|custom>] [--login-endpoint=<path>] [--signup-endpoint=<path>] [--token-json-path=<jq-path>] [--cookie-name=<name>] [--email-domain=<domain>] [--signup-extra-fields=<json>]
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Always obey `.docs/guides/task-lifecycle.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# UAT Auth

Authenticates a stable test user for UAT runs and exports a session token into the Bash environment for subsequent API calls and Puppeteer cookie injection. Credentials never touch disk and are never emitted in logs, tool-call arguments, or summaries.

---

## Prime Directive: Credential Hygiene

These rules are **non-negotiable**. A single violation invalidates the run.

- **Never emit a literal credential value** in Bash command text, output, summaries, or tool-call arguments (not even in thinking or reasoning blocks).
- Only **shell-expanded env-var references** (e.g. `"$UAT_TEST_PASSWORD"`) are permitted in command text.
- **Never write credentials to any file** — including `.env*`, cookie jars, log files, screenshots, or scratch scripts.
- **Cookie jars** live only in `/tmp/uat-auth-*.jar` (mode `0600`) and **must be removed** at end of run.
- All user-facing email mentions are **masked** as `test-***@example.com`. Never print the real address.

---

## Scope

- **Roles supported**: `user` (default), `guest`.
- **Out of scope**: admin roles, OAuth/SSO flows (Google, GitHub, magic links). **Fail-closed** immediately with a diagnostic.
- **Stable test emails**: `uat-user@example.com`, `uat-guest@example.com` (default; overridable via `--email-domain`). Reused across runs — **no teardown** of accounts, only of session state.

---

## Forbidden Actions

These actions are **strictly out of scope**. Any attempt MUST trigger immediate fail-closed (exit non-zero). uat-auth authenticates — it does NOT mutate app state. User seeding is the responsibility of the project's fixture/seeding infrastructure.

- **Direct DB writes** (psql, prisma `db execute`, node-pg, drizzle, supabase SQL editor) to create/modify/verify users or sessions.
- **Hand-hashing passwords** (scrypt, bcrypt, argon2, @noble/hashes) to force-reset credential hashes.
- **Session forging** — inserting rows into `session` / `sessions` / `auth_sessions` tables.
- **Bypassing email verification** — flipping `emailVerified` flags, deleting tokens, editing `verification_token`.
- **Harvesting app secrets** — reading `BETTER_AUTH_SECRET` / `NEXTAUTH_SECRET` / `JWT_SECRET` to mint tokens out-of-band.
- **Running migrations or seed scripts** (`prisma migrate`, `npm run seed`, `drizzle-kit push`).

If the login/signup path cannot succeed within these boundaries, fail-closed with the most specific Phase 3b diagnostic and exit non-zero. Pre-seed a verified fixture account before retrying — this is a test-infrastructure concern, not an auth concern.

```
[FAIL: uat-auth: forbidden action attempted (<action>) — uat-auth does not mutate app state; seed the test user in fixture infra and retry]
```

---

## Phase 1: Detect Auth Scheme

Read `CLAUDE.md`, `README.md`, and `.env.example` for auth-scheme hints: `JWT_SECRET`, `AUTH_ENDPOINT`, `SESSION_SECRET`; route literals (`/api/auth/login`, `/auth/signin`); framework signals (NextAuth, Supabase, Clerk, Auth0, Lucia, Better Auth).

After detection, export these vars before Phase 3:

```
UAT_LOGIN_URL    — absolute URL (e.g. http://localhost:3000/api/auth/sign-in/email)
UAT_SIGNUP_URL   — absolute URL (e.g. http://localhost:3000/api/auth/sign-up/email)
UAT_TOKEN_JQ     — jq expression to extract the token (default: '.token // .access_token // .data.token')
UAT_COOKIE_NAME  — session cookie name (default: 'session')
```

Guard (run before Phase 3; abort if either URL is unset):

```bash
[ -n "${UAT_LOGIN_URL:-}" ]  || { echo "[FAIL: uat-auth: UAT_LOGIN_URL unset after Phase 1]"; exit 1; }
[ -n "${UAT_SIGNUP_URL:-}" ] || { echo "[FAIL: uat-auth: UAT_SIGNUP_URL unset after Phase 1]"; exit 1; }
```

Override args:

- `--base-url=<url>` — base URL prepended to relative endpoints (default: `http://localhost:3000`; auto-fallback to `$PUBLIC_SITE_URL` / `$BETTER_AUTH_URL` / `$NEXTAUTH_URL`)
- `--login-endpoint=<path>` — login URL path
- `--signup-endpoint=<path>` — signup URL path
- `--token-json-path=<jq-path>` — token jq expression (default `.token // .access_token // .data.token`)
- `--cookie-name=<name>` — session cookie name (default `session`)
- `--email-domain=<domain>` — email domain for test accounts (default: `example.com`)
- `--framework=<better-auth|next-auth|supabase|lucia|custom>` — signup payload adapter (default: auto-detect)
- `--signup-extra-fields=<json>` — JSON merged into signup body (required for `custom`; see Phase 3)

If no scheme is determinable and no overrides are provided:

```
[FAIL: uat-auth: auth scheme undetectable — pass --login-endpoint and --signup-endpoint, or add AUTH_ENDPOINT hints to CLAUDE.md]
```

---

## Phase 2: Resolve Credentials

`example.com` is RFC 2606 reserved and passes strict email validators (Zod, Better Auth). `.test` is RFC 6761 but rejected by many schema validators.

**Email** (domain defaults to `example.com`, overridable via `--email-domain`):
- `--role=user` (default) → `uat-user@example.com`
- `--role=guest` → `uat-guest@example.com`
- With `--email-domain=<d>`: `uat-<role>@<d>`. Masked form is always `test-***@<domain>`.

**Password**: use `$UAT_TEST_PASSWORD` if set; otherwise `openssl rand -base64 24` captured directly into the env var. **Never print, never write to disk.**

Export `UAT_TEST_EMAIL` and `UAT_TEST_PASSWORD` for this run only; unset in cleanup.

---

## Phase 3: Login-First, Signup-Fallback

**IMPORTANT — Shell state does NOT persist between Bash tool calls.**
Each Bash call spawns a fresh shell; `export` in call N is NOT visible in call N+1.
The entire Phase 3 login→signup→retry sequence MUST run inside ONE Bash invocation.
Token handoff to Phase 4 uses `/tmp/uat-auth-token` (mode 0600).

**Signup payload adapters** (auto-detect via `package.json` deps; override with `--framework`):

```
better-auth  → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD","name":"UAT $UAT_ROLE"}
next-auth    → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD","csrfToken":"$CSRF"}
supabase     → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD"}  (POST /auth/v1/signup, apikey header)
lucia        → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD","username":"uat-$UAT_ROLE"}
custom       → require --signup-extra-fields='<json>' merged into body
```

Auto-detect: `"better-auth"` → better-auth; `"next-auth"` → next-auth; `"@supabase/supabase-js"` or `SUPABASE_URL` → supabase; `"lucia"` → lucia; otherwise → custom (fail-closed without `--signup-extra-fields`).

For `custom` or any extra-fields case:

```bash
BODY=$(jq -cn \
  --arg email "$UAT_TEST_EMAIL" \
  --arg pw    "$UAT_TEST_PASSWORD" \
  --argjson  extra "${UAT_SIGNUP_EXTRA_FIELDS:-{}}" \
  '{email:$email, password:$pw} + $extra')
```

### All-in-one Phase 3 (single Bash invocation)

```bash
# All-in-one Phase 3 (single Bash invocation)
set -u
LOGIN_STATUS=$(curl -sS -o /tmp/uat-auth-resp.json -w '%{http_code}' \
  -X POST "$UAT_LOGIN_URL" -H 'Content-Type: application/json' \
  --data-binary @- <<EOF
{"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD"}
EOF
)
case "$LOGIN_STATUS" in
  2??) TOKEN=$(jq -r "$UAT_TOKEN_JQ" /tmp/uat-auth-resp.json) ;;
  401|404)
    # Signup with framework-aware body (see adapter subsection for $BODY construction)
    SIGNUP_STATUS=$(curl -sS -o /tmp/uat-auth-resp.json -w '%{http_code}' \
      -X POST "$UAT_SIGNUP_URL" -H 'Content-Type: application/json' \
      --data "$BODY")
    # Phase 3b: classify signup response before retry
    CODE=$(jq -r '.code // .error // .message // "UNKNOWN"' /tmp/uat-auth-resp.json 2>/dev/null || echo UNKNOWN)
    case "$CODE" in
      INVALID_EMAIL|invalid_email)
        echo "[FAIL: uat-auth: email validator rejects domain '${UAT_EMAIL_DOMAIN:-example.com}' — pass --email-domain=example.com or another RFC-2606 domain]"
        rm -f /tmp/uat-auth-resp.json; exit 1 ;;
      EMAIL_NOT_VERIFIED|email_not_verified|verify_email)
        echo "[FAIL: uat-auth: email verification required but no mailer configured — pre-seed a verified fixture user or disable requireEmailVerification in the test env]"
        rm -f /tmp/uat-auth-resp.json; exit 1 ;;
      VALIDATION_ERROR|validation_error)
        echo "[FAIL: uat-auth: signup payload rejected — framework='${UAT_FRAMEWORK:-auto}' expected fields not present; pass --signup-extra-fields='<json>']"
        rm -f /tmp/uat-auth-resp.json; exit 1 ;;
      *) : ;;
    esac
    case "$SIGNUP_STATUS" in
      2??) : ;; # proceed to retry login
      *) echo "[FAIL: uat-auth: signup failed — $SIGNUP_STATUS]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
    esac
    # Retry login exactly once
    LOGIN_STATUS=$(curl -sS -o /tmp/uat-auth-resp.json -w '%{http_code}' \
      -X POST "$UAT_LOGIN_URL" -H 'Content-Type: application/json' \
      --data-binary @- <<EOF2
{"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD"}
EOF2
    )
    case "$LOGIN_STATUS" in
      2??) TOKEN=$(jq -r "$UAT_TOKEN_JQ" /tmp/uat-auth-resp.json) ;;
      401|403) echo "[FAIL: uat-auth: user exists with unknown password — pre-seed fixture with known UAT_TEST_PASSWORD; uat-auth will not mutate user records]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
      *) echo "[FAIL: uat-auth: login failed after signup — $LOGIN_STATUS]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
    esac ;;
  403)
    CODE=$(jq -r '.code // .error // .message // "UNKNOWN"' /tmp/uat-auth-resp.json 2>/dev/null || echo UNKNOWN)
    case "$CODE" in
      EMAIL_NOT_VERIFIED|email_not_verified|verify_email)
        echo "[FAIL: uat-auth: email verification required but no mailer configured — pre-seed a verified fixture user or disable requireEmailVerification in the test env]"
        rm -f /tmp/uat-auth-resp.json; exit 1 ;;
      *) echo "[FAIL: uat-auth: login failed — $LOGIN_STATUS ($CODE)]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
    esac ;;
  429) echo "[FAIL: uat-auth: rate-limited — wait and retry, or disable rate limiting in the test env]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
  5??) echo "[FAIL: uat-auth: app error $LOGIN_STATUS — check app logs; uat-auth will not retry 5xx]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
  *) echo "[FAIL: uat-auth: login failed — $LOGIN_STATUS]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
esac
printf '%s' "$TOKEN" > /tmp/uat-auth-token && chmod 0600 /tmp/uat-auth-token
rm -f /tmp/uat-auth-resp.json
```

Do NOT print the response body — it may contain secrets, session IDs, or reflected credentials.

### Phase 3b: Signup response classification

| Observed | Diagnostic |
|---|---|
| Signup 400 with INVALID_EMAIL / invalid_email | `[FAIL: uat-auth: email validator rejects domain '<domain>' — pass --email-domain=example.com or another RFC-2606 domain]` |
| Signup 2xx, retry login 401/403 | `[FAIL: uat-auth: user exists with unknown password — pre-seed fixture with known UAT_TEST_PASSWORD; uat-auth will not mutate user records]` |
| Signup 400 with VALIDATION_ERROR | `[FAIL: uat-auth: signup payload rejected — framework='<detected>' expected fields not present; pass --signup-extra-fields='<json>']` |
| Login 403 with email_not_verified / EMAIL_NOT_VERIFIED / verify_email | `[FAIL: uat-auth: email verification required but no mailer configured — pre-seed a verified fixture user or disable requireEmailVerification in the test env]` |
| Login 429 | `[FAIL: uat-auth: rate-limited — wait and retry, or disable rate limiting in the test env]` |
| Any 5xx | `[FAIL: uat-auth: app error <status> — check app logs; uat-auth will not retry 5xx]` |

---

## Phase 4: UI Session Injection

For UI tests, the caller must pass `--inject-cookie` (set by `/uat-auto` when Puppeteer is active). Use `puppeteer_set_cookies` with:
- `name=<cookie-name>` (from `--cookie-name`, default `session`)
- `value=$UAT_AUTH_TOKEN` (or `$UAT_SESSION_COOKIE` if the app uses a separate session cookie)
- `domain` derived from the test's `Page:` URL; `path=/`; `httpOnly=true`; `secure=true` when URL is `https`

**Never** use `puppeteer_type` to enter a password into a login form. If the app has no API login and requires form login, **fail-closed**:

```
[FAIL: uat-auth: app requires form login — not supported in v1 for credential-safety]
```

---

## Phase 5: Masked Summary

Emit **exactly** this format to stdout. No variables are interpolated into the text — only the mask is shown (domain reflects `--email-domain` override if set):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UAT AUTH READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Role:     user
Email:    test-***@example.com
Token:    $UAT_AUTH_TOKEN (env var, not printed)
Cookie:   injected into Puppeteer (if --inject-cookie)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 6: Cleanup Contract

The caller is responsible for invoking cleanup when done. Note: `/uat-auto` Step 6 must also `rm -f /tmp/uat-auth-token` as part of its cleanup.

```bash
unset UAT_AUTH_TOKEN UAT_TEST_EMAIL UAT_TEST_PASSWORD UAT_SESSION_COOKIE \
      UAT_LOGIN_URL UAT_SIGNUP_URL UAT_TOKEN_JQ UAT_COOKIE_NAME \
      UAT_SIGNUP_EXTRA_FIELDS UAT_ROLE
rm -f /tmp/uat-auth-*.jar /tmp/uat-auth-*.json /tmp/uat-auth-token
```

`/uat-auto` performs this in its Step 6 **regardless of pass/fail** outcome.

---

## Important Rules

### No interaction
- **No `AskUserQuestion`**, no prompts, no clarifying questions. On any ambiguity, **fail-closed** with a diagnostic and exit non-zero.
### No literal credentials
- Every Bash call uses `"$UAT_TEST_PASSWORD"` shell expansion. The agent must **never** emit the literal value in any tool-call argument, thinking block, summary, or output.
### No disk persistence
- Cookie jars live only in `/tmp/` (mode `0600`) and are deleted at end of run. No `.env*` writes, no log files, no scratch scripts.
### No screenshots of login state
- Screenshots must be **post-navigation to an authenticated page** — never of a filled login form or credential fields.
### No OAuth/SSO / admin
- OAuth, SSO, magic-link, and admin-role flows are out of scope. **Fail-closed** if requested.
### No app-state mutation
- uat-auth never writes to the app DB, never runs migrations, never invokes seed scripts. See Forbidden Actions. Failures requiring app-state mutation are the test-infra team's problem, not uat-auth's.
### Single-shell-call contract
- The Phase 3 login→signup→retry sequence is one atomic Bash call. Splitting across invocations is forbidden because env vars do not persist between shell spawns. Token handoff uses `/tmp/uat-auth-token` (mode 0600).

---

## Begin Auth

Now execute Phase 1 through Phase 6 in order:

1. **Phase 1** — detect auth scheme, export `UAT_LOGIN_URL` / `UAT_SIGNUP_URL` / `UAT_TOKEN_JQ` / `UAT_COOKIE_NAME`. Guard: both URLs non-empty before Phase 3.
2. **Phase 2** — resolve role-based email (default domain `example.com`, overridable via `--email-domain`) and password (env var or `openssl rand`). Export into the Bash session.
3. **Phase 3** — ONE Bash call: login → on 401/404 signup with framework adapter → retry login once. On any unrecoverable state (INVALID_EMAIL, EMAIL_NOT_VERIFIED, VALIDATION_ERROR, unknown-password conflict), emit the Phase 3b diagnostic and exit non-zero. Never touch the DB.
4. **Phase 4** — if `--inject-cookie`, set Puppeteer cookie. Never type passwords.
5. **Phase 5** — emit the masked summary with domain-aware mask.
6. **Phase 6** — caller (`/uat-auto`) runs the full cleanup contract.

**Start now — detect the auth scheme and begin.**

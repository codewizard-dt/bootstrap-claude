# 004 — Harden `/uat-auth` Against Real-World Auth Stacks

## Objective

Rewrite `.claude/commands/uat-auth.md` so that the observed error loop (empty `$UAT_LOGIN_URL`, `.test`-TLD rejection, email-verification gate, shell-state loss between Bash calls, and escalation into direct DB manipulation) is impossible — by closing each gap with explicit export steps, compatible defaults, per-framework signup adapters, and a hard fail-closed boundary that forbids DB/hash/session tampering.

## Approach

Restructure the existing Phase 1–6 spec to (a) require explicit `export UAT_LOGIN_URL` / `UAT_SIGNUP_URL` with non-empty guards, (b) switch the default test domain from `@example.test` to `@example.com` (RFC 2606, passes strict validators like Better Auth/Zod), (c) mandate a single-Bash-call execution model for Phase 3, (d) add framework-aware signup-payload adapters (Better Auth, NextAuth credentials, Supabase, Lucia), and (e) add a new **Forbidden Actions** section with strict fail-closed diagnostics for the three unrecoverable conditions (validator-rejected domain, verification gate, unknown-password conflict). Strict-boundary variant confirmed — uat-auth never mutates app state; fixture seeding is out of scope.

## Prerequisites

- [ ] `.claude/commands/uat-auth.md` exists at current template version
- [ ] `update-project.sh` syncs `.claude/commands/` into target projects (so this fix propagates)
- [ ] Familiarity with the original error loop: curl-missing-URL → `INVALID_EMAIL` → `VALIDATION_ERROR` → `requireEmailVerification: true` → agent attempted DB/scrypt/session-forge recovery

---

## Steps

### 1. Rewrite Phase 1 — Detect AND export endpoint env vars  <!-- agent: general-purpose -->

- [ ] Modify `.claude/commands/uat-auth.md` Phase 1 section (currently lines 36–56) so the detection step is not just "read files" but "detect AND export, then guard"
  - After the detection bullet list, add an explicit exported-variable contract:
    ```
    After detection, the following env vars MUST be exported into the Bash
    session before Phase 3 can run:

      UAT_LOGIN_URL    — absolute URL (e.g. http://localhost:3000/api/auth/sign-in/email)
      UAT_SIGNUP_URL   — absolute URL (e.g. http://localhost:3000/api/auth/sign-up/email)
      UAT_TOKEN_JQ     — jq expression to extract the token (default: '.token // .access_token // .data.token')
      UAT_COOKIE_NAME  — session cookie name (default: 'session')
    ```
  - Add a guard snippet the agent must run before proceeding to Phase 3:
    ```bash
    [ -n "${UAT_LOGIN_URL:-}" ]  || { echo "[FAIL: uat-auth: UAT_LOGIN_URL unset after Phase 1]"; exit 1; }
    [ -n "${UAT_SIGNUP_URL:-}" ] || { echo "[FAIL: uat-auth: UAT_SIGNUP_URL unset after Phase 1]"; exit 1; }
    ```
- [ ] Extend the overrides list (currently `--login-endpoint`, `--signup-endpoint`, `--token-json-path`, `--cookie-name`) with:
  - `--base-url=<url>` — app base URL prepended to relative endpoints (default: `http://localhost:3000`, auto-fallback to `$PUBLIC_SITE_URL` / `$BETTER_AUTH_URL` / `$NEXTAUTH_URL` when set)
  - `--email-domain=<domain>` — email domain for test accounts (default: `example.com`)
  - `--framework=<better-auth|next-auth|supabase|lucia|custom>` — selects signup payload adapter (default: auto-detect)
- [ ] Update the undetectable-scheme diagnostic to mention the new args:
  ```
  [FAIL: uat-auth: auth scheme undetectable — pass --login-endpoint and --signup-endpoint, or add AUTH_ENDPOINT hints to CLAUDE.md]
  ```

### 2. Rewrite Phase 2 — Safer default email domain  <!-- agent: general-purpose -->

- [ ] In Phase 2 of `.claude/commands/uat-auth.md` (currently lines 59–72), change the hardcoded `.test` TLD to a domain that passes strict validators
  - Replace `uat-user@example.test` → `uat-user@example.com`
  - Replace `uat-guest@example.test` → `uat-guest@example.com`
  - Update mask `test-***@example.test` → `test-***@example.com` (Phase 5 summary also, line 133)
- [ ] Add a one-line rationale comment: "`example.com` is RFC 2606 reserved and passes strict email validators (Zod, Better Auth). `.test` is RFC 6761 but rejected by many schema validators."
- [ ] Document the `--email-domain` override interaction:
  - When `--email-domain=<d>` is passed, email becomes `uat-<role>@<d>` (e.g. `--email-domain=uat.local` → `uat-user@uat.local`)
  - Masked form is always `test-***@<domain>` regardless of override
- [ ] Keep password resolution unchanged: `$UAT_TEST_PASSWORD` env, fall back to `openssl rand -base64 24`

### 3. Rewrite Phase 3 — Single-Bash-call execution + framework adapters  <!-- agent: general-purpose -->

- [ ] Add a bold warning at the top of Phase 3 in `.claude/commands/uat-auth.md` (currently lines 74–101):
  ```
  **IMPORTANT — Shell state does NOT persist between Bash tool calls.**
  Each Bash call spawns a fresh shell; `export` in call N is NOT visible in call N+1.
  The entire Phase 3 login→signup→retry sequence MUST run inside ONE Bash
  invocation. Any token extraction that must be visible to subsequent calls
  MUST be written to /tmp/uat-auth-token (mode 0600) and sourced by later calls.
  ```
- [ ] Add a framework-payload adapter subsection listing exact JSON bodies per framework:
  ```
  ### Signup payload adapters (select via --framework, default auto-detect)

  better-auth  → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD","name":"UAT $UAT_ROLE"}
  next-auth    → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD","csrfToken":"$CSRF"}
  supabase     → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD"}  (POST /auth/v1/signup, header apikey: $SUPABASE_ANON_KEY)
  lucia        → {"email":"$UAT_TEST_EMAIL","password":"$UAT_TEST_PASSWORD","username":"uat-$UAT_ROLE"}
  custom       → require --signup-extra-fields='<json>' merged into the body

  Auto-detect rules:
    - package.json deps include "better-auth" → better-auth
    - package.json deps include "next-auth"   → next-auth
    - package.json deps include "@supabase/supabase-js" OR env has SUPABASE_URL → supabase
    - package.json deps include "lucia"       → lucia
    - otherwise → custom (require --signup-extra-fields or fail-closed)
  ```
- [ ] Add a `--signup-extra-fields=<json>` arg to the override list in Phase 1 (cross-reference) — merged into the signup body via `jq`:
  ```bash
  BODY=$(jq -cn \
    --arg email "$UAT_TEST_EMAIL" \
    --arg pw    "$UAT_TEST_PASSWORD" \
    --argjson  extra "${UAT_SIGNUP_EXTRA_FIELDS:-{}}" \
    '{email:$email, password:$pw} + $extra')
  ```
- [ ] Replace the Phase 3 login→signup→retry curl sequence with a **single Bash call** template that chains all steps with `&&`/`||` and guarded early exits — no split across tool calls:
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
      # Signup with framework-aware body, then retry login ONCE
      # (see adapter subsection for $BODY construction)
      SIGNUP_STATUS=$(curl -sS -o /tmp/uat-auth-resp.json -w '%{http_code}' \
        -X POST "$UAT_SIGNUP_URL" -H 'Content-Type: application/json' \
        --data "$BODY")
      # classify-and-fail-closed (see Phase 3b below) before retry
      ... ;;
    *) echo "[FAIL: uat-auth: login failed — $LOGIN_STATUS]"; rm -f /tmp/uat-auth-resp.json; exit 1 ;;
  esac
  printf '%s' "$TOKEN" > /tmp/uat-auth-token && chmod 0600 /tmp/uat-auth-token
  rm -f /tmp/uat-auth-resp.json
  ```
- [ ] Add a **Phase 3b — Signup response classification** subsection that maps common signup-failure bodies to fail-closed diagnostics (covered in detail in Step 4):
  - On signup non-2xx, extract `.code // .error // .message` from the response body
  - Match against known unrecoverable codes and exit with the appropriate diagnostic
  - On signup 2xx but retry-login still 401, treat as "user exists with unknown password" → fail-closed

### 4. Add Forbidden Actions + new fail-closed diagnostics  <!-- agent: general-purpose -->

- [ ] Insert a new `## Forbidden Actions` section in `.claude/commands/uat-auth.md` between the current `## Scope` (line 28) and `## Phase 1` (line 36). Content:
  ```
  ## Forbidden Actions

  These actions are **strictly out of scope** for uat-auth. Any attempt MUST
  trigger immediate fail-closed (exit non-zero with the diagnostic below).
  uat-auth authenticates — it does NOT mutate app state. User seeding is the
  responsibility of the project's fixture/seeding infrastructure.

  - **Direct DB writes** (psql, prisma `db execute`, node-pg `INSERT/UPDATE`,
    `drizzle` studio, supabase SQL editor) to create, modify, verify, or
    impersonate users or sessions.
  - **Hand-hashing passwords** (scrypt, bcrypt, argon2, @noble/hashes) to
    force-reset a test user's credential hash in the DB.
  - **Session forging** — inserting rows into `session` / `sessions` /
    `auth_sessions` tables to bypass the login endpoint.
  - **Bypassing email verification** by flipping `emailVerified` flags,
    deleting verification tokens, or editing the `verification_token` table.
  - **Harvesting app secrets** — sourcing the app's `.env`, reading
    `BETTER_AUTH_SECRET` / `NEXTAUTH_SECRET` / `JWT_SECRET` to mint tokens
    out-of-band.
  - **Running migrations or seed scripts** (`prisma migrate`, `npm run seed`,
    `drizzle-kit push`) from within uat-auth.

  If the login/signup path cannot succeed within these boundaries, fail-closed
  with the most specific diagnostic from Phase 3b and exit non-zero. The user
  must pre-seed a verified fixture account with a known password in the test
  environment before re-running /uat-auth. This is a test-infrastructure
  concern, not an auth concern.

  **Diagnostic if a forbidden action is observed in progress:**
  [FAIL: uat-auth: forbidden action attempted (<action>) — uat-auth does not mutate app state; seed the test user in fixture infra and retry]
  ```
- [ ] Add the new fail-closed diagnostics to the Phase 3b classification table (continuation of Step 3's classification work):
  ```
  | Observed                                       | Diagnostic                                                                                                                                   |
  |------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
  | Signup 400 with INVALID_EMAIL / invalid_email   | [FAIL: uat-auth: email validator rejects domain '<domain>' — pass --email-domain=example.com or another RFC-2606 domain]                      |
  | Signup 2xx, retry login 401/403                 | [FAIL: uat-auth: user exists with unknown password — pre-seed fixture with known UAT_TEST_PASSWORD; uat-auth will not mutate user records]    |
  | Signup 400 with VALIDATION_ERROR                | [FAIL: uat-auth: signup payload rejected — framework='<detected>' expected fields not present; pass --signup-extra-fields='<json>']            |
  | Login 403 with email_not_verified / EMAIL_NOT_VERIFIED / verify_email | [FAIL: uat-auth: email verification required but no mailer configured — pre-seed a verified fixture user or disable requireEmailVerification in the test env] |
  | Login 429                                      | [FAIL: uat-auth: rate-limited — wait and retry, or disable rate limiting in the test env]                                                      |
  | Any 5xx                                        | [FAIL: uat-auth: app error <status> — check app logs; uat-auth will not retry 5xx]                                                             |
  ```
  - This table goes inside Phase 3 (Phase 3b subsection) so classification happens immediately after each curl
- [ ] Classification code pattern to include in Phase 3b (single Bash call):
  ```bash
  CODE=$(jq -r '.code // .error // .message // "UNKNOWN"' /tmp/uat-auth-resp.json 2>/dev/null || echo UNKNOWN)
  case "$CODE" in
    INVALID_EMAIL|invalid_email)        echo "[FAIL: uat-auth: email validator rejects domain ...]"; exit 1 ;;
    EMAIL_NOT_VERIFIED|email_not_verified|verify_email) echo "[FAIL: uat-auth: email verification required ...]"; exit 1 ;;
    VALIDATION_ERROR|validation_error)  echo "[FAIL: uat-auth: signup payload rejected ...]"; exit 1 ;;
    *) : ;;
  esac
  ```

### 5. Update Phase 5 masked summary + Phase 6 cleanup  <!-- agent: general-purpose -->

- [ ] In Phase 5 (currently lines 123–137), update the masked email to `test-***@example.com` (or `test-***@<--email-domain>` when overridden) — the mask is always `test-***@<domain>`, never the literal `uat-user`
- [ ] Add the token-file path to the cleanup contract in Phase 6 (currently lines 141–150):
  ```bash
  unset UAT_AUTH_TOKEN UAT_TEST_EMAIL UAT_TEST_PASSWORD UAT_SESSION_COOKIE \
        UAT_LOGIN_URL UAT_SIGNUP_URL UAT_TOKEN_JQ UAT_COOKIE_NAME \
        UAT_SIGNUP_EXTRA_FIELDS UAT_ROLE
  rm -f /tmp/uat-auth-*.jar /tmp/uat-auth-*.json /tmp/uat-auth-token
  ```
- [ ] Note in Phase 6 that `/uat-auto` Step 6 must also `rm -f /tmp/uat-auth-token` — cross-reference only; do NOT modify `/uat-auto` in this task

### 6. Update Important Rules section  <!-- agent: general-purpose -->

- [ ] In the `## Important Rules` section (currently lines 154–171) of `.claude/commands/uat-auth.md`, add two new rule subsections:
  - **### No app-state mutation** — "uat-auth never writes to the app DB, never runs migrations, never invokes seed scripts. See Forbidden Actions above. Failures that would require app-state mutation are the test-infra team's problem, not uat-auth's."
  - **### Single-shell-call contract** — "The Phase 3 login→signup→retry sequence is one atomic Bash call. Splitting it across multiple Bash invocations is forbidden because env vars do not persist between shell spawns. Token handoff to Phase 4 uses the `/tmp/uat-auth-token` file (mode 0600)."
- [ ] Leave the existing rules (No interaction, No literal credentials, No disk persistence, No screenshots of login state, No OAuth/SSO / admin) unchanged

### 7. Update the "Begin Auth" execution checklist  <!-- agent: general-purpose -->

- [ ] In `## Begin Auth` (currently lines 175–186) of `.claude/commands/uat-auth.md`, update the numbered sequence to reflect the new shape:
  ```
  1. **Phase 1** — detect auth scheme, export UAT_LOGIN_URL / UAT_SIGNUP_URL /
     UAT_TOKEN_JQ / UAT_COOKIE_NAME. Guard: both URLs non-empty before Phase 3.
  2. **Phase 2** — resolve role-based email (default domain example.com,
     overridable via --email-domain) and password (env or openssl rand).
  3. **Phase 3** — ONE Bash call: login → on 401/404 signup with framework
     adapter → retry login once. On any unrecoverable state (INVALID_EMAIL,
     EMAIL_NOT_VERIFIED, VALIDATION_ERROR, unknown-password conflict), emit
     the Phase 3b diagnostic and exit non-zero. Never touch the DB.
  4. **Phase 4** — if --inject-cookie, set Puppeteer cookie. Never type passwords.
  5. **Phase 5** — emit the masked summary with domain-aware mask.
  6. **Phase 6** — caller (/uat-auto) runs the full cleanup contract.
  ```

### 8. Verification  <!-- agent: general-purpose -->

- [ ] Open the rewritten `.claude/commands/uat-auth.md` and confirm it contains the following markers (grep via `mcp__serena__search_for_pattern` with `relative_path=".claude/commands/uat-auth.md"`):
  - `Forbidden Actions` (new section header)
  - `UAT_LOGIN_URL unset after Phase 1` (new guard diagnostic)
  - `--email-domain` (new override arg)
  - `--framework` (new override arg)
  - `--signup-extra-fields` (new override arg)
  - `@example.com` (new default mask) — and no remaining `@example.test` literals
  - `EMAIL_NOT_VERIFIED` (new classification code)
  - `forbidden action attempted` (new diagnostic string)
  - `Shell state does NOT persist between Bash tool calls` (new warning)
  - `uat-auth does not mutate app state` (new rule)
- [ ] Confirm these forbidden-action guards appear verbatim (none of these strings should appear as *allowed* patterns anywhere):
  - No `prisma db execute` shown as a legitimate path
  - No `scryptAsync` / `scrypt` referenced as a legitimate path
  - No `INSERT INTO session` or `INSERT INTO "user"` as a legitimate path
- [ ] Confirm the file still has all six Phase sections (1–6) and that Phase 3 now contains a Phase 3b subsection
- [ ] Run `wc -l .claude/commands/uat-auth.md` — expected ~230–300 lines after the additions (current is ~187)
- [ ] Manually re-read the "Begin Auth" section to confirm the numbered steps match the new Phase 1/3 behavior
- [ ] Cross-check: `.claude/commands/uat-auto.md` Step 6 cleanup already `rm -f`s `/tmp/uat-auth-*` — confirm the new `/tmp/uat-auth-token` is covered by the existing glob (it is). No change to `/uat-auto` required in this task.

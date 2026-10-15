---
id: UAT-0109
aliases: [UAT-0109]
title: "UAT: Surface the /usage-report JSON in the wiki dashboard (read-only /api/usage endpoint + #/usage panel)"
status: pending
task: TASK-0109
created: 2026-09-19
updated: 2026-09-19
---

# UAT-0109 — UAT: Surface the /usage-report JSON in the wiki dashboard (read-only /api/usage endpoint + #/usage panel)

implements::[[TASK-0109]]

> **Source task**: [[TASK-0109]]
> **Generated**: 2026-09-19

---

## Prerequisites

- [ ] Repo checked out at the TASK-0109 implementation (`lib/scripts/wiki-dashboard-server.js` serves `/api/usage`; `lib/skills/usage-report/scripts/usage-report.js` present)
- [ ] Node.js available (`node --test` runner; no other dependencies). `curl` and `jq` on PATH for the command-runnable cases
- [ ] Commands are file-scoped on purpose: the whole `npm test` suite is not a valid oracle here (in-flight sibling-task failures). Do **not** run `node --test test/` (fails on Node v26)
- [ ] Unit-backed cases are hermetic: the server tests use a stub script (`test/fixtures/wiki-dashboard/usage-stub.js`) and never read real transcripts
- [ ] **Live-server cases (UAT-API-002 to UAT-API-005, UAT-EDGE-011, UAT-EDGE-012, UAT-UI-001 to UAT-UI-003)**: start the dashboard on the spare port 4471 in the background from the repo root and leave it running until those cases finish: `node bin/cli.js dashboard 4471` (the startup line reads `Wiki dashboard server running at http://localhost:4471`; if the port was taken the server falls back to the next free port, so use the port it prints and substitute below)
- [ ] **Cleanup** after the live-server cases: `kill $(lsof -ti tcp:4471)`. `bin/cli.js` runs the server as a child process, so killing only the CLI's PID leaves the listener behind. Never bind or expose the server on a non-loopback address
- [ ] Never record real transcript content (prompts, file paths, project names) in this file. The live-server cases assert key names, enums and counts only

---

## Test Cases

### UAT-API-001: GET /api/usage returns the script's report as JSON with no-store headers
- **Endpoint**: `GET /api/usage`
- **Description**: With the usage script stubbed via `WIKI_DASHBOARD_USAGE_SCRIPT`, the route answers 200, `Content-Type: application/json`, `Cache-Control: no-store`, and a body deep-equal to the stub's report.
- **Steps**:
  1. Run the unit test command below.
- **Expected Result**: The "GET /api/usage returns the stub report with JSON and no-store headers" test passes (exit code 0, `tests 1`, `fail 0`).
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js` (shipped with TASK-0109)
- **Unit Test Command**: `node --test --test-name-pattern='^GET /api/usage returns the stub report' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-API-002: Real GET /api/usage serves the shipped report schema
- **Endpoint**: `GET http://127.0.0.1:4471/api/usage`
- **Description**: Against the live dashboard with the real package-relative script, the route returns HTTP 200 with the `schemaVersion: 1` document. Asserts structure only, never transcript content.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite.
  2. Run the curl command below as-is.
- **Command**:
  ```bash
  curl -sS 'http://127.0.0.1:4471/api/usage' | jq -c '{schemaVersion, keys: keys, checks: ([.bySkill[].modelCheck] | unique)}'
  ```
- **Expected Result**: A single JSON line where `schemaVersion` is `1`, `keys` is exactly `["byDay","byModel","bySkill","generatedAt","meta","range","schemaVersion","scope","totals"]`, and `checks` is a subset of `["match","mismatch","undeclared","unknown"]` (an empty `[]` is acceptable for a project with no skill usage). No error body.
- **Repeatable Unit Test**: Not applicable: exercises the real script over the real transcripts directory; the hermetic equivalents are UAT-API-001 (route contract) and the usage-report script's own tests
- [x] Pass <!-- 2026-09-19 -->

### UAT-API-003: POST to /api/usage is rejected with 405
- **Endpoint**: `POST http://127.0.0.1:4471/api/usage`
- **Description**: The server stays GET-only; the new route adds no write surface.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite.
  2. Run the curl command below as-is.
- **Command**:
  ```bash
  curl -sS -o /dev/null -w '%{http_code}' -X POST 'http://127.0.0.1:4471/api/usage'
  ```
- **Expected Result**: Prints exactly `405`.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js` (POST/PUT/DELETE and trailing-path cases; see UAT-EDGE-007)
- **Unit Test Command**: `node --test --test-name-pattern='^POST, PUT, DELETE' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-API-004: Only the exact path /api/usage is routed
- **Endpoint**: `GET http://127.0.0.1:4471/api/usage/`
- **Description**: The route is an exact match: a trailing slash (and `/api/usage/x`) fall through to the existing 404.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite.
  2. Run the curl command below as-is.
- **Command**:
  ```bash
  curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:4471/api/usage/'
  ```
- **Expected Result**: Prints exactly `404`.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js` (see UAT-EDGE-007)
- **Unit Test Command**: `node --test --test-name-pattern='^POST, PUT, DELETE' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-API-005: Server-side cache serves a repeat request within 30 s and refreshes after the TTL
- **Endpoint**: `GET http://127.0.0.1:4471/api/usage`
- **Description**: The report is cached for 30 s, so two requests within the TTL return the same `generatedAt`; a request after the TTL re-runs the script and returns a newer one. The hermetic proof (one child invocation for concurrent plus in-TTL requests) is the unit test; this live check confirms it with the real script.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite. If you already fetched `/api/usage` in the last 30 s, wait 31 s first so the cache is cold.
  2. Run the curl command below and note the value.
  3. Run it again immediately (within 30 s) and compare.
  4. Wait at least 31 s, run it a third time and compare.
- **Command**:
  ```bash
  curl -sS 'http://127.0.0.1:4471/api/usage' | jq -r '.generatedAt'
  ```
- **Expected Result**: Runs 2 and 1 print the identical timestamp; run 3 prints a later timestamp.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^caching and single-flight' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-001: Missing usage script yields 404 usage-report-unavailable
- **Scenario**: `WIKI_DASHBOARD_USAGE_SCRIPT` names a file that does not exist. The variable is authoritative when set (no fallback to the package or home candidates), so the result is deterministic whatever is installed.
- **Steps**: Run the unit test command below.
- **Expected Result**: Status 404 with body exactly `{"error":"usage-report-unavailable"}`; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^WIKI_DASHBOARD_USAGE_SCRIPT pointing at a missing file' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-002: Script failure yields 500 usage-report-failed and leaks nothing
- **Scenario**: The script exits 1 after writing a sentinel to stderr. The body must be exactly `{"error":"usage-report-failed"}` and contain neither the stderr text, the script path, nor the project directory.
- **Steps**: Run the unit test command below.
- **Expected Result**: Status 500, fixed error body, no leaked stderr/paths; the stub demonstrably ran once; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^fail mode returns 500' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-003: Non-JSON script output yields 500 usage-report-failed
- **Scenario**: The script prints text that does not parse as JSON.
- **Steps**: Run the unit test command below.
- **Expected Result**: Status 500 with body `{"error":"usage-report-failed"}`; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^garbage mode' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-004: Script output that is valid JSON but not an object yields 500
- **Scenario**: The script prints `[]` (a JSON array). The server validates the output parses to a non-null, non-array object before re-serving it.
- **Steps**: Run the unit test command below.
- **Expected Result**: Status 500 with body `{"error":"usage-report-failed"}`; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^array mode' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-005: A script that outlives the 15 s timeout yields 500
- **Scenario**: The script sleeps 20 s. The server's `execFile` timeout (15 s) kills it and answers 500 `usage-report-failed`, failing between roughly 14 s and 19.5 s. Takes about 16 s to run.
- **Steps**: Run the unit test command below and allow up to 40 s.
- **Expected Result**: Status 500, fixed error body, elapsed time within the window; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^slow mode times out' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-006: No request data reaches the child process
- **Scenario**: A request to `/api/usage?project=/etc&x=$(id)` returns the same body as a plain request, and the stub's recorded argv is exactly `["--project", "<server project dir>"]` — the query string never reaches the script's arguments (fixed-argv `execFile`, no shell).
- **Steps**: Run the unit test command below.
- **Expected Result**: Hostile and plain bodies identical; exactly one recorded invocation with only `--project <dir>`; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^no request data reaches the child' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-007: Non-GET methods and non-exact paths are rejected without running the script
- **Scenario**: POST, PUT and DELETE to `/api/usage` return 405; `GET /api/usage/` and `GET /api/usage/extra` return 404; the stub is never invoked by a rejected request.
- **Steps**: Run the unit test command below.
- **Expected Result**: All five assertions hold and the invocation count stays 0; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^POST, PUT, DELETE' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-008: Existing routes are unaffected
- **Scenario**: `GET /` still returns the dashboard HTML byte-for-byte, a `/wiki/knowledge/page.md` file in the temp project is still served, and traversal attempts (`/wiki/../`, `/wiki/../../etc/passwd`, `/wiki/%2e%2e/`) still return 403.
- **Steps**: Run the unit test command below.
- **Expected Result**: 200 HTML, 200 file body, and 403 for each traversal path; the test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^existing routes are unaffected' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-009: Server accepts loopback and refuses a non-loopback interface (hermetic)
- **Scenario**: The server accepts a TCP connection on `127.0.0.1`, refuses a connection to the host's first non-internal IPv4 address (`ECONNREFUSED`), and the server source still contains `listen(port, '127.0.0.1'`. On a host with no non-internal IPv4 address the LAN half is skipped at runtime by the test itself; loopback and the source tripwire still run.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes (exit code 0, `fail 0`).
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^loopback only' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-010: Dashboard client handles #/usage, calls /api/usage, and adds no innerHTML
- **Scenario**: Static contract on `lib/scripts/templates/wiki/dashboard.html`: it links `#/usage`, routes `view === 'usage'`, calls `fetch('/api/usage'`, and the `innerHTML` occurrence count is still the Step 3 baseline of 1 (the pre-existing mention in a comment), so no fetched text is written through `innerHTML`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^dashboard client contract' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-011: Live listener is bound to 127.0.0.1 only
- **Scenario**: The running dashboard's listening socket is loopback-only, not a wildcard bind.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite.
  2. Run the command below.
- **Command**:
  ```bash
  lsof -nP -iTCP:4471 -sTCP:LISTEN
  ```
- **Expected Result**: Exactly one `node` listener line whose NAME column is `127.0.0.1:4471 (LISTEN)`. There is no `*:4471` and no LAN-address (`192.168.x.x`, `10.x.x.x`) entry.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js` (source tripwire and refusal check; see UAT-EDGE-009)
- **Unit Test Command**: `node --test --test-name-pattern='^loopback only' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-012: Live server is unreachable on the machine's LAN address
- **Scenario**: A request to the machine's LAN IPv4 address on the dashboard port is refused. This is a read-only connection attempt; nothing is bound off-loopback.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite.
  2. Run the curl command below. It assumes the LAN interface is `en0` on macOS; substitute the right interface (or a literal LAN address) elsewhere. If the machine has no LAN address the substitution is empty and the case is N/A (UAT-EDGE-009 and UAT-EDGE-011 still cover the bind).
- **Command**:
  ```bash
  curl -sS -m 3 -o /dev/null -w '%{http_code}' "http://$(ipconfig getifaddr en0):4471/api/usage"
  ```
- **Expected Result**: curl exits 7 with `Failed to connect ... Couldn't connect to server` (or times out, exit 28); it never prints `200`.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js` (see UAT-EDGE-009)
- **Unit Test Command**: `node --test --test-name-pattern='^loopback only' test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-013: The server never writes into the project directory
- **Scenario**: After every request kind (success, missing script, fail, garbage, array, slow, hostile query, rejected methods, wiki files, traversal) the temp project holds exactly the files the test created. Run the **whole file** so the read-only assertion executes after all the other requests; the case in isolation would pass trivially.
- **Steps**: Run the unit test command below (about 16 s).
- **Expected Result**: `tests 14`, `pass 14`, `fail 0` — in particular "read-only: the project dir holds nothing beyond what the test created" passes.
- **Repeatable Unit Test**: Created: `test/wiki-dashboard-usage.test.js`
- **Unit Test Command**: `node --test test/wiki-dashboard-usage.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-014: Model family normalization maps aliases and full ids to the same family
- **Scenario**: `familyOf('sonnet')`, `familyOf('claude-sonnet-5')` and `familyOf('Sonnet[1m]')` all give `sonnet`; likewise haiku, opus and fable full ids.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes (`tests 1`, `fail 0`).
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js` (shipped with the TASK-0109 follow-up fix)
- **Unit Test Command**: `node --test --test-name-pattern='^familyOf maps aliases' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-015: inherit, empty and non-string declared values have no family; unrecognised ids are unknown
- **Scenario**: `familyOf` returns `null` for `inherit` (any case), empty/blank strings, `null`, `undefined` and non-strings; unrecognised ids (`claude-unknown-9`, `opusplan`) return `unknown`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^familyOf: inherit' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-016: Declared alias vs observed full id of the same family is a match
- **Scenario**: A skill declaring the alias `sonnet` whose turns ran on `claude-sonnet-5` is `match` (not a false "mismatch" from an exact-string compare); dated and undated haiku ids match; a multi-model opus set matches.
- **Steps**: Run the unit test command below.
- **Expected Result**: `modelCheckOf` returns `match` for every listed pair; the test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^modelCheckOf: alias vs full id' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-017: A different observed family is a mismatch
- **Scenario**: Declared `sonnet` with observed haiku, declared `haiku` with observed sonnet, and declared `sonnet` with a mixed sonnet-plus-opus observed set all return `mismatch`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^modelCheckOf: a different observed family' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-018: inherit or a missing declared model is undeclared, never a mismatch
- **Scenario**: `modelCheckOf(null|undefined|'inherit', [...])` returns `undeclared`, so skills that inherit the session model are never flagged.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^modelCheckOf: inherit or a missing' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-019: Unknown model ids are not flagged
- **Scenario**: An unrecognised observed id, an unrecognised declared id, or an empty observed set gives `unknown`; a known family present alongside an unknown id still gives `match`.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^modelCheckOf: unknown model ids' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-020: bySkill rows carry declaredFamily and modelCheck and keep declaredModel verbatim
- **Scenario**: `aggregate` emits `declaredModel` unchanged (`sonnet`, `inherit`), a derived `declaredFamily` (`sonnet`, `null`), and `modelCheck` (`match`, `undeclared`, `mismatch`) on every `bySkill` row; the dashboard depends on this additive field with `schemaVersion` still 1.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^aggregate: bySkill rows' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-021: End-to-end CLI over the fixture flags only the real mismatch
- **Scenario**: Running the usage-report script over `test/fixtures/usage-report` (synthetic data, via the `USAGE_REPORT_*` env overrides) gives `alpha` = `match` (declared sonnet, family sonnet), `beta` = `mismatch` (declared haiku, opus observed) and `(none)` = `undeclared`, with `schemaVersion` 1.
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^CLI over the fixture' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-EDGE-022: Dashboard displays modelCheck instead of comparing exact strings
- **Scenario**: `dashboard.html` reads `row.modelCheck === 'mismatch'` and no longer contains the old `indexOf(row.declaredModel)` exact-string comparison; `usage-report/SKILL.md` documents `modelCheck` and `MISMATCH` and no longer says "any key of `models` differs".
- **Steps**: Run the unit test command below.
- **Expected Result**: The test passes.
- **Repeatable Unit Test**: Created: `test/usage-report-model-family.test.js`
- **Unit Test Command**: `node --test --test-name-pattern='^consumers display modelCheck' test/usage-report-model-family.test.js`
- [x] Pass <!-- 2026-09-19 -->

### UAT-UI-001: #/usage renders totals and the three tables from real transcripts, in light and dark themes
- **Page**: `http://127.0.0.1:4471/#/usage`
- **Description**: Real-browser check (deferred from TASK-0109 Step 5) that the panel renders the real report and matches the theme. Visual and needs a human eye; Playwright MCP can drive the navigation and snapshot.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite and open `http://127.0.0.1:4471/#/usage` in a browser.
  2. Expect a brief "Loading usage report… this can take a few seconds." note, then the report.
  3. Confirm the breadcrumb ends in "Usage" and a "← Overview" back link is present.
  4. Confirm four panels: **Totals** (Input, Output, Cache write, Cache read, Est. cost, Turns; meta line shows the scope and "generated <timestamp>"), **By model** (columns Model, Tier badge, Input, Output, Cache write, Cache read, Est. cost, Turns), **By skill** (columns Skill, Declared, Observed, Check, Input, Output, Est. cost, Turns; rows sorted by cost descending), and **Last 14 days** (Date, Est. cost, Turns; newest first, at most 14 rows).
  5. Confirm costs read as estimates (`~$0.00` form; a null cost reads "unpriced"), missing values show a dash, and the footnote states costs are estimates, attribution is last-invoked-skill, and shows "Pricing as of ..." plus any "Unpriced models" list.
  6. In the By skill table, confirm the Check column shows a red `mismatch` badge only where the Declared model's family differs from an Observed one, a green `match` badge where they agree, and a dash for undeclared/`inherit`/unknown. A skill declaring an alias such as `sonnet` while observed as `claude-sonnet-...` must show `match`, not `mismatch`.
  7. Toggle the OS/browser theme between light and dark (or use the dashboard's theme control if present); confirm both render legibly with no unstyled or off-palette colors.
  8. Open the browser console and confirm there are no errors or uncaught exceptions.
- **Expected Result**: All four panels and the footnote render with the columns above in both themes, Check badges follow the family rule, and the console is clean.
- **Repeatable Unit Test**: Not applicable: visual rendering, theming and console state in a real browser; the data contract and Check semantics are covered by UAT-API-001/002 and UAT-EDGE-014 to UAT-EDGE-022
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-19 -->

### UAT-UI-002: Overview card links to #/usage without triggering a fetch
- **Page**: `http://127.0.0.1:4471/#/`
- **Description**: The Usage card on the overview is static (title "Usage", text "Token and cost rollup by model and skill") and must not call `/api/usage`; the fetch happens only on entering `#/usage`.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite. Open `http://127.0.0.1:4471/#/` fresh (hard reload) with the browser network log open, or use Playwright `browser_network_requests`.
  2. Confirm the Usage card appears after the six family cards, and that no request to `/api/usage` appears in the log, including after waiting at least 10 s (two 5 s polls).
  3. Click the Usage card.
- **Expected Result**: The URL becomes `#/usage`, the usage page renders, and only now does a `GET /api/usage` (status 200) appear in the network log. No `/api/usage` request occurred while the overview was showing.
- **Repeatable Unit Test**: Not applicable: needs a real browser session and network log; the static wiring (`#/usage` link, `fetch('/api/usage'`) is covered by UAT-EDGE-010
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-19 -->

### UAT-UI-003: The 5 s poll re-fetches usage only while #/usage is the active route
- **Page**: `http://127.0.0.1:4471/#/usage`, then `http://127.0.0.1:4471/#/`
- **Description**: `refresh()` re-fetches usage only when the route is `usage`, so a viewer on another page never causes the script to run. The server's 30 s cache absorbs polls on the usage page.
- **Steps**:
  1. Start the dashboard per the live-server prerequisite. Open `#/usage` with the network log open and wait at least 12 s.
  2. Navigate to `#/` (click "← Overview") and wait at least 12 s.
- **Expected Result**: Step 1 shows the initial `/api/usage` request followed by at least one further `/api/usage` request from the poll (each 200, all returning the same `generatedAt` within the 30 s TTL). Step 2 shows no new `/api/usage` requests after leaving the page.
- **Repeatable Unit Test**: Not applicable: timing-based browser polling behavior; server-side cache absorption is covered by UAT-API-005
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-19 -->

### UAT-UI-004: Empty state when the usage script is unavailable (404)
- **Page**: `http://127.0.0.1:4472/#/usage`
- **Description**: A 404 from `/api/usage` renders the empty-state hint instead of a broken panel.
- **Steps**:
  1. From the repo root, start a second dashboard on port 4472 with a nonexistent script (the variable is authoritative when set): `WIKI_DASHBOARD_USAGE_SCRIPT=/nonexistent/usage-report.js node lib/scripts/wiki-dashboard-server.js . --port 4472`
  2. Open `http://127.0.0.1:4472/#/usage`.
  3. Stop it afterwards: `kill $(lsof -ti tcp:4472)`.
- **Expected Result**: The Usage panel shows "No usage found for this project yet. Run `/usage-report` to check that transcripts are being read." with no tables and no console errors. `curl -sS http://127.0.0.1:4472/api/usage` returns `{"error":"usage-report-unavailable"}`.
- **Repeatable Unit Test**: Not applicable: the 404 contract is covered by UAT-EDGE-001; this case verifies the client's rendering of it in a real browser
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-19 -->

### UAT-UI-005: Loading note, then error state when the script hangs past the timeout
- **Page**: `http://127.0.0.1:4473/#/usage`
- **Description**: While the first fetch is in flight the panel shows the loading note; when the server answers 500 the error text replaces it.
- **Steps**:
  1. From the repo root, start a third dashboard on port 4473 with the slow stub (sleeps 20 s, so the server's 15 s timeout fires): `STUB_MODE=slow WIKI_DASHBOARD_USAGE_SCRIPT="$PWD/test/fixtures/wiki-dashboard/usage-stub.js" node lib/scripts/wiki-dashboard-server.js . --port 4473`
  2. Open `http://127.0.0.1:4473/#/usage` and watch for about 20 s.
  3. Stop it afterwards: `kill $(lsof -ti tcp:4473)`.
- **Expected Result**: Immediately: "Loading usage report… this can take a few seconds." After about 15 s it is replaced by "The usage report could not be generated." No stderr text, script path or project path is visible anywhere on the page, and the console shows no uncaught exceptions.
- **Repeatable Unit Test**: Not applicable: the 500-on-timeout contract is covered by UAT-EDGE-005; this case verifies the client's loading and error rendering in a real browser
- [FAIL: auto-judge: UI test requires human verification — use /uat-walk] <!-- 2026-09-19 -->

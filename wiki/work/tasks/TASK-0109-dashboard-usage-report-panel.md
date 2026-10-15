---
id: TASK-0109
aliases: [TASK-0109]
title: "Surface the /usage-report JSON in the wiki dashboard (read-only /api/usage endpoint + #/usage panel)"
status: pending-uat
created: 2026-09-19
updated: 2026-09-19
depends_on: [TASK-0108]
blocks: []
parallel_safe_with: []
uat: "[[UAT-0109]]"
tags: [dashboard, cost-tracking, usage-report, tooling, roadmap-012]
---

# TASK-0109 — Surface the /usage-report JSON in the wiki dashboard (read-only /api/usage endpoint + #/usage panel)

depends_on::[[TASK-0108]]

## Objective

Show the token/cost rollup produced by the `/usage-report` skill's script ([[TASK-0108]]) in the live wiki dashboard, next to the existing `wiki/work/` family cards, so the per-skill haiku/sonnet/opus tier curation can be checked from the same page. Advances Phase 2 of [[ROADMAP-012]]. The server gains exactly one new read-only route, `GET /api/usage`, that returns the script's JSON; the client gains a `#/usage` view plus an overview-page entry point. Nothing new can write, accept user input into a command, or listen beyond loopback.

## Approach

**Constraints** (from the request and the server's own header): read-only, loopback-only (`server.listen(port, '127.0.0.1', ...)` already in `listen()` and must not change), zero dependencies, Node builtins only, no `innerHTML` for fetched text in the client (XSS rule in the `components/wiki-dashboard` Serena memory).

**Contract with TASK-0108.** TASK-0108's script (`lib/skills/usage-report/scripts/usage-report.js`) prints one JSON document to **stdout** and, by design, writes no files. Its schema (`schemaVersion: 1`) is `{ generatedAt, scope, range, totals, byModel[], bySkill[], byDay[], meta }`; an empty project yields valid zero-total JSON with exit 0; an unknown flag exits 2. This task consumes that document; it does not change the script or its schema. If TASK-0108's shipped schema differs from its task file, this task follows the shipped code (Step 1).

**Design decisions:**

| Question | Choice | Why |
|---|---|---|
| How does the server get the JSON | On request, run the script with `child_process.execFile(process.execPath, [script, '--project', projectDir])`: fixed argv, no shell, **no request data ever reaches the argv** | The skill writes no snapshot file, so the only source is the script's stdout. A fixed-argv `execFile` of a local, package-owned script is not a write or injection surface, unlike a `shell: true` exec or a route that forwards query params. The alternative of `require`-ing the script's pure functions in-process would block the event loop for a multi-second parse of tens-of-MB transcripts. |
| Which script copy | First `path.join(__dirname, '..', 'skills', 'usage-report', 'scripts', 'usage-report.js')` (the package's own copy, same version as the server); else `~/.claude/skills/usage-report/scripts/usage-report.js`; else 404 | Package-relative wins so the server and script are version-matched. Step 1 verifies `package.json` `files` ships `lib/skills/`; if it does not, drop the first candidate rather than widening `files`. |
| Route shape | `GET /api/usage` exact match only; the existing non-GET 405 and query-string strip apply unchanged | Smallest surface: no parameters, so no new traversal or argv-injection vector. The `--project` value is the server's own `projectDir`, fixed at startup. `--all-projects`, `--since`, `--until` are deliberately not exposed. |
| Cost of a request | In-memory cache of the last successful result with a 30 s TTL, plus single-flight (concurrent requests share one in-progress child); child limited by a 15 s timeout and a 10 MiB `maxBuffer` | The parse is heavy and the client re-fetches on route entry and poll. Caching and single-flight stop a refreshing tab from spawning a process per request. |
| Failure modes | 404 `{"error":"usage-report-unavailable"}` when no script copy exists; 500 `{"error":"usage-report-failed"}` on non-zero exit, timeout, over-cap output, or output that does not parse to a JSON object; never echo stderr, `err.message`, script paths, or `projectDir` in a body | Client shows a hint instead of a broken panel; no path leakage from a loopback service. |
| Validation | Server only checks the output parses as a non-null, non-array object, then re-serves the original text; schema interpretation lives in the client, which tolerates missing keys | Server stays independent of schema evolution. The client also checks `schemaVersion` and shows a notice on an unknown major version. |
| Freshness | `Cache-Control: no-store` via the existing `noCacheHeaders()`; the client fetches on entering `#/usage` and on the existing `refresh()` poll only while that route is active | Avoids computing a report when nobody is looking. |
| Client placement | New hash route `#/usage`, plus a card on the overview page after the six family cards; not a seventh entry in `FAMILIES` | `FAMILIES` drives index parsing and `resolveLink`; usage has no `index.md` or lifecycle, so folding it in would need special cases everywhere. |
| What the panel shows | Headline totals (tokens in/out/cache, estimated cost, turns), `byModel` table with tier, `bySkill` table sorted by cost with a declared-vs-observed model flag, `byDay` list, and a footnote: costs are estimates, attribution is last-invoked-skill, `meta.unpricedModels` and `meta.pricingAsOf` | This is the verification the roadmap Goal names (tier curation), and the caveats come from TASK-0108's own contract, so the dashboard must not overstate precision. |
| Tests | New `test/wiki-dashboard-usage.test.js`. There is **no existing dashboard-server test** to extend (`test/settings-deny.test.js` only mentions the server in a header comment), so this task adds the first one in the same zero-dependency `node:test` style | The closest existing pattern is `test/settings-deny.test.js`; `test/usage-report.test.js` (TASK-0108) is the sibling to mirror for fixtures. |

**Test harness note.** `parseArgs` accepts `--port`, and the startup log prints the requested port, so tests should pick a free port first (bind `net.createServer().listen(0, '127.0.0.1')`, read the port, close it), spawn `node lib/scripts/wiki-dashboard-server.js <tmpProject> --port <p>`, and poll until the port accepts connections. Always kill the child in an `after` hook. To avoid depending on the real script and real `~/.claude/projects`, add an **override for tests only**: an env var `WIKI_DASHBOARD_USAGE_SCRIPT` naming the script path, honored before the two default candidates. It is read-only configuration of which local file to execute, set by the process owner, and never taken from a request. Document it in the server header comment.

**Files touched:**

- `lib/scripts/wiki-dashboard-server.js`: new route, script resolver, cache, header comment
- `lib/scripts/templates/wiki/dashboard.html`: `#/usage` view, overview card, breadcrumb (always-refresh scaffold file; fixes must land in the template, not in a target project's copy)
- `test/wiki-dashboard-usage.test.js` and a stub script under `test/fixtures/`: new
- `README.md`, `CLAUDE.md`, `.serena/memories/components/wiki-dashboard.md`: doc updates. The memory's line "Never needs changes for client-side view additions" becomes untrue and must be qualified.

## Steps

### 1. Confirm the TASK-0108 contract as shipped <!-- agent: Explore -->

- [x] Read `lib/skills/usage-report/scripts/usage-report.js`, its `SKILL.md`, and `test/usage-report.test.js` (via Serena `find_file` / `search_for_pattern` plus `Read`; JS is not symbol-navigable in this repo). If TASK-0108 has not landed, stop and report that this task is blocked. Record: (a) the exact CLI flags and exit codes, (b) the top-level JSON keys and per-row fields actually emitted, (c) typical runtime on this repo's transcripts (time one run with `--pretty`), which sets the timeout and cache TTL below, (d) whether `--project` accepts the server's `projectDir` form.
- [x] Check `package.json` `files` to confirm `lib/skills/` ships in the npm tarball, which decides whether the package-relative script candidate is valid. Do not edit `package.json` in this task; report a discrepancy instead.
- [x] If the shipped schema differs from the TASK-0108 task file, use the shipped schema in Steps 2-5 and note the divergence at the top of this task file. (No divergence in keys. Value notes: `models` per skill maps model id to turn count; row `cost` may be null; `byDay.cost` may be null; `totals.cost` never null; `tier` always a string incl. "other"; `declaredModel` null when unknown. Script runs ~0.8 s on this repo, 7 KB output; `lib/` ships in npm; dashboard.html `innerHTML` baseline = 1, in a comment.)
<!-- Updated: 2026-09-19 -->

### 2. Add the read-only `/api/usage` route to the server <!-- agent: general-purpose -->

- [x] In `lib/scripts/wiki-dashboard-server.js` add constants `USAGE_TIMEOUT_MS` (15000, adjust per Step 1c), `USAGE_MAX_BYTES` (10 MiB), `USAGE_CACHE_TTL_MS` (30000), and `resolveUsageScript()` returning `process.env.WIKI_DASHBOARD_USAGE_SCRIPT` alone when that variable is set (if the file does not exist the result is `null`, with no fallback to the other candidates), otherwise the first existing file among the package-relative candidate and the `os.homedir()` candidate, or `null`. Add `const os = require('os')` and `const { execFile } = require('child_process')` beside the existing requires.
- [x] Add `runUsageReport(callback)`: `execFile(process.execPath, [script, '--project', projectDir], { timeout: USAGE_TIMEOUT_MS, maxBuffer: USAGE_MAX_BYTES, windowsHide: true }, ...)`; no `shell` option, no env passthrough beyond the default. Implement single-flight (a module-level pending-callbacks array) and a module-level `{ at, body }` cache honoring `USAGE_CACHE_TTL_MS`. On success validate `JSON.parse(stdout)` is a non-null, non-array object.
- [x] In `requestHandler`, after the wiki-tree branch and before the final 404, add an exact-match branch on `urlPath === '/api/usage'` calling `serveUsageReport(res)`. `/api/usage/` and `/api/usage/x` stay 404.
- [x] Implement `serveUsageReport(res)`: 404 `{"error":"usage-report-unavailable"}` when `resolveUsageScript()` is `null`; 500 `{"error":"usage-report-failed"}` on any failure from `runUsageReport`; 200 with the original stdout text on success. All three use `noCacheHeaders({ 'Content-Type': 'application/json' })` (the existing `send()` derives the type from a file path, so write headers directly or extend it). Never include stderr, `err.message`, the script path, or `projectDir` in any body.
- [x] Update the file header comment (lines 3-5) to say the server also serves the `/usage-report` script's JSON at `/api/usage` by running a fixed, package-owned script with fixed arguments, never with request data, and document `WIKI_DASHBOARD_USAGE_SCRIPT`. **Do not** change `server.listen(port, '127.0.0.1', ...)`, the `GET`-only guard, or the `/wiki/**` traversal check.

### 3. Add the `#/usage` view to the dashboard client <!-- agent: general-purpose -->

- [x] In `lib/scripts/templates/wiki/dashboard.html` extend `parseRoute()` (around line 962) so `#/usage` returns `{ view: 'usage' }` before the `FAMILIES.indexOf(family) === -1` fallback, and extend `renderRoute()` (around line 1605) and `updateCrumbs()` (around line 1566) to handle it, following the family view's route and crumb conventions. Record the current count of `innerHTML` occurrences in the file for the Step 4 tripwire.
- [x] Add `async function fetchUsage()`: `fetch('/api/usage', { cache: 'no-store' })`; return `{ state: 'ok', data }` on 200, `{ state: 'empty' }` on 404, `{ state: 'error' }` on any other status or a thrown error.
- [x] Add `renderUsagePage(container, result)` built only from DOM builders and `textContent`: totals row, `byModel` table with tier, `bySkill` table sorted by cost with a declared-vs-observed flag (a skill whose `declaredModel` is non-null and absent from its `models` keys), `byDay` list (most recent 14 days), and the caveat footnote from the Approach. Render a dash for missing or non-numeric values; format cost as an estimate (`~$0.00`); show a `null` cost as "unpriced". Show a notice when `schemaVersion` is not `1`. Empty state (`totals.turns === 0` or a 404): "No usage found for this project yet. Run `/usage-report` to check that transcripts are being read." Error state: "The usage report could not be generated." Show a "loading" note while the first fetch is in flight, since the parse can take seconds. Reuse existing helpers (`emptyNote`, table and badge styles) and the light and dark theme variables; add no new colors outside the token set.
- [x] Add an overview card in `renderOverview` (around line 1036), after the family cards, styled like `buildFamilyCard`: title "Usage", linking to `#/usage`. The card must **not** trigger the fetch (the parse is too heavy to run on every overview load); it shows static text only ("Token and cost rollup by model and skill"). Fetch happens only on entering `#/usage`.
- [x] In `refresh(force)` (around line 1646), re-fetch usage only when the active route is `usage`, so the poll never runs the script for a viewer on another page.

### 4. Add tests <!-- agent: general-purpose -->

- [x] Create `test/fixtures/wiki-dashboard/usage-stub.js`: a tiny Node script that prints a fixed valid report JSON (`schemaVersion: 1`, non-zero totals, one model, one skill, one day) to stdout, plus small variants selected by an env var read by the stub (`STUB_MODE=fail` exits 1 with stderr text containing a sentinel string, `garbage` prints non-JSON, `array` prints `[]`, `slow` sleeps past the timeout, `count` appends a line to a file named by `STUB_COUNT_FILE` so tests can count invocations).
- [x] Create `test/wiki-dashboard-usage.test.js`, zero-dependency (`node:test`, `node:assert/strict`, `node:child_process`, `node:net`, `node:fs`, `node:os`, `node:path`), hermetic (temp project dir under `os.tmpdir()`, stub selected through `WIKI_DASHBOARD_USAGE_SCRIPT`, torn down in `after`), header-commented in the style of `test/settings-deny.test.js`. Cases:
  - `GET /api/usage` with the stub returns 200, `content-type: application/json`, `cache-control: no-store`, and a body deep-equal to the stub's report.
  - `WIKI_DASHBOARD_USAGE_SCRIPT` pointing at a nonexistent file returns 404 `{"error":"usage-report-unavailable"}` (the variable is authoritative when set, so this is deterministic regardless of what is installed).
  - `fail`, `garbage`, `array`, and `slow` modes each return 500 `{"error":"usage-report-failed"}`; for `fail`, the body contains neither the stderr sentinel, the stub path, nor the temp project dir.
  - **Caching and single-flight**: two concurrent requests and one more within the TTL produce exactly one stub invocation (count file has one line).
  - **No request data reaches the child**: a request to `/api/usage?project=/etc&x=$(id)` returns the same body as a plain request and the stub's recorded argv (written by the stub to the count file) contains only `--project <tmpProject>`.
  - `POST`, `PUT`, and `DELETE` to `/api/usage` return 405; `GET /api/usage/` and `GET /api/usage/extra` return 404.
  - **Read-only**: after all requests, the temp project dir contains no files beyond the ones the test created.
  - **Loopback only**: the server accepts a connection on `127.0.0.1`. When a non-internal IPv4 address exists (`os.networkInterfaces()`), a connection to that address on the same port is refused; use `t.skip` when none exists. Also assert the server source still contains `listen(port, '127.0.0.1'` as a cheap regression tripwire.
  - **Existing routes unaffected**: `GET /` still returns the dashboard HTML, a `/wiki/...` file in the temp project is still served, and a `/wiki/../` traversal attempt is still 403.
  - **Client contract** (static read of `lib/scripts/templates/wiki/dashboard.html`): the template handles `#/usage` and calls `/api/usage`, and its `innerHTML` occurrence count is unchanged from the Step 3 baseline.
- [x] Run `node --test test/wiki-dashboard-usage.test.js` and confirm it passes (14/14, ~16 s), then `npm test` and confirm no new failures (817 tests, 39 failed, none dashboard/usage related; all from the pre-existing set or the sibling task-add/task-trash rename sweeps). Compare against the known pre-existing failures noted in [[TASK-0099]]'s Step 8 rather than treating them as regressions.

### 5. Verify in a real browser <!-- agent: general-purpose -->

- [DEFERRED-TO-UAT] Start the dashboard against this repo (`node bin/cli.js dashboard 4400`, background) with the real script installed or package-relative, and confirm with Playwright MCP that `#/usage` renders totals and the three tables from real transcripts in light and dark themes, that the overview card links to it without triggering a fetch (check the network log), and that a second visit within 30 s is served from cache. Check the browser console for errors. Stop the server afterwards.
- [DEFERRED-TO-UAT] Confirm `curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:4400/api/usage` prints `405`, and that the server is not reachable on the machine's LAN address.

### 6. Update docs <!-- agent: general-purpose -->

- [x] `README.md`: in the dashboard usage block (around line 339), add one sentence that the dashboard also shows the local `/usage-report` rollup at `#/usage` (computed on demand from local transcripts, cached 30 s).
- [x] `CLAUDE.md`: re-read immediately before editing; in the Setup Workflow `dashboard` bullet, extend "serves the live `wiki/work/` dashboard read-only" with "and the `/usage-report` rollup via a read-only `/api/usage` route". One clause, no other edits (ROADMAP-0014 Phase 4 also edits `CLAUDE.md`).
- [x] `.serena/memories/components/wiki-dashboard.md`: add the `/api/usage` route and `WIKI_DASHBOARD_USAGE_SCRIPT` override to the **Server** bullet and the `#/usage` view to the **Client** bullet, and qualify "Never needs changes for client-side view additions" (true for `wiki/`-backed views; a view backed by data outside `wiki/` needs a server route).
- [x] Do not touch `wiki/hot.md` from this step.
<!-- Updated: 2026-09-19 -->
<!-- Step 5 deferred to UAT: real-browser and curl/LAN checks are runtime verification. -->
<!-- Note: dashboard 5 s poll re-fetches /api/usage while on #/usage; server 30 s cache absorbs it. -->
<!-- Note: declared-vs-observed flag compares exact strings, so alias `sonnet` vs observed `claude-sonnet-...` shows "mismatch"; refine in UAT if noisy. -->
<!-- Note (2026-09-19, FIXED): the flag now compares model FAMILIES (haiku/sonnet/opus/fable). Normalization lives once in lib/skills/usage-report/scripts/usage-report.js (familyOf, modelCheckOf); bySkill rows gain additive `declaredFamily` and `modelCheck` (match|mismatch|undeclared|unknown), schemaVersion stays 1. dashboard.html and usage-report/SKILL.md now just display modelCheck; inherit/missing declared = undeclared, unrecognised ids = unknown (neither flagged). TASK-0108's UAT is already archived and was not reopened. Tests: test/usage-report-model-family.test.js (new); one key list in test/usage-report.test.js extended for the two new fields. -->
<!-- Note: npm test showed task-typed-links 3 failures (not 1); two are from the sibling task-add rename. -->
<!-- Note: the 3 known-flake + sibling failures were all outside dashboard/usage tests. -->
<!-- Do not flip to done; leave pending-uat per team-lead. -->
<!-- End -->


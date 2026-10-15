# UAT-CORE — shared procedures for the UAT family

Steps 1–5 and the closure procedure are identical (or near-identical) across `/uat-walk`, `/uat-auto`, and `/uat-auto-plus`. They live here once. Each SKILL.md defines only what differs for its mode; where a step varies, a **Mode differences** note names the deltas.

**Pipeline:** `/task-create → /tackle → /uat-create → {uat-walk | uat-auto | uat-auto-plus} → archive/`. Tasks stay at their stable path in `wiki/work/tasks/` until UAT passes; on all-pass this procedure flips the task to `done` and archives both files. Files never move except into `archive/`.

**Status vocabulary** (only the status line ever changes — never reformat anything else in a test block):

| Marker | Meaning |
|--------|---------|
| `- [ ] Pass` | untested (pending) |
| `- [x] Pass <!-- YYYY-MM-DD -->` | passed |
| `- [FAIL: <reason>] <!-- YYYY-MM-DD -->` | failed (blocking) |
| `- [FIXING: <note>] <!-- YYYY-MM-DD -->` | fix in progress (blocking, always temporary) |
| `- [SKIP: <reason>] <!-- YYYY-MM-DD -->` | skipped — **human verdict only** |

A UAT file is **complete** when no test has a blocking status (`[FAIL]` / `[FIXING]`). `[x] Pass` and `[SKIP]` are non-blocking; `- [ ] Pass` is non-blocking only when the active mode excludes it.

---

## Step 1 — Resolve & parse the UAT file

Resolve `$ARGUMENTS` to one file in `wiki/work/uat/` (files never move — no `completed/` subdir):

Resolve the file per ~/.claude/skills/_shared/ID-RESOLUTION.md — family: uat · scope: active · ambiguous: interactive for uat-walk, headless for uat-auto / uat-auto-plus · empty: per mode (below)

**Mode differences (resolution):**
- **uat-walk** — ambiguous input: list matches, ask the user to clarify. No auto-pick; empty/unresolved → STOP and report.
- **uat-auto / uat-auto-plus** — never prompt. Ambiguous input → STOP and report in the completion summary. Empty/unresolved → enumerate `status: pending` files in `wiki/work/uat/`, pick the lowest `<NNN>` prefix, announce in one line (`No matching UAT file — running \`<filename>\``), proceed without confirmation. If none pending, STOP: "No pending UAT files found".

If the resolved file is missing, empty, or outside `wiki/work/uat/`, STOP (walk: warn + confirm; auto/plus: exit with a diagnostic summary).

**Parse** the file for: `### UAT-*` test headings (e.g. `UAT-API-001:`, `UAT-UI-002:`); `## Prerequisites` items; each test's status marker (see vocabulary). Count totals per status. If every test is already resolved (no `- [ ] Pass`, `[FAIL]`, or `[FIXING]`), skip straight to **Closure**.

---

## Step 2 — Prerequisites

For each unchecked prerequisite: if it is a **runnable check** (server on a port, DB migrated, file exists), verify with one deterministic command — one Bash call per prerequisite (`curl`, `pg_isready`, port probe, file test). If it is **descriptive only** ("test data loaded"), it is **unverifiable** — never assume it holds.

**Mode differences (prerequisites):**
- **uat-walk** — after auto-checking, present all prerequisites at once grouped as **auto-verified ✅** and **needs-confirmation ❓** (unverifiable or failed). If all auto-verify, note it in one line and proceed without asking. Otherwise ask the user to confirm the ❓ ones; a failed prerequisite is a warning, the user decides whether to continue.
- **uat-auto** — hard gate: any prerequisite that fails or is unverifiable aborts the run. Mark every untested test `[FAIL: auto-judge: prerequisite not satisfied — <which>]` and go to Closure.
- **uat-auto-plus** — attempt **one** autonomous repair per failing runnable prerequisite (start the dev server in a background Bash call + `Monitor` for ready; run the migrate command; run the seed command; obtain a missing env var only if `.env.test` or equivalent documents how). Re-verify. If it still fails after one repair, apply the uat-auto hard gate. Track background processes started here — Closure terminates them.

---

## Step 3 — Classify tests

| Type | Signal |
|------|--------|
| **API/CLI** | contains `curl`/`http`/`wget` or a shell code block in Steps/Expected, **or** has an `Endpoint:` field |
| **UI** | `UAT-UI-*` prefix, or `Page:` / `Components:` metadata |
| **Manual** | anything else (edge cases, concurrency, integration logic) |

**Unit-backed** is an *attribute*, not a type — it cuts across all three. A test is unit-backed when it records `- **Repeatable Unit Test**: Created: \`<path>\`` (written by `/uat-create` Step 2.5 when it promoted the case to a repeatable unit test). Note the path, and the `- **Unit Test Command**: \`<cmd>\`` line if present; Step 4 uses them as a machine-checkable evidence channel. The other three values of that field — `Not applicable:`, `Blocked:`, `Skipped by preference` — are **not** unit-backed: no test file exists to run.

---

## Step 3.5 — Stub detection (headless modes only)

**uat-auto / uat-auto-plus only.** `/uat-walk` skips this — a human evaluates each test regardless. Run this gate for every eligible test **before** executing any (classify all in Step 3, then sweep, then execute non-stubs).

A stub test **stays `- [ ] Pass`** — do not execute it, do not record `[FAIL]`, do not enter the fix loop (implementing a feature from scratch is out of scope). Surface it in the summary.

1. **Target** — API/CLI: `Endpoint:` or URL in `**Command**:`; UI: `Page:`/`Components:`; Manual: feature name from `Description`.
2. **Locate** the implementation via `mcp__serena__search_for_pattern` across `src/`/`app/`/`lib/`. If nothing is found, treat as **unlocatable** → run the test normally (cannot confirm stub).
3. **Stub indicators** (via `find_symbol` / `search_for_pattern`): `TODO`/`FIXME`/`HACK` inside a body; `throw new Error('not implemented')`, `raise NotImplementedError`, `notImplemented()`, `unimplemented!()`; a bare `pass` / `pass # TODO|stub`; empty body (`{}`, `return`, `return null|undefined|None`); placeholder comments (`// stub`, `# TODO: implement`, etc.).
4. **Found** → leave status untouched, record `stub-detected` (with file + indicator) in run tracking, skip execution. **Not found / unlocatable** → proceed to Step 4.

Stub detection outranks unit-backing: a stub-detected test stays `- [ ] Pass` and its unit test is not run. If you have already run one and it passed against a body carrying stub indicators, that is a contradiction, not a pass — record `[FAIL: auto-judge: unit test passes but implementation appears stubbed — <file>: <indicator>]`.

---

## Step 4 — Execute & judge

Work through eligible tests in document order; update the file immediately after each verdict (Step 5).

**Eligibility (headless modes):** default is **pending + previously-failed** — every `- [ ] Pass` or `[FAIL: ...]` test. Reset `[FAIL: ...]` (and, in auto-plus, `[FIXING: ...]`) to `- [ ] Pass` before running so a fresh verdict is recorded. Leave `[x] Pass` and `[SKIP: ...]` untouched. `/uat-walk` selects tests by its own mode prompt instead (see its SKILL.md).

### Auto-judge criteria (uat-auto / uat-auto-plus)

Judge each test on the **strongest evidence channel available to it**:

| # | Channel | Applies when | Verdict source |
|---|---------|--------------|----------------|
| 1 | **Live command** | API/CLI test with an extractable `**Command**:` | run the command (below) |
| 2 | **Unit-backed** | channel 1 unavailable **and** the test is unit-backed (Step 3) | run that unit test file (below) |
| 3 | **Browser (Playwright)** | UI test (Step 3) — `UAT-UI-*` / `Page:` / `Components:` | drive the page with the Playwright MCP (below) |
| 4 | **Human** | none of the above yields a verdict — no machine-checkable oracle | fail-closed `[FAIL: auto-judge: ...]` |

**Channel 1 outranks channel 2 and is never overridden by it.** A live command that fails is `[FAIL]` even when the test is unit-backed and its unit test passes — a green unit test beside a red live call means the live path is broken, and the narrower oracle does not get a vote. Channel 2 is reached only when channel 1 returns no verdict at all: a Manual/Edge case, or an API/CLI case whose body carries no extractable command or no machine-checkable Expected.

**API/CLI** — extract the command from `**Command**:`. No extractable command → fall through to channel 2 if the test is unit-backed, else `[FAIL: auto-judge: no machine-executable command in test body]`. Pass requires **ALL**:
1. Command exited cleanly (response returned; no connection error).
2. HTTP status matches the Expected section's explicit status; if none specified, any 2xx is pass-eligible on status alone.
3. Response body satisfies **every** machine-checkable assertion in Expected (literal substring, JSON key presence, JSON value equality, array length, type-of) — via `jq` or substring match.
4. If the test references `$UAT_AUTH_TOKEN`, the token must be present in the environment.

Any criterion fails → `[FAIL: auto-judge: <criterion, actual vs expected>]` — a run that produced a verdict is final, and no unit test overrides it. Expected section with no machine-checkable assertion → channel 1 yielded no verdict at all, so fall through to channel 2 if the test is unit-backed, else `[FAIL: auto-judge: expected section not machine-verifiable]`.

**Unit-backed (channel 2)** — a recorded, passing unit test *is* hard evidence, so a unit-backed test **does not fail-closed to human verification**. Resolve a run command, run it in one Bash call, and judge the result.

Resolve the command:
- Use the test's `- **Unit Test Command**: \`<cmd>\`` verbatim when present.
- Otherwise derive a **file-scoped** invocation for the project's runner — e.g. `node --test test/foo.test.js` · `npx vitest run test/foo.test.ts` · `npx jest test/foo.test.js` · `pytest tests/test_foo.py` · `go test ./pkg/foo/` · `cargo test --test foo`. Match the repo's existing convention (`package.json` `scripts.test`, CI config, nearby tests).
- A whole-suite run (`npm test`) is acceptable **only** when its output names this file's own cases and shows them passing — otherwise a green suite says nothing about this file.
- Cannot resolve either form → `[FAIL: auto-judge: no runnable unit-test command for <path>]`.

Pass requires **ALL**:
1. The recorded path resolves to a file that exists (`mcp__serena__find_file`). Missing → `[FAIL: auto-judge: unit test file not found — <path>]`; stale metadata pointing at a moved or deleted test is not evidence.
2. The runner exited 0.
3. The run **executed ≥1 test from that file**, and the output states the count. `0 tests` / `no tests ran` / `0 matched` / an empty pass line → `[FAIL: auto-judge: unit-test run matched 0 tests in <path>]`. **This is the load-bearing check** — a filter typo, a renamed file, or a wrong path produces exit 0 with nothing executed, which is indistinguishable from a real pass on exit code alone.
4. Zero failing, errored, or timed-out tests in the run.
5. The file's cases covering this UAT case actually ran — all `skip`/`todo`/`xfail`/`.only`-excluded → `[FAIL: auto-judge: unit test coverage skipped, not executed]`.
6. The unit test file is unmodified by this run (auto-plus: its fix loop may never touch it — see that skill's Autonomy boundaries).
7. The Expected Result contains no observable the unit test demonstrably cannot assert (live HTTP round-trip, rendering, deploy/filesystem state). Partial coverage → `[FAIL: auto-judge: unit test covers only part of Expected — <what is uncovered>]`. Apply this narrowly: a unit test that asserts the case's stated outcome by construction is complete evidence, not partial.

On pass: `- [x] Pass <!-- YYYY-MM-DD -->`; record `via unit test <path>` in run tracking so the summary can count it.

**UI (channel 3 — Playwright)** — UI cases are run in a real browser through the Playwright MCP, never sent straight to a human. A unit test cannot cover what a UI case exists to check (rendering, flow timing) — `/uat-create` Step 2.5 classifies exactly those as non-promotable — so a `Created:` on a UI case does not substitute for the browser run, and the browser verdict is final.

Setup:
1. **Load the tools.** Playwright tools are deferred in most sessions — load them with `ToolSearch` (`query: "playwright browser"`, or `select:` the `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_press_key`, `browser_select_option`, `browser_wait_for`, `browser_evaluate`, `browser_console_messages`, `browser_take_screenshot`, `browser_close` names). The server name varies by project (`mcp__playwright__*`, or `mcp__playwright-shared__*` when the project ships its own `playwright`) — use whichever is connected. Serve mode on macOS is a shared HTTP service with an isolated browser context per session, so parallel `/uat-auto` agents do not collide.
2. **Resolve the URL.** Absolute `Page:` URL as written. A bare route (`/strengths`) resolves against the base URL the UAT's prerequisites or the task establish (dev-server URL); none can be determined → `[FAIL: auto-judge: cannot resolve base URL for <route>]`. Never guess a port.
3. **No Playwright tools available** (not installed, not connected, or the server does not respond after one attempt) → `[FAIL: auto-judge: Playwright MCP unavailable — use /uat-walk]`. That is the only case where a UI test falls back to a human because of tooling.

Run: `browser_navigate` to the page → `browser_snapshot` (accessibility tree first, per `wiki/guides/mcp-tools.md`) → perform the test's Steps with `browser_click` / `browser_type` / `browser_fill_form` / `browser_select_option` / `browser_press_key`, re-snapshotting after each interaction (`browser_wait_for` for async UI) → assert the Expected Result. Credentials come only from `"$UAT_TEST_PASSWORD"`-style env references — never a literal.

Pass requires **ALL**:
1. Every navigation and interaction in Steps completed — a `ref` that cannot be found, a click that throws, or a page that fails to load is `[FAIL: auto-judge: <step> — <what happened>]`.
2. **Every** observable in Expected is confirmed by a machine-readable source: text/role/label/visibility/enabled state/count from the snapshot, URL from the page, computed style or DOM property via `browser_evaluate`, request/response via `browser_network_requests`. Do not assert from the screenshot alone.
3. No unexpected `error`-level `browser_console_messages` or failed network requests attributable to the flow, unless Expected says otherwise.
4. Evidence screenshot saved via `browser_take_screenshot` to `wiki/work/uat/screenshots/<task-number>-<UAT-ID>.png` (created if the directory is missing) — kept on pass and fail alike.

On pass: `- [x] Pass <!-- YYYY-MM-DD -->`; record `via browser` in run tracking so the summary can count it. Any criterion fails → `[FAIL: auto-judge: <criterion, actual vs expected>]` (final — the same never-overridden rule as channel 1).

**Stay fail-closed on the genuinely subjective.** An Expected that no DOM/snapshot/evaluate check can decide — "looks balanced", "feels responsive", pixel-level layout or colour fidelity, animation quality — yields no verdict: `[FAIL: auto-judge: UI expected is visual-only — use /uat-walk]`. Do not judge those from a screenshot by eye. When Expected mixes checkable and visual-only observables, the whole case is visual-only (partial coverage is not a pass).

**Manual** → unit-backed goes to channel 2. Otherwise always `[FAIL: auto-judge: manual test requires human verification]`, with no heuristic evaluation — intentional fail-closed: `/uat-create` produced a bare manual test because it expected a human.

`/uat-walk` does not auto-judge — the user issues every verdict. `/uat-auto-plus` enters its fix loop after a channel 1, 2, or 3 `[FAIL]` that reports a real assertion or interaction failure (each has a machine-checkable signal that a fix worked); never after a channel 4 `[FAIL]`, and never after a tooling `[FAIL]` (Playwright unavailable, base URL unresolvable).

### Bash hygiene — API/CLI and unit-backed tests (all modes)

**One program invocation per Bash call: one `curl` (as-is), optionally one `\| jq` stage. Nothing else.** If a generated `**Command**:` block violates this, rewrite it to the clean form before running (canonical style: `lib/skills/uat-create/SKILL.md` "Curl command standards"). Never emit literal password/token values — only `"$UAT_AUTH_TOKEN"` / `"$UAT_TEST_PASSWORD"` references.

Forbidden (each triggers an approval prompt and obscures output): multiple `curl`s in one call · `&&` / `;` / `\|\|` chaining · `echo` banners · `-w` format strings · `-o /tmp/...` then re-read · defensive flags (`--max-time`) · pre-assigned `TOKEN=...` vars · `\` line-continuations · piping to `head`/`tee`/redirection. Capture per test: HTTP status, response body (truncate display to ~50 lines; never write a temp file to read it back), connection errors.

Unit-backed runs follow the same rule: **one test-runner invocation per Bash call**, unchained and unredirected, so the runner's own pass/fail/count lines reach you intact. Capture per test: exit code, tests-run count, failing test names.

---

## Step 5 — Update the file per verdict

Use the **`Edit`** tool — **one `Edit` call per status line**, even when many flip in a row. **Never** `sed`, `awk`, `perl -i`, or `echo` to flip a marker (each triggers an approval prompt; see `wiki/guides/mcp-tools.md` "Common anti-patterns"). Replace only the status line with the appropriate marker + `<!-- YYYY-MM-DD -->`. Do not modify any other part of the test block — preserve all metadata, headings, and whitespace exactly.

---

## Closure — completion & file movement

Runs once no test has a blocking status. Two outcomes.

### All pass (no `[FAIL]` / `[FIXING]` remain)

1. **UAT status** — Edit `status:` → `passed`; bump `updated:` in the UAT frontmatter.
2. **Task status** — read `task:` from the UAT frontmatter → open `wiki/work/tasks/TASK-NNNN-slug.md`, Edit `status:` → `done`; bump `updated:`. (Expected prior status is `pending-uat`, set by `/tackle` when it finished implementation — but flip to `done` regardless of what's there now.)
3. **Remove index rows** — delete the UAT row from `wiki/work/uat/index.md` and the task row from `wiki/work/tasks/index.md` (one `Edit` per file).
4. **Archive both** (`git mv` via Bash; index appends via `Edit`):
   - `git mv wiki/work/uat/<UAT>.md wiki/work/uat/archive/` → append `| [[UAT-NNNN]] | Title | passed | YYYY-MM-DD |` to `wiki/work/uat/archive/index.md`
   - `git mv wiki/work/tasks/<TASK>.md wiki/work/tasks/archive/` → append `| [[TASK-NNNN]] | Title | done | YYYY-MM-DD |` to `wiki/work/tasks/archive/index.md`
5. **Roadmap auto-checkoff** — scan `wiki/work/roadmaps/` for `status: active` files. For each: Edit `- [ ] [[TASK-NNNN` → `- [x] [[TASK-NNNN`; then sweep remaining `- [ ]` free-text lines, checking the ones the completing task clearly accomplished (leave uncertain ones). If all items are now `[x]`: close the roadmap in place — read `~/.claude/skills/_shared/ARCHIVE-WORK-ITEM.md` and run its **In-place close (roadmaps, decisions, requirements)** section with `family: roadmaps`, `terminal_status: done` (status flip, `## Active` → `## Closed` index row move; no `git mv`, no `archive/`). Silent no-op if no roadmap references the task. `Edit` only (except the task/UAT `git mv` above).
6. **Decision annotation** — check the task body for `implements::[[ADR-NNNN#DM]]` (or legacy `implements::[[DEC-NNNN#DM]]`). If found: open the decision file in `wiki/work/decisions/` (`ADR-NNNN-slug.md`, or legacy `DEC-NNNN-slug.md`), append `— implemented YYYY-MM-DD` to this task's `Source task(s):` line. Then check `wiki/work/tasks/` **and** `tasks/archive/` for other `todo|in-progress` tasks with the same `implements::[[ADR-NNNN#DM]]` (either prefix form); if none remain, append `— decision fully implemented YYYY-MM-DD` on a new line in the `## DM.` block. Sweep remaining `- [ ]` items in that block, checking the ones this task accomplished. `Read` then `Edit` only — never `sed`.
7. **Log entry** — append to `wiki/log.md`:
   ```
   ## [YYYY-MM-DD] uat | UAT-NNNN passed<MODE-TAG> · TASK-NNNN done
   Archived UAT-NNNN → uat/archive/ and TASK-NNNN → tasks/archive/. [one sentence on what was verified]
   ```
   `<MODE-TAG>`: walk → none · auto → ` (auto)` · auto-plus → ` (auto-plus)`.
8. Emit the completion summary (task + UAT IDs, new `done`/`passed` statuses, archive paths).

**Mode differences (all-pass closure):**
- **uat-auto-plus** additionally: delete this task's screenshots (`mcp__serena__list_dir` `wiki/work/uat/screenshots/` for `<task-number>-*`, then `git rm` / `rm`); **terminate every background process** it started (prerequisites + fix attempts — KillShell as needed; verify none remain). Its decision-annotation step supports multi-task WIP tracking: with other WIP tasks remaining, set only this task's sub-line to `**done** YYYY-MM-DD`; when none remain, flip `**WIP**` → `**done** YYYY-MM-DD` and append `- **Decision fully implemented** YYYY-MM-DD`.
- **uat-auto** keeps screenshots (diagnostic evidence).

### Any fail (`[FAIL]` markers remain)

Leave the UAT file in `wiki/work/uat/` (status stays `pending`/`in-progress`). Keep screenshots — diagnostic evidence for the next walkthrough. Emit the summary. **Headless modes exit 0** — an orchestrator treats the skill exiting as its task done; the pipeline decides what to do with the fail markers. **uat-auto-plus** also terminates all background processes before exit.

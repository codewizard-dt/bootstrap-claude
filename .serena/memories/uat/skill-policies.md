# UAT Skill Policies (updated 2026-06-06)

## Stub Detection Gate (uat-auto and uat-auto-plus)
Both `/uat-auto` and `/uat-auto-plus` now have a Step 3.5 pre-execution stub detection gate.
- If the implementation file contains stub indicators (TODO/FIXME, `throw new Error('not implemented')`, empty bodies, `pass`, placeholder comments), the test is left as `- [ ] Pass` (pending) — it is NOT executed and NOT recorded as `[FAIL]`.
- Stub-detected tests appear in the summary as `🔲 Stub-detected (pending)`.
- For `/uat-auto-plus`: stub-detected tests do NOT enter the fix loop (implementing from scratch is out of scope for autonomous fix).

## UI Tests Are Manual (uat-auto)
`/uat-auto` does NOT use Playwright at all. UI tests (`UAT-UI-*` or tests with `Page:`/`Components:` metadata) always record:
```
[FAIL: auto-judge: UI test requires human verification — use /uat-walk]
```
These failures are expected — not blocking for power-mode orchestration. They require a subsequent `/uat-walk`.

## Playwright Allowed in uat-auto-plus Only
`/uat-auto-plus` retains full Playwright support for UI tests. It is the only headless variant that can auto-verify UI behavior.

## /uat-walk: No Changes
Already correct — Playwright only activates on Fail/Fix-now verdicts; user always issues pass verdict.

## power-mode Awareness
The power-mode orchestrator and minimal orchestrator prompt both now note:
- UI test `[FAIL]` results after `/uat-auto` are expected; don't treat as blocking.
- Stub-detected pending tests mean the task is not complete until the feature is implemented and re-tested.

# UAT Skill Policies (updated 2026-06-08)

## Playwright Removed from All UAT Skills
No UAT skill uses Playwright or any browser automation. All three headless/interactive variants handle UI tests the same way.

## Stub Detection Gate (uat-auto and uat-auto-plus)
Both `/uat-auto` and `/uat-auto-plus` have a Step 3.5 pre-execution stub detection gate.
- If the implementation file contains stub indicators (TODO/FIXME, `throw new Error('not implemented')`, empty bodies, `pass`, placeholder comments), the test is left as `- [ ] Pass` (pending) — it is NOT executed and NOT recorded as `[FAIL]`.
- Stub-detected tests appear in the summary as `🔲 Stub-detected (pending)`.
- For `/uat-auto-plus`: stub-detected tests do NOT enter the fix loop (implementing from scratch is out of scope for autonomous fix).

## UI Tests Are Manual (all variants)
All UAT skills record UI tests (`UAT-UI-*` or tests with `Page:`/`Components:` metadata) as:
```
[FAIL: auto-judge: UI test requires human verification — use /uat-walk]
```
- `/uat-auto`: always was manual; now also removes stale uat-auto-plus Playwright cross-references
- `/uat-auto-plus`: UI tests now match uat-auto behavior — fail-as-manual, no fix loop
- `/uat-walk`: user manually tests UI; no screenshots taken; no Playwright troubleshooting

## /uat-walk: No Changes to Core Flow
The interactive walkthrough flow is unchanged. When a UI test fails, the user reports what went wrong; no automated screenshot is taken. Fix Now still delegates to a subagent, but without Playwright diagnostic instructions.

## power-mode Awareness
The power-mode orchestrator and minimal orchestrator prompt both note:
- UI test `[FAIL]` results after `/uat-auto` or `/uat-auto-plus` are expected; don't treat as blocking.
- Stub-detected pending tests mean the task is not complete until the feature is implemented and re-tested.

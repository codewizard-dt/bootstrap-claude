---
title: Bugs Index
updated: 2026-08-07
---

# Bugs — Active Items

Lists **only active** bugs (`open`, `triaged`, `in-progress`). When a bug leaves the active set (`closed`, `wontfix`, `duplicate`, `cannot-reproduce`), delete its line here — the file itself never moves; status lives in its frontmatter. See the [lifecycle](lifecycle.md).

Entry format: `- [BUG-NNNN — Title](BUG-NNNN-slug.md) — one-line summary · status · P0–P3`

- [BUG-0001 — Grep guard skips Serena enforcement for paths that merely contain a non-code directory name](BUG-0001-grep-guard-unanchored-path-skip.md) — unanchored non-code path denylist in `serena-first-guard.js:73` lets `mydocs/`, `myknowledge-vault/`, `applogs/` bypass enforcement silently · open · —
- [BUG-0002 — Grep guard fails open on a brace glob mixing code and non-code extensions](BUG-0002-grep-guard-brace-glob-fails-open.md) — `glob="**/*.{ts,json}"` re-extracts no extension, so `ext === ''` exits 0 and the `.ts` half goes unenforced · open · —
- [BUG-0003 — Zero-width character bypass is open on the Grep surface](BUG-0003-grep-guard-zero-width-bypass.md) — `serena-first-guard.js` sets neither `stripZeroWidth` nor an equivalent strip, so `create<ZWSP>Order` is not classified as a symbol · open · —
- [BUG-0004 — serena-pre-delegation emits decision 'warn', which may be an unrecognized no-op](BUG-0004-pre-delegation-warn-decision-no-op.md) — suspected: if `warn` is not an accepted PreToolUse decision, the whole implement-phase path emits nothing · open · —
- [BUG-0005 — mv-absolute-path-block resolves the project root from process.cwd() instead of data.cwd](BUG-0005-mv-guard-uses-process-cwd.md) — unexplained divergence from every sibling Bash guard; the in-project test may use the wrong root · open · —
- [BUG-0006 — mv-absolute-path-block splits segments on ; && || but not |](BUG-0006-mv-guard-segment-split-omits-pipe.md) — verified NOT a bypass; the real effect is arg-bleed across a pipe causing false positives on piped `mv` · open · —
- [BUG-0007 — isBlockedEnvFile is duplicated byte-for-byte across two .env guards](BUG-0007-env-predicate-duplicated-across-guards.md) — no shared extraction; only the `env-content-read-guard` copy carries the "change both or neither" warning · open · —
- [BUG-0008 — Hook-audit cleanup: cosmetic, dead-code, and latent defects found during TASK-039](BUG-0008-hook-audit-cleanup-checklist.md) — 10-item checklist of message-only, dead-code, and latent findings; no verdict changes · open · —

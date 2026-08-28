---
id: package-install-consent-gating
title: Gating package-install-consent.js via a Preference Instead of Always Blocking
updated: 2026-08-27
sources:
  - ../../../raw/research/package-install-consent-gating/index.md
confidence: extracted
tags: [hooks, preferences, package-management, security]
---

`lib/hooks/package-install-consent.js` unconditionally denies every package-manager install (`npm install`, `pip install`, `uvx --from`, etc.) except one hardcoded exception (Serena's own repo) — [`lib/hooks/README.md`](../../../lib/hooks/README.md) explicitly calls this **deliberate friction, not a bug**. Meanwhile `bootstrap-prefs.js`'s mature four-state preference store (`unset`/settled/`false`/`ask`, project/global/either scope, schema-validated) has **zero consumers in `lib/hooks/`** — every existing "escape hatch" documented for this hook class is a command-rephrasing trick, never a stored preference or sentinel file.

**Recommendation**: add a new, project-scoped `packageInstall.consent` key (`true | false | ask`, default `false` — today's behavior unchanged), read by the hook via a subprocess call to `bootstrap-prefs.js` (matching how every bash installer already consults it). `false`/`unset` → keep denying. `ask` → emit the officially-documented `permissionDecision: "defer"`, handing back to Claude Code's native permission prompt (interactive: asks the human normally; headless/bypass: proceeds, the same trade-off every other allowed command already accepts under bypass). `true` → emit `permissionDecision: "allow"` outright. A project-level, reversible opt-in solves the stated pain (new-project scaffolding, dependency updates) without weakening the "no package enters this machine without consent" guarantee globally.

The Claude Code `PreToolUse` hook contract supports **four** decision states, not two: `"allow" | "deny" | "ask" | "defer"`. `defer` is the precise, documented mechanism for "hand this back to normal permission handling" — not an informal "emit nothing" workaround, and this repo's shared `lib/hooks/lib/command-parse.js` currently only exports `deny()`, so `allow()`/`defer()` helpers would need adding.

The genuinely open design question isn't the storage mechanism (a project-scope preference key already *is* a sentinel — its presence/value is exactly as `ls`-discoverable as a bespoke marker file, plus it comes with `/bootstrap-config`, schema validation, and the generated companion README for free) — it's `askedBy`. `test/bootstrap-prefs.test.js` hardcodes `consumer` to `installer | skill` and requires every `askedBy` to resolve to a real `lib/scripts/*` file or a `lib/skills/<name>/SKILL.md`; **neither branch accepts a `lib/hooks/*.js` path**. This would be the first bootstrap-prefs key ever consumed by a hook. Two viable, low-risk resolutions: point `askedBy` at `/bootstrap-config` (accurate today, zero schema/test changes beyond the new key itself), or add a new project-scope question inside `setup-project.sh`/`update-project.sh` (both already take `PROJECT_DIR`), mirroring the `obsidian.plugins` precedent. A `consumer: "hook"` taxonomy extension is the "clean" fix but touches a well-tested cross-cutting contract — worth deferring until a second hook wants the same treatment.

This closes an open thread on [[bootstrap-claude-hooks]]'s "Contested: package-install consent" note: `deny-rules-vs-hooks` argued for `permissions.ask` over a hook; `bypass-mode-enforcement` argued for keeping the hook because headless runs can't answer an `ask` prompt. This research doesn't relitigate that — it accepts the hook (for the correctly-identified headless-safety reason) and adds a **third position**: keep the hook, but make its denial preference-gated per project rather than unconditional, so the headless-safety property is preserved for every project that hasn't opted in, while routine interactive dependency work in a project that has isn't permanently blocked.

derived_from::[[package-install-consent-gating]]
relates_to::[[bootstrap-claude-hooks]]
relates_to::[[bootstrap-guarded-install-pattern]]

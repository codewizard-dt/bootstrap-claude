# Task Index

> **Maintenance contract** — this index is the canonical survey source for `/tackle` no-args mode. Skills mutate it directly:
>
> - `/task-add` → appends a row to **Active**
> - `/tackle` → updates `Progress` and `Flags` after each cycle
> - `/uat-walk`, `/uat-skip` → moves a row from **Active** to **Completed**, sets `UAT`
> - `/task-trash` → removes a row entirely (or moves it under a Trashed section if one exists)
>
> Keep rows accurate. `/tackle` reads only this file (plus a directory listing of `.docs/uat/pending/`) to recommend the next task — stale rows lead to wrong recommendations.

## Active Tasks

| #   | Slug                                                                  | Progress | UAT     | Flags              | Objective |
|-----|-----------------------------------------------------------------------|----------|---------|--------------------|-----------|
| 001 | [project-registry-push](active/001-project-registry-push.md)          | 0/18     | none    | —                  | Track setup'd projects in a registry file; add push-updates.sh to sync all registered projects. |
| 005 | [command-anti-patterns](active/005-command-anti-patterns.md)          | 26/29    | pending | [DEFERRED-TO-UAT]  | New guide documenting shell-hygiene anti-patterns; /tackle restricted to static gates; /uat-generator owns runtime verification. |
| 006 | [migrate-commands-to-skills](active/006-migrate-commands-to-skills.md)| 55/55    | none    | —                  | Migrate all 20 legacy .claude/commands/*.md flat-files to .claude/skills/<name>/SKILL.md with explicit model:, invocation-flag, and effort: frontmatter per command. |
| 007 | [publish-npm-package](active/007-publish-npm-package.md)              | 0/43     | none    | [DEFERRED-TO-UAT]  | Fix `package.json` `files` field, add `prepublishOnly` guard, publish 1.0.0, verify `npx` works end-to-end against fresh dirs. |
| 009 | [audit-skills-vs-sdlc](active/009-audit-skills-vs-sdlc.md)            | 0/10     | none    |                    | Audit 32+ skills against SDLC best practices; produce gap analysis and recommendations. |

## Completed Tasks

| #   | Slug                                                          | UAT     | Objective |
|-----|---------------------------------------------------------------|---------|-----------|
| 002 | [bootstrap-serena](completed/002-bootstrap-serena.md)         | skipped | bootstrap-serena.sh creates .serena/ via headless `claude --print` and enables 11 optional tools; wired into setup-project.sh and update-project.sh. |
| 003 | [sync-docs-scaffold](completed/003-sync-docs-scaffold.md)     | —       | Extract sync-docs-scaffold.sh helper; make setup/update scripts sync only guides + directory shells, never this template's task/UAT content. |
| 008 | [rename-skills-noun-first](completed/008-rename-skills-noun-first.md) | skipped | Rename 19 slash commands from action-first/inconsistent names to a uniform noun-first, action-second kebab-flat pattern and sweep every cross-reference. |

---

## Column Reference

- **#** — three-digit task number from filename prefix
- **Slug** — kebab-case slug from filename, linked to the task file
- **Progress** — `<completed-checkboxes>/<total-checkboxes>` across all `## Steps` sections (count `- [x]` vs all `- [ ]`/`- [x]`)
- **UAT** — `pending` (file in `.docs/uat/pending/`), `completed`, `skipped`, or `none`
- **Flags** — any of `[WIP]`, `[BLOCKED: ...]`, `[FAILED: ...]`, `[DEFERRED-TO-UAT]` present in the task file; `—` if none
- **Objective** — first sentence from the task's `## Objective` section (truncate if needed)

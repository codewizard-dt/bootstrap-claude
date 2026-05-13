# Task Index

**Last task:** [009-audit-skills-vs-sdlc](active/009-audit-skills-vs-sdlc.md)
**Next task number:** 010

> **Maintenance contract** — this index is the canonical survey source for `/tackle` no-args mode. It lists **only active tasks** (those in `.docs/tasks/active/`, including any with a pending UAT). Completed and trashed tasks are intentionally **not** indexed here — `.docs/tasks/completed/` and `.docs/tasks/trashed/` are the source of truth for those, accessible via directory listing when needed.
>
> The two header lines (**Last task** and **Next task number**) are also maintained by skills — they let `/task-add` pick the next number without scanning the directory, and let humans see at a glance what was created most recently. **Last task** always points at the highest-numbered task that exists anywhere on disk (`active/`, `completed/`, or `trashed/`), with the link path matching its current location. **Next task number** is always `Last task`'s number + 1, zero-padded to three digits.
>
> Skills mutate this index directly:
>
> - `/task-add` → appends a row to **Active**; updates **Last task** (to the just-created task) and bumps **Next task number**
> - `/tackle` → updates `Progress` and `Flags` after each cycle
> - `/uat-walk`, `/uat-auto`, `/uat-auto-plus`, `/uat-skip` → **removes** the row when the task moves to `completed/`; if the moved task **is** the **Last task**, rewrites its link path from `active/...` to `completed/...`
> - `/task-trash` → removes the row entirely; if the trashed task **is** the **Last task**, rewrites its link path from `active/...` (or `completed/...`) to `trashed/...` — **Last task** still points at it because **Next task number** must never go down
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

---

## Column Reference

- **#** — three-digit task number from filename prefix
- **Slug** — kebab-case slug from filename, linked to the task file
- **Progress** — `<completed-checkboxes>/<total-checkboxes>` across all `## Steps` sections (count `- [x]` vs all `- [ ]`/`- [x]`)
- **UAT** — `pending` (file in `.docs/uat/pending/`) or `none`. (Tasks whose UAT has reached `completed/` or `skipped/` have moved out of `active/`, so they no longer appear in this index.)
- **Flags** — any of `[WIP]`, `[BLOCKED: ...]`, `[FAILED: ...]`, `[DEFERRED-TO-UAT]` present in the task file; `—` if none
- **Objective** — first sentence from the task's `## Objective` section (truncate if needed)

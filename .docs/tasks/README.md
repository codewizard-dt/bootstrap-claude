# Task Index

## Active Tasks

- [001 — Project Registry and Push Updates Script](active/001-project-registry-push.md) — Track setup'd projects in a registry file; add push-updates.sh to sync all registered projects.
- [003 — Sync .docs/ Scaffold Only](active/003-sync-docs-scaffold.md) — Extract sync-docs-scaffold.sh helper; make setup/update scripts sync only guides + directory shells, never this template's task/UAT content.
- [005 — Command Anti-Patterns Guide and Tackle/UAT Verification Split](active/005-command-anti-patterns.md) — New guide documenting shell-hygiene anti-patterns; /tackle restricted to static gates; /uat-generator owns runtime verification.
- [006 — Migrate Commands to Skills](active/006-migrate-commands-to-skills.md) — Migrate all 20 legacy .claude/commands/*.md flat-files to .claude/skills/<name>/SKILL.md with explicit model:, invocation-flag, and effort: frontmatter per command.
- [007 — Publish @codewizard-dt/bootstrap-claude to npm](active/007-publish-npm-package.md) — Fix `package.json` `files` field (add missing `bootstrap-serena.sh`, `sync-docs-scaffold.sh`, full `.docs/guides/`, `.docs/adr/`, `.claude/skills/`), add `prepublishOnly` guard, publish 1.0.0, verify `npx` works end-to-end against fresh dirs.

## Completed Tasks

- [002 — Bootstrap Serena project.yml with Optional Tools](completed/002-bootstrap-serena.md) — bootstrap-serena.sh creates .serena/ via headless `claude --print` and enables 11 optional tools; wired into setup-project.sh and update-project.sh. *(UAT skipped)*

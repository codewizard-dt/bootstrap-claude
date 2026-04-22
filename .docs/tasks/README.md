# Task Index

## Active Tasks

- [001 — Project Registry and Push Updates Script](active/001-project-registry-push.md) — Track setup'd projects in a registry file; add push-updates.sh to sync all registered projects.
- [003 — Sync .docs/ Scaffold Only](active/003-sync-docs-scaffold.md) — Extract sync-docs-scaffold.sh helper; make setup/update scripts sync only guides + directory shells, never this template's task/UAT content.
- [004 — Harden /uat-auth Against Real-World Auth Stacks](active/004-harden-uat-auth-command.md) — Fix the observed error loop (missing URL export, `.test` TLD rejection, shell-state loss, verification gate, DB escalation) with explicit exports, safer defaults, framework adapters, and a strict Forbidden Actions fail-closed boundary.
- [005 — Command Anti-Patterns Guide and Tackle/UAT Verification Split](active/005-command-anti-patterns.md) — New guide documenting shell-hygiene anti-patterns; /tackle restricted to static gates; /uat-generator owns runtime verification.

## Completed Tasks

- [002 — Bootstrap Serena project.yml with Optional Tools](completed/002-bootstrap-serena.md) — bootstrap-serena.sh creates .serena/ via headless `claude --print` and enables 11 optional tools; wired into setup-project.sh and update-project.sh. *(UAT skipped)*

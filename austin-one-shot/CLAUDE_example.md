# CLAUDE.md

## Stack: TypeScript (incl. React/TSX), JSON, Python — nothing else by default
Other languages, runtimes, or config formats only when the task is *impossible* in these — a hard external constraint, not preference — and only after surfacing the constraint and the in-stack alternative you ruled out. Bash: throwaway one-liners only; anything reusable is TS or Python. Repo-owned config: JSON. Necessary boundaries are fine (SQL, `Dockerfile`, HTML/CSS via React, the one required CI YAML) — use them, don't expand them.

## Hosting: self-hosted GitLab (not GitHub)
- Host `labs.gauntletai.com` · Project `austinwade/cover` · Remote `origin` (SSH).
- `glab` CLI is installed and already authenticated — use it for all GitLab work. Do **not** use `gh`; do **not** author GitHub Actions.
- Terminology: **merge requests (MRs)** not PRs; **pipelines** not Actions/checks. (`glab --help` for commands.)

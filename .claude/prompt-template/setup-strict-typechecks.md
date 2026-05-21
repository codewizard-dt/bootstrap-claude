# Set up strict type checking for this project.

## Phase 1 — Assess languages

Scan the repo and identify every language that has a type-checking or linting tool (e.g. TypeScript, Python, Go, Rust, Java). For each
one, note:
- Which files / directories contain that language
- What config files already exist (tsconfig, pyproject.toml, mypy.ini, .eslintrc, etc.)
- What package manager / toolchain is in use

## Phase 2 — Research best practices (per language)

For each language found, use Context7 (for library docs) or Brave Search (for general practices, sequential, 1 req/sec) to look up the
current strict-mode recommendations:
- TypeScript: tsconfig strict, tseslint strictTypeChecked, stylisticTypeChecked, parserOptions.project
- Python: mypy --strict, pyproject.toml [tool.mypy]
- Go: staticcheck, go vet
- Rust: #![deny(warnings)], Clippy --deny warnings
- …and so on for any other language present

Research what the strict flags actually enable, what the known gotchas are (e.g. type-aware ESLint rules requiring parserOptions.project;
mypy needing ignore_missing_imports for third-party stubs), and what companion tools are idiomatic (e.g. ESLint for TypeScript,
mypy/pyright for Python).

## Phase 3 — Implement

For each language:
1. Create or update the type-checker / linter config to enable strict mode
2. Fix any errors that strict mode surfaces in existing code (one error at a time, using Serena symbolic tools for code edits; do not
just add // eslint-disable blanket suppressions — fix root causes; use targeted disables only for intentional framework patterns like
TanStack Router's throw redirect(...))
3. If a language's toolchain is not yet installed, add it to the appropriate dependency file (e.g. @tanstack/router-cli to
devDependencies, mypy to dev extras)

## Phase 4 — Makefile

Create (or update) a root-level Makefile with:
make typecheck        # runs all language checks in sequence
make typecheck-<lang> # per-language target

Each per-language target must:
- Run any required code-generation step first (e.g. tsr generate for TanStack Router before tsc -b)
- Run the type checker
- Run the linter if one exists for that language
- Exit non-zero on any error

If a language directory is empty (no source files yet), the target must skip gracefully rather than fail.

## Phase 5 — Skill

Write .claude/skills/typecheck/SKILL.md with this exact content (do not alter the structure):

```
---
name: typecheck
description: Run type-check, fix the first error, repeat until clean
model: claude-sonnet-4-6
disable-model-invocation: false
user-invocable: true
---

# Run type-check and fix issues

IMPORTANT: Adhere to all rules in `.docs/guides/mcp-tools.md` if it exists.

## Step 1: find the problem

Run `make typecheck 2>&1 | head -20`

If there are no errors, this task is done.

## Step 2: assess the problem

- Analyze the output for only the **first** error reported
- Use Serena to read the relevant code symbols where the error occurs
- Understand the root cause: type annotation issue, import problem, or genuine type mismatch?
- Use Context7 or Brave Search if you need more detail on the error

## Step 3: fix the root cause

- Fix the root cause of the first error using Serena's symbolic editing tools
- Re-run `make typecheck 2>&1 | head -20` to verify the fix

## Step 4: repeat, one error at a time

- Repeat steps 1–3 until the output is empty
- Do not keep a to-do list of separate errors — just run the command again to get the next one
```

Completion check

Run make typecheck and confirm it exits 0 with no errors (warnings from advisory-only rules like fast-refresh are acceptable). Report
which languages were configured and what strict flags were enabled for each.
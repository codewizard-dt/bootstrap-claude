---
description: Add all changed files to git, then create a new commit
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

# git-commit

## Step 1: Run Lint Fix Cycles

Before committing, run the `/lint` workflow to catch and fix any diagnostics:

1. Execute the full `/lint` command (all cycles until clean or issues are skipped)
2. If any fixes were applied, they will be included in the commit automatically
3. If any issues were skipped (unfixable), warn the user before proceeding

## Step 2: Commit

- `git-commit` is a bash alias for `git add . && git commit -m`
- **ALWAYS use the `git-commit` bash alias.** Never use `git add` or `git commit` directly.
- First, assess changes since last commit
- Always COMMIT ALL FILES unless they are in .gitignore, ie unless they are not coming up in the
  git changes
- Then, consider an appropriate commit message, let's call it `$message`
- Finally, run: `git-commit "$message"`

---
name: git-commit
description: Stage all changed files and create a commit with an auto-generated message
model: claude-haiku-4-5-20251001
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

# git-commit

## Step 0: Confirmation Gate (HARD STOP)

⛔ **Do not proceed past this step without explicit user confirmation.**

Before any investigation, `git status`, `git diff`, `git log`, lint cycles, or staging:

1. Ask the user: **"Ready to run /git-commit? This will run /lint fix cycles and then stage and commit all non-gitignored changes. Reply 'yes' (or 'y') to continue."**
2. **Wait** for the user's response.
3. Only if the user replies with an affirmative (e.g. `yes`, `y`, `proceed`, `go`) may you continue to Step 1.
4. If the response is anything else — including silence, questions, "no", or a request to change scope — **halt** and address that input. Do not run any git or lint commands.

This gate exists so the user can abort before any read or write side effects. Never skip it, never assume prior approval from earlier in the session carries over, and never run preparatory `git status`/`git diff` "just to be helpful" before the user confirms.

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

### ⛔ Commit-message format rules — STRICT

The commit message MUST be a **single-line, single-quoted-argument string**. Subject only, no body. This is a hard rule because anything else triggers a Bash approval prompt and slows you down.

**Required form:**

```bash
git-commit "Single-line subject describing the change"
```

That's it. One pair of double quotes. One line. One argument.

**❌ Forbidden — every one of these patterns triggers an approval prompt:**

```bash
# WRONG — heredoc / command substitution
git-commit "$(cat <<'EOF'
Some subject

Some body line.
EOF
)"

# WRONG — printf
git-commit "$(printf 'subject\n\nbody')"

# WRONG — ANSI-C quoted string with embedded newlines
git-commit $'subject\n\nbody'

# WRONG — actual newlines inside the quoted string
git-commit "subject

body"

# WRONG — multiple -m flags or any extra args (the alias hardcodes one -m)
git-commit "subject" "-m" "body"

# WRONG — piping or chaining
echo "subject" | git-commit -F -
```

**✅ Correct — always:**

```bash
git-commit "Streamline task lifecycle: drop pending-uat stage and add lifecycle guide"
git-commit "Reinforce ban on shell-based file editing across mcp-tools and task commands"
git-commit "Force one Bash invocation per test in /uat-walk Step 3A"
```

### Writing a good single-line subject

If the change feels too complex to summarize in one line, **make the subject more descriptive** — do not reach for a multi-line body. Aim for ~70–100 characters but go longer if it adds real information. Lead with the *what* and the *why* on the same line, separated by a colon when helpful:

- ✅ `Require research for every test type in /uat-generate with checkpoint gate`
- ✅ `Allow standard tools for markdown editing; ban bash exploration commands`
- ❌ `Update commands` (too vague)
- ❌ `Fix bug` (too vague)

Detailed reasoning, before/after examples, and rationale belong in **PR descriptions**, not in commit message bodies. The commit subject is the index entry; the PR is the encyclopedia.

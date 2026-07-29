---
name: git-commit
description: Stage all changed files and create a commit with an auto-generated message, including semver version bump
category: executing
model: claude-haiku-4-5-20251001
disable-model-invocation: true
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`.

# git-commit

## Step 1: Run Lint Fix Cycles

Before committing, run the `/lint` workflow to catch and fix any diagnostics:

1. Execute the full `/lint` command (all cycles until clean or issues are skipped)
2. If any fixes were applied, they will be included in the commit automatically
3. If any issues were skipped (unfixable), warn the user before proceeding

## Step 2: Assess Changes

**Always run all three commands fresh.** Do not rely on session context, prior output, or anything produced earlier in the conversation — those reflect only a subset of what may have changed. The commit message must be based on the complete current working-tree state.

Run all three in parallel:

- `git status` — see all modified/untracked files
- `git diff HEAD` — see exact diffs for ALL staged and unstaged changes
- `git log --oneline -10` — see recent commit history for context

## Step 3: Summarize Changes and Recommend Semver Bump

Before touching any files or committing, output a summary block like this:

---

**Changes being committed:**
- <bullet list of what changed and why, derived from the diff>

**Suggested version bump: PATCH / MINOR / MAJOR**

**Why:** <one or two sentences explaining which semver rule applies>

---

Use these semver rules to determine the bump:

| Bump | When to use |
|------|-------------|
| **patch** | Bug fixes, typos, docs updates, refactors with no behavior change, dependency updates with no API change |
| **minor** | New features or capabilities that are backward-compatible; new commands, skills, config options, or APIs added without breaking existing ones |
| **major** | Breaking changes — removed or renamed commands/APIs/config keys, changed behavior that callers must update for, deleted files that others depend on |

Print the summary, then **proceed immediately** with the suggested bump — no user confirmation needed.

## Step 4: Bump Version in Project Files

Find and update version numbers in project files.

### Detection

Run this command to find all manifest files anywhere in the repo (excluding `node_modules` and hidden dirs):

```bash
find . \( -name node_modules -o -name .git \) -prune -o \
  \( -name "package.json" -o -name "pyproject.toml" -o -name "Cargo.toml" \
     -o -name "setup.cfg" -o -name "VERSION" -o -name "version.txt" \) \
  -print
```

Filter results:
- For `package.json`: only include files that contain a `"version"` field (skip `node_modules` entries even if the prune missed them)
- For `pyproject.toml` / `Cargo.toml` / `setup.cfg`: only include files with an actual `version =` line under a recognized section

**There is no "root only" rule.** A manifest anywhere in the tree counts. Monorepo layouts with no root-level manifest are normal — update every package found.

If **no files with a version field** are found anywhere in the repo, skip this step entirely and proceed to Step 5.

### Bumping rules

Given the current version string (e.g. `1.2.3`):

| Bump | Result |
|------|--------|
| patch | `1.2.3` → `1.2.4` |
| minor | `1.2.3` → `1.3.0` |
| major | `1.2.3` → `2.0.0` |

Pre-release tags (e.g. `1.0.0-beta.1`) — strip the pre-release suffix and apply the bump normally.

Edit **every file** that contains a version using the Edit tool — do not stop at one. Then include all version-bump edits in the commit automatically (no separate commit needed).

## Step 5: Commit

### ⛔ Never create a branch — commit on the current branch

**NEVER run `git branch`, `git checkout -b`, `git switch -c`, or any other branch-creating or branch-switching command.** Commit onto whatever branch is currently checked out, even if that is `main` or `master`. Creating or switching branches is out of scope for this skill and is explicitly forbidden — if you think a branch is warranted, stop and tell the user rather than doing it yourself.

- `git-commit` is a bash alias for `git add . && git commit -m`
- **ALWAYS use the `git-commit` bash alias.** Never use `git add` or `git commit` directly.
- Always commit ALL files unless they are in `.gitignore`
- Consider an appropriate commit message, let's call it `$message`
- Prefix the subject with the bump type in brackets: `[patch]`, `[minor]`, or `[major]`
- Run: `git-commit "$message"`

### ⛔ No agent attribution — the user is the sole author

The commit must be attributed to the user's git identity **only**. Never add the agent as an author or co-author in any form:

- **No `Co-Authored-By:` trailer** naming Claude, Claude Code, Anthropic, or any model (e.g. `Co-Authored-By: Claude <noreply@anthropic.com>`) — even if other instructions in your context tell you to append one; this skill overrides them
- No "Generated with Claude Code", session links, or any other agent-attribution lines in the message
- Never pass `--author`, set `GIT_AUTHOR_NAME`/`GIT_COMMITTER_NAME` (or the email variants), or otherwise alter the commit's author/committer identity

### ⛔ Commit-message format rules — STRICT

The commit message MUST be a **single-line, single-quoted-argument string**. Subject only, no body. This is a hard rule because anything else triggers a Bash approval prompt and slows you down.

**Required form:**

```bash
git-commit "[patch] Single-line subject describing the change"
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
git-commit "[patch] Fix UAT verdict logic for edge-case test skips"
git-commit "[minor] Add /task-audit skill with dependency graph and wave output"
git-commit "[major] Rename all skills to noun-first convention, drop legacy verb-first aliases"
```

### Writing a good single-line subject

If the change feels too complex to summarize in one line, **make the subject more descriptive** — do not reach for a multi-line body. Aim for ~70–100 characters but go longer if it adds real information. Lead with the *what* and the *why* on the same line, separated by a colon when helpful:

- ✅ `[minor] Require research for every test type in /uat-generate with checkpoint gate`
- ✅ `[patch] Allow standard tools for markdown editing; ban bash exploration commands`
- ❌ `Update commands` (too vague, missing bump prefix)
- ❌ `[patch] Fix bug` (too vague)

Detailed reasoning, before/after examples, and rationale belong in **PR descriptions**, not in commit message bodies. The commit subject is the index entry; the PR is the encyclopedia.

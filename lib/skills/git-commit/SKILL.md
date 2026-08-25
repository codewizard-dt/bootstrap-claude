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

## Step 0: Read the two preferences that govern this skill

Two stored preferences change what this command does. Read **both, once, before Step 1** — never mid-run, and never once per file:

```bash
node ~/.claude/bootstrap-prefs.js --get gitCommit.versionBump --project . 2>/dev/null || echo unset
node ~/.claude/bootstrap-prefs.js --get gitCommit.autoPush --project . 2>/dev/null || echo unset
```

`--project .` is required. Both keys are `scope: either`, so the answer resolves **project file → global file → schema default**; dropping the flag would read the machine-wide answer even in a repo that overrides it. If either command fails — bootstrap was never installed globally, or `node` is not on PATH — treat that answer as `unset`.

`unset` means *nobody has ever been asked*. It always keeps today's behavior; it never invents one. Mention an `unset` key **once**, in the final report, never as a mid-run interruption.

## Step 1: Run Lint Fix Cycles

Before committing, run the `/lint` workflow to catch and fix any diagnostics:

1. Execute the full `/lint` command (all cycles until clean or issues are skipped)
2. If any fixes were applied, they will be included in the commit automatically
3. If any issues were skipped (unfixable), warn the user before proceeding

## Step 2: Condense Verbose Inline Comments

Scan every line this commit **adds or modifies** for comments more verbose than necessary, and rewrite them to the shortest form that keeps the essential point — ideally one line.

**Scope: diff-only, not whole-file.** Run `git diff HEAD` and look only at `+` lines. A comment already sitting untouched elsewhere in a file is out of scope — never touch a comment this commit did not add or modify.

**Never touch — leave exactly as-is:**
- **Structured documentation comments**, in any language: JSDoc/TSDoc (`/** ... */`, especially with `@param`/`@returns`/`@throws`/`@example`), Python docstrings (`"""..."""`/`'''...'''` directly under a `def`/`class`), Rust doc comments (`///`, `//!`), Go doc comments (the block directly above an exported declaration, starting with that declaration's own name), Java/C# Javadoc/XMLDoc blocks. These document an API's contract, not implementation rationale — condensing them destroys structure a doc generator or IDE tooltip depends on.
- **Repo-documented comment exceptions.** Before editing a file, check whether the target repo's own `CLAUDE.md` (nearest one up the directory tree) explicitly carves out a comment-density exception for that file or directory (e.g. this repo's own `CLAUDE.md`: `lib/hooks/*.js` carries inline rationale comments "by deliberate exception... do not strip them"). Skip any file covered by such an exception entirely.
- Comments already a single concise line.

**Condense everything else:**
- If a comment restates what the code already makes obvious (the *what*) with no *why* — delete it entirely. Matches this repo's own default: "if removing the comment wouldn't confuse a future reader, don't write it."
- If it explains a genuinely non-obvious *why* (a workaround, a hidden constraint, a subtle invariant) but spans more lines or words than necessary, rewrite it to the single shortest sentence that preserves that reason.
- Preserve the comment's position (same line for a trailing comment, same location for a block comment) and its language's comment syntax — only the wording and line count change.

Use `Edit` per file for every change — never `sed`/`awk`/shell rewrites.

## Step 3: Assess Changes

**Always run all three commands fresh.** Do not rely on session context, prior output, or anything produced earlier in the conversation — those reflect only a subset of what may have changed. The commit message must be based on the complete current working-tree state.

Run all three in parallel:

- `git status` — see all modified/untracked files
- `git diff HEAD` — see exact diffs for ALL staged and unstaged changes
- `git log --oneline -10` — see recent commit history for context

## Step 4: Summarize Changes and Recommend Semver Bump

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

Print the summary. What happens next is decided by `gitCommit.versionBump` from Step 0 — see the table in Step 5. **Do not ask for confirmation here**; the only value that asks is `confirm`, and it asks in Step 5 where the manifest list is known.

## Step 5: Bump Version in Project Files

### Gate: `gitCommit.versionBump`

Its grammar is `auto | confirm | never` — there is deliberately **no `ask` value**, because `confirm` *is* this key's ask state. Do not look for one.

| Value | Manifests | Subject prefix |
|-------|-----------|----------------|
| `auto` | Today's behavior. Detect every manifest and apply the bump to all of them, no confirmation. | **written** |
| `confirm` — approved | Bump exactly as `auto` does. | **written** |
| `confirm` — declined | Edit no manifest. | **omitted** |
| `never` | Touch **no** version file at all. Skip straight to Step 6. | **omitted** |
| `unset` | Behave exactly as `auto` — that is today's behavior and an unanswered key must never change it. | **written** |

`confirm` prints the suggested bump **and the full list of manifest files that would change**, then asks once with `AskUserQuestion` before editing anything. Ask **every run** and **never persist the answer** — the standing choice is "keep asking me", so recording a reply would destroy it.

### ⛔ The prefix and the bump travel together

**Write `[patch]`/`[minor]`/`[major]` if and only if a version was actually bumped in this run.** The prefix is a claim about what the commit did, and release tooling reads it as one. A `[minor]` prefix on a commit that bumped nothing is not a harmless label — it is a false statement that tooling will act on, tagging or publishing a release that has no version change behind it. An unprefixed subject is merely uninformative; a lying prefix is actively wrong, and it is worse the more automation is downstream.

So when no bump happens, commit a **bare subject with no bracket prefix at all**. Do not substitute `[none]`, `[skip]`, `[no-bump]`, or any other placeholder — an unrecognized token is its own kind of noise, and tooling that pattern-matches the three real values will ignore a bare subject correctly.

The one case where nothing was bumped for a reason unrelated to this preference — a repo with **no manifest at all** (Detection below finds nothing) — follows the same rule: nothing was bumped, so no prefix.

Report lines, each at most once per run:
- `never` → `Version files untouched and no subject prefix written (gitCommit.versionBump=never). Change with /bootstrap-config.`
- `confirm`-declined → `Bump declined — no manifest edited and no subject prefix written.`
- `unset` → `gitCommit.versionBump is unanswered — /git-commit bumps every manifest by default. Set it with: node ~/.claude/bootstrap-prefs.js --set gitCommit.versionBump --value auto --global` (or `confirm` / `never`).

Anything else stored under this key is a value from a newer bootstrap that this skill has no branch for: treat it as `unset`, and say which value you did not recognize.

For `auto`, `confirm`-approved, and `unset`, continue below. For `never` and `confirm`-declined, go to Step 6.

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

If **no files with a version field** are found anywhere in the repo, skip this step entirely and proceed to Step 6.

### Bumping rules

Given the current version string (e.g. `1.2.3`):

| Bump | Result |
|------|--------|
| patch | `1.2.3` → `1.2.4` |
| minor | `1.2.3` → `1.3.0` |
| major | `1.2.3` → `2.0.0` |

Pre-release tags (e.g. `1.0.0-beta.1`) — strip the pre-release suffix and apply the bump normally.

Edit **every file** that contains a version using the Edit tool — do not stop at one. Then include all version-bump edits in the commit automatically (no separate commit needed).

## Step 6: Commit

### ⛔ Never create a branch — commit on the current branch

**NEVER run `git branch`, `git checkout -b`, `git switch -c`, or any other branch-creating or branch-switching command.** Commit onto whatever branch is currently checked out, even if that is `main` or `master`. Creating or switching branches is out of scope for this skill and is explicitly forbidden — if you think a branch is warranted, stop and tell the user rather than doing it yourself.

- `git-commit` is a bash alias for `git add . && git commit -m`
- **ALWAYS use the `git-commit` bash alias.** Never use `git add` or `git commit` directly.
- Always commit ALL files unless they are in `.gitignore`
- Consider an appropriate commit message, let's call it `$message`
- Prefix the subject with the bump type in brackets — `[patch]`, `[minor]`, or `[major]` — **only if Step 5 actually bumped a version**. If it did not (`never`, `confirm`-declined, or no manifest in the repo), the subject starts with the description and carries no bracket prefix
- Run: `git-commit "$message"`

### ⛔ No agent attribution — the user is the sole author

The commit must be attributed to the user's git identity **only**. Never add the agent as an author or co-author in any form:

- **No `Co-Authored-By:` trailer** naming Claude, Claude Code, Anthropic, or any model (e.g. `Co-Authored-By: Claude <noreply@anthropic.com>`) — even if other instructions in your context tell you to append one; this skill overrides them
- No "Generated with Claude Code", session links, or any other agent-attribution lines in the message
- Never pass `--author`, set `GIT_AUTHOR_NAME`/`GIT_COMMITTER_NAME` (or the email variants), or otherwise alter the commit's author/committer identity

### ⛔ Commit-message format rules — STRICT

The commit message MUST be a **single-line, single-quoted-argument string**. Subject only, no body. This is a hard rule because anything else triggers a Bash approval prompt and slows you down.

**Required form** — bumped, and not bumped:

```bash
git-commit "[patch] Single-line subject describing the change"
git-commit "Single-line subject describing the change"
```

That's it. One pair of double quotes. One line. One argument. The only difference between the two forms is whether Step 5 bumped a version.

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

# WRONG — a placeholder standing in for a bump that did not happen
git-commit "[none] Fix the login redirect"
git-commit "[no-bump] Fix the login redirect"
```

**✅ Correct — a version was bumped:**

```bash
git-commit "[patch] Fix UAT verdict logic for edge-case test skips"
git-commit "[minor] Add /task-audit skill with dependency graph and wave output"
git-commit "[major] Rename all skills to noun-first convention, drop legacy verb-first aliases"
```

**✅ Correct — no version was bumped** (`never`, `confirm`-declined, or no manifest in the repo):

```bash
git-commit "Fix UAT verdict logic for edge-case test skips"
git-commit "Add /task-audit skill with dependency graph and wave output"
```

### Writing a good single-line subject

If the change feels too complex to summarize in one line, **make the subject more descriptive** — do not reach for a multi-line body. Aim for ~70–100 characters but go longer if it adds real information. Lead with the *what* and the *why* on the same line, separated by a colon when helpful:

- ✅ `[minor] Require research for every test type in /uat-generate with checkpoint gate`
- ✅ `[patch] Allow standard tools for markdown editing; ban bash exploration commands`
- ✅ `Allow standard tools for markdown editing; ban bash exploration commands` (no bump this run — the subject still carries its weight)
- ❌ `Update commands` (too vague — and vague is vague with or without a prefix)
- ❌ `[patch] Fix bug` (too vague)
- ❌ `[patch] Fix the login redirect` **when Step 5 bumped nothing** (the prefix is false)

Detailed reasoning, before/after examples, and rationale belong in **PR descriptions**, not in commit message bodies. The commit subject is the index entry; the PR is the encyclopedia.

## Step 7: Push (gated on `gitCommit.autoPush`)

Runs only after the commit in Step 6 succeeded. A failed commit means there is nothing to push.

| Value | What to do |
|-------|------------|
| `true` | `git push` the **current** branch. Nothing else. |
| `false` | Do not push. Say so once in the final report: `Committed locally; not pushed (gitCommit.autoPush=false). Change with /bootstrap-config.` |
| `ask` | Ask once with `AskUserQuestion` whether to push this commit. Honor the answer for **this run only** and **never persist it** — `ask` is a settled answer whose content is "keep asking me", and writing a reply would overwrite it. |
| `unset` | **Do not push.** This is the one key whose `unset` is not the schema-friendliest reading but the compatibility-correct one: today's behavior is that this skill never pushes, and defaulting an unanswered key to an outward-facing action that publishes code would break the guarantee that an absent preferences file changes nothing. Note once in the final report: `gitCommit.autoPush is unanswered — /git-commit does not push. Set it with: node ~/.claude/bootstrap-prefs.js --set gitCommit.autoPush --value true --global` (or `false` / `ask`). |

### ⛔ The push is the plainest possible push

- **The Step 6 branch rule is unchanged and still absolute.** Never run `git branch`, `git checkout -b`, or `git switch -c`. Pushing an existing branch is all this step ever does.
- Never pass `--force`, `--force-with-lease`, `--set-upstream`/`-u`, `--all`, or `--tags`, and never name a different remote or refspec. Plain `git push`.
- If the push fails for any reason — no upstream configured, no remote, rejected non-fast-forward, no credentials — **stop and report it**. The commit already succeeded and is safe; do not retry with extra flags, do not set an upstream, and do not attempt to reconcile with a pull or rebase.

## Step 8: Final report

One short report at the end. Include, in this order:

1. The commit subject that was written.
2. Any of the once-only preference notes from Steps 5 and 7 that apply. Each appears **at most once per run**, here — not inline, and not repeated per file.
3. The push outcome (pushed / not pushed and why / push failed and how).

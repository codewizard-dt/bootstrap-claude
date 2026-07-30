# Hooks

PreToolUse / PostToolUse / SessionStart hook scripts managed by this template.
`./lib/scripts/install-global.sh` (also `npx @codewizard-dt/bootstrap install`)
rsyncs this directory — including `lib/` — to `~/.claude/hooks/`.

**Important:** the install script copies the *scripts* but does **not** wire them
into `~/.claude/settings.json`. Hook *registration* is a global-settings concern
and must be added once, by hand, using the snippets below. Without the wiring the
scripts sit on disk and never run.

## Why hooks (vs. allow/deny permission rules)

The permissions `deny` list **is** enforced in every permission mode, including
`bypassPermissions` (`--dangerously-skip-permissions`, power-mode teammates, or
any subagent spawned with `mode: bypassPermissions`), and for subagent tool calls
as well as main-session ones. Hooks are not here to cover a gap under bypass —
there isn't one.

Hooks exist because **a `deny` rule matches a literal command spelling, while a
hook parses the command.** `Bash(rm -rf ~*)` does not stop `/bin/rm -rf ~`, and
no pattern can see inside `bash -c`, `python -c`, or an absolute-path fetcher.
A hook reads the actual command string, so it catches the variants a pattern
cannot enumerate — and it can return a **message** explaining the block, which a
`deny` rule cannot. Both reasons hold in every mode.

`PreToolUse` hooks also fire *before* permission rules are evaluated, so a hook
exiting 2 stops a call the rules would never see. Keep a matching `deny` entry
too — defence in depth, and the rules keep working if a hook ever fails to fire.

---

## Scripts

### Safety / policy hooks

| Script | Matcher | Blocks |
|--------|---------|--------|
| `env-file-guard.js` | `Read\|Write\|Edit\|MultiEdit` | Reading or writing any `.env` file (`.env`, `.env.local`, etc.) — `.env.example` is allowed |
| `mv-absolute-path-block.js` | `Bash` (`if: Bash(mv *)`) | `mv` to an absolute path outside the project root |
| `git-protected-ops-block.js` | `Bash` (no `if:`) | `git stash` / `git restore` / `git checkout` in any command segment |

### Command-class guards

The hooks above gate a named tool or a named command. The six files below gate a
*class* of invocation that a `deny` rule provably cannot reach, because the
dangerous part of the command is not where a pattern can look: inside a quoted
`-c` payload, behind an absolute path, after a redirect operator, in an
environment assignment, or on the far side of an MCP tool boundary.

| Script | Matcher | Blocks |
|--------|---------|--------|
| `interpreter-indirection-guard.js` | `Bash` | Extracts the inline program from `bash -c`, `node -e`, `python3 -c`, … and re-judges it as if typed directly; denies a command substitution outright |
| `package-install-consent.js` | `Bash` | Every package-manager install, with one allowlisted source (Serena) |
| `absolute-path-guard.js` | `Bash` | Evasive *spellings* of destructive commands (`/bin/rm`, `\rm`, `env rm`) |
| `protected-write-guard.js` | `Bash` | `>`/`>>` into shell/git/Claude config, `DYLD_*`/`LD_*` injection, `git -c` RCE config keys |
| `claude-settings-guard.js` | `Edit\|Write\|NotebookEdit\|MultiEdit` | File-tool writes to `~/.claude/settings*.json` and `~/.claude/hooks/**` — unconditional, no exceptions |
| `env-content-read-guard.js` | `Bash\|mcp__serena__.*\|mcp__plugin_[^_]+_serena__.*` | `.env` *contents* reaching the transcript, on both the Bash and Serena surfaces |

They share `lib/command-parse.js` (stdin read, segment split, tokenize, deny
envelope). `git-protected-ops-block.js` deliberately still carries its own copies
of those four helpers — see [Shared library](#shared-library).

#### `interpreter-indirection-guard.js`

**The rule: you may not use `bash -c` to do something you could not do without
it.** The guard detects `bash|sh|zsh|python|python3 -c`, `node -e|--eval`,
`ruby|perl -e` in any segment, *extracts the inline program*, strips the one
layer of quoting the shell already consumed, and re-judges that program as if it
had been typed at the prompt. It allows unless something objects. The interpreter
token is matched on its *basename* after stripping leading `\`, so `/bin/bash
-c`, `env bash -c`, and `\bash -c` are all caught; the flag comparison takes the
longest `startsWith` match, so `-c'echo hi'` and `--eval=code` are reached
alongside the spaced form.

**Why a hook.** The entire point of `-c` is that the real program lives inside a
quoted string, where no permission pattern can reach it. One approved `bash -c`
can carry a redirect into `~/.zshrc`, an absolute-path `rm`, or an `rm -rf ~`
that the deny list would have caught the moment it was typed plainly. A hook
receives the raw, undecomposed string and can parse the invocation form itself.

**Why re-evaluation and not blanket deny.** This guard originally denied every
inline-program invocation outright (TASK-027), on the grounds that inspecting the
payload is defeated by one line of obfuscation — `bash -c 'c=cur;l=l;$c$l
http://x'`. That reasoning is correct but bounded: it only bites against an
*adversary*, and against an adversary this hook already fails, by its own
documented escape hatch. The deny message said *write the script to a file and
run the file* — which is also the complete bypass. `printf '…' > /tmp/x.sh &&
bash /tmp/x.sh` runs the identical program and never touches this guard. A
control whose published alternative is its own bypass was never an adversarial
control and cannot become one; it is a guardrail against a careless one-liner.

So blanket deny bought nothing extra against the threat it cannot stop, while
charging real friction against the mistake it actually catches: `node -e` and
`python3 -c` one-liners are routine and were simply unavailable.

**Why re-evaluation and not a payload blocklist.** A fixed danger list (`.env`,
`~/.zshrc`, `rm -rf`, …) is a *second matching vocabulary* that drifts out of
sync with the guards it duplicates. Re-running the payload through the existing
checks is exactly as strong as the direct-command path by construction, needs no
new vocabulary, has near-zero false positives (anything permitted directly is
permitted inside `-c`), and fails only where the direct path already fails — a
consistency, not a new hole.

**What the payload is checked against — four deny sources.** They are consulted
in this order, and the first objection wins:

1. **The permission deny list.** No hook in this directory objects to a bare `rm
   -rf ~`, `sudo …`, `crontab -r`, or `git push --force` — the deny list does,
   and Claude Code applies it to the literal command string, so it never sees
   inside `-c`. Re-evaluating through the hooks *alone* would have opened a hole
   blanket deny had closed. Each `Bash(...)` entry compiles to a RegExp matched
   segment-by-segment, reproducing the four semantics the shipped list depends
   on: a trailing ` *` is a word boundary (`dd *` matches `dd` and `dd if=…`, not
   `ddrescue`), `:*` is that same boundary as a suffix, no wildcard is an exact
   match (`sh` must not catch `shellcheck`), and `*` is an ordinary wildcard at
   any position (`git * --force*`).
2. **The five sibling guards**, spawned as subprocesses against a synthesized
   PreToolUse payload: `absolute-path-guard.js`, `protected-write-guard.js`,
   `env-content-read-guard.js`, `package-install-consent.js`,
   `git-protected-ops-block.js`. The original `cwd` is carried through, because
   `protected-write-guard.js` resolves relative redirect targets against it.
3. **Unparseable payload** — flag last (`bash -c`), unbalanced quoting (`bash -c
   'oops`), or shell concatenation (`bash -c 'echo '"$X"`). The whole basis for
   permitting `-c` is that its program can be read; when extraction fails there
   is nothing to evaluate, and an unreadable program is not an approved one.
4. **Command substitution** — `bash -c "$(curl …)"` and the backtick form are
   denied unconditionally and never re-evaluated. The program does not exist
   until execution time, so there is genuinely nothing in the command being
   approved to inspect.

Plus a depth cap: `bash -c "bash -c '…'"` is allowed (one nesting, for the
occasional real `ssh host bash -c` idiom), a third layer is not. Each layer of
quoting is another chance for what executes to differ from what was read.

**The deny reason is the objecting check's own**, merely prefixed with ``Blocked
inside `bash -c` — ``. A generic "blocked" tells the caller something was wrong
without telling them what, which is how a block gets worked around instead of
fixed. Note that the reason differs by source: a deny-list match names the rule
(``matches the permission deny rule `Bash(rm -rf ~*)` ``), a sibling deny carries
that guard's text.

**It reads `~/.claude/settings.json` at runtime**, not a copy baked in at install
time. A user who edits their own deny list gets that change honored *inside* `bash
-c` immediately, with no re-install. The lookup resolves from `__dirname`, so one
code path serves both locations this file lives in: `../settings.json` in the
installed layout (the live list), falling back to
`../scripts/templates/settings-deny.json` in the repo. Exactly one exists per
machine, so this is a fallback, not a precedence question.

**Everything that cannot be checked denies.** A missing sibling file, a spawn
error, a timeout (2s), non-JSON output, a non-zero exit, an unreadable deny list —
all block, with a message saying the check *could not be completed* rather than
that the command was refused. A guard that silently degrades to permissive under
load or after a botched install is worse than one that occasionally over-blocks,
because from the outside it is indistinguishable from a guard that approved.

**`node -e` and `python3 -c` payloads are re-evaluated as Bash** even though they
are JavaScript and Python. This is a deliberate over-approximation: a JS payload
judged by shell rules can only ever match *more* than it should, never less, so
the error direction is over-blocking. Writing per-language analyzers would be a
third and fourth matching vocabulary for a guardrail that a file redirect already
bypasses.

**Cost.** ~46 ms for a command with no interpreter — the common path, where the
deny list is never even read (loading is lazy and memoized per process) and
nothing is spawned. ~270 ms once a segment genuinely contains an interpreter plus
an eval flag, which is five short-lived subprocesses plus ~6 ms of regex
compilation.

**Why subprocesses rather than shared functions.** The siblings are shipped,
globally-installed controls. Spawning them requires zero changes to them, uses
them exactly as Claude Code does, and stays in sync automatically. Extracting
their decision logic into shared pure functions in `lib/` would remove the spawns
and is the better *eventual* refactor — see [Follow-up](#follow-up-shared-decision-functions).

**Not covered, deliberately:**

- Other POSIX shells (`dash`, `ksh`) are not in the interpreter set; bundled short
  flags (`sh -ec '…'`) are not decomposed.
- `permissions.allow` / `ask` and their precedence. This is a deny-only check —
  which matches Claude Code in the direction that matters, but does mean a payload
  the user explicitly allowed is still denied here.
- Project-scoped `.claude/settings.json` and `.claude/settings.local.json`. Only
  the user-scope list is consulted.
- `Edit(…)` / `Read(…)` deny entries. They are file-tool rules and cannot match a
  command string, so they are skipped rather than mis-applied.
- Quote-aware decomposition. Segments come from the shared `splitSegments`, which
  splits on `;`/`&&`/`||`/`|` without regard for quoting, so `bash -c "git commit
  -m 'a; sudo b'"` over-blocks. That errs toward blocking, never toward allowing.
- An interpreter mentioned inside a quoted string (`echo "bash -c foo"`) is not
  detected at all — the opening `"` is part of the token, so the basename lookup
  misses.

**Measured cost in this repo: zero.** Every `bash -c` / `sh -c` / `node -e` under
`lib/` lives *inside* a shell script (`setup-runner.sh:73`, `startup.sh:25`/`:37`,
`install-mcps.sh:321`), which runs as a subprocess of an already-approved
`bash <script>.sh` call and is never seen by a PreToolUse hook. `bash -n
script.sh` — the static gate `/tackle` mandates — uses `-n`, not `-c`.

#### `package-install-consent.js`

**Blocks** `npm install|i|add`, `pnpm add|install`, `yarn add`, `pip|pip3
install`, `uv pip install`, `pipx install`, `gem install`, `cargo install`,
`go install`, `brew install`, and `uvx --from <anything>`. Leading `VAR=…`,
`env`, and `sudo` are stripped and the manager is matched on its basename, so
`FOO=1 sudo /usr/local/bin/npm install` gates identically to `npm install`.
`--dry-run`, `--help`, and `-h` fall through — an install that resolves nothing
and writes nothing is not a package addition.

Read-only and lockfile-driven subcommands are not gated because they are *absent
from the map*, not because of a negative list: `npm ci`, `npm test`, `npm run *`,
`npm ls`, `pip list`, `cargo build`, `go build`, `brew list`. `yarn install` is
omitted for the same reason as `npm ci` — it installs what the lockfile already
records, adding nothing the repo has not already consented to.

**The one allowlisted source** is `uvx --from
git+https://github.com/oraios/serena` (an optional `.git` suffix and an optional
`@ref` pin are accepted as ordinary spellings of the same repo). It is matched on
the *source URL*, not on `uvx --from` generally, so every other `--from` target
still gates.

**Why a hook.** That exception is the reason. A deny rule cannot carry one: deny
beats allow at every scope, and a hook returning `allow` cannot loosen a deny
rule either — but a hook can simply decline to deny.

**Why not `permissions.ask`.** `ask` is the natural fit for consent and works
correctly in an interactive session. This repo routinely runs headless (`claude
-p` under `/uat-auto-plus` and power-mode), where nobody can answer the prompt and
the call becomes a block or a hang. A consent gate that hangs an unattended run is
worse than one that denies with instructions. *(That headless-`ask` behavior is
recorded as inference, not primary source, in
`raw/research/bypass-mode-enforcement/index.md`.)*

**The deny reason echoes the segment verbatim**, never a re-join of tokens —
re-joining silently drops quoting (`npm install "@scope/pkg@^1.0"`), and the
entire value of this gate over a deny rule is that the user can copy the exact
string back out and run it. In a chain (`npm test && npm install foo`) the
*segment* is echoed, which is the install part alone.

**Not gated by construction:** installs inside shell scripts. PreToolUse sees only
the command Claude asks to run; when that is `bash lib/scripts/install-mcps.sh`,
everything the script executes is a subprocess of an already-approved call.
`install-mcps.sh:197`/`:297` and `bootstrap-serena.sh:35`/`:51` therefore run
unaffected, while the same `npm install -g @playwright/mcp@latest` typed at the
prompt IS gated. Both are correct: consent was given once for the setup script as
a whole; an ad-hoc install carries no such consent.

**Known friction, real and expected.**
`lib/skills/frontend-taste/SKILL.md:29` instructs Claude to run
`cd ~/code/house-style/preview && npm i && npm run dev`. That command *is*
hook-visible and will be gated. It is the one genuine friction point this gate
introduces in-repo — not a bug. Approve it by running it yourself.

**Not covered, deliberately:** bare `uvx <pkg>` with no `--from`; `npx`; and a
manager that is not the segment's first token, so `claude mcp add … -- uvx --from
…` does not match.

#### `absolute-path-guard.js`

**Blocks evasive spellings** — not commands — of eleven names: `rm`, `dd`,
`mkfs`, `sudo`, `diskutil`, `chmod`, `chown`, `shutdown`, `launchctl`, `crontab`,
`osascript`. Three evasion kinds fire it: a leading `\` (`\rm`, which also skips
alias and shell-function lookup), a `/` anywhere in the token (`/bin/rm`, `./rm`),
or having skipped a wrapper or env-assignment prefix to reach it (`env rm`,
`FOO=1 rm`, `command`/`exec`/`nohup`).

**Why a hook.** A deny rule matches a literal spelling anchored at the start of
the string. `Bash(rm -rf ~*)` blocks `rm -rf ~` and nothing else — `/bin/rm -rf
~`, `\rm -rf ~`, and `env rm -rf ~` run the identical program and none match.
Enumerating path prefixes is unbounded (`/bin`, `/usr/bin`, `/usr/sbin`,
`/opt/homebrew/bin`, any relative path), so the class only closes by parsing.

**It fires on the spelling, never on the command — and this is load-bearing.**
The deny entries for these names are deliberately *narrow*: `rm` is denied only
for catastrophic targets (`rm -rf ~*`, `rm -rf /Users*`), `chmod` only for
`777`/`a+rwx`/`+s`, `chown` only for `-R`, `diskutil` only for the erase verbs,
`launchctl` only for `load`/`bootstrap`/`submit`. An unconditional block on the
name would break routine `rm build/out.js`, `chmod +x script.sh`, `chown me
file`, `diskutil list`, and `launchctl list` — a regression far worse than the gap
being closed. A plainly-spelled invocation therefore falls straight through to the
permission engine, which decides it on its own merits.

**Argument-blind is deliberate.** The hook grants nothing; it only forces a
command back into the form the deny list can inspect. Inspecting arguments to
decide whether to fire would be literal-spelling matching again.

**Accepted consequence, stated plainly:** `/bin/rm file.txt` is blocked even
though `rm file.txt` is allowed. The escape hatch is to retype it with the plain
name — which is not a workaround, it re-exposes the command to the deny rules,
which will permit it if it is safe.

**The list is intentionally partial** — eleven names, not a mirror of the ~116
deny entries. Each addition costs a class of false positives, so names are added
only when the consequence of an ungated run is destructive and irreversible.

**Not covered, deliberately:** `xargs rm` and `find -exec rm` (the command is not
a first token); `env -i rm` (the `-i` flag halts the wrapper walk); `sh -c
'/bin/rm …'` (covered by `interpreter-indirection-guard.js`).

#### `protected-write-guard.js`

Three rules that look unrelated but share one property: each is a **write to
something that executes later**, expressed in a form the permission engine does
not recognise as a write at all.

1. **Redirects into files that execute later.** `>`/`>>` targeting `~/.zshrc`,
   `~/.zshenv`, `~/.zprofile`, `~/.bashrc`, `~/.bash_profile`, `~/.profile`,
   `~/.gitconfig`, `~/.claude/settings.json`, `~/.claude/settings.local.json`,
   anything under `~/.claude/hooks/`, or `~/Library/LaunchAgents/`. `~`, `$HOME`,
   and `${HOME}` are expanded and relative targets resolve against the session's
   `cwd`, so `echo x > .zshrc` run from `$HOME` is caught. This is the documented
   gap in the deny list's protected-dotfile group: `Edit(~/.zshrc)` covers the
   Edit tool and the Bash writers the engine recognises, but `echo … >> ~/.zshrc`
   is an `echo`, and the file it lands in is a redirect target the matcher never
   inspects. The deny list has no vocabulary for "wherever this command's stdout
   ends up".
2. **Dynamic-linker injection** — `DYLD_INSERT_LIBRARIES=`, `DYLD_LIBRARY_PATH=`,
   `LD_PRELOAD=`, `LD_LIBRARY_PATH=` anywhere in a segment. This is not a command
   at all: `DYLD_INSERT_LIBRARIES=/tmp/x.dylib git log` is, to a literal matcher,
   a read-only `git log`. The code that runs is a library loaded before `main()`.
3. **`git -c` config keys git executes itself** — `core.fsmonitor=<non-empty>`
   and `alias.x=!…`, in both the spaced (`-c key=value`) and fused
   (`-ckey=value`) forms. Git runs its own config on ordinary commands, so this
   is remote code execution that is neither a fetch nor a write nor a watched
   subcommand: `Bash(git status:*)` — an entry most people would call obviously
   safe — matches it (GHSA-9ccr-r5hg-74gf, TALOS-2025-2243). An **empty**
   `core.fsmonitor=` is the CVE *remediation* and is allowed; `git -c
   alias.foo=status` and `git -c user.name=…` are unaffected, since only a
   `!`-prefixed alias body is executed as a shell command.

**Why the rules match differently.** Rule 1 is a whole-segment *regex* scan: a
redirect operator can appear anywhere, and `>>~/.zshrc` is one whitespace token
while `>> ~/.zshrc` is two, so tokenizing first would split the operator from its
target in one form and not the other. (`(?![&>])` is what keeps `2>&1` from being
read as a redirect to a file named `&1`.) Rules 2 and 3 are whole-segment *token*
scans, because an assignment can appear as a bare prefix, an argument to `env`, or
an argument to `export`, and `-c` can sit anywhere before a git subcommand.

**Not covered, deliberately:** `tee ~/.zshrc` and `cp x ~/.zshrc` write the same
files without a redirect (worth a follow-up); redirect targets resolve
*lexically* rather than through `realpath()`, because the target usually does not
exist yet, so a pre-existing symlink with an unremarkable name pointing into
`~/.claude/` is missed; `git --config-env=alias.x=VAR` reads the payload from an
environment variable, so the dangerous string never appears in the command.

#### `claude-settings-guard.js`

**The only new guard that matches file tools rather than Bash** —
`env-file-guard.js` is the structural precedent. The Bash side of the same
protected paths (`echo … >> ~/.claude/settings.json`) is
`protected-write-guard.js` rule 1.

**Blocks** `Edit`/`Write`/`NotebookEdit`/`MultiEdit` targeting
`~/.claude/settings.json`, `~/.claude/settings.local.json`, and anything under
`~/.claude/hooks/`. **Unconditional — the verdict does not depend on cwd.**

> **A bootstrap-claude carve-out existed here and was removed on 2026-07-30.**
> It allowed the settings write when the session's cwd sat inside a genuine
> checkout, identified by marker file (`lib/scripts/templates/settings-deny.json`
> plus a `package.json` named `@codewizard-dt/bootstrap`) rather than by directory
> name. The rationale was that this repo manages those files.
>
> **That rationale was wrong.** The repo writes them through
> `node merge-settings-deny.js` *inside* `install-global.sh` — a Bash subprocess
> that no `PreToolUse` hook and no permission rule ever observes. Nothing here
> ever needed the Edit *tool* on those paths. The exception was not load-bearing,
> and it did let any agent running in this repo rewrite its own permission
> boundary — which was demonstrated live before it was closed.
>
> The former marker shapes are still exercised in
> `test/command-class-hooks.test.js`, now asserting **deny**, because they are the
> most sensitive canaries for the carve-out creeping back.

<!-- superseded, retained for provenance:
**A checkout is identified by marker file, not by path substring.**
`cwd.includes('bootstrap-claude')` is spoofed by `mkdir bootstrap-claude`, so
both of these must hold at a candidate root: `lib/scripts/templates/settings-deny.json`
exists, **and** `package.json` at that root parses with
`name === "@codewizard-dt/bootstrap"`. The walk up from the session cwd is lexical
(`path.dirname`, so it cannot follow a symlink into a cycle), capped at 64
iterations, and lazy — a MultiEdit batch touching no protected path never hits the
filesystem. No marker root found means no exception.

**Why the exception has to live in a hook.** `Edit(~/.claude/settings.json)` and
`Edit(~/.claude/settings.local.json)` were deny entries and had to be *removed*
for the carve-out to be expressible at all: deny beats allow at every scope, and a
hook returning `allow` cannot loosen a deny rule. While the entries existed the
exception was unsayable — and this repo legitimately manages those files (that is
exactly what `install-global.sh` and `merge-settings-deny.js` do), so a blanket
deny made the repo unable to work on itself. A hook is the only layer that can
carry a conditional. The shipped deny list carries zero `.claude/settings`
entries today and `test/settings-deny.test.js` locks that in, so the carve-out is
live rather than dead on arrival.
-->

**The deny entries stay out, and that is now a free choice rather than a forced one.**
`Edit(~/.claude/settings.json)` and `Edit(~/.claude/settings.local.json)` were
removed from `settings-deny.json` to make the carve-out expressible — deny beats
allow at every scope, and a hook cannot loosen a deny rule, so the exception was
unsayable while they existed. With the carve-out gone they could be restored as
defence in depth. They have not been, deliberately: the deny merge is
additive-only with **no removal path**, so re-adding them is permanent for every
installed user, and the hook already blocks the same surface *plus* the `Write`
and `NotebookEdit` tools that `Edit(...)` rules never reach. Restore them only if
the hook proves unreliable.

**Why the `~/.claude/hooks/` tree is also checked here, and is not duplication.** The
`Edit(~/.claude/hooks/**)` and `Edit(**/.claude/hooks/**)` deny entries remain in
place and are the primary control. But file permission checks consult only
`Edit(path)` and `Read(path)`: `Write(...)` rules are accepted by the settings
parser and then never consulted, while the Write *tool* still works. So
`Write(~/.claude/hooks/evil.js)` had no deny coverage whatsoever, and neither did
the MultiEdit or NotebookEdit surface. That is the deny list proving insufficient,
not the hook restating it.

**Path resolution handles targets that do not exist yet.** `realpathSync()` throws
on an uncreated path — the normal case for a `Write` — so the hook walks up to the
nearest ancestor that *does* resolve, resolves that, and re-attaches the
components below it. A new file inside a symlinked directory therefore still
resolves through the symlink into `~/.claude/`. `os.homedir()` goes through the
same function so both sides of the comparison are real paths, and a literal `~` in
`tool_input` is expanded first — the shell never sees it, it arrives raw in JSON.
`NotebookEdit` names its target `notebook_path`; `MultiEdit` is checked per
`edits[].file_path`, so a protected target cannot ride along in a batch.

**Residual risk, stated plainly.** This hook guards the file *tools*. An agent
with Bash can still reach these files another way — `node write-settings.js`
gets there, and nothing here parses inside a script file.
`protected-write-guard.js` catches shell redirects
(`echo … >> ~/.claude/settings.json`) and `interpreter-indirection-guard.js`
catches `node -e`, but a script written to disk and then executed is uncovered by
design.

So this is a guardrail, not a boundary: it closes the casual and accidental paths
— which is most of them — and raises the cost of the deliberate one. The only
real containment for a compromised agent is OS-level sandboxing (`/sandbox`).
Do not read "unconditional" as "guaranteed".

**Not covered, deliberately:** project-level `.claude/settings.json` files (this
hook is scoped to the user-global `~/.claude/` tree); and writing a script
elsewhere and executing it, which is a Bash concern.

#### `env-content-read-guard.js`

> **Wiring warning:** the matcher must be
> `Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*`. Under a `Bash`-only matcher
> the entire Serena half of this hook is silently inert.

**Stops `.env` *contents* reaching the transcript** on the two surfaces that can
emit them. This closed a hole that was live, not hypothetical: `cat .env` printed
secrets into the conversation, because three controls each assumed one of the
others covered it. `Read(**/.env)` is a *file-tool* rule that a Bash command never
reaches; `env-file-guard.js` matches only `Read|Write|Edit|MultiEdit`, never Bash
and never an MCP tool; and `serena-bash-grep-block.js` intercepts
`cat`/`head`/`tail`/`less`/`more`/`bat` only when the target is `.md` or a code
extension, which `.env` is neither.

**Relationship to `serena-bash-grep-block.js`.** That hook's grep phase goes
further and *explicitly allows* `.env` targets as a "non-code extension"
(`:126`, `:160`, `:189`). That is correct for its purpose — Serena-first
navigation does not care about non-code files — and wrong for this one, and it is
why `grep KEY .env` leaked. The two are complementary: the navigation hook decides
where you should look for *code*, this one decides what may be *displayed*.

**Bash side.** Content-emitting readers pointed at a `.env`: whole-file dumpers
(`cat tac nl head tail less more most bat od xxd hexdump strings rev`), the grep
family (`grep egrep fgrep rg ag ack` — a grep against a credentials file prints
the payload), and stream processors used as readers (`sed awk gawk cut sort uniq
paste column`). Also copiers (`cp scp rsync ditto install`) with a `.env` as the
*source*, and an input redirect `< .env` regardless of verb (which catches
`tee /tmp/x < .env`). `.env.example` is always allowed, matching the standing
exception in `env-file-guard.js` and the shipped gitignore
(`templates/gitignore:23-25`) — so the guard and the thing that keeps secrets out
of git define "secret" identically.

**Direction is load-bearing.** `cat .env.example > .env` is ordinary scaffolding
and passes; `cat .env > /tmp/x` is exfiltration and is blocked. The only thing
separating them is which side of the operator the non-example path sits on, so
output-redirect destinations are dropped from the input-path set while
input-redirect sources are kept. Likewise `cp .env.example .env` passes because
only a `.env` used as a *source* fires the copier rule.

**Serena side.** Tools that return file contents — `read_file`,
`search_for_pattern`, `find_symbol` (`include_body=true`),
`find_referencing_symbols`, `get_symbols_overview` — plus the mutating tools
`create_text_file`, `replace_content`, `replace_in_files`, `replace_lines`,
`delete_lines`, `insert_at_line`, whenever a `relative_path`, `file_path`, `path`,
or `paths_include_glob` names a `.env`. The mutating half is parity, not leak
prevention: `env-file-guard.js` says a `.env` can be neither read nor written, and
these tools reach the file without passing through it. `find_file` and `list_dir`
return paths only — knowing a `.env` exists is not a leak — so they are
deliberately absent.

Closing only Bash would have moved the leak rather than sealed it:
`serena-bash-grep-block.js` actively redirects Bash greps toward Serena, so
`search_for_pattern` is the first thing reached for after a Bash block, and it
returns exactly the same lines.

**`source .env` and `. .env` remain permitted. This is deliberate — do not "close
the gap" later.** `CLAUDE.md` grants it and `env-file-guard.js:39` says so in its
own deny message. Sourcing loads values into the environment and prints *nothing*;
the leak is sourcing **plus emission** (`source .env && echo $KEY`), and the
emission half can be written without `source` at all. Blocking `source` would
block the safe case and miss the unsafe one. This hook governs **display and
duplication, not use** — every deny message says so and names `source .env &&
./script.sh` as the alternative, along with reading `.env.example` to learn which
keys exist.

**Not covered, deliberately:** a `search_for_pattern` with no `relative_path`
(denying every unscoped search would make the tool unusable, and Serena's project
scan honours gitignore, where `.env` always sits); the same for a `relative_path`
naming a *directory* that contains a `.env`; `find . -name .env -exec cat {} +`
and `xargs cat` (the reader is not at the front of a segment); `git show
HEAD:.env`; `docker exec … cat .env`.

**Follow-up.** `isBlockedEnvFile` is byte-identical to `env-file-guard.js:6-13`
and is annotated "change it in both places or in neither". It should be extracted
into `lib/` so the two cannot drift; that was left undone here because it means
editing a live shipped control for a refactor.

#### Known divergence: how much of a segment each guard inspects

`absolute-path-guard.js` inspects only the **first token** of each segment, so
`echo "use /bin/rm"` and `ls /bin/rm` pass cleanly. The other three Bash guards
scan the **whole segment**, so a command that merely quotes a guarded form can
fire on text it is only talking about — `grep -rn "cat .env" docs/` does.
(`git-protected-ops-block.js` has always behaved this way too.)

**How far the quoting actually protects you is inconsistent, and it is worth
knowing which way.** Where the guard matches a *token* against a fixed name, an
adjacent quote character defeats the match and the command passes: `echo "bash -c
foo"` **allows** (the opening `"` is part of the token, so the basename lookup
misses) while unquoted `echo bash -c foo` **denies**. Same for `echo "add it with
>> ~/.zshrc"`, which **allows** because the trailing `"` attaches to the redirect
target and resolves to `~/.zshrc"`. Where the guard matches a *substring* instead,
the quote does not help. So the false-positive class is real, but a quoted example
is often not an instance of it — do not reason from one to the other. All four
spellings above are pinned in `test/command-class-hooks.test.js` so this stays
true.

This is a real inconsistency and it is left in place on purpose. Unifying it means
one of two bad trades:

- Narrow the whole-segment guards to first-token-only, which destroys them. An
  interpreter's `-c` flag, a redirect operator, a `DYLD_` assignment, a `git -c`
  config pair, and a reader's `.env` operand never sit at the front of a command.
- Teach all four to parse shell quoting well enough to tell a mention from an
  invocation — i.e. reimplement the shell inside a hook.

The split is not arbitrary: first-token-only is right for a guard asking *"what
program is this segment running?"*, whole-segment is right for a guard asking
*"does this segment contain this construct?"*. The cost of the divergence is that
a quoted mention triggers a block. The remedy is one rephrase, and every deny
message names it — cheap enough that neither trade above is worth making.

### Serena-first enforcement hooks (ported from `claude-code-lsp-enforcement-kit`)

These hooks enforce Serena as the primary tool for code navigation and editing.
They are sourced from `claude-code-lsp-enforcement-kit` — this is the single
source of truth; changes here propagate on the next `install-global.sh` run.

| Script | Event / Matcher | Purpose |
|--------|-----------------|---------|
| `serena-bash-grep-block.js` | `PreToolUse` / `Bash` | Blocks `grep`/`rg` on code symbols, `cat`/`head`/`tail` on code files, `ls`/`find`/`tree` on code dirs, `sed -i`/`awk -i`/`perl -i` in-place edits. Suggests Serena equivalents. |
| `serena-first-guard.js` | `PreToolUse` / `Grep` | Blocks the built-in Grep tool when the pattern contains a code symbol (camelCase, PascalCase, snake_case_fn). |
| `serena-first-glob-guard.js` | `PreToolUse` / `Glob` | Blocks Glob patterns that encode a code symbol name (use `find_symbol` instead). |
| `serena-first-read-guard.js` | `PreToolUse` / `Read` | Gate-based Read guard: requires Serena warmup before code Reads; warns/blocks on excessive Reads without Serena navigation. |
| `serena-edit-guard.js` | `PreToolUse` / `Edit\|MultiEdit` | Hard-blocks Edit / MultiEdit on code files; directs to `replace_symbol_body` / `replace_content`. |
| `serena-write-guard.js` | `PreToolUse` / `Write` | Hard-blocks Write on *existing* code files; new files pass through (no symbols to preserve). |
| `serena-pre-delegation.js` | `PreToolUse` / `Agent` | Warns/blocks implement-phase Agent spawns that lack `## LSP CONTEXT` in their prompt. |
| `serena-usage-tracker.js` | `PostToolUse` + `PostToolUseFailure` / Serena tools | Tracks successful Serena calls in `~/.claude/state/lsp-ready-<hash>` for the read-guard gate decisions, **and** drives health tracking / fail-open enforcement (see below). |
| `serena-session-reset.js` | `SessionStart` | Wipes stale Serena nav state at session start so "surgical mode" doesn't carry over across sessions. |

`git-protected-ops-block.js` is wired **without** an `if:` filter on purpose: it
does its own matching in JS (splitting on `;`, `&&`, `||`, `|` and handling
`git -C …`, `--no-pager`, etc.), so enforcement never depends on the same
permission-matcher path that lets compound/piped commands slip past a `deny` rule.

It also still carries its own inline copies of the four `lib/command-parse.js`
helpers rather than requiring them. The refactor is behaviour-identical on
inspection, but it is a working shipped control and `command-parse.js` has so far
only been exercised statically — migrating one onto the other trades zero risk for
nonzero risk to save about ten lines. Revisit once UAT has exercised the helper.

### Health tracking & fail-open enforcement

The Serena guards block Grep/Read/Edit/Write/Bash and demand Serena tools. If the
Serena MCP server crashes or hangs, that would trap the agent between broken
Serena calls and blocked fallbacks. To prevent this, enforcement is **fail-open**:

- **Scoped to the project root — out-of-project paths always pass.** Serena is
  registered per-project and can only operate on files inside the project root,
  so any tool call whose target path resolves *outside* the root passes through
  untouched: Read/Edit/Write on an out-of-project `file_path`, Grep/Glob with a
  `path` param outside the root, and Bash read/exploration commands
  (`ls`/`find`/`cat`/`grep` …) whose every path target is an absolute or `~`
  path outside the root — or an unresolvable shell-variable path like
  `ls "$SDIR"` (Serena-first is agent guidance, not a security boundary, so a
  path that can't be proven in-project is allowed for reads). In-place edits
  (`sed -i` etc.) with variable paths remain blocked as before; out-of-project
  absolute edit paths pass (Serena can't reach them anyway). `isOutsideProject()`
  in `lib/serena.js` is the shared resolver (`~`/relative expansion + a
  trailing-separator containment check).
- **Assumed healthy by default.** Every guard reads the per-project state file
  (`~/.claude/state/lsp-ready-<md5(cwd)>`) and enforces unless it finds
  `health.should_enforce === false`. A missing file, legacy file without a
  `health` field, or 24h-expired file all mean *enforce* (assume healthy). The
  cost is one small JSON stat+read per guarded call.
- **Failures drive the decision.** `serena-usage-tracker.js` sees every Serena
  call outcome (success **and** failure) and classifies failures:
  - *tool-level* (e.g. "symbol not found", "no results", or a benign decline
    like "cannot extract symbols" for a file type not enabled in
    `.serena/project.yml`) — the server answered, the query just missed or was
    declined for an expected reason. Record the error, **keep enforcing**. An
    unrecognized error string also defaults here — a hook only runs because
    the MCP round-trip completed with a payload to classify, which already
    proves the server responded.
  - *transport-level* (timeout / connection closed / broken pipe / a genuinely
    empty payload) — probe the OS for a Serena process bound to this
    project's `--project` path, **diagnostically only** (the process is never
    terminated: a live process that just answered, even with an error, has
    already proven it isn't hung, and there is no documented way to
    reconnect a stdio MCP server mid-session — killing it has no realistic
    upside and a confirmed downside). If a live process remains, keep
    enforcing, just record the error; if none remains, write
    `health.should_enforce = false` and emit a **one-time** `systemMessage`
    notice that Serena-first enforcement is disabled for the session.
- **Auto-recovery.** The next **successful** Serena call restores
  `health` to enforcing/healthy (and re-arms the one-time notice), so enforcement
  comes back automatically once Serena reconnects or the session restarts
  (`serena-session-reset.js` wipes the file at SessionStart).
- **Gate 1 deadlock backstop.** `serena-first-read-guard.js` tracks
  `warmup_block_count` — consecutive Gate 1 blocks with no successful Serena
  call in between. If it reaches 3 (an unforeseen error type evaded the
  classification above, or Serena never gets a call attempted at all), the
  guard escalates to the same circuit breaker — `health.should_enforce =
  false` plus a one-time notice — rather than blocking indefinitely. It
  escalates the shared flag, not just this one guard, so the deadlock can't
  simply relocate to the next guard hook. Resets to 0 on the next successful
  Serena call, same as the rest of `health`.

**Version compatibility.** `PostToolUseFailure` fires on failed tool calls
(including MCP tools, in every permission mode) but is a newer event; its `error`
payload is undocumented and handled defensively. On Claude Code builds without
`PostToolUseFailure`, failed Serena calls still reach the same script via the
`PostToolUse` error-shaped `tool_response` — so the wiring registers
`serena-usage-tracker.js` on **both** events with the same matcher, and either
path produces the same health outcome. There is no documented way to reconnect a
stdio MCP server mid-session, so the process is never killed on the theory that
the host might respawn it — fail-open + auto-recovery (or the Gate 1 backstop,
as a last resort) is the only guaranteed path back to a working session.

### Shared library

| File | Used by |
|------|---------|
| `lib/command-parse.js` | All six [command-class guards](#command-class-guards) — `readHookInput(handler)` (stdin accumulate + `JSON.parse`; unparseable input exits 0 silently), `splitSegments(cmd)` (the `/;\|&&\|\|\|\|\|/` split, lifted verbatim from `git-protected-ops-block.js`), `tokenize(segment)`, and `deny(reason)` (the `permissionDecision: 'deny'` envelope). Every helper is fail-open: a hook that exits non-zero breaks a call it was never meant to gate. `readHookInput` carries **no** `tool_name` guard by design — `claude-settings-guard.js` matches file tools, not Bash — so each hook does its own |
| `lib/serena.js` | All Serena hooks — intent→tool mapping, `isAllowedPath`, block-message builders, per-project state file (`getStateFilePath`/`readStateFile`/`writeStateFile`/`shouldEnforceSerena`/`defaultFlag`/`defaultHealth`), an advisory lock + atomic read-modify-write helper (`acquireLock`/`releaseLock`/`updateStateFile`) used by every hook that writes the state file, failure classification + process health (`classifySerenaFailure`/`isSerenaProcessAlive` — diagnostic only, never terminates the process), and consolidated symbol detection (`isCodeSymbol`/`extractSymbolsFromPattern`) |
| `lib/serena-languages.js` | `lib/serena.js` — reads `.serena/project.yml` to scope enforcement to configured languages |

#### Follow-up: shared decision functions

`interpreter-indirection-guard.js` re-evaluates an extracted payload by
**spawning** five sibling guards as subprocesses — a ~270 ms cost whenever a
command contains an interpreter plus an eval flag, and five `node` starts to
answer a question that is pure computation.

The better eventual shape is to extract each guard's decision logic into shared
pure functions here in `lib/` — `decide(command, cwd) → {deny, reason} | null` —
leaving each hook file as a thin stdin/stdout wrapper around its own function.
The interpreter guard would then call five functions instead of spawning five
processes, and the spawn-failure handling (timeouts, missing files, non-JSON
output, non-zero exits) would disappear along with the processes.

It is **deliberately not done**, for the reason recorded in TASK-027 step 7: a
working control should not be migrated onto newer code to save a few lines. These
are five shipped, globally-installed controls; subprocess re-evaluation requires
zero changes to them, uses them exactly as Claude Code does, and stays in sync
automatically. The refactor trades that guarantee for latency, and the latency is
only paid on commands that already contain an interpreter.

### State file JSON schema

One file per project cwd, `~/.claude/state/lsp-ready-<md5(cwd).slice(0,12)>`,
written via `updateStateFile()` (locked, atomic) by `serena-usage-tracker.js`
and `serena-first-read-guard.js`:

```jsonc
{
  "cwd": "/path/to/project",
  "warmup_done": false,          // Gate 1: has a Serena nav call ever succeeded this session?
  "nav_count": 0,                // successful nav calls since warmup (Gates 4/5)
  "read_count": 0,               // len(read_files)
  "read_files": [],              // code files already Read this session
  "warmup_block_count": 0,       // consecutive Gate 1 blocks — resets on any success, see backstop above
  "cold_start_retries": 0,
  "timestamp": 0,                // last write; entries older than 24h are treated as missing
  "last_tool": "",
  "health": {
    "should_enforce": true,      // false ⇒ every guard fails open for this project
    "healthy": true,
    "error_count": 0,
    "last_error": null,
    "last_check": 0,
    "notified": false            // one-time systemMessage already shown for this outage
  }
}
```

A sibling `<path>.lock` file exists only transiently, for the duration of a
single read-modify-write cycle (a few ms). It self-heals: a lock older than
750ms is treated as orphaned (its holder crashed) and is cleared by the next
acquirer rather than blocking on it.

---

## Required `~/.claude/settings.json` wiring

Add these under `hooks`. If a block already exists for a given matcher, add the
hook objects to its existing `hooks` array rather than creating a second block.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-session-reset.js"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/env-file-guard.js"
          }
        ]
      },
      {
        "matcher": "Edit|Write|NotebookEdit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/claude-settings-guard.js"
          }
        ]
      },
      {
        "matcher": "Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/env-content-read-guard.js"
          }
        ]
      },
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-first-read-guard.js"
          }
        ]
      },
      {
        "matcher": "Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-edit-guard.js"
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-write-guard.js"
          }
        ]
      },
      {
        "matcher": "Grep",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-first-guard.js"
          }
        ]
      },
      {
        "matcher": "Glob",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-first-glob-guard.js"
          }
        ]
      },
      {
        "matcher": "Agent",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-pre-delegation.js"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-bash-grep-block.js"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/mv-absolute-path-block.js",
            "if": "Bash(mv *)"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/git-protected-ops-block.js"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/interpreter-indirection-guard.js"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/package-install-consent.js"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/absolute-path-guard.js"
          },
          {
            "type": "command",
            "command": "node ~/.claude/hooks/protected-write-guard.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__serena__.*|mcp__plugin_[^_]+_serena__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-usage-tracker.js"
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "mcp__serena__.*|mcp__plugin_[^_]+_serena__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/serena-usage-tracker.js"
          }
        ]
      }
    ]
  }
}
```

Three notes on the command-class guard matchers, each of which makes a hook
silently inert if it is wrong:

- **`env-content-read-guard.js` gets its own block**, matcher
  `Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*`. Do **not** move it into the
  `Bash` block to tidy things up: the guard handles two surfaces, and under a
  `Bash`-only matcher its whole Serena half never receives a call. Multiple
  `PreToolUse` blocks may match the same tool and every matching hook runs, so a
  Bash command legitimately passes through both this block and the `Bash` one.
- **`claude-settings-guard.js` is a file-tool hook**, matcher
  `Edit|Write|NotebookEdit|MultiEdit` — it is the one command-class guard that
  never sees a Bash call. Note this is *not* the same matcher as
  `env-file-guard.js`'s `Read|Write|Edit|MultiEdit`: this guard adds
  `NotebookEdit` and drops `Read`, because a read of a settings file is harmless
  and a notebook write is not.
- The other four are `Bash`-matched and are appended to the existing `Bash` block.
  None of them takes an `if:` filter — like `git-protected-ops-block.js` they do
  their own matching in JS, so enforcement never depends on the same
  permission-matcher path that lets compound and piped commands slip past a `deny`
  rule.

Reminder: `install-global.sh` rsyncs these scripts to `~/.claude/hooks/` on every
run, but it never touches the `hooks` section of `~/.claude/settings.json`.
Registration is the one-time manual step above; until it is done every script
here sits on disk and does nothing.

The `PostToolUse` matcher is broadened from the six navigation tools to **all**
Serena tools so every call feeds health tracking; the tracker gates the read-guard
nav counters internally (only the six nav/exploration tools advance the gate, as
before). The `PostToolUseFailure` block points at the same script — see
[Health tracking & fail-open enforcement](#health-tracking--fail-open-enforcement)
for why both events are wired. If your Claude Code build does not support
`PostToolUseFailure`, that block is simply ignored and the `PostToolUse` error
path still catches failures.

The companion `deny` entries (defence in depth alongside these hooks) no longer
need manual wiring: the full canonical deny list lives in
[`lib/scripts/templates/settings-deny.json`](../scripts/templates/settings-deny.json)
and is merged into `~/.claude/settings.json` automatically by
`install-global.sh` (so by `bootstrap install`, `setup`, and `update`). The
merge is additive-only — your own entries are never removed or reordered.

Two documented caveats on those deny rules:

- Deny rules match a **literal command spelling**, not a capability — that is
  exactly why these hooks exist (see above). They are enforced in every mode,
  `bypassPermissions` included; what they cannot do is see through `/bin/rm`,
  `bash -c`, or `python -c`.
- Deny rules cannot carry allowlist exceptions: a broad deny blocks every
  matching call even when a narrower `allow` rule also matches. So
  `Bash(git stash:*)` also blocks read-only `git stash list`.

Hooks load at session start, so restart any running session after wiring.

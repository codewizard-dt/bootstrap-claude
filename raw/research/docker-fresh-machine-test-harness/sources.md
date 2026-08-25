---
topic: Docker-based fresh-machine test harness for CLI installer scripts (setup/update) — best practices for research, implementation, and testing phases of TASK-060
slug: docker-fresh-machine-test-harness
researched: 2026-08-22
---

# Primary Sources — Docker-Based Fresh-Machine Test Harness for CLI Installer Scripts

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/lib.sh::has_tty`, `::prompt_yn`, `::prompt_yn_sticky` | 2026-08-22 | Non-interactive mode is a hard, structural "no" for every prompt in this codebase — nothing is ever recorded, and every optional install is declined by default |
| S2 | codebase | `lib/scripts/setup-project.sh` | 2026-08-22 | Confirms preflight checks (`claude`, `uv`) and the single-positional-arg contract (`resolve_project_dir "$1"`) |
| S3 | codebase | `bin/cli.js` | 2026-08-22 | `SCRIPTS.setup`/`SCRIPTS.update` hardcode `args: ['.']` and never spread `extraArgs` — TASK-060's planned `node bin/cli.js setup <scratch-path>` invocation does not actually target the scratch path |
| S4 | codebase | `package.json` | 2026-08-22 | No `engines` field — any current Node LTS is acceptable, confirming TASK-060's own note |
| S5 | web | https://www.reddit.com/r/docker/comments/10izvvv/is_docker_the_right_tool_for_my_use_case_testing/ | 2026-08-22 | Community consensus recommending Docker over a VM for testing an install script against a byte-identical fresh Ubuntu base |
| S6 | web | https://www.commandinline.com/shell-script-idempotency-safe-rerun-patterns/ | 2026-08-22 | "The most reliable way to verify idempotency is to run the script twice in the same CI job and assert that the second run produces no changes and exits cleanly." |
| S7 | web | https://oneuptime.com/blog/post/2026-02-08-how-to-write-idempotent-docker-entrypoint-scripts/view | 2026-08-22 | "The easiest way to verify your entrypoint is idempotent: run it twice and check for differences." |
| S8 | web | https://paiml.github.io/bashrs/concepts/idempotency.html | 2026-08-22 | Concrete shell pattern: run script N times, capture state/exit code after each, assert identical state and all-zero exit codes |
| S9 | web | https://stackoverflow.com/questions/72067650/how-to-install-docker-on-github-actions | 2026-08-22 | "Docker is already available in the default ubuntu images" on GitHub Actions runners |
| S10 | web | https://docs.docker.com/guides/gha/ | 2026-08-22 | Standard GitHub Actions + Docker workflow pattern (build/test steps directly on the runner, no nested Docker needed for a plain build-and-run harness) |

## Excerpts

### S1 — `lib/scripts/lib.sh` (this repo)
```
has_tty() {
  [ -t 0 ] || [ "${BOOTSTRAP_ASSUME_TTY:-}" = "1" ]
}

prompt_yn() {
  ...
  if has_tty; then
    read -r -p "$prompt" reply
  else
    echo "  Non-interactive terminal: skipping prompt, answering no."
    reply="n"
  fi
  ...
}
```
> `prompt_yn_sticky`'s non-interactive branch: "Non-interactive: answer no and record NOTHING. This return is what makes the rule structural rather than a flag check — no path from here can reach the prefs_set below."

### S3 — `bin/cli.js` (this repo)
```
const SCRIPTS = {
  setup: { script: 'setup-project.sh', args: ['.'] },
  update: { script: 'update-project.sh', args: ['.'] },
  ...
  deploy: { script: 'setup-deployment.sh', args: ['.', ...extraArgs] },
  ...
};
```
> Only `deploy`/`deployment`/`migrate`/`typechecks`/`dashboard` spread `extraArgs`; `setup`/`update` always pass literal `['.']`.

### S5 — Is docker the right tool for my use case? (testing an installscript)
https://www.reddit.com/r/docker/comments/10izvvv/is_docker_the_right_tool_for_my_use_case_testing/
> "No VM as two ubuntu installs may differ leading to breakage of tools/bash script. Use docker - so that you can containerize in future as well when installing on minimum vanialla os (inside docker), you'll get more 'not found items'."

### S6 — Shell Script Idempotency: Writing Scripts That Are Safe to Rerun
https://www.commandinline.com/shell-script-idempotency-safe-rerun-patterns/
> "The most reliable way to verify idempotency is to run the script twice in the same CI job and assert that the second run produces no changes and exits cleanly."

### S9 — How to install docker on GitHub Actions
https://stackoverflow.com/questions/72067650/how-to-install-docker-on-github-actions
> "Docker is already available in the default ubuntu images. You can find all the installed software in actions/runner-images."

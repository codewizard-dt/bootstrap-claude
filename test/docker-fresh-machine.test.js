#!/usr/bin/env node
// Repeatable checks for test/docker/fresh-machine/ (TASK-060) and .github/workflows/docker-harness.yml (TASK-073).
// Zero-dependency: node:test + node:assert only, mirroring the sibling suites. Run: npm test
//
// Covers only what's checkable without a live Docker daemon or GitHub Actions runner: Dockerfile/workflow
// as static text, and run.sh's argument-parsing + per-mode docker-command construction via a stubbed `docker`
// on PATH. The genuinely non-unit-testable cases (live docker build/run, a real CI run) are UAT-060/UAT-073's
// Manual cases.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HARNESS_DIR = path.join(REPO, 'test', 'docker', 'fresh-machine');
const DOCKERFILE = path.join(HARNESS_DIR, 'Dockerfile');
const RUN_SH = path.join(HARNESS_DIR, 'run.sh');
const SCRIPTS_README = path.join(REPO, 'lib', 'scripts', 'README.md');
const WORKFLOW = path.join(REPO, '.github', 'workflows', 'docker-harness.yml');

const CALL_MARKER = '===CALL===';

function dockerfileText() {
  return fs.readFileSync(DOCKERFILE, 'utf8');
}

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'docker-fresh-machine-'));
}

// Stub `docker`: logs every invocation's argv to DOCKER_STUB_LOG instead of touching a real daemon; `image inspect` exits DOCKER_STUB_IMAGE_EXISTS (default 0, i.e. image already present).
function writeDockerStub(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const stubPath = path.join(binDir, 'docker');
  fs.writeFileSync(
    stubPath,
    [
      '#!/usr/bin/env bash',
      '{',
      `  echo "${CALL_MARKER}"`,
      '  printf \'%s\\n\' "$@"',
      '} >> "$DOCKER_STUB_LOG"',
      'if [ "${1:-}" = "image" ] && [ "${2:-}" = "inspect" ]; then',
      '  exit "${DOCKER_STUB_IMAGE_EXISTS:-0}"',
      'fi',
      'exit 0',
      '',
    ].join('\n'),
  );
  fs.chmodSync(stubPath, 0o755);
  return stubPath;
}

// Parses the stub log into an array of calls, each an array of argv strings.
function parseStubLog(logPath) {
  if (!fs.existsSync(logPath)) return [];
  const raw = fs.readFileSync(logPath, 'utf8');
  return raw
    .split(`${CALL_MARKER}\n`)
    .filter((block) => block.length > 0)
    .map((block) => block.replace(/\n$/, '').split('\n'));
}

function runHarness(args, { imageExists = true } = {}) {
  const dir = scratchDir();
  const binDir = path.join(dir, 'bin');
  writeDockerStub(binDir);
  const logPath = path.join(dir, 'docker-calls.log');
  fs.writeFileSync(logPath, '');

  const result = spawnSync('bash', [RUN_SH, ...args], {
    cwd: HARNESS_DIR,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      DOCKER_STUB_LOG: logPath,
      DOCKER_STUB_IMAGE_EXISTS: imageExists ? '0' : '1',
    },
    encoding: 'utf8',
  });

  return { ...result, calls: parseStubLog(logPath) };
}

// --- Dockerfile: static assertions, no subprocess ---

test('Dockerfile: never COPYs the bootstrap-claude repo (or any of its lib/, wiki/, package.json) into the image', () => {
  const text = dockerfileText();
  const copyLines = text
    .split('\n')
    .filter((line) => /^\s*COPY\b/i.test(line));
  assert.deepStrictEqual(
    copyLines,
    [],
    `expected no COPY instructions, found: ${JSON.stringify(copyLines)}`,
  );
});

test('Dockerfile: base image is ubuntu:24.04 and ARG NODE_VERSION defaults to 24', () => {
  const text = dockerfileText();
  assert.match(text, /^FROM ubuntu:24\.04\s*$/m);
  assert.match(text, /^ARG NODE_VERSION=24\s*$/m);
});

test('Dockerfile: installs every foundational OS package the task requires (git, curl, ca-certificates, build-essential, gnupg, sudo, rsync)', () => {
  const text = dockerfileText();
  const aptInstallMatch = text.match(/apt-get install -y --no-install-recommends([\s\S]*?)&&/);
  assert.ok(aptInstallMatch, 'expected an apt-get install -y --no-install-recommends block');
  const pkgBlock = aptInstallMatch[1];
  for (const pkg of ['git', 'curl', 'ca-certificates', 'build-essential', 'gnupg', 'sudo', 'rsync']) {
    assert.match(pkgBlock, new RegExp(`\\b${pkg}\\b`), `missing package: ${pkg}`);
  }
});

test('Dockerfile: installs Node via NodeSource, claude CLI via npm, uv via its official installer, and Homebrew for a non-root user', () => {
  const text = dockerfileText();
  assert.match(text, /deb\.nodesource\.com\/setup_\$\{NODE_VERSION\}\.x/);
  assert.match(text, /npm install -g @anthropic-ai\/claude-code/);
  assert.match(text, /astral\.sh\/uv\/install\.sh/);
  assert.match(text, /Homebrew\/install\/HEAD\/install\.sh/);
  assert.match(text, /useradd .*tester/);
  assert.match(text, /^USER tester\s*$/m);
});

test('Dockerfile: sets WORKDIR /workspace and leaves CMD as an interactive shell', () => {
  const text = dockerfileText();
  assert.match(text, /^WORKDIR \/workspace\s*$/m);
  assert.match(text, /^CMD \["bash"\]\s*$/m);
});

// --- run.sh: argument parsing (runs before any docker invocation) ---

test('run.sh: an unrecognized positional argument prints usage and exits 1 without ever invoking docker', () => {
  const dir = scratchDir();
  const logPath = path.join(dir, 'docker-calls.log');
  fs.writeFileSync(logPath, '');
  // Deliberately PATH-less for docker, so a reached docker call would surface as "command not found", not the usage message.
  const result = spawnSync('bash', [RUN_SH, 'bogus-mode'], {
    cwd: HARNESS_DIR,
    env: { ...process.env, DOCKER_STUB_LOG: logPath },
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Usage: .*\[shell\|setup\|update\|stale\|idempotency\|live-hook\] \[--rebuild\]/);
  assert.deepStrictEqual(parseStubLog(logPath), []);
});

// --- run.sh: per-mode docker command construction (stubbed docker) ---

test('run.sh: default mode (no args) runs an interactive shell in a fresh container via docker run --rm -it ... bash', () => {
  const { status, calls } = runHarness([]);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(runCall, `expected a docker run call, got: ${JSON.stringify(calls)}`);
  assert.ok(runCall.includes('--rm'));
  assert.ok(runCall.includes('-it'));
  assert.ok(runCall.some((a) => a === '-v'));
  assert.ok(runCall.some((a) => /:\/opt\/bootstrap-claude:ro$/.test(a)));
  assert.ok(runCall.includes('bootstrap-claude-fresh-machine'));
  assert.strictEqual(runCall[runCall.length - 1], 'bash');
});

test('run.sh shell: explicit "shell" argument produces the identical docker run call as no argument', () => {
  const noArg = runHarness([]);
  const explicit = runHarness(['shell']);
  assert.deepStrictEqual(explicit.calls, noArg.calls);
});

test('run.sh setup: runs setup-project.sh non-interactively against a fresh scratch dir, never -it, never against the mounted repo path', () => {
  const { status, calls } = runHarness(['setup']);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(runCall, `expected a docker run call, got: ${JSON.stringify(calls)}`);
  assert.ok(!runCall.includes('-it'), 'setup mode must not allocate a tty');
  const script = runCall[runCall.length - 1];
  assert.match(script, /mkdir -p '\/workspace\/scratch-project'/);
  assert.match(script, /'\/opt\/bootstrap-claude\/lib\/scripts\/setup-project\.sh' '\/workspace\/scratch-project'/);
  assert.doesNotMatch(script, /update-project\.sh/);
});

test('run.sh update: chains setup-project.sh && update-project.sh against the same scratch dir in one container invocation', () => {
  const { status, calls } = runHarness(['update']);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(runCall, `expected a docker run call, got: ${JSON.stringify(calls)}`);
  const script = runCall[runCall.length - 1];
  const setupIdx = script.indexOf("setup-project.sh' '/workspace/scratch-project'");
  const updateIdx = script.indexOf("update-project.sh' '/workspace/scratch-project'");
  assert.ok(setupIdx !== -1, 'expected setup-project.sh invocation in the update-mode script');
  assert.ok(updateIdx !== -1, 'expected update-project.sh invocation in the update-mode script');
  assert.ok(setupIdx < updateIdx, 'setup-project.sh must run before update-project.sh');
  assert.match(script, /setup-project\.sh' '\/workspace\/scratch-project' && '/);
});

test('run.sh stale: extracts $OLD_REF via read-only git archive into the old-checkout dir, before running any setup/update script', () => {
  const { status, calls } = runHarness(['stale']);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(runCall, `expected a docker run call, got: ${JSON.stringify(calls)}`);
  const script = runCall[runCall.length - 1];
  assert.match(script, /mkdir -p '\/workspace\/scratch-project' '\/workspace\/old-bootstrap-claude'/);
  assert.match(
    script,
    /git --git-dir='\/opt\/bootstrap-claude\/\.git' archive 'c33808d' \| tar -x -C '\/workspace\/old-bootstrap-claude'/,
  );
  const archiveIdx = script.indexOf('git --git-dir=');
  const oldSetupIdx = script.indexOf("'/workspace/old-bootstrap-claude/lib/scripts/setup-project.sh'");
  assert.ok(archiveIdx !== -1 && oldSetupIdx !== -1, `expected both steps in: ${script}`);
  assert.ok(archiveIdx < oldSetupIdx, 'git archive extraction must run before the old checkout is invoked');
});

test('run.sh stale: runs the OLD checkout\'s setup-project.sh tolerantly (not chained with &&), then unconditionally runs the CURRENT checkout\'s update-project.sh against the same scratch dir', () => {
  const { status, calls } = runHarness(['stale']);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  const script = runCall[runCall.length - 1];

  // Old setup-project.sh's expected Serena-bootstrap failure is tolerated with `||` in its own subshell, not `&&`.
  assert.match(
    script,
    /\('\/workspace\/old-bootstrap-claude\/lib\/scripts\/setup-project\.sh' '\/workspace\/scratch-project' \|\| echo [^;]+\)/,
  );

  const oldSetupIdx = script.indexOf("'/workspace/old-bootstrap-claude/lib/scripts/setup-project.sh'");
  const currentUpdateIdx = script.indexOf("'/opt/bootstrap-claude/lib/scripts/update-project.sh'");
  assert.ok(oldSetupIdx !== -1 && currentUpdateIdx !== -1, `expected both invocations in: ${script}`);
  assert.ok(oldSetupIdx < currentUpdateIdx, 'old setup-project.sh must run before the current update-project.sh');

  // Stale mode seeds with old setup only, migrates with current update only.
  assert.doesNotMatch(script, /'\/opt\/bootstrap-claude\/lib\/scripts\/setup-project\.sh'/);
  assert.doesNotMatch(script, /'\/workspace\/old-bootstrap-claude\/lib\/scripts\/update-project\.sh'/);

  // Joined to update-project.sh with `;`, never `&&`, so the tolerated old-setup exit can't block it.
  assert.match(
    script,
    />&2\);\s*'\/opt\/bootstrap-claude\/lib\/scripts\/update-project\.sh'/,
    `expected the old-setup subshell to close and be joined to update-project.sh by ';', got: ${script}`,
  );
});

test('run.sh stale: never allocates a tty and OLD_REF is the last commit before the 3.0.0 major bump', () => {
  const { status, calls } = runHarness(['stale']);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(!runCall.includes('-it'), 'stale mode must not allocate a tty');

  const runShText = fs.readFileSync(RUN_SH, 'utf8');
  assert.match(runShText, /OLD_REF="c33808d"/);
});

test('run.sh idempotency: runs setup-project.sh once, then update-project.sh twice, against the same scratch dir, in that order', () => {
  const { status, calls } = runHarness(['idempotency']);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(runCall, `expected a docker run call, got: ${JSON.stringify(calls)}`);
  const script = runCall[runCall.length - 1];

  const setupMatches = [...script.matchAll(/'\/opt\/bootstrap-claude\/lib\/scripts\/setup-project\.sh' '\/workspace\/scratch-project'/g)];
  const updateMatches = [...script.matchAll(/'\/opt\/bootstrap-claude\/lib\/scripts\/update-project\.sh' '\/workspace\/scratch-project'/g)];
  assert.strictEqual(setupMatches.length, 1, `expected exactly one setup-project.sh call, got: ${setupMatches.length}`);
  assert.strictEqual(updateMatches.length, 2, `expected exactly two update-project.sh calls, got: ${updateMatches.length}`);

  const setupIdx = setupMatches[0].index;
  const firstUpdateIdx = updateMatches[0].index;
  const secondUpdateIdx = updateMatches[1].index;
  assert.ok(
    setupIdx < firstUpdateIdx && firstUpdateIdx < secondUpdateIdx,
    `expected setup-project.sh before both update-project.sh calls, in order; got indices ${setupIdx}, ${firstUpdateIdx}, ${secondUpdateIdx}`,
  );
});

test('run.sh idempotency: tolerates the seed and both update-project.sh calls\' expected Serena-bootstrap failure, excludes session-transcript jsonl files from the snapshot, and diffs snapshot-2 vs snapshot-3 with PASS/FAIL messaging', () => {
  const { status, calls } = runHarness(['idempotency']);
  assert.strictEqual(status, 0);
  const runCall = calls.find((c) => c[0] === 'run');
  const script = runCall[runCall.length - 1];

  // All three calls tolerate the expected Serena-bootstrap failure with `|| echo ... >&2`, same as `stale` mode's seed step.
  assert.match(
    script,
    /'\/opt\/bootstrap-claude\/lib\/scripts\/setup-project\.sh' '\/workspace\/scratch-project' \|\| echo 'idempotency: setup-project\.sh exited non-zero — expected/,
  );
  assert.match(
    script,
    /update-project\.sh' '\/workspace\/scratch-project' \|\| echo 'idempotency: first update-project\.sh exited non-zero — expected/,
  );
  assert.match(
    script,
    /update-project\.sh' '\/workspace\/scratch-project' \|\| echo 'idempotency: second update-project\.sh exited non-zero — expected/,
  );

  // Excludes Claude Code session transcripts, which churn on every `claude --print` call and aren't real drift.
  assert.match(
    script,
    /find "\$HOME\/\.claude" -type f -not -path '\*\/projects\/\*\.jsonl' -exec sha256sum \{\} \+/,
  );

  // Real assertion: snapshot-2 vs snapshot-3 via `diff -u`, with explicit PASS/FAIL messaging.
  assert.match(script, /diff -u "\$SNAP_DIR\/snapshot-2\.txt" "\$SNAP_DIR\/snapshot-3\.txt"/);
  assert.match(script, /idempotency: FAIL — a second update-project\.sh run produced state that differs/);
  assert.match(script, /idempotency: PASS — a second update-project\.sh run against the same scratch dir is a true no-op/);
});

// --- run.sh: live-hook mode (TASK-076) ---

test('run.sh live-hook: exits 1 with a claude-setup-token hint and never touches docker when CLAUDE_CODE_OAUTH_TOKEN is unset', () => {
  const dir = scratchDir();
  const binDir = path.join(dir, 'bin');
  writeDockerStub(binDir);
  const logPath = path.join(dir, 'docker-calls.log');
  fs.writeFileSync(logPath, '');

  // Destructure the token out explicitly — never rely on the runner's env merely lacking it.
  const { CLAUDE_CODE_OAUTH_TOKEN, ...envWithoutToken } = process.env;
  const result = spawnSync('bash', [RUN_SH, 'live-hook'], {
    cwd: HARNESS_DIR,
    env: {
      ...envWithoutToken,
      PATH: `${binDir}:${envWithoutToken.PATH}`,
      DOCKER_STUB_LOG: logPath,
      DOCKER_STUB_IMAGE_EXISTS: '0',
    },
    encoding: 'utf8',
  });

  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /claude setup-token/);
  assert.deepStrictEqual(parseStubLog(logPath), [], 'expected the stubbed docker binary to never be invoked');
});

test('run.sh live-hook: with CLAUDE_CODE_OAUTH_TOKEN set, docker run forwards the token value-less, bind-mounts the repo read-only, and never passes --dangerously-skip-permissions', () => {
  const dir = scratchDir();
  const binDir = path.join(dir, 'bin');
  writeDockerStub(binDir);
  const logPath = path.join(dir, 'docker-calls.log');
  fs.writeFileSync(logPath, '');

  const result = spawnSync('bash', [RUN_SH, 'live-hook'], {
    cwd: HARNESS_DIR,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      DOCKER_STUB_LOG: logPath,
      DOCKER_STUB_IMAGE_EXISTS: '0',
      CLAUDE_CODE_OAUTH_TOKEN: 'test-token-value',
    },
    encoding: 'utf8',
  });

  assert.strictEqual(result.status, 0);
  const calls = parseStubLog(logPath);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(runCall, `expected a docker run call, got: ${JSON.stringify(calls)}`);

  const eIdx = runCall.indexOf('-e');
  assert.ok(eIdx !== -1, 'expected a value-less -e flag');
  assert.strictEqual(runCall[eIdx + 1], 'CLAUDE_CODE_OAUTH_TOKEN', 'expected -e CLAUDE_CODE_OAUTH_TOKEN forwarded value-less');

  assert.ok(runCall.some((a) => /:\/opt\/bootstrap-claude:ro$/.test(a)), 'expected the repo bind-mounted read-only at /opt/bootstrap-claude');
  assert.ok(!runCall.includes('--dangerously-skip-permissions'), 'live-hook must never pass --dangerously-skip-permissions');
});

test('run.sh live-hook: in-container script runs install-global.sh --skip-mcps, then sets packageInstall.consent via bootstrap-prefs.js, then timeout 120 claude -p, in that order', () => {
  const dir = scratchDir();
  const binDir = path.join(dir, 'bin');
  writeDockerStub(binDir);
  const logPath = path.join(dir, 'docker-calls.log');
  fs.writeFileSync(logPath, '');

  const result = spawnSync('bash', [RUN_SH, 'live-hook'], {
    cwd: HARNESS_DIR,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      DOCKER_STUB_LOG: logPath,
      DOCKER_STUB_IMAGE_EXISTS: '0',
      CLAUDE_CODE_OAUTH_TOKEN: 'test-token-value',
    },
    encoding: 'utf8',
  });

  assert.strictEqual(result.status, 0);
  const calls = parseStubLog(logPath);
  const runCall = calls.find((c) => c[0] === 'run');
  assert.ok(runCall, `expected a docker run call, got: ${JSON.stringify(calls)}`);
  const script = runCall[runCall.length - 1];

  const installIdx = script.indexOf("install-global.sh' --skip-mcps");
  const prefsIdx = script.indexOf('bootstrap-prefs.js" --set packageInstall.consent --value true');
  const claudeIdx = script.indexOf('timeout 120 claude -p');
  assert.ok(installIdx !== -1, `expected install-global.sh --skip-mcps in: ${script}`);
  assert.ok(prefsIdx !== -1, `expected bootstrap-prefs.js --set packageInstall.consent --value true in: ${script}`);
  assert.ok(claudeIdx !== -1, `expected timeout 120 claude -p in: ${script}`);
  assert.ok(
    installIdx < prefsIdx && prefsIdx < claudeIdx,
    `expected install-global.sh before bootstrap-prefs.js before timeout 120 claude -p; got indices ${installIdx}, ${prefsIdx}, ${claudeIdx}`,
  );
});

test('run.sh: skips docker build when the image already exists and no --rebuild is passed', () => {
  const { calls } = runHarness(['shell'], { imageExists: true });
  assert.ok(!calls.some((c) => c[0] === 'build'), 'did not expect a docker build call');
  assert.ok(calls.some((c) => c[0] === 'image' && c[1] === 'inspect'));
});

test('run.sh: builds the image when it does not exist yet, even without --rebuild', () => {
  const { calls } = runHarness(['shell'], { imageExists: false });
  const buildCall = calls.find((c) => c[0] === 'build');
  assert.ok(buildCall, `expected a docker build call, got: ${JSON.stringify(calls)}`);
  assert.ok(buildCall.includes('-t'));
  assert.ok(buildCall.includes('bootstrap-claude-fresh-machine'));
});

test('run.sh --rebuild: forces a docker build even when the image already exists', () => {
  const { calls } = runHarness(['shell', '--rebuild'], { imageExists: true });
  const buildCall = calls.find((c) => c[0] === 'build');
  assert.ok(buildCall, `expected --rebuild to force a docker build call, got: ${JSON.stringify(calls)}`);
});

test('run.sh: --rebuild is accepted in any position alongside a mode argument (e.g. "setup --rebuild")', () => {
  const { status, calls } = runHarness(['setup', '--rebuild'], { imageExists: true });
  assert.strictEqual(status, 0);
  assert.ok(calls.some((c) => c[0] === 'build'));
  const runCall = calls.find((c) => c[0] === 'run');
  assert.match(runCall[runCall.length - 1], /setup-project\.sh/);
});

// --- Documentation pointer ---

test('test/docker/fresh-machine/README.md: documents the stale mode alongside shell/setup/update', () => {
  const text = fs.readFileSync(path.join(HARNESS_DIR, 'README.md'), 'utf8');
  assert.match(text, /\.\/run\.sh stale/);
});

test('lib/scripts/README.md: the "Standalone infra scripts" table points at test/docker/fresh-machine/', () => {
  const text = fs.readFileSync(SCRIPTS_README, 'utf8');
  assert.match(
    text,
    /\[`test\/docker\/fresh-machine\/`\]\(\.\.\/\.\.\/test\/docker\/fresh-machine\/README\.md\)/,
  );
});

// --- .github/workflows/docker-harness.yml (TASK-073): static YAML-shape assertions ---

function workflowText() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

test('docker-harness.yml: triggers only on pull_request, scoped to the two relevant paths, never on push or every path', () => {
  const text = workflowText();
  assert.match(text, /^on:\s*$/m);
  assert.match(text, /^\s*pull_request:\s*$/m);
  assert.doesNotMatch(text, /^\s*push:\s*$/m);
  assert.match(text, /^\s*-\s*"test\/docker\/fresh-machine\/\*\*"\s*$/m);
  assert.match(text, /^\s*-\s*"lib\/scripts\/\*\*"\s*$/m);
});

test('docker-harness.yml: job runs on ubuntu-latest and checks out the repo before building', () => {
  const text = workflowText();
  assert.match(text, /runs-on:\s*ubuntu-latest/);
  const checkoutIdx = text.indexOf('actions/checkout@v4');
  const buildIdx = text.indexOf('docker build');
  assert.ok(checkoutIdx !== -1, 'expected an actions/checkout step');
  assert.ok(buildIdx !== -1, 'expected a docker build step');
  assert.ok(checkoutIdx < buildIdx, 'checkout must run before the image build');
});

test('docker-harness.yml: builds the harness image tagged bootstrap-claude-fresh-machine, matching run.sh\'s own IMAGE_NAME', () => {
  const text = workflowText();
  assert.match(text, /docker build -t bootstrap-claude-fresh-machine test\/docker\/fresh-machine/);
  const runShText = fs.readFileSync(RUN_SH, 'utf8');
  assert.match(runShText, /IMAGE_NAME="bootstrap-claude-fresh-machine"/);
});

test('docker-harness.yml: runs "run.sh setup" then "run.sh update" as separate steps, setup before update, each relying on default non-zero-exit step failure', () => {
  const text = workflowText();
  const setupIdx = text.indexOf('run.sh setup');
  const updateIdx = text.indexOf('run.sh update');
  assert.ok(setupIdx !== -1, 'expected a run.sh setup step');
  assert.ok(updateIdx !== -1, 'expected a run.sh update step');
  assert.ok(setupIdx < updateIdx, 'setup must run before update');
  assert.doesNotMatch(text, /continue-on-error/, 'no step should swallow a non-zero exit');
});

test('docker-harness.yml: notes TASK-071/TASK-072 modes are pending rather than silently omitting them', () => {
  const text = workflowText();
  assert.match(text, /TASK-071/);
  assert.match(text, /TASK-072/);
});

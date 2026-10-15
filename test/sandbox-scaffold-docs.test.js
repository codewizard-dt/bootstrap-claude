// Repeatable static checks for the opt-in sandbox scaffold (TASK-0107):
// the step-7b placement in install-global.sh, the footguns it must never write,
// and the documentation caveats. Zero-dependency: node:test + node:assert only.
//
// Run: npm test   (or: node --test test/sandbox-scaffold-docs.test.js)
//
// Text-only. Nothing here executes install-global.sh — the runtime behaviour of
// the prompt is covered hermetically by test/install-sandbox-prompt.test.js.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(REPO, ...p), 'utf8');

const INSTALL = read('lib', 'scripts', 'install-global.sh');
const SCRIPTS_README = read('lib', 'scripts', 'README.md');
const HOOKS_README = read('lib', 'hooks', 'README.md');
const CLAUDE_MD = read('CLAUDE.md');
const TEMPLATE_TEXT = read('lib', 'scripts', 'templates', 'settings-sandbox.json');

test('step 7b sits between the skill-preference batch and the MCP install, and is guarded as a whole', () => {
  const step7 = INSTALL.indexOf('gitignore.offerSectionUpdates');
  const call = INSTALL.indexOf('if ! configure_sandbox; then');
  const mcp = INSTALL.indexOf('SKIP_MCPS" = false', call);
  assert.ok(step7 !== -1 && call !== -1 && mcp !== -1, 'could not locate step 7, the 7b call, or the MCP branch');
  assert.ok(step7 < call, 'configure_sandbox runs before the step-7 batch');
  assert.ok(call < mcp, 'configure_sandbox runs after the MCP install');
  assert.match(INSTALL, /if ! configure_sandbox; then\s+echo "Warning: sandbox setup failed/, 'the step is not warn-and-continue');
});

test('the step never writes the boundary-reopening or managed-only footgun keys', () => {
  const fn = INSTALL.slice(INSTALL.indexOf('configure_sandbox() {'), INSTALL.indexOf('if ! configure_sandbox; then'));
  assert.ok(fn.length > 0, 'could not isolate configure_sandbox()');
  const forbidden = [
    'allowUnsandboxedCommands',
    'allowAppleEvents',
    'allowUnixSockets',
    'disableBypassPermissionsMode',
    'allowManagedPermissionRulesOnly',
    'allowManagedHooksOnly',
  ];
  for (const key of forbidden) {
    assert.ok(!fn.includes(key), `configure_sandbox() references ${key}`);
    assert.ok(!TEMPLATE_TEXT.includes(key), `settings-sandbox.json contains ${key}`);
  }
  assert.ok(!/filesystem/.test(TEMPLATE_TEXT), 'settings-sandbox.json carries a filesystem policy');
});

test('the prompt states the docker incompatibility and the excludedCommands escape hatch', () => {
  const fn = INSTALL.slice(INSTALL.indexOf('configure_sandbox() {'), INSTALL.indexOf('if ! configure_sandbox; then'));
  assert.match(fn, /docker/i, 'the prompt text never mentions docker');
  assert.ok(fn.includes('excludedCommands'), 'the prompt text never names excludedCommands');
});

test('lib/scripts/README.md documents step 7b, the key, the template, and the docker caveat plainly', () => {
  assert.match(SCRIPTS_README, /## Sandbox scaffold notes/);
  assert.match(SCRIPTS_README, /step 7b/);
  assert.ok(SCRIPTS_README.includes('sandbox.scaffold'));
  assert.ok(SCRIPTS_README.includes('templates/settings-sandbox.json'));
  assert.match(SCRIPTS_README, /Sandboxing is incompatible with `docker` commands/);
  assert.match(SCRIPTS_README, /`excludedCommands` is the escape hatch/);
  assert.match(SCRIPTS_README, /MINGW\/MSYS\/CYGWIN/);
  assert.match(SCRIPTS_README, /`bubblewrap` \+\s+`socat`/);
});

test('lib/scripts/README.md no longer describes the sandbox scaffold as absent', () => {
  assert.ok(!/does not (yet )?scaffold[^.]*sandbox/i.test(SCRIPTS_README), 'a stale "does not scaffold" claim remains');
  assert.match(SCRIPTS_README, /scaffold a starter\s+sandbox block on opt-in/);
});

test('lib/hooks/README.md points at the opt-in scaffold without claiming it closes the gap', () => {
  assert.match(HOOKS_README, /`bootstrap install` can now scaffold a minimal starter `sandbox` block on opt-in/);
  assert.match(HOOKS_README, /by itself does not\s+close the script-file gap/);
});

test('CLAUDE.md mentions the opt-in sandbox step in the install bullet and the install-global.sh Key Files entry', () => {
  const lines = CLAUDE_MD.split('\n');
  const bullet = lines.find((l) => l.startsWith('- `npx @codewizard-dt/bootstrap install`'));
  const keyFile = lines.find((l) => l.startsWith('- `lib/scripts/install-global.sh`'));
  assert.ok(bullet, 'the install Setup Workflow bullet is missing');
  assert.ok(keyFile, 'the install-global.sh Key Files entry is missing');
  assert.match(bullet, /sandbox/i, 'the install bullet does not mention the sandbox step');
  assert.match(keyFile, /sandbox/i, 'the Key Files entry does not mention the sandbox step');
});

test('the starter template ships in the npm tarball: package.json files covers lib/ and does not negate it', () => {
  const files = JSON.parse(read('package.json')).files;
  assert.ok(files.includes('lib/'), 'package.json files does not include lib/');
  assert.ok(
    !files.some((f) => f.startsWith('!lib/') && 'lib/scripts/templates/settings-sandbox.json'.startsWith(f.slice(1))),
    'a negation pattern excludes settings-sandbox.json'
  );
});

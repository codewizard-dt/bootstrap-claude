#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const command = process.argv[2];
const extraArgs = process.argv.slice(3);

const SCRIPTS = {
  setup: { script: 'setup-project.sh', args: ['.'] },
  update: { script: 'update-project.sh', args: ['.'] },
  install: { script: 'install-global.sh', args: [] },
  deploy: { script: 'setup-deployment.sh', args: ['.', ...extraArgs] },
  deployment: { script: 'setup-deployment.sh', args: ['.', ...extraArgs] },
  migrate: { script: 'migrate-project.sh', args: ['.', ...extraArgs] },
  typechecks: { script: 'setup-strict-typechecks.sh', args: extraArgs },
  dashboard: { script: 'wiki-dashboard-server.js', args: ['.', ...extraArgs] },
};

if (!command || !SCRIPTS[command]) {
  console.error('Usage: bootstrap <command>');
  console.error('');
  console.error('Commands:');
  console.error('  setup         Set up a new project with Claude Code configurations');
  console.error('  update        Sync wiki scaffold and install skills globally');
  console.error('  install       Install skills globally into ~/.claude/skills/');
  console.error('  deploy        Scaffold CI/CD (.github/ workflows + .gitleaks.toml) into the project');
  console.error('                Optional: pass extra context for the Claude agent as a quoted string');
  console.error('                e.g. bootstrap deploy "backend is on port 8080, use s-2vcpu-4gb droplet"');
  console.error('  migrate       Migrate a legacy .docs/ project to the wiki structure (Claude-driven)');
  console.error('                Pass --dry-run to preview; runs on a fresh wiki-migration branch');
  console.error('  typechecks    Run strict typecheck setup via Claude (optional: language list)');
  console.error('                e.g. bootstrap typechecks typescript python');
  console.error('  dashboard     Launch the live wiki/work dashboard in this project (Ctrl-C to stop)');
  console.error('                Optional: pass a port number, e.g. bootstrap dashboard 4400');
  process.exit(1);
}

const { script, args } = SCRIPTS[command];
const scriptPath = path.resolve(__dirname, '..', 'lib', 'scripts', script);
const scriptArgs = args;

try {
  execFileSync(scriptPath, scriptArgs, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status || 1);
}

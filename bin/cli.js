#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const command = process.argv[2];
const extraArgs = process.argv.slice(3);

const SCRIPTS = {
  setup:      { script: 'setup-project.sh',           args: ['.'] },
  update:     { script: 'update-project.sh',           args: ['.'] },
  install:    { script: 'install-global.sh',           args: [] },
  deployment: { script: 'setup-deployment.sh',         args: ['.'] },
  typechecks: { script: 'setup-strict-typechecks.sh', args: extraArgs },
};

if (!command || !SCRIPTS[command]) {
  console.error('Usage: bootstrap <command>');
  console.error('');
  console.error('Commands:');
  console.error('  setup         Set up a new project with Claude Code configurations');
  console.error('  update        Sync .docs/ scaffold and install skills globally');
  console.error('  install       Install skills globally into ~/.claude/skills/');
  console.error('  deployment    Scaffold CI/CD (.github/ workflows + .gitleaks.toml) into the project');
  console.error('  typechecks    Run strict type-check setup via Claude (optional: language list)');
  console.error('                e.g. bootstrap typechecks typescript python');
  process.exit(1);
}

const { script, args } = SCRIPTS[command];
const scriptPath = path.resolve(__dirname, '..', '.scripts', script);
const scriptArgs = args;

try {
  execFileSync(scriptPath, scriptArgs, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status || 1);
}

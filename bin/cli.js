#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const command = process.argv[2];

const SCRIPTS = {
  setup: 'setup-project.sh',
  update: 'update-project.sh',
  install: 'install-global.sh',
  deploy: 'setup-deployment.sh',
};

if (!command || !SCRIPTS[command]) {
  console.error('Usage: bootstrap-claude <command>');
  console.error('');
  console.error('Commands:');
  console.error('  setup    Set up a new project with Claude Code configurations');
  console.error('  update   Sync .docs/ scaffold and install skills globally');
  console.error('  install  Install skills globally into ~/.claude/skills/');
  console.error('  deploy   Scaffold CI/CD (.github/ workflows + .gitleaks.toml) into the project');
  process.exit(1);
}

const scriptPath = path.resolve(__dirname, '..', '.scripts', SCRIPTS[command]);
const scriptArgs = command === 'install' ? [] : ['.'];

try {
  execFileSync(scriptPath, scriptArgs, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status || 1);
}

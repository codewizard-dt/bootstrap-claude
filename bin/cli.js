#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');

const command = process.argv[2];

const SCRIPTS = {
  setup: 'setup-project.sh',
  update: 'update-project.sh',
};

if (!command || !SCRIPTS[command]) {
  console.error('Usage: bootstrap-claude <command>');
  console.error('');
  console.error('Commands:');
  console.error('  setup   Set up a new project with Claude Code configurations');
  console.error('  update  Sync .claude/commands/ and .docs/ into the current project');
  process.exit(1);
}

const scriptPath = path.resolve(__dirname, '..', SCRIPTS[command]);

try {
  execFileSync(scriptPath, ['.'], { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status || 1);
}

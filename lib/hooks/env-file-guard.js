#!/usr/bin/env node
'use strict';

const path = require('path');

function isBlockedEnvFile(filePath) {
  if (!filePath) return false;
  const basename = path.basename(String(filePath));
  // Block .env exactly, and .env.* variants (e.g. .env.local, .env.production)
  // Allow .env.example — the one permitted exception
  return basename === '.env' ||
    (basename.startsWith('.env.') && basename !== '.env.example');
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }

  const { tool_name, tool_input } = data;
  let blocked = null;

  if (['Read', 'Write', 'Edit'].includes(tool_name)) {
    const fp = tool_input?.file_path;
    if (isBlockedEnvFile(fp)) blocked = fp;
  } else if (tool_name === 'MultiEdit') {
    const edits = Array.isArray(tool_input?.edits) ? tool_input.edits : [];
    const bad = edits.find(e => isBlockedEnvFile(e?.file_path));
    if (bad) blocked = bad.file_path;
  }

  if (blocked) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `.env policy: "${blocked}" cannot be read or written. Only .env.example is permitted. You may source an .env file in a Bash command to use its variables.`
      }
    }) + '\n');
  }

  process.exit(0);
});

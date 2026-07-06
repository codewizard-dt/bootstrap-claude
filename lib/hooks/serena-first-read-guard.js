#!/usr/bin/env node
'use strict';

const {
  buildWarmupInstructions, buildFileWarmupCall, isAllowedPath,
  getStateFilePath, readStateFile, writeStateFile, shouldEnforceSerena,
  isOutsideProject,
} = require('./lib/serena');

/**
 * Build a copy-pasteable warmup call parametrized by the exact file the
 * agent is about to Read. This is project-agnostic: it uses the file path
 * from the hook input instead of guessing a symbol name from the filename,
 * so it works in any project regardless of export conventions.
 */
function buildConcreteCall(filePath) {
  const call = buildFileWarmupCall(filePath, '  ');
  if (!call) return '';
  return `\nCONCRETE CALL FOR THIS FILE (works in any project):\n${call}\n`;
}

const FREE_READS = 2;
const WARN_AT = 3;
const REQUIRE_NAV_2_AT = 6;

function emitWarning(msg) { console.log(JSON.stringify({ systemMessage: msg })); }
function emitBlock(msg) { process.stderr.write(msg); process.exit(2); }

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Read') process.exit(0);
  if (process.env.CLAUDE_MIGRATION === '1') process.exit(0);

  // String coercion: non-string input would throw on .trim() and fail-open.
  const filePath = String(data.tool_input?.file_path ?? '').trim();
  if (!filePath) process.exit(0);

  // Enforcement is scoped to the project root — Serena can't reach outside it.
  if (isOutsideProject(filePath)) process.exit(0);

  const flagPath = getStateFilePath();
  const flag = readStateFile(flagPath);

  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  // Runs BEFORE the Gate-1 null-flag block. readStateFile returns null on 24h
  // expiry, which correctly falls through to enforcement (null ⇒ enforce).
  if (!shouldEnforceSerena(flag)) process.exit(0);

  if (isAllowedPath(filePath, { enforceMarkdown: true })) process.exit(0);

  if (!flag || !flag.warmup_done) {
    const warmupLines = buildWarmupInstructions('  ').join('\n');
    const concrete = buildConcreteCall(filePath);
    emitBlock(
      `⛔ SERENA-FIRST BLOCK (Gate 1 — Warmup Required)\n\n` +
      `Read on code file requires prior Serena warmup.\n\n` +
      `WARMUP PROTOCOL — call one of these first:\n` +
      `${warmupLines}\n` +
      concrete +
      `\nAfter warmup: ${FREE_READS} free Reads, then need Serena navigation.\n\n` +
      `Blocked: ${filePath}\n`
    );
  }

  const readFiles = Array.isArray(flag.read_files) ? flag.read_files : [];
  const navCount = flag.nav_count || 0;
  const alreadyRead = readFiles.includes(filePath);
  const nextReadNum = alreadyRead ? readFiles.length : readFiles.length + 1;

  if (navCount >= 2 || alreadyRead) {
    if (!alreadyRead) {
      readFiles.push(filePath);
      flag.read_files = readFiles;
      flag.read_count = readFiles.length;
      flag.timestamp = Date.now();
      writeStateFile(flagPath, flag);
    }
    process.exit(0);
  }

  if (nextReadNum <= FREE_READS) {
    readFiles.push(filePath);
    flag.read_files = readFiles;
    flag.read_count = readFiles.length;
    flag.timestamp = Date.now();
    writeStateFile(flagPath, flag);
    process.exit(0);
  }

  if (nextReadNum === WARN_AT && navCount === 0) {
    emitWarning(
      `⚠️ SERENA-FIRST WARNING (Read ${nextReadNum}) — consider Serena navigation.\n` +
      `Use mcp__serena__find_symbol / find_referencing_symbols before more Reads.\n` +
      `Next Read will be BLOCKED unless you use at least 1 Serena nav call.\n` +
      `After 2 nav calls, all Reads are unlimited (surgical mode).`
    );
    readFiles.push(filePath);
    flag.read_files = readFiles;
    flag.read_count = readFiles.length;
    flag.timestamp = Date.now();
    writeStateFile(flagPath, flag);
    process.exit(0);
  }

  if (nextReadNum < REQUIRE_NAV_2_AT && navCount < 1) {
    emitBlock(
      `⛔ SERENA-FIRST BLOCK (Gate 4 — Serena Navigation Required)\n\n` +
      `Read #${nextReadNum} requires at least 1 Serena navigation call.\n` +
      `After 1 nav call, Reads 4-5 unlock. After 2, unlimited.\n` +
      buildConcreteCall(filePath) +
      `\nBlocked: ${filePath}\n`
    );
  }

  if (nextReadNum >= REQUIRE_NAV_2_AT && navCount < 2) {
    emitBlock(
      `⛔ SERENA-FIRST BLOCK (Gate 5 — Surgical Mode Required)\n\n` +
      `Read #${nextReadNum} requires at least 2 Serena navigation calls.\n` +
      `Current: ${navCount} nav calls. Need 2.\n` +
      buildConcreteCall(filePath) +
      `\nBlocked: ${filePath}\n`
    );
  }

  readFiles.push(filePath);
  flag.read_files = readFiles;
  flag.read_count = readFiles.length;
  flag.timestamp = Date.now();
  writeStateFile(flagPath, flag);
  process.exit(0);
});

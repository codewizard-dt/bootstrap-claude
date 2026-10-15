#!/usr/bin/env node
// Repeatable checks for the wiki dashboard server's GET /api/usage route and the
// dashboard client's #/usage contract.
// Zero-dependency: node:test + node:assert/strict only, matching the style of
// test/settings-deny.test.js.
//
// Run: node --test test/wiki-dashboard-usage.test.js
//
// Hermetic: every server is spawned against a temp project under os.tmpdir() and
// the usage script is replaced by test/fixtures/wiki-dashboard/usage-stub.js via
// WIKI_DASHBOARD_USAGE_SCRIPT. The real usage-report script and ~/.claude/projects
// are never touched. The stub inherits the server's env, so each stub mode gets
// its own server process (own port, own invocation-count file). All children are
// killed and all temp dirs removed in `after`.
//
// The `slow` case waits out the server's 15 s execFile timeout, so this file takes
// about 16 s to run.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'lib', 'scripts', 'wiki-dashboard-server.js');
const DASHBOARD = path.join(REPO, 'lib', 'scripts', 'templates', 'wiki', 'dashboard.html');
const STUB = path.join(__dirname, 'fixtures', 'wiki-dashboard', 'usage-stub.js');
const STDERR_SENTINEL = 'STUB_STDERR_SENTINEL_9f3a';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-dashboard-usage-'));
const project = path.join(scratch, 'project');
const countDir = path.join(scratch, 'counts');
const children = [];

fs.mkdirSync(path.join(project, 'wiki', 'knowledge'), { recursive: true });
fs.mkdirSync(countDir);
fs.writeFileSync(path.join(project, 'wiki', 'index.md'), '# Index\n');
fs.writeFileSync(path.join(project, 'wiki', 'knowledge', 'page.md'), '# Page\n');

function listTree(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    out.push(path.relative(base, full) + (entry.isDirectory() ? '/' : ''));
    if (entry.isDirectory()) out.push(...listTree(full, base));
  }
  return out.sort();
}

const createdTree = listTree(project);

const expectedReport = JSON.parse(
  spawnSync(process.execPath, [STUB], { encoding: 'utf8', env: { PATH: process.env.PATH } }).stdout
);

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Spawn a dashboard server with the given env overrides; resolves once it logs
// its listening line (the server may fall back to a later port, so parse it).
async function startServer(envOverrides) {
  const env = Object.assign({}, process.env);
  delete env.STUB_MODE;
  delete env.STUB_COUNT_FILE;
  Object.assign(env, envOverrides);
  const requested = await freePort();
  const child = spawn(process.execPath, [SERVER, project, '--port', String(requested)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const port = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      const m = buf.match(/localhost:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(parseInt(m[1], 10));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('server exited early: ' + code));
    });
  });
  return { port, child };
}

function usageServer(mode, extra) {
  const countFile = path.join(countDir, (mode || 'default') + '-' + Math.random().toString(36).slice(2) + '.log');
  const env = Object.assign(
    { WIKI_DASHBOARD_USAGE_SCRIPT: STUB, STUB_COUNT_FILE: countFile },
    mode ? { STUB_MODE: mode } : {},
    extra || {}
  );
  return startServer(env).then((s) => Object.assign(s, { countFile }));
}

function request(port, method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function countLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
}

function teardown() {
  for (const child of children) {
    try {
      child.kill('SIGKILL');
    } catch (e) {
      /* already gone */
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
}

// The slow-mode stub is a grandchild of this process; killing the server does
// not reap it, but the server's execFile timeout already SIGTERMs it. The exit
// hook is a backstop so an aborted run still cleans up its servers and temp dir.
test.after(teardown);
process.on('exit', teardown);

test('stub sanity: fixed report is schemaVersion 1 with non-zero totals', () => {
  assert.equal(expectedReport.schemaVersion, 1);
  assert.ok(expectedReport.totals.costUsd > 0);
  assert.equal(expectedReport.models.length, 1);
  assert.equal(expectedReport.skills.length, 1);
  assert.equal(expectedReport.days.length, 1);
});

test('GET /api/usage returns the stub report with JSON and no-store headers', async () => {
  const { port } = await usageServer('');
  const res = await request(port, 'GET', '/api/usage');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^application\/json/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(res.body), expectedReport);
});

test('WIKI_DASHBOARD_USAGE_SCRIPT pointing at a missing file returns 404 usage-report-unavailable', async () => {
  const { port } = await startServer({
    WIKI_DASHBOARD_USAGE_SCRIPT: path.join(scratch, 'does-not-exist.js'),
  });
  const res = await request(port, 'GET', '/api/usage');
  assert.equal(res.status, 404);
  assert.deepEqual(JSON.parse(res.body), { error: 'usage-report-unavailable' });
});

test('fail mode returns 500 usage-report-failed without leaking stderr, script path, or project dir', async () => {
  const { port, countFile } = await usageServer('fail');
  const res = await request(port, 'GET', '/api/usage');
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.body), { error: 'usage-report-failed' });
  assert.equal(countLines(countFile).length, 1, 'stub actually ran');
  assert.ok(!res.body.includes(STDERR_SENTINEL));
  assert.ok(!res.body.includes(STUB));
  assert.ok(!res.body.includes(project));
});

test('garbage mode returns 500 usage-report-failed', async () => {
  const { port } = await usageServer('garbage');
  const res = await request(port, 'GET', '/api/usage');
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.body), { error: 'usage-report-failed' });
});

test('array mode returns 500 usage-report-failed', async () => {
  const { port } = await usageServer('array');
  const res = await request(port, 'GET', '/api/usage');
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.body), { error: 'usage-report-failed' });
});

test('slow mode times out to 500 usage-report-failed (takes ~16 s)', { timeout: 40000 }, async () => {
  const { port } = await usageServer('slow');
  const started = Date.now();
  const res = await request(port, 'GET', '/api/usage');
  const elapsed = Date.now() - started;
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.body), { error: 'usage-report-failed' });
  assert.ok(elapsed >= 14000 && elapsed < 19500, 'failed at the server timeout, got ' + elapsed + ' ms');
});

test('caching and single-flight: concurrent plus in-TTL requests run the stub once', async () => {
  const { port, countFile } = await usageServer('');
  const [a, b] = await Promise.all([request(port, 'GET', '/api/usage'), request(port, 'GET', '/api/usage')]);
  const c = await request(port, 'GET', '/api/usage');
  for (const res of [a, b, c]) {
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), expectedReport);
  }
  assert.equal(countLines(countFile).length, 1);
});

test('no request data reaches the child: only --project <dir> is passed', async () => {
  const { port, countFile } = await usageServer('');
  const hostile = await request(port, 'GET', '/api/usage?project=/etc&x=$(id)');
  const plain = await request(port, 'GET', '/api/usage');
  assert.equal(hostile.status, 200);
  assert.equal(hostile.body, plain.body);
  const lines = countLines(countFile);
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), ['--project', project]);
});

test('POST, PUT, DELETE to /api/usage return 405; /api/usage/ and /api/usage/extra return 404', async () => {
  const { port, countFile } = await usageServer('');
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const res = await request(port, method, '/api/usage');
    assert.equal(res.status, 405, method);
  }
  for (const p of ['/api/usage/', '/api/usage/extra']) {
    const res = await request(port, 'GET', p);
    assert.equal(res.status, 404, p);
  }
  assert.equal(countLines(countFile).length, 0, 'rejected requests never ran the stub');
});

test('existing routes are unaffected: dashboard HTML, wiki file, traversal 403', async () => {
  const { port } = await usageServer('');
  const root = await request(port, 'GET', '/');
  assert.equal(root.status, 200);
  assert.match(root.headers['content-type'], /^text\/html/);
  assert.equal(root.body, fs.readFileSync(DASHBOARD, 'utf8'));

  const page = await request(port, 'GET', '/wiki/knowledge/page.md');
  assert.equal(page.status, 200);
  assert.equal(page.body, '# Page\n');

  for (const p of ['/wiki/../', '/wiki/../../etc/passwd', '/wiki/%2e%2e/']) {
    const res = await request(port, 'GET', p);
    assert.equal(res.status, 403, p);
  }
});

test('loopback only: accepts 127.0.0.1, refuses a non-loopback interface address', async (t) => {
  const { port } = await usageServer('');
  await new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.destroy();
      resolve();
    });
    sock.on('error', reject);
  });

  const src = fs.readFileSync(SERVER, 'utf8');
  assert.ok(src.includes("listen(port, '127.0.0.1'"), 'server must keep binding to 127.0.0.1');

  const external = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if ((a.family === 'IPv4' || a.family === 4) && !a.internal) external.push(a.address);
    }
  }
  if (external.length === 0) {
    t.skip('no non-internal IPv4 address on this host');
    return;
  }
  const outcome = await new Promise((resolve) => {
    const sock = net.connect({ port, host: external[0], timeout: 3000 });
    sock.on('connect', () => {
      sock.destroy();
      resolve('connected');
    });
    sock.on('timeout', () => {
      sock.destroy();
      resolve('timeout');
    });
    sock.on('error', (e) => resolve(e.code));
  });
  assert.notEqual(outcome, 'connected', 'server must not accept connections on ' + external[0]);
  assert.equal(outcome, 'ECONNREFUSED');
});

test('dashboard client contract: handles #/usage, calls /api/usage, innerHTML count unchanged', () => {
  const html = fs.readFileSync(DASHBOARD, 'utf8');
  assert.ok(html.includes('#/usage'), 'template links to #/usage');
  assert.ok(html.includes("view === 'usage'"), 'template routes the usage view');
  assert.ok(html.includes("fetch('/api/usage'"), 'template calls /api/usage');
  assert.equal(html.split('innerHTML').length - 1, 1, 'innerHTML occurrences (Step 3 baseline)');
});

test('read-only: the project dir holds nothing beyond what the test created', () => {
  assert.deepEqual(listTree(project), createdTree);
});

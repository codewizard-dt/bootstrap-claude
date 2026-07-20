---
id: UAT-012
title: "UAT: Build wiki-dashboard-server.js zero-dependency static file server"
status: passed
task: TASK-012
created: 2026-07-06
updated: 2026-07-06
---

# UAT-012 — UAT: Build wiki-dashboard-server.js zero-dependency static file server

implements::[[TASK-012]]

> **Source task**: [[TASK-012]]
> **Generated**: 2026-07-06

---

## Prerequisites

- [ ] Node.js is installed and on `PATH` (`node` runs).
- [ ] Commands are run from the project root `/Users/davidtaylor/Repositories/bootstrap-claude` (so `lib/scripts/wiki-dashboard-server.js` and a populated `wiki/` tree both resolve).
- [ ] Test ports 4381–4389 are free (each test spawns its own short-lived server child and kills it on exit).

Every test below is **self-contained**: it spawns the server as a child process on a dedicated port, makes one request (or inspects the file), asserts, prints `PASS`/`FAIL`, kills the child, and exits with code 0 (pass) or 1 (fail). No server needs to be started by hand and none is left running.

---

## Test Cases

### UAT-STATIC-001: Syntax check passes (node --check)
- **Description**: The delivered script is valid JavaScript that parses cleanly — the cheapest deterministic gate.
- **Steps**:
  1. Run the command below as-is.
- **Command**:
  ```bash
  node --check lib/scripts/wiki-dashboard-server.js
  ```
- **Expected Result**: Exit code 0, no output. Non-zero exit or a `SyntaxError` is a fail.
- **Repeatable Unit Test**: Not applicable: this case *is* the deterministic repeatable check (no framework needed).
- [x] Pass <!-- 2026-07-06 -->

### UAT-STATIC-002: Executable bit and shebang present
- **Description**: The file has the executable permission bit and a `#!/usr/bin/env node` shebang, so `bin/cli.js` can invoke it via `execFileSync(scriptPath, args)`.
- **Steps**:
  1. Run the command below as-is.
- **Command**:
  ```bash
  node -e "const fs=require('fs');const f='lib/scripts/wiki-dashboard-server.js';const st=fs.statSync(f);const first=fs.readFileSync(f,'utf8').split('\n')[0];const ok=(st.mode&0o111)!==0&&first==='#!/usr/bin/env node';console.log(ok?'PASS':'FAIL: mode='+(st.mode&0o777).toString(8)+' shebang='+JSON.stringify(first));process.exit(ok?0:1)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. The file mode has at least one execute bit set and the first line is exactly `#!/usr/bin/env node`.
- **Repeatable Unit Test**: Not applicable: this case *is* the deterministic repeatable check (filesystem metadata, no framework needed).
- [x] Pass <!-- 2026-07-06 -->

### UAT-CLI-001: Server starts on default port 4317 and logs the bound URL
- **Description**: With no args the server binds the default port and prints `Wiki dashboard server running at http://localhost:<port>` on successful bind.
- **Steps**:
  1. Run the command below as-is. It starts the server with no args, captures stdout for ~800ms, then kills it.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js']);let o='';s.stdout.on('data',d=>o+=d);setTimeout(()=>{s.kill();const ok=/Wiki dashboard server running at http:\/\/localhost:\d+/.test(o);console.log(ok?'PASS':'FAIL: '+JSON.stringify(o));process.exit(ok?0:1)},800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. Startup log matches `Wiki dashboard server running at http://localhost:<port>` (port is 4317 unless it was already taken and fell back).
- **Repeatable Unit Test**: Not applicable: requires spawning the real server process (integration-level, not pure logic).
- [x] Pass <!-- 2026-07-06 -->

### UAT-CLI-002: Custom port via --port is honored
- **Description**: `--port <n>` binds the server on the requested port; a request to that port serves a real wiki file.
- **Steps**:
  1. Run the command below as-is. It starts the server with `--port 4386`, requests `/wiki/index.md`, then kills it.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process'),http=require('http');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4386'],{stdio:'ignore'});const done=(ok,m)=>{s.kill();console.log(ok?'PASS':'FAIL: '+m);process.exit(ok?0:1)};setTimeout(()=>http.get('http://localhost:4386/wiki/index.md',r=>done(r.statusCode===200,'status='+r.statusCode)).on('error',e=>done(false,e.message)),800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. HTTP 200 returned from port 4386, proving `--port` was applied.
- **Repeatable Unit Test**: Not applicable: requires spawning the real server process on a chosen port (integration-level).
- [x] Pass <!-- 2026-07-06 -->

### UAT-CLI-003: Port fallback on EADDRINUSE binds the next port
- **Description**: When the requested port is occupied, the server retries `port + 1`. Two instances asked for the same port must land on `N` and `N+1`.
- **Steps**:
  1. Run the command below as-is. It starts one server on `--port 4387`, then a second also on `--port 4387`; the second must log `4388`.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process');const a=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4387'],{stdio:'ignore'});setTimeout(()=>{const b=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4387']);let o='';b.stdout.on('data',d=>o+=d);setTimeout(()=>{a.kill();b.kill();const ok=/running at http:\/\/localhost:4388/.test(o);console.log(ok?'PASS':'FAIL: '+JSON.stringify(o));process.exit(ok?0:1)},900)},700)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. The second instance's log contains `running at http://localhost:4388` (it fell back from the occupied 4387).
- **Repeatable Unit Test**: Not applicable: requires two live server processes contending for a port (integration-level).
- [x] Pass <!-- 2026-07-06 -->

### UAT-API-001: Serve a wiki markdown file with no-cache headers and text/markdown content-type
- **Endpoint**: `GET /wiki/index.md`
- **Description**: The core use case — the dashboard client `fetch()`es family index files. Every response must carry `Cache-Control: no-store`, `Pragma: no-cache`, `Expires: 0`, and `.md` must map to `text/markdown`.
- **Steps**:
  1. Run the command below as-is. It serves `/wiki/index.md` on port 4381 and inspects status + headers.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process'),http=require('http');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4381'],{stdio:'ignore'});const done=(ok,m)=>{s.kill();console.log(ok?'PASS':'FAIL: '+m);process.exit(ok?0:1)};setTimeout(()=>http.get('http://localhost:4381/wiki/index.md',r=>{const h=r.headers;done(r.statusCode===200&&h['cache-control']==='no-store'&&h['pragma']==='no-cache'&&h['expires']==='0'&&h['content-type']==='text/markdown','status='+r.statusCode+' ct='+h['content-type']+' cc='+h['cache-control']+' pragma='+h['pragma']+' expires='+h['expires'])}).on('error',e=>done(false,e.message)),800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. HTTP 200; headers `cache-control: no-store`, `pragma: no-cache`, `expires: 0`, `content-type: text/markdown`.
- **Repeatable Unit Test**: Blocked: the content-type/header logic (`contentType`, `noCacheHeaders`) is pure but the module exports nothing and calls `listen()` at import time; unit-testing it would need a source refactor (add `module.exports` + a `require.main === module` guard) that is out of TASK-012's scope, and the repo has no JS test runner (`package.json` `test` is a placeholder).
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-001: Missing wiki file returns 404
- **Scenario**: A request for a wiki path that does not exist on disk.
- **Steps**:
  1. Run the command below as-is. It requests a non-existent markdown file under `/wiki/`.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process'),http=require('http');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4382'],{stdio:'ignore'});const done=(ok,m)=>{s.kill();console.log(ok?'PASS':'FAIL: '+m);process.exit(ok?0:1)};setTimeout(()=>http.get('http://localhost:4382/wiki/work/tasks/this-file-does-not-exist.md',r=>done(r.statusCode===404,'status='+r.statusCode)).on('error',e=>done(false,e.message)),800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. HTTP 404 for the missing file.
- **Repeatable Unit Test**: Not applicable: requires a live server + real filesystem lookup (integration-level).
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-002: Path-traversal attempt returns 403
- **Scenario**: An encoded `../` escape that resolves outside the `wiki/` root (targeting `package.json` at the project root) must be rejected before any filesystem read.
- **Steps**:
  1. Run the command below as-is. It sends the raw request-target `/wiki/%2e%2e/package.json` (encoded `..`, so the HTTP client does not normalize it away); the server decodes and detects the escape.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process'),http=require('http');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4383'],{stdio:'ignore'});const done=(ok,m)=>{s.kill();console.log(ok?'PASS':'FAIL: '+m);process.exit(ok?0:1)};setTimeout(()=>http.request({host:'localhost',port:4383,path:'/wiki/%2e%2e/package.json',method:'GET'},r=>done(r.statusCode===403,'status='+r.statusCode)).on('error',e=>done(false,e.message)).end(),800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. HTTP 403 Forbidden; `package.json` is never served.
- **Repeatable Unit Test**: Blocked: the traversal check is pure logic but unreachable in isolation (module self-binds on import, exports nothing) and the repo has no JS test harness; testing it requires a source refactor out of TASK-012 scope.
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-003: Non-GET method returns 405
- **Scenario**: The server is read-only; any non-GET verb must be rejected.
- **Steps**:
  1. Run the command below as-is. It issues a POST to a valid wiki path.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process'),http=require('http');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4384'],{stdio:'ignore'});const done=(ok,m)=>{s.kill();console.log(ok?'PASS':'FAIL: '+m);process.exit(ok?0:1)};setTimeout(()=>http.request({host:'localhost',port:4384,path:'/wiki/index.md',method:'POST'},r=>done(r.statusCode===405,'status='+r.statusCode)).on('error',e=>done(false,e.message)).end(),800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. HTTP 405 Method Not Allowed.
- **Repeatable Unit Test**: Not applicable: requires a live server to exercise the HTTP method branch (integration-level).
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-004: Dashboard route serves dashboard.html at `/`
- **Scenario**: `dashboard.html` (built by TASK-013) now exists. Requesting `/` must serve it as `200 text/html` with the no-cache headers applied.
- **Steps**:
  1. Run the command below as-is. It requests `/` and confirms `200` + `content-type: text/html` + `cache-control: no-store`.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process'),http=require('http');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4385'],{stdio:'ignore'});const done=(ok,m)=>{s.kill();console.log(ok?'PASS':'FAIL: '+m);process.exit(ok?0:1)};setTimeout(()=>http.get('http://localhost:4385/',r=>done(r.statusCode===200&&r.headers['content-type']==='text/html'&&r.headers['cache-control']==='no-store','status='+r.statusCode+' ct='+r.headers['content-type']+' cc='+r.headers['cache-control'])).on('error',e=>done(false,e.message)),800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. HTTP 200 with `content-type: text/html` and `cache-control: no-store`; the dashboard client is served.
- **Note**: Retargeted at run time from the graceful-404 branch to the present-file branch because TASK-013 (`parallel_safe_with` TASK-012) landed `lib/scripts/templates/wiki/dashboard.html` (24 KB) concurrently. The graceful-404-when-absent branch was validated during TASK-012 implementation; with the file now present, serving it correctly at `/` is the primary requirement and is what this case verifies.
- **Repeatable Unit Test**: Not applicable: requires a live server serving the real dashboard.html (integration-level).
- [x] Pass <!-- 2026-07-06 -->

### UAT-EDGE-005: Directory request under /wiki returns 404
- **Scenario**: Only files are served; a request whose resolved path is a directory (e.g. `/wiki/work`) must 404 rather than list or 500.
- **Steps**:
  1. Run the command below as-is. It requests a known directory path under `/wiki/`.
- **Command**:
  ```bash
  node -e "const {spawn}=require('child_process'),http=require('http');const s=spawn('node',['lib/scripts/wiki-dashboard-server.js','--port','4389'],{stdio:'ignore'});const done=(ok,m)=>{s.kill();console.log(ok?'PASS':'FAIL: '+m);process.exit(ok?0:1)};setTimeout(()=>http.get('http://localhost:4389/wiki/work',r=>done(r.statusCode===404,'status='+r.statusCode)).on('error',e=>done(false,e.message)),800)"
  ```
- **Expected Result**: Prints `PASS`, exit 0. HTTP 404 for the directory path (`stats.isFile()` is false).
- **Repeatable Unit Test**: Not applicable: requires a live server + real filesystem stat (integration-level).
- [x] Pass <!-- 2026-07-06 -->

---

## Coverage Notes / Gaps

- **Content-type map for `.html` and `.json`, and the `text/plain` default**: not directly exercised because the served `wiki/` tree contains only `.md` files. `.md → text/markdown` is covered (UAT-API-001); `.html` is covered indirectly once TASK-013's dashboard.html exists (UAT-EDGE-004 note). A dedicated `.json`/default-`text/plain` test would need a non-`.md` fixture placed under `wiki/`, which this task does not introduce.
- **`400 Bad Request` on malformed percent-encoding**: implemented (`decodeURIComponent` throw path) but not covered — reliably sending a request-target that survives the HTTP client yet fails `decodeURIComponent` is brittle to script portably; deferred to the TASK-017 manual pass.
- **Unit-test promotion blocked at source**: `parseArgs`, `contentType`, `noCacheHeaders`, and the traversal check are pure and would make ideal fast unit tests, but the module exports nothing and calls `listen()` at import time, and the repo has no JS test runner. Promoting them needs a small source refactor (`module.exports` + `require.main === module` guard) that is out of TASK-012's scope — recommend filing as a follow-up so these become framework-level unit tests.
<!-- Renumbered: 2026-07-06 — was UAT-001/TASK-001, collided with the pre-existing archived ROADMAP-001 UAT-001/TASK-001. Renumbered to UAT-012/TASK-012. -->

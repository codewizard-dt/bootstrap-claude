Scaffold the deployment infrastructure described in the guide above for the project at: __PROJECT_DIR__

## Your task

Inspect the project's structure (directory layout, existing Dockerfiles, package.json/pyproject.toml/go.mod, existing Makefile, existing docker-compose files), then create or update the files listed below using real project values — never placeholder strings like `<ORG>`, `<PROJECT>`, or `<LABEL>`.

**If you cannot confidently identify the services, their entrypoints, or their runtimes from the files you find, stop and ask the user before creating anything.**

---

### Step 1 — Detect services

Identify each deployable service by scanning for directories (or the repo root for single-service repos) that contain any of:

- `package.json` — Node.js. Check `scripts.dev` / `scripts.start` for the dev command and inspect `dependencies` to identify the framework: Vite, Next.js, Express, Fastify, etc.
- `pyproject.toml` or `requirements.txt` — Python. Check dependencies for `fastapi`/`uvicorn`, `flask`, `django`, etc.
- `go.mod` — Go.
- `Cargo.toml` — Rust.

For each service record: **runtime · framework · dev command · port · whether it proxies to another service**.

---

### Step 2 — Create or update files

#### 1. `.github/workflows/security.yml` — always overwrite
Generic; no project-specific content. Include:
- **CodeQL** — matrix over the detected languages (use `python`, `javascript-typescript`, `go`, etc. as appropriate)
- **Gitleaks** secret detection with `fetch-depth: 0`

#### 2. `.github/workflows/build.yml` — create or overwrite with confirmation
Fill in real image names, Dockerfile paths, and runner label. If the file already exists, show the user what you plan to write and ask for confirmation before overwriting.

#### 3. `.gitleaks.toml` — create or overwrite with confirmation
If the file already exists, show the user what you plan to write and ask for confirmation before overwriting.

#### 4. `Makefile` — merge Docker targets if a Makefile already exists; create from scratch if not
Add only the targets from the guide that are not already present. Never remove or reformat existing targets.
Set `GITHUB_USER ?= $(shell gh api user --jq .login 2>/dev/null)` so auth resolves at runtime rather than being hardcoded.

The deploy targets **must** use this exact shape (copy verbatim, substituting the real `$(PROJECT)` variable name):

```makefile
## deploy — sync compose file + Makefile to VPS then restart
deploy: deploy-sync
	ssh $(PROJECT) "cd /opt/$(PROJECT) && make deploy-pull"

deploy-sync:
	ssh $(PROJECT) "mkdir -p /opt/$(PROJECT)"
	scp docker-compose.yml Makefile $(PROJECT):/opt/$(PROJECT)/
	scp .env.production $(PROJECT):/opt/$(PROJECT)/.env
	scp lib/scripts/setup-runner.sh $(PROJECT):~/setup-runner.sh

## setup-runner — upload and run the runner installer on the VPS
## Usage: make setup-runner RUNNER_TOKEN=<token>
setup-runner: deploy-sync
	ssh $(PROJECT) "RUNNER_TOKEN=$(RUNNER_TOKEN) REPO_URL=$(REPO_URL) bash ~/setup-runner.sh"

## deploy-pull — pull new images and restart (run directly on the VPS)
deploy-pull: up
```

#### 5. `docker-compose.yml` — create or overwrite with confirmation

If the file already exists, show the user what you plan to write and ask for confirmation before overwriting. Production-style compose file. **Hard rules:**
- Every service **must** use a pre-built GHCR image (`image: ghcr.io/<org>/<project>-<service>:latest`).
- **No `build:` blocks** — image building belongs exclusively in `docker-compose.build.yml` and the CI workflow.
- Set realistic `healthcheck`, `restart: unless-stopped`, and environment variables with sane defaults.
- Declare named volumes for any stateful services (databases, caches).

#### 6. `docker-compose.build.yml` — create or overwrite with confirmation

If the file already exists, show the user what you plan to write and ask for confirmation before overwriting.
Local dev overlay. Layered on top of `docker-compose.yml` via:
```
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build --wait
```
For each service:
- Add a `build:` block pointing to the service directory and its `Dockerfile.dev`
- Bind-mount the full source tree into the working directory (e.g. `./backend:/app`)
- **Shield installed dependencies with an anonymous volume** declared immediately after the source mount. This prevents the host bind mount from overwriting the container's installed packages:
  - Node.js: `- /app/node_modules`
  - Python venv: `- /app/.venv`
  - Add others (e.g. `/app/.cargo`) for any runtime that installs into a subdirectory
- **Override service URLs that hardcode `localhost`**: inside Docker, `localhost` resolves to the container itself. Replace with the compose service name (e.g. `DATABASE_URL: postgresql+asyncpg://postgres:postgres@db:5432/mydb`)
- **Vite / Node frontend proxy targets**: Vite's dev-server proxy runs server-side (Node.js), so its `target` also can't use `localhost` to reach the backend container. Pass the backend address via an env var in the compose service (e.g. `PROXY_TARGET: http://backend:8000`) and update `vite.config.ts` to read it:
  ```ts
  target: process.env.PROXY_TARGET ?? 'http://localhost:8000',
  ```
- **Vite `--host` flag**: the Vite dev server binds to `127.0.0.1` by default and is unreachable via Docker port mapping. Override the container command: `command: npx vite --host` (do not bake `--host` into the Dockerfile so the image stays usable outside Docker)
- Wire `depends_on` with `condition: service_healthy` for any service that requires the database to be ready before starting

#### 7. `Dockerfile.dev` + `docker-entrypoint.sh` per service — create or overwrite with confirmation

If any of these files already exist, show the user what you plan to write and ask for confirmation before overwriting.
Minimal, fast-to-build dev image. The guiding principle: **install dependencies in the image; let source arrive via the bind mount at runtime**.

**Use a `docker-entrypoint.sh` watcher script** for Node.js and Python services so that adding or removing a dependency inside the container is not needed — the entrypoint watches the manifest file for changes and automatically reinstalls + restarts the dev server. This makes the developer workflow seamless: edit `package.json` or `pyproject.toml` on the host, save, and the container self-heals.

**Node.js entrypoint pattern** (`docker-entrypoint.sh`, place alongside `Dockerfile.dev`):
```sh
#!/bin/sh
set -e

npm install

HASH=$(md5sum package.json | cut -d' ' -f1)
APP_PID=""

start_app() {
  npx vite --host &   # or: npm run dev &, npx ts-node-dev src/index.ts &, etc.
  APP_PID=$!
}

stop_app() {
  if [ -n "$APP_PID" ]; then
    kill "$APP_PID" 2>/dev/null
    wait "$APP_PID" 2>/dev/null || true
    APP_PID=""
  fi
}

start_app

while sleep 3; do
  NEW=$(md5sum package.json | cut -d' ' -f1)
  if [ "$NEW" != "$HASH" ]; then
    echo "[entrypoint] package.json changed — reinstalling..."
    npm install
    HASH=$NEW
    stop_app
    start_app
  fi
done
```

**Python entrypoint pattern** (`docker-entrypoint.sh`):
```sh
#!/bin/sh
set -e

pip install -e ".[dev]" --quiet   # or: pip install -r requirements.txt --quiet

MANIFEST=${MANIFEST_FILE:-pyproject.toml}   # override to requirements.txt if needed
HASH=$(md5sum "$MANIFEST" | cut -d' ' -f1)
APP_PID=""

start_app() {
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &   # adjust module path
  APP_PID=$!
}

stop_app() {
  if [ -n "$APP_PID" ]; then
    kill "$APP_PID" 2>/dev/null
    wait "$APP_PID" 2>/dev/null || true
    APP_PID=""
  fi
}

start_app

while sleep 3; do
  NEW=$(md5sum "$MANIFEST" | cut -d' ' -f1)
  if [ "$NEW" != "$HASH" ]; then
    echo "[entrypoint] $MANIFEST changed — reinstalling..."
    pip install -e ".[dev]" --quiet
    HASH=$NEW
    stop_app
    start_app
  fi
done
```

The `Dockerfile.dev` copies and `chmod +x`s the entrypoint, then sets it as `CMD`:

- **Node.js frontend (Vite / CRA / Next dev mode)**: `FROM node:22-alpine`, `COPY package*.json ./`, `RUN npm ci`, `COPY docker-entrypoint.sh ./`, `RUN chmod +x docker-entrypoint.sh`, `CMD ["/bin/sh", "./docker-entrypoint.sh"]`. Do not `COPY` source. Adjust the `start_app` command in the entrypoint for the framework (Vite uses `--host` in the entrypoint; remove the compose `command:` override for Vite if using the entrypoint).
- **Node.js backend (Express / Fastify / etc.)**: same Dockerfile pattern; update `start_app` in the entrypoint to run the server with hot-reload (e.g. `node --watch src/index.js` or `npx ts-node-dev src/index.ts`).
- **Python (FastAPI/uvicorn)**: `FROM python:3.11-slim`, copy the manifest (`pyproject.toml` or `requirements.txt`), install deps, copy and `chmod +x` the entrypoint, set `CMD` to run it. Adjust the uvicorn module path (`app.main:app`) and install command to match the project. Do not `COPY` source.
- **Go**: `FROM golang:1.22-alpine`, copy `go.mod` + `go.sum`, `RUN go mod download`, `CMD ["go", "run", "./cmd/server"]` (adjust path). Use `air` for hot-reload if the project already depends on it. No entrypoint watcher needed — Go has no install-time manifest changes that require a restart.
- **Other runtimes**: apply the same principle — install deps in the image; source arrives via bind mount; dev server runs with hot-reload; add an entrypoint watcher if the runtime has a lockfile-driven install step.

#### 8. Caddy reverse proxy — create or overwrite with confirmation

If any Caddy files already exist, show the user what you plan to write and ask for confirmation before overwriting. Add Caddy when the project has **both a frontend and a backend service** (i.e. two separate containers that need to be served under a single domain). Skip this section for single-service projects or projects that already have a reverse proxy configured.

**`Dockerfile.caddy`**
```dockerfile
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
```

**`Caddyfile`** (production — uses real domain, TLS handled automatically by Caddy):
```
<domain> {
    handle /api/* {
        reverse_proxy backend:<backend-port>
    }
    handle {
        reverse_proxy frontend:<frontend-port>
    }
}
```
- Replace `<domain>` with the project's real domain (e.g. `myapp.example.com`)
- Replace `backend:<backend-port>` with the compose service name and port (e.g. `backend:8000`)
- Replace `frontend:<frontend-port>` with the compose service name and port (e.g. `frontend:80`)
- Add additional `handle` blocks if the project has more routing rules

**`Caddyfile.local`** (local dev — plain HTTP on port 80, same routing, no TLS):
```
:80 {
    handle /api/* {
        reverse_proxy backend:<backend-port>
    }
    handle {
        reverse_proxy frontend:<frontend-port>
    }
}
```

**Integrate Caddy into compose files** — for each file, if a `caddy` entry already exists show the user the planned change and ask for confirmation before overwriting:
- In `docker-compose.yml`: add a `caddy` service using the GHCR image (`ghcr.io/<org>/<project>-caddy:latest`), ports `80:80` and `443:443`, and named volumes `caddy_data` and `caddy_config`.
- In `docker-compose.build.yml`: add a `caddy` override with `build: { context: ., dockerfile: Dockerfile.caddy }` and bind-mount `./Caddyfile.local:/etc/caddy/Caddyfile`.
- In `.github/workflows/build.yml`: add `caddy` to the build matrix.

---

### Step 3 — Provision the DigitalOcean droplet and GitHub Actions runner

#### 3a. Check for an existing droplet

Look for `DROPLET_IP` in the Makefile (search for the literal string `DROPLET_IP`).

- **If `DROPLET_IP` is already set** — a droplet exists. Skip to **3c** (runner setup).
- **If `DROPLET_IP` is absent** — proceed to **3b**.

#### 3b. Size and create the droplet

**Assess the appropriate droplet size** by examining what the project runs:

| Signal | Minimum slug |
|--------|-------------|
| Single static site or tiny API | `s-1vcpu-1gb` |
| One or two lightweight services (Node/Python) | `s-1vcpu-2gb` |
| Two or more services with a database | `s-2vcpu-4gb` |
| ML inference, heavy background workers, or 3+ services | `s-4vcpu-8gb` |

Then ask the user to confirm the size before creating anything.

Once confirmed, create the droplet with `doctl`:

```bash
doctl compute droplet create <project>-runner \
  --region nyc3 \
  --image ubuntu-24-04-x64 \
  --size <confirmed-slug> \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header | paste -sd,) \
  --wait \
  --format PublicIPv4 \
  --no-header
```

Record the returned IP as `DROPLET_IP`.

**Apply the general-web firewall** (the firewall named `general-web`):

```bash
FIREWALL_ID=$(doctl compute firewall list --format ID,Name --no-header | awk '/general-web/{print $1}')
DROPLET_ID=$(doctl compute droplet list --format ID,Name --no-header | awk '/<project>-runner/{print $1}')
doctl compute firewall add-droplets "$FIREWALL_ID" --droplet-ids "$DROPLET_ID"
```

**Write `DROPLET_IP` into the Makefile** immediately after the `GITHUB_USER` line:

```makefile
DROPLET_IP ?= <ip>
```

**Register the SSH alias** so subsequent `make ssh` and `make deploy` targets resolve the host:

```bash
make ssh-alias DROPLET_IP=<ip>
```

#### 3c. Walk the user through runner setup

Provide the following steps as a numbered checklist. Substitute real values — never leave placeholders.

1. **SSH into the droplet and install Docker + `gh` CLI** (if not already present):
   ```bash
   ssh root@<DROPLET_IP>
   curl -fsSL https://get.docker.com | sh && systemctl enable --now docker
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
     | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
     https://cli.github.com/packages stable main" \
     | tee /etc/apt/sources.list.d/github-cli.list > /dev/null
   apt update && apt install gh -y
   ```

2. **Get a runner registration token** — GitHub → repo → **Settings → Actions → Runners → New self-hosted runner** (Linux x64) and copy the `--token` value.

3. **From the local project root**, run:
   ```bash
   make setup-runner RUNNER_TOKEN=<TOKEN>
   ```
   This uploads `setup-runner.sh` to the VPS and runs it — creating the `runner` user, registering the runner, and starting it as a systemd service.

4. **Verify** the runner appears as **Idle** at:
   `<REPO_URL>/settings/actions/runners`

---

### Deriving the GHCR org/repo slug

Priority order:
1. `name` field in `package.json` or `pyproject.toml` — strip service-specific suffixes (`-backend`, `-frontend`, `-api`) to recover the project base name
2. GitHub remote URL (`git remote get-url origin`) — owner becomes the org; combine with the base name above or the directory name
3. Project directory name as a last resort

Image naming convention: `ghcr.io/<org>/<project>-<service>`
Examples: `ghcr.io/acme/myapp-backend`, `ghcr.io/acme/myapp-frontend`

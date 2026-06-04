#!/usr/bin/env bash
# Setup script for GitHub Actions self-hosted runner on the Jarvis droplet.
# Must be run as root.
#
# Usage:
#   RUNNER_TOKEN=<token> bash .scripts/setup-runner.sh
#
# Get the token from:
#   GitHub → repo → Settings → Actions → Runners → New self-hosted runner (Linux x64)

set -euo pipefail

RUNNER_VERSION="2.331.0"
RUNNER_DIR="/opt/actions-runner"
RUNNER_USER="runner"
REPO_URL="https://github.com/codewizard-dt/jarvis"
RUNNER_LABEL="droplet"

: "${RUNNER_TOKEN:?RUNNER_TOKEN env var is required}"

echo "==> Creating runner user '${RUNNER_USER}'"
id "${RUNNER_USER}" &>/dev/null || useradd -m -G docker "${RUNNER_USER}"

echo "==> Creating runner directory at ${RUNNER_DIR}"
mkdir -p "${RUNNER_DIR}"

echo "==> Downloading GitHub Actions runner v${RUNNER_VERSION}"
curl -fsSL -o "${RUNNER_DIR}/runner.tar.gz" \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar xzf "${RUNNER_DIR}/runner.tar.gz" -C "${RUNNER_DIR}"
rm "${RUNNER_DIR}/runner.tar.gz"

echo "==> Setting ownership of ${RUNNER_DIR} and /opt/jarvis"
chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}" /opt/jarvis

echo "==> Configuring runner as '${RUNNER_USER}'"
su - "${RUNNER_USER}" -c "cd ${RUNNER_DIR} && ./config.sh \
  --url ${REPO_URL} \
  --token ${RUNNER_TOKEN} \
  --name jarvis-droplet \
  --labels ${RUNNER_LABEL} \
  --work ${RUNNER_DIR}/_work \
  --unattended \
  --replace"

echo "==> Installing runner as a systemd service (runs as '${RUNNER_USER}')"
cd "${RUNNER_DIR}"
./svc.sh install "${RUNNER_USER}"
./svc.sh start

echo "==> Runner status"
systemctl status "actions.runner.*.service" --no-pager || true

echo ""
echo "Done. The runner is registered and running as '${RUNNER_USER}'."
echo "Verify at: ${REPO_URL}/settings/actions/runners"
echo ""
echo "Next: authenticate Docker with GHCR as the runner user:"
echo "  su - ${RUNNER_USER} -c \"gh auth token | docker login ghcr.io -u codewizard-dt --password-stdin\""
echo "  # or with a PAT:"
echo "  su - ${RUNNER_USER} -c \"echo <PAT> | docker login ghcr.io -u codewizard-dt --password-stdin\""

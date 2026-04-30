FROM ghcr.io/codewizard-dt/tmux-conductor-base:latest

# The base image (ghcr.io/codewizard-dt/tmux-conductor-base) already provides:
#   - apt packages: curl ca-certificates git sudo nodejs npm python3 python3-venv rsync jq vim chromium
#   - non-root `conductor` user
#   - Claude Code CLI (~/.local/bin/claude)
#   - uv (~/.cargo/bin/uv)
# See https://github.com/codewizard-dt/tmux-conductor/blob/main/Dockerfile.base

# Copy init script that seeds ~/.claude config from host copy (or generates defaults)
COPY --chown=conductor:conductor init-claude-config.sh /home/conductor/init-claude-config.sh
USER conductor
RUN chmod +x /home/conductor/init-claude-config.sh

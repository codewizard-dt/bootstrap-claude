# Fresh-machine test harness base image for `npx @codewizard-dt/bootstrap setup`/`update`.
# Generic only — never bakes in this repo (bind-mounted by run.sh at run time), so it stays valid across branches without rebuilding.
FROM ubuntu:24.04

ARG NODE_VERSION=24

# --- OS-level foundational packages (root) ---
# sudo: Homebrew installer needs root for /home/linuxbrew even as non-root tester. rsync: needed by install-global.sh's hooks install.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        build-essential \
        gnupg \
        sudo \
        rsync \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js via NodeSource setup script (root) ---
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Claude Code CLI (root, needs write access to the global npm prefix) ---
RUN npm install -g @anthropic-ai/claude-code

# --- Non-root user (mirrors a real fresh developer machine; required by Homebrew below) ---
# Passwordless sudo so the Homebrew installer (run as tester) can create /home/linuxbrew.
RUN useradd --create-home --shell /bin/bash tester \
    && echo "tester ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/tester \
    && chmod 0440 /etc/sudoers.d/tester

# --- Neutral workdir, owned by tester up front so run.sh can create scratch-project without a permissions workaround ---
RUN mkdir -p /workspace && chown tester:tester /workspace

USER tester
WORKDIR /home/tester

# --- uv, installed as the non-root user ---
ENV PATH="/home/tester/.local/bin:${PATH}"
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# --- Homebrew, installed as the non-root user (its installer refuses to run as root) ---
ENV PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:${PATH}"
RUN /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

WORKDIR /workspace
CMD ["bash"]

#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get upgrade -y

# Zsh
apt-get install -y zsh curl make

# Docker
apt-get install -y ca-certificates gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

# Oh My Zsh — install for root (skip if already installed)
if [[ ! -d /root/.oh-my-zsh ]]; then
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi
chsh -s "$(which zsh)" root

# Add non-root user to docker group if one exists (skip root)
DEFAULT_USER=$(getent passwd 1000 | cut -d: -f1 || true)
if [[ -n "$DEFAULT_USER" ]]; then
  usermod -aG docker "$DEFAULT_USER"
  chsh -s "$(which zsh)" "$DEFAULT_USER"
  # Oh My Zsh for the non-root user (skip if already installed)
  USER_HOME=$(getent passwd "$DEFAULT_USER" | cut -d: -f6)
  if [[ ! -d "$USER_HOME/.oh-my-zsh" ]]; then
    su -c 'sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended' "$DEFAULT_USER"
  fi
fi

echo "Done — docker $(docker --version), gh $(gh --version | head -1), zsh $(zsh --version)"

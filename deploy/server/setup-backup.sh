#!/usr/bin/env bash
# Install or update the daily production backup timer. Run as root on the server.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

src=$(cd "$(dirname "${BASH_SOURCE[0]}")/systemd" && pwd)
install -m 0644 "$src/personal-crm-backup.service" "$src/personal-crm-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now personal-crm-backup.timer
systemctl list-timers personal-crm-backup.timer

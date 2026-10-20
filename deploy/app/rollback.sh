#!/usr/bin/env bash
# Rolls the app back to the previous image. Nothing runs it automatically:
# on the server,  sudo -u deploy bash /home/deploy/personal-crm/rollback.sh
# Migrations are not undone: the previous image starts on the current database.
set -euo pipefail

cd "$(dirname "$0")"

previous=$(cat previous-image 2>/dev/null || true)
if [ -z "$previous" ]; then
  echo "No previous image recorded: nothing to roll back to." >&2
  exit 1
fi

echo "Rolling back from $(cat current-image) to $previous"
# The previous image is still on the server, so nothing is pulled.
exec bash deploy.sh "$previous" </dev/null

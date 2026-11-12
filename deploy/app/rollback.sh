#!/usr/bin/env bash
# Rolls the app back to the previous image. Nothing runs it automatically:
# on the server,
#   sudo -u deploy bash /home/deploy/personal-crm/deploy/app/rollback.sh
# It is a deploy of the previous image, so the database is backed up first.
# Migrations are not undone: the previous image starts on the current database.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

previous=$(cat previous-image 2>/dev/null || true)
if [ -z "$previous" ]; then
  echo "No previous image recorded: nothing to roll back to." >&2
  exit 1
fi

echo "Rolling back from $(cat current-image) to $previous"
# The previous image is still on the server, so nothing is pulled.
exec bash "$SCRIPTS_DIR/deploy.sh" "$previous" </dev/null

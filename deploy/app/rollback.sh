#!/usr/bin/env bash
# Rolls the app back to the previous image. Nothing runs it automatically:
# on the server,
#   sudo -u deploy bash /home/deploy/personal-crm/deploy/app/rollback.sh
# Production backs up the database first.
# Migrations are not undone: the previous image starts on the current database.
set -euo pipefail

exec bash "$(dirname "${BASH_SOURCE[0]}")/deploy.sh" "${1:-prod}" --rollback </dev/null

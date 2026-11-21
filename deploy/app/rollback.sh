#!/usr/bin/env bash
# Rolls staging back to its previous cached image. For production, use Deploy prod.
set -euo pipefail

if [ "${1:-}" != staging ]; then
  echo 'Usage: bash rollback.sh staging. For production, run Deploy prod with rollback checked.' >&2
  exit 1
fi
exec bash "$(dirname "${BASH_SOURCE[0]}")/deploy.sh" staging --rollback </dev/null

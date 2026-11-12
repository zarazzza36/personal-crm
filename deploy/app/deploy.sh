#!/usr/bin/env bash
# Deploys one image of the app on this server. GitHub Actions runs it after
# every push to main:
#   bash /home/deploy/personal-crm/deploy/app/deploy.sh <image> [<registry user>]
# When the image has to be pulled, a short-lived registry token comes on stdin.
#
# Steps: pull the image, back up the database (the file name carries the
# version that ran before this deploy), apply database migrations in a one-off
# container, start the new image, check https://app.volki-lzkv.ru/health.
# A failed step stops the deploy. Nothing is rolled back automatically:
# rollback.sh is run by hand. After a successful deploy only the current and
# the previous images of the app stay on the server.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

IMAGE=${1:?Usage: bash deploy.sh <image> [<registry user>]}
REGISTRY_USER=${2:-}
export CRM_IMAGE=$IMAGE

require_env

step "Image $IMAGE"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Already on the server"
else
  docker login ghcr.io --username "$REGISTRY_USER" --password-stdin
  pull_status=0
  docker pull --quiet "$IMAGE" || pull_status=$?
  # The token dies with the GitHub job anyway; do not keep it on disk.
  docker logout ghcr.io
  if [ "$pull_status" -ne 0 ]; then
    exit "$pull_status"
  fi
fi

current=$(cat current-image 2>/dev/null || true)

step "Database backup"
backup_database "$current"

step "Database migrations"
compose up --detach --wait crm-postgres
compose run --rm --no-TTY crm-migrate </dev/null

# From here on the new image replaces the running one, so it becomes the
# current image even if it fails to start: rollback.sh then returns to the one
# that ran before.
if [ "$current" != "$IMAGE" ]; then
  if [ -n "$current" ]; then
    echo "$current" >previous-image
  fi
  echo "$IMAGE" >current-image
fi

step "Starting the new image"
compose up --detach --wait --wait-timeout 120 crm-app

step "Smoke check: https://$APP_DOMAIN/health"
if ! smoke_check; then
  compose logs --tail 50 crm-app
  echo "Smoke check failed: the new image is running, but /health does not answer 200." >&2
  echo "Nothing was rolled back. To return to the previous image, run rollback.sh." >&2
  exit 1
fi

step "Keeping the current and the previous image"
keep=" $(cat current-image) $(cat previous-image 2>/dev/null || true) "
docker image ls "${IMAGE%:*}" --filter dangling=false --format '{{.Repository}}:{{.Tag}}' |
  while read -r image; do
    case "$keep" in
      *" $image "*) echo "keep   $image" ;;
      *)
        echo "remove $image"
        docker image rm "$image" >/dev/null
        ;;
    esac
  done

step "Deployed $IMAGE"

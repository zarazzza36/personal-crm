#!/usr/bin/env bash
# Deploys one image of the app on this server. GitHub Actions runs it after
# every push to main:  bash deploy.sh <image> [<registry user>]
# When the image has to be pulled, a short-lived registry token comes on stdin.
#
# Steps: pull the image, apply database migrations in a one-off container,
# start the new image, check https://app.volki-lzkv.ru/health. A failed step
# stops the deploy. Nothing is rolled back automatically: rollback.sh is run by
# hand. After a successful deploy only the current and the previous images of
# the app stay on the server.
set -euo pipefail

cd "$(dirname "$0")"

IMAGE=${1:?Usage: bash deploy.sh <image> [<registry user>]}
REGISTRY_USER=${2:-}
APP_DOMAIN=app.volki-lzkv.ru

step() { printf '\n==> %s\n' "$*"; }

# The landing's containers share the "prod" project: no warnings about them.
export COMPOSE_IGNORE_ORPHANS=1
compose() {
  CRM_IMAGE=$IMAGE docker compose --project-name prod --env-file .env --file compose.yaml "$@"
}

smoke_check() {
  local attempt code
  for attempt in 1 2 3 4 5; do
    code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 \
      --resolve "$APP_DOMAIN:443:127.0.0.1" "https://$APP_DOMAIN/health") || code=000
    echo "attempt $attempt: HTTP $code"
    if [ "$code" = 200 ]; then
      return 0
    fi
    sleep 3
  done
  return 1
}

if [ ! -f .env ]; then
  echo "No .env in $PWD: create it first, see README.md" >&2
  exit 1
fi
# Secrets: only the owner reads the file.
chmod 600 .env

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

step "Database migrations"
compose up --detach --wait crm-postgres
compose run --rm --no-TTY crm-migrate </dev/null

# From here on the new image replaces the running one, so it becomes the
# current image even if it fails to start: rollback.sh then returns to the one
# that ran before.
current=$(cat current-image 2>/dev/null || true)
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

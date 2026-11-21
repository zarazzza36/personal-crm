#!/usr/bin/env bash
# Deploys one image of the app on this server. GitHub Actions runs it:
#   bash deploy.sh <prod|staging> <image|--rollback> [<registry user>]
# When the image has to be pulled, a short-lived registry token comes on stdin.
#
# Pull the image, back up production, migrate in a one-off container, start the
# new image and check /health. Production rollback is started in Deploy prod.
set -euo pipefail

usage='Usage: bash deploy.sh <prod|staging> <image|--rollback> [<registry user>]'
DEPLOY_ENV=${1:?$usage}
IMAGE=${2:?$usage}
REGISTRY_USER=${3:-}
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

lock_environment
require_env
current=$(cat current-image 2>/dev/null || true)

if [ "$IMAGE" = --rollback ]; then
  IMAGE=$(cat previous-image 2>/dev/null || true)
  if [ -z "$IMAGE" ]; then
    echo "No previous image recorded: nothing to roll back to." >&2
    exit 1
  fi
  echo "Rolling back from $current to $IMAGE"
elif [ "$DEPLOY_ENV" = staging ] && [ "$IMAGE" = --restart ]; then
  # After restoring, keep the staging version if one is already installed.
  IMAGE=${current:-$(docker inspect --format '{{.Config.Image}}' prod-crm-app-1)}
fi
export CRM_IMAGE=$IMAGE

step "Image $IMAGE"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Already on the server"
else
  # Give each deployment its own registry credentials, even when both pull.
  (
    DOCKER_CONFIG=$(mktemp -d)
    export DOCKER_CONFIG
    trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
    docker login ghcr.io --username "$REGISTRY_USER" --password-stdin
    docker pull --quiet "$IMAGE"
  )
fi

if [ "$DEPLOY_ENV" = prod ]; then
  step "Database backup"
  backup_database "$current"
fi

step "Database migrations"
compose up --detach --wait crm-postgres
if [ "$DEPLOY_ENV" = staging ]; then
  seeded=$(compose exec -T crm-postgres sh -c '
    psql -XAt --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      -c "$1"' sh "SELECT to_regclass('public.contacts') IS NOT NULL" </dev/null)
  if [ "$seeded" != t ]; then
    echo "Staging needs a copy of the production database. Run restore-staging.sh first." >&2
    exit 1
  fi
fi
compose run --rm --no-TTY crm-migrate </dev/null

# From here on the new image replaces the running one, so it becomes the
# current image even if it fails to start: rollback then returns to the one
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
  echo 'Smoke check failed. See the rollback instructions in README.md.' >&2
  exit 1
fi

if [ "$DEPLOY_ENV" = prod ]; then
  step "Cleaning up old application images"
  (
    if [ -d "$STAGING_DIR" ]; then
      exec 8>"$STAGING_DIR/.deploy.lock"
      if ! flock --nonblock 8; then
        echo "Staging is busy; skipping image cleanup."
        exit 0
      fi
    fi
    previous=$(cat previous-image 2>/dev/null || true)
    staging=$(cat "$STAGING_DIR/current-image" 2>/dev/null || true)
    cutoff=$(date -d '14 days ago' +%s)
    docker image ls "${IMAGE%:*}" --filter dangling=false --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' |
      while read -r image created; do
        if [[ ! "${image##*:}" =~ ^[0-9a-f]{40}$ ]]; then
          continue
        fi
        if [ "$image" = "$IMAGE" ] || [ "$image" = "$previous" ] || [ "$image" = "$staging" ]; then
          continue
        fi
        created_at=$(date -d "${created% *}" +%s) || continue
        if [ "$created_at" -lt "$cutoff" ]; then
          docker image rm "$image" || true
        fi
      done || echo 'Warning: could not list application images for cleanup.' >&2
  )
fi

step "Deployed $IMAGE"
printf 'Deployed SHA: %s\n' "$(image_tag "$IMAGE")"

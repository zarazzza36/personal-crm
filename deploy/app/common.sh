# Shared by the deploy, backup and restore scripts.
#
# Each environment has its own .env, deploy/, lock and image state. Production
# stays in personal-crm with its existing Compose volume and backups.

SCRIPTS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPLOY_ENV=${DEPLOY_ENV:-prod}
DEPLOY_HOME=$(getent passwd deploy | cut -d: -f6)
PROD_DIR=$DEPLOY_HOME/personal-crm
STAGING_DIR=$DEPLOY_HOME/personal-crm-staging
case "$DEPLOY_ENV" in
  prod)
    APP_DIR=$PROD_DIR
    APP_DOMAIN=app.volki-lzkv.ru
    export CRM_PORT=3100 CRM_APP_MEMORY=0 CRM_DB_MEMORY=0 CRM_MIGRATE_MEMORY=0
    ;;
  staging)
    APP_DIR=$STAGING_DIR
    APP_DOMAIN=test-app.volki-lzkv.ru
    export CRM_PORT=3101 CRM_APP_MEMORY=384m CRM_DB_MEMORY=256m CRM_MIGRATE_MEMORY=256m
    ;;
  *) echo "Unknown environment: $DEPLOY_ENV" >&2; exit 1 ;;
esac
export BETTER_AUTH_URL="https://$APP_DOMAIN"
BACKUP_DIR=$APP_DIR/backups
BACKUPS_TO_KEEP=7

cd "$APP_DIR"
# Backups and state files hold personal data: only the owner reads them.
umask 077

step() { printf '\n==> %s\n' "$*"; }

# The landing's containers share the "prod" project: no warnings about them.
export COMPOSE_IGNORE_ORPHANS=1
# compose.yaml needs CRM_IMAGE: the caller exports it before the first call.
compose() {
  docker compose --project-name "$DEPLOY_ENV" --env-file "$APP_DIR/.env" \
    --file "$SCRIPTS_DIR/compose.yaml" "$@"
}

lock_environment() {
  exec 9>"$APP_DIR/.deploy.lock"
  flock 9
}

require_env() {
  if [ ! -f "$APP_DIR/.env" ]; then
    echo "No .env in $APP_DIR: create it first, see README.md" >&2
    exit 1
  fi
  # Secrets: only the owner reads the file.
  chmod 600 "$APP_DIR/.env"
}

# The tag of an image (its commit SHA), "none" when there is no image yet.
image_tag() {
  if [ -n "$1" ]; then
    echo "${1##*:}"
  else
    echo none
  fi
}

smoke_check() {
  local attempt code url
  local -a resolve=(--resolve "$APP_DOMAIN:443:127.0.0.1")
  url="https://$APP_DOMAIN/health"
  if [ "$DEPLOY_ENV" = staging ]; then
    # The public endpoint stays behind Basic Auth. Check the app on loopback
    # and verify HTTPS and the password challenge without using a password.
    code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 \
      "${resolve[@]}" "$url") || code=000
    echo "Protected HTTPS endpoint: HTTP $code (expected 401)"
    [ "$code" = 401 ] || return 1
    resolve=()
    url="http://127.0.0.1:$CRM_PORT/health"
  fi
  for attempt in 1 2 3 4 5; do
    code=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 \
      "${resolve[@]}" "$url") || code=000
    echo "attempt $attempt: HTTP $code"
    if [ "$code" = 200 ]; then
      return 0
    fi
    sleep 3
  done
  return 1
}

# Dumps the production database into backups/:
#   backup_database <image the database belongs to> [<suffix>]
# File name: <Moscow date and time>_<image tag>[_<suffix>].dump. Sets
# BACKUP_FILE to the new file. Each suffix has its own retention limit;
# pre-deploy backups keep their existing names without a suffix.
backup_database() {
  local suffix=${2:-}
  local tag name partial
  tag=$(image_tag "$1")
  name="$(TZ=Europe/Moscow date +%Y-%m-%d_%H-%M-%S)_$tag${suffix:+_$suffix}.dump"
  BACKUP_FILE=$BACKUP_DIR/$name

  install -d -m 700 "$BACKUP_DIR"
  compose up --detach --wait crm-postgres
  # The database login and name come from the container's environment.
  # A half-written dump never gets a backup's name.
  partial=$(mktemp "$BACKUP_DIR/.$name.XXXXXXXXXX.partial")
  if ! compose exec -T crm-postgres sh -c \
    'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format custom' \
    </dev/null >"$partial"; then
    rm -f "$partial"
    echo "Database backup failed" >&2
    return 1
  fi
  mv "$partial" "$BACKUP_FILE"
  echo "Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

  find "$BACKUP_DIR" -regextype posix-extended -maxdepth 1 -type f \
    -regex ".*/[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}_(none|[0-9a-f]{40})${suffix:+_$suffix}\.dump" \
    -printf '%f\n' | LC_ALL=C sort -r |
    tail -n +$((BACKUPS_TO_KEEP + 1)) |
    while read -r old; do
      echo "remove old backup $old"
      rm -f "$BACKUP_DIR/$old"
    done
}

# Shared by deploy.sh, rollback.sh and restore.sh: they source it, it is not
# run on its own.
#
# The app's folder on the server is two levels up from this file:
#   /home/deploy/personal-crm/deploy/app/common.sh -> /home/deploy/personal-crm
# It keeps .env, current-image, previous-image and backups/. The deploy/ folder
# next to them is a copy of deploy/ from the repo, replaced on every deploy.

SCRIPTS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "$SCRIPTS_DIR/../.." && pwd)
BACKUP_DIR=$APP_DIR/backups
BACKUPS_TO_KEEP=10
APP_DOMAIN=app.volki-lzkv.ru

cd "$APP_DIR"
# Backups and state files hold personal data: only the owner reads them.
umask 077

step() { printf '\n==> %s\n' "$*"; }

# The landing's containers share the "prod" project: no warnings about them.
export COMPOSE_IGNORE_ORPHANS=1
# compose.yaml needs CRM_IMAGE: the caller exports it before the first call.
compose() {
  docker compose --project-name prod --env-file "$APP_DIR/.env" \
    --file "$SCRIPTS_DIR/compose.yaml" "$@"
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

# Dumps the production database into backups/:
#   backup_database <image the database belongs to> [<suffix>]
# File name: <Moscow date and time>_<image tag>[_<suffix>].dump. Sets
# BACKUP_FILE to the new file. Afterwards only the newest BACKUPS_TO_KEEP
# backups stay.
backup_database() {
  local tag name partial
  tag=$(image_tag "$1")
  name="$(TZ=Europe/Moscow date +%Y-%m-%d_%H-%M-%S)_$tag${2:+_$2}.dump"
  BACKUP_FILE=$BACKUP_DIR/$name
  partial=$BACKUP_DIR/.$name.partial

  install -d -m 700 "$BACKUP_DIR"
  compose up --detach --wait crm-postgres
  # The database login and name come from the container's environment.
  # A half-written dump never gets a backup's name.
  if ! compose exec -T crm-postgres sh -c \
    'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format custom' \
    </dev/null >"$partial"; then
    rm -f "$partial"
    echo "Database backup failed" >&2
    return 1
  fi
  mv "$partial" "$BACKUP_FILE"
  echo "Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

  # Names start with the date and time, so the newest sort last.
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -printf '%f\n' | sort -r |
    tail -n +$((BACKUPS_TO_KEEP + 1)) |
    while read -r old; do
      echo "remove old backup $old"
      rm -f "$BACKUP_DIR/$old"
    done
}

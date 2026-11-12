#!/usr/bin/env bash
# Restores the production database from a backup. Run by hand only, on the
# server, in a terminal:
#   sudo -u deploy bash /home/deploy/personal-crm/deploy/app/restore.sh <backup>
# <backup> is a file name in /home/deploy/personal-crm/backups or a path.
#
# Shows which backup replaces which database and waits for "yes". Then: backs
# up the current database, stops the app, drops the database, creates it
# empty, loads the backup, applies the migrations of the running app version
# and starts the same version again. The app version does not change.
set -euo pipefail

backup=${1:?Usage: bash restore.sh <backup file name or path>}
# A path is taken from where the script was started, before common.sh moves.
case "$backup" in
  /*) ;;
  */*) backup=$PWD/$backup ;;
esac

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

fail() {
  echo "$*" >&2
  exit 1
}

case "$backup" in
  */*) ;;
  *) backup=$BACKUP_DIR/$backup ;;
esac
[ -f "$backup" ] && [ -r "$backup" ] || fail "No backup file $backup"
backup=$(realpath "$backup")

current=$(cat current-image 2>/dev/null || true)
[ -n "$current" ] || fail "No app version in $APP_DIR/current-image: deploy the app first."
export CRM_IMAGE=$current

[ -t 0 ] || fail "Needs a terminal to type \"yes\": run it with ssh -t, see README.md"

require_env

step "Checking the backup"
compose up --detach --wait crm-postgres
compose exec -T crm-postgres pg_restore --list <"$backup" >/dev/null ||
  fail "$backup is not a database backup: nothing changed."
database=$(compose exec -T crm-postgres printenv POSTGRES_DB </dev/null)

cat <<EOF

Backup:      $backup
             $(du -h "$backup" | cut -f1), made $(TZ=Europe/Moscow date -r "$backup" '+%Y-%m-%d %H:%M:%S') Moscow time
Replaces:    database "$database" of the production app, everything in it
App version: $(image_tag "$current"), stopped now and started again, same version

The current database is backed up first.
EOF
read -r -p 'Type yes to replace the database: ' answer
[ "$answer" = yes ] || fail "Not confirmed: nothing changed."

step "Backing up the current database"
backup_database "$current" before-restore
copy=$BACKUP_FILE

# From here on a failure leaves the app stopped: it must not run on an empty
# or half-loaded database.
restored=false
on_exit() {
  if [ "$restored" = false ]; then
    cat >&2 <<EOF

Restore failed. The app is stopped, the database may be empty or incomplete.
The database as it was before this restore: $copy
To put it back, run:
  sudo -u deploy bash $SCRIPTS_DIR/restore.sh $(basename "$copy")
EOF
  fi
}
trap on_exit EXIT

step "Stopping the app"
compose stop crm-app

step "Replacing database \"$database\" with the backup"
compose exec -T crm-postgres sh -c '
  dropdb --username "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" &&
  createdb --username "$POSTGRES_USER" "$POSTGRES_DB"' </dev/null
compose exec -T crm-postgres sh -c '
  pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --no-owner --exit-on-error --single-transaction' <"$backup"

step "Database migrations of $(image_tag "$current")"
compose run --rm --no-TTY crm-migrate </dev/null
restored=true

step "Starting the app, same version"
compose up --detach --wait --wait-timeout 120 crm-app

step "Smoke check: https://$APP_DOMAIN/health"
if ! smoke_check; then
  compose logs --tail 50 crm-app
  echo "Smoke check failed: the database is restored, the app runs, but /health does not answer 200." >&2
  exit 1
fi

step "Restored from $backup"
echo "The database before the restore: $copy"

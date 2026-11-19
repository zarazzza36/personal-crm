#!/usr/bin/env bash
# Run interactively as deploy. By default uses the newest production backup.
set -euo pipefail

DEPLOY_ENV=staging
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
lock_environment
require_env

if [ ! -t 0 ]; then
  echo 'Run in a terminal so you can confirm the restore.' >&2
  exit 1
fi

backup=${1:-$(find "$PROD_DIR/backups" -type f -name '*.dump' -printf '%T@\t%p\n' |
  sort -n | tail -n 1 | cut -f2-)}
if [ ! -r "$backup" ]; then
  echo "No readable production backup: $backup" >&2
  exit 1
fi
# Keep the selected dump open if a concurrent prod deploy prunes its filename.
exec 8<"$backup"
backup_fd=/proc/$$/fd/8

CRM_IMAGE=$(docker inspect --format '{{.Config.Image}}' prod-crm-app-1)
export CRM_IMAGE
compose up --detach --wait crm-postgres
compose exec -T crm-postgres pg_restore --list <"$backup_fd" >/dev/null

printf 'Backup: %s\nTarget: the staging PostgreSQL database on %s\n' "$backup" "$APP_DOMAIN"
read -r -p 'Type yes to replace the staging database: ' answer
[ "$answer" = yes ] || exit 1

compose stop crm-app
compose exec -T crm-postgres sh -ec '
  dropdb --username "$POSTGRES_USER" --if-exists --force -- "$POSTGRES_DB"
  createdb --username "$POSTGRES_USER" -- "$POSTGRES_DB"' </dev/null

# Only commit the copy after clearing production sessions and outstanding links.
# Older backups can predate the authentication tables.
{
  printf 'BEGIN;\n'
  if compose exec -T crm-postgres pg_restore --no-owner --no-privileges --file=- <"$backup_fd"; then
    cat <<'SQL'
DO $$
DECLARE
  auth_table text;
BEGIN
  IF to_regclass('public.contacts') IS NULL THEN
    RAISE EXCEPTION 'The backup has no contacts table';
  END IF;
  FOREACH auth_table IN ARRAY ARRAY['sessions', 'verifications', 'sign_in_link_requests'] LOOP
    IF to_regclass(format('public.%I', auth_table)) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I', auth_table);
    END IF;
  END LOOP;
END $$;
COMMIT;
SQL
  else
    exit 1
  fi
} | compose exec -T crm-postgres sh -ec '
  psql -Xq --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"'

# A refresh keeps the installed version. The first run uses the live prod image.
echo "Restored staging database from $backup"
# deploy.sh takes the same lock and applies any migrations pending in the copy.
flock --unlock 9
exec 8<&-
exec 9>&-
exec bash "$SCRIPTS_DIR/deploy.sh" staging --restart </dev/null

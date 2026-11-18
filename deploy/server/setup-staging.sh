#!/usr/bin/env bash
# Run once as root on the CRM server, after pointing the staging DNS here.
set -euo pipefail

DOMAIN=test-app.volki-lzkv.ru
DEPLOY_USER=deploy
SRC=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
APP_DIR=$DEPLOY_HOME/personal-crm-staging
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
if [ ! -d "$APP_DIR/deploy" ]; then
  cp -R -- "$SRC/.." "$APP_DIR/deploy"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/deploy"
fi

enable_site() {
  local site=$1
  install -m 0644 "$SRC/nginx/sites/$site" "/etc/nginx/sites-available/$site"
  ln -sfn "/etc/nginx/sites-available/$site" "/etc/nginx/sites-enabled/$site"
  nginx -t
  systemctl reload nginx
}

enable_site "$DOMAIN-http"
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  certbot certonly --webroot -w /var/www/letsencrypt --cert-name "$DOMAIN" -d "$DOMAIN" \
    --register-unsafely-without-email --agree-tos --non-interactive
fi

password_file=/etc/nginx/$DOMAIN.htpasswd
if [ ! -s "$password_file" ]; then
  echo 'Choose the browser password for the staging user.'
  digest=$(openssl passwd -6)
  install -m 0640 -o root -g www-data /dev/null "$password_file"
  printf 'staging:%s\n' "$digest" >"$password_file"
fi
enable_site "$DOMAIN"
printf 'Ready: https://%s uses Basic Auth (user staging).\n' "$DOMAIN"

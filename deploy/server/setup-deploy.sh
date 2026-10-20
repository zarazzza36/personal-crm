#!/usr/bin/env bash
# Prepares the server for deploys from GitHub Actions. Run once as root, after
# setup.sh:  sudo bash setup-deploy.sh <file with public SSH keys>
# - user "deploy" in the docker group: GitHub Actions logs in as this user, the
#   app's folder and its .env live in its home
# - the keys from the file become the only keys of that user
# - nginx sends app.volki-lzkv.ru to the app container instead of the placeholder
# Safe to run again.
set -euo pipefail

DEPLOY_USER=deploy
APP_DOMAIN=app.volki-lzkv.ru
SRC=$(cd "$(dirname "$0")" && pwd)

step() { printf '\n==> %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0 <file with public SSH keys>" >&2
  exit 1
fi
KEYS_FILE=${1:?Usage: sudo bash setup-deploy.sh <file with public SSH keys>}

step "User $DEPLOY_USER"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "Already exists"
else
  # No password: the server lets in by SSH key only.
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
# Deploys run docker. Docker access equals root access, so only trusted keys
# go into this user's authorized_keys.
usermod -aG docker "$DEPLOY_USER"
home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/.ssh" "$home/personal-crm"

step "SSH keys of $DEPLOY_USER"
ssh-keygen -l -f "$KEYS_FILE"
# "restrict": no port, agent or X11 forwarding and no terminal for these keys.
keys=$(mktemp)
grep -vE '^\s*(#|$)' "$KEYS_FILE" | sed 's/^/restrict /' >"$keys"
install -m 0600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$keys" "$home/.ssh/authorized_keys"
rm -f "$keys"

step "nginx: $APP_DOMAIN goes to the app container"
site=/etc/nginx/sites-available/$APP_DOMAIN
backup=$(mktemp)
cp -p "$site" "$backup"
install -m 0644 "$SRC/nginx/sites/$APP_DOMAIN" "$site"
ln -sf "$site" "/etc/nginx/sites-enabled/$APP_DOMAIN"
if ! nginx -t; then
  cp -p "$backup" "$site"
  echo "nginx rejected the new config, the old one is back in place" >&2
  exit 1
fi
rm -f "$backup"
systemctl reload nginx

step "Ready: GitHub Actions can deploy as $DEPLOY_USER"

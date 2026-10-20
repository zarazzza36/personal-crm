#!/usr/bin/env bash
# One-time preparation of the shared VPS: Docker, nginx with a placeholder page
# for the landing and a proxy to the app container, one HTTPS certificate for
# both domains. Deploys of the app need setup-deploy.sh on top of it.
# Run as root: sudo bash setup.sh
# Safe to run again: finished steps are skipped, and existing site configs are
# kept, so a re-run never puts the placeholder back over a deployed site.
set -euo pipefail

LANDING_DOMAIN=volki-lzkv.ru
APP_DOMAIN=app.volki-lzkv.ru
CERT_NAME=$LANDING_DOMAIN
SRC=$(cd "$(dirname "$0")" && pwd)

step() { printf '\n==> %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

step "Docker settings: published ports on 127.0.0.1 only, container logs capped"
# Docker publishes ports past ufw, so by default they bind to 127.0.0.1 and only
# nginx faces the internet. "ip" covers the default bridge network,
# "default-network-opts" covers networks created by docker compose.
install -d -m 0755 /etc/docker
docker_config_changed=0
if ! cmp -s "$SRC/docker/daemon.json" /etc/docker/daemon.json; then
  install -m 0644 "$SRC/docker/daemon.json" /etc/docker/daemon.json
  docker_config_changed=1
fi

step "Installing nginx and certbot"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl nginx certbot

step "Installing Docker from the official repository"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
if [ "$docker_config_changed" = 1 ]; then
  systemctl restart docker
fi
docker --version
docker compose version

step "Checking that Docker publishes ports on 127.0.0.1 only"
check_port_binding() {
  local network=$1 listeners
  docker run -d --rm --name port-check --network "$network" -p 18080:80 busybox sleep 30 >/dev/null
  listeners=$(ss -ltnH 'sport = :18080' | awk '{print $4}' | sort -u | xargs)
  docker rm -f port-check >/dev/null
  echo "network $network: port 18080 listens on: $listeners"
  if [ "$listeners" != "127.0.0.1:18080" ]; then
    echo "Docker published a port beyond 127.0.0.1, check /etc/docker/daemon.json" >&2
    exit 1
  fi
}
docker rm -f port-check >/dev/null 2>&1 || true
docker network rm port-check >/dev/null 2>&1 || true
docker network create port-check >/dev/null
check_port_binding bridge
check_port_binding port-check
docker network rm port-check >/dev/null
docker image rm busybox >/dev/null

step "nginx: placeholder page, HTTP-to-HTTPS redirect, catch-all for unknown names"
install -d -m 0755 /var/www/stub /var/www/letsencrypt
install -m 0644 "$SRC/stub/index.html" /var/www/stub/index.html
install -m 0644 "$SRC/nginx/snippets/volki-lzkv-tls.conf" /etc/nginx/snippets/volki-lzkv-tls.conf
install -m 0644 "$SRC/nginx/sites/default-deny" /etc/nginx/sites-available/default-deny
install -m 0644 "$SRC/nginx/sites/redirect-to-https" /etc/nginx/sites-available/redirect-to-https
for site in "$LANDING_DOMAIN" "$APP_DOMAIN"; do
  if [ -e "/etc/nginx/sites-available/$site" ]; then
    echo "Keeping existing /etc/nginx/sites-available/$site"
  else
    install -m 0644 "$SRC/nginx/sites/$site" "/etc/nginx/sites-available/$site"
  fi
done
# Ubuntu's welcome page also claims default_server; default-deny replaces it.
# Only the link goes, the file stays in sites-available.
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/default-deny /etc/nginx/sites-enabled/default-deny
ln -sf /etc/nginx/sites-available/redirect-to-https /etc/nginx/sites-enabled/redirect-to-https
nginx -t
systemctl reload nginx

step "Certificate for $LANDING_DOMAIN and $APP_DOMAIN"
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
install -m 0755 "$SRC/letsencrypt/reload-nginx" /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
if [ -e "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" ]; then
  echo "Certificate already exists, skipping"
else
  # Let's Encrypt no longer sends expiry emails, so the account has no email.
  certbot certonly --webroot -w /var/www/letsencrypt \
    --cert-name "$CERT_NAME" -d "$LANDING_DOMAIN" -d "$APP_DOMAIN" \
    --register-unsafely-without-email --agree-tos --non-interactive
fi

step "Enabling HTTPS for both domains"
for site in "$LANDING_DOMAIN" "$APP_DOMAIN"; do
  ln -sf "/etc/nginx/sites-available/$site" "/etc/nginx/sites-enabled/$site"
done
nginx -t
systemctl reload nginx

step "Checks"
echo "certbot.timer: $(systemctl is-enabled certbot.timer), $(systemctl is-active certbot.timer)"
certbot renew --dry-run
for domain in "$LANDING_DOMAIN" "$APP_DOMAIN"; do
  curl -sS -o /dev/null --resolve "$domain:80:127.0.0.1" \
    -w "http://$domain/ -> %{http_code} %{redirect_url}\n" "http://$domain/"
  curl -fsS -o /dev/null --resolve "$domain:443:127.0.0.1" \
    -w "https://$domain/ -> %{http_code}\n" "https://$domain/"
done

step "Server is ready"

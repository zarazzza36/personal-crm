#!/usr/bin/env bash
# Upload the deployment scripts from main, then run the shared server deploy.
set -euo pipefail

target=${1:?Missing deploy target}
release=${2:?Missing release}
case "$target" in
  prod) app_dir=personal-crm ;;
  staging) app_dir=personal-crm-staging ;;
  *) echo "Unknown deploy target: $target" >&2; exit 1 ;;
esac
if [ "$target" = prod ] && [ "$release" = --rollback ]; then
  image=--rollback
elif [[ "$release" =~ ^[0-9a-f]{40}$ ]]; then
  image="ghcr.io/${GITHUB_REPOSITORY,,}:$release"
else
  echo "Invalid release: $release" >&2
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
umask 077
printf '%s\n' "$DEPLOY_SSH_KEY" >"$tmp/deploy_key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" >"$tmp/known_hosts"
ssh_server() {
  ssh -i "$tmp/deploy_key" -o "UserKnownHostsFile=$tmp/known_hosts" \
    -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o BatchMode=yes \
    -o ServerAliveInterval=30 "$DEPLOY_USER@$DEPLOY_HOST" "$@"
}

remote_upload='
  set -e
  cd "$1"
  exec 9>.deploy.lock
  flock 9
  upload=$(mktemp -d .deploy.XXXXXXXXXX)
  cleanup() { rm -rf -- "$upload"; }
  trap cleanup EXIT
  tar -C "$upload" -xf -
  if [ -d deploy ]; then mv deploy "$upload/previous"; fi
  if ! mv "$upload/deploy" deploy; then
    if [ -d "$upload/previous" ]; then mv "$upload/previous" deploy; fi
    exit 1
  fi'
tar -cf - deploy | ssh_server "bash -c '$remote_upload' _ '$app_dir'"

printf '%s' "$REGISTRY_TOKEN" |
  ssh_server "bash '$app_dir/deploy/app/deploy.sh' '$target' '$image' '$GITHUB_ACTOR'" |
  tee "$tmp/deploy.log"

deployed=$(sed -n 's/^Deployed SHA: //p' "$tmp/deploy.log")
if [[ ! "$deployed" =~ ^[0-9a-f]{40}$ ]]; then
  echo '::error::The server did not report the deployed commit SHA.'
  exit 1
fi
printf '### Deploy %s\n\nDeployed SHA: `%s`\n' "$target" "$deployed" >>"$GITHUB_STEP_SUMMARY"

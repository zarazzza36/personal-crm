#!/usr/bin/env bash
# Daily production backup, run by personal-crm-backup.timer as deploy.
set -euo pipefail

DEPLOY_ENV=prod
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
lock_environment
require_env

CRM_IMAGE=$(cat current-image)
export CRM_IMAGE
step 'Daily database backup'
backup_database "$CRM_IMAGE" daily

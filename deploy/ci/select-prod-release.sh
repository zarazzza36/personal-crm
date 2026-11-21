#!/usr/bin/env bash
# Use only releases that passed the staging workflow, except on rollback.
set -euo pipefail

if [ "$ROLLBACK" = true ]; then
  echo 'release=--rollback' >>"$GITHUB_OUTPUT"
  exit 0
fi

filters=(-f branch=main -f event=push -f status=success -F per_page=100)
if [ -n "$REQUESTED_SHA" ]; then
  if [[ ! "$REQUESTED_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo '::error::Enter a full 40-character commit SHA.'
    exit 1
  fi
  filters+=(-f "head_sha=${REQUESTED_SHA,,}")
fi

# Completion time also accounts for a successful rerun of an earlier commit.
release=$(gh api --method GET --paginate --slurp \
  "repos/$GITHUB_REPOSITORY/actions/workflows/deploy-staging.yml/runs" "${filters[@]}" |
  jq -r '[.[].workflow_runs[]] | max_by(.updated_at) | .head_sha // empty')
if [[ ! "$release" =~ ^[0-9a-f]{40}$ ]]; then
  echo '::error::No successful Deploy staging run found for the requested release.'
  exit 1
fi
echo "Using staging release $release"
echo "release=$release" >>"$GITHUB_OUTPUT"

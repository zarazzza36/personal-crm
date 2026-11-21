#!/usr/bin/env bash
# Retain the ten newest SHA-tagged builds. Other tags and untagged manifests
# (which may be referenced by retained builds) are outside this policy.
set -euo pipefail

case "$OWNER_TYPE" in
  Organization) scope=orgs ;;
  *) scope=users ;;
esac
repository=${GITHUB_REPOSITORY,,}
endpoint="$scope/${repository%/*}/packages/container/${repository#*/}/versions"

old=$(gh api --method GET --paginate --slurp "$endpoint" -F per_page=100 |
  jq -r 'add // []
    | map(. + {tags: (.metadata.container.tags // [])})
    | map(select(any(.tags[]; test("^[0-9a-f]{40}$"))))
    | sort_by(.created_at, .id) | reverse | .[10:][]
    | select(all(.tags[]; test("^[0-9a-f]{40}$")))
    | [.id, (.tags | join(","))] | @tsv')

while IFS=$'\t' read -r version_id tags; do
  [ -n "$version_id" ] || continue
  echo "Deleting old GHCR build $tags"
  gh api --method DELETE "$endpoint/$version_id"
done <<<"$old"

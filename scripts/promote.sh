#!/bin/sh
# Promote what is on UAT to production: fast-forward main to uat, deploy, push both.
set -e; cd "$(dirname "$0")/.."
git checkout main && git merge --ff-only uat && npx wrangler deploy && git push origin main uat
git checkout uat
# Each game's own repo gets the same files (a failure here does not undo the deploy).
scripts/sync-game-repos.sh || echo "WARNING: game repo sync failed; run scripts/sync-game-repos.sh" >&2

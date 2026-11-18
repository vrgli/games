#!/bin/sh
# Keep vrgli/<game> in step with the Play site: copy public/play/<game> into the repo's game/
# (Tariff Wars also relay/), commit and push. Run by promote.sh after a production deploy.
#   scripts/sync-game-repos.sh           copy, commit, push
#   scripts/sync-game-repos.sh --check   only report which repos differ (no push)
# Push uses the admin PAT in ~/secrets/vrgli-github-admin.env through a throwaway askpass helper.
set -e; cd "$(dirname "$0")/.."
ROOT=$(pwd); MODE=${1:-push}
. ~/secrets/vrgli-github-admin.env
TOK=${VRGLI_GITHUB_ADMIN_PAT:-}
[ -n "$TOK" ] || { echo "no token variable found in vrgli-github-admin.env" >&2; exit 1; }
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
printf '#!/bin/sh\necho "$VRGLI_TOK"\n' > "$W/ask"; chmod +x "$W/ask"
export VRGLI_TOK="$TOK" GIT_ASKPASS="$W/ask" GIT_TERMINAL_PROMPT=0
SHA=$(git rev-parse --short HEAD); DIFFS=0
for g in tariff-wars wallop nuclear-negotiations; do
  git -c credential.helper= clone -q "https://vrgli@github.com/vrgli/$g.git" "$W/$g"
  rm -rf "$W/$g/game"; cp -r "public/play/$g" "$W/$g/game"
  if [ "$g" = tariff-wars ]; then
    rm -rf "$W/$g/relay"; mkdir "$W/$g/relay"
    cp src/room.js src/presina-engine.js src/presina-host.js "$W/$g/relay/"
  fi
  cd "$W/$g"; git add -A
  if git diff --cached --quiet; then echo "$g: in sync"
  else
    DIFFS=1; git diff --cached --stat | tail -1 | sed "s/^/$g: /"
    if [ "$MODE" != --check ]; then
      git -c user.name=vrgli -c user.email=vrgli@users.noreply.github.com commit -q -m "Sync with play.vrg.li ($SHA)"
      git -c credential.helper= push -q origin HEAD && echo "$g: pushed"
    fi
  fi
  cd "$ROOT"
done
[ "$MODE" = --check ] && exit $DIFFS || exit 0

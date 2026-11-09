#!/bin/sh
# Build the free downloads served at /source: one zip per game, each with the licence
# and a README, plus the relay source for Tariff Wars so a fork can run online too.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/source build && rm -rf build/*
for g in tariff-wars wallop nuclear-negotiations; do
  mkdir -p build/$g && cp -r public/play/$g build/$g/game && cp LICENSE.md build/$g/
  [ "$g" = tariff-wars ] && mkdir -p build/$g/relay && cp src/room.js src/presina-engine.js src/presina-host.js build/$g/relay/
  cat > build/$g/README.md <<R
# $g — a VRG game

Free to copy, remix and republish under LICENSE.md. The one condition: keep a visible
"A VRG game" credit linking to https://play.vrg.li.

- \`game/\` is the browser client; open \`game/index.html\` from any static server.
$( [ "$g" = tariff-wars ] && echo '- `relay/` is the multiplayer table server (a Cloudflare Durable Object over plain WebSockets); the client expects it at `/mp-socket`.' )
$( [ "$g" = nuclear-negotiations ] && echo '- The rules are in `game/engine.js`, free of any DOM code, so an AI or a server can drive the same table.' )
$( [ "$g" = wallop ] && echo '- The price feed is a seeded simulation (`game/js/engine.js`); a real one needs a server that settles rounds on a live BTC price.' )
R
  # Reproducible: fixed file times, sorted file list, no extra attributes, old zip removed first.
  find build/$g -exec touch -h -d '2026-01-01 00:00:00 UTC' {} +
  rm -f public/source/$g.zip
  (cd build/$g && find . -type f | LC_ALL=C sort | TZ=UTC zip -qX ../../public/source/$g.zip -@)
done
ls -la public/source

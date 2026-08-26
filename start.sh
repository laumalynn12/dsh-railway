#!/bin/bash
set -e

# Seed the harness home the way hermes-setup does: create every directory dsh
# expects up front so first-boot endpoints don't hit missing-dir errors.
mkdir -p /data/.dsh /data/workspace

# First boot on a fresh volume: copy the baked-in web profile (with ModSearch, so
# web search works without an API key) so every deployment starts usable. A volume
# that already has a profile is left untouched — user changes survive redeploys.
# To force a re-seed after upgrading the image's defaults, delete
# /data/.dsh/profiles/web on the volume.
if [ ! -d /data/.dsh/profiles/web ]; then
  echo "[start] seeding default web profile (incl. modsearch) from image"
  mkdir -p /data/.dsh/profiles
  cp -a /opt/dsh-defaults/.dsh/profiles/web /data/.dsh/profiles/web
fi

# Clear stale PID/lock files a previous container left on the volume. Plugins that
# guard state with a pid lock (e.g. task-board's ledger-v2.lock) refuse to load
# when the recorded pid happens to be live again in the new container — the PID
# namespace restarts at 1, so a recycled pid looks like a running owner and the
# whole plugin tree fails to boot. Nothing holds these across a container start.
rm -f /data/.dsh/*.pid 2>/dev/null || true
find /data/.dsh -maxdepth 3 -name '*.lock' -delete 2>/dev/null || true

exec node /app/server.js

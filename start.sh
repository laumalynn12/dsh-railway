#!/bin/bash
set -e

# Seed the harness home the way hermes-setup does: create every directory dsh
# expects up front so first-boot endpoints don't hit missing-dir errors.
mkdir -p /data/.dsh /data/workspace

# First boot on a fresh volume: copy the baked-in web profile (with ModSearch
# pre-installed) so every deployment starts with working web search. A volume
# that already has a profile is left untouched — user changes survive redeploys.
if [ ! -d /data/.dsh/profiles/web ]; then
  echo "[start] seeding default web profile (incl. modsearch) from image"
  mkdir -p /data/.dsh/profiles
  cp -a /opt/dsh-defaults/.dsh/profiles/web /data/.dsh/profiles/web
fi

# Clear a stale PID/lock file if a previous container left one on the volume.
rm -f /data/.dsh/*.pid 2>/dev/null || true

exec node /app/server.js

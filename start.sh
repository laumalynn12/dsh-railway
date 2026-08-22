#!/bin/bash
set -e

# Seed the harness home the way hermes-setup does: create every directory dsh
# expects up front so first-boot endpoints don't hit missing-dir errors.
mkdir -p /data/.dsh /data/workspace

# Clear a stale PID/lock file if a previous container left one on the volume.
rm -f /data/.dsh/*.pid 2>/dev/null || true

exec node /app/server.js

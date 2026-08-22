# Which @deepseek-ai/dsh version to install. Any published npm version or tag works.
# Override at deploy time with the DSH_VERSION service variable (build arg) — no code change.
ARG DSH_VERSION=0.1.1-rc.2

FROM node:22-slim
ARG DSH_VERSION
ENV DSH_VERSION=${DSH_VERSION}

# tini = PID 1. dsh spawns tool subprocesses (bash, git, ...) that reparent and pile up
# as zombies without an init; after weeks of uptime that exhausts the PID table.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install the pinned release globally so it survives volume mounts and is on PATH.
RUN npm install -g --no-audit --no-fund "@deepseek-ai/dsh@${DSH_VERSION}"

WORKDIR /app
COPY server.js package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Harness home + workspace live on the volume so sessions, credentials, and files
# survive redeploys. HOME points there too: some tools write dotfiles to $HOME.
ENV HOME=/data \
    DSH_HOME=/data/.dsh \
    DSH_NO_OPEN=1

RUN mkdir -p /data/.dsh /data/workspace

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# -g propagates SIGTERM to the whole process group so `docker stop` / Railway's
# stop signal cleanly terminates proxy + dsh + any tool subprocesses.
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["/app/start.sh"]

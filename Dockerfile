# Which @deepseek-ai/dsh version to install. Any published npm version or tag works.
# Override at deploy time with the DSH_VERSION service variable (build arg) — no code change.
ARG DSH_VERSION=0.1.1-rc.2

FROM node:22-slim
ARG DSH_VERSION
ENV DSH_VERSION=${DSH_VERSION}

# tini = PID 1. dsh spawns tool subprocesses (bash, git, ...) that reparent and pile up
# as zombies without an init; after weeks of uptime that exhausts the PID table.
# python3/make/g++ = node-gyp toolchain, needed to compile native addons that some
# web-ui plugins pull in (node-pty, cpu-features) — node:22-slim ships without them.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Install the pinned release globally so it survives volume mounts and is on PATH.
# pnpm is required by `dsh plugin` — profile plugins are managed as a pnpm project.
RUN npm install -g --no-audit --no-fund "pnpm@9" "@deepseek-ai/dsh@${DSH_VERSION}"

# Pre-install ModSearch into the web profile at build time so EVERY deployment gets
# it by default: the plugin registers modsearch's engine chain as the web seam's
# search provider (keyless Firecrawl out of the box, no API key needed) and adds
# x_search + read_page tools. Users can still remove/override via their own
# profile patches; this only sets the default state of a fresh volume.
#
# The profile must land on the VOLUME path (/data/.dsh/profiles/web) so it survives
# redeploys — but a fresh Railway volume starts EMPTY and would shadow whatever we
# bake into the image. So: install into a staging dir at build time, then copy it
# onto the volume at every boot IF the volume has no profile yet (start.sh).
ENV DSH_HOME=/opt/dsh-defaults/.dsh \
    HOME=/opt/dsh-defaults

# dsh-web-ui-all pulls in ~11 sub-plugins (some under @linxin666/*, some external
# unscoped packages like dsh-better-sidebar) as normal dependencies, but pnpm's
# default isolated layout tucks them into nested node_modules instead of hoisting
# to the top level — so Node's ESM resolver can't find them at runtime
# ("Cannot find package '...'"). Force full hoisted linking so every dependency
# lands where dsh's loader expects it, regardless of scope.
RUN pnpm config set node-linker hoisted --global

RUN dsh plugin --profile web add --workspace-root @liustack/modsearch@5.9.0 \
 && dsh plugin --profile web add --workspace-root @linxin666/dsh-web-ui-all@0.2.0 \
 && dsh plugin --profile web list --depth 0

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

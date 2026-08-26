# Which @deepseek-ai/dsh version to install. Any published npm version or tag works.
# Override at deploy time with the DSH_VERSION service variable (build arg) — no code change.
ARG DSH_VERSION=0.1.1-rc.2

FROM node:22-slim
ARG DSH_VERSION
ENV DSH_VERSION=${DSH_VERSION}

# tini = PID 1. dsh spawns tool subprocesses (bash, git, ...) that reparent and pile up
# as zombies without an init; after weeks of uptime that exhausts the PID table.
# No node-gyp toolchain: the only profile plugin (modsearch) is pure JS. Adding a
# plugin with native addons (node-pty, cpu-features, ssh2) means restoring
# python3 make g++ here.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
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

# Only add profile plugins that declare NO @deepseek-ai/* dependency.
# Third-party plugins pin harness internals with caret ranges on prereleases
# (^0.1.0-rc.6), and a caret range over a prerelease does not match a newer
# prerelease (0.1.1-rc.2) — so pnpm installs a SECOND, older copy of harness
# internals into the profile, which shadows the runtime the `dsh` CLI loads.
# An older dsh-host-webserver has no renderIndex(), so the SPA document route
# throws and every page load answers a bare 400 with an empty body.
# modsearch depends only on undici + commander, so it is safe.
# Verify before adding anything here:
#   npm view <pkg> dependencies peerDependencies
RUN dsh plugin --profile web add --workspace-root @liustack/modsearch@5.9.0 \
 && dsh plugin --profile web list --depth 0

# Fail the build if a profile plugin ever shadows a harness package again.
RUN test -z "$(ls /opt/dsh-defaults/.dsh/profiles/web/node_modules/@deepseek-ai 2>/dev/null)" \
 || { echo "FATAL: profile shadows @deepseek-ai packages (see comment above)"; \
      ls /opt/dsh-defaults/.dsh/profiles/web/node_modules/@deepseek-ai; exit 1; }

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

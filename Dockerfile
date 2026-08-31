# Which git ref of deepseek-ai/deepseek-harness to build. Any branch, tag, or
# full commit SHA works. Override at deploy time with the DSH_GIT_REF service
# variable (build arg) — no code change. Pin a commit SHA for anything long-lived;
# this is a developer-preview monorepo and master can carry breaking changes
# between your builds.
ARG DSH_GIT_REF=master

FROM node:22-slim
ARG DSH_GIT_REF
ENV DSH_GIT_REF=${DSH_GIT_REF}

# tini = PID 1. dsh spawns tool subprocesses (bash, git, ...) that reparent and pile up
# as zombies without an init; after weeks of uptime that exhausts the PID table.
#
# git/python3/make/g++ are here for the SOURCE BUILD (pnpm install compiles the
# repo's native/landlock-run workspace member and any other native deps), not for
# the earlier no-node-gyp reasoning that applied to the npm-install path — building
# from source is heavier than installing the published package.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates git python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# The repo pins pnpm via corepack (packageManager: pnpm@11.7.0 in package.json).
# Activate that EXACT version as the global default explicitly (not by letting
# corepack infer it from whichever directory happens to be cwd) — corepack's
# cwd-based package.json lookup only kicks in from inside the repo checkout, and
# a later RUN step (installing the ModSearch profile plugin) invokes pnpm from
# outside it, which resolved to a newer default pnpm and pnpm's own
# packageManager check then refused to run ("configured to use 11.7.0 ... your
# current pnpm is v11.24.0"). Pinning explicitly up front avoids that entirely.
RUN corepack enable \
 && corepack prepare pnpm@11.7.0 --activate

# Clone the pinned ref and build the repository artifacts (tsc + tsdown host/client
# builds, web frontend build, etc. — see package.json "build" script). This is a
# full monorepo build, noticeably slower than `npm install -g @deepseek-ai/dsh`.
RUN git clone https://github.com/deepseek-ai/deepseek-harness.git /opt/deepseek-harness \
 && cd /opt/deepseek-harness \
 && git checkout "${DSH_GIT_REF}" \
 && pnpm install --frozen-lockfile \
 && pnpm run build

# There is no global `dsh` binary from a source checkout — the repo's own
# instructions run it as `pnpm dsh <args>` from inside the checkout. server.js
# spawns the child as a bare `dsh`, so provide a wrapper on PATH that forwards
# into the checkout unchanged, rather than touching server.js.
RUN printf '#!/bin/sh\nexec pnpm --dir /opt/deepseek-harness dsh "$@"\n' > /usr/local/bin/dsh \
 && chmod +x /usr/local/bin/dsh

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
# prerelease/source build — so pnpm installs a SECOND, older copy of harness
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
COPY server.js mobile-settings.js package.json ./
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

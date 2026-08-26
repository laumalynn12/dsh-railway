# dsh-railway — DeepSeek Harness on Railway

Deploy [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) to
[Railway](https://railway.app) behind a small authenticated reverse proxy.

`dsh web` deliberately refuses `--host 0.0.0.0` (all-interfaces binding is not supported by the
CLI yet), and it has no built-in login. Railway requires a public listener, so this template puts
a tiny auth proxy in front: the proxy binds `0.0.0.0:$PORT`, guards everything with one cookie
login, and forwards to `dsh web --no-open` on loopback.

```
Railway container
└── server.js — Node http server on 0.0.0.0:$PORT   (the only public surface)
    ├── /health          — health check (no auth), used by railway.toml
    ├── /login, /logout  — cookie session (HMAC-signed, 7-day, httponly)
    └── /*               — reverse proxied to dsh web UI on 127.0.0.1:3080
        │
        └── dsh web --no-open — the harness itself (Web UI + agent loop)
```

The proxy restarts `dsh` if it crashes, streams its output into the Railway logs, and shuts it
down cleanly on SIGTERM. It also rewrites two response bodies in flight — see
[Mobile settings layout](#mobile-settings-layout).

## Deploy

1. Push this repo to GitHub → **New Project → Deploy from GitHub repo** on Railway.
2. Attach a **volume** mounted at `/data` (persists sessions, workspace, credentials across
   redeploys).
3. Set environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | recommended | Proxy login password. Username is always `admin`. If unset, a random password is printed to deploy logs. |
| `DSH_VERSION` | no | Pin of `@deepseek-ai/dsh` to install (default: the version in the Dockerfile). Override to upgrade without editing code. |
| `DSH_HOME` | no | Harness home dir. Default `/data/.dsh`. |

Model keys are **not** env vars here — configure them in the Web UI under *Settings → Models*
(they are stored write-only in `$DSH_HOME/.credentials.yaml`). Custom providers
(*Add a custom provider*) work out of the box; for gateways that reject modern OpenAI request
shapes set `compat.supportsDeveloperRole: false` and `compat.maxTokensField: max_tokens` on the
route in `$DSH_HOME/settings.yaml`.

## Local run

```bash
docker build -t dsh-railway .
docker run --rm -p 8080:8080 -e PORT=8080 -e ADMIN_PASSWORD=changeme -v dsh-data:/data dsh-railway
```

Open `http://localhost:8080`, log in with `admin` / `changeme`.

## Security notes

- One shared password protects the whole surface; there is no per-user identity. Do not expose
  this publicly without also putting IP allowlisting or SSO in front if the data matters.
- The agent can execute shell commands inside the container. That is the product working as
  intended — treat the deployment as you would an SSH box.
- Developer preview upstream: pin `DSH_VERSION` and expect breaking changes between versions.

## Web search out of the box (ModSearch)

The image pre-installs [@liustack/modsearch](https://github.com/liustack/modsearch)
into the `web` profile. `web_search` runs on its keyless engine chain (Firecrawl
keyless: 1,000 free credits/month, no signup), and the agent additionally gets
`x_search` (X/Twitter) and `read_page` (structured page reading) tools.

Engines and keys live in `/data/.modsearch/config.json` inside the container —
ask the agent to run `modsearch config set tavily.apiKey <key>` (or edit the
file) to add Tavily/Exa/Firecrawl keys for higher quotas. Excluding engines:
`modsearch config set <engine>.enabled false`.

## Mobile settings layout

`mobile-settings.js` injects a stylesheet into the served `index.html` that makes the
**Settings** panel usable on a phone. Upstream's settings shell
(`packages/client/ui-settings-general/SettingsRoot.module.css`) has no `@media` rules at
all: the panel is `width: 800px; max-width: calc(100vw - 48px)` and its nav rail is
`width: 188px; flex: none`. On a 360px-wide screen the panel shrinks to ~312px, the rail
still claims 188px, and ~124px is left for the content column — too narrow for rows whose
label sits beside its control, so they spill over each other. Below 640px the stylesheet
makes the panel a full-screen sheet, turns the rail into a horizontal tab strip, raises
touch targets to 44px, and adds safe-area insets.

Selectors are semantic rather than class-based, because the client build hashes CSS Module
class names (`.panel` → `.panel_a1b2c`) and those change on every rebuild. The panel is
matched by `[role="dialog"][aria-modal="true"][aria-labelledby]`, which is uniquely the
settings panel — every other dialog in the app names itself with `aria-label` instead.
That makes the injection independent of `DSH_VERSION`, and unlike a profile plugin it adds
nothing to `node_modules`, so it cannot cause the shadowing failure described below.

Run `node mobile-settings.test.js` after editing it. The stylesheet styles the settings
*shell* only; individual sections keep their own grids, which fit once the rail stops
reserving its 188px.

## Adding profile plugins

ModSearch is the only plugin installed by default. To add more:

```bash
dsh plugin --profile web add --workspace-root <package>@<version>
```

**Check the package's dependencies first:**

```bash
npm view <package> dependencies peerDependencies
```

A plugin that depends on `@deepseek-ai/*` will break the Web UI. Those packages pin
harness internals with caret ranges over prereleases (`^0.1.0-rc.6`), and such a range
does not match a newer prerelease like `0.1.1-rc.2` — so pnpm installs a second, older
copy of harness internals into the profile, where it shadows the runtime the `dsh` CLI
loads. An older `dsh-host-webserver` has no `renderIndex()`, so the SPA document route
throws and **every page load returns a bare 400 with an empty body** (no error message
anywhere in the logs). `@linxin666/dsh-web-ui-all@0.2.0` fails exactly this way.

The Dockerfile fails the build if a profile plugin ever shadows a harness package, so
this cannot reach a deploy unnoticed. Plugins with native addons (node-pty, cpu-features,
ssh2) also need `python3 make g++` restored to the `apt-get install` line.

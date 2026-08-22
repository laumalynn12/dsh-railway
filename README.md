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
down cleanly on SIGTERM.

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

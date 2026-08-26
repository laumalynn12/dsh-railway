# Deploy and Host DeepSeek Harness (dsh) on Railway

DeepSeek Harness is an open-source agent runtime where "everything is a plugin" — a coding agent that lives on your server, executes real tasks with bash, file editing, and web access, and gets more capable the longer it runs. This template deploys it behind a password-protected reverse proxy, pre-loaded with ModSearch for keyless web search.

## About Hosting DeepSeek Harness

Hosting DeepSeek Harness on Railway gives you an always-on AI agent accessible from any browser — phone, tablet, or desktop. The template handles the two things dsh cannot do natively: binding to a public interface (dsh only accepts loopback) and authentication (a cookie-based login gate in front of the Web UI). A persistent volume keeps sessions, credentials, and memories across redeploys. ModSearch comes pre-installed so `web_search` works immediately via Firecrawl's keyless tier — no API keys required. Configure your model API key through the UI after deploy and start working.

## Common Use Cases

- **24/7 coding agent** — dispatch long refactors or bug hunts from any device; the agent keeps working after you close the browser
- **Web research assistant** — keyless web search, X search (`x_search`), and structured page reading (`read_page`) out of the box
- **Personal automation hub** — schedule tasks, run scripts, manage Git workflows through chat
- **Team-adjacent agent** — share one deployment with your team behind a shared login

## Dependencies for DeepSeek Harness Hosting

- **At least one LLM provider API key** — DeepSeek (recommended), OpenRouter, Anthropic, or any OpenAI-compatible endpoint. Configured in the Web UI after deploy (Settings → Models), stored encrypted on the volume
- **Persistent volume** — attach a volume mounted at `/data` for sessions, credentials, and workspace files (survives redeploys)
- **Node.js 22** — bundled in the Docker image, no setup needed

### Implementation Details

The container runs one public process: an auth reverse proxy that binds `0.0.0.0:$PORT`, guards everything with a single cookie login, and forwards to `dsh web --no-open` on loopback. The proxy also supervises the harness process (auto-restart with backoff) and neutralizes client-side loopback checks so the full settings UI works over a remote origin. Sessions persist as append-only logs under `/data/.dsh/sessions/`. Optional environment variables: `ADMIN_USERNAME` (default `admin`), `DSH_VERSION` (pinned release), `EXA_API_KEY` / `TAVILY_API_KEY` / `DEEPSEEK_API_KEY` for extra search/model providers.

## Why Deploy DeepSeek Harness on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying DeepSeek Harness on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.

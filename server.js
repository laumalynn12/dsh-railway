/*
 * dsh-railway — auth reverse proxy in front of `dsh web`.
 *
 * Responsibilities:
 *   - Bind 0.0.0.0:$PORT (Railway's requirement; dsh itself refuses all-interfaces binds)
 *   - /health — unauthenticated health check for the Railway healthcheckPath
 *   - /login, /logout — cookie session (HMAC-signed, 7-day, httponly)
 *   - everything else — reverse proxied to dsh web on 127.0.0.1:3080
 *   - supervise the `dsh web --no-open` child: restart with backoff, pipe logs out,
 *     SIGTERM on shutdown
 *
 * Auth model mirrors hermes-setup's server.py: one shared ADMIN_PASSWORD, cookie not
 * basic-auth (the dsh SPA's fetch() calls do not reliably send basic-auth creds), and
 * the signing secret rotates on every process start so an ADMIN_PASSWORD change
 * (which redeploys the service) invalidates all sessions.
 */
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const httpProxy = require('http-proxy');

const PORT = parseInt(process.env.PORT || '8080', 10);
const DSH_PORT = parseInt(process.env.DSH_PORT || '3080', 10);
const DSH_HOST = '127.0.0.1';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const COOKIE_NAME = 'dsh_session';

// Rotate per boot — see header comment.
const SECRET = crypto.randomBytes(32);

let adminPassword = process.env.ADMIN_PASSWORD || '';
if (!adminPassword) {
  adminPassword = crypto.randomBytes(16).toString('base64url');
  console.log('[proxy] ADMIN_PASSWORD unset — generated for this deploy:', adminPassword);
} else {
  console.log('[proxy] ADMIN_PASSWORD set via environment');
}

// ── dsh child process ────────────────────────────────────────────────────────

let dshChild = null;
let dshBackoffMs = 1000;
let shuttingDown = false;

function startDsh() {
  if (shuttingDown) return;
  const child = spawn('dsh', ['web', '--no-open', '--host', DSH_HOST, '--port', String(DSH_PORT)], {
    env: {
      ...process.env,
      // dsh resolves its home from DSH_HOME; keep workspace stable under /data.
      HOME: '/data',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  dshChild = child;
  console.log(`[proxy] started dsh web pid=${child.pid}`);

  const pipe = (stream, tag) => {
    stream.setEncoding('utf8');
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        console.log(`[dsh] ${line}`);
      }
      if (buf.length > 8192) buf = ''; // drop runaway partial line
    });
  };
  pipe(child.stdout, 'stdout');
  pipe(child.stderr, 'stderr');

  child.on('exit', (code, signal) => {
    dshChild = null;
    if (shuttingDown) return;
    console.error(`[proxy] dsh exited code=${code} signal=${signal} — restarting in ${dshBackoffMs}ms`);
    setTimeout(startDsh, dshBackoffMs);
    dshBackoffMs = Math.min(dshBackoffMs * 2, 30000); // cap at 30s
  });

  // A stretch of successful uptime resets the backoff.
  setTimeout(() => { dshBackoffMs = 1000; }, 60000);
}

function stopDsh() {
  shuttingDown = true;
  if (!dshChild) return;
  dshChild.kill('SIGTERM');
  const t = setTimeout(() => { try { dshChild && dshChild.kill('SIGKILL'); } catch {} }, 8000);
  t.unref();
}

// ── session cookies ─────────────────────────────────────────────────────────

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function makeSessionCookie() {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${exp}`;
  return `${COOKIE_NAME}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function verifySession(req) {
  const cookies = req.headers.cookie || '';
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!m) return false;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Date.now() < Number(payload);
}

function checkCredentials(username, password) {
  const uOk = crypto.timingSafeEqual(
    Buffer.from(username.padEnd(64).slice(0, 64)),
    Buffer.from(ADMIN_USERNAME.padEnd(64).slice(0, 64))
  );
  const pOk = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(64).slice(0, 64)),
    Buffer.from(adminPassword.padEnd(64).slice(0, 64))
  );
  return uOk && pOk;
}

// ── login page ───────────────────────────────────────────────────────────────

const LOGIN_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>dsh — sign in</title>
<style>
 body{background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;display:flex;justify-content:center;padding-top:18vh}
 form{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:2rem;width:320px}
 h1{font-size:1.1rem;margin-top:0} input{width:100%;box-sizing:border-box;margin:.4rem 0;padding:.55rem;border-radius:6px;
 border:1px solid #30363d;background:#0d1117;color:#e6edf3} button{width:100%;padding:.55rem;margin-top:.6rem;border-radius:6px;
 border:none;background:#238636;color:#fff;font-weight:600;cursor:pointer} .err{color:#f85149;font-size:.85rem;min-height:1.2em}
</style></head><body>
<form method="post" action="/login">
<h1>DeepSeek Harness</h1>
<div class="err">${process.env.LOGIN_ERROR || ''}</div>
<input name="username" placeholder="admin" autocomplete="username" autofocus>
<input name="password" type="password" placeholder="password" autocomplete="current-password">
<button>Sign in</button>
</form></body></html>`;

// ── proxy plumbing ───────────────────────────────────────────────────────────

const proxy = httpProxy.createProxyServer({
  target: `http://${DSH_HOST}:${DSH_PORT}`,
  ws: true,
});

// WebSockets must also pass the auth gate.
proxy.on('error', (err, req, res) => {
  console.error('[proxy] upstream error:', err.message);
  if (res && res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('dsh is starting up or unavailable — retry shortly');
  }
});

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 16384) req.destroy(); });
    req.on('end', () => resolve(body));
  });
}

async function handleLocal(req, res) {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/health') {
    // Healthy once we can reach dsh's own port.
    const ok = await new Promise((resolve) => {
      const r = http.get({ host: DSH_HOST, port: DSH_PORT, path: '/', timeout: 2000 }, (resp) => {
        resp.resume();
        resolve(resp.statusCode !== undefined);
      });
      r.on('error', () => resolve(false));
      r.on('timeout', () => { r.destroy(); resolve(false); });
    });
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'text/plain' });
    res.end(ok ? 'ok\n' : 'starting\n');
    return true;
  }

  if (url.pathname === '/login' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(LOGIN_PAGE);
    return true;
  }

  if (url.pathname === '/login' && req.method === 'POST') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    if (checkCredentials(params.get('username') || '', params.get('password') || '')) {
      res.writeHead(302, { Location: '/', 'Set-Cookie': makeSessionCookie() });
      res.end();
    } else {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(LOGIN_PAGE.replace('class="err"', 'class="err"').replace('</div>\n<input name="username"',
        '</div><div class="err">Wrong username or password.</div><input name="username"'));
    }
    return true;
  }

  if (url.pathname === '/logout') {
    res.writeHead(302, { Location: '/login', 'Set-Cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/` });
    res.end();
    return true;
  }

  return false; // not a local route → proxy it
}

const server = http.createServer(async (req, res) => {
  try {
    if (await handleLocal(req, res)) return;

    if (!verifySession(req)) {
      res.writeHead(302, { Location: '/login' });
      res.end();
      return;
    }

    proxy.web(req, res);
  } catch (err) {
    console.error('[proxy] request error:', err);
    if (!res.headersSent) res.writeHead(500);
    res.end('internal error');
  }
});

server.on('upgrade', (req, socket, head) => {
  if (!verifySession(req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[proxy] listening on 0.0.0.0:${PORT}, forwarding to ${DSH_HOST}:${DSH_PORT}`);
  startDsh();
});

process.on('SIGTERM', () => {
  console.log('[proxy] SIGTERM — shutting down');
  stopDsh();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});

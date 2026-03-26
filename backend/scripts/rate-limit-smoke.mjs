/**
 * Standalone smoke test for express-rate-limit middleware (same module as production).
 * Usage: node scripts/rate-limit-smoke.mjs <api|register|login>
 * Uses a high port (SMOKE_PORT, default 3999) so it does not conflict with dev server.
 */
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '../.env'), override: true });

const mode = (process.argv[2] || '').toLowerCase();
const valid = ['api', 'register', 'login'];
if (!valid.includes(mode)) {
  console.error('Usage: node scripts/rate-limit-smoke.mjs <api|register|login>');
  process.exit(1);
}

const smokePort = Number(process.env.SMOKE_PORT) || 3999;

// Tight limits for smoke tests; must be set before rate-limit.js is loaded.
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_API_MAX = '100';
process.env.RATE_LIMIT_AUTH_MAX = '100';
process.env.RATE_LIMIT_LOGIN_MAX = '100';

if (mode === 'api') {
  process.env.RATE_LIMIT_API_MAX = '5';
} else if (mode === 'register') {
  process.env.RATE_LIMIT_AUTH_MAX = '4';
} else if (mode === 'login') {
  process.env.RATE_LIMIT_LOGIN_MAX = '3';
}

const express = (await import('express')).default;
const { apiLimiter, authEmailLimiter, loginLimiter } = await import(
  '../src/middleware/rate-limit.js'
);

const app = express();
app.use(express.json());
app.use('/api', apiLimiter);

app.get('/api', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/users/register', authEmailLimiter, (_req, res) => {
  res.status(201).json({ ok: true });
});

app.post('/api/users/login', loginLimiter, (_req, res) => {
  res.status(200).json({ ok: true });
});

const server = app.listen(smokePort, '127.0.0.1', () => {
  console.log(`[rate-limit-smoke] mode=${mode} http://127.0.0.1:${smokePort}`);
});

function shutdown(code = 0) {
  server.close(() => process.exit(code));
}

async function runClient() {
  const base = `http://127.0.0.1:${smokePort}`;
  const results = [];

  // Auth limiters key by IP + email — reuse one email so the cap applies.
  const fixedEmail = 'smoke-same@t.test';

  if (mode === 'api') {
    for (let i = 1; i <= 7; i++) {
      const r = await fetch(`${base}/api`);
      results.push({ i, status: r.status });
    }
  } else if (mode === 'register') {
    for (let i = 1; i <= 6; i++) {
      const r = await fetch(`${base}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fixedEmail, name: 'x', password: '123456' })
      });
      results.push({ i, status: r.status });
    }
  } else if (mode === 'login') {
    for (let i = 1; i <= 5; i++) {
      const r = await fetch(`${base}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fixedEmail, password: 'x' })
      });
      results.push({ i, status: r.status });
    }
  }

  console.log(JSON.stringify({ mode, results }, null, 2));

  const first429 = results.find((x) => x.status === 429);
  // express-rate-limit: max N => N successes then 429 on request N+1
  const expected429At = mode === 'api' ? 6 : mode === 'register' ? 5 : 4;

  if (!first429 || first429.i !== expected429At) {
    console.error(
      `[rate-limit-smoke] FAIL: expected first 429 on request ${expected429At}, got:`,
      first429
    );
    shutdown(1);
    return;
  }

  console.log(`[rate-limit-smoke] OK: first 429 on request ${first429.i} as expected`);
  shutdown(0);
}

runClient().catch((e) => {
  console.error(e);
  shutdown(1);
});

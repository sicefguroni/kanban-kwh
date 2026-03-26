import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

/**
 * Broad protection for all JSON API routes under /api.
 */
export const apiLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_API_MAX) || 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.method === 'OPTIONS'
});

/**
 * Stricter cap for credential endpoints; key includes body email when present.
 */
export const authEmailLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip)}:${email}`;
  }
});

/**
 * Extra-tight limit for login only (brute-force protection).
 */
export const loginLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip)}:${email}`;
  }
});

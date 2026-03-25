import pkg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');

dotenv.config({ path: envPath });

const { Pool } = pkg;

// In some setups PostgreSQL listens only on IPv4.
// `localhost` can resolve to IPv6 first (`::1`), causing connection refused.
function resolveDbHost() {
  const host = process.env.DB_HOST || '127.0.0.1';
  return host === 'localhost' ? '127.0.0.1' : host;
}

export let dbReady = false;

export function setDbReady(nextValue) {
  dbReady = Boolean(nextValue);
}

export function isDbReady() {
  return dbReady;
}

export async function trySetDbReady({ timeoutMs = 1000 } = {}) {
  if (dbReady) return true;

  try {
    // Fast ping to verify DB connectivity.
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('db ping timeout')), timeoutMs)),
    ]);
    setDbReady(true);
    return true;
  } catch (e) {
    setDbReady(false);
    return false;
  }
}

const pool = new Pool({
  host: resolveDbHost(),
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'kwh_kanban',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

export default pool;

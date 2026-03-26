import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logDir() {
  return path.join(__dirname, '../../logs');
}

/** First free path: `daily-summary-{date}.json`, then `{date}-1.json`, `{date}-2.json`, ... */
function resolveSummaryFilePath(dir, date) {
  const primary = path.join(dir, `daily-summary-${date}.json`);
  if (!fs.existsSync(primary)) {
    return primary;
  }
  let n = 1;
  while (n < 10_000) {
    const candidate = path.join(dir, `daily-summary-${date}-${n}.json`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    n += 1;
  }
  const fallback = path.join(
    dir,
    `daily-summary-${date}-${Date.now()}.json`
  );
  return fallback;
}

/**
 * Writes JSON summary under backend/logs and logs a one-line digest.
 * Optional: set SUMMARY_EMAIL_TO + SMTP_* env vars; if nodemailer is added later, hook here.
 */
export async function runDailySummary(pool) {
  const taskStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND archived_at IS NULL)::int AS active_tasks,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS soft_deleted,
      COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived,
      COUNT(*)::int AS total_rows
    FROM tasks
  `);

  const userStats = await pool.query('SELECT COUNT(*)::int AS users FROM users');

  const date = new Date().toISOString().slice(0, 10);
  const summary = {
    date,
    generatedAt: new Date().toISOString(),
    tasks: taskStats.rows[0],
    users: userStats.rows[0].users
  };

  const dir = logDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = resolveSummaryFilePath(dir, date);
  fs.writeFileSync(filePath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(
    `[daily-summary] ${date} active=${summary.tasks.active_tasks} ` +
      `soft_deleted=${summary.tasks.soft_deleted} archived=${summary.tasks.archived} users=${summary.users} -> ${filePath}`
  );

  return { ...summary, outputPath: filePath };
}

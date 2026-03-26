#!/usr/bin/env node
/**
 * Run scheduled job handlers on demand (same code paths as node-cron in server).
 *
 * Usage (from backend/):
 *   node scripts/run-cron-jobs.mjs              # all jobs
 *   node scripts/run-cron-jobs.mjs clean        # soft-delete purge only
 *   node scripts/run-cron-jobs.mjs archive      # archive stale tasks only
 *   node scripts/run-cron-jobs.mjs summary      # daily summary only
 *   node scripts/run-cron-jobs.mjs clean archive
 *
 *   npm run cron:run
 *   npm run cron:run -- summary
 */
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env'), override: true });

import pool from '../src/db/connection.js';
import { runCleanSoftDeleted } from '../src/jobs/clean-soft-deleted.js';
import { runArchiveOldTasks } from '../src/jobs/archive-old-tasks.js';
import { runDailySummary } from '../src/jobs/daily-summary.js';

const JOB_MAP = {
  clean: { label: 'clean-soft-deleted', run: runCleanSoftDeleted },
  archive: { label: 'archive-old-tasks', run: runArchiveOldTasks },
  summary: { label: 'daily-summary', run: runDailySummary }
};

function printHelp() {
  console.log(`Usage: node scripts/run-cron-jobs.mjs [jobs...]

Jobs:  clean | archive | summary | all
  (no args) or "all"  → run every job

Examples:
  node scripts/run-cron-jobs.mjs
  node scripts/run-cron-jobs.mjs clean summary
`);
}

async function main() {
  const raw = process.argv.slice(2).map((a) => a.toLowerCase());
  const unknown = raw.filter((a) => !['clean', 'archive', 'summary', 'all'].includes(a));
  if (unknown.length) {
    console.error('Unknown job(s):', unknown.join(', '));
    printHelp();
    process.exit(1);
  }

  const wantAll = raw.length === 0 || raw.includes('all');
  const selected = wantAll
    ? ['clean', 'archive', 'summary']
    : [...new Set(raw.filter((a) => a !== 'all'))];

  let client;
  try {
    client = await pool.connect();
    client.release();
  } catch (e) {
    console.error('Database not reachable:', e.message);
    process.exit(1);
  }

  for (const key of selected) {
    const { label, run } = JOB_MAP[key];
    process.stdout.write(`[${label}] running... `);
    try {
      const result = await run(pool);
      console.log(JSON.stringify(result));
    } catch (error) {
      console.log('FAILED');
      console.error(error);
      process.exitCode = 1;
    }
  }

  await pool.end();
}

main();

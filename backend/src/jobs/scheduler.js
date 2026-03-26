import cron from 'node-cron';
import { isDbReady } from '../db/connection.js';
import pool from '../db/connection.js';
import { runCleanSoftDeleted } from './clean-soft-deleted.js';
import { runArchiveOldTasks } from './archive-old-tasks.js';
import { runDailySummary } from './daily-summary.js';

function scheduleOrLog(expression, label, task) {
  if (!cron.validate(expression)) {
    console.warn(`[cron] invalid schedule for ${label}: ${expression}`);
    return;
  }
  cron.schedule(expression, async () => {
    if (!isDbReady()) {
      return;
    }
    try {
      const result = await task(pool);
      console.log(`[cron:${label}]`, result);
    } catch (error) {
      console.error(`[cron:${label}] failed`, error);
    }
  });
  console.log(`[cron] scheduled ${label}: ${expression}`);
}

/**
 * In-process scheduled jobs (node-cron). Disabled when CRON_ENABLED=false.
 */
export function startScheduledJobs() {
  if (process.env.CRON_ENABLED === 'false') {
    console.log('[cron] disabled (CRON_ENABLED=false)');
    return;
  }

  scheduleOrLog(
    process.env.CRON_CLEAN_SOFT_DELETED || '0 2 * * *',
    'clean-soft-deleted',
    runCleanSoftDeleted
  );

  scheduleOrLog(
    process.env.CRON_ARCHIVE_TASKS || '15 2 * * *',
    'archive-old-tasks',
    runArchiveOldTasks
  );

  scheduleOrLog(
    process.env.CRON_DAILY_SUMMARY || '5 0 * * *',
    'daily-summary',
    runDailySummary
  );
}

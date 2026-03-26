/**
 * Marks active tasks as archived when they have not been updated for N days.
 * If ARCHIVE_TASKS_AFTER_MINUTES is set, it wins over ARCHIVE_TASKS_AFTER_DAYS (for quick tests).
 */
export async function runArchiveOldTasks(pool) {
  const minutesRaw = process.env.ARCHIVE_TASKS_AFTER_MINUTES;
  const hasMinutes =
    minutesRaw !== undefined &&
    String(minutesRaw).trim() !== '' &&
    !Number.isNaN(Number(minutesRaw));

  if (hasMinutes) {
    const archiveAfterMinutes = Math.max(0, Number(minutesRaw));
    const result = await pool.query(
      `UPDATE tasks
       SET archived_at = NOW(), updated_at = NOW()
       WHERE deleted_at IS NULL
         AND archived_at IS NULL
         AND updated_at < NOW() - ($1::int * INTERVAL '1 minute')`,
      [archiveAfterMinutes]
    );
    return { archived: result.rowCount, archiveAfterMinutes };
  }

  const days = Number(process.env.ARCHIVE_TASKS_AFTER_DAYS) || 90;

  const result = await pool.query(
    `UPDATE tasks
     SET archived_at = NOW(), updated_at = NOW()
     WHERE deleted_at IS NULL
       AND archived_at IS NULL
       AND updated_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [days]
  );

  return { archived: result.rowCount, archiveAfterDays: days };
}

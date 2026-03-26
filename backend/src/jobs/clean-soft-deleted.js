/**
 * Permanently removes tasks that have been soft-deleted longer than retention.
 * If SOFT_DELETE_RETENTION_MINUTES is set, it wins over SOFT_DELETE_RETENTION_DAYS (for quick tests).
 */
export async function runCleanSoftDeleted(pool) {
  const minutesRaw = process.env.SOFT_DELETE_RETENTION_MINUTES;
  const hasMinutes =
    minutesRaw !== undefined &&
    String(minutesRaw).trim() !== '' &&
    !Number.isNaN(Number(minutesRaw));

  if (hasMinutes) {
    const retentionMinutes = Math.max(0, Number(minutesRaw));
    const result = await pool.query(
      `DELETE FROM tasks
       WHERE deleted_at IS NOT NULL
         AND deleted_at < NOW() - ($1::int * INTERVAL '1 minute')`,
      [retentionMinutes]
    );
    return { purged: result.rowCount, retentionMinutes };
  }

  const retentionDays = Number(process.env.SOFT_DELETE_RETENTION_DAYS) || 30;

  const result = await pool.query(
    `DELETE FROM tasks
     WHERE deleted_at IS NOT NULL
       AND deleted_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [retentionDays]
  );

  return { purged: result.rowCount, retentionDays };
}

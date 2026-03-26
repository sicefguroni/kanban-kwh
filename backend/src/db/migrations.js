/**
 * Idempotent schema migrations applied after base tables exist.
 */
export async function runTaskLifecycleMigrations(client) {
  await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP');
  await client.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at
    ON tasks (deleted_at) WHERE deleted_at IS NOT NULL
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_archived_at
    ON tasks (archived_at) WHERE archived_at IS NOT NULL
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_active
    ON tasks (user_id) WHERE deleted_at IS NULL AND archived_at IS NULL
  `);
}

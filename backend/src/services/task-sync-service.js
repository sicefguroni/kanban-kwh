import { v4 as uuidv4 } from 'uuid';
import { toDate } from './task-service.js';

/**
 * @param {import('pg').PoolClient} client
 * @param {object} options
 * @param {string} options.userId
 * @param {Array} options.actions
 * @param {function} options.broadcastTaskEvent
 */
export async function processTaskSync(client, { userId, actions, broadcastTaskEvent }) {
  const results = [];

  for (const item of actions) {
    const actionType = item?.action;
    const updatedAt = toDate(item?.updated_at);

    if (actionType === 'create') {
      const task = item.task || {};
      const taskId = task.id || item.taskId || uuidv4();
      const createdAt = toDate(task.created_at || updatedAt);

      const result = await client.query(
        `INSERT INTO tasks (id, user_id, title, description, status, position, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id)
         DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           position = EXCLUDED.position,
           deleted_at = NULL,
           archived_at = NULL,
           updated_at = EXCLUDED.updated_at
         WHERE tasks.updated_at <= EXCLUDED.updated_at
         RETURNING id, user_id, title, description, status, position, created_at, updated_at`,
        [
          taskId,
          userId,
          task.title || '',
          task.description || '',
          task.status || 'todo',
          Number.isFinite(task.order) ? task.order : 0,
          createdAt,
          updatedAt
        ]
      );

      results.push({
        queue_id: item.queue_id,
        action: actionType,
        status: result.rows.length ? 'applied' : 'skipped'
      });

      if (result.rows.length) {
        broadcastTaskEvent(result.rows[0], 'TASK_CREATED', userId);
      }
      continue;
    }

    if (actionType === 'update' || actionType === 'move') {
      const task = item.task || {};
      const taskId = item.taskId || task.id;

      const result = await client.query(
        `UPDATE tasks
         SET
           title = COALESCE($3, title),
           description = COALESCE($4, description),
           status = COALESCE($5, status),
           position = COALESCE($6, position),
           updated_at = $7
         WHERE id = $1
           AND user_id = $2
           AND deleted_at IS NULL
           AND archived_at IS NULL
           AND updated_at <= $7
         RETURNING id, user_id, title, description, status, position, created_at, updated_at`,
        [
          taskId,
          userId,
          task.title ?? null,
          task.description ?? null,
          task.status ?? null,
          Number.isFinite(task.order) ? task.order : null,
          updatedAt
        ]
      );

      results.push({
        queue_id: item.queue_id,
        action: actionType,
        status: result.rows.length ? 'applied' : 'skipped'
      });

      if (result.rows.length) {
        broadcastTaskEvent(result.rows[0], 'TASK_UPDATED', userId);
      }
      continue;
    }

    if (actionType === 'delete') {
      const taskId = item.taskId || item.task?.id;
      const deleteResult = await client.query(
        `UPDATE tasks
         SET deleted_at = $3, updated_at = $3
         WHERE id = $1
           AND user_id = $2
           AND deleted_at IS NULL
           AND updated_at <= $4`,
        [taskId, userId, updatedAt, updatedAt]
      );

      results.push({
        queue_id: item.queue_id,
        action: actionType,
        status: 'applied'
      });

      if (deleteResult.rowCount > 0) {
        broadcastTaskEvent({ id: taskId, user_id: userId }, 'TASK_DELETED', userId);
      }
      continue;
    }

    results.push({
      queue_id: item.queue_id,
      action: actionType,
      status: 'skipped',
      reason: 'unknown_action'
    });
  }

  return results;
}

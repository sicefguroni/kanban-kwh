import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool, { isDbReady, trySetDbReady } from '../db/connection.js';
import { broadcastTaskEvent } from '../websocket/handler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(async (req, res, next) => {
  if (!isDbReady()) {
    const ok = await trySetDbReady({ timeoutMs: 800 });
    if (!ok) {
      return res.status(503).json({
        error: 'Database unavailable',
        message: 'PostgreSQL is not reachable yet. Try again in a few seconds.'
      });
    }
  }
  next();
});

function isDbConnError(error) {
  const message = String(error?.message || '');
  return error?.code === 'ECONNREFUSED' || message.includes('ECONNREFUSED');
}

function toDate(value) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
// All task routes require JWT authentication
router.use(authMiddleware);

// ===== PROTECTED TASK ROUTES =====

// Get all tasks for authenticated user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, title, description, status, position, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY position ASC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get all tasks for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, title, description, status, position, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY position ASC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get tasks by status
router.get('/status/:status', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, title, description, status, position, created_at, updated_at FROM tasks WHERE status = $1 ORDER BY position ASC',
      [req.params.status]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, title, description, status, position, created_at, updated_at FROM tasks WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch task' });
  }
});

// Create task
router.post('/', async (req, res) => {
  const { id: incomingId, userId, title, description, status = 'todo', position = 0, updated_at } = req.body;

  const ownerId = userId || req.userId;

  if (!ownerId || !title) {
    return res.status(400).json({ error: 'userId and title are required' });
  }

  const id = incomingId || uuidv4();
  const now = toDate(updated_at);

  try {
    // Verify user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [ownerId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(
      'INSERT INTO tasks (id, user_id, title, description, status, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, user_id, title, description, status, position, created_at, updated_at',
      [id, ownerId, title, description, status, position, now, now]
    );
    
    const task = result.rows[0];
    
    // Broadcast task created event
    broadcastTaskEvent(task, 'TASK_CREATED', ownerId);
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  const { title, description, status, position, updated_at } = req.body;
  const now = toDate(updated_at);

  try {
    // First, get the task to find the userId
    const taskCheck = await pool.query(
      'SELECT user_id FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const userId = taskCheck.rows[0].user_id;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      params.push(status);
    }
    if (position !== undefined) {
      updates.push(`position = $${paramCount++}`);
      params.push(position);
    }

    updates.push(`updated_at = $${paramCount++}`);
    params.push(now);
    // `paramCount` now points at the next SQL placeholder index, which will
    // be used for the `id` in the WHERE clause below.
    const idParamIndex = paramCount;
    params.push(req.params.id);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    let whereClause = `id = $${idParamIndex} AND user_id = $${idParamIndex + 1}`;
    params.push(req.userId);

    if (updated_at !== undefined) {
      whereClause += ` AND updated_at <= $${idParamIndex + 2}`;
      params.push(now);
    }

    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE ${whereClause} RETURNING id, user_id, title, description, status, position, created_at, updated_at`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(200).json({ skipped: true, reason: 'stale_write' });
    }

    const task = result.rows[0];
    
    // Broadcast task updated event
    broadcastTaskEvent(task, 'TASK_UPDATED', userId);
    
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    // First, get the task to find the userId
    const taskCheck = await pool.query(
      'SELECT id, user_id FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { id, user_id } = taskCheck.rows[0];

    // Delete the task
    await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);

    // Broadcast task deleted event
    broadcastTaskEvent({ id, user_id }, 'TASK_DELETED', user_id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to delete task' });
  }
});

// Offline-first batch sync endpoint (Outbox processing)
router.post('/sync', async (req, res) => {
  const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];

  if (actions.length === 0) {
    return res.status(400).json({ error: 'actions array is required' });
  }

  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

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
             updated_at = EXCLUDED.updated_at
           WHERE tasks.updated_at <= EXCLUDED.updated_at
           RETURNING id, user_id, title, description, status, position, created_at, updated_at`,
          [
            taskId,
            req.userId,
            task.title || '',
            task.description || '',
            task.status || 'todo',
            Number.isFinite(task.order) ? task.order : 0,
            createdAt,
            updatedAt,
          ]
        );

        results.push({
          queue_id: item.queue_id,
          action: actionType,
          status: result.rows.length ? 'applied' : 'skipped',
        });

        if (result.rows.length) {
          broadcastTaskEvent(result.rows[0], 'TASK_CREATED', req.userId);
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
             AND updated_at <= $7
           RETURNING id, user_id, title, description, status, position, created_at, updated_at`,
          [
            taskId,
            req.userId,
            task.title ?? null,
            task.description ?? null,
            task.status ?? null,
            Number.isFinite(task.order) ? task.order : null,
            updatedAt,
          ]
        );

        results.push({
          queue_id: item.queue_id,
          action: actionType,
          status: result.rows.length ? 'applied' : 'skipped',
        });

        if (result.rows.length) {
          broadcastTaskEvent(result.rows[0], 'TASK_UPDATED', req.userId);
        }
        continue;
      }

      if (actionType === 'delete') {
        const taskId = item.taskId || item.task?.id;
        const deleteResult = await client.query(
          `DELETE FROM tasks
           WHERE id = $1
             AND user_id = $2
             AND updated_at <= $3`,
          [taskId, req.userId, updatedAt]
        );

        results.push({
          queue_id: item.queue_id,
          action: actionType,
          status: 'applied',
        });

        if (deleteResult.rowCount > 0) {
          broadcastTaskEvent({ id: taskId, user_id: req.userId }, 'TASK_DELETED', req.userId);
        }
        continue;
      }

      results.push({
        queue_id: item.queue_id,
        action: actionType,
        status: 'skipped',
        reason: 'unknown_action',
      });
    }

    await client.query('COMMIT');
    res.json({ success: true, results });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error syncing tasks:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to sync tasks' });
  } finally {
    client.release();
  }
});

export default router;

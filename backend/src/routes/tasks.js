import express from 'express';
import pool, { isDbReady, trySetDbReady } from '../db/connection.js';
import { broadcastTaskEvent } from '../websocket/handler.js';
import { authMiddleware } from '../middleware/AuthService.js';
import {
  listTasksForUser,
  listTasksByUserId,
  listTasksByStatus,
  getTaskById,
  createTask,
  updateTaskForUser,
  softDeleteTask,
  toDate
} from '../services/task-service.js';
import { processTaskSync } from '../services/task-sync-service.js';

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

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await listTasksForUser(req.userId);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const result = await listTasksByUserId(req.params.userId);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/status/:status', async (req, res) => {
  try {
    const result = await listTasksByStatus(req.params.status);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await getTaskById(req.params.id);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch task' });
  }
});

router.post('/', async (req, res) => {
  const { id: incomingId, userId, title, description, status = 'todo', position = 0, updated_at } =
    req.body;

  const ownerId = userId || req.userId;

  if (!ownerId || !title) {
    return res.status(400).json({ error: 'userId and title are required' });
  }

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [ownerId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await createTask({
      id: incomingId,
      ownerId,
      title,
      description,
      status,
      position,
      updated_at
    });

    const task = result.rows[0];
    broadcastTaskEvent(task, 'TASK_CREATED', ownerId);
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to create task' });
  }
});

router.put('/:id', async (req, res) => {
  const { title, description, status, position, updated_at } = req.body;

  if (
    title === undefined &&
    description === undefined &&
    status === undefined &&
    position === undefined
  ) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const result = await updateTaskForUser({
      taskId: req.params.id,
      userId: req.userId,
      title,
      description,
      status,
      position,
      updated_at
    });

    if (result.rows.length === 0) {
      return res.status(200).json({ skipped: true, reason: 'stale_write' });
    }

    const task = result.rows[0];
    broadcastTaskEvent(task, 'TASK_UPDATED', task.user_id || req.userId);
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await softDeleteTask(req.params.id, req.userId);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { id, user_id } = result.rows[0];
    broadcastTaskEvent({ id, user_id }, 'TASK_DELETED', user_id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to delete task' });
  }
});

router.post('/sync', async (req, res) => {
  const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];

  if (actions.length === 0) {
    return res.status(400).json({ error: 'actions array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = await processTaskSync(client, {
      userId: req.userId,
      actions,
      broadcastTaskEvent
    });
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

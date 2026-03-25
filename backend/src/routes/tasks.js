import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { broadcastTaskEvent } from '../websocket/handler.js';

const router = express.Router();

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
    res.status(500).json({ error: 'Failed to fetch tasks' });
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
    res.status(500).json({ error: 'Failed to fetch tasks' });
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
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create task
router.post('/', async (req, res) => {
  const { userId, title, description, status = 'todo', position = 0 } = req.body;

  if (!userId || !title) {
    return res.status(400).json({ error: 'userId and title are required' });
  }

  const id = uuidv4();
  const now = new Date();

  try {
    // Verify user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(
      'INSERT INTO tasks (id, user_id, title, description, status, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, user_id, title, description, status, position, created_at, updated_at',
      [id, userId, title, description, status, position, now, now]
    );
    
    const task = result.rows[0];
    
    // Broadcast task created event
    broadcastTaskEvent(task, 'TASK_CREATED', userId);
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  const { title, description, status, position } = req.body;
  const now = new Date();

  try {
    // First, get the task to find the userId
    const taskCheck = await pool.query(
      'SELECT user_id FROM tasks WHERE id = $1',
      [req.params.id]
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
    params.push(req.params.id);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, user_id, title, description, status, position, created_at, updated_at`;
    const result = await pool.query(query, params);

    const task = result.rows[0];
    
    // Broadcast task updated event
    broadcastTaskEvent(task, 'TASK_UPDATED', userId);
    
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    // First, get the task to find the userId
    const taskCheck = await pool.query(
      'SELECT id, user_id FROM tasks WHERE id = $1',
      [req.params.id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { id, user_id } = taskCheck.rows[0];

    // Delete the task
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);

    // Broadcast task deleted event
    broadcastTaskEvent({ id, user_id }, 'TASK_DELETED', user_id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;

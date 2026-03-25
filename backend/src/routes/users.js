import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool, { isDbReady, trySetDbReady } from '../db/connection.js';

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

// Get all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, created_at, updated_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by email (must come before /:id route)
router.get('/email/:email', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, created_at, updated_at FROM users WHERE email = $1', [req.params.email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch user' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to fetch user' });
  }
});

// Create user
router.post('/', async (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  const id = uuidv4();
  const now = new Date();

  try {
    const result = await pool.query(
      'INSERT INTO users (id, email, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, created_at, updated_at',
      [id, email, name, now, now]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Error creating user:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  const { name } = req.body;
  const now = new Date();

  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = $2 WHERE id = $3 RETURNING id, email, name, created_at, updated_at',
      [name, now, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(isDbConnError(error) ? 503 : 500).json({ error: 'Failed to delete user' });
  }
});

export default router;

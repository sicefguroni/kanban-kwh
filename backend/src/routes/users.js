import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import pool from '../db/connection.js';
import AuthService, { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ===== PUBLIC ROUTES =====

// Register user
router.post('/register', async (req, res) => {
  const { email, name, password } = req.body;
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
    res.status(500).json({ error: 'Failed to fetch user' });
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
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const id = uuidv4();
  const now = new Date();

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (id, email, password, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, created_at, updated_at',
      [id, email, hashedPassword, name, now, now]
    );

    // Generate JWT token
    const token = AuthService.generateToken(id);

    res.status(201).json({
      user: result.rows[0],
      token
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password, name, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = AuthService.generateToken(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// ===== PROTECTED ROUTES =====

// Get current user (requires auth)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;


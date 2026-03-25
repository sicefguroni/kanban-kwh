import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import initializeDatabase from './db/init.js';
import pool from './db/connection.js';
import usersRouter from './routes/users.js';
import tasksRouter from './routes/tasks.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function start() {
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✓ Connected to PostgreSQL');
    client.release();

    // Initialize database schema
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
      console.log('\nAvailable endpoints:');
      console.log('  GET    /api/users - Get all users');
      console.log('  GET    /api/users/:id - Get user by ID');
      console.log('  POST   /api/users - Create user');
      console.log('  PUT    /api/users/:id - Update user');
      console.log('  DELETE /api/users/:id - Delete user');
      console.log('');
      console.log('  GET    /api/tasks/user/:userId - Get tasks for user');
      console.log('  GET    /api/tasks/status/:status - Get tasks by status');
      console.log('  GET    /api/tasks/:id - Get task by ID');
      console.log('  POST   /api/tasks - Create task');
      console.log('  PUT    /api/tasks/:id - Update task');
      console.log('  DELETE /api/tasks/:id - Delete task');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

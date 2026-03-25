import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import initializeDatabase from './db/init.js';
import pool from './db/connection.js';
import usersRouter from './routes/users.js';
import tasksRouter from './routes/tasks.js';
import { initializeWebSocket } from './websocket/handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');

dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3001;
const server = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// OPTIONS preflight handler for CORS
app.options('*', cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'KWH Kanban API',
    version: '1.0.0'
  });
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
    // Initialize WebSocket server
    initializeWebSocket(server);
    
    // Try to connect to database (non-blocking)
    let dbConnected = false;
    try {
      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      console.log('✓ Connected to PostgreSQL');
      client.release();
      dbConnected = true;
      await initializeDatabase();
    } catch (dbError) {
      console.warn('⚠ Could not connect to database:', dbError.message);
    }

    server.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ WebSocket available at ws://localhost:${PORT}`);
      console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
      console.log('');
      if (dbConnected) {
        console.log('✓ Database connected');
      } else {
        console.log('⚠ Database not available - restart after PostgreSQL is running');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();

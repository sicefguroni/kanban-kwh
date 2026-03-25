import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import initializeGoogleStrategy from './middleware/google-oauth.js';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import initializeDatabase from './db/init.js';
import pool from './db/connection.js';
import usersRouter from './routes/users.js';
import tasksRouter from './routes/tasks.js';
import { initializeWebSocket } from './websocket/handler.js';
import { setDbReady } from './db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');

dotenv.config({ path: envPath, override: true });

const app = express();
const PORT = process.env.PORT || 3001;
const server = createServer(app);

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

const envOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URLS,
  process.env.CORS_ALLOWED_ORIGINS
]
  .filter(Boolean)
  .flatMap((value) => value.split(',').map((origin) => origin.trim()))
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

const defaultAllowedOriginPatterns = process.env.NODE_ENV === 'production'
  ? []
  : [
      /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i,
      /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/i
    ];

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (e.g. curl/Postman) that don't send an Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowedOrigin =
      allowedOrigins.includes(origin) ||
      defaultAllowedOriginPatterns.some((pattern) => pattern.test(origin));

    if (isAllowedOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
};

// Initialize Passport with Google OAuth strategy
initializeGoogleStrategy(passport);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
// OPTIONS preflight handler for CORS
app.options('*', cors(corsOptions));

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

// Google OAuth endpoint - only if configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/api/users/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/users/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html' }),
    (req, res) => {
      const user = req.user;
      const token = user.token;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login.html?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
    }
  );
}

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
      setDbReady(true);
      await initializeDatabase();
    } catch (dbError) {
      console.warn('⚠ Could not connect to database:', dbError.message);
      setDbReady(false);
    }

    server.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ WebSocket available at ws://localhost:${PORT}`);
      console.log(`✓ API Base URL: http://localhost:${PORT}/api`);
      console.log('\n📋 Authentication Methods:');
      console.log('  ✓ Email/Password login');
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        console.log('  ✓ Google OAuth');
      } else {
        console.log('  ⚠️  Google OAuth (not configured)');
      }
      console.log('\n📍 Available endpoints:');
      console.log('  POST   /api/users/register - Register new user');
      console.log('  POST   /api/users/login - Login user');
      console.log('  GET    /api/users/me - Get current user (requires auth)');
      console.log('  GET    /api/users - Get all users (requires auth)');
      console.log('  GET    /api/users/:id - Get user by ID (requires auth)');
      console.log('  PUT    /api/users/:id - Update user (requires auth)');
      console.log('  DELETE /api/users/:id - Delete user (requires auth)');
      console.log('');
      console.log('  GET    /api/tasks/user/:userId - Get tasks for user (requires auth)');
      console.log('  GET    /api/tasks - Get tasks for current user (requires auth)');
      console.log('  GET    /api/tasks/status/:status - Get tasks by status (requires auth)');
      console.log('  GET    /api/tasks/:id - Get task by ID (requires auth)');
      console.log('  POST   /api/tasks - Create task (requires auth)');
      console.log('  POST   /api/tasks/sync - Batch sync offline actions (requires auth)');
      console.log('  PUT    /api/tasks/:id - Update task (requires auth)');
      console.log('  DELETE /api/tasks/:id - Delete task (requires auth)');
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

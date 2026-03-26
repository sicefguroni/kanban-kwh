/**
 * Console banner after HTTP server listens (keeps server.js small).
 */
export function printStartupBanner(port, { dbConnected, googleOAuth }) {
  console.log(`✓ Server running on http://localhost:${port}`);
  console.log(`✓ WebSocket available at ws://localhost:${port}`);
  console.log(`✓ API Base URL: http://localhost:${port}/api`);
  console.log('\n📋 Authentication Methods:');
  console.log('  ✓ Email/Password login');
  console.log(googleOAuth ? '  ✓ Google OAuth' : '  ⚠️  Google OAuth (not configured)');
  console.log('\n📍 Available endpoints:');
  console.log('  POST   /api/users/register - Register new user');
  console.log('  POST   /api/users/login - Login user');
  console.log('  GET    /api/users/me - Get current user (requires auth)');
  console.log('  GET    /api/users - Get all users');
  console.log('  GET    /api/users/:id - Get user by ID');
  console.log('');
  console.log('  GET    /api/tasks/user/:userId - Get tasks for user (requires auth)');
  console.log('  GET    /api/tasks - Get tasks for current user (requires auth)');
  console.log('  GET    /api/tasks/status/:status - Get tasks by status (requires auth)');
  console.log('  GET    /api/tasks/:id - Get task by ID (requires auth)');
  console.log('  POST   /api/tasks - Create task (requires auth)');
  console.log('  POST   /api/tasks/sync - Batch sync offline actions (requires auth)');
  console.log('  PUT    /api/tasks/:id - Update task (requires auth)');
  console.log('  DELETE /api/tasks/:id - Soft-delete task (requires auth)');
  console.log('');
  console.log('  Rate limiting: /api (IP), login/register (IP + email key)');
  console.log('  Cron: clean soft-deletes, archive stale tasks, daily summary (if DB up)');
  console.log('');
  if (dbConnected) {
    console.log('✓ Database connected');
  } else {
    console.log('⚠ Database not available - restart after PostgreSQL is running');
  }
}

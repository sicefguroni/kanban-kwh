# Backend Setup Guide - PostgreSQL + Node.js/Express

This guide will help you set up the PostgreSQL database and Node.js backend for the KWH Kanban board.

## Prerequisites

### 1. Check if PostgreSQL is Installed

**On Windows (PowerShell):**
```powershell
psql --version
```

If it shows a version, PostgreSQL is installed. If not, proceed to install it.

### 2. Install PostgreSQL (if needed)

**Windows:**
- Download from: https://www.postgresql.org/download/windows/
- Use the official installer and follow the setup wizard
- **Remember the password** you set for the `postgres` user during installation
- Default port is `5432`

**After Installation:**
Verify PostgreSQL is running:
```powershell
# Test connection
psql -U postgres -c "SELECT version();"
```

## Backend Setup

### 1. Navigate to Backend Directory
```powershell
cd backend
```

### 2. Install Dependencies
```powershell
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend/` directory (copy from `.env.example`):
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kwh_kanban
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
# Optional: add more frontend origins for CORS (comma-separated)
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5500
```

Replace `your_password_here` with the PostgreSQL password you set during installation.

### 4. Create the Database

**Using psql (Windows PowerShell):**
```powershell
psql -U postgres -c "CREATE DATABASE kwh_kanban;"
```

You'll be prompted for the PostgreSQL password.

### 5. Initialize Database Schema

From the `backend/` directory:
```powershell
npm run db:init
```

This will create the `users` and `tasks` tables with the proper schema.

### 6. Start the Backend Server

```powershell
npm run dev
```

You should see output like:
```
✓ Connected to PostgreSQL
✓ Database schema initialized successfully
✓ Server running on http://localhost:3001
✓ API Base URL: http://localhost:3001/api
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Key Features:
- **UUID**: Globally unique identifiers for all records
- **updated_at**: Timestamp for every record update (essential for offline/online sync conflict resolution)
- **Cascading delete**: Deleting a user automatically deletes their tasks
- **Indexes**: Optimized queries for user_id, status, and updated_at lookups

## API Endpoints

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create a new user
  - Body: `{ email: string, name: string }`
- `PUT /api/users/:id` - Update user
  - Body: `{ name: string }`
- `DELETE /api/users/:id` - Delete user

### Tasks

- `GET /api/tasks/user/:userId` - Get all tasks for a user
- `GET /api/tasks/status/:status` - Get tasks by status (todo, in-progress, done)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create a new task
  - Body: `{ userId: string, title: string, description?: string, status?: string, position?: number }`
- `PUT /api/tasks/:id` - Update task
  - Body: `{ title?: string, description?: string, status?: string, position?: number }`
- `DELETE /api/tasks/:id` - Delete task

## Example Requests (using fetch)

### Create a User
```javascript
const user = await fetch('http://localhost:3001/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', name: 'John Doe' })
}).then(r => r.json());
console.log(user.id); // UUID
```

### Create a Task
```javascript
const task = await fetch('http://localhost:3001/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-uuid-here',
    title: 'My First Task',
    description: 'This is a test task',
    status: 'todo'
  })
}).then(r => r.json());
```

### Get Tasks for a User
```javascript
const tasks = await fetch('http://localhost:3001/api/tasks/user/user-uuid-here')
  .then(r => r.json());
```

### Update Task (for offline sync)
```javascript
const updated = await fetch('http://localhost:3001/api/tasks/task-uuid', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'in-progress'
  })
}).then(r => r.json());

console.log(updated.updated_at); // Use this to detect conflicts
```

## Offline/Online Sync Strategy

The `updated_at` timestamp is crucial for sync:

1. **Store locally** with `updated_at` timestamp
2. **When syncing**, compare local `updated_at` with server `updated_at`
3. **If server is newer**, server wins (or implement conflict resolution)
4. **If local is newer**, send update to server

Example sync logic:
```javascript
// Check if server data is newer
if (serverData.updated_at > localData.updated_at) {
  // Use server data
  localData = serverData;
} else if (localData.updated_at > serverData.updated_at) {
  // Push local changes to server
  await updateOnServer(localData);
}
```

## Useful Commands

```powershell
# Start dev server with auto-reload
npm run dev

# Start production server
npm start

# Initialize/reset database
npm run db:init
npm run db:reset

# Connect to database directly with psql
psql -U postgres -d kwh_kanban
```

## Troubleshooting

### "Connection refused" error
- Verify PostgreSQL is running
- Check DB_HOST, DB_PORT, and DB_NAME in .env
- Ensure the database exists: `psql -U postgres -c "SELECT datname FROM pg_database WHERE datname='kwh_kanban';"`

### "database does not exist" error
- Create it: `psql -U postgres -c "CREATE DATABASE kwh_kanban;"`

### "password authentication failed"
- Verify the password in .env matches your PostgreSQL password
- Check that you're using the correct DB_USER (usually "postgres")

### Port 3001 already in use
- Change PORT in .env
- Or kill the process using the port: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process`

## Next Steps

1. Update your frontend to use these API endpoints instead of localStorage
2. Implement connection logic in your dashboard service
3. Add authentication/authorization as needed
4. Implement offline sync queuing for better UX

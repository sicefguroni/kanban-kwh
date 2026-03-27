# Kanban Board by KWH

A task management Kanban board with drag-and-drop, keyboard navigation, and mobile-friendly drop zones.

## Folder Structure

```text
kanban-kwh/
├── components/          # Reusable UI components (one folder per component)
│   ├── button/
│   │   ├── button.html
│   │   ├── button.css
│   │   └── button.js
│   ├── card/
│   ├── column/
│   ├── delete-modal/
│   ├── modal/
│   └── modal-field/
├── pages/               # Page-level views
│   └── dashboard/
│       ├── dashboard.html
│       ├── dashboard.css
│       ├── dashboard.js           # Main dashboard controller
│       ├── dashboard-dom.js        # DOM helpers for dashboard
│       ├── dashboard-modal.js      # Create/edit task modal logic
│       ├── dashboard-delete-modal.js
│       ├── dashboard-render.js     # Task list rendering
│       ├── dashboard-keyboard.js   # Keyboard shortcuts
│       ├── dashboard-proximity.js # Drag proximity snapping
│       └── constants.js
├── services/            # Business logic and data
│   └── storage-service.js         # localStorage for tasks
├── utils/               # Pure utilities
│   └── format-date.js
├── styles/
│   └── base.css         # Global variables and reset
├── index.html
└── DOCUMENTATION.md     # Clean Code guidelines and architecture
```

- **components**: Each component has its own folder with `.html`, `.css`, and `.js`. No subfolders when a folder has fewer than ~7 files.
- **pages**: Dashboard is split by responsibility (DOM, modal, render, keyboard, proximity).
- **services**: Storage and future API/auth live here.
- **utils**: Shared helpers with no DOM or app state.

## Quick Setup

For remote access from another laptop using ngrok, see [NGROK_REMOTE_SETUP.md](NGROK_REMOTE_SETUP.md).

### 1. Clone repository

```bash
git clone https://github.com/sicefguroni/kanban-kwh.git
cd kanban-kwh
```

### 2. Run locally

- **Option A:** Use the "Live Server" extension in VS Code / Cursor: right-click `index.html` → "Open with Live Server".
- **Option B:** Any static server from the project root, e.g. `npx serve .` or `python -m http.server 8000`.

### 3. Open in browser

- With Live Server: `http://127.0.0.1:5500/` (or the port shown).
- With other servers: use the URL and port your tool reports.

## REST API (Tasks)

An Express REST API is included for testing task CRUD + move/reorder.

### Run the API

- `npm install`
- `npm run dev` (or `npm start`)

By default the server runs on `http://127.0.0.1:3001`.
Task data is persisted to `data/tasks.json`.

### Endpoints

- `GET /health` → `{ ok: true }`
- `GET /tasks?status=To%20Do` → list of tasks ordered by `order`
- `GET /tasks/:id` → a single task
- `POST /tasks`
  - Body: `{ title, description?, status, deadline? }`
- `PATCH /tasks/:id`
  - Body: `{ title?, description?, deadline? }`
  - Note: status/order changes should use the move endpoint
- `POST /tasks/:id/move`
  - Body: `{ newStatus, insertIndex? }`
- `DELETE /tasks/:id` → `{ deletedId }`

### API testing (curl / Postman)

On Windows/PowerShell, it is easiest to use `Invoke-RestMethod` (it correctly formats JSON).

#### Health check

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/health" | ConvertTo-Json -Compress
```

#### Create a task

```powershell
$body = @{
  title = "Task 1"
  description = "First task"
  status = "To Do"
  deadline = "2026-03-25"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/tasks" -ContentType "application/json" -Body $body |
  ConvertTo-Json -Compress
```

#### List tasks by status

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/tasks?status=To%20Do" |
  ConvertTo-Json -Compress
```

#### Move a task (replace `$id`)

```powershell
$id = "TASK_ID"
$body = @{
  newStatus = "Done"
  insertIndex = 0
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/tasks/$id/move" -ContentType "application/json" -Body $body |
  ConvertTo-Json -Compress
```

#### Delete a task (replace `$id`)

```powershell
$id = "TASK_ID"
Invoke-RestMethod -Method Delete -Uri "http://127.0.0.1:3001/tasks/$id" |
  ConvertTo-Json -Compress
```

#### Postman (quick)

Create a request per endpoint above, set `Body -> raw -> JSON` for `POST/PATCH`, and send.

## Features

- **Columns:** To Do, In Progress, Done (red / yellow / blue theme).
- **Tasks:** Add, edit, delete; optional description and deadline.
- **Drag and drop:** Between columns; reorder within a column; proximity snapping on desktop.
- **Mobile:** Bottom drop bar (bins) when dragging; full-screen drop target.
- **Keyboard:** Arrows and 1/2/3 to move; Enter to toggle done; Shift+Enter new task; Shift+arrows to move cards; `e` edit, `d` delete; `?` shortcuts panel.

## Conventions

- See **DOCUMENTATION.md** for Clean Code guidelines (naming, file organization, BEM, function rules, error handling).

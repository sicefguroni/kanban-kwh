# Kanban Board by KWH

A task management Kanban board with drag-and-drop, keyboard navigation, and mobile-friendly drop zones.

## Folder Structure

```text
kanban-kwh/
├── components/          # Reusable UI (PascalCase assets per component)
│   ├── button/
│   │   ├── Button.html
│   │   ├── Button.css
│   │   └── Button.js
│   ├── card/
│   │   ├── KanbanCard.html
│   │   ├── KanbanCard.css
│   │   └── KanbanCard.js
│   ├── column/
│   │   ├── KanbanColumn.html
│   │   ├── KanbanColumn.css
│   │   └── KanbanColumn.js
│   ├── auth/
│   │   ├── AuthComponent.css
│   │   └── AuthComponent.js
│   ├── delete-modal/
│   ├── modal/
│   └── modal-field/
├── pages/
│   └── dashboard/
│       ├── KanbanDashboard.html
│       ├── KanbanDashboard.css
│       ├── DashboardKeyboard.css
│       ├── DashboardMobile.css
│       ├── KanbanDashboard.js      # KanbanDashboard class — page controller
│       ├── Constants.js
│       ├── dom/
│       │   ├── DashboardDOM.js
│       │   └── DashboardRender.js
│       ├── modals/
│       │   ├── DashboardModal.js
│       │   └── DashboardDeleteModal.js
│       └── interactions/
│           ├── DashboardKeyboard.js
│           ├── DashboardProximity.js
│           ├── MobileDrop.js
│           └── WebSocketIntegration.js
├── services/            # Singletons / services (PascalCase .js)
│   ├── StorageService.js
│   ├── APIService.js
│   ├── AuthService.js
│   ├── SyncManager.js
│   └── WebSocketService.js
├── utils/
│   └── FormatDate.js
├── styles/
│   └── base.css
├── index.html
└── DOCUMENTATION.md
```

- **Naming:** Primary JS/CSS/HTML names follow **PascalCase** and align with the main **class** or module role (e.g. `KanbanDashboard.js` ↔ `class KanbanDashboard`).
- **pages**: Dashboard is split by responsibility (DOM, modal, render, keyboard, proximity, mobile drop).
- **services**: Client-side storage, API, auth, sync, and WebSocket.

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
- **Mobile:** Drop targets when dragging; full-screen drop overlay.
- **Keyboard:** Arrows and 1/2/3 to move; Enter to toggle done; Shift+Enter new task; Shift+arrows to move cards; `e` edit, `d` delete; `?` shortcuts panel.

## Conventions

- See **DOCUMENTATION.md** for Clean Code guidelines (naming, file organization, BEM, function rules, error handling).

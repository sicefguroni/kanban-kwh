# Kanban Board by KWH

A task management Kanban board with drag-and-drop, keyboard navigation, and mobile-friendly drop zones.

## Folder Structure

```
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

## Features

- **Columns:** To Do, In Progress, Done (red / yellow / blue theme).
- **Tasks:** Add, edit, delete; optional description and deadline.
- **Drag and drop:** Between columns; reorder within a column; proximity snapping on desktop.
- **Mobile:** Bottom drop bar (bins) when dragging; full-screen drop target.
- **Keyboard:** Arrows and 1/2/3 to move; Enter to toggle done; Shift+Enter new task; Shift+arrows to move cards; `e` edit, `d` delete; `?` shortcuts panel.

## Conventions

- See **DOCUMENTATION.md** for Clean Code guidelines (naming, file organization, BEM, function rules, error handling).

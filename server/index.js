const express = require('express');
const cors = require('cors');
const path = require('path');

const { TasksStore, STATUSES } = require('./tasksStore');

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const TASKS_DB_PATH = process.env.TASKS_DB_PATH
    ? String(process.env.TASKS_DB_PATH)
    : path.join(__dirname, '..', 'data', 'tasks.json');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }));

const store = new TasksStore({ dbPath: TASKS_DB_PATH });

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/tasks', (req, res) => {
    const status = req.query.status;
    if (status !== undefined) {
        if (!STATUSES.includes(String(status))) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Invalid status. Allowed: ${STATUSES.join(', ')}`,
            });
        }
        return res.json(store.getAll({ status: String(status) }));
    }
    return res.json(store.getAll());
});

app.get('/tasks/:id', (req, res) => {
    const task = store.getById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not Found', message: 'Task not found' });
    return res.json(task);
});

app.post('/tasks', async (req, res) => {
    const { title, description, status, deadline } = req.body || {};
    const created = await store.create({ title, description, status, deadline });
    if (!created) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid task payload. Ensure `title` is non-empty and `status` is one of allowed values.',
        });
    }
    return res.status(201).json(created);
});

app.patch('/tasks/:id', async (req, res) => {
    const { title, description, deadline, status } = req.body || {};

    // Keep status changes explicit via the move endpoint.
    if (status !== undefined) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Use POST /tasks/:id/move to change task status/order.',
        });
    }

    const updated = await store.update(req.params.id, { title, description, deadline });
    if (!updated) return res.status(404).json({ error: 'Not Found', message: 'Task not found or invalid fields' });
    return res.json(updated);
});

app.post('/tasks/:id/move', async (req, res) => {
    const { newStatus, insertIndex } = req.body || {};
    const moved = await store.move(req.params.id, { newStatus, insertIndex });
    if (!moved) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid move request. Ensure `newStatus` is allowed and `insertIndex` is an integer.',
        });
    }
    return res.json(moved);
});

app.delete('/tasks/:id', async (req, res) => {
    const deleted = await store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not Found', message: 'Task not found' });
    return res.json({ deletedId: req.params.id });
});

// Centralized error handler (for unexpected errors).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    const isJsonParse =
        err?.type === 'entity.parse.failed' ||
        err instanceof SyntaxError;

    if (isJsonParse) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid JSON payload.',
            details: err?.message || String(err),
        });
    }

    return res.status(500).json({ error: 'Internal Server Error' });
});

async function start() {
    await store.load();
    app.listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`Kanban REST API running on http://127.0.0.1:${PORT}`);
    });
}

start();


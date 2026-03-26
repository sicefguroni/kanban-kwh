import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';

const ROW =
  'id, user_id, title, description, status, position, created_at, updated_at';
const ACTIVE = 'deleted_at IS NULL AND archived_at IS NULL';

export function toDate(value) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function listTasksForUser(userId) {
  return pool.query(
    `SELECT ${ROW} FROM tasks WHERE user_id = $1 AND ${ACTIVE} ORDER BY position ASC`,
    [userId]
  );
}

export async function listTasksByUserId(userId) {
  return pool.query(
    `SELECT ${ROW} FROM tasks WHERE user_id = $1 AND ${ACTIVE} ORDER BY position ASC`,
    [userId]
  );
}

export async function listTasksByStatus(status) {
  return pool.query(
    `SELECT ${ROW} FROM tasks WHERE status = $1 AND ${ACTIVE} ORDER BY position ASC`,
    [status]
  );
}

export async function getTaskById(taskId) {
  return pool.query(
    `SELECT ${ROW} FROM tasks WHERE id = $1 AND ${ACTIVE}`,
    [taskId]
  );
}

export async function createTask({
  id: incomingId,
  ownerId,
  title,
  description,
  status,
  position,
  updated_at
}) {
  const id = incomingId || uuidv4();
  const now = toDate(updated_at);
  return pool.query(
    `INSERT INTO tasks (id, user_id, title, description, status, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${ROW}`,
    [id, ownerId, title, description, status, position, now, now]
  );
}

export async function updateTaskForUser({
  taskId,
  userId,
  title,
  description,
  status,
  position,
  updated_at
}) {
  const now = toDate(updated_at);
  const updates = [];
  const params = [];
  let paramCount = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramCount++}`);
    params.push(title);
  }
  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    params.push(description);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    params.push(status);
  }
  if (position !== undefined) {
    updates.push(`position = $${paramCount++}`);
    params.push(position);
  }

  updates.push(`updated_at = $${paramCount++}`);
  params.push(now);
  const idParamIndex = paramCount;
  params.push(taskId);

  let whereClause = `id = $${idParamIndex} AND user_id = $${idParamIndex + 1} AND ${ACTIVE}`;
  params.push(userId);

  if (updated_at !== undefined) {
    whereClause += ` AND updated_at <= $${idParamIndex + 2}`;
    params.push(now);
  }

  const query = `UPDATE tasks SET ${updates.join(', ')} WHERE ${whereClause} RETURNING ${ROW}`;
  return pool.query(query, params);
}

export async function softDeleteTask(taskId, userId) {
  const now = new Date();
  return pool.query(
    `UPDATE tasks SET deleted_at = $3, updated_at = $3
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id, user_id`,
    [taskId, userId, now]
  );
}

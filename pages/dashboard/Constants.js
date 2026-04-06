export const COLUMN_STATUSES = ['To Do', 'In Progress', 'Done'];

// Centralized task status constants to avoid string literals throughout the UI logic.
export const TASK_STATUS = {
    TODO: COLUMN_STATUSES[0],
    IN_PROGRESS: COLUMN_STATUSES[1],
    DONE: COLUMN_STATUSES[2],
};

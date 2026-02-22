import { COLUMN_STATUSES } from './constants.js';

const FOCUS_CLASS_COLUMN = 'is-keyboard-focused';
const FOCUS_CLASS_CARD = 'is-keyboard-focused';
const MOBILE_BREAKPOINT = '(max-width: 767px)';

function isMobileView() {
    return window.matchMedia(MOBILE_BREAKPOINT).matches;
}

/**
 * Vim/ricing-style keyboard navigation for the Kanban board.
 * @param {{
 *   columnInstances: Record<string, { element: Element, getCardsContainer: () => Element | null }>,
 *   onEditTask: (taskId: string) => void,
 *   onDeleteTask: (taskId: string) => void,
 *   onCreateTask: (status: string) => void,
 *   onMoveTask: (taskId: string, newStatus: string, insertIndex?: number) => void,
 *   isModalOpen: () => boolean,
 * }} ctx
 */
export function setupKeyboard(ctx) {
    const { columnInstances, onEditTask, onDeleteTask, onCreateTask, onMoveTask, isModalOpen } = ctx;
    let selectedColumnIndex = 0;
    let selectedCardIndex = -1;

    function getColumnElement(index) {
        const status = COLUMN_STATUSES[index];
        return status ? columnInstances[status]?.element : null;
    }

    function getCardElements(columnIndex) {
        const status = COLUMN_STATUSES[columnIndex];
        const container = columnInstances[status]?.getCardsContainer();
        if (!container) return [];
        return Array.from(container.querySelectorAll('.kanban-card'));
    }

    function clearAllFocus() {
        document.querySelectorAll(`.kanban-column.${FOCUS_CLASS_COLUMN}`).forEach((el) => el.classList.remove(FOCUS_CLASS_COLUMN));
        document.querySelectorAll(`.kanban-card.${FOCUS_CLASS_CARD}`).forEach((el) => el.classList.remove(FOCUS_CLASS_CARD));
    }

    function applyFocus() {
        clearAllFocus();
        const $col = getColumnElement(selectedColumnIndex);
        if ($col) {
            $col.classList.add(FOCUS_CLASS_COLUMN);
            $col.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        const cards = getCardElements(selectedColumnIndex);
        const card = cards[selectedCardIndex];
        if (card) {
            card.classList.add(FOCUS_CLASS_CARD);
            card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function clampColumn(i) {
        return Math.max(0, Math.min(COLUMN_STATUSES.length - 1, i));
    }

    function clampCardIndex(i) {
        const cards = getCardElements(selectedColumnIndex);
        if (cards.length === 0) return -1;
        return Math.max(-1, Math.min(cards.length - 1, i));
    }

    function getSelectedTaskId() {
        const cards = getCardElements(selectedColumnIndex);
        const card = cards[selectedCardIndex];
        return card?.dataset?.taskId ?? null;
    }

    function getSelectedCardElement() {
        const cards = getCardElements(selectedColumnIndex);
        return cards[selectedCardIndex] ?? null;
    }

    function showHelp() {
        const existing = document.getElementById('keyboard-help');
        if (existing) {
            existing.classList.toggle('is-visible');
            return;
        }
        const $help = document.createElement('div');
        $help.id = 'keyboard-help';
        $help.className = 'keyboard-help';
        $help.setAttribute('role', 'dialog');
        $help.setAttribute('aria-label', 'Keyboard shortcuts');
        $help.innerHTML = `
            <div class="keyboard-help__backdrop" data-close></div>
            <div class="keyboard-help__panel">
                <div class="keyboard-help__header">
                    <span class="keyboard-help__title">Shortcuts</span>
                    <kbd class="keyboard-help__close">Esc</kbd>
                </div>
                <div class="keyboard-help__grid">
                    <div class="keyboard-help__row"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><span>Jump to column</span></div>
                    <div class="keyboard-help__row"><kbd>←</kbd><kbd>→</kbd><span>Prev / next column</span></div>
                    <div class="keyboard-help__row"><kbd>↑</kbd><kbd>↓</kbd><span>Prev / next card</span></div>
                    <div class="keyboard-help__row"><kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd><span>Move card to prev/next column</span></div>
                    <div class="keyboard-help__row"><kbd>Shift</kbd>+<kbd>↑</kbd><kbd>↓</kbd><span>Move card up/down in column</span></div>
                    <div class="keyboard-help__row"><kbd>Enter</kbd><span>Toggle done (checkbox)</span></div>
                    <div class="keyboard-help__row"><kbd>Shift</kbd>+<kbd>Enter</kbd><span>New task (in selected column)</span></div>
                    <div class="keyboard-help__row"><kbd>e</kbd><span>Edit selected card</span></div>
                    <div class="keyboard-help__row"><kbd>d</kbd><span>Delete selected card</span></div>
                    <div class="keyboard-help__row"><kbd>Esc</kbd><span>Clear card selection</span></div>
                    <div class="keyboard-help__row"><kbd>?</kbd><span>Show this panel</span></div>
                </div>
            </div>
        `;
        document.body.appendChild($help);
        $help.classList.add('is-visible');
        const close = () => $help.classList.remove('is-visible');
        $help.querySelector('[data-close]').addEventListener('click', close);
        $help.querySelector('.keyboard-help__close').addEventListener('click', close);
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', onEsc);
            }
        });
    }

    function handleKeydown(e) {
        if (isModalOpen()) return;
        const target = e.target;

        if (e.key === 'Enter' && !e.shiftKey && target.closest('.kanban-card')) {
            const card = target.closest('.kanban-card');
            const checkbox = card?.querySelector('.kanban-card__checkbox');
            if (checkbox) {
                e.preventDefault();
                checkbox.click();
                return;
            }
        }
        if (target.closest('input, textarea, select') || target.isContentEditable) return;

        const $help = document.getElementById('keyboard-help');
        if ($help?.classList.contains('is-visible')) {
            if (e.key === 'Escape') $help.classList.remove('is-visible');
            return;
        }
        switch (e.key) {
            case '?':
                e.preventDefault();
                showHelp();
                return;
            case 'Escape':
                e.preventDefault();
                selectedCardIndex = -1;
                applyFocus();
                return;
            case '1':
            case '2':
            case '3': {
                e.preventDefault();
                const i = parseInt(e.key, 10) - 1;
                selectedColumnIndex = clampColumn(i);
                const cards = getCardElements(selectedColumnIndex);
                selectedCardIndex = cards.length > 0 ? 0 : -1;
                applyFocus();
                return;
            }
            case 'ArrowLeft': {
                if (e.shiftKey) {
                    e.preventDefault();
                    if (onMoveTask) {
                        const taskId = getSelectedTaskId();
                        if (taskId && selectedColumnIndex > 0) {
                            const newStatus = COLUMN_STATUSES[selectedColumnIndex - 1];
                            onMoveTask(taskId, newStatus, undefined);
                        }
                    }
                    return;
                }
                e.preventDefault();
                selectedColumnIndex = clampColumn(selectedColumnIndex - 1);
                const cards = getCardElements(selectedColumnIndex);
                selectedCardIndex = cards.length > 0 ? Math.min(selectedCardIndex, cards.length - 1) : -1;
                if (selectedCardIndex < 0 && cards.length > 0) selectedCardIndex = 0;
                applyFocus();
                return;
            }
            case 'ArrowRight': {
                if (e.shiftKey) {
                    e.preventDefault();
                    if (onMoveTask) {
                        const taskId = getSelectedTaskId();
                        if (taskId && selectedColumnIndex < COLUMN_STATUSES.length - 1) {
                            const newStatus = COLUMN_STATUSES[selectedColumnIndex + 1];
                            onMoveTask(taskId, newStatus, undefined);
                        }
                    }
                    return;
                }
                e.preventDefault();
                selectedColumnIndex = clampColumn(selectedColumnIndex + 1);
                const cards = getCardElements(selectedColumnIndex);
                selectedCardIndex = cards.length > 0 ? Math.min(selectedCardIndex, cards.length - 1) : -1;
                if (selectedCardIndex < 0 && cards.length > 0) selectedCardIndex = 0;
                applyFocus();
                return;
            }
            case 'ArrowUp': {
                if (e.shiftKey) {
                    e.preventDefault();
                    if (onMoveTask) {
                        const taskId = getSelectedTaskId();
                        if (taskId && selectedCardIndex > 0) {
                            const status = COLUMN_STATUSES[selectedColumnIndex];
                            onMoveTask(taskId, status, selectedCardIndex - 1);
                        }
                    }
                    return;
                }
                e.preventDefault();
                const cardsUp = getCardElements(selectedColumnIndex);
                const atTopOfColumn = selectedCardIndex <= 0;
                if (isMobileView() && selectedColumnIndex > 0 && atTopOfColumn) {
                    selectedColumnIndex -= 1;
                    const prevCards = getCardElements(selectedColumnIndex);
                    selectedCardIndex = prevCards.length > 0 ? prevCards.length - 1 : -1;
                } else {
                    selectedCardIndex = clampCardIndex(selectedCardIndex - 1);
                }
                applyFocus();
                return;
            }
            case 'ArrowDown': {
                if (e.shiftKey) {
                    e.preventDefault();
                    if (onMoveTask) {
                        const taskId = getSelectedTaskId();
                        const cardsDown = getCardElements(selectedColumnIndex);
                        if (taskId && selectedCardIndex >= 0 && selectedCardIndex < cardsDown.length - 1) {
                            const status = COLUMN_STATUSES[selectedColumnIndex];
                            onMoveTask(taskId, status, selectedCardIndex + 1);
                        }
                    }
                    return;
                }
                e.preventDefault();
                const cardsDown = getCardElements(selectedColumnIndex);
                if (selectedCardIndex < 0 && cardsDown.length > 0) {
                    selectedCardIndex = 0;
                } else if (isMobileView() && cardsDown.length > 0 && selectedCardIndex === cardsDown.length - 1 && selectedColumnIndex < COLUMN_STATUSES.length - 1) {
                    selectedColumnIndex += 1;
                    const nextCards = getCardElements(selectedColumnIndex);
                    selectedCardIndex = nextCards.length > 0 ? 0 : -1;
                } else {
                    selectedCardIndex = clampCardIndex(selectedCardIndex + 1);
                }
                applyFocus();
                return;
            }
            case 'Enter': {
                if (e.shiftKey) {
                    e.preventDefault();
                    onCreateTask(COLUMN_STATUSES[selectedColumnIndex]);
                    return;
                }
                const card = target.closest('.kanban-card') ?? getSelectedCardElement();
                const checkbox = card?.querySelector('.kanban-card__checkbox');
                if (checkbox) {
                    e.preventDefault();
                    checkbox.click();
                } else {
                    const taskId = getSelectedTaskId();
                    if (taskId) {
                        e.preventDefault();
                        onEditTask(taskId);
                    }
                }
                return;
            }
            case 'e': {
                e.preventDefault();
                const editId = getSelectedTaskId();
                if (editId) onEditTask(editId);
                return;
            }
            case 'd': {
                e.preventDefault();
                const deleteId = getSelectedTaskId();
                if (deleteId) onDeleteTask(deleteId);
                return;
            }
            default:
                break;
        }
    }

    function createIndicator() {
        const header = document.querySelector('.dashboard__header');
        if (!header || document.getElementById('keyboard-indicator')) return;
        const wrap = document.createElement('div');
        wrap.id = 'keyboard-indicator';
        wrap.className = 'keyboard-indicator';
        wrap.innerHTML = `
            <button type="button" class="keyboard-indicator__btn" data-action="help" aria-label="Keyboard shortcuts">
                <kbd>?</kbd>
                <span>Shortcuts</span>
            </button>
        `;
        header.querySelector('.dashboard__actions')?.prepend(wrap);
        wrap.querySelector('[data-action="help"]').addEventListener('click', showHelp);
    }

    createIndicator();
    document.addEventListener('keydown', handleKeydown);

    function selectTaskId(taskId) {
        if (!taskId) return;
        for (let colIdx = 0; colIdx < COLUMN_STATUSES.length; colIdx++) {
            const cards = getCardElements(colIdx);
            const cardIdx = cards.findIndex((card) => card.dataset.taskId === taskId);
            if (cardIdx >= 0) {
                selectedColumnIndex = colIdx;
                selectedCardIndex = cardIdx;
                applyFocus();
                return;
            }
        }
        syncFocus();
    }

    return {
        syncFocus() {
            const cards = getCardElements(selectedColumnIndex);
            if (selectedCardIndex >= cards.length) selectedCardIndex = cards.length - 1;
            if (selectedCardIndex < 0 && cards.length > 0) selectedCardIndex = 0;
            applyFocus();
        },
        selectTaskId,
        clearFocus: clearAllFocus,
    };
}

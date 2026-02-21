import { renderButton } from '../button/button.js';

const TEMPLATE_ID = 'modal-template';
const FIELDS_TEMPLATE_ID = 'modal-field-template';
const CLASS_OPEN = 'is-open';

let modalOverlay = null;

export function openModal() {
    if (!modalOverlay) return;

    modalOverlay.classList.add(CLASS_OPEN);
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

export function closeModal() {
    if (!modalOverlay) return;

    modalOverlay.classList.remove(CLASS_OPEN);
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

export function initModal({ onSubmit } = {}) {
    const template = document.getElementById(TEMPLATE_ID);
    const fieldsTemplate = document.getElementById(FIELDS_TEMPLATE_ID);
    if (!template?.content) {
        console.error(`[Modal] Template "${TEMPLATE_ID}" not found. Load components first.`);
        return { openModal, closeModal };
    }

    const clone = template.content.cloneNode(true);
    _injectFields(clone, fieldsTemplate);
    document.body.appendChild(clone);

    modalOverlay = document.body.querySelector('.modal-overlay');
    if (!modalOverlay) return { openModal, closeModal };

    _renderFooterButtons(modalOverlay);
    _attachEventListeners(modalOverlay, onSubmit);

    return { openModal, closeModal };
}

function _injectFields(modalClone, fieldsTemplate) {
    const container = modalClone.querySelector('#modal-form-fields');
    if (container && fieldsTemplate?.content) {
        container.appendChild(fieldsTemplate.content.cloneNode(true));
    }
}

function _renderFooterButtons(overlay) {
    const container = overlay.querySelector('#modal-footer-actions');
    if (!container) return;

    renderButton({
        variant: 'secondary',
        label: 'Cancel',
        type: 'button',
        className: 'modal__cancel',
        container,
    });
    renderButton({
        variant: 'primary',
        label: 'Delete Task',
        type: 'submit',
        className: 'modal__delete-action',
        container,
    });
}

function _attachEventListeners(overlay, onSubmit) {
    const closeBtn = overlay.querySelector('.modal__close');
    const cancelBtn = overlay.querySelector('.modal__cancel');
    const form = overlay.querySelector('#add-task-form');

    const handleClose = () => closeModal();

    if (closeBtn) closeBtn.addEventListener('click', handleClose);
    if (cancelBtn) cancelBtn.addEventListener('click', handleClose);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleClose();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay?.classList.contains(CLASS_OPEN)) {
            handleClose();
        }
    });

    const deleteButtons = overlay.querySelectorAll('.modal__delete-action');
    deleteButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.type === 'submit') return;
            form?.requestSubmit?.();
        });
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form));
            onSubmit?.(data);
            form.reset();
            handleClose();
        });
    }
}
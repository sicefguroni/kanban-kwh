import { renderButton } from '../button/button.js';

const TEMPLATE_ID = 'MODAL_TEMPLATE';
const FIELDS_TEMPLATE_ID = 'MODAL_FIELD_TEMPLATE';
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
    const container = modalClone.querySelector('#MODAL_FORM_FIELDS');
    if (container && fieldsTemplate?.content) {
        container.appendChild(fieldsTemplate.content.cloneNode(true));
    }
}

function _renderFooterButtons(overlay) {
    const container = overlay.querySelector('#MODAL_FOOTER_ACTIONS');
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
        label: 'Add Task',
        type: 'submit',
        container,
    });
}

function _attachEventListeners(overlay, onSubmit) {
    const closeBtn = overlay.querySelector('.modal__close');
    const cancelBtn = overlay.querySelector('.modal__cancel');
    const form = overlay.querySelector('#ADD_TASK_FORM');

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

import { renderButton } from '../button/button.js';

const TEMPLATE_ID = 'delete-modal-template';
const CLASS_OPEN = 'is-open';

let modalOverlay = null;

export function openDeleteModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.add(CLASS_OPEN);
  modalOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeDeleteModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove(CLASS_OPEN);
  modalOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function initDeleteModal({ onSubmit } = {}) {
  const template = document.getElementById(TEMPLATE_ID);

  if (!template || !template.content) {
    console.error(`[DeleteModal] Template "${TEMPLATE_ID}" not found. Load components first.`);
    return { openDeleteModal, closeDeleteModal };
  }

  const clone = template.content.cloneNode(true);
  document.body.appendChild(clone);

  // Prefer a unique class on the delete modal overlay in your delete-modal.html
  modalOverlay = document.body.querySelector('.modal-overlay.delete-modal');
  if (!modalOverlay) {
    // Fallback, pick the most recently appended overlay
    const overlays = document.body.querySelectorAll('.modal-overlay');
    modalOverlay = overlays[overlays.length - 1] || null;
  }
  if (!modalOverlay) return { openDeleteModal, closeDeleteModal };

  _renderFooterButtons(modalOverlay);
  _attachEventListeners(modalOverlay, onSubmit);

  return { openDeleteModal, closeDeleteModal };
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

  // Update this selector to your delete modal form id
  const form = overlay.querySelector('#delete-task-form');

  const handleClose = () => closeDeleteModal();

  if (closeBtn) closeBtn.addEventListener('click', handleClose);
  if (cancelBtn) cancelBtn.addEventListener('click', handleClose);

  // Backdrop click close, works if overlay is the backdrop element
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains(CLASS_OPEN)) {
      handleClose();
    }
  });

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (onSubmit) onSubmit(data);
    form.reset();
    handleClose();
  });
}
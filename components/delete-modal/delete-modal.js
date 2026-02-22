import { renderButton } from '../button/button.js';

const TEMPLATE_ID = 'delete-modal-template';
const CLASS_OPEN = 'is-open';

let modalOverlay = null;

export function openDeleteModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.add(CLASS_OPEN);
  modalOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    const cancelBtn = modalOverlay.querySelector('.modal__cancel');
    if (cancelBtn) cancelBtn.focus();
  });
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

  const footer = container.closest('.modal__footer');
  if (footer && !footer.querySelector('.modal__keyboard-hint')) {
    const hint = document.createElement('p');
    hint.className = 'modal__keyboard-hint';
    hint.textContent = 'Tab / Shift+↑↓ move · Enter confirm/cancel · Esc close';
    footer.appendChild(hint);
  }
}

function _getFocusable(overlay) {
  const nodes = [];
  const closeBtn = overlay.querySelector('.modal__close');
  const cancelBtn = overlay.querySelector('.modal__cancel');
  const deleteBtn = overlay.querySelector('.modal__delete-action, button[type="submit"]');
  if (closeBtn) nodes.push(closeBtn);
  if (cancelBtn) nodes.push(cancelBtn);
  if (deleteBtn) nodes.push(deleteBtn);
  return nodes;
}

function _attachEventListeners(overlay, onSubmit) {
  const closeBtn = overlay.querySelector('.modal__close');
  const cancelBtn = overlay.querySelector('.modal__cancel');
  const form = overlay.querySelector('#delete-task-form');

  const handleClose = () => closeDeleteModal();

  if (closeBtn) closeBtn.addEventListener('click', handleClose);
  if (cancelBtn) cancelBtn.addEventListener('click', handleClose);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });

  overlay.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains(CLASS_OPEN)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const focusable = _getFocusable(overlay);
      const cancelBtn = focusable.find((el) => el.classList.contains('modal__cancel'));
      if (document.activeElement === cancelBtn) {
        e.preventDefault();
        handleClose();
      } else {
        e.preventDefault();
        if (onSubmit) onSubmit({});
      }
      return;
    }
    const move = (dir) => {
      const focusable = _getFocusable(overlay);
      if (focusable.length === 0) return;
      e.preventDefault();
      const i = focusable.indexOf(document.activeElement);
      const next = dir === 1
        ? (i >= focusable.length - 1 ? 0 : i + 1)
        : (i <= 0 ? focusable.length - 1 : i - 1);
      focusable[next].focus();
    };
    if (e.key === 'Tab') move(e.shiftKey ? -1 : 1);
    else if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      move(e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1);
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains(CLASS_OPEN)) {
      handleClose();
    }
  });

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit({});
    form.reset();
    handleClose();
  });
}
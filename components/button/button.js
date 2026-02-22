const TEMPLATE_IDS = {
    PRIMARY: 'BUTTON_PRIMARY_TEMPLATE',
    PRIMARY_ICON: 'BUTTON_PRIMARY_ICON_TEMPLATE',
    SECONDARY: 'BUTTON_SECONDARY_TEMPLATE',
};

function _getTemplateId(variant, withIcon) {
    if (variant === 'primary' && withIcon) return TEMPLATE_IDS.PRIMARY_ICON;
    if (variant === 'primary') return TEMPLATE_IDS.PRIMARY;
    return TEMPLATE_IDS.SECONDARY;
}

export function renderButton({ variant, label, withIcon = false, id, type = 'button', className, container }) {
    const templateId = _getTemplateId(variant, withIcon);
    const template = document.getElementById(templateId);
    if (!template?.content) {
        console.error(`[Button] Template "${templateId}" not found. Load components first.`);
        return null;
    }

    const clone = template.content.cloneNode(true);
    const btn = clone.querySelector('button');

    btn.type = type;
    if (id) btn.id = id;
    if (className) btn.classList.add(...className.trim().split(/\s+/));

    const labelEl = btn.querySelector('.btn__label');
    if (labelEl) labelEl.textContent = label;

    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if (target) target.appendChild(clone);
    return target ? target.lastElementChild : btn;
}

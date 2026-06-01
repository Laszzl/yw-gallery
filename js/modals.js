(function (YW) {
  YW.modals = YW.modals || {};

  const elements = YW.dom.elements;
  let activeItemAction = null;
  const focusStack = [];

  function getFocusableElements(modal) {
    return Array.from(modal.querySelectorAll([
      'button:not([disabled])',
      'input:not([disabled]):not(.visually-hidden-input)',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(','))).filter((element) => element.offsetParent !== null || element === document.activeElement);
  }

  function restoreFocus(element) {
    if (!element || !document.contains(element) || typeof element.focus !== 'function') return;
    if (element.closest('[hidden]')) return;
    element.focus({ preventScroll: true });
  }

  function activateModalFocus(modal, { initialFocus, onEscape } = {}) {
    const previousFocus = document.activeElement;
    const entry = { modal, previousFocus, onEscape, keydown: null };
    entry.keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (entry.onEscape) entry.onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(modal);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener('keydown', entry.keydown);
    focusStack.push(entry);
    requestAnimationFrame(() => {
      const target = initialFocus || getFocusableElements(modal)[0] || modal;
      if (!target.hasAttribute('tabindex') && target === modal) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  function deactivateModalFocus(modal, { restore = true } = {}) {
    const index = focusStack.map((entry) => entry.modal).lastIndexOf(modal);
    if (index < 0) return;
    const [entry] = focusStack.splice(index, 1);
    entry.modal.removeEventListener('keydown', entry.keydown);
    if (restore) restoreFocus(entry.previousFocus);
  }

  function showModal(msg, { confirmLabel, showCancel } = {}) {
    return new Promise((resolve) => {
      const modal = elements.customModal;
      const msgEl = elements.modalMessage;
      const actions = modal.querySelector('.modal-actions');
      const confirmBtn = elements.modalConfirmBtn;
      const cancelBtn = document.createElement('button');

      confirmBtn.onclick = null;
      modal.onclick = null;
      actions.replaceChildren();
      msgEl.textContent = msg;

      const cleanup = (result) => {
        deactivateModalFocus(modal);
        modal.hidden = true;
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        modal.onclick = null;
        actions.replaceChildren();
        actions.append(confirmBtn);
        resolve(result);
      };

      confirmBtn.textContent = confirmLabel || '确定';
      confirmBtn.onclick = () => cleanup(true);

      if (showCancel) {
        cancelBtn.type = 'button';
        cancelBtn.className = 'secondary-button';
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => cleanup(false);
        confirmBtn.className = 'primary-button';
        actions.append(confirmBtn, cancelBtn);
      } else {
        actions.append(confirmBtn);
      }

      modal.onclick = (e) => {
        if (e.target === modal) cleanup(showCancel ? false : true);
      };
      modal.hidden = false;
      activateModalFocus(modal, {
        initialFocus: confirmBtn,
        onEscape: () => cleanup(showCancel ? false : true),
      });
    });
  }


  function openItemActionsModal(itemId, type) {
    activeItemAction = { itemId, type };
    elements.itemActionsModal.hidden = false;

    const item = YW.data.findItemById(itemId);

    for (const toggle of elements.itemStatusToggles) {
      const key = toggle.dataset.statusToggle;
      const value = item?.[key] ?? false;
      YW.utils.setSwitchState(toggle, value);
      toggle.onclick = async () => {
        const active = !toggle.classList.contains('active');
        YW.utils.setSwitchState(toggle, active);
        const currentItem = await YW.data.updateItemStatus(itemId, key, active);
        if (currentItem) {
          YW.render.refreshItemCard(itemId);
          YW.render.refreshCategoryCounts(currentItem.personId, currentItem.categoryId);
        }
      };
    }

    elements.itemActionManageBtn.onclick = () => {
      const current = activeItemAction;
      closeItemActionsModal();
      if (current) YW.photoManager.openPhotoManageModal(current.itemId);
    };
    elements.itemActionDeleteBtn.onclick = () => {
      const current = activeItemAction;
      closeItemActionsModal();
      if (current) handleDeleteItem(current.itemId);
    };
    activateModalFocus(elements.itemActionsModal, {
      initialFocus: elements.itemActionManageBtn,
      onEscape: closeItemActionsModal,
    });
  }

  function closeItemActionsModal() {
    if (elements.itemActionsModal.hidden) return;
    deactivateModalFocus(elements.itemActionsModal);
    elements.itemActionsModal.hidden = true;
    elements.itemActionManageBtn.onclick = null;
    elements.itemActionDeleteBtn.onclick = null;
    for (const toggle of elements.itemStatusToggles) {
      toggle.onclick = null;
    }
    activeItemAction = null;
  }

  function closePhotoManageModal() {
    YW.photoManager.closePhotoManageModal();
  }

  async function handleDeleteItem(itemId) {
    const item = YW.data.findItemById(itemId);
    if (!item) return;
    const removedItem = { personId: item.personId, categoryId: item.categoryId };
    const confirmed = await showModal(`确认删除 YW"${item.label}"吗？`, { showCancel: true });
    if (!confirmed) return;
    await YW.data.deleteItem(itemId);
    YW.render.removeItemCard(itemId, removedItem);
    await showModal('YW 已删除');
  }

  async function confirmAndDelete(confirmMsg, deleteFn, successMsg) {
    const confirmed = await showModal(confirmMsg, { showCancel: true });
    if (!confirmed) return false;
    await deleteFn();
    YW.render.renderAll();
    await showModal(successMsg);
    return true;
  }

  function closeTransientModals() {
    closeItemActionsModal();
    closePhotoManageModal();
    if (elements.cropModal && !elements.cropModal.hidden) {
      YW.crop.closeCropModal(YW.crop.createCropResult('cancel'));
    }
  }

  Object.assign(YW.modals, {
    activateModalFocus,
    deactivateModalFocus,
    showModal,
    confirmAndDelete,
    openItemActionsModal,
    closeItemActionsModal,
    closePhotoManageModal,
    closeTransientModals,
  });
})(window.YW);

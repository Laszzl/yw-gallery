(function (YW) {
  YW.modals = YW.modals || {};

  const elements = YW.dom.elements;
  let activeItemAction = null;

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
        const currentItem = YW.data.findItemById(itemId);
        if (currentItem) {
          currentItem[key] = active;
          await YW.storage.saveStateStrict();
          const card = document.querySelector(`[data-item-id="${itemId}"]`);
          if (card) {
            const title = card.querySelector('.yw-title, .text-item-title');
            if (title) title.textContent = YW.data.formatItemLabel(currentItem);
            const statusEl = card.querySelector('.yw-status, .text-item-status');
            if (statusEl) statusEl.textContent = YW.data.formatItemStatus(currentItem);
          }
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
  }

  function closeItemActionsModal() {
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
    showModal,
    confirmAndDelete,
    openItemActionsModal,
    closeItemActionsModal,
    closePhotoManageModal,
    closeTransientModals,
  });
})(window.YW);

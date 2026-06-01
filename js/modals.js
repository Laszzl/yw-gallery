(function (YW) {
  YW.modals = YW.modals || {};

  const elements = YW.dom.elements;
  let activeItemAction = null;
  let photoManageState = { itemId: null, mode: null, replaceIndex: null };

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
      if (current) openPhotoManageModal(current.itemId);
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
    const { photoManageModal, photoThumbGrid, modalPhotoInput, modalPhotoAddBtn, modalPhotoDeleteBtn } = elements;
    if (!photoManageModal.hidden) {
      photoManageModal.hidden = true;
      photoManageModal.onclick = null;
      photoThumbGrid.classList.remove('gallery-thumb-grid');
      modalPhotoInput.onchange = null;
      modalPhotoAddBtn.onclick = null;
      modalPhotoDeleteBtn.onclick = null;
      photoManageState = { itemId: null, mode: null, replaceIndex: null };
    }
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

  function createPhotoManagerContext(config) {
    const { photoManageModal: modal, photoThumbGrid: thumbGrid, modalPhotoAddBtn: addBtn, modalPhotoDeleteBtn: deleteBtn, modalPhotoInput: fileInput } = elements;
    const ctx = { config, modal, thumbGrid, addBtn, deleteBtn, fileInput };
    fileInput.value = '';
    thumbGrid.classList.toggle('gallery-thumb-grid', Boolean(config.galleryGrid));
    modal.hidden = false;
    photoManageState = { itemId: config.itemId || null, mode: null, replaceIndex: null, galleryPersonId: config.galleryPersonId || null };
    return ctx;
  }

  function getManagedRecord(ctx) {
    return ctx.config.getRecord();
  }

  function getManagedPhotos(ctx) {
    return ctx.config.getPhotos(getManagedRecord(ctx)) || [];
  }

  async function setManagedPhotos(ctx, photos) {
    const record = getManagedRecord(ctx);
    if (!record) return false;
    await ctx.config.setPhotos(record, photos);
    if (ctx.config.afterPhotosChange) ctx.config.afterPhotosChange(record);
    return true;
  }

  async function applyManagedPhotos(ctx, photoUrls) {
    if (!photoUrls.length) return false;
    const current = [...getManagedPhotos(ctx)];
    if (photoManageState.mode === 'replace') {
      current[photoManageState.replaceIndex] = photoUrls[0];
      return setManagedPhotos(ctx, current);
    }
    return setManagedPhotos(ctx, [...current, ...photoUrls]);
  }

  function renderPhotoThumbGrid(ctx) {
    ctx.thumbGrid.replaceChildren();
    const photos = getManagedPhotos(ctx);
    ctx.deleteBtn.hidden = photos.length === 0;
    ctx.thumbGrid.style.display = photos.length ? '' : 'none';
    for (let i = 0; i < photos.length; i++) {
      const frag = elements.templates.photoThumb.content.cloneNode(true);
      const thumbImg = frag.querySelector('.photo-thumb-img');
      const replaceBtn = frag.querySelector('.photo-thumb-replace');
      thumbImg.src = photos[i];
      replaceBtn.addEventListener('click', () => {
        photoManageState.mode = 'replace';
        photoManageState.replaceIndex = i;
        ctx.fileInput.multiple = false;
        ctx.fileInput.value = '';
        ctx.fileInput.click();
      });
      ctx.thumbGrid.append(frag);
    }
  }

  function closePhotoManagerContext(ctx) {
    ctx.modal.hidden = true;
    ctx.modal.onclick = null;
    ctx.thumbGrid.classList.remove('gallery-thumb-grid');
    ctx.fileInput.onchange = null;
    ctx.addBtn.onclick = null;
    ctx.deleteBtn.onclick = null;
    photoManageState = { itemId: null, mode: null, replaceIndex: null };
    if (ctx.config.onClose) ctx.config.onClose();
  }

  async function handlePartialPhotoUpdate(ctx, photoUrls, cropResult) {
    if (cropResult?.type === 'error') {
      renderPhotoThumbGrid(ctx);
      ctx.modal.hidden = false;
      return;
    }
    if (photoUrls.length) {
      await applyManagedPhotos(ctx, photoUrls);
      await showModal(`已更新 ${photoUrls.length} 张，剩余已取消`);
    } else {
      await showModal('已取消本次图片更新');
    }
    renderPhotoThumbGrid(ctx);
    ctx.modal.hidden = false;
  }

  async function handlePhotoManagerFiles(ctx, files) {
    ctx.modal.hidden = true;
    if (!files.length || !getManagedRecord(ctx)) {
      ctx.modal.hidden = false;
      return;
    }

    const photoUrls = [];
    for (const file of files) {
      const cropResult = await YW.crop.showCropModal(file, ctx.config.aspectRatio);
      const finalFile = YW.crop.resolveCroppedFile(file, cropResult);
      if (!finalFile) {
        await handlePartialPhotoUpdate(ctx, photoUrls, cropResult);
        return;
      }
      photoUrls.push(await YW.data.readFileAsDataURL(finalFile));
    }

    await applyManagedPhotos(ctx, photoUrls);
    await showModal(photoManageState.mode === 'replace' ? '图片已替换' : `已添加 ${photoUrls.length} 张图片`);
    renderPhotoThumbGrid(ctx);
    ctx.modal.hidden = false;
  }

  function bindPhotoManagerEvents(ctx) {
    ctx.modal.onclick = (event) => { if (event.target === ctx.modal) closePhotoManagerContext(ctx); };
    ctx.fileInput.onchange = async (event) => {
      const rawFiles = [...(event.target.files ?? [])].filter((f) => f.size > 0);
      await handlePhotoManagerFiles(ctx, rawFiles);
    };

    ctx.addBtn.onclick = () => {
      photoManageState.mode = 'add';
      photoManageState.replaceIndex = null;
      ctx.fileInput.multiple = true;
      ctx.fileInput.value = '';
      ctx.fileInput.click();
    };

    ctx.deleteBtn.onclick = async () => {
      if (!getManagedRecord(ctx) || !getManagedPhotos(ctx).length) {
        ctx.modal.hidden = true;
        await showModal(ctx.config.emptyDeleteMessage);
        ctx.modal.hidden = false;
        return;
      }
      ctx.modal.hidden = true;
      const confirmed = await showModal(ctx.config.confirmDeleteMessage, { showCancel: true });
      if (!confirmed) { ctx.modal.hidden = false; return; }
      await setManagedPhotos(ctx, []);
      await showModal(ctx.config.deleteSuccessMessage);
      renderPhotoThumbGrid(ctx);
      ctx.modal.hidden = false;
    };
  }

  function openPhotoCollectionManager(config) {
    const ctx = createPhotoManagerContext(config);
    bindPhotoManagerEvents(ctx);
    renderPhotoThumbGrid(ctx);
  }

  function openPhotoManageModal(itemId) {
    openPhotoCollectionManager({
      itemId,
      aspectRatio: 1,
      emptyDeleteMessage: '当前 YW 没有图片可删除',
      confirmDeleteMessage: '确认删除所有图片吗？',
      deleteSuccessMessage: '图片已删除',
      getRecord: () => YW.data.findItemById(itemId),
      getPhotos: (item) => item?.photoUrls || [],
      setPhotos: async (item, photos) => {
        await YW.data.updateItemPhotos(item.id, photos);
      },
      afterPhotosChange: (item) => {
        YW.render.refreshItemCard(item.id);
      },
    });
  }

  function openGalleryManageModal(personId) {
    openPhotoCollectionManager({
      galleryPersonId: personId,
      galleryGrid: true,
      aspectRatio: 4 / 5,
      emptyDeleteMessage: '当前画廊没有图片可删除',
      confirmDeleteMessage: '确认删除所有画廊图片吗？',
      deleteSuccessMessage: '画廊图片已删除',
      getRecord: () => YW.data.findPersonById(personId),
      getPhotos: (person) => person?.galleryPhotos || [],
      setPhotos: async (person, photos) => {
        person.galleryPhotos = photos;
        await YW.storage.saveStateStrict();
      },
      afterPhotosChange: (person) => {
        YW.render.renderGallery(person);
        YW.railMask.setupRailMasks();
        YW.render.syncGallerySettings();
      },
      onClose: YW.render.syncGallerySettings,
    });
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
    openPhotoManageModal,
    openGalleryManageModal,
    closeTransientModals,
  });
})(window.YW);

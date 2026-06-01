(function (YW) {
  YW.photoManager = YW.photoManager || {};

  const elements = YW.dom.elements;
  let managerState = { itemId: null, mode: null, replaceIndex: null };

  function createPhotoManagerContext(config) {
    const { photoManageModal: modal, photoThumbGrid: thumbGrid, modalPhotoAddBtn: addBtn, modalPhotoDeleteBtn: deleteBtn, modalPhotoInput: fileInput } = elements;
    const ctx = { config, modal, thumbGrid, addBtn, deleteBtn, fileInput };
    fileInput.value = '';
    thumbGrid.classList.toggle('gallery-thumb-grid', Boolean(config.galleryGrid));
    modal.hidden = false;
    managerState = { itemId: config.itemId || null, mode: null, replaceIndex: null, galleryPersonId: config.galleryPersonId || null };
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
    if (managerState.mode === 'replace') {
      current[managerState.replaceIndex] = photoUrls[0];
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
        managerState.mode = 'replace';
        managerState.replaceIndex = i;
        ctx.fileInput.multiple = false;
        ctx.fileInput.value = '';
        ctx.fileInput.click();
      });
      ctx.thumbGrid.append(frag);
    }
  }

  function resetPhotoManagerDom() {
    const { photoManageModal, photoThumbGrid, modalPhotoInput, modalPhotoAddBtn, modalPhotoDeleteBtn } = elements;
    photoManageModal.hidden = true;
    photoManageModal.onclick = null;
    photoThumbGrid.classList.remove('gallery-thumb-grid');
    modalPhotoInput.onchange = null;
    modalPhotoAddBtn.onclick = null;
    modalPhotoDeleteBtn.onclick = null;
    managerState = { itemId: null, mode: null, replaceIndex: null, galleryPersonId: null };
  }

  function closePhotoManagerContext(ctx) {
    resetPhotoManagerDom();
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
      await YW.modals.showModal(`已更新 ${photoUrls.length} 张，剩余已取消`);
    } else {
      await YW.modals.showModal('已取消本次图片更新');
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
    await YW.modals.showModal(managerState.mode === 'replace' ? '图片已替换' : `已添加 ${photoUrls.length} 张图片`);
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
      managerState.mode = 'add';
      managerState.replaceIndex = null;
      ctx.fileInput.multiple = true;
      ctx.fileInput.value = '';
      ctx.fileInput.click();
    };

    ctx.deleteBtn.onclick = async () => {
      if (!getManagedRecord(ctx) || !getManagedPhotos(ctx).length) {
        ctx.modal.hidden = true;
        await YW.modals.showModal(ctx.config.emptyDeleteMessage);
        ctx.modal.hidden = false;
        return;
      }
      ctx.modal.hidden = true;
      const confirmed = await YW.modals.showModal(ctx.config.confirmDeleteMessage, { showCancel: true });
      if (!confirmed) { ctx.modal.hidden = false; return; }
      await setManagedPhotos(ctx, []);
      await YW.modals.showModal(ctx.config.deleteSuccessMessage);
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
        await YW.data.updateGalleryPhotos(person.id, photos);
      },
      afterPhotosChange: (person) => {
        YW.render.renderGallery(person);
        YW.railMask.setupRailMasks();
        YW.render.syncGallerySettings();
      },
      onClose: YW.render.syncGallerySettings,
    });
  }

  function isPhotoManagerOpen() {
    return !elements.photoManageModal.hidden;
  }

  function closePhotoManageModal() {
    if (!elements.photoManageModal.hidden) resetPhotoManagerDom();
  }

  Object.assign(YW.photoManager, {
    openPhotoManageModal,
    openGalleryManageModal,
    closePhotoManageModal,
    isPhotoManagerOpen,
  });
})(window.YW);

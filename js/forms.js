(function (YW) {
  YW.forms = YW.forms || {};

  const elements = YW.dom.elements;
  const state = YW.state.state;
  const viewState = YW.state.viewState;
  const { DEFAULT_ITEM_DATE, SAVE_FAILURE_MESSAGE } = YW.config;
  const formLocks = { person: false, group: false, category: false, item: false };

  async function withFormLock(form, lockName, fn) {
    if (formLocks[lockName]) return;
    formLocks[lockName] = true;
    setFormSubmitDisabled(form, true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      await YW.modals.showModal(SAVE_FAILURE_MESSAGE);
    } finally {
      formLocks[lockName] = false;
      setFormSubmitDisabled(form, false);
    }
  }

  function setFormSubmitDisabled(form, disabled) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = disabled;
  }

  function describeFiles(fileList, multiple) {
    const files = [...(fileList ?? [])].filter((file) => file.size > 0);
    if (!files.length) return '未选择文件';
    if (multiple) return `已选择 ${files.length} 张：${files.map((file) => file.name).join('、')}`;
    return `已选择：${files[0].name}`;
  }

  function setInputFiles(input, files) {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  }

  function syncFileSummaries() {
    elements.itemPhotosSummary.textContent = describeFiles(elements.itemPhotosInput.files, true);
    elements.personHomePhotoSummary.textContent = describeFiles(elements.personHomePhotoInput.files, false);
    elements.personDetailPhotoSummary.textContent = describeFiles(elements.personDetailPhotoInput.files, false);
  }

  function bindSettingsPhotoInput(input, { field, aspectRatio, successMsg, errorMsg }) {
    input.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file || !viewState.settingsActivePersonId) return;
      const finalFile = await YW.crop.cropFile(file, aspectRatio);
      if (!finalFile) { event.target.value = ''; return; }
      try {
        await YW.data.updatePersonPhoto(viewState.settingsActivePersonId, field, finalFile);
        YW.render.renderAll();
        await YW.modals.showModal(successMsg);
      } catch (err) {
        console.error(err);
        await YW.modals.showModal(errorMsg);
      } finally {
        event.target.value = '';
      }
    });
  }

  function formText(formData, key) {
    return String(formData.get(key) ?? '').trim();
  }

  function hasDuplicateName(records, name, matchesScope = () => true) {
    const normalized = YW.data.normalizeName(name);
    return records.some((record) => matchesScope(record) && YW.data.normalizeName(record.name) === normalized);
  }

  function resetPersonFormAfterSave(person) {
    elements.personForm.querySelector('input[name="name"]').value = '';
    elements.personHomePhotoInput.value = '';
    elements.personDetailPhotoInput.value = '';
    syncFileSummaries();
    viewState.settingsActivePersonId = person.id;
    viewState.overviewPersonId = person.id;
    if (!viewState.selectedPersonId) viewState.selectedPersonId = person.id;
  }

  async function handleFormSubmit({ validate, save, reset, successMsg, confirmLabel }) {
    if (validate && !(await validate())) return;
    if (confirmLabel) {
      const confirmed = await YW.modals.showModal(confirmLabel, { showCancel: true });
      if (!confirmed) return;
    }
    const result = await save();
    if (reset) reset(result);
    YW.render.renderAll();
    await YW.modals.showModal(typeof successMsg === 'function' ? successMsg(result) : successMsg);
  }

  async function handlePersonFormSubmit() {
    const formData = new FormData(elements.personForm);
    const name = formText(formData, 'name');
    await handleFormSubmit({
      validate: async () => {
        if (!name) { await YW.modals.showModal('请填写体育生姓名'); return false; }
        if (hasDuplicateName(state.people, name)) {
          await YW.modals.showModal('体育生姓名已存在，请勿重复添加'); return false;
        }
        return true;
      },
      save: () => YW.data.createPerson(name, formData.get('homePhoto'), formData.get('detailPhoto')),
      reset: (person) => resetPersonFormAfterSave(person),
      successMsg: (person) => `体育生已保存：${person.name}`,
      confirmLabel: '确认保存新体育生吗？',
    });
  }

  async function handleGroupFormSubmit() {
    const formData = new FormData(elements.groupForm);
    const name = formText(formData, 'name');
    await handleFormSubmit({
      validate: async () => {
        if (!name) { await YW.modals.showModal('请填写大品类名称'); return false; }
        if (hasDuplicateName(state.groups, name)) {
          await YW.modals.showModal('大品类名称已存在，请勿重复添加'); return false;
        }
        return true;
      },
      save: () => YW.data.createGroup(name),
      reset: () => elements.groupForm.reset(),
      successMsg: `大品类已保存：${name}`,
    });
  }

  async function handleCategoryFormSubmit() {
    const formData = new FormData(elements.categoryForm);
    const groupId = formText(formData, 'groupId');
    const name = formText(formData, 'name');
    await handleFormSubmit({
      validate: async () => {
        if (!groupId || !name) { await YW.modals.showModal('请填写完整的小品类信息'); return false; }
        if (hasDuplicateName(state.categories, name, (c) => c.groupId === groupId)) {
          await YW.modals.showModal('该大品类下的小品类名称已存在，请勿重复添加'); return false;
        }
        return true;
      },
      save: () => YW.data.createCategory(groupId, name),
      reset: () => {
        elements.categoryForm.reset();
        elements.categoryGroupSelect.value = groupId;
        elements.itemGroupSelect.value = groupId;
        YW.render.syncCategoryOptions(groupId);
      },
      successMsg: `小品类已保存：${name}`,
    });
  }

  function getItemFormData() {
    const formData = new FormData(elements.itemForm);
    const quantityRaw = formText(formData, 'quantity');
    return {
      personId: formText(formData, 'personId'),
      groupId: formText(formData, 'groupId'),
      categoryId: formText(formData, 'categoryId'),
      label: formText(formData, 'label'),
      quantityRaw,
      quantity: Number(quantityRaw),
      unit: formText(formData, 'unit'),
      date: formText(formData, 'date') || DEFAULT_ITEM_DATE,
      isGift: formData.has('isGift'),
      isOwnedNow: formData.has('isOwnedNow'),
      rawFiles: formData.getAll('photos').filter((file) => file instanceof File && file.size > 0),
    };
  }

  async function validateItemFormData(itemData) {
    const categoryOptions = YW.data.getOrderedCategoriesForPersonGroup(itemData.personId, itemData.groupId);
    if (!itemData.personId || !itemData.groupId || !itemData.label || !itemData.quantityRaw || !itemData.unit) {
      await YW.modals.showModal('请把 YW 信息填写完整');
      return false;
    }
    if (!categoryOptions.length) {
      await YW.modals.showModal('请先为当前大品类添加小品类');
      return false;
    }
    if (!categoryOptions.some((category) => category.id === itemData.categoryId)) {
      await YW.modals.showModal('请选择有效的小品类');
      return false;
    }
    if (!Number.isInteger(itemData.quantity) || itemData.quantity < 1) {
      await YW.modals.showModal('数量必须是大于 0 的整数');
      return false;
    }
    if (!YW.utils.isValidDateString(itemData.date)) {
      await YW.modals.showModal('日期格式错误，请重新选择日期');
      return false;
    }
    return true;
  }

  function resetItemFormAfterSave({ personId, groupId, categoryId }) {
    elements.itemForm.reset();
    elements.itemOwnedNowInput.checked = true;
    elements.itemGiftInput.checked = false;
    YW.datePicker.syncDateDisplay(DEFAULT_ITEM_DATE);
    elements.itemPhotosInput.value = '';
    elements.itemPersonSelect.value = personId;
    elements.itemGroupSelect.value = groupId;
    YW.render.syncCategoryOptions(groupId);
    elements.itemCategorySelect.value = categoryId;
    syncFileSummaries();
  }

  async function handleItemFormSubmit() {
    const itemData = getItemFormData();
    if (!(await validateItemFormData(itemData))) return;

    const photoUrls = await YW.data.readFilesAsDataURLs(itemData.rawFiles);
    const { rawFiles, quantityRaw, ...payload } = itemData;
    await YW.data.createItem({ ...payload, photoUrls });

    resetItemFormAfterSave(itemData);
    YW.render.renderAll();
    await YW.modals.showModal(`YW 已成功保存：${itemData.label}`);
  }

  function isFormLocked(lockName) {
    return Boolean(formLocks[lockName]);
  }

  Object.assign(YW.forms, {
    withFormLock,
    isFormLocked,
    handleFormSubmit,
    setFormSubmitDisabled,
    describeFiles,
    setInputFiles,
    syncFileSummaries,
    bindSettingsPhotoInput,
    handlePersonFormSubmit,
    handleGroupFormSubmit,
    handleCategoryFormSubmit,
    handleItemFormSubmit,
  });
})(window.YW);

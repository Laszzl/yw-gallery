(function (YW) {
  YW.forms = YW.forms || {};

  const elements = YW.dom.elements;
  const state = YW.state.state;
  const viewState = YW.state.viewState;
  const { DEFAULT_ITEM_DATE, DATE_MIN_YEAR, DATE_PICKER_SCROLL_DEBOUNCE_MS, SAVE_FAILURE_MESSAGE } = YW.config;
  const formLocks = { person: false, group: false, category: false, item: false };
  const datePickerState = { ...YW.utils.parseDateParts(DEFAULT_ITEM_DATE), scrollTimer: null };

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

  // ═══════════════════════════════════════════════
  // Date picker
  // ═══════════════════════════════════════════════
  function syncDateDisplay(dateStr) {
    let formatted;
    if (dateStr) {
      formatted = dateStr;
    } else {
      formatted = YW.utils.buildDateString(datePickerState.year, datePickerState.month, datePickerState.day);
    }
    elements.itemDateHidden.value = formatted;
    elements.itemDateDisplay.querySelector('.date-display-text').textContent = YW.utils.formatDateDisplay(formatted);
  }

  function renderColumnItems(scrollEl, items, selectedValue, colType) {
    const existing = scrollEl.querySelectorAll('.date-col-item');
    for (let i = 0; i < existing.length; i++) { existing[i].remove(); }

    const spacerBottom = scrollEl.querySelector('.date-col-spacer:last-child');
    const fragment = document.createDocumentFragment();
    for (let j = 0; j < items.length; j++) {
      const itemEl = document.createElement('div');
      itemEl.className = 'date-col-item';
      itemEl.textContent = String(items[j]);
      itemEl.dataset.value = String(items[j]);
      itemEl.dataset.col = colType;
      itemEl.addEventListener('click', function(e) {
        const val = parseInt(e.currentTarget.dataset.value, 10);
        handleDateItemClick(colType, val, scrollEl);
      });
      fragment.appendChild(itemEl);
    }
    scrollEl.insertBefore(fragment, spacerBottom);
  }

  function renderYearColumn(scrollEl, selectedYear) {
    const currentYear = new Date().getFullYear();
    const items = [];
    for (let y = currentYear; y >= DATE_MIN_YEAR; y--) { items.push(y); }
    renderColumnItems(scrollEl, items, selectedYear, 'year');
  }

  function renderMonthColumn(scrollEl, selectedMonth) {
    const items = [];
    for (let m = 1; m <= 12; m++) { items.push(m); }
    renderColumnItems(scrollEl, items, selectedMonth, 'month');
  }

  function renderDayColumn(scrollEl, selectedDay, year, month) {
    const maxDay = YW.utils.daysInMonth(year, month);
    const items = [];
    for (let d = 1; d <= maxDay; d++) { items.push(d); }
    renderColumnItems(scrollEl, items, selectedDay, 'day');
  }

  function handleDateItemClick(colType, value, scrollEl) {
    if (colType === 'year') datePickerState.year = value;
    else if (colType === 'month') datePickerState.month = value;
    else if (colType === 'day') datePickerState.day = value;

    if (colType === 'year' || colType === 'month') {
      refreshDayColumn();
    }
    scrollToSelectedItem(scrollEl, value);
    updateColumnSelection(scrollEl, value);
  }

  function onColumnScroll(e) {
    const scrollEl = e.target;
    if (!scrollEl.classList.contains('date-col-scroll')) return;

    clearTimeout(datePickerState.scrollTimer);
    datePickerState.scrollTimer = setTimeout(function() {
      const selectedValue = getClosestSnapItem(scrollEl);
      if (selectedValue === null) return;

      const colType = scrollEl.dataset.col;
      if (colType === 'year') datePickerState.year = selectedValue;
      else if (colType === 'month') datePickerState.month = selectedValue;
      else if (colType === 'day') datePickerState.day = selectedValue;

      updateColumnSelection(scrollEl, selectedValue);

      if (colType === 'year' || colType === 'month') {
        refreshDayColumn();
      }
    }, DATE_PICKER_SCROLL_DEBOUNCE_MS);
  }

  function getClosestSnapItem(scrollEl) {
    const items = scrollEl.querySelectorAll('.date-col-item');
    const viewCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;
    let closest = null;
    let minDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const itemCenter = items[i].offsetTop + items[i].offsetHeight / 2;
      const dist = Math.abs(itemCenter - viewCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = parseInt(items[i].dataset.value, 10);
      }
    }
    return closest;
  }

  function updateColumnSelection(scrollEl, value) {
    const items = scrollEl.querySelectorAll('.date-col-item');
    for (let i = 0; i < items.length; i++) {
      if (parseInt(items[i].dataset.value, 10) === value) {
        items[i].classList.add('selected');
      } else {
        items[i].classList.remove('selected');
      }
    }
  }

  function scrollToSelectedItem(scrollEl, value) {
    const items = scrollEl.querySelectorAll('.date-col-item');
    for (let i = 0; i < items.length; i++) {
      if (parseInt(items[i].dataset.value, 10) === value) {
        const itemTop = items[i].offsetTop;
        const scrollTarget = itemTop - (scrollEl.clientHeight / 2) + (items[i].offsetHeight / 2);
        scrollEl.scrollTop = scrollTarget;
        break;
      }
    }
  }

  function refreshDayColumn() {
    const maxDay = YW.utils.daysInMonth(datePickerState.year, datePickerState.month);
    if (datePickerState.day > maxDay) {
      datePickerState.day = maxDay;
    }
    renderDayColumn(elements.dateDayScroll, datePickerState.day, datePickerState.year, datePickerState.month);
    requestAnimationFrame(function() {
      scrollToSelectedItem(elements.dateDayScroll, datePickerState.day);
      updateColumnSelection(elements.dateDayScroll, datePickerState.day);
    });
  }

  function openDatePicker(dateStr) {
    Object.assign(datePickerState, YW.utils.parseDateParts(dateStr));

    renderYearColumn(elements.dateYearScroll, datePickerState.year);
    renderMonthColumn(elements.dateMonthScroll, datePickerState.month);
    renderDayColumn(elements.dateDayScroll, datePickerState.day, datePickerState.year, datePickerState.month);

    requestAnimationFrame(function() {
      scrollToSelectedItem(elements.dateYearScroll, datePickerState.year);
      updateColumnSelection(elements.dateYearScroll, datePickerState.year);
      scrollToSelectedItem(elements.dateMonthScroll, datePickerState.month);
      updateColumnSelection(elements.dateMonthScroll, datePickerState.month);
      scrollToSelectedItem(elements.dateDayScroll, datePickerState.day);
      updateColumnSelection(elements.dateDayScroll, datePickerState.day);
    });

    elements.datePickerModal.hidden = false;
    YW.utils.setExpanded(elements.itemDateDisplay, true);
  }

  function confirmDatePicker() {
    syncDateDisplay();
    elements.datePickerModal.hidden = true;
    YW.utils.setExpanded(elements.itemDateDisplay, false);
  }

  function cancelDatePicker() {
    elements.datePickerModal.hidden = true;
    YW.utils.setExpanded(elements.itemDateDisplay, false);
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

  async function handlePersonFormSubmit() {
    const formData = new FormData(elements.personForm);
    const name = formText(formData, 'name');
    if (!name) { await YW.modals.showModal('请填写体育生姓名'); return; }
    if (hasDuplicateName(state.people, name)) {
      await YW.modals.showModal('体育生姓名已存在，请勿重复添加'); return;
    }
    const confirmed = await YW.modals.showModal('确认保存新体育生吗？', { showCancel: true });
    if (!confirmed) return;

    const person = await YW.data.createPerson(name, formData.get('homePhoto'), formData.get('detailPhoto'));
    resetPersonFormAfterSave(person);
    YW.render.renderAll();
    await YW.modals.showModal(`体育生已保存：${person.name}`);
  }

  async function handleGroupFormSubmit() {
    const formData = new FormData(elements.groupForm);
    const name = formText(formData, 'name');
    if (!name) { await YW.modals.showModal('请填写大品类名称'); return; }
    if (hasDuplicateName(state.groups, name)) {
      await YW.modals.showModal('大品类名称已存在，请勿重复添加'); return;
    }
    await YW.data.createGroup(name);
    elements.groupForm.reset();
    YW.render.renderAll();
    await YW.modals.showModal(`大品类已保存：${name}`);
  }

  async function handleCategoryFormSubmit() {
    const formData = new FormData(elements.categoryForm);
    const groupId = formText(formData, 'groupId');
    const name = formText(formData, 'name');
    if (!groupId || !name) { await YW.modals.showModal('请填写完整的小品类信息'); return; }
    if (hasDuplicateName(state.categories, name, (category) => category.groupId === groupId)) {
      await YW.modals.showModal('该大品类下的小品类名称已存在，请勿重复添加'); return;
    }
    await YW.data.createCategory(groupId, name);
    elements.categoryForm.reset();
    elements.categoryGroupSelect.value = groupId;
    elements.itemGroupSelect.value = groupId;
    YW.render.syncCategoryOptions(groupId);
    YW.render.renderAll();
    await YW.modals.showModal(`小品类已保存：${name}`);
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
    if (!YW.state.isValidDateString(itemData.date)) {
      await YW.modals.showModal('日期格式错误，请重新选择日期');
      return false;
    }
    return true;
  }

  function resetItemFormAfterSave({ personId, groupId, categoryId }) {
    elements.itemForm.reset();
    elements.itemOwnedNowInput.checked = true;
    elements.itemGiftInput.checked = false;
    syncDateDisplay(DEFAULT_ITEM_DATE);
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
    setFormSubmitDisabled,
    describeFiles,
    setInputFiles,
    syncFileSummaries,
    syncDateDisplay,
    openDatePicker,
    confirmDatePicker,
    cancelDatePicker,
    onColumnScroll,
    bindSettingsPhotoInput,
    handlePersonFormSubmit,
    handleGroupFormSubmit,
    handleCategoryFormSubmit,
    handleItemFormSubmit,
  });
})(window.YW);

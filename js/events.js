(function (YW) {
  YW.events = YW.events || {};

  function bindNavigationEvents(elements) {
    // app-lifetime
    elements.homeButton.addEventListener('click', () => YW.render.showHomeView());
    elements.addButton.addEventListener('click', () => YW.render.showAddView());
    elements.settingsButton.addEventListener('click', () => YW.render.showSettingsView());
    elements.emptySettingsButton.addEventListener('click', () => YW.render.showSettingsView());
  }

  function bindGlobalModalEvents(elements) {
    // app-lifetime
    document.addEventListener('click', (event) => {
      if (event.target === elements.itemActionsModal && !elements.itemActionsModal.hidden) {
        YW.modals.closeItemActionsModal();
      }
    });

    // app-lifetime
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!elements.datePickerModal.hidden) YW.forms.cancelDatePicker();
      else if (!elements.cropModal.hidden) YW.crop.closeCropModal(YW.crop.createCropResult('cancel'));
      else if (!elements.itemActionsModal.hidden) YW.modals.closeItemActionsModal();
      else YW.modals.closePhotoManageModal();
    });
  }

  function bindFileInputEvents(elements) {
    // app-lifetime
    elements.clearItemFilesButton.addEventListener('click', async () => {
      elements.itemPhotosInput.value = '';
      YW.forms.syncFileSummaries();
      await YW.modals.showModal('已清空已选图片');
    });

    elements.itemPhotosInput.addEventListener('change', async (event) => {
      await YW.crop.cropInputFiles(event.target, { aspectRatio: 1, multiple: true });
    });
    elements.personHomePhotoInput.addEventListener('change', async (event) => {
      await YW.crop.cropInputFiles(event.target, { aspectRatio: 4 / 5 });
    });
    elements.personDetailPhotoInput.addEventListener('change', async (event) => {
      await YW.crop.cropInputFiles(event.target, { aspectRatio: 1 });
    });
  }

  function bindSettingsEvents(elements) {
    // app-lifetime
    elements.settingsPersonSelect.addEventListener('change', (event) => {
      YW.state.viewState.settingsActivePersonId = event.target.value;
      YW.render.syncGallerySettings();
    });
    elements.overviewPersonSelect.addEventListener('change', (event) => {
      YW.state.viewState.overviewPersonId = event.target.value;
      YW.render.renderCurrentView();
    });

    YW.forms.bindSettingsPhotoInput(elements.settingsPersonHomePhotoInput, {
      field: 'homePhotoUrl',
      aspectRatio: 4 / 5,
      successMsg: '主页图片已更新',
      errorMsg: '主页图片更新失败，请重试',
    });
    YW.forms.bindSettingsPhotoInput(elements.settingsPersonDetailPhotoInput, {
      field: 'detailPhotoUrl',
      aspectRatio: 1,
      successMsg: '个人页图片已更新',
      errorMsg: '个人页图片更新失败，请重试',
    });

    elements.settingsDeletePersonBtn.addEventListener('click', () => handleDeleteCurrentPerson());
    elements.exportDataBtn.addEventListener('click', () => YW.storage.exportData());

    elements.importDataInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await YW.storage.importData(file);
      event.target.value = '';
    });

    elements.galleryToggleBtn.addEventListener('click', async () => {
      const person = YW.data.findPersonById(YW.state.viewState.settingsActivePersonId);
      if (!person) return;
      person.galleryEnabled = !person.galleryEnabled;
      await YW.storage.scheduleSave();
      YW.render.syncGallerySettings();
    });

    elements.galleryManageBtn.addEventListener('click', () => {
      const person = YW.data.findPersonById(YW.state.viewState.settingsActivePersonId);
      if (!person) return;
      if (!person.galleryEnabled) {
        person.galleryEnabled = true;
        YW.storage.scheduleSave();
        YW.render.syncGallerySettings();
      }
      YW.modals.openGalleryManageModal(person.id);
    });
  }

  function bindFormOptionEvents(elements) {
    // app-lifetime
    elements.itemPersonSelect.addEventListener('change', () => YW.render.syncGroupOptions());
    elements.itemGroupSelect.addEventListener('change', () => {
      YW.render.syncCategoryOptions(elements.itemGroupSelect.value);
    });
  }

  function bindSubmitForm(form, lockName, submitHandler) {
    // app-lifetime
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      YW.forms.withFormLock(form, lockName, submitHandler);
    });
  }

  function bindFormEvents(elements) {
    bindSubmitForm(elements.personForm, 'person', YW.forms.handlePersonFormSubmit);
    bindSubmitForm(elements.groupForm, 'group', YW.forms.handleGroupFormSubmit);
    bindSubmitForm(elements.categoryForm, 'category', YW.forms.handleCategoryFormSubmit);
    bindSubmitForm(elements.itemForm, 'item', YW.forms.handleItemFormSubmit);

    const lockNames = new Map([
      [elements.groupForm, 'group'],
      [elements.categoryForm, 'category'],
      [elements.personForm, 'person'],
      [elements.itemForm, 'item'],
    ]);
    for (const form of lockNames.keys()) {
      // app-lifetime
      form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && YW.forms.isFormLocked(lockNames.get(form))) event.preventDefault();
      });
    }
  }

  function bindDatePickerEvents(elements) {
    // app-lifetime
    elements.itemDateDisplay.addEventListener('click', () => {
      YW.forms.openDatePicker(elements.itemDateHidden.value);
    });
    elements.datePickerConfirmBtn.addEventListener('click', YW.forms.confirmDatePicker);
    elements.datePickerCancelBtn.addEventListener('click', YW.forms.cancelDatePicker);
    elements.datePickerModal.addEventListener('click', (event) => {
      if (event.target === elements.datePickerModal) YW.forms.cancelDatePicker();
    });
    elements.dateYearScroll.addEventListener('scroll', YW.forms.onColumnScroll, { passive: true });
    elements.dateMonthScroll.addEventListener('scroll', YW.forms.onColumnScroll, { passive: true });
    elements.dateDayScroll.addEventListener('scroll', YW.forms.onColumnScroll, { passive: true });
  }

  function bindEvents() {
    const elements = YW.dom.elements;
    bindNavigationEvents(elements);
    bindGlobalModalEvents(elements);
    bindFileInputEvents(elements);
    bindSettingsEvents(elements);
    bindFormOptionEvents(elements);
    bindFormEvents(elements);
    bindDatePickerEvents(elements);
  }

  async function handleDeleteCurrentPerson() {
    const personId = YW.state.viewState.settingsActivePersonId;
    const person = YW.data.findPersonById(personId);
    if (!person) return;
    await YW.modals.confirmAndDelete(
      `确认删除体育生"${person.name}"及其所有 YW 吗？该操作无法恢复。`,
      async () => {
        await YW.data.deletePerson(personId);
        const firstPersonId = YW.state.state.people[0]?.id ?? null;
        if (YW.state.viewState.selectedPersonId === personId) YW.state.viewState.selectedPersonId = firstPersonId;
        YW.state.viewState.settingsActivePersonId = firstPersonId;
        YW.state.viewState.overviewPersonId = firstPersonId;
      },
      '体育生已删除'
    );
  }

  async function initApp() {
    YW.dom.cacheElements();
    await YW.storage.loadState();
    await YW.data.syncMissingGroupOrders();
    if (YW.state.state.people.length > 0) {
      YW.state.viewState.settingsActivePersonId = YW.state.state.people[0].id;
      YW.state.viewState.overviewPersonId = YW.state.state.people[0].id;
    }
    bindEvents();
    YW.crop.bindCropModalEvents();
    YW.forms.syncDateDisplay(YW.config.DEFAULT_ITEM_DATE);
    YW.render.renderAll();
    YW.forms.syncFileSummaries();
  }

  Object.assign(YW.events, { bindEvents, initApp });
})(window.YW);

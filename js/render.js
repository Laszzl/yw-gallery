(function (YW) {
  YW.render = YW.render || {};

  const elements = YW.dom.elements;
  const state = YW.state.state;
  const viewState = YW.state.viewState;
  const { DEFAULT_ITEM_DATE } = YW.config;
  const isMacDevice = YW.config.isMacDevice;
  const {
    findPersonById,
    findItemById,
    findCategoryById,
    getCategoriesByGroupId,
    getItemsByPersonCategory,
    hasGroupContent,
    getGroupOrderIdsForPerson,
    getCategoryOrderIdsForPersonGroup,
    getOrderedGroupsForPerson,
    getOrderedCategoriesForPersonGroup,
    formatDate,
    formatItemLabel,
    formatItemStatus,
    itemHasPhotos,
    splitItemsByPhotos,
    compareItemsForDisplay,
    formatCategoryCounts,
  } = YW.data;
  function scheduleSave() { return YW.storage.scheduleSave(); }

  function reorderGroupsByDrag(personId, draggedGroupId, targetGroupId) {
    const order = [...getGroupOrderIdsForPerson(personId)];
    const draggedIndex = order.indexOf(draggedGroupId);
    const targetIndex = order.indexOf(targetGroupId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedGroupId === targetGroupId) return;
    const [moved] = order.splice(draggedIndex, 1);
    order.splice(targetIndex, 0, moved);
    state.groupOrderByPerson[personId] = order;
    scheduleSave();
    renderAll();
  }

  function reorderCategoriesByDrag(personId, groupId, draggedCategoryId, targetCategoryId) {
    const order = [...getCategoryOrderIdsForPersonGroup(personId, groupId)];
    const draggedIndex = order.indexOf(draggedCategoryId);
    const targetIndex = order.indexOf(targetCategoryId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedCategoryId === targetCategoryId) return;
    const [moved] = order.splice(draggedIndex, 1);
    order.splice(targetIndex, 0, moved);
    if (!state.categoryOrderByPerson[personId]) state.categoryOrderByPerson[personId] = {};
    state.categoryOrderByPerson[personId][groupId] = order;
    scheduleSave();
    renderAll();
  }

  function reorderItemsByDrag(draggedItemId, targetItemId) {
    const draggedItem = findItemById(draggedItemId);
    const targetItem = findItemById(targetItemId);
    if (!draggedItem || !targetItem) return;
    if (draggedItem.personId !== targetItem.personId || draggedItem.categoryId !== targetItem.categoryId) return;
    if (itemHasPhotos(draggedItem) !== itemHasPhotos(targetItem)) return;
    if ((draggedItem.date || DEFAULT_ITEM_DATE) !== (targetItem.date || DEFAULT_ITEM_DATE)) return;

    const sameTypeItems = getItemsByPersonCategory(draggedItem.personId, draggedItem.categoryId)
      .filter(
        (i) =>
          itemHasPhotos(i) === itemHasPhotos(draggedItem) &&
          (i.date || DEFAULT_ITEM_DATE) === (draggedItem.date || DEFAULT_ITEM_DATE)
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const draggedIndex = sameTypeItems.findIndex((i) => i.id === draggedItemId);
    const targetIndex = sameTypeItems.findIndex((i) => i.id === targetItemId);
    if (draggedIndex < 0 || targetIndex < 0) return;

    const [moved] = sameTypeItems.splice(draggedIndex, 1);
    sameTypeItems.splice(targetIndex, 0, moved);
    sameTypeItems.forEach((entry, index) => { entry.order = index; });

    scheduleSave();
    reorderRailCardsByItemList(sameTypeItems);
  }

  function reorderGalleryPhotosByDrag(personId, draggedIndexValue, targetIndexValue) {
    const person = findPersonById(personId);
    const draggedIndex = Number(draggedIndexValue);
    const targetIndex = Number(targetIndexValue);
    if (!person || !Array.isArray(person.galleryPhotos)) return;
    if (!Number.isInteger(draggedIndex) || !Number.isInteger(targetIndex)) return;
    if (draggedIndex === targetIndex) return;
    if (draggedIndex < 0 || targetIndex < 0) return;
    if (draggedIndex >= person.galleryPhotos.length || targetIndex >= person.galleryPhotos.length) return;

    const nextPhotos = [...person.galleryPhotos];
    const [moved] = nextPhotos.splice(draggedIndex, 1);
    nextPhotos.splice(targetIndex, 0, moved);
    person.galleryPhotos = nextPhotos;

    scheduleSave();
    renderGallery(person);
    YW.railMask.setupRailMasks();
  }

  function reorderRailCardsByItemList(itemsInOrder) {
    if (!itemsInOrder.length) return;
    const firstCard = document.querySelector('.rail-card[data-item-id="' + itemsInOrder[0].id + '"]');
    if (!firstCard || !firstCard.parentElement) return;
    const rail = firstCard.parentElement;
    const itemOrderMap = new Map(itemsInOrder.map(function (item, i) { return [item.id, i]; }));
    const cards = Array.from(rail.querySelectorAll('.rail-card'));
    cards.sort(function (a, b) {
      const aOrder = itemOrderMap.get(a.dataset.itemId);
      const bOrder = itemOrderMap.get(b.dataset.itemId);
      return (aOrder != null ? aOrder : 999) - (bOrder != null ? bOrder : 999);
    });
    for (let i = 0; i < cards.length; i++) {
      rail.appendChild(cards[i]);
    }
  }

  function createDragHandler({ dragOverClass, onDrop }) {
    return function attachDrag(element, id) {
      if (!isMacDevice) return;
      // ── Mac 桌面端：HTML5 拖拽 ──
      element.draggable = true;
      element.addEventListener('dragstart', (event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        element.classList.add('dragging');
      });
      element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        document.querySelectorAll('.' + dragOverClass + '.drag-over').forEach((n) => n.classList.remove('drag-over'));
      });
      element.addEventListener('dragenter', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (element.classList.contains('dragging')) return;
        element.classList.add('drag-over');
      });
      element.addEventListener('dragover', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (element.classList.contains('dragging')) return;
        event.dataTransfer.dropEffect = 'move';
        element.classList.add('drag-over');
      });
      element.addEventListener('dragleave', () => { element.classList.remove('drag-over'); });
      element.addEventListener('drop', (event) => {
        event.stopPropagation();
        event.preventDefault();
        element.classList.remove('drag-over');
        const draggedId = event.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === id) return;
        onDrop(draggedId, id, element, event);
      });
    };
  }

  const attachItemDrag = createDragHandler({
    dragOverClass: 'rail-card',
    onDrop: (draggedId, targetId) => reorderItemsByDrag(draggedId, targetId),
  });

  const attachOverviewGroupDrag = createDragHandler({
    dragOverClass: 'overview-group-card',
    onDrop: (draggedId, targetId, targetEl) => {
      const personId = targetEl.dataset.personId || viewState.overviewPersonId;
      if (personId) reorderGroupsByDrag(personId, draggedId, targetId);
    },
  });

  const attachOverviewCategoryDrag = createDragHandler({
    dragOverClass: 'overview-category-row',
    onDrop: (draggedId, targetId, targetEl) => {
      const personId = targetEl.dataset.personId || viewState.overviewPersonId;
      const groupId = targetEl.dataset.groupId;
      if (personId && groupId) reorderCategoriesByDrag(personId, groupId, draggedId, targetId);
    },
  });

  const attachGalleryDrag = createDragHandler({
    dragOverClass: 'gallery-card',
    onDrop: (draggedIndex, targetIndex, targetEl) => {
      const rail = targetEl.closest('.gallery-rail');
      const personId = rail ? rail.dataset.galleryPersonId : null;
      if (personId) reorderGalleryPhotosByDrag(personId, Number(draggedIndex), Number(targetIndex));
    },
  });

  // ═══════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════
  function updateNavHeight() {
    const hasAthletes = state.people.length > 0;
    document.body.style.setProperty('--ios-nav-height', hasAthletes
      ? YW.config.NAV_HEIGHT_WITH_ATHLETES
      : YW.config.NAV_HEIGHT_NO_ATHLETES);
  }

  function renderShell() {
    YW.state.ensureValidViewState();
    syncFormOptions();
    renderSwitcher();
    updateNavHeight();
  }

  function renderAll({ closeModals = true } = {}) {
    if (closeModals) YW.modals.closeTransientModals();
    renderShell();
    renderCurrentView();
  }

  function renderCurrentView() {
    elements.homeView.hidden = viewState.currentView !== 'home';
    elements.athleteView.hidden = viewState.currentView !== 'athlete';
    elements.addView.hidden = viewState.currentView !== 'add';
    elements.settingsView.hidden = viewState.currentView !== 'settings';

    if (viewState.currentView === 'home') renderHomeView();
    if (viewState.currentView === 'athlete') renderAthleteView();
    if (viewState.currentView === 'settings') { renderCategoryOverview(); syncGallerySettings(); }

  }

  function showView(view, selectedPersonId) {
    viewState.currentView = view;
    if (selectedPersonId !== undefined) {
      viewState.selectedPersonId = selectedPersonId;
    } else if (view !== 'athlete') {
      viewState.selectedPersonId = null;
    }
    renderAll();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showHomeView() { showView('home'); }
  function showAddView() { showView('add'); }
  function showAthleteView(personId) { showView('athlete', personId); }
  function showSettingsView() { showView('settings'); }

  function renderSwitcher() {
    elements.switcherScrollArea.replaceChildren();
    const overflow = state.people.length > 3;
    elements.athleteSwitcher.classList.toggle('scrollable', overflow);
    for (const person of state.people) {
      const fragment = elements.templates.switcherChip.content.cloneNode(true);
      const button = fragment.querySelector('.switcher-chip');
      button.textContent = person.name;
      button.setAttribute('aria-label', `查看${person.name}的图库`);
      const active = person.id === viewState.selectedPersonId;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      button.addEventListener('click', () => showAthleteView(person.id));
      elements.switcherScrollArea.append(fragment);
    }
  }

  function syncSelectOptions(select, records, emptyLabel, preferredValue = select.value) {
    const hasRecords = records.length > 0;
    select.replaceChildren();
    if (hasRecords) {
      for (const record of records) {
        const option = document.createElement('option');
        option.value = record.id;
        option.textContent = record.name;
        select.append(option);
      }
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyLabel;
      select.append(option);
    }
    select.disabled = !hasRecords;
    if (!hasRecords) return null;

    const selectedValue = records.some((record) => record.id === preferredValue) ? preferredValue : records[0].id;
    select.value = selectedValue;
    return selectedValue;
  }

  function syncFormOptions() {
    syncSelectOptions(elements.itemPersonSelect, state.people, '请先添加体育生');

    syncGroupOptions();

    viewState.settingsActivePersonId = syncSelectOptions(
      elements.settingsPersonSelect,
      state.people,
      '请先添加体育生',
      viewState.settingsActivePersonId
    );
    elements.settingsDeletePersonBtn.hidden = state.people.length === 0;

    viewState.overviewPersonId = syncSelectOptions(
      elements.overviewPersonSelect,
      state.people,
      '请先添加体育生',
      viewState.overviewPersonId
    );
  }

  function syncGallerySettings() {
    if (viewState.currentView !== 'settings') return;
    const personId = viewState.settingsActivePersonId;
    const person = findPersonById(personId);

    if (!person) {
      elements.gallerySettingsBlock.hidden = true;
      return;
    }

    elements.gallerySettingsBlock.hidden = false;

    const enabled = person.galleryEnabled === true;
    elements.galleryToggleBtn.classList.toggle('active', enabled);
    elements.galleryToggleBtn.setAttribute('aria-checked', String(enabled));

    const count = (person.galleryPhotos || []).length;
    elements.galleryPhotoCount.textContent = count > 0 ? `${count} 张图片` : '暂无图片';
  }

  function syncGroupOptions() {
    const activePersonForGroups = elements.itemPersonSelect.value || state.people[0]?.id || null;
    const nextGroups = getOrderedGroupsForPerson(activePersonForGroups);

    syncSelectOptions(elements.categoryGroupSelect, nextGroups, '请先添加大品类');
    const itemGroupId = syncSelectOptions(elements.itemGroupSelect, nextGroups, '请先添加大品类');
    syncCategoryOptions(itemGroupId);
  }

  function syncCategoryOptions(groupId) {
    const personId = elements.itemPersonSelect.value || state.people[0]?.id || null;
    const categories = getOrderedCategoriesForPersonGroup(personId, groupId);
    syncSelectOptions(elements.itemCategorySelect, categories, '当前大品类暂无小品类');
  }

  function renderHomeView() {
    elements.homeEmptyState.hidden = state.people.length > 0;
    elements.athleteSelectorGrid.hidden = state.people.length === 0;
    elements.athleteSelectorGrid.replaceChildren();

    const count = state.people.length;
    let fontSize;
    if (count === 1) fontSize = '4rem';
    else if (count === 2) fontSize = '2.4rem';
    else fontSize = '1.6rem';

    for (const person of state.people) {
      const fragment = elements.templates.selectorCard.content.cloneNode(true);
      const card = fragment.querySelector('.selector-card');
      const image = fragment.querySelector('.selector-image');
      const name = fragment.querySelector('.selector-name');
      name.textContent = person.name;
      name.style.fontSize = fontSize;
      card.addEventListener('click', () => showAthleteView(person.id));
      if (person.homePhotoUrl) {
        image.src = person.homePhotoUrl;
      }
      elements.athleteSelectorGrid.append(fragment);
    }
  }

  function renderAthleteView() {
    const person = findPersonById(viewState.selectedPersonId);
    elements.athleteDetailHero.replaceChildren();
    elements.athleteGallery.replaceChildren();
    elements.athleteGroupedContent.replaceChildren();
    if (!person) {
      viewState.currentView = 'home';
      viewState.selectedPersonId = state.people[0]?.id ?? null;
      renderSwitcher();
      renderCurrentView();
      return;
    }

    const heroFragment = elements.templates.detailHero.content.cloneNode(true);
    const heroImage = heroFragment.querySelector('.detail-hero-image');
    const heroName = heroFragment.querySelector('.detail-hero-name');
    heroName.textContent = person.name;
    if (person.detailPhotoUrl) heroImage.src = person.detailPhotoUrl;
    elements.athleteDetailHero.append(heroFragment);

    renderGallery(person);

    const groupsWithContent = getOrderedGroupsForPerson(person.id).filter((g) => hasGroupContent(person.id, g.id));
    for (const group of groupsWithContent) {
      elements.athleteGroupedContent.append(renderGroupSection(person.id, group));
    }
    YW.railMask.setupRailMasks();
  }

  function renderCategoryOverview() {
    const personId = viewState.overviewPersonId;
    elements.categoryOverviewList.replaceChildren();
    if (!personId) {
      const empty = document.createElement('p');
      empty.className = 'overview-empty';
      empty.textContent = '请先添加体育生';
      elements.categoryOverviewList.append(empty);
      return;
    }

    for (const group of getOrderedGroupsForPerson(personId)) {
      const fragment = elements.templates.overviewGroup.content.cloneNode(true);
      const card = fragment.querySelector('.overview-group-card');
      const title = fragment.querySelector('.overview-group-title');
      const meta = fragment.querySelector('.overview-group-meta');
      const content = fragment.querySelector('.overview-group-content');
      const groupToggle = fragment.querySelector('[data-group-toggle]');
      const remove = fragment.querySelector('[data-group-delete]');
      card.dataset.personId = personId;
      card.dataset.groupId = group.id;
      const categories = getOrderedCategoriesForPersonGroup(personId, group.id);
      const isCollapsed = Boolean(state.collapsedSettingsGroups[group.id]);

      title.textContent = group.name;
      meta.textContent = categories.length ? `${categories.length} 个小品类` : '暂无小品类';
      if (isCollapsed) card.classList.add('collapsed');
      groupToggle.setAttribute('aria-expanded', String(!isCollapsed));
      attachOverviewGroupDrag(card, group.id);

      groupToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        YW.data.toggleCollapsedState(group.id, state.collapsedSettingsGroups);
        card.classList.toggle('collapsed');
        groupToggle.setAttribute('aria-expanded', String(!card.classList.contains('collapsed')));
      });
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        handleDeleteGroup(group.id);
      });

      if (!categories.length) {
        const empty = document.createElement('p');
        empty.className = 'overview-empty';
        empty.textContent = '暂无小品类';
        content.append(empty);
      }
      for (const category of categories) {
        const catFragment = elements.templates.overviewCategory.content.cloneNode(true);
        const row = catFragment.querySelector('.overview-category-row');
        const name = catFragment.querySelector('.manager-row-title');
        const catDelete = catFragment.querySelector('[data-category-delete]');
        row.dataset.personId = personId;
        row.dataset.groupId = group.id;
        row.dataset.categoryId = category.id;
        name.textContent = category.name;
        attachOverviewCategoryDrag(row, category.id);
        catDelete.addEventListener('click', () => handleDeleteCategory(category.id));
        content.appendChild(row);
      }
      elements.categoryOverviewList.append(fragment);
    }
  }

  async function confirmAndDelete(confirmMsg, deleteFn, successMsg) {
    const confirmed = await YW.modals.showModal(confirmMsg, { showCancel: true });
    if (!confirmed) return;
    await deleteFn();
    renderAll();
    await YW.modals.showModal(successMsg);
  }

  async function handleDeleteGroup(groupId) {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;
    await confirmAndDelete(`确认删除大品类"${group.name}"及其所有小品类和 YW 吗？`, () => YW.data.deleteGroup(groupId), '大品类已删除');
  }

  async function handleDeleteCategory(categoryId) {
    const category = findCategoryById(categoryId);
    if (!category) return;
    await confirmAndDelete(`确认删除小品类"${category.name}"及其关联的所有 YW 吗？`, () => YW.data.deleteCategory(categoryId), '小品类已删除');
  }

  function renderGroupSection(personId, group) {
    const categoriesInGroup = getOrderedCategoriesForPersonGroup(personId, group.id).filter((c) =>
      getItemsByPersonCategory(personId, c.id).length > 0
    );
    const fragment = elements.templates.categorySection.content.cloneNode(true);
    const title = fragment.querySelector('.category-section-title');
    const subSections = fragment.querySelector('.subcategory-sections');
    title.textContent = group.name;

    for (const category of categoriesInGroup) {
      const categoryItems = getItemsByPersonCategory(personId, category.id)
        .sort(compareItemsForDisplay);

      const subFragment = elements.templates.subcategory.content.cloneNode(true);
      const block = subFragment.querySelector('.subcategory-block');
      const titleNode = subFragment.querySelector('.subcategory-title');
      const countsNode = subFragment.querySelector('.subcategory-counts');
      const imageRail = subFragment.querySelector('.image-items-rail');
      const textRail = subFragment.querySelector('.text-items-rail');
      const toggle = subFragment.querySelector('[data-subcategory-toggle]');

      const collapseKey = `${personId}:${category.id}`;
      block.dataset.personId = personId;
      block.dataset.categoryId = category.id;
      const isCollapsed = Boolean(state.collapsedSubcategories[collapseKey]);
      if (isCollapsed) block.classList.add('collapsed');
      toggle.setAttribute('aria-expanded', String(!isCollapsed));
      titleNode.textContent = category.name;
      countsNode.textContent = formatCategoryCounts(categoryItems);
      toggle.addEventListener('click', () => {
        YW.data.toggleCollapsedState(collapseKey, state.collapsedSubcategories);
        block.classList.toggle('collapsed');
        toggle.setAttribute('aria-expanded', String(!block.classList.contains('collapsed')));
      });

      const { imageItems, textItems } = splitItemsByPhotos(categoryItems);

      for (const item of imageItems) appendImageItemCard(imageRail, item);
      for (const item of textItems) appendTextItemCard(textRail, item);

      if (!imageRail.childElementCount) imageRail.parentElement.hidden = true;
      if (!textRail.childElementCount) textRail.parentElement.hidden = true;
      subSections.append(subFragment);
    }
    return fragment;
  }

  function renderGallery(person) {
    const savedScrollY = window.scrollY;
    const oldRail = elements.athleteGallery.querySelector('.gallery-rail');
    const savedRailScrollLeft = oldRail ? oldRail.scrollLeft : 0;
    elements.athleteGallery.replaceChildren();

    if (!person.galleryEnabled || !person.galleryPhotos || person.galleryPhotos.length === 0) {
      elements.athleteGallery.hidden = true;
      return;
    }

    elements.athleteGallery.hidden = false;

    const heading = document.createElement('div');
    heading.className = 'gallery-heading';
    const title = document.createElement('h2');
    title.className = 'gallery-title';
    title.textContent = '画廊';
    const counts = document.createElement('p');
    counts.className = 'gallery-counts';
    counts.textContent = `${person.galleryPhotos.length} 张`;
    heading.append(title, counts);
    elements.athleteGallery.append(heading);

    const railBlock = document.createElement('div');
    railBlock.className = 'rail-block';
    const railList = document.createElement('div');
    railList.className = 'rail-list gallery-rail';
    railList.dataset.galleryPersonId = person.id;

    for (let i = 0; i < person.galleryPhotos.length; i++) {
      const photoUrl = person.galleryPhotos[i];
      const frag = elements.templates.galleryCard.content.cloneNode(true);
      const card = frag.querySelector('.gallery-card');
      const image = frag.querySelector('.gallery-card-image');
      image.src = photoUrl;
      card.dataset.galleryIndex = String(i);
      attachGalleryDrag(card, String(i));
      railList.append(frag);
    }

    railBlock.append(railList);
    elements.athleteGallery.append(railBlock);

    if (savedRailScrollLeft > 0) {
      railList.scrollLeft = Math.min(savedRailScrollLeft, railList.scrollWidth - railList.clientWidth);
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    });
  }

  function hydrateItemCard(card, item, type, { titleSelector, dateSelector, statusSelector }) {
    const title = card.querySelector(titleSelector);
    const dateEl = card.querySelector(dateSelector);
    const statusEl = card.querySelector(statusSelector);
    const menuToggle = card.querySelector('[data-item-menu-toggle]');

    title.textContent = formatItemLabel(item);
    if (statusEl) statusEl.textContent = formatItemStatus(item);
    dateEl.textContent = formatDate(item.date) || '98/3/25';
    menuToggle.addEventListener('click', () => YW.modals.openItemActionsModal(item.id, type));
    card.dataset.itemId = item.id;
    attachItemDrag(card, item.id);
  }

  function buildImageItemCard(item) {
    const fragment = elements.templates.ywCard.content.cloneNode(true);
    const card = fragment.querySelector('.rail-card');
    const image = fragment.querySelector('.yw-card-image');
    const imageWrap = fragment.querySelector('.yw-card-image-wrap');

    hydrateItemCard(card, item, 'image', { titleSelector: '.yw-title', dateSelector: '.yw-date', statusSelector: '.yw-status' });

    const urls = item.photoUrls || [];
    if (urls.length > 0) {
      image.src = urls[0];
      image.dataset.photoIndex = '0';
      if (urls.length > 1) {
        imageWrap.classList.add('has-multi-photos');
        const counter = document.createElement('span');
        counter.className = 'photo-counter';
        counter.textContent = `1/${urls.length}`;
        imageWrap.append(counter);
        imageWrap.addEventListener('click', () => {
          let idx = parseInt(image.dataset.photoIndex, 10);
          idx = (idx + 1) % urls.length;
          image.dataset.photoIndex = String(idx);
          image.src = urls[idx];
          counter.textContent = `${idx + 1}/${urls.length}`;
        });
      }
    }
    return card;
  }

  function appendImageItemCard(container, item) {
    container.append(buildImageItemCard(item));
  }

  function buildTextItemCard(item) {
    const fragment = elements.templates.textItem.content.cloneNode(true);
    const card = fragment.querySelector('.rail-card');

    hydrateItemCard(card, item, 'text', { titleSelector: '.text-item-title', dateSelector: '.text-item-date', statusSelector: '.text-item-status' });
    return card;
  }

  function appendTextItemCard(container, item) {
    container.append(buildTextItemCard(item));
  }

  function findItemCard(itemId) {
    return Array.from(document.querySelectorAll('.rail-card[data-item-id]')).find((card) => card.dataset.itemId === itemId) || null;
  }

  function getRenderedSubcategoryBlock(personId, categoryId) {
    return Array.from(document.querySelectorAll('.subcategory-block[data-person-id][data-category-id]')).find((block) =>
      block.dataset.personId === personId && block.dataset.categoryId === categoryId
    ) || null;
  }

  function updateRailVisibility(block) {
    const imageRail = block.querySelector('.image-items-rail');
    const textRail = block.querySelector('.text-items-rail');
    if (imageRail?.parentElement) imageRail.parentElement.hidden = imageRail.childElementCount === 0;
    if (textRail?.parentElement) textRail.parentElement.hidden = textRail.childElementCount === 0;
  }

  function refreshCategoryCounts(personId, categoryId) {
    const block = getRenderedSubcategoryBlock(personId, categoryId);
    if (!block) return;
    const categoryItems = getItemsByPersonCategory(personId, categoryId);
    const countsNode = block.querySelector('.subcategory-counts');
    if (!countsNode) return;
    countsNode.textContent = formatCategoryCounts(categoryItems);
  }

  function removeEmptyRenderedSubcategory(personId, categoryId) {
    if (state.items.some((item) => item.personId === personId && item.categoryId === categoryId)) return false;
    const block = getRenderedSubcategoryBlock(personId, categoryId);
    if (!block) return false;
    const section = block.closest('.category-section');
    block.remove();
    if (section && !section.querySelector('.subcategory-block')) section.remove();
    return true;
  }

  function refreshItemCard(itemId) {
    const item = findItemById(itemId);
    if (!item) return;
    const block = getRenderedSubcategoryBlock(item.personId, item.categoryId);
    if (!block) return;

    const targetRail = itemHasPhotos(item)
      ? block.querySelector('.image-items-rail')
      : block.querySelector('.text-items-rail');
    if (!targetRail) return;

    const currentCard = findItemCard(itemId);
    const nextCard = itemHasPhotos(item) ? buildImageItemCard(item) : buildTextItemCard(item);
    if (currentCard) currentCard.replaceWith(nextCard);
    insertCardSorted(targetRail, nextCard, item);

    refreshCategoryCounts(item.personId, item.categoryId);
    updateRailVisibility(block);
    YW.railMask.setupRailMasks();
  }

  function insertCardSorted(rail, card, item) {
    const existingCards = Array.from(rail.querySelectorAll('.rail-card[data-item-id]'));
    const otherCards = existingCards.filter((c) => c.dataset.itemId !== item.id);

    let insertBeforeCard = null;
    for (const otherCard of otherCards) {
      const otherItem = findItemById(otherCard.dataset.itemId);
      if (!otherItem) continue;
      if (compareItemsForDisplay(item, otherItem) < 0) {
        insertBeforeCard = otherCard;
        break;
      }
    }

    if (insertBeforeCard) {
      rail.insertBefore(card, insertBeforeCard);
    } else {
      rail.appendChild(card);
    }
  }

  function removeItemCard(itemId, removedItem) {
    const card = findItemCard(itemId);
    if (card) card.remove();
    if (!removedItem) return;
    if (removeEmptyRenderedSubcategory(removedItem.personId, removedItem.categoryId)) {
      YW.railMask.setupRailMasks();
      return;
    }
    const block = getRenderedSubcategoryBlock(removedItem.personId, removedItem.categoryId);
    if (!block) return;
    refreshCategoryCounts(removedItem.personId, removedItem.categoryId);
    updateRailVisibility(block);
    YW.railMask.setupRailMasks();
  }

  Object.assign(YW.render, {
    updateNavHeight,
    renderShell,
    renderAll,
    renderCurrentView,
    showHomeView,
    showAddView,
    showAthleteView,
    showSettingsView,
    renderGallery,
    refreshCategoryCounts,
    refreshItemCard,
    removeItemCard,
    syncSelectOptions,
    syncFormOptions,
    syncGroupOptions,
    syncCategoryOptions,
    syncGallerySettings,
  });
})(window.YW);

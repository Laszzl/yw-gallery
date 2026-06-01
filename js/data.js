(function (YW) {
  YW.data = YW.data || {};

  const state = YW.state.state;
  const { DEFAULT_ITEM_DATE } = YW.config;

  function saveStateStrict() { return YW.storage.saveStateStrict(); }
  function scheduleSave() { return YW.storage.scheduleSave(); }

  function normalizeName(value) {
    return String(value).trim().replace(/\s+/g, '').toLowerCase();
  }

  const formatDate = YW.utils.formatDateShort;
  const daysInMonth = YW.utils.daysInMonth;
  const toDateDisplay = YW.utils.formatDateDisplay;

  function formatItemLabel(item) {
    let text = item.label;
    if (item.quantity && item.unit) {
      text += ' · ' + item.quantity + item.unit;
    }
    return text;
  }

  function formatItemStatus(item) {
    const parts = [];
    if (item.isGift) parts.push('赠送');
    parts.push(item.isOwnedNow ? '现存' : '非现存');
    return parts.join(' · ');
  }

  function itemHasPhotos(item) {
    return (item.photoUrls || []).length > 0;
  }

  function splitItemsByPhotos(items) {
    return items.reduce((groups, item) => {
      groups[itemHasPhotos(item) ? 'imageItems' : 'textItems'].push(item);
      return groups;
    }, { imageItems: [], textItems: [] });
  }

  function compareItemsForDisplay(a, b) {
    return (b.date || DEFAULT_ITEM_DATE).localeCompare(a.date || DEFAULT_ITEM_DATE) ||
      (a.order ?? 0) - (b.order ?? 0) ||
      String(a.label || '').localeCompare(String(b.label || ''), 'zh-Hans-CN');
  }

  function formatCategoryCounts(items) {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const ownedQty = items.reduce((sum, item) => sum + (item.isOwnedNow ? item.quantity : 0), 0);
    return `总数量 ${totalQty} · 现存 ${ownedQty}`;
  }

  function findPersonById(personId) {
    return state.people.find((person) => person.id === personId);
  }

  function findItemById(itemId) {
    return state.items.find((item) => item.id === itemId);
  }

  function findCategoryById(categoryId) {
    return state.categories.find((category) => category.id === categoryId);
  }

  function getCategoriesByGroupId(groupId) {
    return state.categories.filter((category) => category.groupId === groupId);
  }

  function getItemsByPersonCategory(personId, categoryId) {
    return state.items.filter((item) => item.personId === personId && item.categoryId === categoryId);
  }

  function hasGroupContent(personId, groupId) {
    return getCategoriesByGroupId(groupId).some(
      (category) => getItemsByPersonCategory(personId, category.id).length > 0
    );
  }

  // ═══════════════════════════════════════════════
  // Order helpers
  // ═══════════════════════════════════════════════
  function getGroupOrderIdsForPerson(personId) {
    return state.groupOrderByPerson[personId] || state.groups.map((g) => g.id);
  }

  function getCategoryOrderIdsForPersonGroup(personId, groupId) {
    return state.categoryOrderByPerson[personId]?.[groupId] ||
      getCategoriesByGroupId(groupId).map((category) => category.id);
  }

  function getOrderedGroupsForPerson(personId) {
    if (!personId) return state.groups.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const orderIds = getGroupOrderIdsForPerson(personId);
    const groupMap = new Map(state.groups.map((g) => [g.id, g]));
    return orderIds.map((id) => groupMap.get(id)).filter(Boolean);
  }

  function getOrderedCategoriesForPersonGroup(personId, groupId) {
    if (!groupId) return [];
    if (!personId) {
      return getCategoriesByGroupId(groupId);
    }
    const orderIds = getCategoryOrderIdsForPersonGroup(personId, groupId);
    const categoryMap = new Map(
      getCategoriesByGroupId(groupId).map((category) => [category.id, category])
    );
    return orderIds.map((id) => categoryMap.get(id)).filter(Boolean);
  }

  function reorderIdList(currentOrder, draggedId, targetId) {
    const order = [...currentOrder];
    const draggedIndex = order.indexOf(draggedId);
    const targetIndex = order.indexOf(targetId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedId === targetId) return null;
    const [moved] = order.splice(draggedIndex, 1);
    order.splice(targetIndex, 0, moved);
    return order;
  }

  function reorderGroupsForPerson(personId, draggedGroupId, targetGroupId) {
    const order = reorderIdList(getGroupOrderIdsForPerson(personId), draggedGroupId, targetGroupId);
    if (!order) return false;
    state.groupOrderByPerson[personId] = order;
    scheduleSave();
    return true;
  }

  function reorderCategoriesForPersonGroup(personId, groupId, draggedCategoryId, targetCategoryId) {
    const order = reorderIdList(getCategoryOrderIdsForPersonGroup(personId, groupId), draggedCategoryId, targetCategoryId);
    if (!order) return false;
    if (!state.categoryOrderByPerson[personId]) state.categoryOrderByPerson[personId] = {};
    state.categoryOrderByPerson[personId][groupId] = order;
    scheduleSave();
    return true;
  }

  function getSameDragTypeItems(item) {
    return getItemsByPersonCategory(item.personId, item.categoryId)
      .filter(
        (entry) =>
          itemHasPhotos(entry) === itemHasPhotos(item) &&
          (entry.date || DEFAULT_ITEM_DATE) === (item.date || DEFAULT_ITEM_DATE)
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function reorderItemsByDrag(draggedItemId, targetItemId) {
    const draggedItem = findItemById(draggedItemId);
    const targetItem = findItemById(targetItemId);
    if (!draggedItem || !targetItem) return null;
    if (draggedItem.personId !== targetItem.personId || draggedItem.categoryId !== targetItem.categoryId) return null;
    if (itemHasPhotos(draggedItem) !== itemHasPhotos(targetItem)) return null;
    if ((draggedItem.date || DEFAULT_ITEM_DATE) !== (targetItem.date || DEFAULT_ITEM_DATE)) return null;

    const sameTypeItems = getSameDragTypeItems(draggedItem);
    const draggedIndex = sameTypeItems.findIndex((item) => item.id === draggedItemId);
    const targetIndex = sameTypeItems.findIndex((item) => item.id === targetItemId);
    if (draggedIndex < 0 || targetIndex < 0) return null;

    const [moved] = sameTypeItems.splice(draggedIndex, 1);
    sameTypeItems.splice(targetIndex, 0, moved);
    sameTypeItems.forEach((entry, index) => { entry.order = index; });
    scheduleSave();
    return sameTypeItems;
  }

  function reorderGalleryPhotos(personId, draggedIndexValue, targetIndexValue) {
    const person = findPersonById(personId);
    const draggedIndex = Number(draggedIndexValue);
    const targetIndex = Number(targetIndexValue);
    if (!person || !Array.isArray(person.galleryPhotos)) return null;
    if (!Number.isInteger(draggedIndex) || !Number.isInteger(targetIndex)) return null;
    if (draggedIndex === targetIndex || draggedIndex < 0 || targetIndex < 0) return null;
    if (draggedIndex >= person.galleryPhotos.length || targetIndex >= person.galleryPhotos.length) return null;

    const nextPhotos = [...person.galleryPhotos];
    const [moved] = nextPhotos.splice(draggedIndex, 1);
    nextPhotos.splice(targetIndex, 0, moved);
    person.galleryPhotos = nextPhotos;
    scheduleSave();
    return person;
  }

  // ═══════════════════════════════════════════════
  // Photo helpers (local, base64 data URLs)
  // ═══════════════════════════════════════════════
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function readFilesAsDataURLs(files) {
    const photoUrls = [];
    for (const file of files) {
      photoUrls.push(await readFileAsDataURL(file));
    }
    return photoUrls;
  }

  async function createPerson(name, homePhotoFile, detailPhotoFile) {
    let homePhotoUrl = null;
    let detailPhotoUrl = null;

    if (homePhotoFile instanceof File && homePhotoFile.size > 0) {
      homePhotoUrl = await readFileAsDataURL(homePhotoFile);
    }
    if (detailPhotoFile instanceof File && detailPhotoFile.size > 0) {
      detailPhotoUrl = await readFileAsDataURL(detailPhotoFile);
    }

    const person = { id: crypto.randomUUID(), name, homePhotoUrl, detailPhotoUrl, galleryEnabled: false, galleryPhotos: [] };
    state.people.push(person);
    state.groupOrderByPerson[person.id] = state.groups.map((g) => g.id);
    await saveStateStrict();
    return person;
  }

  async function updatePersonPhoto(personId, field, file) {
    const photoUrlValue = await readFileAsDataURL(file);
    const person = findPersonById(personId);
    if (person) person[field] = photoUrlValue;
    await saveStateStrict();
  }

  async function deletePerson(personId) {
    state.people = state.people.filter((p) => p.id !== personId);
    state.items = state.items.filter((item) => item.personId !== personId);
    delete state.groupOrderByPerson[personId];
    delete state.categoryOrderByPerson[personId];
    for (const key of Object.keys(state.collapsedSubcategories)) {
      if (key.startsWith(personId + ':')) delete state.collapsedSubcategories[key];
    }
    await saveStateStrict();
  }

  // ═══════════════════════════════════════════════
  // CRUD: Groups
  // ═══════════════════════════════════════════════
  async function createGroup(name) {
    const group = { id: crypto.randomUUID(), name };
    state.groups.push(group);

    for (const person of state.people) {
      if (!state.groupOrderByPerson[person.id]) state.groupOrderByPerson[person.id] = [];
      state.groupOrderByPerson[person.id].push(group.id);
    }
    await saveStateStrict();
  }

  async function deleteGroup(groupId) {
    const categoryIds = getCategoriesByGroupId(groupId).map((category) => category.id);
    state.groups = state.groups.filter((g) => g.id !== groupId);
    state.categories = state.categories.filter((c) => c.groupId !== groupId);
    state.items = state.items.filter((item) => !categoryIds.includes(item.categoryId));
    delete state.collapsedSettingsGroups[groupId];
    for (const personId of Object.keys(state.groupOrderByPerson)) {
      state.groupOrderByPerson[personId] = state.groupOrderByPerson[personId].filter((id) => id !== groupId);
    }
    for (const personId of Object.keys(state.categoryOrderByPerson)) {
      delete state.categoryOrderByPerson[personId][groupId];
    }
    for (const key of Object.keys(state.collapsedSubcategories)) {
      const catId = key.split(':')[1];
      if (categoryIds.includes(catId)) delete state.collapsedSubcategories[key];
    }
    await saveStateStrict();
  }

  // ═══════════════════════════════════════════════
  // CRUD: Categories
  // ═══════════════════════════════════════════════
  async function createCategory(groupId, name) {
    const category = { id: crypto.randomUUID(), groupId, name };
    state.categories.push(category);

    for (const person of state.people) {
      ensureCategoryOrderForPersonGroup(person.id, groupId);
      const order = state.categoryOrderByPerson[person.id][groupId];
      if (!order.includes(category.id)) {
        order.push(category.id);
      }
    }
    await saveStateStrict();
  }

  async function deleteCategory(categoryId) {
    const category = findCategoryById(categoryId);
    if (!category) return;
    state.categories = state.categories.filter((c) => c.id !== categoryId);
    state.items = state.items.filter((item) => item.categoryId !== categoryId);
    for (const personId of Object.keys(state.categoryOrderByPerson)) {
      const groupMap = state.categoryOrderByPerson[personId];
      if (groupMap?.[category.groupId]) {
        groupMap[category.groupId] = groupMap[category.groupId].filter((id) => id !== categoryId);
        if (!groupMap[category.groupId].length) delete groupMap[category.groupId];
      }
    }
    for (const key of Object.keys(state.collapsedSubcategories)) {
      if (key.endsWith(':' + categoryId)) delete state.collapsedSubcategories[key];
    }
    await saveStateStrict();
  }

  // ═══════════════════════════════════════════════
  // CRUD: Items
  // ═══════════════════════════════════════════════
  function moveItemToFront(item) {
    const siblings = getItemsByPersonCategory(item.personId, item.categoryId)
      .filter((entry) => entry.id !== item.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    item.order = 0;
    siblings.forEach((sib, i) => { sib.order = i + 1; });
  }

  async function createItem(itemData) {
    const personExists = state.people.some((person) => person.id === itemData.personId);
    const groupExists = state.groups.some((group) => group.id === itemData.groupId);
    const category = findCategoryById(itemData.categoryId);
    if (!personExists || !groupExists || !category || category.groupId !== itemData.groupId) {
      throw new Error('Invalid item references');
    }

    const item = {
      id: crypto.randomUUID(),
      personId: itemData.personId,
      categoryId: itemData.categoryId,
      label: itemData.label,
      quantity: itemData.quantity,
      unit: itemData.unit,
      date: itemData.date || DEFAULT_ITEM_DATE,
      isGift: itemData.isGift,
      isOwnedNow: itemData.isOwnedNow,
      photoUrls: itemData.photoUrls || [],
      order: 0,
    };
    state.items.push(item);
    moveItemToFront(item);
    await saveStateStrict();
    return item;
  }

  async function deleteItem(itemId) {
    state.items = state.items.filter((item) => item.id !== itemId);
    await saveStateStrict();
  }

  async function updateItemPhotos(itemId, photoUrls) {
    const item = findItemById(itemId);
    if (item) {
      item.photoUrls = photoUrls;
    }
    await saveStateStrict();
  }

  function toggleCollapsedState(id, storageObj) {
    storageObj[id] = !storageObj[id];
    scheduleSave();
  }

  // ═══════════════════════════════════════════════
  // Data helpers (order initialization)
  // ═══════════════════════════════════════════════
  function ensureCategoryOrderForPersonGroup(personId, groupId) {
    if (!personId || !groupId) return;
    if (!state.categoryOrderByPerson[personId]) state.categoryOrderByPerson[personId] = {};
    let order = state.categoryOrderByPerson[personId][groupId];
    if (!Array.isArray(order)) {
      order = getCategoriesByGroupId(groupId).map((category) => category.id);
      state.categoryOrderByPerson[personId][groupId] = order;
    }
  }

  async function syncMissingGroupOrders() {
    const changed = YW.state.normalizeState();
    if (changed) await saveStateStrict();
  }


  Object.assign(YW.data, {
    normalizeName,
    formatDate,
    daysInMonth,
    toDateDisplay,
    formatItemLabel,
    formatItemStatus,
    itemHasPhotos,
    splitItemsByPhotos,
    compareItemsForDisplay,
    formatCategoryCounts,
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
    reorderGroupsForPerson,
    reorderCategoriesForPersonGroup,
    reorderItemsByDrag,
    reorderGalleryPhotos,
    readFileAsDataURL,
    readFilesAsDataURLs,
    createPerson,
    updatePersonPhoto,
    deletePerson,
    createGroup,
    deleteGroup,
    createCategory,
    deleteCategory,
    createItem,
    deleteItem,
    updateItemPhotos,
    toggleCollapsedState,
    ensureCategoryOrderForPersonGroup,
    syncMissingGroupOrders,
  });
})(window.YW);

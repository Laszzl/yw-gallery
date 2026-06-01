(function (YW) {
  YW.state = YW.state || {};

  const { DEFAULT_ITEM_DATE } = YW.config;
  const { isPlainObject, isValidDateString } = YW.utils;

  function createEmptyState() {
    return {
      people: [],
      groups: [],
      categories: [],
      items: [],
      collapsedSubcategories: {},
      collapsedSettingsGroups: {},
      groupOrderByPerson: {},
      categoryOrderByPerson: {},
    };
  }

  function normalizeOrderList(currentOrder, validIds) {
    const validSet = new Set(validIds);
    const seen = new Set();
    const normalized = [];

    if (Array.isArray(currentOrder)) {
      for (const id of currentOrder) {
        if (validSet.has(id) && !seen.has(id)) {
          normalized.push(id);
          seen.add(id);
        }
      }
    }

    for (const id of validIds) {
      if (!seen.has(id)) normalized.push(id);
    }

    return normalized;
  }

  function arraysEqual(a, b) {
    if (!Array.isArray(a) || a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  function validateStateShape(data) {
    if (!isPlainObject(data)) return { ok: false, message: '备份文件根数据格式错误' };
    const missingKeys = ['people', 'groups', 'categories', 'items'].filter((key) => !Array.isArray(data[key]));
    if (missingKeys.length > 0) return { ok: false, message: '备份文件数据不完整，缺少关键字段：' + missingKeys.join('、') };
    for (const key of ['collapsedSubcategories', 'collapsedSettingsGroups', 'groupOrderByPerson', 'categoryOrderByPerson']) {
      if (data[key] !== undefined && !isPlainObject(data[key])) return { ok: false, message: `备份文件字段 ${key} 格式错误` };
    }
    return { ok: true };
  }

  function validatePeople(people) {
    const personIds = new Set();
    for (const person of people) {
      if (!isPlainObject(person) || typeof person.id !== 'string' || !person.id || typeof person.name !== 'string') {
        return { ok: false, message: '备份文件中的体育生数据格式错误' };
      }
      if (personIds.has(person.id)) return { ok: false, message: `备份文件存在重复体育生 ID：${person.id}` };
      personIds.add(person.id);
      if (person.galleryEnabled !== undefined && typeof person.galleryEnabled !== 'boolean') {
        return { ok: false, message: `体育生"${person.name}"的画廊状态格式错误` };
      }
      if (person.galleryPhotos !== undefined && (!Array.isArray(person.galleryPhotos) || person.galleryPhotos.some((url) => typeof url !== 'string'))) {
        return { ok: false, message: `体育生"${person.name}"的画廊图片格式错误` };
      }
    }
    return { ok: true, personIds };
  }

  function validateGroups(groups) {
    const groupIds = new Set();
    for (const group of groups) {
      if (!isPlainObject(group) || typeof group.id !== 'string' || !group.id || typeof group.name !== 'string') {
        return { ok: false, message: '备份文件中的大品类数据格式错误' };
      }
      if (groupIds.has(group.id)) return { ok: false, message: `备份文件存在重复大品类 ID：${group.id}` };
      groupIds.add(group.id);
    }
    return { ok: true, groupIds };
  }

  function validateCategories(categories, groupIds) {
    const categoriesById = new Map();
    for (const category of categories) {
      if (!isPlainObject(category) || typeof category.id !== 'string' || !category.id || typeof category.name !== 'string' || typeof category.groupId !== 'string') {
        return { ok: false, message: '备份文件中的小品类数据格式错误' };
      }
      if (categoriesById.has(category.id)) return { ok: false, message: `备份文件存在重复小品类 ID：${category.id}` };
      if (!groupIds.has(category.groupId)) return { ok: false, message: `小品类"${category.name}"引用了不存在的大品类` };
      categoriesById.set(category.id, category);
    }
    return { ok: true, categoriesById };
  }

  function validateItems(items, personIds, categoriesById) {
    const itemIds = new Set();
    for (const item of items) {
      if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id || typeof item.personId !== 'string' || typeof item.categoryId !== 'string' || typeof item.label !== 'string' || typeof item.unit !== 'string') {
        return { ok: false, message: '备份文件中的 YW 数据格式错误' };
      }
      if (itemIds.has(item.id)) return { ok: false, message: `备份文件存在重复 YW ID：${item.id}` };
      itemIds.add(item.id);
      if (!personIds.has(item.personId)) return { ok: false, message: `YW"${item.label}"引用了不存在的体育生` };
      if (!categoriesById.has(item.categoryId)) return { ok: false, message: `YW"${item.label}"引用了不存在的小品类` };
      if (!Number.isInteger(item.quantity) || item.quantity < 1) return { ok: false, message: `YW"${item.label}"的数量格式错误` };
      if (!isValidDateString(item.date || DEFAULT_ITEM_DATE)) return { ok: false, message: `YW"${item.label}"的日期格式错误` };
      if (item.isGift !== undefined && typeof item.isGift !== 'boolean') return { ok: false, message: `YW"${item.label}"的赠送状态格式错误` };
      if (item.isOwnedNow !== undefined && typeof item.isOwnedNow !== 'boolean') return { ok: false, message: `YW"${item.label}"的现存状态格式错误` };
      if (item.photoUrls !== undefined && (!Array.isArray(item.photoUrls) || item.photoUrls.some((url) => typeof url !== 'string'))) {
        return { ok: false, message: `YW"${item.label}"的图片格式错误` };
      }
    }
    return { ok: true };
  }

  function validateImportedState(data) {
    const shape = validateStateShape(data);
    if (!shape.ok) return shape;
    const people = validatePeople(data.people);
    if (!people.ok) return people;
    const groups = validateGroups(data.groups);
    if (!groups.ok) return groups;
    const categories = validateCategories(data.categories, groups.groupIds);
    if (!categories.ok) return categories;
    const items = validateItems(data.items, people.personIds, categories.categoriesById);
    if (!items.ok) return items;

    return {
      ok: true,
      data: {
        people: data.people,
        groups: data.groups,
        categories: data.categories,
        items: data.items,
        collapsedSubcategories: data.collapsedSubcategories || {},
        collapsedSettingsGroups: data.collapsedSettingsGroups || {},
        groupOrderByPerson: data.groupOrderByPerson || {},
        categoryOrderByPerson: data.categoryOrderByPerson || {},
      },
    };
  }

  const state = createEmptyState();

  const viewState = {
    currentView: 'home',
    selectedPersonId: null,
    settingsActivePersonId: null,
    overviewPersonId: null,
  };

  function serializeState() {
    return {
      people: state.people,
      groups: state.groups,
      categories: state.categories,
      items: state.items,
      collapsedSubcategories: state.collapsedSubcategories,
      collapsedSettingsGroups: state.collapsedSettingsGroups,
      groupOrderByPerson: state.groupOrderByPerson,
      categoryOrderByPerson: state.categoryOrderByPerson,
    };
  }

  function restoreStateFromData(data) {
    state.people = data.people || [];
    state.groups = data.groups || [];
    state.categories = data.categories || [];
    state.items = data.items || [];
    state.collapsedSubcategories = data.collapsedSubcategories || {};
    state.collapsedSettingsGroups = data.collapsedSettingsGroups || {};
    state.groupOrderByPerson = data.groupOrderByPerson || {};
    state.categoryOrderByPerson = data.categoryOrderByPerson || {};
    return normalizeState();
  }

  function ensureOrderMaps() {
    let changed = false;
    if (!state.groupOrderByPerson || typeof state.groupOrderByPerson !== 'object') {
      state.groupOrderByPerson = {};
      changed = true;
    }
    if (!state.categoryOrderByPerson || typeof state.categoryOrderByPerson !== 'object') {
      state.categoryOrderByPerson = {};
      changed = true;
    }
    return changed;
  }

  function normalizeItems() {
    let changed = false;
    if (!Array.isArray(state.items)) {
      state.items = [];
      return true;
    }
    for (const item of state.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        item.quantity = 1;
        changed = true;
      }
      if (!isValidDateString(item.date)) {
        item.date = DEFAULT_ITEM_DATE;
        changed = true;
      }
      if (typeof item.isGift !== 'boolean') {
        item.isGift = false;
        changed = true;
      }
      if (typeof item.isOwnedNow !== 'boolean') {
        item.isOwnedNow = true;
        changed = true;
      }
      if (!Array.isArray(item.photoUrls)) {
        item.photoUrls = [];
        changed = true;
      }
      if (!Number.isFinite(item.order)) {
        item.order = 0;
        changed = true;
      }
    }
    return changed;
  }

  function pruneMissingPeopleOrders(peopleIdSet) {
    let changed = false;
    for (const personId of Object.keys(state.groupOrderByPerson)) {
      if (!peopleIdSet.has(personId)) {
        delete state.groupOrderByPerson[personId];
        changed = true;
      }
    }
    for (const personId of Object.keys(state.categoryOrderByPerson)) {
      if (!peopleIdSet.has(personId)) {
        delete state.categoryOrderByPerson[personId];
        changed = true;
      }
    }
    return changed;
  }

  function normalizePersonGallery(person) {
    let changed = false;
    if (person.galleryEnabled === undefined) { person.galleryEnabled = false; changed = true; }
    if (!Array.isArray(person.galleryPhotos)) { person.galleryPhotos = []; changed = true; }
    return changed;
  }

  function normalizePersonGroupOrder(personId, groupIds) {
    const currentOrder = state.groupOrderByPerson[personId];
    const nextOrder = normalizeOrderList(currentOrder, groupIds);
    if (arraysEqual(currentOrder, nextOrder)) return false;
    state.groupOrderByPerson[personId] = nextOrder;
    return true;
  }

  function normalizePersonCategoryOrders(personId, groupIdSet) {
    let changed = false;
    if (!state.categoryOrderByPerson[personId] || typeof state.categoryOrderByPerson[personId] !== 'object') {
      state.categoryOrderByPerson[personId] = {};
      changed = true;
    }

    const categoryOrderMap = state.categoryOrderByPerson[personId];
    for (const groupId of Object.keys(categoryOrderMap)) {
      if (!groupIdSet.has(groupId)) {
        delete categoryOrderMap[groupId];
        changed = true;
      }
    }

    for (const group of state.groups) {
      const categoryIds = state.categories.filter((category) => category.groupId === group.id).map((category) => category.id);
      if (!categoryIds.length) {
        if (categoryOrderMap[group.id]) {
          delete categoryOrderMap[group.id];
          changed = true;
        }
        continue;
      }

      const currentCategoryOrder = categoryOrderMap[group.id];
      const nextCategoryOrder = normalizeOrderList(currentCategoryOrder, categoryIds);
      if (!arraysEqual(currentCategoryOrder, nextCategoryOrder)) {
        categoryOrderMap[group.id] = nextCategoryOrder;
        changed = true;
      }
    }
    return changed;
  }

  function normalizeState() {
    let changed = false;
    const peopleIds = state.people.map((p) => p.id);
    const peopleIdSet = new Set(peopleIds);
    const groupIds = state.groups.map((g) => g.id);
    const groupIdSet = new Set(groupIds);

    changed = ensureOrderMaps() || changed;
    changed = normalizeItems() || changed;
    changed = pruneMissingPeopleOrders(peopleIdSet) || changed;

    for (const person of state.people) {
      changed = normalizePersonGallery(person) || changed;
      changed = normalizePersonGroupOrder(person.id, groupIds) || changed;
      changed = normalizePersonCategoryOrders(person.id, groupIdSet) || changed;
    }

    return changed;
  }

  function ensureValidViewState() {
    const firstPersonId = state.people[0]?.id ?? null;
    const hasSelectedPerson = state.people.some((person) => person.id === viewState.selectedPersonId);
    const hasSettingsPerson = state.people.some((person) => person.id === viewState.settingsActivePersonId);
    const hasOverviewPerson = state.people.some((person) => person.id === viewState.overviewPersonId);
    if (!hasSelectedPerson) viewState.selectedPersonId = viewState.currentView === 'athlete' ? firstPersonId : null;
    if (!hasSettingsPerson) viewState.settingsActivePersonId = firstPersonId;
    if (!hasOverviewPerson) viewState.overviewPersonId = firstPersonId;
    if (viewState.currentView === 'athlete' && !viewState.selectedPersonId) viewState.currentView = 'home';
  }

  Object.assign(YW.state, {
    state,
    viewState,
    createEmptyState,
    normalizeOrderList,
    arraysEqual,
    validateImportedState,
    serializeState,
    restoreStateFromData,
    normalizeState,
    ensureValidViewState,
  });
})(window.YW);

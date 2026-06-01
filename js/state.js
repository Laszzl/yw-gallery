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

  function sanitizeStringArray(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
  }

  function sanitizeBooleanMap(value) {
    const result = {};
    if (!isPlainObject(value)) return result;
    for (const [key, entry] of Object.entries(value)) {
      if (typeof key === 'string' && typeof entry === 'boolean') result[key] = entry;
    }
    return result;
  }

  function sanitizeOrderMap(value) {
    const result = {};
    if (!isPlainObject(value)) return result;
    for (const [key, order] of Object.entries(value)) {
      if (typeof key === 'string' && Array.isArray(order)) {
        result[key] = order.filter((id) => typeof id === 'string');
      }
    }
    return result;
  }

  function sanitizeNestedOrderMap(value) {
    const result = {};
    if (!isPlainObject(value)) return result;
    for (const [personId, groupMap] of Object.entries(value)) {
      if (typeof personId !== 'string' || !isPlainObject(groupMap)) continue;
      result[personId] = sanitizeOrderMap(groupMap);
    }
    return result;
  }

  function sanitizePerson(person) {
    return {
      id: typeof person?.id === 'string' ? person.id : '',
      name: typeof person?.name === 'string' ? person.name : '',
      homePhotoUrl: typeof person?.homePhotoUrl === 'string' ? person.homePhotoUrl : null,
      detailPhotoUrl: typeof person?.detailPhotoUrl === 'string' ? person.detailPhotoUrl : null,
      galleryEnabled: person?.galleryEnabled === true,
      galleryPhotos: sanitizeStringArray(person?.galleryPhotos),
    };
  }

  function sanitizeGroup(group) {
    const result = {
      id: typeof group?.id === 'string' ? group.id : '',
      name: typeof group?.name === 'string' ? group.name : '',
    };
    if (Number.isFinite(group?.order)) result.order = group.order;
    return result;
  }

  function sanitizeCategory(category) {
    const result = {
      id: typeof category?.id === 'string' ? category.id : '',
      groupId: typeof category?.groupId === 'string' ? category.groupId : '',
      name: typeof category?.name === 'string' ? category.name : '',
    };
    if (Number.isFinite(category?.order)) result.order = category.order;
    return result;
  }

  function sanitizeItem(item) {
    return {
      id: typeof item?.id === 'string' ? item.id : '',
      personId: typeof item?.personId === 'string' ? item.personId : '',
      categoryId: typeof item?.categoryId === 'string' ? item.categoryId : '',
      label: typeof item?.label === 'string' ? item.label : '',
      quantity: Number.isInteger(item?.quantity) && item.quantity >= 1 ? item.quantity : 1,
      unit: typeof item?.unit === 'string' ? item.unit : '',
      date: isValidDateString(item?.date) ? item.date : DEFAULT_ITEM_DATE,
      isGift: item?.isGift === true,
      isOwnedNow: item?.isOwnedNow !== false,
      photoUrls: sanitizeStringArray(item?.photoUrls),
      order: Number.isFinite(item?.order) ? item.order : 0,
    };
  }

  function sanitizeStateData(data) {
    return {
      people: Array.isArray(data?.people) ? data.people.map(sanitizePerson) : [],
      groups: Array.isArray(data?.groups) ? data.groups.map(sanitizeGroup) : [],
      categories: Array.isArray(data?.categories) ? data.categories.map(sanitizeCategory) : [],
      items: Array.isArray(data?.items) ? data.items.map(sanitizeItem) : [],
      collapsedSubcategories: sanitizeBooleanMap(data?.collapsedSubcategories),
      collapsedSettingsGroups: sanitizeBooleanMap(data?.collapsedSettingsGroups),
      groupOrderByPerson: sanitizeOrderMap(data?.groupOrderByPerson),
      categoryOrderByPerson: sanitizeNestedOrderMap(data?.categoryOrderByPerson),
    };
  }

  function validateImportedState(data) {
    return YW.validators.validateImportedState(data);
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
    const sanitized = sanitizeStateData(data);
    state.people = sanitized.people;
    state.groups = sanitized.groups;
    state.categories = sanitized.categories;
    state.items = sanitized.items;
    state.collapsedSubcategories = sanitized.collapsedSubcategories;
    state.collapsedSettingsGroups = sanitized.collapsedSettingsGroups;
    state.groupOrderByPerson = sanitized.groupOrderByPerson;
    state.categoryOrderByPerson = sanitized.categoryOrderByPerson;
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
      if (item.date === '1998-03-25') {
        item.date = DEFAULT_ITEM_DATE;
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

  function normalizeReferences(peopleIdSet, groupIdSet) {
    let changed = false;
    const originalCategoryLength = state.categories.length;
    state.categories = state.categories.filter((category) => groupIdSet.has(category.groupId));
    if (state.categories.length !== originalCategoryLength) changed = true;

    const categoryIdSet = new Set(state.categories.map((category) => category.id));
    const originalItemLength = state.items.length;
    state.items = state.items.filter((item) => peopleIdSet.has(item.personId) && categoryIdSet.has(item.categoryId));
    if (state.items.length !== originalItemLength) changed = true;

    for (const groupId of Object.keys(state.collapsedSettingsGroups)) {
      if (!groupIdSet.has(groupId)) {
        delete state.collapsedSettingsGroups[groupId];
        changed = true;
      }
    }

    for (const key of Object.keys(state.collapsedSubcategories)) {
      const [personId, categoryId] = key.split(':');
      if (!peopleIdSet.has(personId) || !categoryIdSet.has(categoryId)) {
        delete state.collapsedSubcategories[key];
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
    changed = normalizeReferences(peopleIdSet, groupIdSet) || changed;
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
    sanitizeStateData,
    validateImportedState,
    serializeState,
    restoreStateFromData,
    normalizeState,
    ensureValidViewState,
  });
})(window.YW);

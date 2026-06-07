(function (YW) {
  const PERSISTED_KEYS = ["schemaVersion", "people", "groups", "categories", "items", "ui"];

  function createEmptyState() {
    return {
      schemaVersion: YW.config.SCHEMA_VERSION,
      people: [],
      groups: [],
      categories: [],
      items: [],
      ui: {
        collapsedCategoryKeys: {},
      },
    };
  }

  const state = createEmptyState();
  const viewState = {
    currentView: "home",
    selectedPersonId: null,
  };

  function normalizePerson(person) {
    return {
      id: String(person.id),
      name: String(person.name || "未命名"),
      homePhotoUrl: person.homePhotoUrl || null,
      detailPhotoUrl: person.detailPhotoUrl || null,
      galleryEnabled: person.galleryEnabled === true,
      galleryPhotos: Array.isArray(person.galleryPhotos) ? person.galleryPhotos.filter((url) => typeof url === "string") : [],
    };
  }

  function normalizeStateData(data) {
    const next = {
      schemaVersion: YW.config.SCHEMA_VERSION,
      people: Array.isArray(data.people) ? data.people.map(normalizePerson) : [],
      groups: Array.isArray(data.groups) ? data.groups.map((group) => ({ id: String(group.id), name: String(group.name || "未命名") })) : [],
      categories: Array.isArray(data.categories) ? data.categories.map((category) => ({ id: String(category.id), groupId: String(category.groupId), name: String(category.name || "未命名") })) : [],
      items: Array.isArray(data.items) ? data.items.map(normalizeItem) : [],
      ui: {
        collapsedCategoryKeys: data.ui && data.ui.collapsedCategoryKeys && typeof data.ui.collapsedCategoryKeys === "object" ? data.ui.collapsedCategoryKeys : {},
      },
    };
    const personIds = new Set(next.people.map((person) => person.id));
    const groupIds = new Set(next.groups.map((group) => group.id));
    const categoryIds = new Set(next.categories.filter((category) => groupIds.has(category.groupId)).map((category) => category.id));
    next.categories = next.categories.filter((category) => groupIds.has(category.groupId));
    next.items = next.items.filter((item) => personIds.has(item.personId) && categoryIds.has(item.categoryId));
    return next;
  }

  function normalizeItem(item) {
    const quantity = Number.parseInt(item.quantity, 10);
    return {
      id: String(item.id),
      personId: String(item.personId),
      categoryId: String(item.categoryId),
      label: String(item.label || "未命名 YW"),
      quantity: Number.isInteger(quantity) && quantity >= 1 ? quantity : 1,
      unit: String(item.unit || "件"),
      date: typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : new Date().toISOString().slice(0, 10),
      isGift: item.isGift === true,
      isOwnedNow: item.isOwnedNow !== false,
      photoUrls: Array.isArray(item.photoUrls) ? item.photoUrls.filter((url) => typeof url === "string") : [],
      order: Number.isFinite(item.order) ? item.order : 0,
    };
  }

  function restoreStateFromData(data) {
    const normalized = normalizeStateData(data || createEmptyState());
    PERSISTED_KEYS.forEach((key) => {
      state[key] = YW.utils.clone(normalized[key]);
    });
    if (!state.people.some((person) => person.id === viewState.selectedPersonId)) {
      viewState.selectedPersonId = state.people[0] ? state.people[0].id : null;
    }
    return state;
  }

  function serializeState() {
    const serialized = {};
    PERSISTED_KEYS.forEach((key) => {
      serialized[key] = YW.utils.clone(state[key]);
    });
    return serialized;
  }

  function migrateLegacyData(data) {
    return normalizeStateData({
      schemaVersion: YW.config.SCHEMA_VERSION,
      people: data.people,
      groups: data.groups,
      categories: data.categories,
      items: data.items,
      ui: {
        collapsedCategoryKeys: data.collapsedSubcategories || {},
      },
    });
  }

  YW.state = {
    state,
    viewState,
    createEmptyState,
    normalizeStateData,
    restoreStateFromData,
    serializeState,
    migrateLegacyData,
  };
})(window.YW);

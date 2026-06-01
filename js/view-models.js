(function (YW) {
  YW.viewModels = YW.viewModels || {};

  const state = YW.state.state;

  function getPersonDetailViewModel(personId) {
    const itemsByCategory = new Map();
    for (const item of state.items) {
      if (item.personId !== personId) continue;
      if (!itemsByCategory.has(item.categoryId)) itemsByCategory.set(item.categoryId, []);
      itemsByCategory.get(item.categoryId).push(item);
    }

    const groups = [];
    for (const group of YW.data.getOrderedGroupsForPerson(personId)) {
      const categories = [];
      for (const category of YW.data.getOrderedCategoriesForPersonGroup(personId, group.id)) {
        const items = (itemsByCategory.get(category.id) || []).slice().sort(YW.data.compareItemsForDisplay);
        if (!items.length) continue;
        categories.push({ category, items, ...YW.data.splitItemsByPhotos(items) });
      }
      if (categories.length) groups.push({ group, categories });
    }
    return { groups };
  }

  Object.assign(YW.viewModels, {
    getPersonDetailViewModel,
  });
})(window.YW);

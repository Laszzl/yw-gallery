(function (YW) {
  function getPersonDetailViewModel(personId) {
    const state = YW.state.state;
    const person = state.people.find((entry) => entry.id === personId) || null;
    if (!person) {
      return { person: null, groups: [] };
    }

    const categoriesByGroup = new Map();
    state.categories.forEach((category) => {
      if (!categoriesByGroup.has(category.groupId)) categoriesByGroup.set(category.groupId, []);
      categoriesByGroup.get(category.groupId).push({
        ...category,
        imageItems: state.items.filter((item) => item.personId === personId && item.categoryId === category.id && item.photoUrls.length > 0),
        textItems: state.items.filter((item) => item.personId === personId && item.categoryId === category.id && item.photoUrls.length === 0),
      });
    });

    return {
      person,
      groups: state.groups.map((group) => ({
        ...group,
        categories: categoriesByGroup.get(group.id) || [],
      })),
    };
  }

  YW.viewModels = {
    getPersonDetailViewModel,
  };
})(window.YW);

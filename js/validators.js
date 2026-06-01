(function (YW) {
  YW.validators = YW.validators || {};

  const { DEFAULT_ITEM_DATE } = YW.config;
  const { isPlainObject, isValidDateString } = YW.utils;

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
      data: YW.state.sanitizeStateData(data),
    };
  }

  Object.assign(YW.validators, {
    validateImportedState,
  });
})(window.YW);

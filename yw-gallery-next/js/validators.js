(function (YW) {
  function hasDuplicate(values) {
    return new Set(values).size !== values.length;
  }

  function validateImportedState(input) {
    if (!input || typeof input !== "object") {
      return { ok: false, message: "导入数据必须是对象。" };
    }
    const required = ["people", "groups", "categories", "items"];
    const missing = required.find((key) => !Array.isArray(input[key]));
    if (missing) {
      return { ok: false, message: "导入数据缺少关键数组：" + missing };
    }

    const peopleIds = input.people.map((person) => person && person.id);
    const groupIds = input.groups.map((group) => group && group.id);
    const categoryIds = input.categories.map((category) => category && category.id);
    if (hasDuplicate(peopleIds)) return { ok: false, message: "导入数据存在重复人物 ID。" };
    if (hasDuplicate(groupIds)) return { ok: false, message: "导入数据存在重复大品类 ID。" };
    if (hasDuplicate(categoryIds)) return { ok: false, message: "导入数据存在重复小品类 ID。" };

    const peopleSet = new Set(peopleIds);
    const groupSet = new Set(groupIds);
    const categorySet = new Set(categoryIds);

    for (const category of input.categories) {
      if (!groupSet.has(category.groupId)) {
        return { ok: false, message: "小品类引用了不存在的大品类。" };
      }
    }

    for (const item of input.items) {
      if (!peopleSet.has(item.personId)) {
        return { ok: false, message: "YW 引用了不存在的人物。" };
      }
      if (!categorySet.has(item.categoryId)) {
        return { ok: false, message: "YW 引用了不存在的小品类。" };
      }
      if (item.photoUrls !== undefined && (!Array.isArray(item.photoUrls) || item.photoUrls.some((url) => typeof url !== "string"))) {
        return { ok: false, message: "YW 图片格式错误。" };
      }
    }

    for (const person of input.people) {
      if (person.galleryPhotos !== undefined && (!Array.isArray(person.galleryPhotos) || person.galleryPhotos.some((url) => typeof url !== "string"))) {
        return { ok: false, message: "画廊图片格式错误。" };
      }
    }

    return { ok: true, message: "导入数据有效。", data: YW.state.migrateLegacyData(input) };
  }

  YW.validators = {
    validateImportedState,
  };
})(window.YW);

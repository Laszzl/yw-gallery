(function () {
  const result = document.querySelector("#result");
  const lines = [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assert(name, condition) {
    if (!condition) throw new Error(name);
    lines.push("PASS " + name);
  }

  function expectInvalid(name, data, messagePart) {
    const validation = YW.validators.validateImportedState(data);
    assert(name, validation.ok === false && validation.message.includes(messagePart));
  }

  const legacySample = {
    people: [
      { id: "p1", name: "测试人物", homePhotoUrl: null, detailPhotoUrl: null },
    ],
    groups: [
      { id: "g1", name: "鞋子" },
      { id: "g2", name: "衣物" },
    ],
    categories: [
      { id: "c1", groupId: "g1", name: "运动鞋" },
      { id: "c2", groupId: "g2", name: "上衣" },
    ],
    items: [
      { id: "i1", personId: "p1", categoryId: "c1", label: "白色鞋", quantity: 1, unit: "双", date: "2026-06-01", isGift: false, isOwnedNow: true, photoUrls: ["data:image/jpeg;base64,a"], order: 0 },
      { id: "i2", personId: "p1", categoryId: "c1", label: "黑色鞋", quantity: 2, unit: "双", date: "2026-06-02", isGift: true, isOwnedNow: false, photoUrls: [], order: 1 },
    ],
    collapsedSubcategories: {
      "p1:c2": true,
    },
  };

  try {
    const validation = YW.validators.validateImportedState(legacySample);
    assert("旧数据导入校验通过", validation.ok === true);
    assert("旧数据迁移到新版 schema", validation.data.schemaVersion === YW.config.SCHEMA_VERSION);
    assert("旧折叠数据迁移到 ui", validation.data.ui.collapsedCategoryKeys["p1:c2"] === true);

    YW.state.restoreStateFromData(validation.data);
    assert("normalize 补齐旧 person 画廊字段", Array.isArray(YW.state.state.people[0].galleryPhotos) && YW.state.state.people[0].galleryEnabled === false);

    const serialized = YW.state.serializeState();
    const serializedKeys = Object.keys(serialized).sort().join(",");
    assert("serializeState 只输出白名单字段", serializedKeys === "categories,groups,items,people,schemaVersion,ui");

    const vm = YW.viewModels.getPersonDetailViewModel("p1");
    assert("ViewModel 输出人物", vm.person && vm.person.name === "测试人物");
    assert("ViewModel 输出大品类", vm.groups.length === 2);
    assert("ViewModel 区分有图和无图 YW", vm.groups[0].categories[0].imageItems.length === 1 && vm.groups[0].categories[0].textItems.length === 1);

    const duplicatePerson = clone(legacySample);
    duplicatePerson.people.push({ id: "p1", name: "重复人物" });
    expectInvalid("导入校验拒绝重复人物 ID", duplicatePerson, "重复人物 ID");

    const missingGroup = clone(legacySample);
    missingGroup.categories[0].groupId = "missing";
    expectInvalid("导入校验拒绝缺失大品类引用", missingGroup, "不存在的大品类");

    const badPhoto = clone(legacySample);
    badPhoto.items[0].photoUrls = [12];
    expectInvalid("导入校验拒绝错误图片数组", badPhoto, "图片格式错误");

    const indexedSnapshot = YW.storage.createSnapshot("indexedDB", legacySample);
    const localSnapshot = YW.storage.createSnapshot("localStorage", legacySample);
    const emptySnapshot = YW.storage.createSnapshot("localStorage", YW.state.createEmptyState());

    const originalIsFileProtocol = YW.config.isFileProtocol;
    YW.config.isFileProtocol = false;
    const serverDecision = YW.storage.chooseLoadSource(indexedSnapshot, localSnapshot);
    assert("存储加载：服务器场景优先 IndexedDB", serverDecision.snapshot.source === "indexedDB");

    const migrateDecision = YW.storage.chooseLoadSource(null, localSnapshot);
    assert("存储加载：只有 localStorage 时标记迁移", migrateDecision.snapshot.source === "localStorage" && migrateDecision.shouldMigrateLocal === true);

    YW.config.isFileProtocol = true;
    const fileDecision = YW.storage.chooseLoadSource(indexedSnapshot, localSnapshot);
    assert("存储加载：file 场景优先 localStorage", fileDecision.snapshot.source === "localStorage");
    YW.config.isFileProtocol = originalIsFileProtocol;

    const emptyDecision = YW.storage.chooseLoadSource(null, emptySnapshot);
    assert("存储加载：空数据不误判为有效迁移", emptyDecision.snapshot.source === "localStorage");

    result.textContent = lines.join("\n") + "\n\n全部 smoke test 通过。";
  } catch (err) {
    result.textContent = lines.join("\n") + "\n\nFAIL " + err.message;
    throw err;
  }
})();

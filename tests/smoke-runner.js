(function () {
  const result = document.querySelector('#result');
  const lines = [];

  function assert(name, condition) {
    if (!condition) throw new Error(name);
    lines.push('PASS ' + name);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function expectInvalid(name, data, messagePart) {
    const validation = YW.state.validateImportedState(data);
    assert(name, validation.ok === false && validation.message.includes(messagePart));
  }

  function writeResult(text) {
    result.textContent = text;
  }

  const sample = {
    people: [
      { id: 'p1', name: '测试体育生', homePhotoUrl: null, detailPhotoUrl: null },
    ],
    groups: [
      { id: 'g1', name: '鞋子' },
    ],
    categories: [
      { id: 'c1', groupId: 'g1', name: '运动鞋' },
    ],
    items: [
      { id: 'i1', personId: 'p1', categoryId: 'c1', label: '白色鞋', quantity: 1, unit: '双', date: '2026-06-01', isGift: false, isOwnedNow: true, photoUrls: ['data:image/jpeg;base64,a'], order: 0 },
      { id: 'i2', personId: 'p1', categoryId: 'c1', label: '黑色鞋', quantity: 2, unit: '双', date: '2026-06-01', isGift: true, isOwnedNow: false, photoUrls: [], order: 1 },
    ],
  };

  try {
    const validation = YW.state.validateImportedState(sample);
    assert('导入校验通过', validation.ok === true);

    YW.state.restoreStateFromData(validation.data);
    assert('normalize 补齐大品类排序', YW.state.state.groupOrderByPerson.p1[0] === 'g1');
    assert('normalize 补齐小品类排序', YW.state.state.categoryOrderByPerson.p1.g1[0] === 'c1');

    const vm = YW.viewModels.getPersonDetailViewModel('p1');
    assert('详情页 ViewModel 生成分组', vm.groups.length === 1 && vm.groups[0].categories.length === 1);
    assert('ViewModel 区分有图/无图 YW', vm.groups[0].categories[0].imageItems.length === 1 && vm.groups[0].categories[0].textItems.length === 1);

    const reordered = YW.state.normalizeOrderList(['g2', 'g1', 'g1'], ['g1', 'g2', 'g3']);
    assert('排序列表去重并补齐', reordered.join(',') === 'g2,g1,g3');

    expectInvalid('导入校验拒绝空根结构', {}, '缺少关键字段');

    const duplicatePerson = clone(sample);
    duplicatePerson.people.push({ id: 'p1', name: '重复体育生' });
    expectInvalid('导入校验拒绝重复 ID', duplicatePerson, '重复体育生 ID');

    const missingPersonRef = clone(sample);
    missingPersonRef.items[0].personId = 'missing-person';
    expectInvalid('导入校验拒绝缺失体育生引用', missingPersonRef, '不存在的体育生');

    const missingCategoryRef = clone(sample);
    missingCategoryRef.items[0].categoryId = 'missing-category';
    expectInvalid('导入校验拒绝缺失小品类引用', missingCategoryRef, '不存在的小品类');

    const badItemPhotos = clone(sample);
    badItemPhotos.items[0].photoUrls = ['data:image/jpeg;base64,a', 12];
    expectInvalid('导入校验拒绝非字符串 YW 图片', badItemPhotos, '图片格式错误');

    const badGalleryPhotos = clone(sample);
    badGalleryPhotos.people[0].galleryPhotos = ['data:image/jpeg;base64,a', false];
    expectInvalid('导入校验拒绝非字符串画廊图片', badGalleryPhotos, '画廊图片格式错误');

    const legacy = clone(sample);
    legacy.people[0] = { id: 'p1', name: '旧数据体育生', homePhotoUrl: null, detailPhotoUrl: null };
    const legacyValidation = YW.state.validateImportedState(legacy);
    assert('旧数据体育生画廊字段可缺省', legacyValidation.ok === true);
    YW.state.restoreStateFromData(legacyValidation.data);
    assert('normalize 补齐 person gallery 默认字段', YW.state.state.people[0].galleryEnabled === false && Array.isArray(YW.state.state.people[0].galleryPhotos));

    const noisyState = clone(sample);
    noisyState.viewState = { currentView: 'settings' };
    noisyState.extraRoot = 'ignored';
    YW.state.restoreStateFromData(noisyState);
    const serializedKeys = Object.keys(YW.state.serializeState()).sort();
    const expectedKeys = [
      'categories',
      'categoryOrderByPerson',
      'collapsedSettingsGroups',
      'collapsedSubcategories',
      'groupOrderByPerson',
      'groups',
      'items',
      'people',
    ];
    assert('serializeState 只输出持久化字段', serializedKeys.join(',') === expectedKeys.join(','));

    const emptyState = {
      people: [],
      groups: [],
      categories: [],
      items: [],
    };
    const sampleSnapshot = YW.storage.createStoredStateSnapshot('indexedDB', sample);
    const localSampleSnapshot = YW.storage.createStoredStateSnapshot('localStorage', sample);
    const emptyLocalSnapshot = YW.storage.createStoredStateSnapshot('localStorage', emptyState);
    const emptyIndexedSnapshot = YW.storage.createStoredStateSnapshot('indexedDB', emptyState);
    const otherSample = clone(sample);
    otherSample.people[0].id = 'p2';
    otherSample.people[0].name = '另一位体育生';
    otherSample.items[0].personId = 'p2';
    otherSample.items[1].personId = 'p2';
    const otherLocalSnapshot = YW.storage.createStoredStateSnapshot('localStorage', otherSample);

    let loadDecision = YW.storage.chooseLoadSource(sampleSnapshot, null);
    assert('存储加载：只有 IndexedDB 时读取 IndexedDB', loadDecision.snapshot.source === 'indexedDB' && !loadDecision.shouldMigrateLocal);

    loadDecision = YW.storage.chooseLoadSource(null, localSampleSnapshot);
    assert('存储加载：只有 localStorage 时读取并迁移', loadDecision.snapshot.source === 'localStorage' && loadDecision.shouldMigrateLocal);

    loadDecision = YW.storage.chooseLoadSource(sampleSnapshot, emptyLocalSnapshot);
    assert('存储加载：IndexedDB 非空时忽略空 localStorage', loadDecision.snapshot.source === 'indexedDB' && loadDecision.conflict === 'emptyLocalStorage');

    loadDecision = YW.storage.chooseLoadSource(sampleSnapshot, otherLocalSnapshot);
    assert('存储加载：两边不同非空数据时优先 IndexedDB', loadDecision.snapshot.source === 'indexedDB' && loadDecision.conflict === 'nonEmptyLocalStorage');

    loadDecision = YW.storage.chooseLoadSource(emptyIndexedSnapshot, localSampleSnapshot);
    assert('存储加载：IndexedDB 为空时迁移非空 localStorage', loadDecision.snapshot.source === 'localStorage' && loadDecision.shouldMigrateLocal);

    loadDecision = YW.storage.chooseLoadSource(null, emptyLocalSnapshot);
    assert('存储加载：只有空 localStorage 时保持空状态', loadDecision.snapshot === null && !loadDecision.shouldMigrateLocal);

    writeResult(lines.join('\n') + '\n\n全部 smoke test 通过。');
  } catch (err) {
    writeResult(lines.join('\n') + '\n\nFAIL ' + err.message);
    throw err;
  }
})();

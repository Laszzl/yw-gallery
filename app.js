// ═══════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════
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

let state = createEmptyState();
let activeItemAction = null;
let photoManageState = { itemId: null, mode: null, replaceIndex: null };
const formLocks = { person: false, group: false, category: false, item: false };

async function withFormLock(form, lockName, fn) {
  if (formLocks[lockName]) return;
  formLocks[lockName] = true;
  setFormSubmitDisabled(form, true);
  try {
    await fn();
  } catch (err) {
    console.error(err);
    await showModal('保存失败，请重试');
  } finally {
    formLocks[lockName] = false;
    setFormSubmitDisabled(form, false);
  }
}

const viewState = {
  currentView: 'home',
  selectedPersonId: null,
  settingsActivePersonId: null,
  overviewPersonId: null,
};

// ═══════════════════════════════════════════════
// IndexedDB persistence（带 localStorage 回退 + 自动迁移）
// ═══════════════════════════════════════════════
const DB_NAME = 'yw_gallery_v1';
const DB_VERSION = 1;
const DB_STORE = 'app_data';
const DB_KEY = 'state';
const STORAGE_KEY = 'yw_data';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveState() {
  const data = {
    people: state.people,
    groups: state.groups,
    categories: state.categories,
    items: state.items,
    collapsedSubcategories: state.collapsedSubcategories,
    collapsedSettingsGroups: state.collapsedSettingsGroups,
    groupOrderByPerson: state.groupOrderByPerson,
    categoryOrderByPerson: state.categoryOrderByPerson,
  };
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(data, DB_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('IndexedDB 保存失败，回退到 localStorage:', e);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }
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
}

async function loadState() {
  // 优先从 IndexedDB 加载
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(DB_KEY);
    const data = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (data) {
      restoreStateFromData(data);
      return true;
    }
  } catch (e) {
    console.error('IndexedDB 加载失败:', e);
  }

  // 回退：从 localStorage 迁移旧数据
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      restoreStateFromData(data);
      // 迁移到 IndexedDB，完成后清理 localStorage
      saveState().then(() => {
        localStorage.removeItem(STORAGE_KEY);
      });
      return true;
    }
  } catch (e) {
    console.error('加载数据失败:', e);
  }
  return false;
}

function exportData() {
  const data = {
    people: state.people,
    groups: state.groups,
    categories: state.categories,
    items: state.items,
    collapsedSubcategories: state.collapsedSubcategories,
    collapsedSettingsGroups: state.collapsedSettingsGroups,
    groupOrderByPerson: state.groupOrderByPerson,
    categoryOrderByPerson: state.categoryOrderByPerson,
  };
  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `yw_backup_${dateStr}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function importData(file) {
  if (!file) return;
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    await showModal('请选择 .json 格式的备份文件');
    return;
  }

  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch (e) {
    await showModal('文件格式错误，无法解析 JSON 数据');
    return;
  }

  const requiredKeys = ['people', 'groups', 'categories', 'items'];
  const missingKeys = requiredKeys.filter((k) => !(k in data) || !Array.isArray(data[k]));
  if (missingKeys.length > 0) {
    await showModal('备份文件数据不完整，缺少关键字段：' + missingKeys.join('、'));
    return;
  }

  const confirmed = await showModal(
    `确认导入备份数据吗？将替换当前所有数据（${state.people.length} 位体育生、${state.items.length} 条 YW）。此操作不可撤销。`,
    { showCancel: true }
  );
  if (!confirmed) return;

  restoreStateFromData(data);
  await saveState();
  viewState.selectedPersonId = state.people[0]?.id ?? null;
  viewState.settingsActivePersonId = state.people[0]?.id ?? null;
  viewState.overviewPersonId = state.people[0]?.id ?? null;
  renderAll();
  await showModal(`数据导入成功！已恢复 ${state.people.length} 位体育生、${state.items.length} 条 YW`);
}

// ═══════════════════════════════════════════════
// DOM elements
// ═══════════════════════════════════════════════
const elements = {};

function cacheElements() {
  Object.assign(elements, {
    homeButton: document.querySelector('#homeButton'),
    addButton: document.querySelector('#addButton'),
    settingsButton: document.querySelector('#settingsButton'),
    emptySettingsButton: document.querySelector('#emptySettingsButton'),

    homeView: document.querySelector('#homeView'),
    athleteView: document.querySelector('#athleteView'),
    addView: document.querySelector('#addView'),
    settingsView: document.querySelector('#settingsView'),

    athleteSwitcher: document.querySelector('#athleteSwitcher'),
    homeEmptyState: document.querySelector('#homeEmptyState'),
    athleteSelectorGrid: document.querySelector('#athleteSelectorGrid'),
    athleteDetailHero: document.querySelector('#athleteDetailHero'),
    athleteGroupedContent: document.querySelector('#athleteGroupedContent'),

    settingsPersonSelect: document.querySelector('#settingsPersonSelect'),
    overviewPersonSelect: document.querySelector('#overviewPersonSelect'),
    settingsPersonHomePhotoInput: document.querySelector('#settingsPersonHomePhotoInput'),
    settingsPersonDetailPhotoInput: document.querySelector('#settingsPersonDetailPhotoInput'),
    settingsDeletePersonBtn: document.querySelector('#settingsDeletePersonBtn'),
    categoryOverviewList: document.querySelector('#categoryOverviewList'),

    personForm: document.querySelector('#personForm'),
    groupForm: document.querySelector('#groupForm'),
    categoryForm: document.querySelector('#categoryForm'),
    itemForm: document.querySelector('#itemForm'),

    categoryGroupSelect: document.querySelector('#categoryGroupSelect'),
    itemPersonSelect: document.querySelector('#itemPersonSelect'),
    itemGroupSelect: document.querySelector('#itemGroupSelect'),
    itemCategorySelect: document.querySelector('#itemCategorySelect'),
    itemOwnedNowInput: document.querySelector('#itemOwnedNowInput'),
    itemGiftInput: document.querySelector('#itemGiftInput'),
    itemPhotosInput: document.querySelector('#itemPhotosInput'),
    clearItemFilesButton: document.querySelector('#clearItemFilesButton'),
    itemPhotosSummary: document.querySelector('#itemPhotosSummary'),
    personHomePhotoInput: document.querySelector('#personHomePhotoInput'),
    personDetailPhotoInput: document.querySelector('#personDetailPhotoInput'),
    personHomePhotoSummary: document.querySelector('#personHomePhotoSummary'),
    personDetailPhotoSummary: document.querySelector('#personDetailPhotoSummary'),

    exportDataBtn: document.querySelector('#exportDataBtn'),
    importDataInput: document.querySelector('#importDataInput'),

    itemActionsModal: document.querySelector('#itemActionsModal'),
    itemActionManageBtn: document.querySelector('#itemActionManageBtn'),
    itemActionDeleteBtn: document.querySelector('#itemActionDeleteBtn'),
    cropModal: document.querySelector('#cropModal'),
    cropPreviewContainer: document.querySelector('#cropPreviewContainer'),
    cropImage: document.querySelector('#cropImage'),
    cropConfirmBtn: document.querySelector('#cropConfirmBtn'),
    cropSkipBtn: document.querySelector('#cropSkipBtn'),
  });

  // Templates
  elements.templates = {
    switcherChip: document.querySelector('#switcherChipTemplate'),
    selectorCard: document.querySelector('#selectorCardTemplate'),
    detailHero: document.querySelector('#detailHeroTemplate'),
    categorySection: document.querySelector('#categorySectionTemplate'),
    subcategory: document.querySelector('#subcategoryTemplate'),
    ywCard: document.querySelector('#ywCardTemplate'),
    textItem: document.querySelector('#textItemTemplate'),
    overviewGroup: document.querySelector('#overviewGroupTemplate'),
    overviewCategory: document.querySelector('#overviewCategoryTemplate'),
    photoThumb: document.querySelector('#photoThumbTemplate'),
  };
}

// ═══════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeName(value) {
  return String(value).trim().replace(/\s+/g, '').toLowerCase();
}

function showModal(msg, { confirmLabel, showCancel } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customModal');
    const msgEl = document.getElementById('modalMessage');
    const actions = modal.querySelector('.modal-actions');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.createElement('button');

    confirmBtn.onclick = null;
    modal.onclick = null;
    actions.innerHTML = '';
    msgEl.textContent = msg;

    const cleanup = (result) => {
      modal.hidden = true;
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      modal.onclick = null;
      actions.innerHTML = '';
      actions.append(confirmBtn);
      resolve(result);
    };

    confirmBtn.textContent = confirmLabel || '确定';
    confirmBtn.onclick = () => cleanup(true);

    if (showCancel) {
      cancelBtn.type = 'button';
      cancelBtn.className = 'mini-button';
      cancelBtn.textContent = '取消';
      cancelBtn.onclick = () => cleanup(false);
      actions.append(cancelBtn, confirmBtn);
    } else {
      actions.append(confirmBtn);
    }

    modal.onclick = (e) => {
      if (e.target === modal) cleanup(showCancel ? false : true);
    };
    modal.hidden = false;
  });
}

function setFormSubmitDisabled(form, disabled) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = disabled;
}

function describeFiles(fileList, multiple) {
  const files = [...(fileList ?? [])].filter((file) => file.size > 0);
  if (!files.length) return '未选择文件';
  if (multiple) return `已选择 ${files.length} 张：${files.map((file) => file.name).join('、')}`;
  return `已选择：${files[0].name}`;
}

function setInputFiles(input, files) {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
}

function syncFileSummaries() {
  elements.itemPhotosSummary.textContent = describeFiles(elements.itemPhotosInput.files, true);
  elements.personHomePhotoSummary.textContent = describeFiles(elements.personHomePhotoInput.files, false);
  elements.personDetailPhotoSummary.textContent = describeFiles(elements.personDetailPhotoInput.files, false);
}

function formatItemLabel(item) {
  return item.label + (item.isGift ? ' · 赠送' : '') + (item.isOwnedNow ? ' · 现存' : ' · 非现存');
}

function hasGroupContent(personId, groupId) {
  return state.categories.some(
    (c) => c.groupId === groupId && state.items.some((item) => item.personId === personId && item.categoryId === c.id)
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
    state.categories.filter((c) => c.groupId === groupId).map((c) => c.id);
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
    return state.categories.filter((c) => c.groupId === groupId);
  }
  const orderIds = getCategoryOrderIdsForPersonGroup(personId, groupId);
  const categoryMap = new Map(
    state.categories.filter((c) => c.groupId === groupId).map((c) => [c.id, c])
  );
  return orderIds.map((id) => categoryMap.get(id)).filter(Boolean);
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


// ═══════════════════════════════════════════════
// CRUD: People
// ═══════════════════════════════════════════════
async function createPerson(name, homePhotoFile, detailPhotoFile) {
  let homePhotoUrl = null;
  let detailPhotoUrl = null;

  if (homePhotoFile instanceof File && homePhotoFile.size > 0) {
    homePhotoUrl = await readFileAsDataURL(homePhotoFile);
  }
  if (detailPhotoFile instanceof File && detailPhotoFile.size > 0) {
    detailPhotoUrl = await readFileAsDataURL(detailPhotoFile);
  }

  const person = { id: crypto.randomUUID(), name, homePhotoUrl, detailPhotoUrl };
  state.people.push(person);
  state.groupOrderByPerson[person.id] = state.groups.map((g) => g.id);
  await saveState();
  return person;
}

async function updatePersonPhoto(personId, field, file) {
  const photoUrlValue = await readFileAsDataURL(file);
  const person = state.people.find((p) => p.id === personId);
  if (person) person[field] = photoUrlValue;
  await saveState();
}

async function deletePerson(personId) {
  state.people = state.people.filter((p) => p.id !== personId);
  state.items = state.items.filter((item) => item.personId !== personId);
  delete state.groupOrderByPerson[personId];
  delete state.categoryOrderByPerson[personId];
  for (const key of Object.keys(state.collapsedSubcategories)) {
    if (key.startsWith(personId + ':')) delete state.collapsedSubcategories[key];
  }
  await saveState();
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
  await saveState();
}

async function deleteGroup(groupId) {
  const categoryIds = state.categories.filter((c) => c.groupId === groupId).map((c) => c.id);
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
  await saveState();
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
  await saveState();
}

async function deleteCategory(categoryId) {
  const category = state.categories.find((c) => c.id === categoryId);
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
  await saveState();
}

// ═══════════════════════════════════════════════
// CRUD: Items
// ═══════════════════════════════════════════════
async function createItem(itemData) {
  const item = {
    id: crypto.randomUUID(),
    personId: itemData.personId,
    categoryId: itemData.categoryId,
    label: itemData.label,
    quantity: itemData.quantity,
    unit: itemData.unit,
    notes: itemData.notes,
    isGift: itemData.isGift,
    isOwnedNow: itemData.isOwnedNow,
    photoUrls: itemData.photoUrls || [],
    order: state.items.filter((i) => i.categoryId === itemData.categoryId && i.personId === itemData.personId).length,
  };
  state.items.push(item);
  await saveState();
  return item;
}

async function deleteItem(itemId) {
  state.items = state.items.filter((item) => item.id !== itemId);
  await saveState();
}

async function updateItemPhotos(itemId, photoUrls) {
  const item = state.items.find((i) => i.id === itemId);
  if (item) item.photoUrls = photoUrls;
  await saveState();
}

// ═══════════════════════════════════════════════
// Collapsed state
// ═══════════════════════════════════════════════
function toggleCollapsedState(id, storageObj) {
  storageObj[id] = !storageObj[id];
  saveState(); // fire-and-forget（无需等待）
}

// ═══════════════════════════════════════════════
// Data helpers (order initialization)
// ═══════════════════════════════════════════════
function ensureCategoryOrderForPersonGroup(personId, groupId) {
  if (!personId || !groupId) return;
  if (!state.categoryOrderByPerson[personId]) state.categoryOrderByPerson[personId] = {};
  let order = state.categoryOrderByPerson[personId][groupId];
  if (!Array.isArray(order)) {
    order = state.categories.filter((c) => c.groupId === groupId).map((c) => c.id);
    state.categoryOrderByPerson[personId][groupId] = order;
    saveState(); // fire-and-forget
  }
}

async function syncMissingGroupOrders() {
  let changed = false;
  for (const person of state.people) {
    if (!Array.isArray(state.groupOrderByPerson[person.id])) {
      state.groupOrderByPerson[person.id] = state.groups.map((g) => g.id);
      changed = true;
    }
    for (const group of state.groups) {
      if (!state.groupOrderByPerson[person.id].includes(group.id)) {
        state.groupOrderByPerson[person.id].push(group.id);
        changed = true;
      }
    }
    const before = state.groupOrderByPerson[person.id].length;
    state.groupOrderByPerson[person.id] = state.groupOrderByPerson[person.id].filter((id) =>
      state.groups.some((g) => g.id === id)
    );
    if (state.groupOrderByPerson[person.id].length !== before) changed = true;
  }
  if (changed) await saveState();
}

// ═══════════════════════════════════════════════
// Drag & reorder
// ═══════════════════════════════════════════════
function reorderGroupsByDrag(personId, draggedGroupId, targetGroupId) {
  const order = [...getGroupOrderIdsForPerson(personId)];
  const draggedIndex = order.indexOf(draggedGroupId);
  const targetIndex = order.indexOf(targetGroupId);
  if (draggedIndex < 0 || targetIndex < 0 || draggedGroupId === targetGroupId) return;
  const [moved] = order.splice(draggedIndex, 1);
  order.splice(targetIndex, 0, moved);
  state.groupOrderByPerson[personId] = order;
  saveState(); // fire-and-forget（拖拽期间保存不阻塞 UI）
  renderAll();
}

function reorderCategoriesByDrag(personId, groupId, draggedCategoryId, targetCategoryId) {
  console.log('DEBUG reorderCategoriesByDrag', { personId, groupId, draggedCategoryId, targetCategoryId });
  const order = [...getCategoryOrderIdsForPersonGroup(personId, groupId)];
  const draggedIndex = order.indexOf(draggedCategoryId);
  const targetIndex = order.indexOf(targetCategoryId);
  if (draggedIndex < 0 || targetIndex < 0 || draggedCategoryId === targetCategoryId) return;
  const [moved] = order.splice(draggedIndex, 1);
  order.splice(targetIndex, 0, moved);
  if (!state.categoryOrderByPerson[personId]) state.categoryOrderByPerson[personId] = {};
  state.categoryOrderByPerson[personId][groupId] = order;
  saveState(); // fire-and-forget
  renderAll();
}

function reorderItemsByDrag(draggedItemId, targetItemId) {
  const draggedItem = state.items.find((i) => i.id === draggedItemId);
  const targetItem = state.items.find((i) => i.id === targetItemId);
  if (!draggedItem || !targetItem) return;
  if (draggedItem.personId !== targetItem.personId || draggedItem.categoryId !== targetItem.categoryId) return;
  if ((draggedItem.photoUrls?.length > 0) !== (targetItem.photoUrls?.length > 0)) return;

  const sameTypeItems = state.items
    .filter(
      (i) =>
        i.personId === draggedItem.personId &&
        i.categoryId === draggedItem.categoryId &&
        (i.photoUrls?.length > 0) === (draggedItem.photoUrls?.length > 0)
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const draggedIndex = sameTypeItems.findIndex((i) => i.id === draggedItemId);
  const targetIndex = sameTypeItems.findIndex((i) => i.id === targetItemId);
  if (draggedIndex < 0 || targetIndex < 0) return;

  const [moved] = sameTypeItems.splice(draggedIndex, 1);
  sameTypeItems.splice(targetIndex, 0, moved);
  sameTypeItems.forEach((entry, index) => { entry.order = index; });

  saveState(); // fire-and-forget
  reorderRailCardsByItemList(sameTypeItems);
}

function reorderRailCardsByItemList(itemsInOrder) {
  if (!itemsInOrder.length) return;
  const firstCard = document.querySelector('.rail-card[data-item-id="' + itemsInOrder[0].id + '"]');
  if (!firstCard || !firstCard.parentElement) return;
  const rail = firstCard.parentElement;
  const itemOrderMap = new Map(itemsInOrder.map(function (item, i) { return [item.id, i]; }));
  const cards = Array.from(rail.querySelectorAll('.rail-card'));
  cards.sort(function (a, b) {
    const aOrder = itemOrderMap.get(a.dataset.itemId);
    const bOrder = itemOrderMap.get(b.dataset.itemId);
    return (aOrder != null ? aOrder : 999) - (bOrder != null ? bOrder : 999);
  });
  for (let i = 0; i < cards.length; i++) {
    rail.appendChild(cards[i]);
  }
}

function createDragHandler({ dragOverClass, onDrop }) {
  return function attachDrag(element, id) {
    element.draggable = true;
    console.log('DEBUG attachDrag', { dragOverClass, element, id });
    element.addEventListener('dragstart', (event) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
      element.classList.add('dragging');
      console.log('DEBUG dragstart', { dragOverClass, id });
    });
    element.addEventListener('dragend', () => {
      element.classList.remove('dragging');
      document.querySelectorAll('.' + dragOverClass + '.drag-over').forEach((n) => n.classList.remove('drag-over'));
    });
    element.addEventListener('dragenter', (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (element.classList.contains('dragging')) return;
      element.classList.add('drag-over');
    });
    element.addEventListener('dragover', (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (element.classList.contains('dragging')) return;
      event.dataTransfer.dropEffect = 'move';
      element.classList.add('drag-over');
    });
    element.addEventListener('dragleave', () => { element.classList.remove('drag-over'); });
    element.addEventListener('drop', (event) => {
      event.stopPropagation();
      event.preventDefault();
      element.classList.remove('drag-over');
      const draggedId = event.dataTransfer.getData('text/plain');
      console.log('DEBUG drop', { dragOverClass, draggedId, targetId: id });
      if (!draggedId || draggedId === id) return;
      onDrop(draggedId, id);
    });
  };
}

const attachItemDrag = createDragHandler({
  dragOverClass: 'rail-card',
  onDrop: (draggedId, targetId) => reorderItemsByDrag(draggedId, targetId),
});

// ═══════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════
function renderAll() {
  closeItemActionsModal();
  closePhotoManageModal();
  if (!elements.cropModal.hidden) closeCropModal(createCropResult('cancel'));
  syncFormOptions();
  renderSwitcher();
  renderCurrentView();
}

function renderCurrentView() {
  elements.homeView.hidden = viewState.currentView !== 'home';
  elements.athleteView.hidden = viewState.currentView !== 'athlete';
  elements.addView.hidden = viewState.currentView !== 'add';
  elements.settingsView.hidden = viewState.currentView !== 'settings';

  if (viewState.currentView === 'home') renderHomeView();
  if (viewState.currentView === 'athlete') renderAthleteView();
  if (viewState.currentView === 'settings') renderCategoryOverview();
}

function showHomeView() { viewState.currentView = 'home'; renderAll(); }
function showAddView() { viewState.currentView = 'add'; renderAll(); }
function showAthleteView(personId) { viewState.currentView = 'athlete'; viewState.selectedPersonId = personId; renderAll(); }
function showSettingsView() { viewState.currentView = 'settings'; renderAll(); }

function renderSwitcher() {
  elements.athleteSwitcher.innerHTML = '';
  const overflow = state.people.length > 3;
  elements.athleteSwitcher.classList.toggle('scrollable', overflow);
  for (const person of state.people) {
    const fragment = elements.templates.switcherChip.content.cloneNode(true);
    const button = fragment.querySelector('.switcher-chip');
    button.textContent = person.name;
    if (person.id === viewState.selectedPersonId && viewState.currentView === 'athlete') {
      button.classList.add('active');
    }
    button.addEventListener('click', () => showAthleteView(person.id));
    elements.athleteSwitcher.append(fragment);
  }
  if (overflow) {
    const activeChip = elements.athleteSwitcher.querySelector('.switcher-chip.active');
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }
}

function syncFormOptions() {
  const peopleOptions = state.people.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const currentPersonValue = elements.itemPersonSelect.value;
  elements.itemPersonSelect.innerHTML = peopleOptions || '<option value="">请先添加体育生</option>';
  elements.itemPersonSelect.disabled = state.people.length === 0;
  if (state.people.length) {
    elements.itemPersonSelect.value = state.people.some((p) => p.id === currentPersonValue) ? currentPersonValue : state.people[0].id;
  }

  syncGroupOptions();

  elements.settingsPersonSelect.innerHTML = peopleOptions || '<option value="">请先添加体育生</option>';
  elements.settingsPersonSelect.disabled = state.people.length === 0;
  if (state.people.length) {
    if (!viewState.settingsActivePersonId || !state.people.find((p) => p.id === viewState.settingsActivePersonId)) {
      viewState.settingsActivePersonId = state.people[0].id;
    }
    elements.settingsPersonSelect.value = viewState.settingsActivePersonId;
  } else {
    viewState.settingsActivePersonId = null;
  }
  elements.settingsDeletePersonBtn.hidden = state.people.length === 0;

  elements.overviewPersonSelect.innerHTML = peopleOptions || '<option value="">请先添加体育生</option>';
  elements.overviewPersonSelect.disabled = state.people.length === 0;
  if (state.people.length) {
    if (!viewState.overviewPersonId || !state.people.find((p) => p.id === viewState.overviewPersonId)) {
      viewState.overviewPersonId = state.people[0].id;
    }
    elements.overviewPersonSelect.value = viewState.overviewPersonId;
  } else {
    viewState.overviewPersonId = null;
  }
}

function syncGroupOptions() {
  const activePersonForGroups = elements.itemPersonSelect.value || state.people[0]?.id || null;
  const nextGroups = getOrderedGroupsForPerson(activePersonForGroups);
  const nextGroupOptions = nextGroups.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
  const currentCategoryGroupValue = elements.categoryGroupSelect.value;
  const currentItemGroupValue = elements.itemGroupSelect.value;

  elements.categoryGroupSelect.innerHTML = nextGroupOptions || '<option value="">请先添加大品类</option>';
  elements.itemGroupSelect.innerHTML = nextGroupOptions || '<option value="">请先添加大品类</option>';
  elements.categoryGroupSelect.disabled = state.groups.length === 0;
  elements.itemGroupSelect.disabled = state.groups.length === 0;

  if (nextGroups.length) {
    const fallback = nextGroups[0].id;
    elements.categoryGroupSelect.value = nextGroups.some((g) => g.id === currentCategoryGroupValue) ? currentCategoryGroupValue : fallback;
    elements.itemGroupSelect.value = nextGroups.some((g) => g.id === currentItemGroupValue) ? currentItemGroupValue : fallback;
  }
  syncCategoryOptions(elements.itemGroupSelect.value);
}

function syncCategoryOptions(groupId) {
  const personId = elements.itemPersonSelect.value || state.people[0]?.id || null;
  const categories = getOrderedCategoriesForPersonGroup(personId, groupId);
  const currentValue = elements.itemCategorySelect.value;
  elements.itemCategorySelect.innerHTML = categories.length
    ? categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
    : '<option value="">当前大品类暂无小品类</option>';
  elements.itemCategorySelect.disabled = categories.length === 0;
  if (categories.length) {
    elements.itemCategorySelect.value = categories.some((c) => c.id === currentValue) ? currentValue : categories[0].id;
  }
}

function renderHomeView() {
  elements.homeEmptyState.hidden = state.people.length > 0;
  elements.athleteSelectorGrid.hidden = state.people.length === 0;
  elements.athleteSelectorGrid.innerHTML = '';

  const count = state.people.length;
  let fontSize;
  if (count === 1) fontSize = '4rem';
  else if (count === 2) fontSize = '2.4rem';
  else fontSize = '1.6rem';

  for (const person of state.people) {
    const fragment = elements.templates.selectorCard.content.cloneNode(true);
    const card = fragment.querySelector('.selector-card');
    const image = fragment.querySelector('.selector-image');
    const name = fragment.querySelector('.selector-name');
    name.textContent = person.name;
    name.style.fontSize = fontSize;
    card.addEventListener('click', () => showAthleteView(person.id));
    if (person.homePhotoUrl) {
      image.src = person.homePhotoUrl;
    }
    elements.athleteSelectorGrid.append(fragment);
  }
}

function renderAthleteView() {
  const person = state.people.find((p) => p.id === viewState.selectedPersonId);
  elements.athleteDetailHero.innerHTML = '';
  elements.athleteGroupedContent.innerHTML = '';
  if (!person) { viewState.currentView = 'home'; return; }

  const heroFragment = elements.templates.detailHero.content.cloneNode(true);
  const heroImage = heroFragment.querySelector('.detail-hero-image');
  const heroName = heroFragment.querySelector('.detail-hero-name');
  heroName.textContent = person.name;
  if (person.detailPhotoUrl) heroImage.src = person.detailPhotoUrl;
  elements.athleteDetailHero.append(heroFragment);

  const groupsWithContent = getOrderedGroupsForPerson(person.id).filter((g) => hasGroupContent(person.id, g.id));
  for (const group of groupsWithContent) {
    elements.athleteGroupedContent.append(renderGroupSection(person.id, group));
  }
}

function renderCategoryOverview() {
  const personId = viewState.overviewPersonId;
  elements.categoryOverviewList.innerHTML = '';
  if (!personId) {
    const empty = document.createElement('p');
    empty.className = 'overview-empty';
    empty.textContent = '请先添加体育生';
    elements.categoryOverviewList.append(empty);
    return;
  }

  for (const group of getOrderedGroupsForPerson(personId)) {
    const fragment = elements.templates.overviewGroup.content.cloneNode(true);
    const card = fragment.querySelector('.overview-group-card');
    const title = fragment.querySelector('.overview-group-title');
    const meta = fragment.querySelector('.overview-group-meta');
    const content = fragment.querySelector('.overview-group-content');
    const groupToggle = fragment.querySelector('[data-group-toggle]');
    const remove = fragment.querySelector('[data-group-delete]');
    card.draggable = true;
    card.dataset.groupId = group.id;
    const categories = getOrderedCategoriesForPersonGroup(personId, group.id);
    const isCollapsed = Boolean(state.collapsedSettingsGroups[group.id]);

    title.textContent = group.name;
    meta.textContent = categories.length ? `${categories.length} 个小品类` : '暂无小品类';
    if (isCollapsed) card.classList.add('collapsed');
    const attachGroupDrag = createDragHandler({
      dragOverClass: 'overview-group-card',
      onDrop: (draggedId, targetId) => reorderGroupsByDrag(personId, draggedId, targetId),
    });
    attachGroupDrag(card, group.id);

    groupToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleCollapsedState(group.id, state.collapsedSettingsGroups);
      card.classList.toggle('collapsed');
    });
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      handleDeleteGroup(group.id);
    });

    if (!categories.length) {
      const empty = document.createElement('p');
      empty.className = 'overview-empty';
      empty.textContent = '暂无小品类';
      content.append(empty);
    }
    for (const category of categories) {
      const catFragment = elements.templates.overviewCategory.content.cloneNode(true);
      const row = catFragment.querySelector('.overview-category-row');
      const name = catFragment.querySelector('.manager-row-title');
      const catDelete = catFragment.querySelector('[data-category-delete]');
      row.draggable = true;
      row.dataset.categoryId = category.id;
      name.textContent = category.name;
      const attachCategoryDrag = createDragHandler({
        dragOverClass: 'overview-category-row',
        onDrop: (draggedId, targetId) => reorderCategoriesByDrag(personId, group.id, draggedId, targetId),
      });
      attachCategoryDrag(row, category.id);
      catDelete.addEventListener('click', () => handleDeleteCategory(category.id));
      content.appendChild(row);
    }
    elements.categoryOverviewList.append(fragment);
  }
}

async function confirmAndDelete(confirmMsg, deleteFn, successMsg) {
  const confirmed = await showModal(confirmMsg, { showCancel: true });
  if (!confirmed) return;
  await deleteFn();
  renderAll();
  await showModal(successMsg);
}

async function handleDeleteGroup(groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  await confirmAndDelete(`确认删除大品类"${group.name}"及其所有小品类和 YW 吗？`, () => deleteGroup(groupId), '大品类已删除');
}

async function handleDeleteCategory(categoryId) {
  const category = state.categories.find((c) => c.id === categoryId);
  if (!category) return;
  await confirmAndDelete(`确认删除小品类"${category.name}"及其关联的所有 YW 吗？`, () => deleteCategory(categoryId), '小品类已删除');
}

function renderGroupSection(personId, group) {
  const categoriesInGroup = getOrderedCategoriesForPersonGroup(personId, group.id).filter((c) =>
    state.items.some((item) => item.personId === personId && item.categoryId === c.id)
  );
  const fragment = elements.templates.categorySection.content.cloneNode(true);
  const title = fragment.querySelector('.category-section-title');
  const subSections = fragment.querySelector('.subcategory-sections');
  title.textContent = group.name;

  for (const category of categoriesInGroup) {
    const categoryItems = state.items
      .filter((item) => item.personId === personId && item.categoryId === category.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const subFragment = elements.templates.subcategory.content.cloneNode(true);
    const block = subFragment.querySelector('.subcategory-block');
    const titleNode = subFragment.querySelector('.subcategory-title');
    const countsNode = subFragment.querySelector('.subcategory-counts');
    const imageRail = subFragment.querySelector('.image-items-rail');
    const textRail = subFragment.querySelector('.text-items-rail');
    const toggle = subFragment.querySelector('[data-subcategory-toggle]');

    const totalQty = categoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const ownedQty = categoryItems.filter((item) => item.isOwnedNow).reduce((sum, item) => sum + item.quantity, 0);
    const collapseKey = `${personId}:${category.id}`;
    if (state.collapsedSubcategories[collapseKey]) block.classList.add('collapsed');
    titleNode.textContent = category.name;
    countsNode.textContent = `总数量 ${totalQty} · 现存 ${ownedQty}`;
    toggle.addEventListener('click', () => {
      toggleCollapsedState(collapseKey, state.collapsedSubcategories);
      block.classList.toggle('collapsed');
    });

    const imageItems = categoryItems.filter((item) => (item.photoUrls || []).length > 0);
    const textItems = categoryItems.filter((item) => (item.photoUrls || []).length === 0);

    for (const item of imageItems) appendImageItemCard(imageRail, item);
    for (const item of textItems) appendTextItemCard(textRail, item);

    if (!imageRail.childElementCount) imageRail.parentElement.hidden = true;
    if (!textRail.childElementCount) textRail.parentElement.hidden = true;
    subSections.append(subFragment);
  }
  return fragment;
}

function appendImageItemCard(container, item) {
  const fragment = elements.templates.ywCard.content.cloneNode(true);
  const card = fragment.querySelector('.rail-card');
  const image = fragment.querySelector('.yw-card-image');
  const imageWrap = fragment.querySelector('.yw-card-image-wrap');
  const title = fragment.querySelector('.yw-title');
  const notes = fragment.querySelector('.yw-notes');
  const menuToggle = fragment.querySelector('[data-item-menu-toggle]');

  title.textContent = formatItemLabel(item);
  notes.textContent = item.notes || `${item.quantity}${item.unit}`;
  menuToggle.addEventListener('click', () => openItemActionsModal(item.id, 'image'));
  card.dataset.itemId = item.id;
  attachItemDrag(card, item.id);

  const urls = item.photoUrls || [];
  if (urls.length > 0) {
    image.src = urls[0];
    image.dataset.photoIndex = '0';
    if (urls.length > 1) {
      imageWrap.classList.add('has-multi-photos');
      const counter = document.createElement('span');
      counter.className = 'photo-counter';
      counter.textContent = `1/${urls.length}`;
      imageWrap.append(counter);
      imageWrap.addEventListener('click', () => {
        let idx = parseInt(image.dataset.photoIndex, 10);
        idx = (idx + 1) % urls.length;
        image.dataset.photoIndex = String(idx);
        image.src = urls[idx];
        counter.textContent = `${idx + 1}/${urls.length}`;
      });
    }
  }
  container.append(fragment);
}

function appendTextItemCard(container, item) {
  const fragment = elements.templates.textItem.content.cloneNode(true);
  const card = fragment.querySelector('.rail-card');
  const title = fragment.querySelector('.text-item-title');
  const notes = fragment.querySelector('.text-item-notes');
  const menuToggle = fragment.querySelector('[data-item-menu-toggle]');

  title.textContent = formatItemLabel(item);
  notes.textContent = item.notes || `${item.quantity}${item.unit}`;
  menuToggle.addEventListener('click', () => openItemActionsModal(item.id, 'text'));
  card.dataset.itemId = item.id;
  attachItemDrag(card, item.id);
  container.append(fragment);
}

// ═══════════════════════════════════════════════
// Item actions modal
// ═══════════════════════════════════════════════
function openItemActionsModal(itemId, type) {
  activeItemAction = { itemId, type };
  elements.itemActionsModal.hidden = false;
  elements.itemActionManageBtn.onclick = () => {
    const current = activeItemAction;
    closeItemActionsModal();
    if (current) openPhotoManageModal(current.itemId);
  };
  elements.itemActionDeleteBtn.onclick = () => {
    const current = activeItemAction;
    closeItemActionsModal();
    if (current) handleDeleteItem(current.itemId);
  };
}

function closeItemActionsModal() {
  elements.itemActionsModal.hidden = true;
  elements.itemActionManageBtn.onclick = null;
  elements.itemActionDeleteBtn.onclick = null;
  activeItemAction = null;
}

function closePhotoManageModal() {
  const modal = document.getElementById('photoManageModal');
  const fileInput = document.getElementById('modalPhotoInput');
  const addBtn = document.getElementById('modalPhotoAddBtn');
  const deleteBtn = document.getElementById('modalPhotoDeleteBtn');
  if (!modal.hidden) {
    modal.hidden = true;
    modal.onclick = null;
    fileInput.onchange = null;
    addBtn.onclick = null;
    deleteBtn.onclick = null;
    photoManageState = { itemId: null, mode: null, replaceIndex: null };
  }
}

async function handleDeleteItem(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  await confirmAndDelete(`确认删除 YW"${item.label}"吗？`, () => deleteItem(itemId), 'YW 已删除');
}

function openPhotoManageModal(itemId) {
  const modal = document.getElementById('photoManageModal');
  const thumbGrid = document.getElementById('photoThumbGrid');
  const addBtn = document.getElementById('modalPhotoAddBtn');
  const deleteBtn = document.getElementById('modalPhotoDeleteBtn');
  const fileInput = document.getElementById('modalPhotoInput');
  fileInput.value = '';
  modal.hidden = false;
  photoManageState = { itemId, mode: null, replaceIndex: null };

  const renderThumbGrid = () => {
    thumbGrid.innerHTML = '';
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    deleteBtn.hidden = !item.photoUrls || item.photoUrls.length === 0;
    for (let i = 0; i < (item.photoUrls || []).length; i++) {
      const frag = elements.templates.photoThumb.content.cloneNode(true);
      const thumbImg = frag.querySelector('.photo-thumb-img');
      const replaceBtn = frag.querySelector('.photo-thumb-replace');
      thumbImg.src = item.photoUrls[i];
      replaceBtn.addEventListener('click', () => {
        photoManageState.mode = 'replace';
        photoManageState.replaceIndex = i;
        fileInput.multiple = false;
        fileInput.value = '';
        fileInput.click();
      });
      thumbGrid.append(frag);
    }
  };

  const cleanup = () => {
    modal.hidden = true;
    modal.onclick = null;
    fileInput.onchange = null;
    addBtn.onclick = null;
    deleteBtn.onclick = null;
    photoManageState = { itemId: null, mode: null, replaceIndex: null };
  };

  modal.onclick = (e) => { if (e.target === modal) cleanup(); };

  const handleFiles = async (files) => {
    modal.hidden = true;
    if (!files.length) { modal.hidden = false; return; }
    const item = state.items.find((i) => i.id === itemId);
    if (!item) { modal.hidden = false; return; }
    const photoUrls = [];
    for (const file of files) {
      const cropResult = await showCropModal(file, 1);
      const finalFile = resolveCroppedFile(file, cropResult);
      if (!finalFile) {
        if (photoUrls.length) {
          if (photoManageState.mode === 'replace') {
            const current = [...item.photoUrls];
            current[photoManageState.replaceIndex] = photoUrls[0];
            await updateItemPhotos(itemId, current);
          } else {
            await updateItemPhotos(itemId, [...item.photoUrls, ...photoUrls]);
          }
          renderAll();
          await showModal(`已更新 ${photoUrls.length} 张，剩余已取消`);
        } else {
          await showModal('已取消本次图片更新');
        }
        renderThumbGrid();
        modal.hidden = false;
        return;
      }
      photoUrls.push(await readFileAsDataURL(finalFile));
    }

    if (photoManageState.mode === 'replace') {
      const current = [...item.photoUrls];
      current[photoManageState.replaceIndex] = photoUrls[0];
      await updateItemPhotos(itemId, current);
    } else {
      await updateItemPhotos(itemId, [...item.photoUrls, ...photoUrls]);
    }
    renderAll();
    await showModal(photoManageState.mode === 'replace' ? '图片已替换' : `已添加 ${photoUrls.length} 张图片`);
    renderThumbGrid();
    modal.hidden = false;
  };

  fileInput.onchange = async (event) => {
    const rawFiles = [...(event.target.files ?? [])].filter((f) => f.size > 0);
    await handleFiles(rawFiles);
  };

  addBtn.onclick = () => {
    photoManageState.mode = 'add';
    photoManageState.replaceIndex = null;
    fileInput.multiple = true;
    fileInput.value = '';
    fileInput.click();
  };

  deleteBtn.onclick = async () => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item || !item.photoUrls?.length) {
      modal.hidden = true;
      await showModal('当前 YW 没有图片可删除');
      modal.hidden = false;
      return;
    }
    modal.hidden = true;
    const confirmed = await showModal('确认删除所有图片吗？', { showCancel: true });
    if (!confirmed) { modal.hidden = false; return; }
    await updateItemPhotos(itemId, []);
    renderAll();
    await showModal('图片已删除');
    renderThumbGrid();
    modal.hidden = false;
  };

  renderThumbGrid();
}

// ═══════════════════════════════════════════════
// Crop modal
// ═══════════════════════════════════════════════
let cropResolve = null;
let cropState = { file: null, aspectRatio: 1, imgNaturalW: 0, imgNaturalH: 0, imgX: 0, imgY: 0, imgW: 0, imgH: 0, cx: 0, cy: 0, cw: 0, ch: 0, containerW: 0, containerH: 0 };
let cropDrag = { active: false, mode: null, handle: null, startX: 0, startY: 0, snapCX: 0, snapCY: 0, snapCW: 0, snapCH: 0 };

function showCropModal(file, aspectRatio) {
  return new Promise((resolve) => {
    cropResolve = resolve;
    cropState.file = file;
    cropState.aspectRatio = aspectRatio;
    const container = elements.cropPreviewContainer;
    container.className = 'crop-preview-container';
    if (aspectRatio === 1) container.classList.add('square');
    else if (Math.abs(aspectRatio - 0.8) < 0.01) container.classList.add('portrait-45');
    else container.classList.add('portrait-34');
    const reader = new FileReader();
    reader.onload = function (e) {
      elements.cropImage.src = e.target.result;
      elements.cropImage.onload = function () {
        requestAnimationFrame(function () { initCropLayout(); renderCropOverlay(); });
      };
    };
    reader.readAsDataURL(file);
    elements.cropModal.hidden = false;
  });
}

function createCropResult(type, file) { return { type, file: file ?? null }; }
function resolveCroppedFile(originalFile, cropResult) {
  if (!cropResult || cropResult.type === 'cancel') return null;
  if (cropResult.type === 'original') return originalFile;
  if (cropResult.type === 'crop' && cropResult.file) {
    return new File([cropResult.file], originalFile.name, { type: 'image/jpeg' });
  }
  return null;
}

function initCropLayout() {
  const container = elements.cropPreviewContainer;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  cropState.containerW = cw;
  cropState.containerH = ch;
  const iw = elements.cropImage.naturalWidth;
  const ih = elements.cropImage.naturalHeight;
  cropState.imgNaturalW = iw;
  cropState.imgNaturalH = ih;
  const fitScale = Math.min(cw / iw, ch / ih);
  cropState.imgW = Math.round(iw * fitScale);
  cropState.imgH = Math.round(ih * fitScale);
  cropState.imgX = Math.round((cw - cropState.imgW) / 2);
  cropState.imgY = Math.round((ch - cropState.imgH) / 2);
  const ratio = cropState.aspectRatio;
  const maxW = cropState.imgW;
  const maxH = cropState.imgH;
  let rectW = Math.round(maxW * 0.8);
  let rectH = Math.round(rectW / ratio);
  if (rectH > maxH * 0.8) { rectH = Math.round(maxH * 0.8); rectW = Math.round(rectH * ratio); }
  cropState.cx = Math.round(cropState.imgX + (maxW - rectW) / 2);
  cropState.cy = Math.round(cropState.imgY + (maxH - rectH) / 2);
  cropState.cw = rectW;
  cropState.ch = rectH;
}

function viewScale() {
  if (!cropState.imgNaturalW) return 1;
  return cropState.imgW / cropState.imgNaturalW;
}

function renderCropOverlay() {
  const img = elements.cropImage;
  img.style.width = cropState.imgW + 'px';
  img.style.height = cropState.imgH + 'px';
  img.style.left = cropState.imgX + 'px';
  img.style.top = cropState.imgY + 'px';
  const rect = document.getElementById('cropRect');
  rect.style.left = cropState.cx + 'px';
  rect.style.top = cropState.cy + 'px';
  rect.style.width = cropState.cw + 'px';
  rect.style.height = cropState.ch + 'px';
}

function clampCropRect() {
  const c = cropState;
  const minSize = 20;
  if (c.cw < minSize) c.cw = minSize;
  if (c.ch < minSize) c.ch = minSize;
  if (c.cw > c.imgW) c.cw = c.imgW;
  if (c.ch > c.imgH) c.ch = c.imgH;
  if (c.cx < c.imgX) c.cx = c.imgX;
  if (c.cy < c.imgY) c.cy = c.imgY;
  if (c.cx + c.cw > c.imgX + c.imgW) c.cx = c.imgX + c.imgW - c.cw;
  if (c.cy + c.ch > c.imgY + c.imgH) c.cy = c.imgY + c.imgH - c.ch;
  if (c.cx < c.imgX) c.cx = c.imgX;
  if (c.cy < c.imgY) c.cy = c.imgY;
}

async function performCrop() {
  const img = elements.cropImage;
  const c = cropState;
  const vs = viewScale();
  const sx = Math.max(0, (c.cx - c.imgX) / vs);
  const sy = Math.max(0, (c.cy - c.imgY) / vs);
  const sw = Math.min(c.cw / vs, c.imgNaturalW - sx);
  const sh = Math.min(c.ch / vs, c.imgNaturalH - sy);
  let outputBase = 1200;
  let canvasW, canvasH;
  const ratio = c.aspectRatio;
  if (ratio >= 1) { canvasW = outputBase; canvasH = Math.round(outputBase / ratio); }
  else { canvasH = outputBase; canvasW = Math.round(outputBase * ratio); }
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.drawImage(img, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, canvasW, canvasH);
  return new Promise((resolve) => { canvas.toBlob(resolve, 'image/jpeg', 0.92); });
}

function prepareCropModalClose() {
  elements.cropModal.hidden = true;
  endCropDrag();
  elements.cropImage.onload = null;
  elements.cropImage.src = '';
}

function closeCropModal(result) {
  prepareCropModalClose();
  if (cropResolve) { cropResolve(result); cropResolve = null; }
}

function eventCoords(e) {
  return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
}

function startCropDrag(e, mode, handle) {
  const coords = eventCoords(e);
  cropDrag.active = true; cropDrag.mode = mode; cropDrag.handle = handle;
  cropDrag.startX = coords.x; cropDrag.startY = coords.y;
  cropDrag.snapCX = cropState.cx; cropDrag.snapCY = cropState.cy;
  cropDrag.snapCW = cropState.cw; cropDrag.snapCH = cropState.ch;
}

function moveCropDrag(e) {
  if (!cropDrag.active || elements.cropModal.hidden) return;
  const coords = eventCoords(e);
  if (cropDrag.mode === 'rect') {
    const newCX = cropDrag.snapCX + (coords.x - cropDrag.startX);
    const newCY = cropDrag.snapCY + (coords.y - cropDrag.startY);
    cropState.cx = newCX;
    cropState.cy = newCY;
    clampCropRect();
    if (cropState.cx !== newCX || cropState.cy !== newCY) {
      cropDrag.snapCX = cropState.cx;
      cropDrag.snapCY = cropState.cy;
      cropDrag.startX = coords.x;
      cropDrag.startY = coords.y;
    }
  } else {
    handleCornerDrag(coords.x, coords.y);
    clampCropRect();
  }
  renderCropOverlay();
}

function bindCropModalEvents() {
  const handles = document.querySelectorAll('.crop-handle');
  for (let i = 0; i < handles.length; i++) {
    const handleName = handles[i].dataset.handle;
    handles[i].addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); startCropDrag(e, 'handle', handleName); });
    handles[i].addEventListener('touchstart', (e) => { if (e.touches.length !== 1) return; e.preventDefault(); e.stopPropagation(); startCropDrag(e, 'handle', handleName); });
  }

  const cropRect = document.getElementById('cropRect');
  cropRect.addEventListener('mousedown', (e) => { if (e.target !== cropRect) return; e.preventDefault(); startCropDrag(e, 'rect', null); });
  cropRect.addEventListener('touchstart', (e) => { if (e.target !== cropRect || e.touches.length !== 1) return; e.preventDefault(); startCropDrag(e, 'rect', null); });

  document.addEventListener('mousemove', moveCropDrag);
  document.addEventListener('touchmove', moveCropDrag, { passive: false });
  document.addEventListener('mouseup', endCropDrag);
  document.addEventListener('touchend', endCropDrag);

  elements.cropConfirmBtn.addEventListener('click', async () => {
    const blob = await performCrop();
    closeCropModal(createCropResult('crop', blob));
  });
  elements.cropSkipBtn.addEventListener('click', () => { closeCropModal(createCropResult('original')); });
  elements.cropModal.addEventListener('click', (event) => {
    if (event.target === elements.cropModal) closeCropModal(createCropResult('cancel'));
  });
}

function endCropDrag() { cropDrag.active = false; cropDrag.mode = null; }

function handleCornerDrag(clientX, clientY) {
  const dx = clientX - cropDrag.startX;
  const dy = clientY - cropDrag.startY;
  const snap = { cx: cropDrag.snapCX, cy: cropDrag.snapCY, cw: cropDrag.snapCW, ch: cropDrag.snapCH };
  const ratio = cropState.aspectRatio;
  const h = cropDrag.handle;
  const img = { x: cropState.imgX, y: cropState.imgY, w: cropState.imgW, h: cropState.imgH };
  let anchorX, anchorY, newW, newH;

  if (h === 'tl') {
    anchorX = snap.cx + snap.cw; anchorY = snap.cy + snap.ch;
    newW = anchorX - (snap.cx + dx); newH = anchorY - (snap.cy + dy);
  } else if (h === 'tr') {
    anchorX = snap.cx; anchorY = snap.cy + snap.ch;
    newW = (snap.cx + snap.cw + dx) - anchorX; newH = anchorY - (snap.cy + dy);
  } else if (h === 'bl') {
    anchorX = snap.cx + snap.cw; anchorY = snap.cy;
    newW = anchorX - (snap.cx + dx); newH = (snap.cy + snap.ch + dy) - anchorY;
  } else {
    anchorX = snap.cx; anchorY = snap.cy;
    newW = (snap.cx + snap.cw + dx) - anchorX; newH = (snap.cy + snap.ch + dy) - anchorY;
  }

  if (!isFinite(newW) || !isFinite(newH) || newW <= 0 || newH <= 0) {
    newW = 20; newH = 20 / ratio;
  }

  // Apply crop aspect ratio before boundary clamping
  if (isFinite(newW / newH) && newW / newH > ratio) newW = newH * ratio;
  else if (isFinite(newW / newH)) newH = newW / ratio;

  // Per-handle boundary clamping: anchor stays fixed, scale down to fit within image
  let maxW, maxH;
  if (h === 'tl' || h === 'bl') {
    maxW = anchorX - img.x;
  } else {
    maxW = (img.x + img.w) - anchorX;
  }
  if (h === 'tl' || h === 'tr') {
    maxH = anchorY - img.y;
  } else {
    maxH = (img.y + img.h) - anchorY;
  }
  if (newW > maxW || newH > maxH) {
    const scale = Math.min(maxW / newW, maxH / newH);
    newW *= scale; newH *= scale;
  }

  // Overall max size guard
  const maxSize = Math.max(img.w, img.h);
  if (newW > maxSize || newH > maxSize) {
    const scale = Math.min(maxSize / newW, maxSize / newH);
    newW *= scale; newH *= scale;
  }

  // Min size guard (aspect-ratio aware)
  if (newW < 20) { newW = 20; newH = 20 / ratio; }
  if (newH < 20) { newH = 20; newW = 20 * ratio; }

  if (h === 'tl' || h === 'bl') cropState.cx = anchorX - newW;
  else cropState.cx = anchorX;
  if (h === 'tl' || h === 'tr') cropState.cy = anchorY - newH;
  else cropState.cy = anchorY;
  cropState.cw = newW;
  cropState.ch = newH;
}

// ═══════════════════════════════════════════════
// Event bindings
// ═══════════════════════════════════════════════
function bindEvents() {
  elements.homeButton.addEventListener('click', () => showHomeView());
  elements.addButton.addEventListener('click', () => showAddView());
  elements.settingsButton.addEventListener('click', () => showSettingsView());
  elements.emptySettingsButton.addEventListener('click', () => showSettingsView());

  document.addEventListener('click', (event) => {
    if (!activeItemAction) return;
    if (elements.itemActionsModal.hidden) { activeItemAction = null; return; }
    if (event.target === elements.itemActionsModal) closeItemActionsModal();
  });

  elements.clearItemFilesButton.addEventListener('click', async () => {
    elements.itemPhotosInput.value = ''; syncFileSummaries();
    await showModal('已清空已选图片');
  });

  elements.itemPhotosInput.addEventListener('change', async (event) => {
    await cropMultipleInputFiles(event.target, 1);
  });
  elements.personHomePhotoInput.addEventListener('change', async (event) => {
    await cropSingleInputFile(event.target, 4 / 5);
  });
  elements.personDetailPhotoInput.addEventListener('change', async (event) => {
    await cropSingleInputFile(event.target, 1);
  });

  elements.settingsPersonSelect.addEventListener('change', (event) => {
    viewState.settingsActivePersonId = event.target.value;
  });
  elements.overviewPersonSelect.addEventListener('change', (event) => {
    viewState.overviewPersonId = event.target.value;
    renderCategoryOverview();
  });

  elements.settingsPersonHomePhotoInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file || !viewState.settingsActivePersonId) return;
    const cropResult = await showCropModal(file, 4 / 5);
    const finalFile = resolveCroppedFile(file, cropResult);
    if (!finalFile) { event.target.value = ''; return; }
    try {
      await updatePersonPhoto(viewState.settingsActivePersonId, 'homePhotoUrl', finalFile);
      renderAll();
      await showModal('主页图片已更新');
    } catch (err) {
      console.error(err);
      await showModal('主页图片更新失败，请重试');
    } finally {
      event.target.value = '';
    }
  });

  elements.settingsPersonDetailPhotoInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file || !viewState.settingsActivePersonId) return;
    const cropResult = await showCropModal(file, 1);
    const finalFile = resolveCroppedFile(file, cropResult);
    if (!finalFile) { event.target.value = ''; return; }
    try {
      await updatePersonPhoto(viewState.settingsActivePersonId, 'detailPhotoUrl', finalFile);
      renderAll();
      await showModal('个人页图片已更新');
    } catch (err) {
      console.error(err);
      await showModal('个人页图片更新失败，请重试');
    } finally {
      event.target.value = '';
    }
  });

  elements.settingsDeletePersonBtn.addEventListener('click', () => handleDeleteCurrentPerson());

  elements.exportDataBtn.addEventListener('click', () => {
    exportData();
  });

  elements.importDataInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importData(file);
    event.target.value = '';
  });

  elements.itemPersonSelect.addEventListener('change', () => syncGroupOptions());
  elements.itemGroupSelect.addEventListener('change', () => {
    syncCategoryOptions(elements.itemGroupSelect.value);
  });

  // Person form
  elements.personForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.personForm, 'person', async () => {
      const formData = new FormData(elements.personForm);
      const name = String(formData.get('name')).trim();
      if (!name) { await showModal('请填写体育生姓名'); return; }
      if (state.people.some((p) => normalizeName(p.name) === normalizeName(name))) {
        await showModal('体育生姓名已存在，请勿重复添加'); return;
      }
      const confirmed = await showModal('确认保存新体育生吗？', { showCancel: true });
      if (!confirmed) return;

      const homeFile = formData.get('homePhoto');
      const detailFile = formData.get('detailPhoto');
      const person = await createPerson(name, homeFile, detailFile);

      elements.personForm.querySelector('input[name="name"]').value = '';
      elements.personHomePhotoInput.value = '';
      elements.personDetailPhotoInput.value = '';
      syncFileSummaries();
      viewState.settingsActivePersonId = person.id;
      viewState.overviewPersonId = person.id;
      if (!viewState.selectedPersonId) viewState.selectedPersonId = person.id;
      renderAll();
      await showModal(`体育生已保存：${person.name}`);
    });
  });

  // Group form
  elements.groupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.groupForm, 'group', async () => {
      const formData = new FormData(elements.groupForm);
      const name = String(formData.get('name')).trim();
      if (!name) { await showModal('请填写大品类名称'); return; }
      if (state.groups.some((g) => normalizeName(g.name) === normalizeName(name))) {
        await showModal('大品类名称已存在，请勿重复添加'); return;
      }
      await createGroup(name);
      elements.groupForm.reset();
      renderAll();
      await showModal(`大品类已保存：${name}`);
    });
  });

  // Category form
  elements.categoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.categoryForm, 'category', async () => {
      const formData = new FormData(elements.categoryForm);
      const groupId = String(formData.get('groupId')).trim();
      const name = String(formData.get('name')).trim();
      if (!groupId || !name) { await showModal('请填写完整的小品类信息'); return; }
      if (state.categories.some((c) => c.groupId === groupId && normalizeName(c.name) === normalizeName(name))) {
        await showModal('该大品类下的小品类名称已存在，请勿重复添加'); return;
      }
      await createCategory(groupId, name);
      elements.categoryForm.reset();
      elements.categoryGroupSelect.value = groupId;
      elements.itemGroupSelect.value = groupId;
      syncCategoryOptions(groupId);
      renderAll();
      await showModal(`小品类已保存：${name}`);
    });
  });

  // Item form
  elements.itemForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.itemForm, 'item', async () => {
      const formData = new FormData(elements.itemForm);
      const personId = String(formData.get('personId'));
      const groupId = String(formData.get('groupId'));
      const categoryId = String(formData.get('categoryId'));
      const label = String(formData.get('label')).trim();
      const quantity = Number(formData.get('quantity'));
      const unit = String(formData.get('unit')).trim();
      const notes = String(formData.get('notes')).trim();
      const isGift = formData.has('isGift');
      const isOwnedNow = formData.has('isOwnedNow');
      const rawFiles = formData.getAll('photos').filter((f) => f instanceof File && f.size > 0);

      if (!personId || !groupId || !categoryId || !label || !quantity || !unit) {
        await showModal('请把 YW 信息填写完整'); return;
      }

      const photoUrls = [];
      for (const file of rawFiles) {
        photoUrls.push(await readFileAsDataURL(file));
      }

      await createItem({ personId, categoryId, label, quantity, unit, notes, isGift, isOwnedNow, photoUrls });

      elements.itemForm.reset();
      elements.itemOwnedNowInput.checked = true;
      elements.itemGiftInput.checked = false;
      // 确保文件 input 彻底清空
      elements.itemPhotosInput.value = '';
      elements.itemPersonSelect.value = personId;
      elements.itemGroupSelect.value = groupId;
      syncCategoryOptions(groupId);
      elements.itemCategorySelect.value = categoryId;
      syncFileSummaries();
      renderAll();
      await showModal(`YW 已成功保存：${label}`);
    });
  });

  // Prevent double-submit for forms
  const lockNames = { [elements.groupForm]: 'group', [elements.categoryForm]: 'category', [elements.personForm]: 'person', [elements.itemForm]: 'item' };
  [elements.groupForm, elements.categoryForm, elements.personForm, elements.itemForm].forEach((form) => {
    form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && formLocks[lockNames[form]]) event.preventDefault();
    });
  });
}

async function handleDeleteCurrentPerson() {
  const personId = viewState.settingsActivePersonId;
  if (!personId) return;
  const person = state.people.find((p) => p.id === personId);
  if (!person) return;
  const confirmed = await showModal(`确认删除体育生"${person.name}"及其所有 YW 吗？该操作无法恢复。`, { showCancel: true });
  if (!confirmed) return;

  await deletePerson(personId);
  if (viewState.selectedPersonId === personId) viewState.selectedPersonId = state.people[0]?.id ?? null;
  viewState.settingsActivePersonId = state.people[0]?.id ?? null;
  viewState.overviewPersonId = state.people[0]?.id ?? null;
  renderAll();
  await showModal('体育生已删除');
}

// ═══════════════════════════════════════════════
// File input helpers
// ═══════════════════════════════════════════════
async function cropSingleInputFile(input, aspectRatio) {
  const file = input.files?.[0];
  if (!file) { syncFileSummaries(); return; }
  const cropResult = await showCropModal(file, aspectRatio);
  const finalFile = resolveCroppedFile(file, cropResult);
  if (!finalFile) { input.value = ''; syncFileSummaries(); return; }
  setInputFiles(input, [finalFile]);
  syncFileSummaries();
}

async function cropMultipleInputFiles(input, aspectRatio) {
  const files = [...(input.files ?? [])].filter((f) => f.size > 0);
  if (!files.length) { syncFileSummaries(); return; }
  const cropped = [];
  for (const file of files) {
    const cropResult = await showCropModal(file, aspectRatio);
    const finalFile = resolveCroppedFile(file, cropResult);
    if (!finalFile) {
      if (cropped.length) {
        setInputFiles(input, cropped);
        syncFileSummaries();
      } else {
        input.value = '';
        syncFileSummaries();
      }
      return;
    }
    cropped.push(finalFile);
  }
  setInputFiles(input, cropped);
  syncFileSummaries();
}

// ═══════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════
async function initApp() {
  await loadState();
  await syncMissingGroupOrders();
  if (state.people.length > 0) {
    viewState.selectedPersonId = state.people[0].id;
    viewState.settingsActivePersonId = state.people[0].id;
    viewState.overviewPersonId = state.people[0].id;
  }
  bindEvents();
  bindCropModalEvents();
  renderAll();
  syncFileSummaries();
}

cacheElements();
initApp().catch((err) => console.error('应用初始化失败:', err));

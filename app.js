// ═══════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════
const isMacDevice = matchMedia('(hover: hover) and (pointer: fine)').matches;

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

const datePickerState = { year: 1998, month: 3, day: 25, scrollTimer: null };

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

async function saveState() {
  const data = serializeState();
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(data, DB_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return { ok: true, storage: 'indexedDB' };
  } catch (e) {
    console.error('IndexedDB 保存失败，回退到 localStorage:', e);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true, storage: 'localStorage' };
    } catch (storageError) {
      console.error('localStorage 保存失败:', storageError);
      return { ok: false, storage: null };
    }
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
  return normalizeState();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateImportedState(data) {
  if (!isPlainObject(data)) return { ok: false, message: '备份文件根数据格式错误' };

  const requiredKeys = ['people', 'groups', 'categories', 'items'];
  const missingKeys = requiredKeys.filter((key) => !Array.isArray(data[key]));
  if (missingKeys.length > 0) {
    return { ok: false, message: '备份文件数据不完整，缺少关键字段：' + missingKeys.join('、') };
  }

  const optionalObjectKeys = ['collapsedSubcategories', 'collapsedSettingsGroups', 'groupOrderByPerson', 'categoryOrderByPerson'];
  for (const key of optionalObjectKeys) {
    if (data[key] !== undefined && !isPlainObject(data[key])) {
      return { ok: false, message: `备份文件字段 ${key} 格式错误` };
    }
  }

  const personIds = new Set();
  for (const person of data.people) {
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

  const groupIds = new Set();
  for (const group of data.groups) {
    if (!isPlainObject(group) || typeof group.id !== 'string' || !group.id || typeof group.name !== 'string') {
      return { ok: false, message: '备份文件中的大品类数据格式错误' };
    }
    if (groupIds.has(group.id)) return { ok: false, message: `备份文件存在重复大品类 ID：${group.id}` };
    groupIds.add(group.id);
  }

  const categoriesById = new Map();
  for (const category of data.categories) {
    if (!isPlainObject(category) || typeof category.id !== 'string' || !category.id || typeof category.name !== 'string' || typeof category.groupId !== 'string') {
      return { ok: false, message: '备份文件中的小品类数据格式错误' };
    }
    if (categoriesById.has(category.id)) return { ok: false, message: `备份文件存在重复小品类 ID：${category.id}` };
    if (!groupIds.has(category.groupId)) return { ok: false, message: `小品类"${category.name}"引用了不存在的大品类` };
    categoriesById.set(category.id, category);
  }

  const itemIds = new Set();
  for (const item of data.items) {
    if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id || typeof item.personId !== 'string' || typeof item.categoryId !== 'string' || typeof item.label !== 'string' || typeof item.unit !== 'string') {
      return { ok: false, message: '备份文件中的 YW 数据格式错误' };
    }
    if (itemIds.has(item.id)) return { ok: false, message: `备份文件存在重复 YW ID：${item.id}` };
    itemIds.add(item.id);
    if (!personIds.has(item.personId)) return { ok: false, message: `YW"${item.label}"引用了不存在的体育生` };
    if (!categoriesById.has(item.categoryId)) return { ok: false, message: `YW"${item.label}"引用了不存在的小品类` };
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return { ok: false, message: `YW"${item.label}"的数量格式错误` };
    if (!isValidDateString(item.date || '1998-03-25')) return { ok: false, message: `YW"${item.label}"的日期格式错误` };
    if (item.isGift !== undefined && typeof item.isGift !== 'boolean') return { ok: false, message: `YW"${item.label}"的赠送状态格式错误` };
    if (item.isOwnedNow !== undefined && typeof item.isOwnedNow !== 'boolean') return { ok: false, message: `YW"${item.label}"的现存状态格式错误` };
    if (item.photoUrls !== undefined && (!Array.isArray(item.photoUrls) || item.photoUrls.some((url) => typeof url !== 'string'))) {
      return { ok: false, message: `YW"${item.label}"的图片格式错误` };
    }
  }

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

function normalizeState() {
  let changed = false;
  const peopleIds = state.people.map((p) => p.id);
  const peopleIdSet = new Set(peopleIds);
  const groupIds = state.groups.map((g) => g.id);
  const groupIdSet = new Set(groupIds);

  if (!state.groupOrderByPerson || typeof state.groupOrderByPerson !== 'object') {
    state.groupOrderByPerson = {};
    changed = true;
  }
  if (!state.categoryOrderByPerson || typeof state.categoryOrderByPerson !== 'object') {
    state.categoryOrderByPerson = {};
    changed = true;
  }

  if (!Array.isArray(state.items)) {
    state.items = [];
    changed = true;
  }

  for (const item of state.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      item.quantity = 1;
      changed = true;
    }
    if (!isValidDateString(item.date)) {
      item.date = '1998-03-25';
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

  for (const person of state.people) {
    if (person.galleryEnabled === undefined) { person.galleryEnabled = false; changed = true; }
    if (!Array.isArray(person.galleryPhotos)) { person.galleryPhotos = []; changed = true; }

    const currentGroupOrder = state.groupOrderByPerson[person.id];
    const nextGroupOrder = normalizeOrderList(currentGroupOrder, groupIds);
    if (!arraysEqual(currentGroupOrder, nextGroupOrder)) {
      state.groupOrderByPerson[person.id] = nextGroupOrder;
      changed = true;
    }

    if (!state.categoryOrderByPerson[person.id] || typeof state.categoryOrderByPerson[person.id] !== 'object') {
      state.categoryOrderByPerson[person.id] = {};
      changed = true;
    }

    const categoryOrderMap = state.categoryOrderByPerson[person.id];
    for (const groupId of Object.keys(categoryOrderMap)) {
      if (!groupIdSet.has(groupId)) {
        delete categoryOrderMap[groupId];
        changed = true;
      }
    }

    for (const group of state.groups) {
      const categoryIds = getCategoriesByGroupId(group.id).map((category) => category.id);
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
  }

  return changed;
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
      const changed = restoreStateFromData(data);
      if (changed) await saveState();
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
      saveState().then((result) => {
        if (!result || result.storage !== 'indexedDB') return;
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
  const data = serializeState();
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

  const validation = validateImportedState(data);
  if (!validation.ok) {
    await showModal(validation.message);
    return;
  }

  const confirmed = await showModal(
    `确认导入备份数据吗？将替换当前所有数据（${state.people.length} 位体育生、${state.items.length} 条 YW）。此操作不可撤销。`,
    { showCancel: true }
  );
  if (!confirmed) return;

  restoreStateFromData(validation.data);
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
    appMain: document.querySelector('.app-main'),

    athleteSwitcher: document.querySelector('#athleteSwitcher'),
    switcherScrollArea: document.querySelector('.switcher-scroll-area'),
    homeEmptyState: document.querySelector('#homeEmptyState'),
    athleteSelectorGrid: document.querySelector('#athleteSelectorGrid'),
    athleteDetailHero: document.querySelector('#athleteDetailHero'),
    athleteGallery: document.querySelector('#athleteGallery'),
    athleteGroupedContent: document.querySelector('#athleteGroupedContent'),

    settingsPersonSelect: document.querySelector('#settingsPersonSelect'),
    gallerySettingsBlock: document.querySelector('#gallerySettingsBlock'),
    galleryToggleBtn: document.querySelector('#galleryToggleBtn'),
    galleryManageBtn: document.querySelector('#galleryManageBtn'),
    galleryPhotoCount: document.querySelector('#galleryPhotoCount'),
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
    itemStatusToggles: document.querySelectorAll('.toggle-switch[data-status-toggle]'),
    cropModal: document.querySelector('#cropModal'),
    cropPreviewContainer: document.querySelector('#cropPreviewContainer'),
    cropImage: document.querySelector('#cropImage'),
    cropConfirmBtn: document.querySelector('#cropConfirmBtn'),
    cropSkipBtn: document.querySelector('#cropSkipBtn'),

    itemDateHidden: document.querySelector('#itemDateHidden'),
    itemDateDisplay: document.querySelector('#itemDateDisplay'),
    datePickerModal: document.querySelector('#datePickerModal'),
    datePickerCancelBtn: document.querySelector('#datePickerCancelBtn'),
    datePickerConfirmBtn: document.querySelector('#datePickerConfirmBtn'),
    dateYearScroll: document.querySelector('[data-col="year"]'),
    dateMonthScroll: document.querySelector('[data-col="month"]'),
    dateDayScroll: document.querySelector('[data-col="day"]'),
  });

  // Templates
  elements.templates = {
    switcherChip: document.querySelector('#switcherChipTemplate'),
    selectorCard: document.querySelector('#selectorCardTemplate'),
    detailHero: document.querySelector('#detailHeroTemplate'),
    categorySection: document.querySelector('#categorySectionTemplate'),
    subcategory: document.querySelector('#subcategoryTemplate'),
    ywCard: document.querySelector('#ywCardTemplate'),
    galleryCard: document.querySelector('#galleryCardTemplate'),
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
      cancelBtn.className = 'secondary-button';
      cancelBtn.textContent = '取消';
      cancelBtn.onclick = () => cleanup(false);
      confirmBtn.className = 'primary-button';
      actions.append(confirmBtn, cancelBtn);
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${String(y).slice(-2)}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function toDateDisplay(dateStr) {
  if (!dateStr) return '1998/3/25';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(y, 10)}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

// ═══════════════════════════════════════════════
// Date picker
// ═══════════════════════════════════════════════
function syncDateDisplay(dateStr) {
  var formatted;
  if (dateStr) {
    formatted = dateStr;
  } else {
    var y = String(datePickerState.year);
    var m = String(datePickerState.month).padStart(2, '0');
    var d = String(datePickerState.day).padStart(2, '0');
    formatted = y + '-' + m + '-' + d;
  }
  elements.itemDateHidden.value = formatted;
  elements.itemDateDisplay.querySelector('.date-display-text').textContent = toDateDisplay(formatted);
}

function renderColumnItems(scrollEl, items, selectedValue, colType) {
  var existing = scrollEl.querySelectorAll('.date-col-item');
  for (var i = 0; i < existing.length; i++) { existing[i].remove(); }

  var spacerBottom = scrollEl.querySelector('.date-col-spacer:last-child');
  var fragment = document.createDocumentFragment();
  for (var j = 0; j < items.length; j++) {
    var itemEl = document.createElement('div');
    itemEl.className = 'date-col-item';
    itemEl.textContent = String(items[j]);
    itemEl.dataset.value = String(items[j]);
    itemEl.dataset.col = colType;
    itemEl.addEventListener('click', function(e) {
      var val = parseInt(e.currentTarget.dataset.value, 10);
      handleDateItemClick(colType, val, scrollEl);
    });
    fragment.appendChild(itemEl);
  }
  scrollEl.insertBefore(fragment, spacerBottom);
}

function renderYearColumn(scrollEl, selectedYear) {
  var currentYear = new Date().getFullYear();
  var items = [];
  for (var y = currentYear; y >= 1950; y--) { items.push(y); }
  renderColumnItems(scrollEl, items, selectedYear, 'year');
}

function renderMonthColumn(scrollEl, selectedMonth) {
  var items = [];
  for (var m = 1; m <= 12; m++) { items.push(m); }
  renderColumnItems(scrollEl, items, selectedMonth, 'month');
}

function renderDayColumn(scrollEl, selectedDay, year, month) {
  var maxDay = daysInMonth(year, month);
  var items = [];
  for (var d = 1; d <= maxDay; d++) { items.push(d); }
  renderColumnItems(scrollEl, items, selectedDay, 'day');
}

function handleDateItemClick(colType, value, scrollEl) {
  if (colType === 'year') datePickerState.year = value;
  else if (colType === 'month') datePickerState.month = value;
  else if (colType === 'day') datePickerState.day = value;

  if (colType === 'year' || colType === 'month') {
    refreshDayColumn();
  }
  scrollToSelectedItem(scrollEl, value);
  updateColumnSelection(scrollEl, value);
}

function onColumnScroll(e) {
  var scrollEl = e.target;
  if (!scrollEl.classList.contains('date-col-scroll')) return;

  clearTimeout(datePickerState.scrollTimer);
  datePickerState.scrollTimer = setTimeout(function() {
    var selectedValue = getClosestSnapItem(scrollEl);
    if (selectedValue === null) return;

    var colType = scrollEl.dataset.col;
    if (colType === 'year') datePickerState.year = selectedValue;
    else if (colType === 'month') datePickerState.month = selectedValue;
    else if (colType === 'day') datePickerState.day = selectedValue;

    updateColumnSelection(scrollEl, selectedValue);

    if (colType === 'year' || colType === 'month') {
      refreshDayColumn();
    }
  }, 150);
}

function getClosestSnapItem(scrollEl) {
  var items = scrollEl.querySelectorAll('.date-col-item');
  var viewCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;
  var closest = null;
  var minDist = Infinity;
  for (var i = 0; i < items.length; i++) {
    var itemCenter = items[i].offsetTop + items[i].offsetHeight / 2;
    var dist = Math.abs(itemCenter - viewCenter);
    if (dist < minDist) {
      minDist = dist;
      closest = parseInt(items[i].dataset.value, 10);
    }
  }
  return closest;
}

function updateColumnSelection(scrollEl, value) {
  var items = scrollEl.querySelectorAll('.date-col-item');
  for (var i = 0; i < items.length; i++) {
    if (parseInt(items[i].dataset.value, 10) === value) {
      items[i].classList.add('selected');
    } else {
      items[i].classList.remove('selected');
    }
  }
}

function scrollToSelectedItem(scrollEl, value) {
  var items = scrollEl.querySelectorAll('.date-col-item');
  for (var i = 0; i < items.length; i++) {
    if (parseInt(items[i].dataset.value, 10) === value) {
      var itemTop = items[i].offsetTop;
      var scrollTarget = itemTop - (scrollEl.clientHeight / 2) + (items[i].offsetHeight / 2);
      scrollEl.scrollTop = scrollTarget;
      break;
    }
  }
}

function refreshDayColumn() {
  var maxDay = daysInMonth(datePickerState.year, datePickerState.month);
  if (datePickerState.day > maxDay) {
    datePickerState.day = maxDay;
  }
  renderDayColumn(elements.dateDayScroll, datePickerState.day, datePickerState.year, datePickerState.month);
  requestAnimationFrame(function() {
    scrollToSelectedItem(elements.dateDayScroll, datePickerState.day);
    updateColumnSelection(elements.dateDayScroll, datePickerState.day);
  });
}

function openDatePicker(dateStr) {
  var parts = dateStr.split('-');
  datePickerState.year = parseInt(parts[0], 10) || 1998;
  datePickerState.month = parseInt(parts[1], 10) || 3;
  datePickerState.day = parseInt(parts[2], 10) || 25;

  renderYearColumn(elements.dateYearScroll, datePickerState.year);
  renderMonthColumn(elements.dateMonthScroll, datePickerState.month);
  renderDayColumn(elements.dateDayScroll, datePickerState.day, datePickerState.year, datePickerState.month);

  requestAnimationFrame(function() {
    scrollToSelectedItem(elements.dateYearScroll, datePickerState.year);
    updateColumnSelection(elements.dateYearScroll, datePickerState.year);
    scrollToSelectedItem(elements.dateMonthScroll, datePickerState.month);
    updateColumnSelection(elements.dateMonthScroll, datePickerState.month);
    scrollToSelectedItem(elements.dateDayScroll, datePickerState.day);
    updateColumnSelection(elements.dateDayScroll, datePickerState.day);
  });

  elements.datePickerModal.hidden = false;
}

function confirmDatePicker() {
  syncDateDisplay();
  elements.datePickerModal.hidden = true;
}

function cancelDatePicker() {
  elements.datePickerModal.hidden = true;
}

function formatItemLabel(item) {
  let text = item.label;
  if (item.quantity && item.unit) {
    text += ' · ' + item.quantity + item.unit;
  }
  return text;
}

function formatItemStatus(item) {
  const parts = [];
  if (item.isGift) parts.push('赠送');
  parts.push(item.isOwnedNow ? '现存' : '非现存');
  return parts.join(' · ');
}

function itemHasPhotos(item) {
  return (item.photoUrls || []).length > 0;
}

function splitItemsByPhotos(items) {
  return items.reduce((groups, item) => {
    groups[itemHasPhotos(item) ? 'imageItems' : 'textItems'].push(item);
    return groups;
  }, { imageItems: [], textItems: [] });
}

function formatCategoryCounts(items) {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const ownedQty = items.reduce((sum, item) => sum + (item.isOwnedNow ? item.quantity : 0), 0);
  return `总数量 ${totalQty} · 现存 ${ownedQty}`;
}

function findPersonById(personId) {
  return state.people.find((person) => person.id === personId);
}

function findItemById(itemId) {
  return state.items.find((item) => item.id === itemId);
}

function findCategoryById(categoryId) {
  return state.categories.find((category) => category.id === categoryId);
}

function getCategoriesByGroupId(groupId) {
  return state.categories.filter((category) => category.groupId === groupId);
}

function getItemsByPersonCategory(personId, categoryId) {
  return state.items.filter((item) => item.personId === personId && item.categoryId === categoryId);
}

function hasGroupContent(personId, groupId) {
  return getCategoriesByGroupId(groupId).some(
    (category) => getItemsByPersonCategory(personId, category.id).length > 0
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
    getCategoriesByGroupId(groupId).map((category) => category.id);
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
    return getCategoriesByGroupId(groupId);
  }
  const orderIds = getCategoryOrderIdsForPersonGroup(personId, groupId);
  const categoryMap = new Map(
    getCategoriesByGroupId(groupId).map((category) => [category.id, category])
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

async function readFilesAsDataURLs(files) {
  const photoUrls = [];
  for (const file of files) {
    photoUrls.push(await readFileAsDataURL(file));
  }
  return photoUrls;
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

  const person = { id: crypto.randomUUID(), name, homePhotoUrl, detailPhotoUrl, galleryEnabled: false, galleryPhotos: [] };
  state.people.push(person);
  state.groupOrderByPerson[person.id] = state.groups.map((g) => g.id);
  await saveState();
  return person;
}

async function updatePersonPhoto(personId, field, file) {
  const photoUrlValue = await readFileAsDataURL(file);
  const person = findPersonById(personId);
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
  const categoryIds = getCategoriesByGroupId(groupId).map((category) => category.id);
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
  const category = findCategoryById(categoryId);
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
function moveItemToFront(item) {
  const siblings = getItemsByPersonCategory(item.personId, item.categoryId)
    .filter((entry) => entry.id !== item.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  item.order = 0;
  siblings.forEach((sib, i) => { sib.order = i + 1; });
}

async function createItem(itemData) {
  const personExists = state.people.some((person) => person.id === itemData.personId);
  const groupExists = state.groups.some((group) => group.id === itemData.groupId);
  const category = findCategoryById(itemData.categoryId);
  if (!personExists || !groupExists || !category || category.groupId !== itemData.groupId) {
    throw new Error('Invalid item references');
  }

  const item = {
    id: crypto.randomUUID(),
    personId: itemData.personId,
    categoryId: itemData.categoryId,
    label: itemData.label,
    quantity: itemData.quantity,
    unit: itemData.unit,
    date: itemData.date || '1998-03-25',
    isGift: itemData.isGift,
    isOwnedNow: itemData.isOwnedNow,
    photoUrls: itemData.photoUrls || [],
    order: 0,
  };
  state.items.push(item);
  moveItemToFront(item);
  await saveState();
  return item;
}

async function deleteItem(itemId) {
  state.items = state.items.filter((item) => item.id !== itemId);
  await saveState();
}

async function updateItemPhotos(itemId, photoUrls) {
  const item = findItemById(itemId);
  if (item) {
    item.photoUrls = photoUrls;
  }
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
    order = getCategoriesByGroupId(groupId).map((category) => category.id);
    state.categoryOrderByPerson[personId][groupId] = order;
    saveState(); // fire-and-forget
  }
}

async function syncMissingGroupOrders() {
  const changed = normalizeState();
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
  const draggedItem = findItemById(draggedItemId);
  const targetItem = findItemById(targetItemId);
  if (!draggedItem || !targetItem) return;
  if (draggedItem.personId !== targetItem.personId || draggedItem.categoryId !== targetItem.categoryId) return;
  if (itemHasPhotos(draggedItem) !== itemHasPhotos(targetItem)) return;
  if ((draggedItem.date || '1998-03-25') !== (targetItem.date || '1998-03-25')) return;

  const sameTypeItems = getItemsByPersonCategory(draggedItem.personId, draggedItem.categoryId)
    .filter(
      (i) =>
        itemHasPhotos(i) === itemHasPhotos(draggedItem) &&
        (i.date || '1998-03-25') === (draggedItem.date || '1998-03-25')
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

function reorderGalleryPhotosByDrag(personId, draggedIndexValue, targetIndexValue) {
  const person = findPersonById(personId);
  const draggedIndex = Number(draggedIndexValue);
  const targetIndex = Number(targetIndexValue);
  if (!person || !Array.isArray(person.galleryPhotos)) return;
  if (!Number.isInteger(draggedIndex) || !Number.isInteger(targetIndex)) return;
  if (draggedIndex === targetIndex) return;
  if (draggedIndex < 0 || targetIndex < 0) return;
  if (draggedIndex >= person.galleryPhotos.length || targetIndex >= person.galleryPhotos.length) return;

  const nextPhotos = [...person.galleryPhotos];
  const [moved] = nextPhotos.splice(draggedIndex, 1);
  nextPhotos.splice(targetIndex, 0, moved);
  person.galleryPhotos = nextPhotos;

  saveState(); // fire-and-forget
  renderGallery(person);
  setupRailMasks();
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
    if (!isMacDevice) return;
    // ── Mac 桌面端：HTML5 拖拽 ──
    element.draggable = true;
    element.addEventListener('dragstart', (event) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
      element.classList.add('dragging');
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
      if (!draggedId || draggedId === id) return;
      onDrop(draggedId, id, element, event);
    });
  };
}

const attachItemDrag = createDragHandler({
  dragOverClass: 'rail-card',
  onDrop: (draggedId, targetId) => reorderItemsByDrag(draggedId, targetId),
});

const attachOverviewGroupDrag = createDragHandler({
  dragOverClass: 'overview-group-card',
  onDrop: (draggedId, targetId, targetEl) => {
    const personId = targetEl.dataset.personId || viewState.overviewPersonId;
    if (personId) reorderGroupsByDrag(personId, draggedId, targetId);
  },
});

const attachOverviewCategoryDrag = createDragHandler({
  dragOverClass: 'overview-category-row',
  onDrop: (draggedId, targetId, targetEl) => {
    const personId = targetEl.dataset.personId || viewState.overviewPersonId;
    const groupId = targetEl.dataset.groupId;
    if (personId && groupId) reorderCategoriesByDrag(personId, groupId, draggedId, targetId);
  },
});

// ═══════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════
function updateNavHeight() {
  var hasAthletes = state.people.length > 0;
  document.body.style.setProperty('--ios-nav-height', hasAthletes ? '120px' : '66px');
}

function renderAll() {
  closeItemActionsModal();
  closePhotoManageModal();
  if (!elements.cropModal.hidden) closeCropModal(createCropResult('cancel'));
  syncFormOptions();
  renderSwitcher();
  renderCurrentView();
  updateNavHeight();
}

function renderCurrentView() {
  elements.homeView.hidden = viewState.currentView !== 'home';
  elements.athleteView.hidden = viewState.currentView !== 'athlete';
  elements.addView.hidden = viewState.currentView !== 'add';
  elements.settingsView.hidden = viewState.currentView !== 'settings';

  if (viewState.currentView === 'home') renderHomeView();
  if (viewState.currentView === 'athlete') renderAthleteView();
  if (viewState.currentView === 'settings') { renderCategoryOverview(); syncGallerySettings(); }

}

function showView(view, selectedPersonId) {
  viewState.currentView = view;
  if (selectedPersonId !== undefined) viewState.selectedPersonId = selectedPersonId;
  renderAll();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showHomeView() { showView('home'); }
function showAddView() { showView('add'); }
function showAthleteView(personId) { showView('athlete', personId); }
function showSettingsView() { showView('settings'); }

function renderSwitcher() {
  elements.switcherScrollArea.innerHTML = '';
  const overflow = state.people.length > 3;
  elements.athleteSwitcher.classList.toggle('scrollable', overflow);
  for (const person of state.people) {
    const fragment = elements.templates.switcherChip.content.cloneNode(true);
    const button = fragment.querySelector('.switcher-chip');
    button.textContent = person.name;
    button.setAttribute('aria-label', `查看${person.name}的图库`);
    const active = person.id === viewState.selectedPersonId;
    button.classList.toggle('active', active);
    button.addEventListener('click', () => showAthleteView(person.id));
    elements.switcherScrollArea.append(fragment);
  }
}

function syncSelectOptions(select, records, emptyLabel, preferredValue = select.value) {
  const hasRecords = records.length > 0;
  select.innerHTML = hasRecords
    ? records.map((record) => `<option value="${record.id}">${escapeHtml(record.name)}</option>`).join('')
    : `<option value="">${escapeHtml(emptyLabel)}</option>`;
  select.disabled = !hasRecords;
  if (!hasRecords) return null;

  const selectedValue = records.some((record) => record.id === preferredValue) ? preferredValue : records[0].id;
  select.value = selectedValue;
  return selectedValue;
}

function syncFormOptions() {
  syncSelectOptions(elements.itemPersonSelect, state.people, '请先添加体育生');

  syncGroupOptions();

  viewState.settingsActivePersonId = syncSelectOptions(
    elements.settingsPersonSelect,
    state.people,
    '请先添加体育生',
    viewState.settingsActivePersonId
  );
  elements.settingsDeletePersonBtn.hidden = state.people.length === 0;

  viewState.overviewPersonId = syncSelectOptions(
    elements.overviewPersonSelect,
    state.people,
    '请先添加体育生',
    viewState.overviewPersonId
  );
}

function syncGallerySettings() {
  if (viewState.currentView !== 'settings') return;
  const personId = viewState.settingsActivePersonId;
  const person = findPersonById(personId);

  if (!person) {
    elements.gallerySettingsBlock.hidden = true;
    return;
  }

  elements.gallerySettingsBlock.hidden = false;

  const enabled = person.galleryEnabled === true;
  elements.galleryToggleBtn.classList.toggle('active', enabled);
  elements.galleryToggleBtn.setAttribute('aria-checked', String(enabled));

  const count = (person.galleryPhotos || []).length;
  elements.galleryPhotoCount.textContent = count > 0 ? `${count} 张图片` : '暂无图片';
}

function syncGroupOptions() {
  const activePersonForGroups = elements.itemPersonSelect.value || state.people[0]?.id || null;
  const nextGroups = getOrderedGroupsForPerson(activePersonForGroups);

  syncSelectOptions(elements.categoryGroupSelect, nextGroups, '请先添加大品类');
  const itemGroupId = syncSelectOptions(elements.itemGroupSelect, nextGroups, '请先添加大品类');
  syncCategoryOptions(itemGroupId);
}

function syncCategoryOptions(groupId) {
  const personId = elements.itemPersonSelect.value || state.people[0]?.id || null;
  const categories = getOrderedCategoriesForPersonGroup(personId, groupId);
  syncSelectOptions(elements.itemCategorySelect, categories, '当前大品类暂无小品类');
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
  const person = findPersonById(viewState.selectedPersonId);
  elements.athleteDetailHero.innerHTML = '';
  elements.athleteGallery.innerHTML = '';
  elements.athleteGroupedContent.innerHTML = '';
  if (!person) {
    viewState.currentView = 'home';
    viewState.selectedPersonId = state.people[0]?.id ?? null;
    renderSwitcher();
    renderCurrentView();
    return;
  }

  const heroFragment = elements.templates.detailHero.content.cloneNode(true);
  const heroImage = heroFragment.querySelector('.detail-hero-image');
  const heroName = heroFragment.querySelector('.detail-hero-name');
  heroName.textContent = person.name;
  if (person.detailPhotoUrl) heroImage.src = person.detailPhotoUrl;
  elements.athleteDetailHero.append(heroFragment);

  renderGallery(person);

  const groupsWithContent = getOrderedGroupsForPerson(person.id).filter((g) => hasGroupContent(person.id, g.id));
  for (const group of groupsWithContent) {
    elements.athleteGroupedContent.append(renderGroupSection(person.id, group));
  }
  setupRailMasks();
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
    card.dataset.personId = personId;
    card.dataset.groupId = group.id;
    const categories = getOrderedCategoriesForPersonGroup(personId, group.id);
    const isCollapsed = Boolean(state.collapsedSettingsGroups[group.id]);

    title.textContent = group.name;
    meta.textContent = categories.length ? `${categories.length} 个小品类` : '暂无小品类';
    if (isCollapsed) card.classList.add('collapsed');
    attachOverviewGroupDrag(card, group.id);

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
      row.dataset.personId = personId;
      row.dataset.groupId = group.id;
      row.dataset.categoryId = category.id;
      name.textContent = category.name;
      attachOverviewCategoryDrag(row, category.id);
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
  const category = findCategoryById(categoryId);
  if (!category) return;
  await confirmAndDelete(`确认删除小品类"${category.name}"及其关联的所有 YW 吗？`, () => deleteCategory(categoryId), '小品类已删除');
}

function renderGroupSection(personId, group) {
  const categoriesInGroup = getOrderedCategoriesForPersonGroup(personId, group.id).filter((c) =>
    getItemsByPersonCategory(personId, c.id).length > 0
  );
  const fragment = elements.templates.categorySection.content.cloneNode(true);
  const title = fragment.querySelector('.category-section-title');
  const subSections = fragment.querySelector('.subcategory-sections');
  title.textContent = group.name;

  for (const category of categoriesInGroup) {
    const categoryItems = getItemsByPersonCategory(personId, category.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.order ?? 0) - (b.order ?? 0));

    const subFragment = elements.templates.subcategory.content.cloneNode(true);
    const block = subFragment.querySelector('.subcategory-block');
    const titleNode = subFragment.querySelector('.subcategory-title');
    const countsNode = subFragment.querySelector('.subcategory-counts');
    const imageRail = subFragment.querySelector('.image-items-rail');
    const textRail = subFragment.querySelector('.text-items-rail');
    const toggle = subFragment.querySelector('[data-subcategory-toggle]');

    const collapseKey = `${personId}:${category.id}`;
    block.dataset.personId = personId;
    block.dataset.categoryId = category.id;
    if (state.collapsedSubcategories[collapseKey]) block.classList.add('collapsed');
    titleNode.textContent = category.name;
    countsNode.textContent = formatCategoryCounts(categoryItems);
    toggle.addEventListener('click', () => {
      toggleCollapsedState(collapseKey, state.collapsedSubcategories);
      block.classList.toggle('collapsed');
    });

    const { imageItems, textItems } = splitItemsByPhotos(categoryItems);

    for (const item of imageItems) appendImageItemCard(imageRail, item);
    for (const item of textItems) appendTextItemCard(textRail, item);

    if (!imageRail.childElementCount) imageRail.parentElement.hidden = true;
    if (!textRail.childElementCount) textRail.parentElement.hidden = true;
    subSections.append(subFragment);
  }
  return fragment;
}

function renderGallery(person) {
  const savedScrollY = window.scrollY;
  const oldRail = elements.athleteGallery.querySelector('.gallery-rail');
  const savedRailScrollLeft = oldRail ? oldRail.scrollLeft : 0;
  elements.athleteGallery.innerHTML = '';

  if (!person.galleryEnabled || !person.galleryPhotos || person.galleryPhotos.length === 0) {
    elements.athleteGallery.hidden = true;
    return;
  }

  elements.athleteGallery.hidden = false;

  const heading = document.createElement('div');
  heading.className = 'gallery-heading';
  const title = document.createElement('h2');
  title.className = 'gallery-title';
  title.textContent = '画廊';
  const counts = document.createElement('p');
  counts.className = 'gallery-counts';
  counts.textContent = `${person.galleryPhotos.length} 张`;
  heading.append(title, counts);
  elements.athleteGallery.append(heading);

  const railBlock = document.createElement('div');
  railBlock.className = 'rail-block';
  const railList = document.createElement('div');
  railList.className = 'rail-list gallery-rail';

  const attachGalleryDrag = createDragHandler({
    dragOverClass: 'gallery-card',
    onDrop: (draggedIndex, targetIndex) => reorderGalleryPhotosByDrag(person.id, draggedIndex, targetIndex),
  });

  for (let i = 0; i < person.galleryPhotos.length; i++) {
    const photoUrl = person.galleryPhotos[i];
    const frag = elements.templates.galleryCard.content.cloneNode(true);
    const card = frag.querySelector('.gallery-card');
    const image = frag.querySelector('.gallery-card-image');
    image.src = photoUrl;
    card.dataset.galleryIndex = String(i);
    attachGalleryDrag(card, String(i));
    railList.append(frag);
  }

  railBlock.append(railList);
  elements.athleteGallery.append(railBlock);

  if (savedRailScrollLeft > 0) {
    railList.scrollLeft = Math.min(savedRailScrollLeft, railList.scrollWidth - railList.clientWidth);
  }

  requestAnimationFrame(() => {
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
  });
}

function hydrateItemCard(card, item, type, { titleSelector, dateSelector, statusSelector }) {
  const title = card.querySelector(titleSelector);
  const dateEl = card.querySelector(dateSelector);
  const statusEl = card.querySelector(statusSelector);
  const menuToggle = card.querySelector('[data-item-menu-toggle]');

  title.textContent = formatItemLabel(item);
  if (statusEl) statusEl.textContent = formatItemStatus(item);
  dateEl.textContent = formatDate(item.date) || '98/3/25';
  menuToggle.addEventListener('click', () => openItemActionsModal(item.id, type));
  card.dataset.itemId = item.id;
  attachItemDrag(card, item.id);
}

function buildImageItemCard(item) {
  const fragment = elements.templates.ywCard.content.cloneNode(true);
  const card = fragment.querySelector('.rail-card');
  const image = fragment.querySelector('.yw-card-image');
  const imageWrap = fragment.querySelector('.yw-card-image-wrap');

  hydrateItemCard(card, item, 'image', { titleSelector: '.yw-title', dateSelector: '.yw-date', statusSelector: '.yw-status' });

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
  return card;
}

function appendImageItemCard(container, item) {
  container.append(buildImageItemCard(item));
}

function buildTextItemCard(item) {
  const fragment = elements.templates.textItem.content.cloneNode(true);
  const card = fragment.querySelector('.rail-card');

  hydrateItemCard(card, item, 'text', { titleSelector: '.text-item-title', dateSelector: '.text-item-date', statusSelector: '.text-item-status' });
  return card;
}

function appendTextItemCard(container, item) {
  container.append(buildTextItemCard(item));
}

function findItemCard(itemId) {
  return Array.from(document.querySelectorAll('.rail-card[data-item-id]')).find((card) => card.dataset.itemId === itemId) || null;
}

function getRenderedSubcategoryBlock(personId, categoryId) {
  return Array.from(document.querySelectorAll('.subcategory-block[data-person-id][data-category-id]')).find((block) =>
    block.dataset.personId === personId && block.dataset.categoryId === categoryId
  ) || null;
}

function updateRailVisibility(block) {
  const imageRail = block.querySelector('.image-items-rail');
  const textRail = block.querySelector('.text-items-rail');
  if (imageRail?.parentElement) imageRail.parentElement.hidden = imageRail.childElementCount === 0;
  if (textRail?.parentElement) textRail.parentElement.hidden = textRail.childElementCount === 0;
}

function refreshCategoryCounts(personId, categoryId) {
  const block = getRenderedSubcategoryBlock(personId, categoryId);
  if (!block) return;
  const categoryItems = getItemsByPersonCategory(personId, categoryId);
  const countsNode = block.querySelector('.subcategory-counts');
  if (!countsNode) return;
  countsNode.textContent = formatCategoryCounts(categoryItems);
}

function removeEmptyRenderedSubcategory(personId, categoryId) {
  if (state.items.some((item) => item.personId === personId && item.categoryId === categoryId)) return false;
  const block = getRenderedSubcategoryBlock(personId, categoryId);
  if (!block) return false;
  const section = block.closest('.category-section');
  block.remove();
  if (section && !section.querySelector('.subcategory-block')) section.remove();
  return true;
}

function refreshItemCard(itemId) {
  const item = findItemById(itemId);
  if (!item) return;
  const block = getRenderedSubcategoryBlock(item.personId, item.categoryId);
  if (!block) return;

  const targetRail = itemHasPhotos(item)
    ? block.querySelector('.image-items-rail')
    : block.querySelector('.text-items-rail');
  if (!targetRail) return;

  const currentCard = findItemCard(itemId);
  const nextCard = itemHasPhotos(item) ? buildImageItemCard(item) : buildTextItemCard(item);
  if (currentCard) currentCard.replaceWith(nextCard);
  insertCardSorted(targetRail, nextCard, item);

  refreshCategoryCounts(item.personId, item.categoryId);
  updateRailVisibility(block);
  setupRailMasks();
}

function insertCardSorted(rail, card, item) {
  const existingCards = Array.from(rail.querySelectorAll('.rail-card[data-item-id]'));
  const otherCards = existingCards.filter((c) => c.dataset.itemId !== item.id);

  let insertBeforeCard = null;
  for (const otherCard of otherCards) {
    const otherItem = findItemById(otherCard.dataset.itemId);
    if (!otherItem) continue;
    const dateCmp = (otherItem.date || '').localeCompare(item.date || '');
    if (dateCmp > 0) continue;
    if (dateCmp < 0) { insertBeforeCard = otherCard; break; }
    if ((otherItem.order ?? 0) > (item.order ?? 0)) { insertBeforeCard = otherCard; break; }
  }

  if (insertBeforeCard) {
    rail.insertBefore(card, insertBeforeCard);
  } else {
    rail.appendChild(card);
  }
}

function removeItemCard(itemId, removedItem) {
  const card = findItemCard(itemId);
  if (card) card.remove();
  if (!removedItem) return;
  if (removeEmptyRenderedSubcategory(removedItem.personId, removedItem.categoryId)) {
    setupRailMasks();
    return;
  }
  const block = getRenderedSubcategoryBlock(removedItem.personId, removedItem.categoryId);
  if (!block) return;
  refreshCategoryCounts(removedItem.personId, removedItem.categoryId);
  updateRailVisibility(block);
  setupRailMasks();
}

// ═══════════════════════════════════════════════
// Item actions modal
// ═══════════════════════════════════════════════
function openItemActionsModal(itemId, type) {
  activeItemAction = { itemId, type };
  elements.itemActionsModal.hidden = false;

  const item = findItemById(itemId);

  for (const toggle of elements.itemStatusToggles) {
    const key = toggle.dataset.statusToggle;
    const value = item?.[key] ?? false;
    toggle.classList.toggle('active', value);
    toggle.setAttribute('aria-checked', String(value));
    toggle.onclick = async () => {
      const active = toggle.classList.toggle('active');
      toggle.setAttribute('aria-checked', String(active));
      const currentItem = findItemById(itemId);
      if (currentItem) {
        currentItem[key] = active;
        await saveState();
        const card = document.querySelector(`[data-item-id="${itemId}"]`);
        if (card) {
          const title = card.querySelector('.yw-title, .text-item-title');
          if (title) title.textContent = formatItemLabel(currentItem);
          const statusEl = card.querySelector('.yw-status, .text-item-status');
          if (statusEl) statusEl.textContent = formatItemStatus(currentItem);
        }
        refreshCategoryCounts(currentItem.personId, currentItem.categoryId);
      }
    };
  }

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
  for (const toggle of elements.itemStatusToggles) {
    toggle.onclick = null;
  }
  activeItemAction = null;
}

function closePhotoManageModal() {
  const modal = document.getElementById('photoManageModal');
  const thumbGrid = document.getElementById('photoThumbGrid');
  const fileInput = document.getElementById('modalPhotoInput');
  const addBtn = document.getElementById('modalPhotoAddBtn');
  const deleteBtn = document.getElementById('modalPhotoDeleteBtn');
  if (!modal.hidden) {
    modal.hidden = true;
    modal.onclick = null;
    thumbGrid.classList.remove('gallery-thumb-grid');
    fileInput.onchange = null;
    addBtn.onclick = null;
    deleteBtn.onclick = null;
    photoManageState = { itemId: null, mode: null, replaceIndex: null };
  }
}

async function handleDeleteItem(itemId) {
  const item = findItemById(itemId);
  if (!item) return;
  const removedItem = { personId: item.personId, categoryId: item.categoryId };
  const confirmed = await showModal(`确认删除 YW"${item.label}"吗？`, { showCancel: true });
  if (!confirmed) return;
  await deleteItem(itemId);
  removeItemCard(itemId, removedItem);
  await showModal('YW 已删除');
}

function openPhotoCollectionManager(config) {
  const modal = document.getElementById('photoManageModal');
  const thumbGrid = document.getElementById('photoThumbGrid');
  const addBtn = document.getElementById('modalPhotoAddBtn');
  const deleteBtn = document.getElementById('modalPhotoDeleteBtn');
  const fileInput = document.getElementById('modalPhotoInput');
  fileInput.value = '';
  thumbGrid.classList.toggle('gallery-thumb-grid', Boolean(config.galleryGrid));
  modal.hidden = false;
  photoManageState = { itemId: config.itemId || null, mode: null, replaceIndex: null, galleryPersonId: config.galleryPersonId || null };

  const getRecord = () => config.getRecord();
  const getPhotos = () => config.getPhotos(getRecord()) || [];
  const setPhotos = async (photos) => {
    const record = getRecord();
    if (!record) return false;
    await config.setPhotos(record, photos);
    if (config.afterPhotosChange) config.afterPhotosChange(record);
    return true;
  };

  const applyPhotos = async (photoUrls) => {
    if (!photoUrls.length) return false;
    const current = [...getPhotos()];
    if (photoManageState.mode === 'replace') {
      current[photoManageState.replaceIndex] = photoUrls[0];
      return setPhotos(current);
    }
    return setPhotos([...current, ...photoUrls]);
  };

  const renderThumbGrid = () => {
    thumbGrid.innerHTML = '';
    const photos = getPhotos();
    deleteBtn.hidden = photos.length === 0;
    if (photos.length === 0) {
      thumbGrid.style.display = 'none';
      return;
    }
    thumbGrid.style.display = '';
    for (let i = 0; i < photos.length; i++) {
      const frag = elements.templates.photoThumb.content.cloneNode(true);
      const thumbImg = frag.querySelector('.photo-thumb-img');
      const replaceBtn = frag.querySelector('.photo-thumb-replace');
      thumbImg.src = photos[i];
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
    thumbGrid.classList.remove('gallery-thumb-grid');
    fileInput.onchange = null;
    addBtn.onclick = null;
    deleteBtn.onclick = null;
    photoManageState = { itemId: null, mode: null, replaceIndex: null };
    if (config.onClose) config.onClose();
  };

  modal.onclick = (e) => { if (e.target === modal) cleanup(); };

  const handleFiles = async (files) => {
    modal.hidden = true;
    if (!files.length) { modal.hidden = false; return; }
    if (!getRecord()) { modal.hidden = false; return; }
    const photoUrls = [];
    for (const file of files) {
      const cropResult = await showCropModal(file, config.aspectRatio);
      const finalFile = resolveCroppedFile(file, cropResult);
      if (!finalFile) {
        if (cropResult?.type === 'error') {
          renderThumbGrid();
          modal.hidden = false;
          return;
        }
        if (photoUrls.length) {
          await applyPhotos(photoUrls);
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

    await applyPhotos(photoUrls);
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
    if (!getRecord() || !getPhotos().length) {
      modal.hidden = true;
      await showModal(config.emptyDeleteMessage);
      modal.hidden = false;
      return;
    }
    modal.hidden = true;
    const confirmed = await showModal(config.confirmDeleteMessage, { showCancel: true });
    if (!confirmed) { modal.hidden = false; return; }
    await setPhotos([]);
    await showModal(config.deleteSuccessMessage);
    renderThumbGrid();
    modal.hidden = false;
  };

  renderThumbGrid();
}

function openPhotoManageModal(itemId) {
  openPhotoCollectionManager({
    itemId,
    aspectRatio: 1,
    emptyDeleteMessage: '当前 YW 没有图片可删除',
    confirmDeleteMessage: '确认删除所有图片吗？',
    deleteSuccessMessage: '图片已删除',
    getRecord: () => findItemById(itemId),
    getPhotos: (item) => item?.photoUrls || [],
    setPhotos: async (item, photos) => {
      await updateItemPhotos(item.id, photos);
    },
    afterPhotosChange: (item) => {
      refreshItemCard(item.id);
    },
  });
}

function openGalleryManageModal(personId) {
  openPhotoCollectionManager({
    galleryPersonId: personId,
    galleryGrid: true,
    aspectRatio: 4 / 5,
    emptyDeleteMessage: '当前画廊没有图片可删除',
    confirmDeleteMessage: '确认删除所有画廊图片吗？',
    deleteSuccessMessage: '画廊图片已删除',
    getRecord: () => findPersonById(personId),
    getPhotos: (person) => person?.galleryPhotos || [],
    setPhotos: async (person, photos) => {
      person.galleryPhotos = photos;
      await saveState();
    },
    afterPhotosChange: (person) => {
      renderGallery(person);
      setupRailMasks();
      syncGallerySettings();
    },
    onClose: syncGallerySettings,
  });
}

// ═══════════════════════════════════════════════
// Crop modal
// ═══════════════════════════════════════════════
let cropResolve = null;
let cropState = { file: null, aspectRatio: 1, imgNaturalW: 0, imgNaturalH: 0, imgX: 0, imgY: 0, imgW: 0, imgH: 0, cx: 0, cy: 0, cw: 0, ch: 0, containerW: 0, containerH: 0 };
let cropDrag = { active: false, mode: null, handle: null, startX: 0, startY: 0, snapCX: 0, snapCY: 0, snapCW: 0, snapCH: 0 };

function failCropRead() {
  closeCropModal(createCropResult('error'));
  showModal('图片无法读取，请更换图片');
}

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
    reader.onerror = failCropRead;
    reader.onload = function (e) {
      elements.cropImage.onerror = failCropRead;
      elements.cropImage.onload = function () {
        requestAnimationFrame(function () { initCropLayout(); renderCropOverlay(); });
      };
      elements.cropImage.src = e.target.result;
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
  if (!ctx || sw <= 0 || sh <= 0) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.drawImage(img, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, canvasW, canvasH);
  return new Promise((resolve) => { canvas.toBlob(resolve, 'image/jpeg', 0.92); });
}

function prepareCropModalClose() {
  elements.cropModal.hidden = true;
  endCropDrag();
  elements.cropImage.onload = null;
  elements.cropImage.onerror = null;
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
    let blob;
    try {
      blob = await performCrop();
    } catch (err) {
      console.error(err);
      failCropRead();
      return;
    }
    if (!blob) {
      failCropRead();
      return;
    }
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

function bindSettingsPhotoInput(input, { field, aspectRatio, successMsg, errorMsg }) {
  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file || !viewState.settingsActivePersonId) return;
    const finalFile = await cropFile(file, aspectRatio);
    if (!finalFile) { event.target.value = ''; return; }
    try {
      await updatePersonPhoto(viewState.settingsActivePersonId, field, finalFile);
      renderAll();
      await showModal(successMsg);
    } catch (err) {
      console.error(err);
      await showModal(errorMsg);
    } finally {
      event.target.value = '';
    }
  });
}

function formText(formData, key) {
  return String(formData.get(key) ?? '').trim();
}

function hasDuplicateName(records, name, matchesScope = () => true) {
  const normalized = normalizeName(name);
  return records.some((record) => matchesScope(record) && normalizeName(record.name) === normalized);
}

function resetPersonFormAfterSave(person) {
  elements.personForm.querySelector('input[name="name"]').value = '';
  elements.personHomePhotoInput.value = '';
  elements.personDetailPhotoInput.value = '';
  syncFileSummaries();
  viewState.settingsActivePersonId = person.id;
  viewState.overviewPersonId = person.id;
  if (!viewState.selectedPersonId) viewState.selectedPersonId = person.id;
}

async function handlePersonFormSubmit() {
  const formData = new FormData(elements.personForm);
  const name = formText(formData, 'name');
  if (!name) { await showModal('请填写体育生姓名'); return; }
  if (hasDuplicateName(state.people, name)) {
    await showModal('体育生姓名已存在，请勿重复添加'); return;
  }
  const confirmed = await showModal('确认保存新体育生吗？', { showCancel: true });
  if (!confirmed) return;

  const person = await createPerson(name, formData.get('homePhoto'), formData.get('detailPhoto'));
  resetPersonFormAfterSave(person);
  renderAll();
  await showModal(`体育生已保存：${person.name}`);
}

async function handleGroupFormSubmit() {
  const formData = new FormData(elements.groupForm);
  const name = formText(formData, 'name');
  if (!name) { await showModal('请填写大品类名称'); return; }
  if (hasDuplicateName(state.groups, name)) {
    await showModal('大品类名称已存在，请勿重复添加'); return;
  }
  await createGroup(name);
  elements.groupForm.reset();
  renderAll();
  await showModal(`大品类已保存：${name}`);
}

async function handleCategoryFormSubmit() {
  const formData = new FormData(elements.categoryForm);
  const groupId = formText(formData, 'groupId');
  const name = formText(formData, 'name');
  if (!groupId || !name) { await showModal('请填写完整的小品类信息'); return; }
  if (hasDuplicateName(state.categories, name, (category) => category.groupId === groupId)) {
    await showModal('该大品类下的小品类名称已存在，请勿重复添加'); return;
  }
  await createCategory(groupId, name);
  elements.categoryForm.reset();
  elements.categoryGroupSelect.value = groupId;
  elements.itemGroupSelect.value = groupId;
  syncCategoryOptions(groupId);
  renderAll();
  await showModal(`小品类已保存：${name}`);
}

function getItemFormData() {
  const formData = new FormData(elements.itemForm);
  const quantityRaw = formText(formData, 'quantity');
  return {
    personId: formText(formData, 'personId'),
    groupId: formText(formData, 'groupId'),
    categoryId: formText(formData, 'categoryId'),
    label: formText(formData, 'label'),
    quantityRaw,
    quantity: Number(quantityRaw),
    unit: formText(formData, 'unit'),
    date: formText(formData, 'date') || '1998-03-25',
    isGift: formData.has('isGift'),
    isOwnedNow: formData.has('isOwnedNow'),
    rawFiles: formData.getAll('photos').filter((file) => file instanceof File && file.size > 0),
  };
}

async function validateItemFormData(itemData) {
  const categoryOptions = getOrderedCategoriesForPersonGroup(itemData.personId, itemData.groupId);
  if (!itemData.personId || !itemData.groupId || !itemData.label || !itemData.quantityRaw || !itemData.unit) {
    await showModal('请把 YW 信息填写完整');
    return false;
  }
  if (!categoryOptions.length) {
    await showModal('请先为当前大品类添加小品类');
    return false;
  }
  if (!categoryOptions.some((category) => category.id === itemData.categoryId)) {
    await showModal('请选择有效的小品类');
    return false;
  }
  if (!Number.isInteger(itemData.quantity) || itemData.quantity < 1) {
    await showModal('数量必须是大于 0 的整数');
    return false;
  }
  if (!isValidDateString(itemData.date)) {
    await showModal('日期格式错误，请重新选择日期');
    return false;
  }
  return true;
}

function resetItemFormAfterSave({ personId, groupId, categoryId }) {
  elements.itemForm.reset();
  elements.itemOwnedNowInput.checked = true;
  elements.itemGiftInput.checked = false;
  syncDateDisplay('1998-03-25');
  elements.itemPhotosInput.value = '';
  elements.itemPersonSelect.value = personId;
  elements.itemGroupSelect.value = groupId;
  syncCategoryOptions(groupId);
  elements.itemCategorySelect.value = categoryId;
  syncFileSummaries();
}

async function handleItemFormSubmit() {
  const itemData = getItemFormData();
  if (!(await validateItemFormData(itemData))) return;

  const photoUrls = await readFilesAsDataURLs(itemData.rawFiles);
  const { rawFiles, quantityRaw, ...payload } = itemData;
  await createItem({ ...payload, photoUrls });

  resetItemFormAfterSave(itemData);
  renderAll();
  await showModal(`YW 已成功保存：${itemData.label}`);
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
    await cropInputFiles(event.target, { aspectRatio: 1, multiple: true });
  });
  elements.personHomePhotoInput.addEventListener('change', async (event) => {
    await cropInputFiles(event.target, { aspectRatio: 4 / 5 });
  });
  elements.personDetailPhotoInput.addEventListener('change', async (event) => {
    await cropInputFiles(event.target, { aspectRatio: 1 });
  });

  elements.settingsPersonSelect.addEventListener('change', (event) => {
    viewState.settingsActivePersonId = event.target.value;
    syncGallerySettings();
  });
  elements.overviewPersonSelect.addEventListener('change', (event) => {
    viewState.overviewPersonId = event.target.value;
    renderCategoryOverview();
  });

  bindSettingsPhotoInput(elements.settingsPersonHomePhotoInput, {
    field: 'homePhotoUrl',
    aspectRatio: 4 / 5,
    successMsg: '主页图片已更新',
    errorMsg: '主页图片更新失败，请重试',
  });
  bindSettingsPhotoInput(elements.settingsPersonDetailPhotoInput, {
    field: 'detailPhotoUrl',
    aspectRatio: 1,
    successMsg: '个人页图片已更新',
    errorMsg: '个人页图片更新失败，请重试',
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

  // Gallery settings
  elements.galleryToggleBtn.addEventListener('click', async () => {
    const personId = viewState.settingsActivePersonId;
    if (!personId) return;
    const person = findPersonById(personId);
    if (!person) return;
    person.galleryEnabled = !person.galleryEnabled;
    await saveState();
    syncGallerySettings();
    await showModal(person.galleryEnabled ? '画廊已启用' : '画廊已关闭');
  });

  elements.galleryManageBtn.addEventListener('click', () => {
    const personId = viewState.settingsActivePersonId;
    if (!personId) return;
    const person = findPersonById(personId);
    if (!person) return;
    if (!person.galleryEnabled) {
      person.galleryEnabled = true;
      saveState();
      syncGallerySettings();
    }
    openGalleryManageModal(personId);
  });

  elements.itemPersonSelect.addEventListener('change', () => syncGroupOptions());
  elements.itemGroupSelect.addEventListener('change', () => {
    syncCategoryOptions(elements.itemGroupSelect.value);
  });

  // Person form
  elements.personForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.personForm, 'person', handlePersonFormSubmit);
  });

  // Date picker
  elements.itemDateDisplay.addEventListener('click', function() {
    openDatePicker(elements.itemDateHidden.value);
  });

  elements.datePickerConfirmBtn.addEventListener('click', confirmDatePicker);
  elements.datePickerCancelBtn.addEventListener('click', cancelDatePicker);
  elements.datePickerModal.addEventListener('click', function(e) {
    if (e.target === elements.datePickerModal) cancelDatePicker();
  });

  elements.dateYearScroll.addEventListener('scroll', onColumnScroll, { passive: true });
  elements.dateMonthScroll.addEventListener('scroll', onColumnScroll, { passive: true });
  elements.dateDayScroll.addEventListener('scroll', onColumnScroll, { passive: true });

  // Group form
  elements.groupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.groupForm, 'group', handleGroupFormSubmit);
  });

  // Category form
  elements.categoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.categoryForm, 'category', handleCategoryFormSubmit);
  });

  // Item form
  elements.itemForm.addEventListener('submit', (event) => {
    event.preventDefault();
    withFormLock(elements.itemForm, 'item', handleItemFormSubmit);
  });

  // Prevent double-submit for forms
  const lockNames = new Map([
    [elements.groupForm, 'group'],
    [elements.categoryForm, 'category'],
    [elements.personForm, 'person'],
    [elements.itemForm, 'item'],
  ]);
  [elements.groupForm, elements.categoryForm, elements.personForm, elements.itemForm].forEach((form) => {
    form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && formLocks[lockNames.get(form)]) event.preventDefault();
    });
  });
}

async function handleDeleteCurrentPerson() {
  const personId = viewState.settingsActivePersonId;
  if (!personId) return;
  const person = findPersonById(personId);
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
async function cropFile(file, aspectRatio) {
  const cropResult = await showCropModal(file, aspectRatio);
  return resolveCroppedFile(file, cropResult);
}

async function cropInputFiles(input, { aspectRatio, multiple = false }) {
  const files = [...(input.files ?? [])].filter((file) => file.size > 0);
  if (!files.length) { syncFileSummaries(); return; }

  const cropped = [];
  for (const file of multiple ? files : files.slice(0, 1)) {
    const finalFile = await cropFile(file, aspectRatio);
    if (!finalFile) {
      if (cropped.length) setInputFiles(input, cropped);
      else input.value = '';
      syncFileSummaries();
      return;
    }
    cropped.push(finalFile);
  }

  setInputFiles(input, cropped);
  syncFileSummaries();
}

// ═══════════════════════════════════════════════
// 滚动边界模糊
// ═══════════════════════════════════════════════
function updateRailMask(rail) {
  var scrollLeft = rail.scrollLeft;
  var maxScroll = rail.scrollWidth - rail.clientWidth;
  var isPhone = matchMedia('(max-width: 768px)').matches;

  if (isPhone) {
    var atStart = scrollLeft <= 8;
    var atEnd = maxScroll <= 2 || scrollLeft >= maxScroll - 8;
    rail.style.setProperty('--rail-fade-l', atStart ? '0' : '1');
    rail.style.setProperty('--rail-fade-r', atEnd ? '0' : '1');
    return;
  }

  if (maxScroll <= 2) {
    rail.style.setProperty('--rail-mask-image', 'none');
    return;
  }

  var atStart = scrollLeft <= 8;
  var atEnd = scrollLeft >= maxScroll - 8;
  var fadeWidth = '32px';

  var maskImage;
  if (atStart && atEnd) {
    maskImage = 'none';
  } else if (atStart) {
    maskImage = 'linear-gradient(to right, black 0%, black calc(100% - ' + fadeWidth + '), transparent 100%)';
  } else if (atEnd) {
    maskImage = 'linear-gradient(to right, transparent 0%, black ' + fadeWidth + ', black 100%)';
  } else {
    maskImage = 'linear-gradient(to right, transparent 0%, black ' + fadeWidth + ', black calc(100% - ' + fadeWidth + '), transparent 100%)';
  }

  rail.style.setProperty('--rail-mask-image', maskImage);
}

var _railMaskResizeObserver = null;
var _railMaskPending = new WeakMap();

function scheduleRailMask(rail) {
  if (_railMaskPending.get(rail)) return;
  _railMaskPending.set(rail, true);
  requestAnimationFrame(function () {
    _railMaskPending.set(rail, false);
    updateRailMask(rail);
  });
}

function setupRailMasks() {
  if (!_railMaskResizeObserver) {
    _railMaskResizeObserver = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        scheduleRailMask(entries[i].target);
      }
    });
  }

  var rails = document.querySelectorAll('.rail-list');
  for (var i = 0; i < rails.length; i++) {
    var rail = rails[i];
    if (rail.dataset.railMaskSetup) {
      updateRailMask(rail);
      continue;
    }
    rail.dataset.railMaskSetup = '1';
    rail.addEventListener('scroll', function () {
      scheduleRailMask(this);
    }, { passive: true });
    _railMaskResizeObserver.observe(rail);
    updateRailMask(rail);
  }
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
  syncDateDisplay(elements.itemDateHidden.value);
  renderAll();
  syncFileSummaries();
}

cacheElements();
initApp().catch((err) => console.error('应用初始化失败:', err));

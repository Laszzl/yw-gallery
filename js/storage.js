(function (YW) {
  YW.storage = YW.storage || {};

  const { DB_NAME, DB_VERSION, DB_STORE, DB_KEY, STORAGE_KEY, SAVE_FAILURE_MESSAGE } = YW.config;

  function isFileProtocol() {
    return window.location.protocol === 'file:';
  }

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

  async function writeIndexedDBState(data) {
    try {
      const db = await openDB();
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(data, DB_KEY);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return { ok: true, storage: 'indexedDB', error: null };
    } catch (e) {
      return { ok: false, storage: 'indexedDB', error: e };
    }
  }

  function writeLocalStorageState(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true, storage: 'localStorage', error: null };
    } catch (e) {
      return { ok: false, storage: 'localStorage', error: e };
    }
  }

  async function saveFileProtocolState(data) {
    const localResult = writeLocalStorageState(data);
    if (!localResult.ok) {
      console.error('file:// localStorage 保存失败，数据未写入稳定本地路径:', localResult.error);
      return { ok: false, storage: null };
    }

    const indexedResult = await writeIndexedDBState(data);
    if (!indexedResult.ok) {
      console.warn('file:// IndexedDB 镜像保存失败，已保留 localStorage 数据:', indexedResult.error);
      return localResult;
    }
    return { ok: true, storage: 'localStorage+indexedDB' };
  }

  async function saveDefaultProtocolState(data) {
    const indexedResult = await writeIndexedDBState(data);
    if (indexedResult.ok) return indexedResult;

    console.error('IndexedDB 保存失败，回退到 localStorage:', indexedResult.error);
    const localResult = writeLocalStorageState(data);
    if (localResult.ok) return localResult;

    console.error('localStorage 保存失败:', localResult.error);
    return { ok: false, storage: null };
  }

  async function saveState() {
    const data = YW.state.serializeState();
    if (isFileProtocol()) {
      return saveFileProtocolState(data);
    }
    return saveDefaultProtocolState(data);
  }

  async function saveStateStrict() {
    const result = await saveState();
    if (!result || !result.ok) {
      throw new Error(SAVE_FAILURE_MESSAGE);
    }
    return result;
  }

  let scheduledSave = null;
  let needsSave = false;
  async function scheduleSave() {
    needsSave = true;
    if (scheduledSave) return scheduledSave;
    scheduledSave = Promise.resolve().then(async () => {
      try {
        while (needsSave) {
          needsSave = false;
          await saveStateStrict();
        }
      } catch (err) {
        needsSave = false;
        console.error(err);
        await YW.modals.showModal(SAVE_FAILURE_MESSAGE);
      } finally {
        scheduledSave = null;
      }
    });
    return scheduledSave;
  }

  function getStoredStateWeight(data) {
    return ['people', 'groups', 'categories', 'items'].reduce((total, key) => {
      return total + (Array.isArray(data?.[key]) ? data[key].length : 0);
    }, 0);
  }

  function createStoredStateSnapshot(source, data) {
    const validation = YW.state.validateImportedState(data);
    if (!validation.ok) return { source, ok: false, message: validation.message };
    return {
      source,
      ok: true,
      data: validation.data,
      weight: getStoredStateWeight(validation.data),
      fingerprint: JSON.stringify(validation.data),
    };
  }

  function chooseLoadSource(indexedDBSnapshot, localStorageSnapshot) {
    const indexed = indexedDBSnapshot?.ok ? indexedDBSnapshot : null;
    const local = localStorageSnapshot?.ok ? localStorageSnapshot : null;
    if (indexed && indexed.weight > 0) {
      if (local && local.fingerprint !== indexed.fingerprint) {
        return {
          snapshot: indexed,
          shouldMigrateLocal: false,
          shouldRemoveLocal: false,
          conflict: local.weight > 0 ? 'nonEmptyLocalStorage' : 'emptyLocalStorage',
        };
      }
      return { snapshot: indexed, shouldMigrateLocal: false, shouldRemoveLocal: false, conflict: null };
    }
    if (local && local.weight > 0) {
      return { snapshot: local, shouldMigrateLocal: true, shouldRemoveLocal: true, conflict: null };
    }
    if (indexed) {
      return { snapshot: indexed, shouldMigrateLocal: false, shouldRemoveLocal: false, conflict: null };
    }
    return { snapshot: null, shouldMigrateLocal: false, shouldRemoveLocal: false, conflict: null };
  }

  function chooseFileProtocolLoadSource(indexedDBSnapshot, localStorageSnapshot) {
    const indexed = indexedDBSnapshot?.ok ? indexedDBSnapshot : null;
    const local = localStorageSnapshot?.ok ? localStorageSnapshot : null;
    if (local && local.weight > 0) {
      return {
        snapshot: local,
        shouldMirrorLocal: false,
        conflict: indexed && indexed.fingerprint !== local.fingerprint
          ? (indexed.weight > 0 ? 'nonEmptyIndexedDB' : 'emptyIndexedDB')
          : null,
      };
    }
    if (indexed && indexed.weight > 0) {
      return { snapshot: indexed, shouldMirrorLocal: true, conflict: local ? 'emptyLocalStorage' : null };
    }
    if (local) {
      return { snapshot: local, shouldMirrorLocal: false, conflict: null };
    }
    if (indexed) {
      return { snapshot: indexed, shouldMirrorLocal: true, conflict: null };
    }
    return { snapshot: null, shouldMirrorLocal: false, conflict: null };
  }

  async function readIndexedDBSnapshot() {
    try {
      const db = await openDB();
      const tx = db.transaction(DB_STORE, 'readonly');
      const request = tx.objectStore(DB_STORE).get(DB_KEY);
      const data = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!data) return null;
      const snapshot = createStoredStateSnapshot('indexedDB', data);
      if (!snapshot.ok) {
        console.error('IndexedDB 数据格式错误，跳过加载:', snapshot.message);
        return null;
      }
      return snapshot;
    } catch (e) {
      console.error('IndexedDB 加载失败:', e);
      return null;
    }
  }

  function readLocalStorageSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const snapshot = createStoredStateSnapshot('localStorage', JSON.parse(raw));
      if (!snapshot.ok) {
        console.error('localStorage 数据格式错误，跳过迁移:', snapshot.message);
        return null;
      }
      return snapshot;
    } catch (e) {
      console.error('localStorage 迁移失败，保留原数据:', e);
      return null;
    }
  }

  async function loadState() {
    const indexedDBSnapshot = await readIndexedDBSnapshot();
    const localStorageSnapshot = readLocalStorageSnapshot();
    if (isFileProtocol()) {
      const decision = chooseFileProtocolLoadSource(indexedDBSnapshot, localStorageSnapshot);
      if (!decision.snapshot) return false;

      if (decision.conflict === 'nonEmptyIndexedDB') {
        console.warn('file:// 下 localStorage 与 IndexedDB 都存在不同数据，已优先加载 localStorage，并保留 IndexedDB 镜像。');
      } else if (decision.conflict === 'emptyIndexedDB') {
        console.warn('file:// 下 IndexedDB 存在空数据，已忽略并优先加载 localStorage。');
      } else if (decision.conflict === 'emptyLocalStorage') {
        console.warn('file:// 下 localStorage 为空，已加载 IndexedDB 并镜像到 localStorage。');
      }

      const changed = YW.state.restoreStateFromData(decision.snapshot.data);
      if (decision.shouldMirrorLocal || changed) {
        await saveStateStrict();
      }
      return true;
    }

    const decision = chooseLoadSource(indexedDBSnapshot, localStorageSnapshot);
    if (!decision.snapshot) return false;

    if (decision.conflict === 'nonEmptyLocalStorage') {
      console.warn('IndexedDB 与 localStorage 都存在不同数据，已优先加载 IndexedDB，并保留 localStorage 以便手动恢复。');
    } else if (decision.conflict === 'emptyLocalStorage') {
      console.warn('localStorage 存在空数据，已忽略并优先加载 IndexedDB。');
    }

    const changed = YW.state.restoreStateFromData(decision.snapshot.data);
    if (decision.shouldMigrateLocal) {
      const result = await saveState();
      if (decision.shouldRemoveLocal && result && result.storage === 'indexedDB') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } else if (changed) {
      await saveStateStrict();
    }
    return true;
  }

  function exportData() {
    const data = YW.state.serializeState();
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
      await YW.modals.showModal('请选择 .json 格式的备份文件');
      return;
    }

    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (e) {
      await YW.modals.showModal('文件格式错误，无法解析 JSON 数据');
      return;
    }

    const validation = YW.state.validateImportedState(data);
    if (!validation.ok) {
      await YW.modals.showModal(validation.message);
      return;
    }

    const confirmed = await YW.modals.showModal(
      `确认导入备份数据吗？将替换当前所有数据（${YW.state.state.people.length} 位体育生、${YW.state.state.items.length} 条 YW）。此操作不可撤销。`,
      { showCancel: true }
    );
    if (!confirmed) return;

    YW.state.restoreStateFromData(validation.data);
    await saveStateStrict();
    YW.state.ensureValidViewState();
    YW.render.renderAll();
    await YW.modals.showModal(`数据导入成功！已恢复 ${YW.state.state.people.length} 位体育生、${YW.state.state.items.length} 条 YW`);
  }

  Object.assign(YW.storage, {
    openDB,
    saveState,
    saveStateStrict,
    scheduleSave,
    getStoredStateWeight,
    createStoredStateSnapshot,
    chooseLoadSource,
    chooseFileProtocolLoadSource,
    loadState,
    exportData,
    importData,
  });
})(window.YW);

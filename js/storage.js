(function (YW) {
  YW.storage = YW.storage || {};

  const { DB_NAME, DB_VERSION, DB_STORE, DB_KEY, STORAGE_KEY, SAVE_FAILURE_MESSAGE } = YW.config;

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
    const data = YW.state.serializeState();
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

  async function loadState() {
    // localStorage 通常是 IndexedDB 失败后的最新回退数据，启动时优先迁移。
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const validation = YW.state.validateImportedState(parsed);
        if (!validation.ok) {
          console.error('localStorage 数据格式错误，跳过迁移:', validation.message);
        } else {
          YW.state.restoreStateFromData(validation.data);
          const result = await saveState();
          if (result && result.storage === 'indexedDB') {
            localStorage.removeItem(STORAGE_KEY);
          }
          return true;
        }
      }
    } catch (e) {
      console.error('localStorage 迁移失败，保留原数据:', e);
    }

    // localStorage 不可用或无有效数据时，从 IndexedDB 加载。
    try {
      const db = await openDB();
      const tx = db.transaction(DB_STORE, 'readonly');
      const request = tx.objectStore(DB_STORE).get(DB_KEY);
      const data = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (data) {
        const changed = YW.state.restoreStateFromData(data);
        if (changed) await saveStateStrict();
        return true;
      }
    } catch (e) {
      console.error('IndexedDB 加载失败:', e);
    }
    return false;
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

  Object.assign(YW.storage, { openDB, saveState, saveStateStrict, scheduleSave, loadState, exportData, importData });
})(window.YW);

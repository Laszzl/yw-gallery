(function (YW) {
  function isNonEmptySnapshot(snapshot) {
    return Boolean(snapshot && snapshot.data && Array.isArray(snapshot.data.people) && snapshot.data.people.length > 0);
  }

  function createSnapshot(source, data) {
    return {
      source,
      data: YW.state.normalizeStateData(data),
      isEmpty: !isNonEmptySnapshot({ data }),
    };
  }

  function chooseLoadSource(indexedSnapshot, localSnapshot) {
    if (YW.config.isFileProtocol) {
      if (isNonEmptySnapshot(localSnapshot)) return { snapshot: localSnapshot, shouldMirrorToIndexedDB: true };
      if (isNonEmptySnapshot(indexedSnapshot)) return { snapshot: indexedSnapshot, shouldMirrorToLocalStorage: true };
      return { snapshot: localSnapshot || indexedSnapshot || null };
    }

    if (isNonEmptySnapshot(indexedSnapshot)) {
      return { snapshot: indexedSnapshot, conflict: isNonEmptySnapshot(localSnapshot) ? "nonEmptyLocalStorage" : null };
    }
    if (isNonEmptySnapshot(localSnapshot)) {
      return { snapshot: localSnapshot, shouldMigrateLocal: true };
    }
    return { snapshot: indexedSnapshot || localSnapshot || null };
  }

  function loadLocalSnapshot() {
    try {
      const raw = window.localStorage.getItem(YW.config.STORAGE_KEY);
      return raw ? createSnapshot("localStorage", JSON.parse(raw)) : null;
    } catch (err) {
      return null;
    }
  }

  function saveLocal(data) {
    window.localStorage.setItem(YW.config.STORAGE_KEY, JSON.stringify(data));
  }

  YW.storage = {
    createSnapshot,
    chooseLoadSource,
    loadLocalSnapshot,
    saveLocal,
  };
})(window.YW);

(function (YW) {
  YW.utils = YW.utils || {};

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isValidDateString(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function parseDateParts(dateStr, fallback = YW.config.DEFAULT_ITEM_DATE) {
    const source = isValidDateString(dateStr) ? dateStr : fallback;
    const [year, month, day] = source.split('-').map(Number);
    return { year, month, day };
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const { year, month, day } = parseDateParts(dateStr);
    return `${String(year).slice(-2)}/${month}/${day}`;
  }

  function formatDateDisplay(dateStr) {
    const { year, month, day } = parseDateParts(dateStr);
    return `${year}/${month}/${day}`;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function buildDateString(year, month, day) {
    return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function createOption(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }

  function setExpanded(element, expanded) {
    element.setAttribute('aria-expanded', String(expanded));
  }

  function setSwitchState(element, active) {
    element.classList.toggle('active', active);
    element.setAttribute('aria-checked', String(active));
  }

  Object.assign(YW.utils, {
    isPlainObject,
    isValidDateString,
    parseDateParts,
    formatDateShort,
    formatDateDisplay,
    daysInMonth,
    buildDateString,
    createOption,
    setExpanded,
    setSwitchState,
  });
})(window.YW);

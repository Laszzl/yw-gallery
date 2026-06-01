(function (YW) {
  YW.datePicker = YW.datePicker || {};

  const elements = YW.dom.elements;
  const { DEFAULT_ITEM_DATE, DATE_MIN_YEAR, DATE_PICKER_SCROLL_DEBOUNCE_MS } = YW.config;

  const pickerState = { ...YW.utils.parseDateParts(DEFAULT_ITEM_DATE), scrollTimer: null };

  function syncDateDisplay(dateStr) {
    let formatted;
    if (dateStr) {
      formatted = dateStr;
    } else {
      formatted = YW.utils.buildDateString(pickerState.year, pickerState.month, pickerState.day);
    }
    elements.itemDateHidden.value = formatted;
    elements.itemDateDisplay.querySelector('.date-display-text').textContent = YW.utils.formatDateDisplay(formatted);
  }

  function renderColumnItems(scrollEl, items, selectedValue, colType) {
    const existing = scrollEl.querySelectorAll('.date-col-item');
    for (let i = 0; i < existing.length; i++) { existing[i].remove(); }

    const spacerBottom = scrollEl.querySelector('.date-col-spacer:last-child');
    const fragment = document.createDocumentFragment();
    for (let j = 0; j < items.length; j++) {
      const itemEl = document.createElement('div');
      itemEl.className = 'date-col-item';
      itemEl.textContent = String(items[j]);
      itemEl.dataset.value = String(items[j]);
      itemEl.dataset.col = colType;
      itemEl.addEventListener('click', function(e) {
        const val = parseInt(e.currentTarget.dataset.value, 10);
        handleDateItemClick(colType, val, scrollEl);
      });
      fragment.appendChild(itemEl);
    }
    scrollEl.insertBefore(fragment, spacerBottom);
  }

  function renderYearColumn(scrollEl, selectedYear) {
    const currentYear = new Date().getFullYear();
    const items = [];
    for (let y = currentYear; y >= DATE_MIN_YEAR; y--) { items.push(y); }
    renderColumnItems(scrollEl, items, selectedYear, 'year');
  }

  function renderMonthColumn(scrollEl, selectedMonth) {
    const items = [];
    for (let m = 1; m <= 12; m++) { items.push(m); }
    renderColumnItems(scrollEl, items, selectedMonth, 'month');
  }

  function renderDayColumn(scrollEl, selectedDay, year, month) {
    const maxDay = YW.utils.daysInMonth(year, month);
    const items = [];
    for (let d = 1; d <= maxDay; d++) { items.push(d); }
    renderColumnItems(scrollEl, items, selectedDay, 'day');
  }

  function handleDateItemClick(colType, value, scrollEl) {
    pickerState[colType] = value;

    if (colType === 'year' || colType === 'month') {
      refreshDayColumn();
    }
    scrollToSelectedItem(scrollEl, value);
    updateColumnSelection(scrollEl, value);
  }

  function onColumnScroll(e) {
    const scrollEl = e.target;
    if (!scrollEl.classList.contains('date-col-scroll')) return;

    clearTimeout(pickerState.scrollTimer);
    pickerState.scrollTimer = setTimeout(function() {
      const selectedValue = getClosestSnapItem(scrollEl);
      if (selectedValue === null) return;

      const colType = scrollEl.dataset.col;
      pickerState[colType] = selectedValue;

      updateColumnSelection(scrollEl, selectedValue);

      if (colType === 'year' || colType === 'month') {
        refreshDayColumn();
      }
    }, DATE_PICKER_SCROLL_DEBOUNCE_MS);
  }

  function getClosestSnapItem(scrollEl) {
    const items = scrollEl.querySelectorAll('.date-col-item');
    const viewCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2;
    let closest = null;
    let minDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const itemCenter = items[i].offsetTop + items[i].offsetHeight / 2;
      const dist = Math.abs(itemCenter - viewCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = parseInt(items[i].dataset.value, 10);
      }
    }
    return closest;
  }

  function updateColumnSelection(scrollEl, value) {
    const items = scrollEl.querySelectorAll('.date-col-item');
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('selected', parseInt(items[i].dataset.value, 10) === value);
    }
  }

  function scrollToSelectedItem(scrollEl, value) {
    const items = scrollEl.querySelectorAll('.date-col-item');
    for (let i = 0; i < items.length; i++) {
      if (parseInt(items[i].dataset.value, 10) === value) {
        const itemTop = items[i].offsetTop;
        const scrollTarget = itemTop - (scrollEl.clientHeight / 2) + (items[i].offsetHeight / 2);
        scrollEl.scrollTop = scrollTarget;
        break;
      }
    }
  }

  function refreshDayColumn() {
    const maxDay = YW.utils.daysInMonth(pickerState.year, pickerState.month);
    if (pickerState.day > maxDay) {
      pickerState.day = maxDay;
    }
    renderDayColumn(elements.dateDayScroll, pickerState.day, pickerState.year, pickerState.month);
    requestAnimationFrame(function() {
      scrollToSelectedItem(elements.dateDayScroll, pickerState.day);
      updateColumnSelection(elements.dateDayScroll, pickerState.day);
    });
  }

  function syncPickerStateFromScrolls() {
    const columns = [
      ['year', elements.dateYearScroll],
      ['month', elements.dateMonthScroll],
      ['day', elements.dateDayScroll],
    ];
    for (const [colType, scrollEl] of columns) {
      const selectedValue = getClosestSnapItem(scrollEl);
      if (selectedValue !== null) pickerState[colType] = selectedValue;
    }
    const maxDay = YW.utils.daysInMonth(pickerState.year, pickerState.month);
    if (pickerState.day > maxDay) pickerState.day = maxDay;
  }

  function openDatePicker(dateStr) {
    Object.assign(pickerState, YW.utils.parseDateParts(dateStr));

    renderYearColumn(elements.dateYearScroll, pickerState.year);
    renderMonthColumn(elements.dateMonthScroll, pickerState.month);
    renderDayColumn(elements.dateDayScroll, pickerState.day, pickerState.year, pickerState.month);

    requestAnimationFrame(function() {
      scrollToSelectedItem(elements.dateYearScroll, pickerState.year);
      updateColumnSelection(elements.dateYearScroll, pickerState.year);
      scrollToSelectedItem(elements.dateMonthScroll, pickerState.month);
      updateColumnSelection(elements.dateMonthScroll, pickerState.month);
      scrollToSelectedItem(elements.dateDayScroll, pickerState.day);
      updateColumnSelection(elements.dateDayScroll, pickerState.day);
    });

    elements.datePickerModal.hidden = false;
    YW.utils.setExpanded(elements.itemDateDisplay, true);
    YW.modals.activateModalFocus(elements.datePickerModal, {
      initialFocus: elements.datePickerConfirmBtn,
      onEscape: cancelDatePicker,
    });
  }

  function confirmDatePicker() {
    clearTimeout(pickerState.scrollTimer);
    syncPickerStateFromScrolls();
    syncDateDisplay();
    YW.modals.deactivateModalFocus(elements.datePickerModal);
    elements.datePickerModal.hidden = true;
    YW.utils.setExpanded(elements.itemDateDisplay, false);
  }

  function cancelDatePicker() {
    YW.modals.deactivateModalFocus(elements.datePickerModal);
    elements.datePickerModal.hidden = true;
    YW.utils.setExpanded(elements.itemDateDisplay, false);
  }

  Object.assign(YW.datePicker, {
    syncDateDisplay,
    openDatePicker,
    confirmDatePicker,
    cancelDatePicker,
    onColumnScroll,
  });
})(window.YW);

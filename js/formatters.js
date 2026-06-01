(function (YW) {
  YW.formatters = YW.formatters || {};

  function itemLabel(item) {
    let text = item.label;
    if (item.quantity && item.unit) {
      text += ' · ' + item.quantity + item.unit;
    }
    return text;
  }

  function itemStatus(item) {
    const parts = [];
    if (item.isGift) parts.push('赠送');
    parts.push(item.isOwnedNow ? '现存' : '非现存');
    return parts.join(' · ');
  }

  function categoryCounts(items) {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const ownedQty = items.reduce((sum, item) => sum + (item.isOwnedNow ? item.quantity : 0), 0);
    return `总数量 ${totalQty} · 现存 ${ownedQty}`;
  }

  function shortDate(dateStr) {
    return YW.utils.formatDateShort(dateStr) || YW.utils.formatDateShort(YW.config.DEFAULT_ITEM_DATE);
  }

  Object.assign(YW.formatters, {
    itemLabel,
    itemStatus,
    categoryCounts,
    shortDate,
  });
})(window.YW);

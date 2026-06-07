(function (YW) {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function uniqueStrings(values) {
    return Array.from(new Set((values || []).filter((value) => typeof value === "string" && value)));
  }

  YW.utils = {
    clone,
    byId,
    uniqueStrings,
  };
})(window.YW);

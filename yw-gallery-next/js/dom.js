(function (YW) {
  function queryElements() {
    return {
      viewButtons: Array.from(document.querySelectorAll("[data-view-button]")),
      views: Array.from(document.querySelectorAll("[data-view]")),
      summary: document.querySelector("[data-summary]"),
    };
  }

  YW.dom = {
    elements: {},
    queryElements,
  };
})(window.YW);

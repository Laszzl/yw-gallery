(function (YW) {
  async function initApp() {
    YW.dom.elements = YW.dom.queryElements();
    const localSnapshot = YW.storage.loadLocalSnapshot();
    const loadDecision = YW.storage.chooseLoadSource(null, localSnapshot);
    if (loadDecision.snapshot) {
      YW.state.restoreStateFromData(loadDecision.snapshot.data);
    }
    bindNavigation();
    YW.render.renderApp();
  }

  function bindNavigation() {
    YW.dom.elements.viewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        YW.render.showView(button.dataset.viewButton);
      });
    });
  }

  YW.events = {
    initApp,
  };
})(window.YW);

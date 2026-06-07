(function (YW) {
  function showView(viewName) {
    YW.state.viewState.currentView = viewName;
    YW.dom.elements.views.forEach((view) => {
      view.hidden = view.dataset.view !== viewName;
    });
    YW.dom.elements.viewButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.viewButton === viewName));
    });
  }

  function renderSummary() {
    if (!YW.dom.elements.summary) return;
    const personId = YW.state.viewState.selectedPersonId;
    const vm = YW.viewModels.getPersonDetailViewModel(personId);
    YW.dom.elements.summary.textContent = vm.person ? vm.person.name + "，" + vm.groups.length + " 个大品类。" : "等待人物数据。";
  }

  function renderApp() {
    showView(YW.state.viewState.currentView);
    renderSummary();
  }

  YW.render = {
    showView,
    renderSummary,
    renderApp,
  };
})(window.YW);

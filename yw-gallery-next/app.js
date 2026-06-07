(function (YW) {
  YW.events.initApp().catch((err) => {
    console.error("YW Gallery Next 启动失败", err);
  });
})(window.YW);

(function (YW) {
  YW.events.initApp().catch(function (err) {
    console.error('应用初始化失败:', err);
  });
})(window.YW);

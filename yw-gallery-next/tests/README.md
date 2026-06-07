# Smoke Test

本目录提供不依赖框架和构建步骤的轻量浏览器验证入口。

## 运行方式

1. 在项目根目录启动任意静态服务器，例如 `python3 -m http.server 8766`。
2. 打开 `http://127.0.0.1:8766/tests/smoke.html`。
3. 页面显示 `全部 smoke test 通过。` 即表示 M0 harness 正常。

也可以直接双击 `tests/smoke.html`，但后续涉及 IndexedDB 或跨文件加载时更推荐静态服务器。

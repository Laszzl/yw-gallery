# Smoke Test

本目录提供不依赖框架和构建步骤的轻量浏览器验证入口。

## 运行方式

1. 在项目根目录启动任意静态服务器，例如 `python3 -m http.server 8766`。
2. 打开 `http://127.0.0.1:8766/tests/smoke.html`。
3. 页面显示 `全部 smoke test 通过。` 即表示基础数据兼容路径正常。

## 覆盖范围

- 导入数据校验成功路径。
- 空根结构、重复 ID、缺失引用、图片数组类型等失败路径。
- `normalizeState()` 对排序和旧版 person gallery 字段的补齐。
- `serializeState()` 只输出持久化字段。
- 详情页 ViewModel 的分组和有图/无图拆分。

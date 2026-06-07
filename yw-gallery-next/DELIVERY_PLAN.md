# YW Gallery Next Delivery Plan

## Cadence

每个 slice 都按同一流程交付：

1. Codex 写 implementation brief。
2. Claude Code 按 brief 实现。
3. Codex code review。
4. 修正问题。
5. 运行 smoke test 和必要人工验收。
6. commit/push。

## Milestones

### M0: 工程骨架和 Harness

- 新建项目目录。
- 写 `AGENTS.md` / `CLAUDE.md` / `PRODUCT_SPEC.md` / `ARCHITECTURE.md` / `DELIVERY_PLAN.md`。
- 建立最小 App shell。
- 建立 smoke test、fixtures 和项目 skill 草案。

验收：
- `AGENTS.md` 与 `CLAUDE.md` 完全一致。
- `tests/smoke.html` 可在浏览器打开并显示全部通过。
- 项目不需要 npm install 或 build。

### M1: App Shell 和基础 UI

- 四个主视图：主页、详情、添加、设置。
- 基础 Apple 风格 token 和响应式 shell。
- 稳定导航与空状态。

### M2: 数据模型与旧数据迁移

- 完成新版 state/data/storage API。
- 完成旧版 JSON 迁移导入。
- 补齐导入导出。

### M3: 浏览体验

- 人物主页。
- 个人详情页。
- 大品类、小品类和 YW ViewModel。
- 有图/无图展示策略。

### M4: YW 编辑流程

- 添加、编辑、删除。
- 表单锁。
- 日期、数量、状态。
- 确认弹窗。

### M5: 图片能力

- 图片读取。
- 裁剪。
- 多图管理。
- 人物图、YW 图、画廊图。

### M6: 设置与排序

- 人物管理。
- 大品类/小品类管理。
- 折叠。
- Mac 排序和移动端替代交互设计。

### M7: 三端 Polish

- Mac、iPad、iPhone 视觉和交互细化。
- 暗色模式。
- 减少动态效果。
- 减少透明度。

### M8: 发布前冻结

- 全量旧数据导入测试。
- 全量人工验收。
- 文档冻结。
- 备份和发布说明。

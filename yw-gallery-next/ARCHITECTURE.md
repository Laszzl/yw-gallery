# YW Gallery Next Architecture

## Runtime

- 纯浏览器运行，无构建步骤。
- 所有模块通过 `<script>` 按依赖顺序加载。
- 全局命名空间为 `window.YW`。

## Data Flow

1. `app.js` 调用 `YW.events.initApp()`。
2. `events` 初始化 DOM、加载 storage、恢复 state。
3. `state` 负责 normalize、serialize 和 legacy migration。
4. `view-models` 从 state 派生渲染结构。
5. `render` 根据 viewState 和 ViewModel 同步 UI。
6. 用户操作经 `events` 或未来的数据 API 写入 state。
7. `storage` 负责保存到本地。

## Storage Strategy

- 本地服务器场景优先 IndexedDB，localStorage 作为回退。
- `file://` 场景优先 localStorage，IndexedDB 作为兼容镜像。
- 旧数据导入先校验，再迁移，再 normalize。
- 新版持久化字段由 `serializeState()` 白名单控制。

## Initial Data Shape

```js
{
  schemaVersion: 1,
  people: [],
  groups: [],
  categories: [],
  items: [],
  ui: {
    collapsedCategoryKeys: {}
  }
}
```

`viewState` 只保存运行时 UI 状态，不进入持久化数据。

## Module Boundaries

- `state` 不拼 DOM。
- `render` 不直接访问 storage。
- `storage` 不做 UI 决策。
- `validators` 只验证和返回清洗结果，不修改当前 state。
- `view-models` 不写持久化 state。

## Responsive Strategy

- 基础布局先服务 Mac/iPad 宽屏。
- `max-width: 1024px` 处理 iPad 竖屏收敛。
- `max-width: 768px` 处理 iPhone。
- 桌面 hover/cursor 放入 `(hover: hover) and (pointer: fine)`。
- 暗色模式、减少动态效果、减少透明度必须通过系统媒体查询处理。

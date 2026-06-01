# YW Gallery

纯前端单页应用，无框架，无构建工具。

## 技术栈
- index.html + app.js + styles.css，直接浏览器打开
- IndexedDB 持久化（localStorage 回退 + 自动迁移）
- 中文 UI，Apple 风格设计

## 数据模型
people → groups（大品类）→ categories（小品类）→ items（YW）

### State 结构

持久化 state（`serializeState()` 挑选以下 key 写入 IndexedDB）：
- `people[]`, `groups[]`, `categories[]`, `items[]`
- `collapsedSubcategories` — `{"<personId>:<categoryId>": true}`
- `collapsedSettingsGroups` — `{"<groupId>": true}`
- `groupOrderByPerson` — `{"<personId>": [groupId, ...]}`
- `categoryOrderByPerson` — `{"<personId>": {"<groupId>": [categoryId, ...]}}`

运行时 viewState（不持久化）：
- `currentView` ∈ `{'home','athlete','add','settings'}`，通过 hidden 属性切换视图
- `selectedPersonId`, `settingsActivePersonId`, `overviewPersonId`
- 无 URL 路由、无 history API

`normalizeState()` 每次加载后自动运行：清除已删除 person/group/category 的 order 条目，补全缺失条目。

## 核心功能
- 四个主视图：主页体育生选择、体育生详情图库、添加 YW、设置/数据管理。
- 主页展示体育生卡片；体育生详情页按大品类、小品类展示 YW，并区分有图卡片与无图文本条目。
- 添加 YW 支持选择体育生、大品类、小品类，填写名称、数量、单位、日期，并标记“赠送”“现存”状态。
- 设置页支持体育生增删与图片更换；大品类/小品类增删、查看、折叠、拖拽排序；按体育生维度保存大小品类顺序。
- YW 支持新增、删除、状态切换、图片管理、同类型拖拽排序；图片支持上传、裁剪、多图轮播、添加、替换、删除。
- 数据持久化优先使用 IndexedDB，localStorage 作为回退并自动迁移；支持 JSON 导入导出备份。

## 设备检测

`const isMacDevice = matchMedia('(hover: hover) and (pointer: fine)').matches;`（位于 js/config.js）

单一布尔值控制所有 JS 端设备分支。CSS 侧通过媒体查询独立控制：
`@media (hover: hover) and (pointer: fine)`（桌面 hover）、
`@media (max-width: 1366px)`（iPad 横）、`@media (max-width: 1024px)`（iPad 竖）、
`@media (max-width: 768px)`（iPhone）、`@media (prefers-color-scheme: dark)`（暗色模式）。

## 三端兼容

### 全局原则
不改变数据结构、保存格式、业务流程和中文 Apple 风格。

### Mac 与移动端的桌面专属交互必须分支

这是项目最重要的设计约束。hover、HTML5 拖拽等桌面专属能力必须按设备分支；表单、弹窗、按钮等基础操作优先使用 click/touch 可共用逻辑。

**Mac（桌面端）**：
- 交互：鼠标/键盘，支持 hover、HTML5 拖拽（`draggable="true"`）
- 布局：宽屏、顶部导航、多列表单、横向 YW 卡片列表
- CSS：`cursor: grab/pointer` 等仅在 `@media (hover: hover)` 下生效

**iPhone/iPad（移动端）**：
- 交互：仅触摸（点按、滑动），不依赖 hover、右键、HTML5 DnD
- 拖拽排序仅在 Mac 上生效，移动端不提供拖拽排序功能（iOS Safari 不支持 HTML5 拖拽，Pointer Events 拖拽已移除）
- 所有核心操作基于 click/touch 事件，不得只使用 hover 触发 UI

### iPad 适配
- **横版 (max-width: 1366px)**：接近 Mac 布局，触控目标加大、弹窗加宽、横向滚动适配触摸。
- **竖版 (max-width: 1024px)**：顶部导航允许换行；表单收敛为 1-2 列；禁止横向溢出。

### iPhone 适配 (max-width: 768px)
- 顶部导航分两排：第一排左侧“添加”、中间“原味”、右侧“设置”；第二排体育生 chip 居中，横向滚动时固定只显示 3 个。
- iPhone 端视觉只参考 iOS App，不沿用 Mac/iPad 的厚重按钮和桌面卡片感；顶部导航为透明容器上的 Liquid Glass 漂浮控件。
- 滚动时顶部使用 scroll-edge 渐隐层，让内容进入导航下方时自然淡出；导航控件保持清晰可点。
- 弹窗底部对齐（`align-items: flex-end`），适配底部 safe-area
- 弹窗全宽、max-height 85vh、overflow-y auto
- 裁剪弹窗和日期弹窗全宽 100%
- iPhone 顶部导航允许使用 `backdrop-filter` 实现 Liquid Glass；如真实 iOS Safari 出现明显滚动卡顿，再降级为轻量透明渐变层。

## 持久化与图片

### 存储
- IndexedDB: 数据库 `yw_gallery_v1`，store `app_data`，key `state`
- localStorage 回退: key `yw_data`，IndexedDB 失败时自动回退写入
- 自动迁移: 检测到 localStorage 有数据时优先迁移到 IndexedDB
- 导出/导入: JSON 文件下载 + 上传验证，4 个必需 key（均为数组）

### Item 结构
`{ id, personId, categoryId, label, quantity (int, ≥1), unit, date (YYYY-MM-DD, 默认 1998-03-25), isGift, isOwnedNow (默认 true), photoUrls[], order }`

### 图片处理
- 所有图片存储为 base64 Data URL（`readFileAsDataURL` 通过 FileReader 转换）
- 裁剪弹窗: 当前业务使用 1:1（YW/个人页）和 4:5（主页），组件保留 3:4 支持；四角拖拽 handle，输出 JPEG @ 0.92 质量
- 图片管理弹窗: 桌面 3 列缩略图网格，窄屏自适应为 2 列，支持添加、替换、删除

## 其他关键实现

- **暗色模式**: `@media (prefers-color-scheme: dark)` 完整 CSS 变量重定义
- **日期选择器**: 自定义 3 列滚动选择器（年/月/日），范围 1950-当前年份
- **Form Lock**: `withFormLock(form, lockName, fn)` 防止重复提交
- **Rail Mask**: `updateRailMask()` CSS mask-image 渐变 + ResizeObserver，横向滚动轨道两端淡出

## Coding Standards

所有新代码必须遵守。现有违规代码视为 grandfathered in，修改时逐步修复。

### JavaScript

**JS-1: No `var`.** 只用 `const` 和 `let`。`var` 的函数作用域提升是 bug 来源。
> 已全部修复，无残留 `var`。

**JS-2: Magic numbers must be named constants.** 除 0/1/-1 外的数字字面量定义为命名 `const`。跨作用域使用的放入 `config.js`。
> 主要常量已迁移至 config.js；日期滚动防抖、裁剪尺寸、Rail Mask 等跨模块值已集中管理。

**JS-3: Event listeners must be cleaned up.** 每个 `addEventListener` 必须有对应的移除路径（模态框关闭、元素销毁），或标注 `// app-lifetime` 注释说明故意保留。
> 裁剪拖拽已通过 `unbindCropDocListeners`/`prepareCropModalClose` 清理。应用生命周期监听器使用 `// app-lifetime` 标注。

**JS-4: async/await only.** 所有异步代码使用 `async/await`，不写 `.then()/.catch()` 链。混合风格容易隐藏错误传播路径。
> 已全部统一为 async/await（仅顶层 `initApp().catch(...)` 为启动模式保留）。

**JS-5: Functions max ~50 lines.** 超过 50 行的函数拆分为命名子函数。不是为了教条，而是长函数几乎总是做了多件事。
> 已拆分 `openPhotoCollectionManager`、`bindEvents`、`validateImportedState`、`normalizeState`、`handleCornerDrag` 等长函数。

**JS-6: DRY — Rule of Three.** 相同逻辑出现 3 次及以上才提取为共享函数。2 次重复可以容忍，过早抽象比重复更危险。
> 日期格式、保存失败文案、切换状态、拖拽绑定、图片管理流程已抽取为共享工具或命名函数。

**JS-7: Cached DOM access.** DOM 查询统一通过 `cacheElements()` 中的 `elements` 对象。动态创建的元素除外。
> 静态 DOM 查询统一在 `cacheElements()` 中维护；动态渲染区域允许局部查询。

**JS-8: Save semantics.** 用户交互触发的 CUD 操作用 `await saveStateStrict()`（必须确认写入成功）；拖拽排序等高频非关键操作用 `scheduleSave()`（去重 + 自含错误弹窗，不阻塞 UI）。
> 新增代码遵守此规则，现有违规在修改时逐步修复。

**JS-9: Module boundaries (渐进式).** 新功能放入对应的 `js/*.js` 模块文件，不新增逻辑到 `events.js`。方向是逐步瘦身 `events.js` 使其只剩事件绑定和编排逻辑。

**JS-10: No re-export aliases.** 不创建仅转发调用的包装函数或别名。模块函数应从其 canonical 位置引用（如 `YW.utils.formatDateShort` 而非 `YW.data.formatDate`）。这消除无价值的间接层，确保代码库中只有一个权威的引用路径。

**JS-11: Shared delete confirmation.** 所有删除操作统一使用 `YW.modals.confirmAndDelete(confirmMsg, deleteFn, successMsg)`。不得手动展开 showModal→confirm→delete→renderAll→showModal 模式。

**JS-12: Unified collapse toggle.** 折叠/展开 UI 使用共享的 `YW.utils.bindCollapseToggle(button, storageObj, key, collapsibleEl)` 绑定，不再手动内联 toggleCollapsedState + classList.toggle + setExpanded。

**JS-13: Extracted UI widgets.** 自包含的 UI 组件（日期选择器、图片管理器）必须放在独立的 `js/*.js` 模块文件中，不嵌入 forms.js 或 modals.js。模块应在功能边界上分离，而非仅按行数分拆。

**JS-14: CSS variable-first theming.** 暗色模式和设备端侧覆盖应优先修改 CSS 自定义属性值，而非在 `@media` 块中重新声明完整规则。避免选择器重复，使主题切换逻辑集中在 `:root` 变量定义处。

**JS-15: Canonical import source.** 同一个函数只在一个模块中定义和导出。调用方始终从定义模块引用（`YW.utils.*` 优于 `YW.data.*` 别名）。如 render.js 需要 `YW.utils.formatDateShort`，直接解构 `YW.utils`，而非通过 `YW.data` 间接引用。

### CSS

**CSS-1: No duplicate selectors.** 每个选择器块只定义一次，追加属性合并到已有块。
> 基础选择器重复已合并；媒体查询内的端侧覆盖允许保留。

**CSS-2: No empty declaration blocks.** 删除无属性的空规则块。
> 已清理空规则块。

**CSS-3: CSS variables for repeated values.** 同一值出现 3 次以上提取为 `:root` 自定义属性。
> 重复字重、日期选择器高度、`letter-spacing: 0` 等已使用 CSS 变量。

**CSS-4: Max 2 descendant levels.** 选择器嵌套不超过 2 层。深层选择器依赖 DOM 结构，HTML 重构时容易断裂。
> 深层结构选择器已清理，新增样式避免依赖 2 层以上 DOM 嵌套。

**CSS-5: No `!important`.** 靠特异性管理而非 `!important` 解决覆盖。仅 `.hidden` 等工具类除外。
> 仅保留 `[hidden]` 和 reduced-motion 这类工具/无障碍场景的 `!important`。

**CSS-6: Prefer variable overrides to rule duplication.** 在 `@media (prefers-color-scheme: dark)` 和 `@media (max-width: 768px)` 中，优先修改 `:root` 或 `body` 上的 CSS 自定义属性值，而非重新声明完整的选择器规则块。仅在变量无法覆盖的差异（如 `backdrop-filter`、`box-shadow` 替换需要不同值语义）时才写新规则。

### HTML

**HTML-1: Complete ARIA on every modal.** 每个模态框必须具备 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`(或 `aria-label`)。
> 当前模态框均具备 `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 或 `aria-label`。

**HTML-2: Popup triggers have semantics.** 打开弹窗的元素必须有 `aria-haspopup` 和 `aria-expanded`。
> 已全部修复。

**HTML-3: No duplicate SVG icons.** 每个 SVG 图标只定义一次，用 `<template>` 或 JS 复用。
> 已全部改为 `<symbol>` + `<use>` 模式。

## 开发
- 修改代码后刷新浏览器即可生效
- 每次修改代码后，自动提交并推送到 GitHub（git add + commit + push）
- 代码变更导致 CLAUDE.md 描述不符时，询问用户是否更新 CLAUDE.md

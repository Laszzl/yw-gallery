# YW Gallery

纯前端单页应用，无框架，无构建工具。

## 技术栈
- index.html + app.js + styles.css，直接浏览器打开
- IndexedDB 持久化（localStorage 回退 + 自动迁移）
- 中文 UI，Apple 风格设计

## 文件与模块职责

### 根文件
- `index.html`：负责静态 DOM 结构、`template` 模板、全局 `window.YW` 初始化、脚本加载顺序；不承载业务流程。
- `styles.css`：负责 CSS 变量、布局、响应式、暗色模式、Apple 风格视觉与设备媒体查询；不通过内联样式堆叠业务状态。
- `app.js`：只作为应用入口，调用 `YW.events.initApp()` 并处理初始化错误；不得放入业务逻辑。

### js 模块
- `js/config.js`：集中维护常量、存储 key、裁剪参数、断点相关值和 `isMacDevice`。
- `js/utils.js`：通用纯函数与轻量 DOM helper；避免放入具体业务流程。
- `js/state.js`：state/viewState、序列化、导入校验、数据归一化和视图状态兜底。
- `js/storage.js`：IndexedDB/localStorage 读写、迁移、导入导出、保存队列。
- `js/data.js`：业务数据查询、创建、删除、排序、图片 Data URL 读取等数据层操作。
- `js/dom.js`：集中缓存 DOM 节点和模板引用；新增 DOM 查询优先放这里。
- `js/render.js`：所有视图渲染、列表生成、视图切换和 UI 同步。
- `js/forms.js`：表单提交、表单锁、文件摘要、设置页图片输入处理。
- `js/events.js`：应用初始化和长期存在的事件绑定；避免重复绑定短生命周期节点。
- `js/modals.js`：通用弹窗、确认弹窗、YW 操作弹窗。
- `js/crop.js`：图片裁剪弹窗、裁剪状态和输出。
- `js/photo-manager.js`：图片管理弹窗、YW/画廊图片增删改排序。
- `js/date-picker.js`：自定义日期选择器。
- `js/drag.js`：Mac 端 HTML5 拖拽排序逻辑；移动端不得依赖该模块完成核心操作。
- `js/rail-mask.js`：横向滚动轨道渐隐 mask。

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
`{ id, personId, categoryId, label, quantity (int, ≥1), unit, date (YYYY-MM-DD, 默认为当天日期), isGift, isOwnedNow (默认 true), photoUrls[], order }`

### 图片处理
- 所有图片存储为 base64 Data URL（`readFileAsDataURL` 通过 FileReader 转换）
- 裁剪弹窗: 当前业务使用 1:1（YW/个人页）和 4:5（主页），组件保留 3:4 支持；四角拖拽 handle，输出 JPEG @ 0.92 质量
- 图片管理弹窗: 桌面 3 列缩略图网格，窄屏自适应为 2 列，支持添加、替换、删除

## 其他关键实现

- **暗色模式**: `@media (prefers-color-scheme: dark)` 完整 CSS 变量重定义
- **日期选择器**: 自定义 3 列滚动选择器（年/月/日），范围 1950-当前年份
- **Form Lock**: `withFormLock(form, lockName, fn)` 防止重复提交
- **Rail Mask**: `updateRailMask()` CSS mask-image 渐变 + ResizeObserver，横向滚动轨道两端淡出

## 代码规范

### 架构原则
- 保持纯前端、无框架、无构建工具；不得引入需要构建步骤的依赖。
- 继续使用 `window.YW` 命名空间 + IIFE 模块模式：`(function (YW) { ... })(window.YW);`。
- 新功能优先放入现有职责模块；只有形成独立领域能力、且不能清晰归入现有模块时才新增 `js/*.js`。
- 新增脚本必须在 `index.html` 中按依赖顺序加载：基础配置/工具/状态在前，渲染和事件绑定在后，`app.js` 永远最后。
- 禁止把大量业务逻辑塞回 `app.js`、`index.html` 内联脚本、事件回调或单个巨型函数。

### 状态与数据
- 不随意改变持久化 state key、数据结构、IndexedDB 名称、store、key 或 localStorage key。
- 修改数据模型时必须同步更新 `serializeState()`、`normalizeState()`、`validateImportedState()`、导入导出兼容逻辑和本文件说明。
- 状态变更优先通过 `js/data.js` 中的业务函数完成；通用 state 修复放在 `js/state.js`。
- 数据写入必须使用 `saveStateStrict()` 或 `scheduleSave()`；不要绕过 `js/storage.js` 直接写 IndexedDB/localStorage。
- `viewState` 只保存运行时 UI 状态，不加入持久化数据，除非明确需要跨会话保存并同步更新文档。

### DOM、事件与渲染
- DOM 查询集中在 `js/dom.js`；其他模块优先使用 `YW.dom.elements` 和模板引用。
- 渲染逻辑集中在 `js/render.js`，数据函数不直接拼 DOM，事件模块不直接承担整块视图生成。
- 长生命周期事件在 `js/events.js` 初始化时绑定；渲染生成的短生命周期节点可在对应 render 函数中绑定。
- 事件绑定应避免重复注册；重新渲染前优先 `replaceChildren()` 重建局部节点。
- 表单提交必须使用 `withFormLock()` 防止重复提交。

### 复用与简洁
- 优先复用已有 helper、模板、CSS 变量和数据查询函数，避免重复工具函数、重复 DOM 构造、重复样式常量。
- 函数保持单一职责；复杂流程拆成清晰的小函数，但不要为了抽象而抽象。
- 命名保持直白统一：数据查询使用 `find/get/has`，渲染使用 `render/sync/show`，事件绑定使用 `bind/handle`。
- 注释只解释不明显的约束或兼容原因，避免描述代码字面行为。
- 删除废弃代码、无用样式和未使用 DOM 节点；不要保留“以后可能用”的冗余实现。

## 样式规范

- 保持中文 UI、Apple 风格和当前视觉语言；新 UI 应像现有页面自然延展。
- 颜色、阴影、圆角、间距、模糊、边框等设计 token 优先使用 CSS 变量。
- 响应式修改放入现有断点体系：`1366px`、`1024px`、`768px`、`prefers-color-scheme`。
- 桌面 hover、cursor、拖拽提示等样式必须放在 `@media (hover: hover)` 或更精确的桌面媒体查询内。
- iPhone 端遵循轻量 Liquid Glass 顶部导航；不要把 Mac/iPad 的厚重按钮和卡片感直接复制到手机端。
- 弹窗、按钮、输入框必须兼顾触控目标尺寸和 safe-area；窄屏不得出现横向溢出。
- 新增图标优先复用现有 SVG symbol 或与当前内联 SVG 风格一致，避免混用多套视觉风格。
- 暗色模式新增颜色必须同步在 `@media (prefers-color-scheme: dark)` 中确认可读性。

## 可维护性与扩展约束

- 保持核心业务流程稳定：体育生 → 大品类 → 小品类 → YW，不改变用户已有数据含义。
- Mac 与移动端的桌面专属交互必须分支；移动端核心操作不得依赖 hover、右键或 HTML5 DnD。
- 任何新增排序能力都必须明确保存维度，避免破坏按体育生维度保存的大小品类顺序。
- 图片仍以 base64 Data URL 存储；如未来改为外部存储，必须设计迁移和导入导出兼容方案。
- 导入数据必须先校验再覆盖；任何破坏性操作都需要确认弹窗。
- 新增模块或跨模块 API 时，同步更新“文件与模块职责”和相关数据说明。


## 开发
- 修改代码后刷新浏览器即可生效
- 每次修改代码后，自动提交并推送到 GitHub（git add + commit + push）
- 代码变更导致 CLAUDE.md 描述不符时，询问用户是否更新 CLAUDE.md
- 文档或代码修改后，提交前运行 `git diff -- AGENTS.md CLAUDE.md` 或对应文件 diff 审阅变更
- 提交前确认 `git status --short` 只包含本次任务预期文件
- 仅文档更新时，提交信息建议使用 `docs: update agent guidelines`

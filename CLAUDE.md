# YW Gallery

纯前端单页应用，无框架，无构建工具。中文 UI，Apple 风格，三端兼容，数据结构和用户已有数据含义必须稳定。

## 文档同步原则

- `AGENTS.md` 与 `CLAUDE.md` 是同等规范文件，默认必须保持逐字一致。
- 修改其中一份时必须同步修改另一份；除非用户明确指定某一份为唯一 source of truth。
- 文档或代码修改后，提交前必须运行 `git diff -- AGENTS.md CLAUDE.md` 审阅规范变更，并用 `cmp -s AGENTS.md CLAUDE.md` 或等价方式确认两份文件一致。

## 技术栈
- `index.html` + `app.js` + `styles.css`，直接浏览器打开。
- IndexedDB 持久化，localStorage 回退，并在启动时自动迁移可用的 localStorage 数据。
- 不引入框架、构建工具或需要编译步骤的依赖。
- UI 使用中文文案、系统字体和 Apple 风格交互视觉。

## 文件与模块职责

### 根文件
- `index.html`：负责静态 DOM 结构、`template` 模板、全局 `window.YW` 初始化、脚本加载顺序；不承载业务流程。
- `styles.css`：作为唯一样式入口，通过 `@import` 按顺序加载 `css/*.css`；不直接承载大段业务样式。
- `app.js`：只作为应用入口，调用 `YW.events.initApp()` 并处理初始化错误；不得放入业务逻辑。

### css 模块
- `css/tokens.css`：CSS 变量、全局色彩/尺寸 token 和基础设计参数。
- `css/base.css`：基础 reset、body、通用按钮/输入/焦点可见性基础。
- `css/layout.css`：页面 shell、topbar、主视图布局、主页空状态和通用布局容器。
- `css/components.css`：主页卡片、详情页、画廊、设置块、表单块、YW 卡片和 rail 等组件样式。
- `css/modals.css`：日期选择器、通用弹窗、图片缩略图、操作弹窗和状态开关样式。
- `css/responsive.css`：iPad/iPhone 断点、移动端 Liquid Glass、bottom sheet 以及保持原级联顺序所需的后置裁剪/数据管理规则。
- `css/preferences.css`：Mac hover/拖拽提示、减少动态效果、暗色模式和减少透明度规则。

新增或调整样式时优先放入对应 `css/*.css` 模块；`styles.css` 只维护 import 顺序。拆分 CSS 时必须保持级联顺序，避免移动规则导致 iPhone、暗色模式或系统偏好覆盖失效。

### js 模块
- `js/config.js`：集中维护常量、存储 key、裁剪参数、断点相关值和 `isMacDevice`。
- `js/utils.js`：通用纯函数与轻量 DOM helper；避免放入具体业务流程。
- `js/state.js`：state/viewState、序列化、数据归一化、导入数据清洗和视图状态兜底。
- `js/validators.js`：导入数据校验，包括根结构、重复 ID、引用关系、数量、日期、布尔值和图片数组类型。
- `js/storage.js`：IndexedDB/localStorage 读写、迁移、导入导出、保存队列。
- `js/formatters.js`：集中维护面向 UI 的展示文案与日期/数量状态格式化。
- `js/data.js`：业务数据查询、创建、删除、排序、状态切换和图片集合写入等数据层操作。
- `js/media.js`：FileReader、图片 Data URL 读取和后续图片处理能力。
- `js/view-models.js`：页面展示所需的派生数据结构；不直接写入持久化 state。
- `js/dom.js`：集中缓存稳定 DOM 节点和模板引用；新增稳定 DOM 查询优先放这里。
- `js/render.js`：所有视图渲染、列表生成、视图切换和 UI 同步。
- `js/forms.js`：表单提交、表单锁、文件摘要、设置页图片输入处理。
- `js/events.js`：应用初始化和长期存在的事件绑定；避免重复绑定短生命周期节点。
- `js/modals.js`：通用弹窗、确认弹窗、YW 操作弹窗。
- `js/crop.js`：图片裁剪弹窗、裁剪状态和输出。
- `js/photo-manager.js`：图片管理弹窗、YW/画廊图片增删改排序。
- `js/date-picker.js`：自定义日期选择器。
- `js/drag.js`：Mac 端 HTML5 拖拽排序逻辑；移动端不得依赖该模块完成核心操作。
- `js/rail-mask.js`：横向滚动轨道渐隐 mask。

新增功能优先放入现有职责模块；只有形成独立领域能力、且不能清晰归入现有模块时才新增 `js/*.js`。新增脚本必须在 `index.html` 中按依赖顺序加载：基础配置/工具/状态在前，渲染和事件绑定在后，`app.js` 永远最后。

## 数据模型

数据层级：people → groups（大品类）→ categories（小品类）→ items（YW）。

### State 结构

持久化 state（`serializeState()` 挑选以下 key 写入 IndexedDB）：
- `people[]`, `groups[]`, `categories[]`, `items[]`
- `collapsedSubcategories` — `{"<personId>:<categoryId>": true}`
- `collapsedSettingsGroups` — `{"<groupId>": true}`
- `groupOrderByPerson` — `{"<personId>": [groupId, ...]}`
- `categoryOrderByPerson` — `{"<personId>": {"<groupId>": [categoryId, ...]}}`

运行时 viewState（不持久化）：
- `currentView` ∈ `{'home','athlete','add','settings'}`，通过 hidden 属性切换视图。
- `selectedPersonId`, `settingsActivePersonId`, `overviewPersonId`。
- 无 URL 路由、无 history API。

`normalizeState()` 每次加载后自动运行：清除已删除 person/group/category 的 order 条目，补全缺失条目，并为旧数据补齐默认字段。

### Person 结构

`{ id, name, homePhotoUrl, detailPhotoUrl, galleryEnabled, galleryPhotos[] }`

- `homePhotoUrl` 用于主页体育生卡片，裁剪比例为 `4:5`。
- `detailPhotoUrl` 用于个人详情页头像，裁剪比例为 `1:1`。
- `galleryEnabled` 控制个人详情页画廊是否启用。
- `galleryPhotos[]` 属于对应 person，保存画廊图片 Data URL，并用数组顺序表示画廊排序。

### Item 结构

`{ id, personId, categoryId, label, quantity, unit, date, isGift, isOwnedNow, photoUrls[], order }`

- `quantity` 必须是整数且 `>= 1`。
- `date` 为 `YYYY-MM-DD`，默认使用当天日期。
- `isGift` 表示“赠送”，默认 `false`。
- `isOwnedNow` 表示“现存”，默认 `true`。
- `photoUrls[]` 保存 YW 图片 Data URL，YW 图片裁剪比例为 `1:1`。
- `order` 用于同范围内 YW 排序。

### 排序与折叠状态

- 大品类排序按 person 维度保存到 `groupOrderByPerson`。
- 小品类排序按 person + group 维度保存到 `categoryOrderByPerson`。
- YW 拖拽排序只在“同体育生 + 同小品类 + 同图片类型（有图/无图）+ 同日期”范围内生效。
- 画廊图片排序保存在 `person.galleryPhotos[]` 的数组顺序中。
- 折叠状态分别保存在 `collapsedSubcategories` 和 `collapsedSettingsGroups`，不进入 `viewState`。

## 核心功能
- 四个主视图：主页体育生选择、体育生详情图库、添加 YW、设置/数据管理。
- 主页展示体育生卡片；体育生详情页展示个人头像、可选画廊，并按大品类、小品类展示 YW。
- YW 在详情页区分有图卡片与无图文本条目；多图 YW 支持卡片内轮播。
- 添加 YW 支持选择体育生、大品类、小品类，填写名称、数量、单位、日期，并标记“赠送”“现存”状态。
- 设置页支持体育生增删与主页/个人页图片更换；大品类/小品类增删、查看、折叠、拖拽排序；按体育生维度保存大小品类顺序。
- 画廊按 person 开关启用；画廊图片支持添加、替换、删除全部和 Mac 端拖拽排序。
- YW 支持新增、删除、状态切换、图片管理、同类型 Mac 端拖拽排序；图片支持上传、裁剪、多图添加、替换、删除全部。
- 数据持久化优先使用 IndexedDB，localStorage 作为回退并自动迁移；支持 JSON 导入导出备份。

## 设备检测

`const isMacDevice = matchMedia('(hover: hover) and (pointer: fine)').matches;`（位于 `js/config.js`）

单一布尔值控制所有 JS 端桌面能力分支。CSS 侧通过媒体查询独立控制：
`@media (hover: hover) and (pointer: fine)`（桌面 hover）、
`@media (max-width: 1366px)`（iPad 横）、
`@media (max-width: 1024px)`（iPad 竖）、
`@media (max-width: 768px)`（iPhone）、
`@media (prefers-color-scheme: dark)`（暗色模式）。

## 三端兼容

### 全局原则
- 不改变数据结构、保存格式、业务流程和中文 Apple 风格。
- 首屏必须是可操作 App，不做营销式 landing page。
- 表单、弹窗、按钮等基础操作优先使用 click/touch 可共用逻辑。
- hover、cursor、HTML5 DnD 等桌面专属能力必须按设备分支。

### Mac（桌面端）
- 交互：鼠标/键盘，支持 hover、焦点态、HTML5 拖拽（`draggable="true"`）。
- 布局：宽屏、顶部导航、多列表单、横向 YW 卡片列表。
- CSS：`cursor: grab/pointer`、hover 光效、拖拽提示等仅在 `@media (hover: hover) and (pointer: fine)` 下生效。

### iPhone/iPad（移动端）
- 交互：仅触摸（点按、滑动），不依赖 hover、右键、HTML5 DnD。
- 移动端读取并展示已保存顺序，但不提供 HTML5 拖拽排序入口。
- 新增移动端排序能力必须另行设计触控交互和保存维度，不得复用桌面 DnD 作为核心路径。
- 所有核心操作必须基于 click/touch 事件，不得只使用 hover 触发 UI。

### iPad 适配
- 横版 `(max-width: 1366px)`：接近 Mac 布局，触控目标加大、弹窗加宽、横向滚动适配触摸。
- 竖版 `(max-width: 1024px)`：顶部导航允许换行；表单收敛为 1-2 列；优先避免横向溢出。

### iPhone 适配 `(max-width: 768px)`
- 顶部导航分两排：第一排左侧“添加”、中间“原味”、右侧“设置”；第二排体育生 chip 居中，横向滚动时固定只显示 3 个。
- iPhone 端视觉只参考 iOS App，不沿用 Mac/iPad 的厚重按钮和桌面卡片感。
- 顶部导航为固定 Liquid Glass 漂浮控件；内容通过 scroll-edge 渐隐层进入导航下方，导航控件保持清晰可点。
- 表单和弹窗采用 iOS bottom sheet 语感；弹窗底部对齐（`align-items: flex-end`），适配底部 safe-area。
- 弹窗全宽、`max-height: 85vh`、`overflow-y: auto`；裁剪弹窗和日期弹窗全宽 100%。
- iPhone 顶部导航允许使用 `backdrop-filter` 实现 Liquid Glass；如真实 iOS Safari 出现明显滚动卡顿，降级为轻量透明渐变层。

### Apple 体验与系统偏好
- 尊重系统字体、暗色模式、减少动态效果、减少透明度、safe-area、触控目标和焦点可见性。
- 新增动画必须考虑 `prefers-reduced-motion`。
- 新增玻璃、模糊、透明效果必须考虑 `prefers-reduced-transparency`。
- Liquid Glass 只服务清晰层级和上下文感，不得牺牲滚动性能、可读性或触控命中。
- 新按钮必须有可理解的文本或 `aria-label`；图标按钮保留 `title`/`aria-label`。

## 持久化与图片

### 存储
- IndexedDB: 数据库 `yw_gallery_v1`，store `app_data`，key `state`。
- localStorage 回退: key `yw_data`，IndexedDB 失败时自动回退写入。
- 自动迁移: 启动时优先加载有效 IndexedDB 数据；仅当 IndexedDB 无有效数据且 localStorage 有有效数据时迁移到 IndexedDB。两边都有不同的非空数据时优先保留 IndexedDB，并保留 localStorage 以便手动恢复。
- 导出/导入: JSON 文件下载 + 上传验证。

### 导入导出兼容
- `people[]`、`groups[]`、`categories[]`、`items[]` 是导入必需数组。
- `collapsedSubcategories`、`collapsedSettingsGroups`、`groupOrderByPerson`、`categoryOrderByPerson` 是可选兼容字段。
- 可选字段缺失时由 `sanitizeStateData()` 和 `normalizeState()` 补齐。
- 导入必须先校验根结构、重复 ID、引用关系、数量、日期、状态布尔值和图片数组类型，再覆盖当前数据。
- 任何破坏性导入或删除操作都必须显示确认弹窗。

### 图片处理
- 所有 Person、Item、Gallery 图片都存储为 base64 Data URL。
- Data URL 读取统一通过 `YW.media.readFileAsDataURL` / `YW.media.readFilesAsDataURLs` 和 FileReader 完成。
- YW 图片和个人页图片使用 `1:1`。
- 主页图片和画廊图片使用 `4:5`。
- 裁剪组件可保留 `3:4` 样式能力，但当前业务默认不主动使用。
- 裁剪输出 JPEG，质量由 `CROP_JPEG_QUALITY` 控制，当前为 `0.92`。
- `CROP_INITIAL_RECT_RATIO` 表示裁剪框初始占图比例，不是业务裁剪比例；如未来重构，业务比例应独立为语义化常量。
- 图片管理弹窗由 `photo-manager.js` 统一管理 YW 图片和画廊图片，上下文通过配置区分；支持添加、替换、删除全部图片。

## 其他关键实现

- **暗色模式**: `@media (prefers-color-scheme: dark)` 完整 CSS 变量重定义。
- **日期选择器**: 自定义 3 列滚动选择器（年/月/日），范围 1950-当前年份。
- **Form Lock**: `withFormLock(form, lockName, fn)` 防止重复提交。
- **Rail Mask**: `updateRailMask()` 使用 CSS mask-image 渐变 + ResizeObserver，让横向滚动轨道两端淡出。

## 代码规范

### 架构原则
- 保持纯前端、无框架、无构建工具；不得引入需要构建步骤的依赖。
- 继续使用 `window.YW` 命名空间 + IIFE 模块模式：`(function (YW) { ... })(window.YW);`。
- 禁止把大量业务逻辑塞回 `app.js`、`index.html` 内联脚本、事件回调或单个巨型函数。
- 跨模块 API 要小而明确，新增模块或持久化字段时同步更新两份规范文件。

### 状态与数据
- 不随意改变持久化 state key、数据结构、IndexedDB 名称、store、key 或 localStorage key。
- 修改数据模型时必须同步更新 `serializeState()`、`normalizeState()`、`YW.validators.validateImportedState()`、导入导出兼容逻辑和规范文档。
- 状态变更优先通过 `js/data.js` 中的业务函数完成；通用 state 修复放在 `js/state.js`。
- UI 模块不得直接写持久化 state；item/person/gallery 的状态切换与图片集合更新必须通过 `js/data.js` API 完成。
- 数据写入必须使用 `saveStateStrict()` 或 `scheduleSave()`；不要绕过 `js/storage.js` 直接写 IndexedDB/localStorage。
- `viewState` 只保存运行时 UI 状态，不加入持久化数据，除非明确需要跨会话保存并同步更新兼容逻辑和文档。

### DOM、事件与渲染
- 稳定 DOM 查询集中在 `js/dom.js`；其他模块优先使用 `YW.dom.elements` 和模板引用。
- 渲染模板内部查找允许在 `render.js`、`photo-manager.js`、`date-picker.js` 等模块内基于克隆片段或局部容器查询。
- 渲染逻辑集中在 `js/render.js`，数据函数不直接拼 DOM，事件模块不直接承担整块视图生成。
- 长生命周期事件在 `js/events.js` 初始化时绑定；渲染生成的短生命周期节点可在对应 render 函数中绑定。
- 弹窗、图片管理、裁剪等临时上下文可在所属模块绑定一次性 handler，但关闭或重建时必须清理。
- 事件绑定应避免重复注册；重新渲染前优先 `replaceChildren()` 重建局部节点。
- 表单提交必须使用 `withFormLock()` 防止重复提交。
- `withFormLock()` 只能由一层调用，禁止外层事件绑定和内部 handler 同时加锁。

### 复用与简洁
- 优先复用已有 helper、模板、CSS 变量和数据查询函数，避免重复工具函数、重复 DOM 构造、重复样式常量。
- 函数保持单一职责；复杂流程拆成清晰的小函数，但不要为了抽象而抽象。
- 命名保持直白统一：数据查询使用 `find/get/has`，渲染使用 `render/sync/show`，事件绑定使用 `bind/handle`。
- 注释只解释不明显的约束或兼容原因，避免描述代码字面行为。
- 删除废弃代码、无用样式和未使用 DOM 节点；不要保留“以后可能用”的冗余实现。

## 样式规范

- 保持中文 UI、Apple 风格和当前视觉语言；新 UI 应像现有页面自然延展。
- 通用设计 token 放在 `:root`；颜色、阴影、圆角、间距、模糊、边框等优先使用 CSS 变量。
- 暗色模式新增颜色必须同步在 `@media (prefers-color-scheme: dark)` 中确认可读性。
- 响应式修改放入现有断点体系：`1366px`、`1024px`、`768px`、`prefers-color-scheme`。
- 桌面 hover、cursor、拖拽提示等样式必须放在 `@media (hover: hover) and (pointer: fine)` 或更精确的桌面媒体查询内。
- iPhone 覆盖只放在 `@media (max-width: 768px)` 及其相关系统偏好媒体查询中。
- iPhone 端遵循轻量 Liquid Glass 顶部导航；不要把 Mac/iPad 的厚重按钮和卡片感直接复制到手机端。
- 弹窗、按钮、输入框必须兼顾触控目标尺寸和 safe-area；窄屏不得出现横向溢出。
- 新增图标优先复用现有 SVG symbol 或与当前内联 SVG 风格一致，避免混用多套视觉风格。
- UI 文本必须适配容器宽度，长名称优先换行或截断，避免遮挡和横向溢出。

## 可维护性与扩展约束

- 保持核心业务流程稳定：体育生 → 大品类 → 小品类 → YW，不改变用户已有数据含义。
- Mac 与移动端的桌面专属交互必须分支；移动端核心操作不得依赖 hover、右键或 HTML5 DnD。
- 任何新增排序能力都必须明确保存维度，避免破坏按体育生维度保存的大小品类顺序。
- 图片仍以 base64 Data URL 存储；如未来改为外部存储，必须设计迁移和导入导出兼容方案。
- 导入数据必须先校验再覆盖；任何破坏性操作都需要确认弹窗。
- 新增模块或跨模块 API 时，同步更新“文件与模块职责”和相关数据说明。

## 开发

- 修改代码后刷新浏览器即可生效。
- 文档或代码修改后，提交前运行 `git diff -- AGENTS.md CLAUDE.md` 或对应文件 diff 审阅变更。
- 轻量架构验证可通过静态服务打开 `tests/smoke.html`；测试逻辑位于 `tests/smoke-runner.js`，不引入测试框架或构建步骤。
- 提交前确认 `git status --short` 只包含本次任务预期文件。
- 完成验证并确认 `git status --short` 只包含本次任务预期文件后，自动提交并推送到 GitHub（git add + commit + push）。
- 代码变更导致 `AGENTS.md` 或 `CLAUDE.md` 描述不符时，询问用户是否同步更新规范。
- 仅文档更新时，提交信息建议使用 `docs: update agent guidelines`。

### 验证清单

文档或代码修改后，按变更风险选择验证范围；UI 或交互变更至少检查：
- `tests/smoke.html` 全部 PASS，覆盖导入校验、normalize、serialize 白名单和详情页 ViewModel 兼容路径。
- Mac 桌面宽屏：导航、表单、横向 YW 列表、hover、HTML5 拖拽排序。
- iPad 横版和竖版：触控目标、弹窗宽度、表单列数、横向滚动、无横向溢出。
- iPhone：两排顶部导航、3 个体育生 chip 可视范围、scroll-edge fade、bottom sheet 弹窗、safe-area。
- 暗色模式、减少动态效果、减少透明度。
- 导入导出、图片裁剪、图片管理、画廊开关和排序。
- IndexedDB 正常路径以及 localStorage 回退/迁移路径。

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

`const isMacDevice = matchMedia('(hover: hover) and (pointer: fine)').matches;`（位于 app.js 顶部）

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
- 弹窗底部对齐（`align-items: flex-end`），适配底部 safe-area
- 弹窗全宽、max-height 85vh、overflow-y auto
- 裁剪弹窗和日期弹窗全宽 100%
- backdrop-filter 移除（iOS Safari 滚动时 backdrop-filter 导致卡顿）

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

## 开发
- 修改代码后刷新浏览器即可生效
- 每次修改代码后，自动提交并推送到 GitHub（git add + commit + push）
- 代码变更导致 CLAUDE.md 描述不符时，询问用户是否更新 CLAUDE.md

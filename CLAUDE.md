# YW Gallery

纯前端单页应用，无框架，无构建工具。

## 技术栈
- index.html + app.js + styles.css，直接浏览器打开
- IndexedDB 持久化（localStorage 回退 + 自动迁移）
- 中文 UI，Apple 风格设计

## 数据模型
people → groups（大品类）→ categories（小品类）→ items（YW）

## 核心功能
- 四个主视图：主页体育生选择、体育生详情图库、添加 YW、设置/数据管理。
- 主页展示体育生卡片；体育生详情页按大品类、小品类展示 YW，并区分有图卡片与无图文本条目。
- 添加 YW 支持选择体育生、大品类、小品类，填写名称、数量、单位、日期，并标记“赠送”“现存”状态。
- 设置页支持体育生增删与图片更换；大品类/小品类增删、查看、折叠、拖拽排序；按体育生维度保存大小品类顺序。
- YW 支持新增、删除、状态切换、图片管理、同类型拖拽排序；图片支持上传、裁剪、多图轮播、添加、替换、删除。
- 数据持久化优先使用 IndexedDB，localStorage 作为回退并自动迁移；支持 JSON 导入导出备份。

## 三端兼容

### 全局原则
不改变数据结构、保存格式、业务流程和中文 Apple 风格。

### Mac 与移动端是完全不同的交互逻辑

这是项目最重要的设计约束。两类设备交互模型完全不同，代码必须按设备分支，不可混用。

**Mac（桌面端）**：
- 交互：鼠标/键盘，依赖 hover、右键菜单、HTML5 拖拽（`draggable="true"`）
- 布局：宽屏、顶部导航、多列表单、横向 YW 卡片列表
- CSS：`cursor: grab/pointer` 等仅在 `@media (hover: hover)` 下生效

**iPhone/iPad（移动端）**：
- 交互：仅触摸（点按、滑动、长按），不依赖 hover、右键、HTML5 DnD
- 拖拽排序仅在 Mac 上生效，移动端不提供拖拽排序功能（iOS Safari 不支持 HTML5 拖拽，Pointer Events 拖拽已移除）
- 所有核心操作基于 click/touch 事件，不得使用 hover 触发的 UI

### iPad 适配
- **横版 (max-width: 1366px)**：接近 Mac 布局，触控目标加大、弹窗加宽、横向滚动适配触摸。
- **竖版 (max-width: 1024px)**：顶部导航允许换行；表单收敛为 1-2 列；禁止横向溢出。

### iPhone 适配 (max-width: 768px)

窄屏单列布局，iOS 26 Safari 去容器化设计，核心原则：**去卡片化、紧凑排版、安全区适配**。

- 页面容器：`width: min(100% - 16px, 768px)`，底部留出 `80px + safe-area-inset-bottom`
- 去容器化：`.view-panel`、`.category-section`、`.subcategory-block` 均 `background: transparent`，`border/shadow: none`，通过 section header 的 `border-bottom: 0.5px solid var(--line)` 细线分隔区域
- YW 卡片：`.yw-card` `background: transparent`，仅保留 `1px solid var(--line)` 边框，`border-radius: 12px`；`.rail-card` `flex-basis: 170px`（触控目标 ≥ 44px）
- 文本条目：`.text-item-row` 完全扁平，`border-bottom: 0.5px solid var(--line)` 分隔
- 表单/布局网格：全部强制单列（`grid-template-columns: 1fr`）
- 弹窗：底部弹出（`align-items: flex-end`），`max-height: 85vh`，适配安全区
- flex row 全部换为纵向堆叠（`flex-direction: column`）
- 头像：`min(200px, 60vw)`
- 性能：禁用 `backdrop-filter`；rail 淡化遮罩缩短为 24px（CSS 变量 `--rail-fade-width`）

## 开发
- 修改代码后刷新浏览器即可生效
- 每次修改代码后，自动提交并推送到 GitHub（git add + commit + push）
- 用户要求与 CLAUDE.md 描述不符时，询问用户是否更新 CLAUDE.md
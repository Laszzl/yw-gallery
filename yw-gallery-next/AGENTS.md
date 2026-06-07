# YW Gallery Next

全新纯前端单页项目。旧版 YW Gallery 只作为经验、数据迁移和取舍参考，不作为代码起点。Codex 负责规划、任务拆分、审查和验收；Claude Code 负责按明确 brief 执行实现。

## 文档同步原则

- `AGENTS.md` 与 `CLAUDE.md` 是同等规范文件，必须保持逐字一致。
- 修改其中一份时必须同步修改另一份。
- 文档或代码修改后，提交前运行 `git diff -- AGENTS.md CLAUDE.md` 审阅规范变更，并用 `cmp -s AGENTS.md CLAUDE.md` 或等价方式确认两份文件一致。

## 技术栈

- 纯前端、无框架、无构建工具、无 npm 必需依赖。
- 源码即运行：`index.html` 可由浏览器直接打开，也可通过静态服务器访问。
- 使用 `window.YW` 命名空间和 IIFE 模块模式：`(function (YW) { ... })(window.YW);`。
- 中文 UI、系统字体、Apple 风格交互视觉。
- 默认本地个人工具，不做账号、后端服务或云同步。

## 目录职责

- `index.html`：静态 DOM、模板、`window.YW` 初始化和脚本加载顺序。
- `styles.css`：唯一样式入口，只维护 `css/*.css` 的 `@import` 顺序。
- `app.js`：应用入口，只调用初始化流程并处理启动错误。
- `css/tokens.css`：设计 token、颜色、尺寸、基础变量。
- `css/base.css`：reset、body、按钮、输入和焦点基础。
- `css/layout.css`：页面 shell、导航、主视图和基础布局。
- `css/components.css`：卡片、列表、表单、状态块等组件样式。
- `css/responsive.css`：Mac/iPad/iPhone 断点和系统偏好适配。
- `js/config.js`：常量、存储 key、断点和设备能力判断。
- `js/utils.js`：纯函数和轻量 DOM helper。
- `js/state.js`：state、viewState、normalize、serialize、旧数据迁移入口。
- `js/validators.js`：导入数据校验。
- `js/storage.js`：localStorage、IndexedDB、加载来源选择和保存队列。
- `js/view-models.js`：渲染所需派生数据。
- `js/dom.js`：稳定 DOM 查询缓存。
- `js/render.js`：视图渲染和 UI 同步。
- `js/events.js`：初始化和长期事件绑定。
- `tests/`：无框架 smoke test、fixtures 和人工验收说明。
- `agent-skills/`：项目专用 Codex/Claude skill 草案，安装或启用前必须人工审阅。
- `.claude/skills/`：Claude Code 项目级 skills，只对本项目生效。
- `briefs/`：Codex 写给 Claude Code 的单步 implementation brief。
- `reviews/`：Codex 对 Claude Code 实现结果的审查记录。
- `acceptance/`：人工验收矩阵和 milestone 验收记录。

## 数据原则

- 新版可以优化内部模型，但必须保留旧版导出 JSON 的迁移导入路径。
- 迁移只保证用户数据含义可带入，不要求新版内部字段与旧版逐字一致。
- 持久化数据必须经过 `normalizeState()` 和导入校验。
- UI 模块不得直接写持久化 state；状态变更优先通过数据层 API。
- 破坏性导入、删除和清空操作必须有确认 UI。

## 设备与 UI 原则

- Mac 可使用 hover、键盘、焦点态和桌面专属增强。
- iPad/iPhone 核心操作必须基于 click/touch，不依赖 hover、右键或 HTML5 DnD。
- iPhone 优先 iOS App 语感，顶部导航和弹窗需要考虑 safe-area。
- 新增动画必须考虑 `prefers-reduced-motion`。
- 新增透明、模糊、玻璃效果必须考虑 `prefers-reduced-transparency`。
- 暗色模式必须通过 CSS 变量或明确覆盖保持可读。

## Codex / Claude Code 协作

- Codex 产出 implementation brief，必须包含目标、改动范围、禁止事项、验收命令和预期结果。
- Claude Code 只实现当前 slice，不顺手做无关重构。
- Codex review 优先检查：数据破坏、模块职责越界、移动端不可用、重复事件绑定、破坏性操作缺确认、测试缺口。
- 每个 slice 完成后运行 smoke test，并按风险执行人工验收矩阵。
- Claude Code 默认通过项目目录内的非交互命令执行：`claude -p --permission-mode acceptEdits --output-format text "$(cat briefs/<slice>.md)"`。
- Codex review 后生成的修复 brief 只能要求修复 review 指出的具体问题，不得扩散为新功能或重构。

## Skill 策略

- Codex 官方 skills 优先使用 OpenAI 官方来源；当前安装 `define-goal`，并用 OpenAI 官方 `frontend-app-builder` 作为已移除 `frontend-skill` 的替代。
- Claude Code 项目 skills 位于 `.claude/skills/`，包括规划、brief、UI 审查、数据兼容、执行约束、无构建前端、Apple UI、数据安全和 smoke harness。
- `agent-skills/` 保留项目 skill 草案；同步到 `.claude/skills/` 前必须审阅 `SKILL.md`。
- 第三方 skill 不直接安装。安装前必须审阅 `SKILL.md`、脚本、hooks、MCP、权限、维护情况和是否会修改全局配置。
- `andrej-karpathy-skills` 暂不安装；仅将“暴露假设、小步修改、避免过度抽象、必须可验证”的原则内化到 `yw-implementation-runner`。

## Harness Engineering

- 先建测试和验收，再做功能。
- `tests/smoke.html` 必须不依赖框架、不依赖构建步骤。
- smoke test 至少覆盖 normalize、serialize 白名单、导入校验、旧数据迁移、存储加载来源选择和 ViewModel 输出结构。
- UI 或交互变更至少检查 Mac、iPad 横/竖、iPhone、暗色模式、减少动态效果和减少透明度。

## 开发与提交

- 修改代码后刷新浏览器即可生效。
- 推荐用静态服务器打开：`python3 -m http.server 8766`，再访问 `http://127.0.0.1:8766/tests/smoke.html`。
- 提交前确认 `git status --short` 只包含本次任务预期文件。
- 完成验证后再提交和推送；提交信息保持小而明确。

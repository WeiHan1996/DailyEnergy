# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-15（D-002 已接受并合并；D-003 为唯一 Ready）
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：D-003 — 完成核心流程高保真设计
- **任务状态**：Ready
- **任务 Profile**：`hybrid`（D-003 权威路由要求 design source、仓库评审资产与 full Gate 联合证明）
- **任务分支**：尚未创建；状态收尾完成后从最新 `main` 创建 `agent/d003-core-flow-design`
- **状态收尾分支**：`agent/d002-completion-handoff`，基于 D-002 merge `1fa5922`
- **当前 Issue**：[D-003 Issue #101](https://github.com/WeiHan1996/DailyEnergy/issues/101)
- **当前 PR**：无；D-003 尚未开工
- **最近完成 PR**：[D-002 PR #142](https://github.com/WeiHan1996/DailyEnergy/pull/142)，squash merge `1fa5922ebad7158c42b1fa9949b1f2f95ad71804`
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

使用 D-002 已接受的 Design Tokens、组件和 Figma library，为首日核心路径、历史日回看及不可绕过系统状态
交付可开发的高保真页面，不重新发明信息架构、内容顺序或业务行为。

D-003 范围以 Issue #101 为准：

- 完成 `ENT-001`、`ONB-001`、`DLY-001`、`DLY-002`、`DLY-003`、`REC-002`、`SYS-003`、
  `SAFE-001` 八个核心页面/状态；
- 覆盖页面清单规定的 Normal、Loading、Offline、Recoverable Error、Disabled、Completed、Fallback、
  Safety、Deleting 相应子集；
- 使用页面 ID 命名 Figma Frame，并创建 `docs/design/core-flow-high-fidelity.md` Draft 与 Frame ID 索引；
- 使用固定合成内容覆盖空/长称呼、不同内容长度、低/中/高状态、无记忆、个性化减少、局部失败和 Safety 替代；
- 每个状态复用 D-002 semantic/component Token 与组件，差异必须有明确设计理由。

不实现小程序业务代码、API、数据库、埋点或生成逻辑；不新增页面、TabBar、聊天、商城、角色、专业排盘、
完整后续页面、管理后台视觉或未经专业审核的地区危机资源。

## 2. D-002 最终交接

- 项目所有者于 2026-08-15 审核 PR #142、Figma 最终版本和归档证据后明确接受 D-002；
- `docs/design/design-system.md` 已进入 Accepted，接受范围包括 A — 温柔自然唯一方向、行动高于分数的
  信息层级、Default/High Contrast、大字和关键状态、17 个基础组件及其作为 D-003 唯一基础组件集；
- PR #142 精确 head `7139cfbdd193a8d6570b1cccfb8c4b6b01e90a45` 的 CI run `31888493133`
  已 11/11 SUCCESS，并通过 `--match-head-commit` squash 合并为
  `1fa5922ebad7158c42b1fa9949b1f2f95ad71804`；Issue #100 已关闭；
- D-002 交付 220 个 canonical Token、17 个逻辑组件合同、15 个微信原生组件目录、8 个生成产物、
  7 张本地 PNG、10 张 Figma JPEG、四个 Variables collection、8 个 Styles 和三个 `1200 x 900` Frame；
- Figma file key 为 `T5HS32Ciz6LZh81KbqhFGo`，page `83:2`，最终命名版本
  `2387487276296532390`，Foundations/Components/States root 分别为 `174:309`、`174:310`、`174:311`；
- Token 来源指纹为 `sha256:dcb100ea11fe0d534496af852983bc32d31f2d0a56ca20c4d01a2af79154d8d0`；
- SafetyScreen 保持纯结构合同，所有生产可见文案、资源、按钮与读屏名称由后续专业评审的
  `SafetyResponsePlan` 注入，D-002 未内置可上线危机文案或资源；
- 2026-08-14 最终实现与 2026-08-15 接受写回后的本地 `security` full Gate 均只因 macOS 缺少 Linux
  `flock` 返回 deployment 48/50；其余已执行阶段通过，未把本地自动化写成 PASS；
- 2026-08-15 合并后状态收尾以 D-003 `hybrid` Profile 执行 full Gate，格式、lint、架构、codegen、合同、
  Agent workflow、数据库证据、typecheck 与前置 fixtures 均越过；deployment 同样仅因缺少 Linux `flock`
  返回 48/50，自动化保持 FAIL；
- 微信 DevTools 为 `INFRA_BLOCKED`，iOS/Android 为 `MANUAL_EVIDENCE_PENDING`，专业 Safety 文案/资源
  仍待独立评审；这些状态不阻止设计规范被项目所有者接受，但继续阻止相应平台、Safety 和 Production 声明。

## 3. D-003 权威输入与依赖

开工必须读取：

1. `AGENTS.md`、`docs/agent/PROJECT_CONTEXT.md`、本文；
2. `pnpm agent:prepare D-003 --remote` 返回的全部 required sources；
3. [D-003 Issue #101](https://github.com/WeiHan1996/DailyEnergy/issues/101)；
4. Accepted [设计系统](../docs/design/design-system.md)、[视觉方向](../docs/design/visual-direction.md)及原始 Figma 证据；
5. Accepted `screen-inventory.md`、`screen-specs.md`、`interaction-states.md`、`content-layout.md`；
6. Accepted `personality.md` 与 `safety.md`。

依赖状态：

- D-001 已 Done，A — 温柔自然是唯一方向，不吸收其它路线元素；
- D-002 已 Done，其 Accepted Token、组件和 Safety 结构边界是 D-003 唯一设计基础；
- D-003 是唯一 Ready；D-004、D-005、C-001～C-017 和其它任务保持 Planned；
- D-004 被接受前不得开始 C-003、C-004、C-009 的正式页面实现；D-005 被接受前不得开始
  C-012、C-013、C-014 的正式页面实现。

## 4. 设计与验收边界

- 同一时刻只有一个突出主操作；DLY-003 首屏、长页顺序、五维渐进展开和字数预算必须符合 Accepted S-03；
- 真实记录、娱乐与行动参考、朋友表达和系统状态至少通过标题、容器、说明中的两种方式区分，不只换颜色；
- SAFE-001 全屏替代普通旅程，隐藏运势、任务、点亮、分享和普通导航；错误、离线与低状态不使用恐惧或刺激视觉；
- 常见小屏、微信竖屏、大字体和减少动态下仍能完成核心操作，长内容不遮挡主按钮或安全区；
- 必须提供八页 × 适用状态矩阵、组件/Token 使用审计、内容预算检查、规格逐项对照、Figma Frame ID、
  关键状态截图及未决差异；上游差异在开发前停止并回到权威规格审核；
- 页面数量或状态矩阵扩大时先拆 Issue，不边做边扩范围。

## 5. Requirement-to-Proof 边界

- 文档状态、链接、命名、证据字段和依赖一致性可由仓库自动检查；
- Token/组件复用可由 D-002 合同、审计清单和设计证据共同证明，但仓库检查不能替代 Figma 原始节点；
- 视觉层级、长内容、触控、读屏顺序、微信竖屏、大字体、减少动态和 Safety 替代需要人工/平台证据；
- `designSourceEvidence`、Figma file/version/Frame ID、视觉交互评审和项目所有者接受不能由自动化替代；
- D-003 在上述人工证据和用户接受完成前必须保持 Draft/In Review 与 `MANUAL_EVIDENCE_REQUIRED`，不得报告 PASS 或 Accepted。

## 6. 临时 GitHub Actions 额度约束

- 项目所有者于 2026-08-13 通知：本计费周期 Actions minutes 已使用约 90%；
- 默认先完成本地设计、证据、文档和检查，评审前只做一次必要 push；不主动重跑 workflow；
- 若确需额外运行，必须先说明必要性并取得确认。

## 7. Production / RC 未决项

- Production PostgreSQL backup/key、PITR 隔离恢复、删除/恢复拒绝独立证明：`BLOCKED`；
- 真实 on-call、告警投递/确认/升级、observability TTL/RBAC/副本与导出删除：`BLOCKED`；
- 微信 DevTools dedicated runner：`INFRA_BLOCKED`；iOS/Android 真机：`MANUAL_EVIDENCE_PENDING`；
- 专业 Safety 文案、地区资源和紧急帮助内容仍待独立审核；
- 完整 incident/recovery observation 与 Production identity/legal/region/cross-border 授权：
  `BLOCKED/PENDING`。

上述项目不是 waiver；任何一项缺失都禁止 Production readiness 或 RC PASS 声明。

## 8. 精确下一动作

1. 完成并合并当前 `agent/d002-completion-handoff` 状态收尾，只做项目状态和交接更新；
2. 从最新 `main` 创建 `agent/d003-core-flow-design`，运行 `pnpm agent:prepare D-003 --remote` 并读取全部来源；
3. 确认 Issue #101 可保持一个聚焦 PR 后，创建 `docs/design/core-flow-high-fidelity.md` Draft 与 Figma
   高保真评审入口；如范围无法独立验收，先拆 Issue；
4. D-003 获项目所有者接受并合并后，才把 D-004 移为唯一 Ready；当前不启动 D-003 实现。

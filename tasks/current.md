# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-14（D-001 已合并并进入 Done；合并后 High advisory 已最小修复；D-002 为唯一 Ready）
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：D-002 — 建立设计系统与 Design Tokens
- **任务状态**：Ready
- **任务 Profile**：`hybrid`
- **任务分支**：尚未创建；状态收口合并后从最新 `main` 创建 `agent/d002-design-system`
- **状态收口分支**：`agent/d001-completion-handoff`，基于 D-001 merge `e370094`
- **当前 Issue**：[D-002 Issue #100](https://github.com/WeiHan1996/DailyEnergy/issues/100)
- **当前 PR**：无；D-002 尚未开工
- **最近完成 PR**：[D-001 PR #140](https://github.com/WeiHan1996/DailyEnergy/pull/140)，squash merge `e37009439bce545dd1f19d19f589b209ec178b9e`
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

把 D-001 已接受的 A — 温柔自然方向转换为可复用、可审查、可由微信小程序安全消费的设计系统、
语义化 Design Tokens 和第一批基础组件，避免业务页面各自定义样式。

D-002 范围以 Issue #100 为准：

- 定义 Color、Typography、Spacing、Radius、Border、Shadow、Opacity、Motion、Icon size、Safe area
  与页面宽度规则，区分 primitive、semantic 和 component token；
- 在 Figma 建立 Variables/Styles、Default 与 High Contrast 模式；
- 建立 Issue #100 列出的 PageShell、按钮、选择、消息、内容卡、状态、确认和 Safety 首批组件；
- 创建 `docs/design/design-system.md` Draft、Figma library/Frame ID 索引，以及位于 E-004
  client-safe 边界内的代码 Token/组件交付合同；
- 如需 Token 生成或新 workspace package，先更新仓库结构权威，并证明生成确定性和 drift 拒绝。

不实现具体业务流程、高保真页面、真实 API、Dark Mode 或管理后台重设计；不启动 D-003。

## 2. 依赖与唯一方向

- D-001 已完成：项目所有者于 2026-08-13 接受 `01B / Gentle Nature / DLY-003`
  （A — 温柔自然）为唯一方向，理由为“清晰自然，排版克制，内容清晰”，且明确不吸收其它路线元素；
- D-001 PR #140 已在精确 head `8e32de318ea01442b791d7efeed36362991bbe03` 上以
  `--match-head-commit` squash 合并，Issue #99 已关闭；
- E-004 微信原生小程序 TypeScript 骨架已 Done，client-safe、公开配置、生成目录和 bundle Gate 可用；
- D-002 是唯一 Ready 任务；D-003～D-005、C-001～C-017 和其它任务均保持 Planned；
- D-004 被接受前不得开始 C-003、C-004、C-009 的正式页面实现；D-005 被接受前不得开始
  C-012、C-013、C-014 的正式页面实现；
- Production/RC 继续 `NO_GO`，D-002 不触碰 Production、真实用户数据、secret、云资源或服务器。

## 3. D-001 最终交接

- Figma file key：`T5HS32Ciz6LZh81KbqhFGo`；A 视觉基线版本
  `2386995845583123461`、Frame `1:119`；
- 接受记录版本 `2387205319197099564` 已在 `00 / Read me`（Frame `12:164`）和
  `07 / Decision Matrix`（Frame `12:239`）写回唯一方向、理由、`None / 不吸收`、状态和日期；
- 13 个稳定命名 Frame 均已核验；B 代表页父 Frame 为 `1:132`，旧 `1:149` 是子文本层；
- A 权威 `420 x 920` 截图、仓库同步稿、五路线历史对比、小屏、大字、非颜色状态和减少动态证据均已归档；
- D-001 final-head PR CI run `31719741937` 在 head `8e32de3` 上 11/11 SUCCESS；本机 full Gate
  仍因 macOS 缺少 Linux `flock` 返回 deployment 48/50，未改写为 PASS；
- PR #140 于 2026-08-14 获项目所有者审核通过，并 squash 合并为 `e370094`；Issue #99 自动关闭。

## 4. 合并后供应链阻断与修复

- merged-main CI run `31720488027` 对 `e370094` 的 9 个 automated lane 全部 SUCCESS，但
  `supply-chain` 以 `CI_AUDIT_THRESHOLD_EXCEEDED` 拒绝 High advisory
  `GHSA-2v37-7h3g-55p8`，聚合 Gate 因而失败；未重跑 workflow，也未把 main CI 写成 PASS；
- Advisory 于 2026-08-13 更新，影响 `nanoid < 3.3.18`：向 `customAlphabet` 或 `customRandom`
  传入外部可控的 `size=0` 可导致无限循环；仓库 production 链为
  `Next 16.3.0 -> postcss 8.5.23 -> nanoid 3.3.17`；
- 现有精确 pnpm override 已最小提升为 `nanoid 3.3.18`，未增加漏洞豁免、未改变直接依赖或应用逻辑；
- 本地 `pnpm install --frozen-lockfile`、production 依赖唯一版本 `3.3.18`、Admin production build、
  Admin bundle Gate 和 miniapp build 通过；
- 本机默认 `pnpm run ci:audit` 因用户级 `registry.npmmirror.com` 不提供 audit endpoint，返回
  `CI_AUDIT_RESULT_INVALID:metadata`；临时忽略该用户配置并使用官方 npm registry 后，同一仓库
  fail-closed 命令返回 `CI_AUDIT_OK:critical=0:high=0`；未修改用户配置或仓库策略；
- 本机供应链 evidence 仍按既有策略拒绝 Darwin 专属 optional 包
  `@img/sharp-libvips-darwin-arm64` 的 LGPL license，未为本次修复扩大 Linux allowlist。最终 Linux
  license/SBOM/digest 与 audit 证据由状态收口 PR 的固定 supply-chain CI 补齐；不得主动重跑。
- `pnpm agent:validate --mode=full --task=D-002` 已执行：Profile 为 `hybrid`，格式、lint、架构、
  codegen、合同、Agent workflow、typecheck 和前置测试通过；deployment 仍为 48/50，唯一根因是
  macOS 缺少 Linux `flock` 的 `RELEASE_LOCK_RUNTIME_MISSING:flock`，整体保持 FAIL，未改写为 PASS。

该 advisory 是 D-001 合并后出现的安全阻断，按 AGENTS 的 urgent safety 规则优先收口；不改变 D-001
设计结论，也不扩展 D-002 范围。

## 5. D-002 权威输入与证明

开工必须读取：

1. `AGENTS.md`、`docs/agent/PROJECT_CONTEXT.md`、本文；
2. `pnpm agent:prepare D-002 --remote` 返回的全部 required sources；
3. [D-002 Issue #100](https://github.com/WeiHan1996/DailyEnergy/issues/100)；
4. [D-001 Accepted 视觉方向](../docs/design/visual-direction.md)及原始 Figma 证据；
5. Accepted `screen-inventory.md`、`screen-specs.md`、`interaction-states.md`、`content-layout.md`；
6. Accepted `repository-structure.md`、E-004 `apps/miniapp/README.md`、附近代码、现有 bundle/codegen Gate。

Requirement-to-Proof 边界：

- Token 命名、映射、生成确定性、drift、client-safe import、build 和 bundle 由自动检查证明；
- 对比度、常见大字体、约 44px 触控目标、焦点/读屏名称、减少动态、色觉差异和组件状态由设计证据
  加人工/平台检查共同证明；
- `designSourceEvidence`、Figma Variables/Styles、Frame ID、视觉交互评审和项目所有者接受不能由
  仓库自动化替代；证据缺失时终态必须保持 `MANUAL_EVIDENCE_REQUIRED`。

## 6. 实施边界

- 唯一视觉输入是 A — 温柔自然，不从 B、C、D、E 吸收元素；如需改选或混合主方向，先回到 D-001
  决策记录并获得项目所有者确认；
- 页面只消费 semantic/component token；primitive 值只存在于 foundations；
- Figma 名称、文档映射与代码 Token 必须一一对应；生成产物有单一来源和不可手改边界；
- 小程序路径不得引入 Node、Nest、Prisma、Redis、BullMQ、Prompt、provider SDK、server package、
  Admin client、secret 或第三方运行时污染；
- 状态不能只靠颜色；Safety 必须退出普通品牌娱乐层，现实帮助保持首屏；
- 不创建没有产品需求的 Dark Mode，不把 D-001 概念色值直接复制成未经验证的正式 Token；
- 若设计与代码合同不能在一个聚焦 PR 中独立验收，开工前先拆 Issue，不边做边扩范围。

## 7. 临时 GitHub Actions 额度约束

- 项目所有者于 2026-08-13 通知：本计费周期 Actions minutes 已使用约 90%；
- 默认先完成本地编辑、检查和提交，评审前只做一次必要 push；不主动重跑 workflow；
- D-001 状态同步与 nanoid High advisory 修复合并为同一个收口 PR，避免两次独立 CI；
- D-002 后续同样应在本地收敛后再一次性 push，确需额外运行必须先说明原因并取得确认。

## 8. Production / RC 未决项

- Production PostgreSQL backup/key、PITR 隔离恢复、删除/恢复拒绝独立证明：`BLOCKED`；
- 真实 on-call、告警投递/确认/升级、observability TTL/RBAC/副本与导出删除：`BLOCKED`；
- 微信 DevTools dedicated runner：`INFRA_BLOCKED`；iOS/Android 真机：`MANUAL_EVIDENCE_PENDING`；
- 完整 incident/recovery observation 与 Production identity/legal/region/cross-border 授权：
  `BLOCKED/PENDING`。

上述项目不是 waiver；任何一项缺失都禁止 Production readiness 或 RC PASS 声明。

## 9. 精确下一动作

1. 完成当前状态收口分支的格式、Agent workflow、锁文件、build 和 full Gate；
2. 只 push 一次并创建聚焦 Draft PR，等待 exact-head Linux CI 验证 nanoid audit 修复；不重跑；
3. 项目所有者另行审核该收口 PR；批准并合并后更新本地 `main`；
4. 运行 `pnpm agent:prepare D-002 --remote`，确认返回 `READY`，再创建 `agent/d002-design-system`；
5. 如 Issue #100 可保持一个独立验收 PR，创建 `docs/design/design-system.md` Draft、Figma Variables/Styles
   与首批组件评审入口；否则先拆 Issue；
6. D-002 获项目所有者接受并合并后，才把 D-003 移为唯一 Ready；当前不启动 D-003。

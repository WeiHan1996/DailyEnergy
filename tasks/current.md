# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-15（项目所有者已接受 D-002；PR #142 精确 head Gate 与合并待完成）
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：D-002 — 建立设计系统与 Design Tokens
- **任务状态**：In Review
- **任务 Profile**：`security`（最终 Safety 边界截图触发安全与隐私权威路由，须执行 full Gate）
- **任务分支**：`agent/d002-design-system`，基于状态收口 merge `128ee8d`
- **当前 Issue**：[D-002 Issue #100](https://github.com/WeiHan1996/DailyEnergy/issues/100)
- **当前 PR**：[D-002 PR #142](https://github.com/WeiHan1996/DailyEnergy/pull/142)，Draft；接受记录写回并通过精确 head Gate 后转 Ready 合并
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
- D-002 是当前 In Review 任务；项目所有者已于 2026-08-15 接受代码、Figma source、设计规范与三张
  Safety 边界刷新证据，PR #142 合并待完成；D-003～D-005、
  C-001～C-017 和其它任务均保持 Planned；
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
- `pnpm agent:validate --mode=full --task=D-002` 曾在 Blocked 状态重新执行：当时有效 Profile 为
  `hybrid`，格式、lint、架构、codegen、合同、Agent workflow、typecheck 和前置测试通过；deployment
  仍为 48/50，唯一根因是 macOS 缺少 Linux `flock` 的 `RELEASE_LOCK_RUNTIME_MISSING:flock`，自动化
  状态保持 FAIL，未改写为 PASS。该记录是最终 Safety 证据恢复前的历史执行，最终 `security` Gate 见第 7 节。

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
  仓库自动化替代；项目所有者接受已于 2026-08-15 获得，平台与专业 Safety 证据继续独立 pending。

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

## 7. 当前实现进展

- `apps/miniapp/design-tokens.json` 已建立 220 个 canonical Token；Figma 导入量为 Primitive 86、
  Default 70、High Contrast 70、Component 33，来源指纹为
  `sha256:dcb100ea11fe0d534496af852983bc32d31f2d0a56ca20c4d01a2af79154d8d0`；
- `apps/miniapp/component-library.json` 已登记 17 个逻辑组件合同，落在 15 个微信原生组件目录；
- 已建立确定性 WXSS/TypeScript、评审 CSS、Figma manifest/导入文件生成，缺失/手改 drift、组件完整性、
  raw Token、client-safe bundle 与关键无障碍信号 Gate；
- 生成器已升级为 `daily-energy-design-tokens-v4`，直接生成 Prettier-compatible 确定性产物，并把
  Prettier 版本纳入来源指纹；Figma 跨 collection alias 使用已解析 `$value` 加
  `com.figma.aliasData`，同步与构建调用方均使用 async/await，8 个产物通过格式幂等和 drift Gate；
- `docs/design/design-system.md` 已于 2026-08-15 进入 Accepted，`docs/design/assets/d002/` 本地评审页已建立；320、390、736
  预览与 1.25x 大字、High Contrast、Reduced Motion 的既有测量仍有效，7 张本地截图均为 READY；
  Safety 占位改版后的 `safety-screen.png` 已原样归档；
- 2026-08-14 final focused 本地检查已通过：`pnpm design-tokens:test`、`pnpm design-tokens:check`、
  `node tooling/test-miniapp-design-system.mjs`、`node tooling/check-miniapp-design-system.mjs`、
  `pnpm --filter @daily-energy/app-miniapp build`、`git diff --check`；24 组文字对比和 6 组非文字对比均达门槛；
- 2026-08-14 最终实现与 2026-08-15 接受记录写回后均执行
  `pnpm agent:validate --mode=full --task=D-002`，有效 Profile 为 `security`；格式、lint、架构、codegen、
  合同、Agent workflow、数据库证据、typecheck 和 D-002 fixtures 均越过；deployment 均为 48/50，两个
  失败测试同因 macOS 缺少 Linux `flock`（`RELEASE_LOCK_RUNTIME_MISSING:flock`），自动化准确保持 FAIL；
  PR #142 初始 head `c6dc13f` 的 Linux CI 已 11/11 SUCCESS；
- Figma `D-002 / Design System` page `83:2` 的四个正式 collection 已导入并核验为
  `86 / 70 / 70 / 33`，代表 alias `color/canvas -> color/paper/50` 与
  `button/height -> size/control` 可见；
- 8 个 Text/Effect Styles 已建立并绑定真实节点，17 个逻辑 Components 与真实 SafetyScreen instance
  已核验；Foundations `174:309`、Components `174:310`、States `174:311` 均为 `1200 x 900`；
- SafetyScreen 已收敛为纯结构合同：所有可见文案、按钮和 ARIA 名称均由属性注入且默认值为空，Gate
  使用 `MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY` 拒绝内置未经评审文案，同时保留两个事件、三个资源状态
  属性和两个按钮的注入式 Loading 文案；12 个 known-fail fixture 与真实仓库 Gate 已复验通过；
- 最终命名版本 `D-002 Design System / dcb100ea / safety boundary final`（`2387487276296532390`）已建立；
  10 张当前 Figma JPEG 已归档并目视核验，其中 Components `174:310` 与 States `174:311` 两张刷新证据
  均为 `1456 x 731`，最终版本与 instance 继续证明占位文案及组件复用；
- 项目所有者已从当前本地评审页手动提供 `safety-screen.png`；Agent 已原样归档并核验为
  `1710 x 542` RGBA PNG，SHA-256 为
  `016063e506d3d86bb3d08493cff02ab9eee219324c61e396a21dfbeee82ebc3c`，五项最新占位完整且未见裁切或重叠；
- 三张刷新证据与最终本地 Gate 记录已齐备；项目所有者于 2026-08-15 明确接受 D-002，设计规范进入
  Accepted。微信 DevTools、真机、专业 Safety 与 Production/RC 证据不因本次接受而解除。

## 8. 临时 GitHub Actions 额度约束

- 项目所有者于 2026-08-13 通知：本计费周期 Actions minutes 已使用约 90%；
- 默认先完成本地编辑、检查和提交，评审前只做一次必要 push；不主动重跑 workflow；
- D-001 状态同步与 nanoid High advisory 修复合并为同一个收口 PR，避免两次独立 CI；
- D-002 后续同样应在本地收敛后再一次性 push，确需额外运行必须先说明原因并取得确认。

## 9. Production / RC 未决项

- Production PostgreSQL backup/key、PITR 隔离恢复、删除/恢复拒绝独立证明：`BLOCKED`；
- 真实 on-call、告警投递/确认/升级、observability TTL/RBAC/副本与导出删除：`BLOCKED`；
- 微信 DevTools dedicated runner：`INFRA_BLOCKED`；iOS/Android 真机：`MANUAL_EVIDENCE_PENDING`；
- 完整 incident/recovery observation 与 Production identity/legal/region/cross-border 授权：
  `BLOCKED/PENDING`。

上述项目不是 waiver；任何一项缺失都禁止 Production readiness 或 RC PASS 声明。

## 10. 精确下一动作

1. 在 PR #142 写回 2026-08-15 接受记录，执行必要本地检查后一次 push，不主动重跑 Actions；
2. 核验该精确 head 的同一 CI run 11/11，转为 Ready，并按用户本次明确授权 squash merge；
3. 合并后从最新 main 创建聚焦状态收尾分支，把 D-002 设为 Done、仅把 D-003 移为 Ready，并验证 merged main。

# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-13（A — 温柔自然已选定；等待理由、次方向元素与最终接受）
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：D-001 — 确定品牌与视觉方向
- **任务状态**：In Review
- **任务 Profile**：`design`
- **任务分支**：`agent/d001-visual-direction`（基于 `cad3a98`）
- **当前 Issue**：[D-001 Issue #99](https://github.com/WeiHan1996/DailyEnergy/issues/99)
- **当前 PR**：[D-001 Draft PR #140](https://github.com/WeiHan1996/DailyEnergy/pull/140)；A 已在本地选为唯一主方向，远程 PR 暂未更新，等待理由、次方向元素与明确接受
- **最近完成 PR**：[E-014 PR #138](https://github.com/WeiHan1996/DailyEnergy/pull/138)，squash merge `c1ad026cd1ac1be131b56b8f5c82bf76e407b503`
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

在不改变已接受产品定位、信息架构和页面结构的前提下，比较五条真实可区分的品牌视觉路线，
由项目所有者选定一条，作为 D-002 设计系统与 Design Tokens 的唯一方向输入。

D-001 的交付范围以 Issue #99 为准：

- 用同一组固定合成内容和同一张 DLY-003 概念页制作“温柔自然、清醒高级、轻快能量、都市柔光、克制空间”五条方向板；
- 定义品牌关键词、反关键词、色彩、排版、图形、插画、图标、动效、微信可实施性和无障碍约束；
- 记录参考素材来源与许可，不把未获许可资产当成可交付品牌资产；
- 建立 Figma 评审入口、Frame ID 清单和 `docs/design/visual-direction.md` Draft；
- 在用户明确选择前保持 Draft，不提前声明视觉方向 Accepted。

不做完整 Token/组件库、全部高保真页面、业务页面实现、管理后台重设计或 Accepted 信息架构修改。

## 2. 依赖与边界

- S-02 信息架构、S-03 页面/交互规格和 S-04 静态原型/可用性计划均为 Done，D-001 依赖已满足；
- E-014 已完成，Phase 1 已结束；Phase 2 development 获条件放行；
- D-001 是唯一 In Review 任务；D-002～D-005、C-001～C-017 和其它任务均保持 Planned；
- D-001 不得降低 Accepted 产品定位、人格、页面状态、无障碍、隐私、Safety、删除、幂等或微信
  client-safe 边界；如需改变一级导航、产品承诺或高风险流程，停止并回到上游规范/ADR；
- Production/RC 仍为 `NO_GO`，D-001 不触碰 Production、真实用户数据、secret、云资源或服务器。

## 3. E-014 最终交接

- 用户于 2026-08-12 接受 `CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`，完成 security
  profile 的 `threatBoundaryReview`，并仅为 PR #138 本次 development merge 接受 GitHub Free
  残余风险；Production authorization 明确未授予；
- PR #138 final head `8365e41ad98034e724bb46bc3cb889c4861569de` 的固定 Ubuntu CI run
  `31586034272` 同一 run 11/11 SUCCESS；exact-head verifier 返回
  `CI_MANUAL_MERGE_GATE_OK`，审计记录见
  [PR comment](https://github.com/WeiHan1996/DailyEnergy/pull/138#issuecomment-5265330997)；
- PR #138 使用 `--match-head-commit` 的补偿控制 squash 合并为
  `c1ad026cd1ac1be131b56b8f5c82bf76e407b503`，Issue #52 已关闭；
- merged-main CI run `31586384383` attempt 1 仅因 Docker Hub 拉取固定 Tempo 镜像时
  `Client.Timeout exceeded while awaiting headers` 失败；失败 jobs 重跑后 attempt 2 同一提交
  11/11 SUCCESS；这次基础设施瞬时失败未被改写为首次即通过；
- 本机 task/full Gate 仍如实保留 macOS 缺少 Linux `flock` 导致 deployment 48/50 的
  `RELEASE_LOCK_RUNTIME_MISSING:flock`；未放宽合同，最终 Linux 权威证据来自 exact-head PR CI。

## 4. D-001 证明要求

`D-001` 是 `design` profile。自动检查只能验证仓库状态、链接、格式和证据字段，不能替代下列
人工/外部证据：

- `figmaFile`；
- `figmaVersion`；
- `frameIds`；
- `stateScreenshots`；
- `tokenAndComponentReuse`；
- `userAcceptance`。

开工后必须读取 `pnpm agent:prepare D-001 --remote` 返回的全部 required sources，以及 Issue #99
列出的产品愿景、人格、信息架构、页面规格、内容布局和原型验证原文。缺少 Figma 原始证据或用户
方向选择时，最终状态只能是 `MANUAL_EVIDENCE_REQUIRED`，不能报告 PASS 或 Accepted。

### 4.1 已完成交付

- [视觉方向 Draft](../docs/design/visual-direction.md)：五条路线、反模式、状态对照、决策矩阵、
  概念级 Token/组件复用和 Figma Frame 命名；
- [仓库评审入口](../docs/design/assets/d001/index.html)：同一固定内容和 DLY-003 信息顺序下的
  “温柔自然、清醒高级、轻快能量、都市柔光、克制空间”方向板与代表页；
- [素材与许可记录](../docs/design/assets/d001/README.md)：所有图形为本任务原创，未使用第三方
  图片、插画、图标库、照片或字体文件；
- `docs/INDEX.md`、`docs/design/README.md` 和 `tasks/backlog.md` 已同步为 Draft/In Progress。

### 4.2 验证记录

- `pnpm agent:prepare D-001 --remote`：`READY`，remote check `PASS`，design terminal status
  `MANUAL_EVIDENCE_REQUIRED`；
- Prettier（D-001 全部新增/修改文件）：通过；`git diff --check`：通过；
- 固定内容检查：五条代表页的核心提示、主要行动和点亮条件均逐字一致；
- `pnpm run agent:check`：通过，9 task routes、6 profiles、8 path rules；
- 敏感内容模式扫描：无命中；
- `pnpm agent:validate --mode=changed --task=D-001`：策略因新增 HTML/CSS 保守提升为 hybrid/full；
  文档、架构、Schema、Agent workflow、数据库静态证据等通过，deployment 48/50 因本机 macOS
  缺少 Linux `flock` 失败；
- `pnpm agent:validate --mode=task --task=D-001`：同一已知 `RELEASE_LOCK_RUNTIME_MISSING:flock`
  失败；未将结果改写为 PASS；
- 2026-08-13 Figma 证据回填后重跑 `pnpm agent:validate --mode=changed --task=D-001`：策略仍提升为
  hybrid/full，deployment 仍为 48/50 且根因仍是本机缺少 Linux `flock`；未放宽合同或改写为 PASS；
- 2026-08-13 补充 D/E 五路线后运行 `pnpm agent:validate --mode=full --task=D-001`：profile 为
  hybrid，前置格式、架构、合同、Agent workflow、数据库等检查通过；deployment 仍为 48/50，唯一
  根因仍是本机缺少 Linux `flock` 的 `RELEASE_LOCK_RUNTIME_MISSING:flock`；自动化状态保持 FAIL，
  任务终态保持 `MANUAL_EVIDENCE_REQUIRED`；
- 2026-08-13 记录 D 暂定主方向后，本地 Prettier、`git diff --check`、`pnpm run agent:check` 通过；
  changed Gate 仍按策略提升为 hybrid/full，唯一根因仍是上述 `flock` 环境限制；本次未 push、未更新
  PR，也未触发 GitHub Actions；
- 2026-08-13 D 首轮阅读层级修订：本地 360px/736px 均无横向溢出；五路线的分数、重点、核心提示、
  解释、主要行动、行动说明、主操作和点亮条件经去除路线装饰标签后逐项一致；新增 D 的 360px 完整
  手机截图与 Figma Frame 证据；Prettier、`git diff --check`、Agent workflow 通过；changed Gate 仍按
  策略提升为 hybrid/full，唯一根因仍是 macOS 缺少 Linux `flock`。远程 GitHub 状态保持不变，未
  触发 Actions；
- 2026-08-13 D 一屏浓缩修订：本地 `360 x 844` 视口中的 D 手机稿为 `312 x 734`，问候、能量摘要、
  今日重点、解释、主要行动、按钮和点亮条件全部完整可见；Figma D Frame `12:66` 保持 `420 x 920`，
  同样完整落入一屏。层级通过内容浓缩、分组、梅子/青瓷色与留白建立，不以整体放大字号替代信息设计；
  新增浏览器与 Figma 一屏证据，D 评审版本为 `2387112673004022103`；本轮仍未 push、未更新 PR，
  也未触发 GitHub Actions；
- 2026-08-13 D 一屏收口复核：本地 `320 x 844`、`360 x 844`、`390 x 844` 三个视口均无横向溢出或
  内容块重叠；D 手机稿高度分别为约 `794`、`734`、`710` px，完整保留今日重点、解释、行动、按钮和
  点亮条件。Prettier、`git diff --check`、Agent workflow 通过；full Gate 按策略提升为 hybrid，唯一
  根因仍为 macOS 缺少 Linux `flock` 的 `RELEASE_LOCK_RUNTIME_MISSING:flock`，自动化状态保持 FAIL；
  Figma 后续异常版本已排除为评审证据，B 代表页父 Frame ID 降为待人工复核；
- 2026-08-13 项目所有者经过进一步比较，选择 `01B / Gentle Nature / DLY-003`，即 A — 温柔自然，
  替代此前暂定的 D — 都市柔光。A 已记录为唯一主方向；D 的一屏修订保留为历史对比与信息层级参考。
  方向选择证据为 READY，但选择理由、允许吸收的次方向元素和 D-001 明确接受仍为 Pending，因此
  D-002 不解锁；本轮继续遵守 Actions 额度约束，只做本地记录与验证；
- 浏览器视觉检查：320px 与 390px 均无页面横向溢出；已保存小屏、浏览器大字放大、非颜色状态和
  Figma 总览截图；新增五路线在 360px 与 736px 下也无横向溢出；评审页无持续动画，减少动态偏好会
  关闭平滑滚动。微信真机验证不在 D-001 内。

### 4.3 当前人工/外部证据

- `figmaFile`：Ready；新 team 权限可用，文件已创建并移入 `Team project`，file key
  `T5HS32Ciz6LZh81KbqhFGo`；
- `figmaVersion`：Ready；A 主方向使用五路线基线版本 `2386995845583123461` 中的
  `01B / Gentle Nature / DLY-003`（Frame `1:119`）；D 一屏版本 `2387112673004022103`、首轮阅读
  层级版本 `2387049154733899236` 和原三路线版本 `2386868263609163928` 保留历史；后续异常版本
  `2387114962205307387` 已恢复且不作为评审证据；
- `frameIds`：Partial；12 个稳定命名 Frame ID 已核验，D/E 分别为 `12:36`、`12:66`、`12:101`、
  `12:133`，五路状态/决策对照为 `12:183`、`12:239`；B 代表页顶层 row 显示为 `1:132`，旧记录
  `1:149` 是子文本层，待 Figma 可稳定读取时再次人工核验父 Frame；
- `stateScreenshots`：Ready；证据索引包含五路线 Figma 总览、360px、736px、原 320px/390px
  历史证据、浏览器大字放大和非颜色状态；减少动态规则已核对，真机系统字号/减少动态验证留给
  D-002 及后续任务；
- `tokenAndComponentReuse`：Ready for D-001；同一语义槽位、固定内容/顺序和对应 Frame 可追踪，
  不冒充 D-002 的完整 Variables、Tokens 或正式组件库；
- `directionSelection`：Ready；项目所有者于 2026-08-13 选择 A — 温柔自然（Frame `1:119`）为唯一
  主方向，替代此前暂定的 D — 都市柔光；
- `userAcceptance`：Pending；尚未提供最终选择理由、允许吸收的次方向元素或明确接受 D-001，
  D-002 不解锁。
- 2026-08-13 D 路线首轮反馈及修订：分数从 80px 主视觉降为 30px 辅助数字；今日重点提升为
  26px；解释首句/正文提升为 17px/16px 并按完整句分组；“今天可以这样做”和主要行动使用梅子色及
  `Noto Serif SC` 18px/24px 层级。Figma Frame `12:66` 保持不变，新固定版本
  `2387049154733899236`；等待项目所有者复核，尚未构成最终接受。
- 2026-08-13 D 路线一屏反馈及修订：进一步把 `72` 与整体能量合并为辅助摘要，取消进度条；今日重点
  使用梅子左线窄条，核心判断控制为两行；解释浓缩为一段可扫读正文；青瓷行动区承担主视觉，按钮和
  点亮条件保持完整。浏览器 `360 x 844` 与 Figma `420 x 920` 均实现一屏完整显示，仍待项目所有者复核，
  尚未构成最终接受。

### 4.4 临时 GitHub Actions 额度约束

- 项目所有者于 2026-08-13 通知：GitHub 方案每月包含 2,000 Actions minutes，本计费周期已使用 90%；
- 本计费周期内默认只做本地编辑、提交与验证；非必要不 push、不重跑 workflow、不改变可能触发
  Actions 的 PR 状态或执行其它远程写操作；
- 确有必要触发 Actions 时，必须先说明原因并取得项目所有者确认；
- 本次“A 已选定”决定先仅记录在本地分支，不更新远程 Draft PR #140，以免产生非必要运行。

## 5. Production / RC 未决项

- Production PostgreSQL backup/key、PITR 隔离恢复、独立 current deletion/restore-deny ledger、
  deleted-data detector 和 recovery-copy destruction：`BLOCKED`；
- 真实 on-call recipient、alert canary delivery/ack/escalation：`BLOCKED`；
- 真实 observability backend TTL/RBAC/replica/export/support copy deletion 与独立 outage fault
  domain：`BLOCKED`；
- 微信 DevTools dedicated runner：`INFRA_BLOCKED`；iOS/Android 真机：
  `MANUAL_EVIDENCE_PENDING`；
- named Incident Commander 与 Safety/Privacy/Security reviewer 的完整 incident/recovery observation：
  `MANUAL_EVIDENCE_PENDING`；
- 云/独立 stateful services/域名/主体/Production identity/legal/region/cross-border 授权：
  `BLOCKED/UNVERIFIED`。

上述项目不是 waiver；任何一项缺失都禁止 Production readiness 或 RC PASS 声明。

## 6. 精确下一动作

1. 项目所有者补充选择 A — 温柔自然的最终理由，并明确允许从其它路线吸收哪些元素（也可明确“不吸收”）；
2. 将 A 选择、理由和次方向元素同步到 Figma Read me/Decision Matrix，保存新的选择版本；同时再次核验
   B 代表页父 Frame ID，不再改动 B 文本图层；
3. 项目所有者复核更新后的 A 方向证据并明确接受 D-001；
4. 接受后更新视觉方向文档和项目状态；待 Actions 额度允许或项目所有者授权后，再更新远程 Draft PR #140、
   完成审核与合并并把 D-002 移为唯一 Ready；不在当前任务中启动 D-002。

# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-12（E-014 已合并，Phase 2 已开始，D-001 为唯一 Ready）
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：D-001 — 确定品牌与视觉方向
- **任务状态**：Ready
- **任务 Profile**：`design`
- **任务分支**：尚未创建；状态同步完成后从最新 `main` 创建 `agent/d001-visual-direction`
- **当前 Issue**：[D-001 Issue #99](https://github.com/WeiHan1996/DailyEnergy/issues/99)
- **当前 PR**：无；D-001 尚未开工
- **最近完成 PR**：[E-014 PR #138](https://github.com/WeiHan1996/DailyEnergy/pull/138)，squash merge `c1ad026cd1ac1be131b56b8f5c82bf76e407b503`
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

在不改变已接受产品定位、信息架构和页面结构的前提下，比较三条真实可区分的品牌视觉路线，
由项目所有者选定一条，作为 D-002 设计系统与 Design Tokens 的唯一方向输入。

D-001 的交付范围以 Issue #99 为准：

- 用同一组固定合成内容和同一张 DLY-003 概念页制作“温柔自然、清醒高级、轻快能量”三条方向板；
- 定义品牌关键词、反关键词、色彩、排版、图形、插画、图标、动效、微信可实施性和无障碍约束；
- 记录参考素材来源与许可，不把未获许可资产当成可交付品牌资产；
- 建立 Figma 评审入口、Frame ID 清单和 `docs/design/visual-direction.md` Draft；
- 在用户明确选择前保持 Draft，不提前声明视觉方向 Accepted。

不做完整 Token/组件库、全部高保真页面、业务页面实现、管理后台重设计或 Accepted 信息架构修改。

## 2. 依赖与边界

- S-02 信息架构、S-03 页面/交互规格和 S-04 静态原型/可用性计划均为 Done，D-001 依赖已满足；
- E-014 已完成，Phase 1 已结束；Phase 2 development 获条件放行；
- D-001 是唯一 Ready 任务；D-002～D-005、C-001～C-017 和其它任务均保持 Planned；
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

1. 先让本次 E-014 合并后状态同步 Draft PR 独立完成审核与合并；PR #138 的 GitHub Free 残余风险
   接受不适用于这次新合并，合并前必须另行获得项目所有者明确接受；
2. 从状态同步后的最新 `main` 创建 `agent/d001-visual-direction`；
3. 运行 `pnpm agent:prepare D-001 --remote`，读取全部 required sources 和 Issue #99 权威输入；
4. 建立三条可比较方向、Figma 原始证据和 `docs/design/visual-direction.md` Draft；
5. 提交一个聚焦的 D-001 Draft PR，保留 `MANUAL_EVIDENCE_REQUIRED`，等待用户选择唯一主方向；
6. D-001 被明确接受后，才把 D-002 移为唯一 Ready；不在当前交接中启动 D-002。

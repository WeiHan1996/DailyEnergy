# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-31
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-015 — C-004～C-015 统一审核修复
- **任务状态**：In Review（项目所有者已通过代码与 threat-boundary 审核；外部/真机证据及 stacked merge 策略待完成）
- **任务 Profile**：`security`（幂等、Safety、删除不复活、隐私、确定性与 analytics 可信性）
- **工作分支**：`agent/c004-c015-review-fixes`
- **修复基线**：[C-015 Draft PR #168](https://github.com/WeiHan1996/DailyEnergy/pull/168)，remote head `fd04b787926127bda64fc6cb07cfcf356d85ed8b`，CI run `33323476723` 11/11 SUCCESS
- **任务 Issue**：[C-015 Issue #68](https://github.com/WeiHan1996/DailyEnergy/issues/68)；保持 Open
- **当前 PR**：[统一修复 Draft PR #169](https://github.com/WeiHan1996/DailyEnergy/pull/169)；base=`agent/c015-core-analytics`，implementation head `6fdb3f5a9a868bdac4d8ab025ad8c9eaf29da2ed`，owner-reviewed head `405f3c29fc916cfb314f9a665e8093df57911bf6`，CI run `33357978808` 11/11 SUCCESS；PR #157～#168 保持 Draft，不改远端 stacked refs
- **下一候选动作**：项目所有者选择 stacked squash 后的 branch rewrite 或其它合并策略，并补齐外部/真机证据；PR #169 保持 Draft，不启动 C-016
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 0. 统一审核修复

- 项目所有者于 2026-08-31 明确要求修复 C-004～C-015 统一审核发现；该安全/正确性缺陷批次中断原 In Review 状态；
- 项目所有者已明确授权基于 PR #168 创建统一修复 Draft PR；授权不包含 force-push、改写 #157～#168、运行 exact-head verifier、标记 Ready 或合并；
- 统一修复 Draft PR #169 已基于 PR #168 精确 head 创建；verified status head `884a2050f19352bfb2371535a1c9f9abc29b2e6e` 的同一 CI run `33357674745` 已 11/11 SUCCESS；
- 项目所有者于 2026-08-31 明确“审核通过”，接受 PR #169 的代码修复与 differential-query/four-plane threat boundary；该决定不替代真机、生产 bundle、处理主体/位置/用户说明证据，也不授权 force-push、错误 base merge 或 Production/RC；
- 修复范围只覆盖已报告的幂等与时间边界、continuation/DayLit 收敛、Safety/删除竞态、本地敏感缓存与期限、规则/template invariant，以及 C-015 信号、指标、Gate 和基数合同；
- 不改变 Accepted 产品方向、框架、数据库或服务边界，不启动 C-016，不将人工证据或 Production/RC Gate 冒充完成；
- 修复先在独立顶层分支完成并验证；未经项目所有者授权，不 force-push 或重写现有 stacked PR；
- 原 PR head/CI 只作为修复前基线，不能继续作为修复后通过证据。

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 修复前已验证 C-004～C-015

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-008 Draft PR #161 verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`，CI run `32688523258` 11/11 SUCCESS；
- C-009 Draft PR #162 verified head `941c302995935b763dae3b45c5a56fddf68bdae2`，CI run `32692776724` 11/11 SUCCESS；
- C-010 Draft PR #163 verified head `e6dc3717ad94799ab821e6d5c983dec6dd568043`，CI run `32697952655` 11/11 SUCCESS；
- C-011 Draft PR #164 verified head `3ca1105b676cc01b6af1d9d6b4f1bf28e84d7589`，CI run `32705520165` 11/11 SUCCESS；
- C-012 Draft PR #165 verified head `b70b9e390ab5d8514d13c576f21bdade18ad18e6`，CI run `32728000420` 11/11 SUCCESS；
- C-013 Draft PR #166 verified head `e43e75ba8a18e013709578d5dfc64764c0d7b787`，CI run `32742512307` 11/11 SUCCESS；
- C-014 Draft PR #167 verified head `42be22699254a57a1607b4c2725c73e4006e6a45`，CI run `33317649790` 11/11 SUCCESS；
- C-015 Draft PR #168 当前 remote head `fd04b787926127bda64fc6cb07cfcf356d85ed8b`，CI run `33323476723` 11/11 SUCCESS；此前 implementation/status heads 只保留为历史证据；
- C-004～C-015 均保持 In Review、PR Draft、Issue Open；owner manual evidence 进入当前统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-015 修复前交付

- `packages/shared-schemas` 建立 58 个事件的 executable registry：25 PRODUCT、14 optional PRODUCT、4 GOVERNANCE、10 RUNTIME、5 SAFETY_CONTROL；逐事件平面、生产者、属性和枚举封闭，wrong plane/unknown field/provider-model/正文/高基数 ref 整条拒绝；
- `POST /v1/analytics/signals` 只接受八类 identity-free 客户端信号；服务端绑定 product date/environment，前九个计数只在进程内，第十个才写 T4，写失败直接丢弃；Mini Program 2 秒超时、不附 session、不写 storage、不跨重启 replay；
- `@daily-energy/server-core/analytics` 实现 T0 transient observation → T4 的 `k=10`、最多两维、父桶/OTHER/移除第二维/全抑制和 raw-content detector；subject key 只存在于函数入参，不进入输出；
- 23 个 S-25 metric、4 个 count-free Gate、Wilson 95% 区间和 10 个 fixed fixture 已实现；D1/D3/D7 使用当前 ActivationCycle + EncounterLink 精确 D0+1/+3/+7 和成熟窗口；Q01/Q02 明确 `UNAVAILABLE`；
- PostgreSQL 新增四张物理隔离 T4 aggregate 表、metric snapshot 与 Gate snapshot；无 raw event/user/session/device/cross-day subject 表，API/Background 均无直接读取权限；约束强制 k、两维、suppressed 无精确值、revision replacement 和 13 个自然月 expiry；
- Background 静态 capability 新增 `AnalyticsAggregationDue` / `AnalyticsRetentionDue`；queue envelope 只有既有 opaque ref/revision/time，按上一 finalized product date 调封闭 rebuild/TTL 函数；
- 第三方 analytics/BI/ad/replay SDK、用户下钻、session replay、个体实验 assignment、素材/渠道 D1/D3/D7 均有静态 Gate 并保持关闭；只使用粗 `scene_code`；
- authority/source registry 新增 S-24 106 个 Source ID 与 S-25 79 个 Source ID，当前 `538/1004 COVERED`、`466 PLANNED`、`0 NA_WITH_REASON`。

## 4. C-015 修复前验证

- `pnpm agent:prepare C-015 --remote --deep`：`READY`，Profile=`security`，15 个 required sources，remote/dependencies/Node 24.18.0/pnpm 11.17.0/GitHub PASS；
- format、lint、architecture、typecheck、contract/codegen、registry、analytics static、phase Gate 与 `git diff --check` 全部通过；contract Gate 为 60 error codes / 66 paths，55 个根 JSON Schema；
- root tests `18/18` Turbo tasks、build `9/9`；API `155/155`、Mini Program `81/81`、server adapters `56/56`、server core `61/61`、shared schemas `64/64`、Worker `10/10`、API Client `4/4`；
- 真实 PostgreSQL 18 完整 Gate `90/90`：15 migrations、80 application tables、36 enums、81 functions、SQL-001～020、TX-01～09、角色/grant、catalog drift、upgrade/rollback/restore 与 C-001～C-015 专项全部 PASS；
- C-015 PG18 专项证明 API/Background 无直接 T4 read、sub-k/第三维/未知事件拒绝、23 metric/4 Gate、D1/D3/D7=`7/20`/`4/20`/`3/20`、same revision 不加倍、revision 2 重算 D1=`8/20`、Q01 UNAVAILABLE、forbidden columns=0 与 13-month purge；
- 真实 Redis 8 / BullMQ 5 / PostgreSQL 18 queue integration `8/8`；新增 Background capability 未破坏 outbox/inbox、empty Redis rebuild、profile、guard 和 drain；
- `pnpm agent:validate --mode=changed`：`changed→full / automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=task --task=C-015`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=full --task=C-015`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- CI audit 单次 registry response metadata 异常后直接复核为 `critical=0/high=0`，三个最终 Gate 均在正常 audit 下自动化 PASS。

## 5. 统一审核修复结果

- C-004 固定跨 04:00 幂等回放与持久接受时钟；C-005 关闭 continuation visibility 竞态，并把实际 Node tzdb release 绑定到 runtime evidence、supply digest 与向后兼容的 ReleaseManifest；
- C-006 重算并验证 overall score；C-007 建立 12 类稳定 Safety violation code、精确 controlled-template binding 与一字称呼回归；
- C-008/C-010/C-011 在锁后复核 04:15/04:30、补 DAY guard 投影与可重试 DayLit outbox，并修复历史 cache note/MISSING/TTL/scope；C-009 恢复 Today 接受布局顺序；
- C-012/C-014 对 Safety/DataTask 写入强制 ACTIVE account fence；C-013 对 superseded weekly snapshot/summary 使用不续期的固定 30 天 expiry；C-014 客户端在发请求前拒绝并清除过期删除状态 grant；
- C-015 修正内存 cell identity、封闭版本桶、页面 signal wiring、M05/M19/M22、G01～G04 fail-closed evidence 与 deletion-aware source query；
- Prisma migration checksum、catalog fingerprint 与 API contract 已重新生成；正式 contract fingerprint 为 `4f25a52e42831a6ecaee032c92a92244e262169e452cf8a25389c0ba450a89a5`。

## 6. 修复后验证

- `pnpm agent:validate --mode=full --task=C-015` 使用 checksum 校验的临时 Node `24.18.0` 与官方 registry：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；required manual evidence=`threatBoundaryReview, productionAuthorizationWhenApplicable`；
- root tests `18/18` Turbo tasks、build `9/9`；API `158/158`、Mini Program `87/87`、shared schemas `64/64`、server core `65/65`、prompt library `12/12`、server adapters `57/57`；
- 真实 PostgreSQL 18 完整 Gate `90/90`，DB drift=`80 tables / 36 enums / 208 indexes / 225 constraints / 36 triggers / 83 functions`；真实 Redis 8 / BullMQ 5 / PostgreSQL queue Gate `8/8`；
- E-012 deployment contract `50/50`，证明新发布必须保存真实 tzdb release、runtime/manifest 漂移 fail closed，同时历史 ReleaseManifestV1 仍可读取；
- PR #169 verified status head `884a2050f19352bfb2371535a1c9f9abc29b2e6e` 的 CI run `33357674745` 为 11/11 SUCCESS；
- PR #169 owner-reviewed head `405f3c29fc916cfb314f9a665e8093df57911bf6` 的 CI run `33357978808` 为 11/11 SUCCESS；
- format、lint、architecture、typecheck、codegen、contract、registry、agent workflow、CI audit/supply chain、`git diff --check main` 均通过；
- full Gate 内部 `prisma generate` 的非语义格式副作用已按项目所有者授权恢复；四个 C-014 生成模型只保留行尾空白清理。

## 7. 手工证据与发布边界

- manual evidence：`tests/manual-rc/c015-evidence.json`；owner differential-query/four-plane threat review 已通过；WeChat DevTools/真机 offline no-replay、生产 bundle 无第三方 SDK 与实际主体/位置/用户说明仍 Pending，不由 Agent 自签；
- C-004～C-015 的 owner content/design/threat/real-device evidence 进入统一审核，不因自动 Gate 全绿而伪造人工 PASS；
- 生产 scheduler、incident threshold、受托方、部署、发布与 Production authorization 不属于自动 C-015 证明；Production / RC 保持 `NO_GO`。

## 8. 精确下一动作

1. 项目所有者已完成 differential-query/four-plane threat review；仍需 WeChat DevTools/真机 offline no-replay 与生产 bundle/主体/位置/用户说明证据；
2. 统一修复 Draft PR #169 已在 `agent/c015-core-analytics` 精确 head `fd04b787926127bda64fc6cb07cfcf356d85ed8b` 之上创建，仅用于当前 stacked review；没有 force-push 或改写 #157～#168；
3. #157～#168 使用 squash 时不会保留 stacked ancestry；开始合并前必须由项目所有者明确选择逐层 rebase + `force-with-lease`，或批准其它能保持可审差异的合并策略；不得把 PR #169 直接 merge 到 PR #168 分支后冒充 main 集成；
4. 当前审核通过不自动授权上述 branch rewrite/合并策略；选择前不运行 verifier、不标记 Ready 或合并；所有 PR/Issues 保持 Draft/Open，Production/RC 保持 `NO_GO`，不启动 C-016。

## 9. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 修复与新增证据通过后重新进行统一审核；项目所有者明确批准前不运行 exact-head verifier、不更新完成状态或准备合并。

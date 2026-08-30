# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-31
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-015 — 核心埋点
- **任务状态**：In Review（C-004～C-015 统一审核批次；C-015 自动 Gate 完成，等待 Draft PR final-head CI）
- **任务 Profile**：`security`（analytics 最小化、不可关联聚合、删除与 Safety/正文隔离）
- **工作分支**：`agent/c015-core-analytics`
- **Stacked base**：[C-014 Draft PR #167](https://github.com/WeiHan1996/DailyEnergy/pull/167)，verified head `42be22699254a57a1607b4c2725c73e4006e6a45`
- **任务 Issue**：[C-015 Issue #68](https://github.com/WeiHan1996/DailyEnergy/issues/68)；保持 Open
- **Draft PR**：[C-015 Draft PR #168](https://github.com/WeiHan1996/DailyEnergy/pull/168)；base=`agent/c014-data-rights`，保持 Draft
- **下一候选动作**：C-004～C-015 统一审核包（C-015 final-head CI 后）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-014

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
- C-004～C-014 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-015 已完成交付

- `packages/shared-schemas` 建立 58 个事件的 executable registry：25 PRODUCT、14 optional PRODUCT、4 GOVERNANCE、10 RUNTIME、5 SAFETY_CONTROL；逐事件平面、生产者、属性和枚举封闭，wrong plane/unknown field/provider-model/正文/高基数 ref 整条拒绝；
- `POST /v1/analytics/signals` 只接受八类 identity-free 客户端信号；服务端绑定 product date/environment，前九个计数只在进程内，第十个才写 T4，写失败直接丢弃；Mini Program 2 秒超时、不附 session、不写 storage、不跨重启 replay；
- `@daily-energy/server-core/analytics` 实现 T0 transient observation → T4 的 `k=10`、最多两维、父桶/OTHER/移除第二维/全抑制和 raw-content detector；subject key 只存在于函数入参，不进入输出；
- 23 个 S-25 metric、4 个 count-free Gate、Wilson 95% 区间和 10 个 fixed fixture 已实现；D1/D3/D7 使用当前 ActivationCycle + EncounterLink 精确 D0+1/+3/+7 和成熟窗口；Q01/Q02 明确 `UNAVAILABLE`；
- PostgreSQL 新增四张物理隔离 T4 aggregate 表、metric snapshot 与 Gate snapshot；无 raw event/user/session/device/cross-day subject 表，API/Background 均无直接读取权限；约束强制 k、两维、suppressed 无精确值、revision replacement 和 13 个自然月 expiry；
- Background 静态 capability 新增 `AnalyticsAggregationDue` / `AnalyticsRetentionDue`；queue envelope 只有既有 opaque ref/revision/time，按上一 finalized product date 调封闭 rebuild/TTL 函数；
- 第三方 analytics/BI/ad/replay SDK、用户下钻、session replay、个体实验 assignment、素材/渠道 D1/D3/D7 均有静态 Gate 并保持关闭；只使用粗 `scene_code`；
- authority/source registry 新增 S-24 106 个 Source ID 与 S-25 79 个 Source ID，当前 `538/1004 COVERED`、`466 PLANNED`、`0 NA_WITH_REASON`。

## 4. C-015 已完成验证

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

## 5. 手工证据与发布边界

- manual evidence：`tests/manual-rc/c015-evidence.json`；owner differential-query/four-plane threat review、WeChat DevTools/真机 offline no-replay、生产 bundle 无第三方 SDK 与实际主体/位置/用户说明仍 Pending，不由 Agent 自签；
- C-004～C-015 的 owner content/design/threat/real-device evidence 进入统一审核，不因自动 Gate 全绿而伪造人工 PASS；
- 生产 scheduler、incident threshold、受托方、部署、发布与 Production authorization 不属于自动 C-015 证明；Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. push PR #168 的项目控制 final head，并取得同一精确 head 的 11/11 CI SUCCESS；
2. 核对 PR #168 保持 Draft、Issue #68 保持 Open、base 精确为 `agent/c014-data-rights`；
3. 生成 C-004～C-015 统一审核包，不启动 C-016。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

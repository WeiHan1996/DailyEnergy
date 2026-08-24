# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-24
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-008 — 实现今日结果幂等生成、发布与缓存
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（C-008 code/database/contract + Safety/deletion/cache/queue boundary）
- **工作分支**：`agent/c008-daily-result-publication`
- **Stacked base**：[C-007 Draft PR #160](https://github.com/WeiHan1996/DailyEnergy/pull/160)，verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`
- **任务 Issue**：[C-008 Issue #62](https://github.com/WeiHan1996/DailyEnergy/issues/62)
- **Draft PR**：[PR #161](https://github.com/WeiHan1996/DailyEnergy/pull/161)；base=`agent/c007-local-templates`
- **下一候选任务**：C-009 — 今日内容页面（Planned；C-008 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-007

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-005 已交付 product-date-v1、StableSubjectId、seed-v1、choice-v1、GenerationManifest、continuation grant 与 PostgreSQL fences；
- C-006 已交付五维确定性 RuleFacts、ControlledExpressionPlanV1、冻结目录与稳定选择，不生成自然语言；
- C-007 已交付 strict plan Schema、指纹固定的 `daily-template-v1`、完整受控渲染、27 个 P13 AI_EVAL Source-ID 与 manual evidence；
- C-004～C-007 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-008 已完成交付

- shared-schemas、OpenAPI 与生成 client 新增 strict generation start、intent status、Today content/interaction/relationship 白名单合同；
- API 实现 `POST /daily/generation/start`、`GET /daily/generation/{intent_ref}` 与 `GET /daily/today`，owner/ProductDate/manifest/seed/guard 全部由服务端解析；
- PostgreSQL TX-02 创建唯一 owner/date intent、冻结 snapshot、command receipt 与 allowlisted outbox，重复/并发 start 读取同一事实；
- Interactive Inbox 在短事务内比较 revision 与 Safety/deletion epoch 后 claim，规则与 `daily-template-v1` 在提交后、数据库事务外执行；
- TX-03 在 account/date fence 下重查 PublishGuard、completion window 与 current revision，原子写唯一 immutable result、visibility、interaction/task 与 published outbox；
- Safety 或 DAY deletion 在候选发布前到达时取消 intent，迟到 candidate/job 不产生 AVAILABLE；确定性失败进入 terminal，不局部发布；
- Redis 只缓存带 result/source fingerprint 和 visibility revision 的 client projection；miss、stale、`FLUSHALL` 或 Redis 不可用均从 PostgreSQL AVAILABLE 重建；
- Worker 默认注册 GenerationIntentAccepted/Due handler，支持 outbox/inbox、commit-before-ACK replay、due-row rebuild 与 graceful close；
- API Redis capability、internal `api_data` network 与 deploy fingerprint 已接入；Redis 不是 API 启动或业务事实依赖；
- C-008 不接入 provider，不实现 C-009 页面、Weekly、通知、点亮写入或长期记忆。

## 4. 自动验证

- 精确工具链：官方 Node `24.18.0` + pnpm `11.17.0`；
- `agent:prepare C-008 --remote --deep`：READY，remote/deep checks PASS，最终 Profile=`security`；
- changed→full Gate：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`，完整 validate、真实 PostgreSQL、Queue 与供应链通过；
- C-008 task Gate：5/5 命令执行，`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- shared-schemas 6 files / 45 tests；server-core 7 / 37；server-adapters 12 / 44；Worker 2 / 10；API 21 / 106；
- PostgreSQL 18 全套 87/87，通过 migration/checksum/catalog drift、SQL-001～020、TX-01～09、roles、C-005 continuation 与 C-008 duplicate/concurrent/Safety/deletion/terminal 场景；
- Redis 8/BullMQ 5 全套 8/8，通过真实 outbox/inbox、ACK crash、profile、Redis loss/rebuild、cache guard 与 drain；
- Compose static 9/9、DEV deployment policy 50/50；API Redis 只位于 internal `api_data`，配置进入 capability/deploy fingerprints；
- contract codegen fingerprint `3b2f6bbc3972d3af739d5b1453f4b4f094f0812dd96d2927a4a222aa3fcc48f4`，codegen/drift/15 known-fail fixtures 通过；
- Source registry 为 `283/791 COVERED`、`508 PLANNED`，C-008 新增 4 个公开 Schema 并把 8 个适用 API/DB/privacy Source-ID 提升为满足强制层级的 COVERED；
- Phase Gate 保持 `CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`，没有把自动 green 升级为 RC/Production 准入。

## 5. 手工证据与发布边界

- C-007 owner content/threat review 仍为 Pending，等待 C-015 后统一审核，不由 Agent 自行签署；
- [C-008 人工证据](../tests/manual-rc/c008-evidence.json)保持 `MANUAL_EVIDENCE_PENDING / pass_claim=PROHIBITED`；
- transaction/PublishGuard/cache/queue fault matrix 已由自动化证明，owner threat-boundary 与删除/恢复风险接受等待 C-015 后统一审核；
- 自动测试不能替代 owner 对删除/恢复、迟到发布、权限和 Production 风险的接受；
- Production credential、provider evaluation 和部署授权不属于 C-008，Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. 推送 PR #161 handoff 回写，确认 base、Draft、Issue 与 remote head 一致；
2. 等待同一 final head 的 11/11 CI SUCCESS；
3. 保持 Issue #62 Open、PR Draft，不运行 exact-head merge verifier；
4. 从 verified C-008 final head 创建 `agent/c009-today-content-page` 并恢复 C-009 上下文。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

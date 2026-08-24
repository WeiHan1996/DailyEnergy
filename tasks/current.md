# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-24
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-010 — 实现一个主要行动与可选小任务
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（TaskState/CAS + session continuation + Safety/deletion boundary）
- **工作分支**：`agent/c010-action-task`
- **Stacked base**：[C-009 Draft PR #162](https://github.com/WeiHan1996/DailyEnergy/pull/162)，verified head `941c302995935b763dae3b45c5a56fddf68bdae2`
- **任务 Issue**：[C-010 Issue #61](https://github.com/WeiHan1996/DailyEnergy/issues/61)
- **Draft PR**：[PR #163](https://github.com/WeiHan1996/DailyEnergy/pull/163)；base=`agent/c009-today-content-page`
- **下一候选任务**：C-011 — 点亮与连续记录（Planned；C-010 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-009

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-008 Draft PR #161 verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`，CI run `32688523258` 11/11 SUCCESS；
- C-009 Draft PR #162 verified head `941c302995935b763dae3b45c5a56fddf68bdae2`，CI run `32692776724` 11/11 SUCCESS；
- C-005 已交付 product-date-v1、StableSubjectId、seed-v1、choice-v1、GenerationManifest、continuation grant 与 PostgreSQL fences；
- C-006 已交付五维确定性 RuleFacts、ControlledExpressionPlanV1、冻结目录与稳定选择，不生成自然语言；
- C-007 已交付 strict plan Schema、指纹固定的 `daily-template-v1`、完整受控渲染、27 个 P13 AI_EVAL Source-ID 与 manual evidence；
- C-008 已交付唯一 intent/AVAILABLE、PublishGuard、Interactive Worker/outbox/inbox、start/status/today API、Redis projection cache 与真实 PG18/Redis8/BullMQ5 证据；
- C-009 已交付 DLY-002/DLY-003/REC-002、strict history contract/API、unknown outcome recovery、validated offline cache 与 D-004 manual evidence；
- C-004～C-009 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-010 已完成交付

- shared-schemas、OpenAPI 与生成 client 新增 strict `TaskStateUpdateRequest`，显式绑定原 `product_date`、已发布 task ID、expected revision 与四态枚举；owner/session/continuation/guard 仍全部由服务端解析；
- `PostgresDailyInteractionStore` 实现当前 interaction 查询、Today-open continuation grant、`TASK_STATUS_SET` command receipt、同 key 同 payload replay、不同 payload conflict、semantic no-op 与真实 revision/CAS；
- DLY-003 view open 创建 session/result/date-bound grant；当前日 OPEN，边界前已打开的原页在 30 分钟内 `CONTINUATION_ONLY`，到期或新打开旧页 fail closed，目标日期从不改写到新日；
- Safety/account/consent/onboarding/DAY deletion guard、AVAILABLE visibility、owner、session、task ID 与 revision 均在同一 PostgreSQL transaction 内重查；任务更新只修改 task 与 interaction aggregate，不修改 result/checkin/light/helpfulness/evening/relationship；
- API 实现 `GET /daily/interaction` 与 `POST /daily/interaction/task`，CAS conflict 返回最新 strict DailyInteractionState；错误、日志和 telemetry 使用稳定低基数 code；
- Mini Program 使用现有 StateSelector 展示 UNMARKED/INTERESTED/COMPLETED/SKIPPED，unknown outcome 只保存一个 session-scoped command 并由用户主动同 command 确认；Offline 禁止新写、冲突刷新最新状态、窗口关闭转只读；
- C-011 点亮、C-012 晚间协调写、C-013 周趋势/TaskStateChanged consumer、C-014 删除命令及任务列表/积分/强提醒/无限自定义任务均未提前实现。

## 4. 自动验证

- 精确工具链：官方 Node `24.18.0` + pnpm `11.17.0`；
- `agent:prepare C-010 --remote --deep`：READY，remote/deep checks PASS，最终 Profile=`security`；
- changed→full Gate：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；C-010 task Gate 5/5 commands：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- root format/lint/typecheck/test/build 全部通过；root test 18/18 tasks，architecture 12 gate classes / 506 source files；
- API 24 files / 124 tests，Mini Program 14 / 56，shared-schemas 6 / 46，server-adapters 12 / 44，api-client 1 / 4；相关 lint、typecheck、build 与 bundle Gate 通过；
- 真实 PostgreSQL 18 C-008/C-010 集成测试通过 migration/seed、同 command replay、idempotency conflict、semantic no-op、并发 CAS、04:05 continuation、04:31 expiry、历史冻结与 DAY deletion guard；
- contract codegen fingerprint `bc934c42dc063703c4065403dc1dba4a76497ab76feff0ebcd17d88fec7e4c3e`，62 paths / 56 error codes、29 strict JSON Schema 与 15 known-fail fixtures 通过；
- Source registry 为 `291/793 COVERED`、`502 PLANNED`；`S20-D05` 具备 CONTRACT + E2E + DB，`D17-R02` 保持 PLANNED 给 C-011；
- Phase Gate 保持 `CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`；微信 DevTools runner 仍返回 `MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT / INFRA_BLOCKED`。

## 5. 手工证据与发布边界

- C-007～C-009 owner content/design/threat review 仍为 Pending，等待 C-015 后统一审核，不由 Agent 自行签署；
- [C-010 人工证据](../tests/manual-rc/c010-evidence.json)保持 `MANUAL_EVIDENCE_PENDING / pass_claim=PROHIBITED`；
- D-004 Frame `220:20` / `220:25` 已只读复核；无压力文案、四态、unknown、跨日/离线、Safety/deletion、大字与读屏仍等待统一人工审核；
- 自动测试不能替代 owner 对任务行为、删除竞态和用户压力边界的审核；缺失证据必须保持明确 pending；
- Production credential、真实微信发布和部署授权不属于 C-010，Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. 推送 PR #163 handoff 回写，确认 base、Draft、Issue 与 remote head 一致；
2. 等待同一 final head 的 11/11 CI SUCCESS；
3. 保持 Issue #61 Open、PR Draft，不运行 exact-head merge verifier；
4. 从 verified C-010 final head 创建 `agent/c011-day-lighting` 并恢复 C-011 上下文。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

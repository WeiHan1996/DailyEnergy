# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-24
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-009 — 实现今日内容页面
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（Mini Program/History contract + Safety/deletion/offline-cache boundary）
- **工作分支**：`agent/c009-today-content-page`
- **Stacked base**：[C-008 Draft PR #161](https://github.com/WeiHan1996/DailyEnergy/pull/161)，verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`
- **任务 Issue**：[C-009 Issue #60](https://github.com/WeiHan1996/DailyEnergy/issues/60)
- **Draft PR**：[PR #162](https://github.com/WeiHan1996/DailyEnergy/pull/162)；base=`agent/c008-daily-result-publication`
- **下一候选任务**：C-010 — 行动任务（Planned；C-009 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-008

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-008 Draft PR #161 verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`，CI run `32688523258` 11/11 SUCCESS；
- C-005 已交付 product-date-v1、StableSubjectId、seed-v1、choice-v1、GenerationManifest、continuation grant 与 PostgreSQL fences；
- C-006 已交付五维确定性 RuleFacts、ControlledExpressionPlanV1、冻结目录与稳定选择，不生成自然语言；
- C-007 已交付 strict plan Schema、指纹固定的 `daily-template-v1`、完整受控渲染、27 个 P13 AI_EVAL Source-ID 与 manual evidence；
- C-008 已交付唯一 intent/AVAILABLE、PublishGuard、Interactive Worker/outbox/inbox、start/status/today API、Redis projection cache 与真实 PG18/Redis8/BullMQ5 证据；
- C-004～C-008 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-009 已完成交付

- shared-schemas、OpenAPI 与生成 client 新增 strict `HistoryDayView`；服务端实现 owner-scoped `GET /daily/by-date/{product_date}`，拒绝当前/未来、无效日历日期和非 owner 内容；
- PostgreSQL 历史读沿用 AVAILABLE、result/source fingerprint、Safety/deletion/account guard 与两次 guard snapshot，缓存失效或 stale 时从权威结果重建；
- Mini Program API bridge 只映射 start/status/today/history 白名单字段，拒绝未知字段、内部字段、unsupported schema major 与 `2026-02-30` 等非法日期；
- DLY-002 生成页、DLY-003 今日页与 REC-002 历史详情页已按 D-004 Accepted Frame、Design Tokens 和 17 个组件合同实现 loading、fallback、recoverable error、offline、missing、same-day return 与 Safety 路由；
- unknown start outcome 保留同一 command/intent；session-scoped 24 小时缓存只保存 strict projection，Safety/Deleting/account guard 清除普通缓存，权威历史 MISSING 清除已删除日缓存；
- DLY-003 不显示未授权 raw/numeric score；行动与任务保持只读，C-010 task write、C-011 light write、C-012 evening、C-013 trend 与 C-014 delete command 均未提前实现。

## 4. 自动验证

- 精确工具链：官方 Node `24.18.0` + pnpm `11.17.0`；
- `agent:prepare C-009 --remote --deep`：READY，remote/deep checks PASS，最终 Profile=`security`；
- changed→full Gate：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；C-009 task Gate 5/5 commands：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- Mini Program 13 files / 49 tests，API 21 / 108，shared-schemas 6 / 45，api-client 1 / 4；相关 lint、typecheck、build 和 bundle Gate 通过；
- Design System Gate 通过 17 个组件合同与 136 个源资产；Mini Program public config 14 cases、Design Token 24 text + 6 non-text contrast、12 design-system known-fail、10 bundle fixtures 均通过；
- 真实 PostgreSQL 18 C-008/C-009 generation/history/guard 集成测试通过 migration、synthetic seed、owner/date、Safety/deletion 与 cache-fence 场景；
- contract codegen fingerprint `d82b7eb1e090872dc1452fd9681d327ad044831aba378c6a3a83e09b1efc359e`，62 paths / 56 error codes、15 known-fail fixtures 与 clean regeneration 通过；
- Source registry 为 `289/792 COVERED`、`503 PLANNED`；Phase Gate 保持 `CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`；
- 微信 DevTools CLI 已确认，但 automator 返回 `MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT`，证据如实为 `INFRA_BLOCKED`，未冒充微信运行时或视觉 PASS。

## 5. 手工证据与发布边界

- C-007/C-008 owner content/threat review 仍为 Pending，等待 C-015 后统一审核，不由 Agent 自行签署；
- C-009 必须提供 D-004 Frame 对照、loading/error/offline/Safety/large-text/reduced-motion 证据与 DevTools 状态；
- 自动测试不能替代微信运行时、视觉/交互和设计接受；缺失证据必须保持明确 pending/blocked；
- Production credential、真实微信发布和部署授权不属于 C-009，Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. 推送 PR #162 handoff 回写，确认 base、Draft、Issue 与 remote head 一致；
2. 等待同一 final head 的 11/11 CI SUCCESS；
3. 保持 Issue #60 Open、PR Draft，不运行 exact-head merge verifier；
4. 从 verified C-009 final head 创建 `agent/c010-action-task` 并恢复 C-010 上下文。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

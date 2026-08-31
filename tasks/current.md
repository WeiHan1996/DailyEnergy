# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-21
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-006 — 实现五维确定性规则引擎
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（C-006 `code` + stacked contract/database/tooling 路径升级）
- **工作分支**：`agent/c006-rule-engine`
- **Stacked base**：[C-005 Draft PR #158](https://github.com/WeiHan1996/DailyEnergy/pull/158)，verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`
- **任务 Issue**：[C-006 Issue #58](https://github.com/WeiHan1996/DailyEnergy/issues/58)
- **Draft PR**：[PR #159](https://github.com/WeiHan1996/DailyEnergy/pull/159)；base=`agent/c005-stable-seed`
- **下一候选任务**：C-007 — 本地模板内容（Planned；C-006 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 上游 C-004 / C-005

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-005 已交付 product-date-v1、StableSubjectId、seed-v1、choice-v1、GenerationManifest、continuation grant 与 PostgreSQL fences；
- C-004/C-005 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-006 已完成交付

- `deriveDailyRulesV1` 严格校验 daily-v1 manifest closure/fingerprint、GenerationInputSnapshot、result/snapshot binding 与 32-byte root seed；
- `daily-score-v1` 使用 Accepted 五维 `pace/action/connection/resources/recovery` 的固定整数权重、clamp、band 与 overall rounding；
- 实现 all/partial UNSURE、severe care points、LOW/high focus、supporting tie、完整 explanation basis 和稳定错误；
- 冻结 8 个低后果 action、8 个一对一 optional task、4 个 ritual set、5 个颜色、1～9 数字、3 个 template variant 及全局 canonical ranks；
- 所有离散决定使用独立 choice-v1 namespace；目录存储乱序和额外未消费 namespace 不扰动已有选择；
- RuleFacts 通过 shared strict Schema，并补充 score-band、candidate/task、display-order 与 catalog 不变量；
- ControlledExpressionPlanV1 精确投影同一 facts，处理 LOW/PARTIAL/STANDARD assertion、care/uncertainty expression ceiling，context slots 在 daily-v1 固定为空；
- public choice trace 仅含 namespace/candidate-count/counter/index/hashed，不含 root seed、digest、stable subject 或 fingerprint；
- unregistered product compatibility、unknown field/style、catalog corruption、manifest/snapshot/root mismatch 全部 fail closed；
- C-006 不调用模型、不生成文案、不实现 C-007 模板、C-008 intent/publish/cache 或 C-013 weekly aggregate。

## 4. 自动验证

- 精确工具链：官方 Node `24.18.0` + pnpm `11.17.0`；
- C-006 changed/full Gate：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`，完整 validate、PostgreSQL 与 Queue 通过；
- C-006 task Gate：5/5 命令执行，`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- server-core：5 files / 32 tests；5 个 complete daily golden、2 个 unit golden、180/180 合法组合、monotonic/invariance/invalid catalog 全通过；
- root Vitest projects：57 files / 280 tests；API：18 files / 90 tests；PostgreSQL 18 full integration：86/86；Queue：7/7；
- server-core coverage：statements 91.26%、branches 88.59%、functions 100%、lines 90.9%，通过既定阈值；
- package dependency closure 在 clean build 中按 shared-schemas → server-core → server-adapters 排序；Turbo test 依赖 own build，消除 consumer/test 删除 dist 的竞态；
- Source registry 保持 `244/787 COVERED`、`543 PLANNED`；C-006 proof 补充已 Covered `S31-TEST-003`，未满足 mandatory layer 的 ID 未提前提升。

## 5. 手工证据与发布边界

- [C-006 人工证据](../tests/manual-rc/c006-evidence.json)保持 `MANUAL_EVIDENCE_PENDING / pass_claim=PROHIBITED`；
- owner threat-boundary review 已准备清单，等待 C-015 后统一审核，不由 Agent 自行签署；
- C-007 必须单独验证完整模板文本、字符预算、人格与 Safety；C-008 必须单独验证 live guards、唯一 intent、原子发布、缓存和 late result；
- Production credential、provider evaluation 和部署授权不属于 C-006，记录为 `NOT_APPLICABLE / PRODUCTION_NO_GO`。

## 6. 精确下一动作

1. 提交 PR #159 编号回写并推送，记录新的 remote final head；
2. 等待同一 final head 的 11/11 CI SUCCESS；
3. 保持 Issue #58 Open、PR Draft，不运行 exact-head merge verifier；
4. 从 verified C-006 final head 创建 `agent/c007-local-templates`；
5. 把 C-007 设为唯一 In Progress，运行 `pnpm agent:prepare C-007 --remote --deep` 后按返回来源继续。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

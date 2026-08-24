# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-21
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-007 — 实现本地模板内容
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（C-007 `code` + stacked contract/security/tooling 路径升级）
- **工作分支**：`agent/c007-local-templates`
- **Stacked base**：[C-006 Draft PR #159](https://github.com/WeiHan1996/DailyEnergy/pull/159)，verified head `743e1d8679478f6feec961c87cca0b31c81230b5`
- **任务 Issue**：[C-007 Issue #59](https://github.com/WeiHan1996/DailyEnergy/issues/59)
- **Draft PR**：[PR #160](https://github.com/WeiHan1996/DailyEnergy/pull/160)；base=`agent/c006-rule-engine`
- **下一候选任务**：C-008 — 今日结果幂等与缓存（Planned；C-007 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-006

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-005 已交付 product-date-v1、StableSubjectId、seed-v1、choice-v1、GenerationManifest、continuation grant 与 PostgreSQL fences；
- C-006 已交付五维确定性 RuleFacts、ControlledExpressionPlanV1、冻结目录与稳定选择，不生成自然语言；
- C-004～C-006 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-007 已完成交付

- shared-schemas 新增严格 `ControlledExpressionPlanV1Schema`，固定 required sections、prohibited claims、五维 canonical order、check-in partition、assertion/care/style ceiling 与模板资格；
- C-006 的 `deriveControlledExpressionPlanV1` 直接构造并验证同一 executable Schema，不再只依赖 TypeScript interface；
- `@daily-energy/prompt-library` 建立 server-only `daily-template-v1` registry、`controlled-daily-template-renderer-v1` 与 pinned fingerprint `61ca366d804f43f50ab261cb7a2de43dfe2c6b881808423c82b2ceabbae9c113`；
- renderer 不读取数据库、网络、当前时间、随机数、provider、历史正文或重要事项，只消费冻结 plan 并返回完整 strict ExpressionPayload；
- 覆盖 BALANCED、GENTLE、LIGHT_HUMOR、CLEAR_DIRECT，LOW/PARTIAL/STANDARD、mood/energy/sleep care-first 与 humor/pressure ceiling；
- 全部 8 个 action、8 个一对一 task、4 种 ritual set、5 个颜色、1～9 数字、15 个 dimension-band 文案与 3 个 semantic variant 逐项绑定；
- preferred name 先走严格安全投影，非法/注入式/禁用称呼省略；Daily v1 不虚构关系、记忆、时段或共同经历；
- candidate 固定 `generation_mode=CONTROLLED_TEMPLATE`、`personalization_level=FULL`、四份 Accepted authority attribution、`source_dependencies=[]` 与 `privacy_fallbacks={}`；
- 全候选复查 Schema、ID、字符预算、幽默/压力、专业边界、恐惧/羞耻、依赖、内部 token 和 Safety 禁止项，失败整份拒绝；
- C-007 不实现 C-008 intent/publication/live guard/cache，不实现 C-009 页面、provider route、AI retry/breaker 或重要事项。

## 4. 自动验证

- 精确工具链：官方 Node `24.18.0` + pnpm `11.17.0`；
- `agent:prepare C-007 --remote --deep`：READY，remote/deep checks 全部 PASS，最终 Profile=`security`；
- changed/full Gate：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`，完整 validate、真实 PostgreSQL、Queue 与供应链通过；
- C-007 task Gate：5/5 命令执行，`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- root Vitest projects：59 files / 293 tests；prompt-library：1 file / 11 tests；server-core：5 files / 32 tests；server-adapters：11 files / 41 tests；
- prompt-library coverage：statements 90.28%、branches 85.03%、functions 100%、lines 90.22%，通过新增 90/85/90 阈值；
- C-006 real-plan integration 覆盖 all-UNSURE、partial、severe care、high 和 steady 五类实际 derivation，无 mapper 或第二事实源；
- contract codegen fingerprint `f0d7840a96f4a66fe0a833bc9ea4fdd40c80ed02837adfe9ff706c3ad66a1b47`，frozen install、codegen/drift、contract、architecture 与 27 个 known-fail fixtures 通过；
- Source registry 为 `271/787 COVERED`、`516 PLANNED`，C-007 将 27 个适用 P13 Common/Daily ID 从 PLANNED 提升为 AI_EVAL COVERED；
- 额外全仓 `test:coverage` 的 59 files / 293 tests 本身通过，但既有 all-source 收集会把未进入测试项目的 Admin/Mini Program 源计为 0 并触发全局 app/shared 阈值；C-007 聚焦 coverage 单独通过，不把该非任务 Gate 诊断记为 PASS。

## 5. 手工证据与发布边界

- [C-007 人工证据](../tests/manual-rc/c007-evidence.json)保持 `MANUAL_EVIDENCE_PENDING / pass_claim=PROHIBITED`；
- 完整模板文本、三种可见风格、低状态/care、8 个行动/任务、仪式与无记忆语言等待 C-015 后 owner 统一审核；
- 自动测试证明结构、绑定、字符预算与确定性禁止项，不替代 owner 对人格、内容质量和威胁边界的判断；
- Production credential、provider evaluation 和部署授权不属于 C-007，Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. 提交并推送 PR #160 编号回写，记录新的 remote final head；
2. 等待同一 final head 的 11/11 CI SUCCESS；
3. 保持 Issue #59 Open、PR Draft，不运行 exact-head merge verifier；
4. 从 verified C-007 final head 创建 `agent/c008-daily-result-publication`；
5. 在 C-008 分支记录 C-007 PR/final-head/CI 证据并恢复 C-008 上下文。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

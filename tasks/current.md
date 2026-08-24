# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-24
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-011 — 实现点亮、连续记录与关系基础事实
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（LightFact/outbox、关系 Inbox/cutoff 与删除重放边界）
- **工作分支**：`agent/c011-day-lighting`
- **Stacked base**：[C-010 Draft PR #163](https://github.com/WeiHan1996/DailyEnergy/pull/163)，verified head `e6dc3717ad94799ab821e6d5c983dec6dd568043`
- **任务 Issue**：[C-011 Issue #63](https://github.com/WeiHan1996/DailyEnergy/issues/63)
- **Draft PR**：[PR #164](https://github.com/WeiHan1996/DailyEnergy/pull/164)；base=`agent/c010-action-task`
- **下一候选任务**：C-012 — 晚间反馈（Planned；C-011 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-010

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-008 Draft PR #161 verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`，CI run `32688523258` 11/11 SUCCESS；
- C-009 Draft PR #162 verified head `941c302995935b763dae3b45c5a56fddf68bdae2`，CI run `32692776724` 11/11 SUCCESS；
- C-010 Draft PR #163 verified head `e6dc3717ad94799ab821e6d5c983dec6dd568043`，CI run `32697952655` 11/11 SUCCESS；
- C-005 已交付 product-date-v1、StableSubjectId、seed-v1、choice-v1、GenerationManifest、continuation grant 与 PostgreSQL fences；
- C-006 已交付五维确定性 RuleFacts、ControlledExpressionPlanV1、冻结目录与稳定选择，不生成自然语言；
- C-007 已交付 strict plan Schema、指纹固定的 `daily-template-v1`、完整受控渲染、27 个 P13 AI_EVAL Source-ID 与 manual evidence；
- C-008 已交付唯一 intent/AVAILABLE、PublishGuard、Interactive Worker/outbox/inbox、start/status/today API、Redis projection cache 与真实 PG18/Redis8/BullMQ5 证据；
- C-009 已交付 DLY-002/DLY-003/REC-002、strict history contract/API、unknown outcome recovery、validated offline cache 与 D-004 manual evidence；
- C-010 已交付 strict TaskState command、PostgreSQL CAS/idempotency、session continuation、DLY-003 四态与 unknown recovery；
- C-004～C-010 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-011 已完成交付

- 新增 strict `LightDayRequest` 与七日 `HistoryListView`，command 绑定原产品日期和 result；服务端不接收、不保存 `MAIN_ACTION_REACHED`、滚动像素或 guard epoch；
- PostgreSQL 同事务写 command receipt、唯一 LightFact、DailyInteraction revision 与一个逻辑 DayLit outbox；同 command replay、变 payload 冲突、同日多端与 continuation 均 fail closed；
- Background DayLit handler 使用既有 InboxReceipt 事务、source revision、Safety/deletion epoch、active cycle unique slot 与 relationship cutoff，只产生一条有效 EncounterLink；
- Today 从有效 link 派生 encounter day count、四阶段与 1/3/4/7 资格 token；任务状态、帮助度和点亮保持独立，中断与缺失不清零、不惩罚；
- DLY-003 仅在客户端观察到主要行动进入可理解视区后显示点亮；离线禁写，unknown outcome 保存同 command 并先读权威状态，一次克制确认；
- REC-001 只交付最近 7 个产品日期的 `RECORDED/MISSING`、点亮/result/evening 布尔事实与只读缓存；未提前实现 C-012 晚间反馈、C-013 趋势/总结或 C-014 删除命令；
- 新 migration 只向 API/background 暴露 history status、relationship epoch/cutoff 和七日布尔投影的 SECURITY DEFINER 函数，不放宽 restricted table ACL；
- Source registry 更新为 `297/793 COVERED`、`496 PLANNED`；D17-R03/R04 留给 C-012，D17-R05 留给 C-014。

## 4. 已完成验证

- `pnpm agent:prepare C-011 --remote --deep`：`READY`，Profile=`security`，remote/dependencies/toolchain PASS；
- 官方 Node `24.18.0` + pnpm `11.17.0`；本机镜像缺 audit endpoint，最终 Gate 只临时使用 `PNPM_CONFIG_REGISTRY=https://registry.npmjs.org`，未修改仓库或全局配置；
- shared schemas `48/48`、server adapters `47/47`、Mini Program `61/61`、API `130/130`；Mini Program build 与 bundle/design Gate PASS；
- 真实 PostgreSQL 18 C-011 专项 PASS；完整 database Gate `87/87` PASS，catalog drift 显示 `functions=39`；
- 真实 Redis 8 + BullMQ 5 + PostgreSQL 18 queue integration `8/8` PASS，DayLit 产生一个 background InboxReceipt 与 EncounterLink；
- `pnpm agent:validate --mode=changed`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=task --task=C-011`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- manual evidence：`tests/manual-rc/c011-evidence.json`，owner threat/design/a11y/real-device review 保持 Pending；DevTools=`MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT / INFRA_BLOCKED`；
- final-head CI 11/11：等待 Draft PR 创建并推送最终提交后验证。

## 5. 手工证据与发布边界

- C-007～C-011 owner content/design/threat review 仍为 Pending，等待 C-015 后统一审核，不由 Agent 自行签署；
- C-011 已记录点亮可用时机、Pending/unknown/offline/跨日、克制确认、无惩罚中断、删除 cutoff 与无障碍待验状态；
- 自动测试不能替代 owner 对阅读资格、关系节点、删除重放和用户压力边界的审核；缺失证据必须保持明确 pending；
- Production credential、真实微信发布和部署授权不属于 C-011，Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. 推送 PR #164 handoff 回填，确认 base、Draft、Issue 与 remote head 一致；
2. 等待精确 final head 的 11/11 CI SUCCESS；
3. 从 verified C-011 final head 创建 `agent/c012-evening-feedback` 并切换 durable current task；
4. C-011 PR/Issue 保持 Draft/Open，manual evidence 等待 C-015 后统一审核。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

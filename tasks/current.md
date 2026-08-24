# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-24
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-012 — 实现晚间反馈与轻反馈
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（自由文本 Safety input gate、api-safety pool、协调事务与删除边界）
- **工作分支**：`agent/c012-evening-feedback`
- **Stacked base**：[C-011 Draft PR #164](https://github.com/WeiHan1996/DailyEnergy/pull/164)，verified head `3ca1105b676cc01b6af1d9d6b4f1bf28e84d7589`
- **任务 Issue**：[C-012 Issue #64](https://github.com/WeiHan1996/DailyEnergy/issues/64)
- **Draft PR**：待创建；base=`agent/c011-day-lighting`
- **下一候选任务**：C-013 — 七天趋势（Planned；C-012 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-011

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-008 Draft PR #161 verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`，CI run `32688523258` 11/11 SUCCESS；
- C-009 Draft PR #162 verified head `941c302995935b763dae3b45c5a56fddf68bdae2`，CI run `32692776724` 11/11 SUCCESS；
- C-010 Draft PR #163 verified head `e6dc3717ad94799ab821e6d5c983dec6dd568043`，CI run `32697952655` 11/11 SUCCESS；
- C-011 Draft PR #164 verified head `3ca1105b676cc01b6af1d9d6b4f1bf28e84d7589`，CI run `32705520165` 11/11 SUCCESS；
- C-004～C-011 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-012 已完成交付

- 新增 strict `EveningSaveRequest`、封闭 entry source、SafetyOverlayView 与生成 client；整体感受/帮助度必选，任务 patch 与 note SET/CLEAR 可选，未知字段拒绝；
- `PostgresEveningStore` 在一个事务中校验 owner/result/date/window/command 与 feedback/helpfulness/task revisions，原子提交三个独立事实、aggregate revision、最小 revision 和无正文 `WeeklySourceChanged` outbox；
- 修正 EVE 空反馈 continuation 的 Accepted revision 0 与既有通用正数 constraint 冲突，并保留 catalog constraint 稳定身份；
- note 使用字段专用 AES-GCM codec，数据库只存 ciphertext/key version；note 不进入普通日志、outbox、周输入、记忆、通知、分享或 analytics；
- Safety input gate 在 ordinary transaction 前执行：CLEAR 才保护并保存；HIGH_RISK 走 `api-restricted` `PostgresEveningSafetyStore` 的 TX-05；INDETERMINATE fail closed，不静默移除 note 后保存结构化字段；
- api-safety pool 同事务递增 state/epoch，写最小 decision/event/plan/outbox；同 command replay 幂等、变 fingerprint 冲突，客户端只收到 fixed SafetyOverlayView；
- API 实现 `GET /v1/evening/today` 与 `POST /v1/evening/save`；历史日合并只读 EveningView，冲突错误返回 strict current view；
- Mini Program 新增 EVE-001 Normal/Loading/Error/Offline/Completed/Safety、同 command unknown recovery、短期提交视图缓存、当前页内 draft 与历史晚间投影；不创建离线写队列；
- 未实现生产 classifier/provider 或专业 Safety resource activation；该 port 缺失时自由文本 fail closed，Production/RC 继续 NO_GO；未提前实现 C-013 趋势或 C-014 删除命令。

## 4. 已完成验证

- `pnpm agent:prepare C-012 --remote --deep`：`READY`，Profile=`security`，remote/dependencies/toolchain PASS；
- 官方 Node `24.18.0` + pnpm `11.17.0`；最终 Gate 临时使用官方 npm audit endpoint，未修改仓库或全局配置；
- API `138/138`、Mini Program `65/65`、shared schemas `51/51`、server adapters `47/47`；相关 lint/typecheck/build/bundle/design Gate PASS；
- 真实 PostgreSQL 18 C-012 专项 PASS：TX-04 三组件/aggregate 同提交、revision conflict 全不写、note 密文、空反馈 continuation revision 0；
- 真实 api-safety pool TX-05 PASS：decision/event/plan/state 各一、duplicate/no-op、fingerprint conflict、ordinary feedback 0；
- 完整 database Gate 与 Redis 8/BullMQ 5 queue Gate 在 changed/full 单次运行中 PASS；
- Source registry `303/793 COVERED`、`490 PLANNED`；D17-R03/R04、S19-DB-020、S20-E01～E03 新增实现级证据；
- `pnpm agent:validate --mode=changed`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=task --task=C-012`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- manual evidence：`tests/manual-rc/c012-evidence.json`；Figma `495:220`/`495:224`/`507:3` 已只读核对，owner threat/design/a11y/real-device review 仍 Pending；
- DevTools=`MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT / INFRA_BLOCKED`；final-head CI 11/11 等待 Draft PR 创建并推送最终提交。

## 5. 手工证据与发布边界

- C-007～C-012 owner content/design/threat review 仍为 Pending，等待 C-015 后统一审核，不由 Agent 自行签署；
- 自动测试不能替代 owner 对真实反馈/娱乐能量分离、高风险固定响应、任务压力、键盘安全区和自由文本体验的审核；
- production classifier/provider、专业 Safety resource 激活、真实微信与部署授权不属于 C-012；Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. 提交 C-012、推送 `agent/c012-evening-feedback`，创建 base=`agent/c011-day-lighting` 的 stacked Draft PR；
2. 回填 PR 并等待精确 final head 的 11/11 CI SUCCESS；
3. 从 verified C-012 final head 创建 `agent/c013-seven-day-trends` 并切换 durable current task；
4. C-012 PR/Issue 保持 Draft/Open，manual evidence 等待 C-015 后统一审核。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

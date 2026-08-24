# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-24
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-013 — 七天趋势
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（stacked 安全边界、七天真实数据、Background/TX-07 与隐私最小化证明）
- **工作分支**：`agent/c013-seven-day-trends`
- **Stacked base**：[C-012 Draft PR #165](https://github.com/WeiHan1996/DailyEnergy/pull/165)，verified head `b70b9e390ab5d8514d13c576f21bdade18ad18e6`
- **任务 Issue**：[C-013 Issue #70](https://github.com/WeiHan1996/DailyEnergy/issues/70)；保持 Open
- **Draft PR**：[PR #166](https://github.com/WeiHan1996/DailyEnergy/pull/166)；base=`agent/c012-evening-feedback`
- **下一候选任务**：C-014 — 数据查看与删除（Planned；C-013 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-012

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-008 Draft PR #161 verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`，CI run `32688523258` 11/11 SUCCESS；
- C-009 Draft PR #162 verified head `941c302995935b763dae3b45c5a56fddf68bdae2`，CI run `32692776724` 11/11 SUCCESS；
- C-010 Draft PR #163 verified head `e6dc3717ad94799ab821e6d5c983dec6dd568043`，CI run `32697952655` 11/11 SUCCESS；
- C-011 Draft PR #164 verified head `3ca1105b676cc01b6af1d9d6b4f1bf28e84d7589`，CI run `32705520165` 11/11 SUCCESS；
- C-012 Draft PR #165 verified head `b70b9e390ab5d8514d13c576f21bdade18ad18e6`，CI run `32728000420` 11/11 SUCCESS；
- C-004～C-012 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-013 已完成交付

- 新增 `weekly-aggregate-v1` 纯规则：固定七个连续 ProductDate、EMPTY / POINTS_ONLY / PARTIAL / COMPLETE、缺失 / UNSURE、整数 direction、mode、帮助度、任务与 approved fact catalog；
- 新增 `weekly-expression-v1` 决定计划、120～260 字完整本地模板与 Client Weekly 白名单投影；不调用 AI、不计算原因、不读取 note 或娱乐分数；
- 新增 additive migration `20260824000003_c013_weekly_reflection`：三个 closed `SECURITY DEFINER` 函数只投影 account/date/revision/guard 与允许周源字段；API/Background 不获得 restricted 直读；
- source fingerprint 绑定参与源 ref/revision、允许值与 server-only Light validity revision；晚间 overall 使用字段级 revision，note-only 修改不改变 fingerprint；
- Checkin correction、Daily result publication、light、task/evening 与未来 DAY guard 事件均可触发 source refresh；outbox 只含 opaque ref、aggregate revision、ProductDate 与 guard epochs；
- Background handler 先写 immutable snapshot/aggregate/plan、清除旧 current pointer、创建稳定 WeeklySummaryIntent/due outbox；due handler 以 intent UUID 作为 job ID，使用 Inbox 与 TX-07 CAS 原子发布不可变 summary；
- Redis 丢失时从 RUNNING PostgreSQL intent 重建 WeeklySummaryDue；迟到旧 intent 在 fingerprint mismatch 后 CANCELLED，不发布 candidate；
- API 实现 `GET /v1/weekly/current` 与 `GET /v1/weekly/window/{end_date}`；每次读取从最小真实源重算 fingerprint，失配时只返回新事实和 INVALIDATED/NOT_ELIGIBLE，不返回 ghost summary；
- REC-001 实现 Empty、Points Only、Partial、Complete、Loading、Recoverable Error、Offline、Fallback 与 Rebuilding；四类真实指标使用稳定七列点图、可见文字摘要、日期/值重复表达和显式缺失断点；
- Mini Program weekly cache 为 session-scoped、24 小时、只读；历史窗口不复用其它锚点缓存，Safety 清除 ordinary cache，不创建离线写队列；
- Source registry 从 `303/793 COVERED` 更新为 `311/793 COVERED`、`482 PLANNED`、`0 NA_WITH_REASON`；未提前实现 C-014 删除命令或 C-015 analytics。

## 4. 已完成验证

- `pnpm agent:prepare C-013 --remote --deep`：`READY`，Profile=`security`，remote/dependencies/toolchain PASS；
- 官方 Node `24.18.0` + pnpm `11.17.0`；完整 Gate 临时使用官方 npm audit endpoint，未修改仓库或全局配置；
- root format/lint/typecheck/test/build 全部通过；Turbo tests `18/18`、build `9/9`；
- API `141/141`、Mini Program `72/72`、server adapters `49/49`、server core `43/43`、shared schemas `51/51`、Worker `10/10`；
- 真实 PostgreSQL 18 完整 Gate `88/88`：SQL-001～020、TX-01～09、migration/checksum/drift/restore、C-001～C-013 专项全部 PASS；
- C-013 PG18 专项 PASS：七槽 source、稳定 due row、首次/修订发布、Inbox replay、迟到 intent 取消、DAY guard 缺失、历史锚点与无 ghost summary；
- 真实 Redis 8 / BullMQ 5 queue integration `8/8`；Weekly due 使用独立 Background capability，Daily 保留 Interactive queue/role/egress；
- Source registry `311/793 COVERED`、`482 PLANNED`；D17-M05/M06、PDM-U02、S19-DB-030/031、S20-E04/E05、S29-ARCH-025 新增实现证据；
- `pnpm agent:validate --mode=changed`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=task --task=C-013`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- manual evidence：`tests/manual-rc/c013-evidence.json`；Figma D-005 REC-001 Source/375px QA 已只读核对，owner visual/a11y/threat/real-device review 仍 Pending；
- WeChat DevTools：CLI 路径已核对，结果 `MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT / INFRA_BLOCKED`；不能标 PASS。

## 5. 手工证据与发布边界

- C-007～C-013 owner content/design/threat review 仍为 Pending，等待 C-015 后统一审核，不由 Agent 自行签署；
- C-013 记录实现使用可访问七列点图而非 Figma 装饰性连接路径；缺失日不连线且所有值有文字重复，该差异已进入 PR/manual evidence 等待统一视觉审核；
- 自动测试不能替代 owner 对真实状态/娱乐能量分离、样本不足措辞、源失效、图表密度、大字与读屏顺序的审核；
- WeChat DevTools、iOS/Android 真机、Production provider/部署/发布授权不属于已完成证据；Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. 提交并推送 PR #166 handoff 回填，确认 base、Draft、Issue 与 remote head 一致；
2. 等待精确 final head 的 11/11 CI SUCCESS；
3. C-013 PR/Issue 保持 Draft/Open，manual evidence 等待 C-015 后统一审核；
4. 从 verified C-013 final head 创建 `agent/c014-data-rights`，切换 durable current task，并运行 `pnpm agent:prepare C-014 --remote --deep`。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

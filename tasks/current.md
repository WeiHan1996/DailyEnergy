# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-30
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-014 — 数据查看与删除
- **任务状态**：In Review（C-004～C-015 统一审核批次；自动 Gate 完成，等待 C-015 后统一审核）
- **任务 Profile**：`security`（用户权利、删除 guard、restricted worker、缓存/队列/恢复防复活）
- **工作分支**：`agent/c014-data-rights`
- **Stacked base**：[C-013 Draft PR #166](https://github.com/WeiHan1996/DailyEnergy/pull/166)，verified head `e43e75ba8a18e013709578d5dfc64764c0d7b787`
- **任务 Issue**：[C-014 Issue #65](https://github.com/WeiHan1996/DailyEnergy/issues/65)；保持 Open
- **Draft PR**：[C-014 Draft PR #167](https://github.com/WeiHan1996/DailyEnergy/pull/167)；base=`agent/c013-seven-day-trends`，保持 Draft
- **下一候选任务**：C-015 — 核心埋点（Planned；C-014 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 已验证上游 C-004～C-013

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
- C-004～C-013 均保持 In Review、PR Draft、Issue Open；owner manual evidence 等待 C-015 后统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-014 已完成交付

- ADR-0008 与配套传输契约已于 2026-08-28 Accepted；新增 strict `DataRightsSummaryView`、`ExportArtifactView`、`DeletionStatusGrantView`、`AccountDeletionAcceptedView` 与 `DataExportDocument`，OpenAPI/Zod/generated client 无 drift；
- `GET /v1/data-rights/summary` 只返回 account/relationship expected revision、capability、确认版本与 72h/35d 常量，不返回 account ref、epoch、token 或 restricted topology；
- Export DataTask 使用正文零持久化的 24 小时 manifest：Restricted Worker 冻结最小 source revision vector 与 SHA-256 fingerprint，READY download 在请求时确定性生成 JSON，`no-store`/attachment/nosniff，2 MiB 以上整份拒绝；
- source 更正/删除、ACCOUNT guard 或 24 小时到期使旧 manifest `INVALIDATED/EXPIRED`；`DataRightsRetentionDue` 从 PostgreSQL 重建 24h/7d/30d 到期工作，Redis 不是期限事实源；
- ACCOUNT confirm 同事务创建 guard/task、吊销普通 session 并保存 hash-only 7 天 status grant；`DeletionStatus` scheme 只读绑定 task，普通 Bearer、换 task、错误 token、到期和成功后重放均拒绝；
- DAY/MATTER/RELATIONSHIP_DATA/ACCOUNT 删除继续使用 TX-09、checkpoint、restore deny、de-identified receipt 与 guard-first cleanup；legal hold 和第三步受限证据故障都保持原 task/guard，并由新 revision due event 重试；
- SET-004 实现 Loading/Offline/Error/Processing/Failed/Ready/Expired/Invalidated 与本地 JSON 交付；SET-006 实现 summary revision、ACCOUNT reauth、关系空 DAY vector、Deleting/Failed/Completed；REC-002 DAY 删除清理本地 daily/evening/weekly cache；
- Source registry 更新为 `343/813 COVERED`、`470 PLANNED`、`0 NA_WITH_REASON`；PDM-D07、S31-TEST-037/038 已由 C-014 自动证据覆盖，未提前实现 C-015 analytics。

## 4. C-014 已完成验证

- `pnpm agent:prepare C-014 --remote --deep`：`READY`，Profile=`security`，remote/dependencies/Node 24.18.0/pnpm 11.17.0/GitHub PASS；
- format、lint、architecture、typecheck、contract/codegen、registry、phase Gate 与 `git diff --check` 全部通过；contract Gate 为 60 error codes / 65 paths，49 个根 JSON Schema；
- root tests `18/18` Turbo tasks、build `9/9`；API `149/149`、Mini Program `78/78`、server adapters `53/53`、server core `43/43`、shared schemas `59/59`、Worker `10/10`；
- 真实 PostgreSQL 18 完整 Gate `89/89`：14 migrations、74 application tables、36 enums、72 functions、SQL-001～020、TX-01～09、角色/grant、catalog drift、upgrade/rollback/restore 与 C-001～C-014 专项全部 PASS；
- C-014 PG18 专项证明 summary、READY/repeat download source、正文列 0、source correction invalidation、精确 24 小时 expiry、wrong token、FAILED status continuation、SUCCEEDED grant consumption、legal hold 与第三步 fault 同 task 重试；
- 真实 Redis 8 / BullMQ 5 / PostgreSQL 18 queue integration `8/8`，空 Redis 可从 PG 重建 active DataTask 与 retention due；
- `pnpm agent:validate --mode=changed`：`changed→full / automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=task --task=C-014`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=full --task=C-014`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`。

## 5. 手工证据与发布边界

- manual evidence：`tests/manual-rc/c014-evidence.json`；owner threat boundary、SET-004/SET-006 visual/a11y、WeChat DevTools/真机 secure storage/large text/screen reader/Reduced Motion 仍 Pending，不由 Agent 自签；
- Provider/object cleanup、真实 20 天备份恢复与 Production provider/部署/发布授权仍属于后续外部/运行证据；自动 PG restore hook 不能替代真实备份演练；
- C-007～C-014 owner content/design/threat review 等待 C-015 后统一审核；Production / RC 保持 `NO_GO`。

## 6. 精确下一动作

1. push PR #167 的项目控制 final head，取得同一精确 head 的 11/11 CI SUCCESS；
2. 仅在 C-014 final-head CI 验证后，从该 head 创建 `agent/c015-*` 并开始 C-015；
3. C-004～C-014 PR 继续保持 Draft、Issue Open，不逐项请求 owner 审核。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

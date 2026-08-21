# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-21
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-005 — 实现稳定种子
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（C-005 `code` + contract/database/security 路径升级）
- **工作分支**：`agent/c005-stable-seed`
- **Stacked base**：[C-004 Draft PR #157](https://github.com/WeiHan1996/DailyEnergy/pull/157)，verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`
- **任务 Issue**：[C-005 Issue #57](https://github.com/WeiHan1996/DailyEnergy/issues/57)
- **Draft PR**：待首次推送后创建；base 必须为 `agent/c004-daily-checkin`
- **下一候选任务**：C-006 — 规则引擎（Planned；C-005 final-head CI 验证后启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 上游 C-004

- C-004 CheckIn Schema/API/PostgreSQL/DLY-001 已提交到 Draft PR #157；
- final head `9a902a5d2d5b666be33f9c90faa92dffafce0037` 的 CI run `32456442334` 在同一 run 取得 11/11 SUCCESS；
- exact-head merge verifier 因统一审核安排延后到项目所有者批准后执行；
- C-004 changed/full 与 task Gate 均为 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- Production / RC 继续 `NO_GO`，C-004 未合并、Issue #56 保持 Open。

## 3. C-005 已完成交付

- `server-core/product-time`：`product-date-v1` IANA/04:00 resolver、民用七天窗口、VIEW_CONTINUATION 和 GENERATION_COMPLETION 纯策略及 SPI；
- `server-core/generation`：StableSubjectId、LP32/SHA-256 `seed-v1`、具名 `choice-v1`、U64 rejection sampling、canonical candidate order、不可变 GenerationManifest 与 frozen selection；
- `daily-v1` manifest 使用 code-unit canonical JSON，fingerprint 固定为 `48891a7bcbbbfc584170e7c06c1aa174cf978abbb88a2b5d0ed91c32d204a8f0`；
- PostgreSQL API adapter 以账户 advisory、session row 与 result visibility 锁串行化 grant 创建；主动切日、登出/rotate、Safety、账户/DAY 删除、同意撤回和结果 BLOCKED 均提前失效；
- Interactive adapter 只读 exact/active manifest；同 version fingerprint 不一致 fail closed，不回退 `latest`；
- additive migration `20260821000001_c005_product_time_manifest` checksum 为 `f85fcf20552889dbfd723d5c84b1568762b1b428225843d86801d6e8f75bbb8d`，Prisma client 与 catalog fingerprint 已重建；
- API ProductDate 实现迁到 core public contract；C-005 不实现 C-006 评分、C-007 模板、C-008 intent/publication/cache 或 AI；
- Source registry 新增覆盖 `D17-I06`、`D17-V01`，当前 `244/787 COVERED`、`543 PLANNED`、无未批准 NA；
- 修正 module boundary Gate 的同模块分层误判，并用跨模块 known-fail/同模块 known-pass fixture 固定；数据库文件级容器串行，保留文件内部真实竞态。

## 4. 自动验证

- 精确工具链：官方 Node `24.18.0` + pnpm `11.17.0`；
- C-005 changed/full Gate：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`，security profile，完整 `pnpm run validate` 通过；
- C-005 task Gate：5/5 命令执行，`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- server-core：3 files / 17 tests；API：18 files / 90 tests；
- PostgreSQL 18 full integration：86/86，包含 C-001、C-002、C-004、C-005、SQL-001～020、TX-01～09、migration/seed/drift/restore；
- Queue integration：7/7；Boundary fixture：26 known-fail + 1 known-pass，真实仓库 12 类 Gate 通过；
- Prisma format/generate/validate、migration checksum、catalog drift、registry/Phase Gate、build、audit、supply-chain artifact scan 均由 changed/full Gate 通过。

## 5. 手工证据与发布边界

- [C-005 人工证据](../tests/manual-rc/c005-evidence.json)保持 `MANUAL_EVIDENCE_PENDING / pass_claim=PROHIBITED`；
- owner threat-boundary review 已准备清单，等待 C-015 后统一审核，不由 Agent 自行签署；
- Production credential、环境和部署授权不属于 C-005，记录为 `NOT_APPLICABLE / PRODUCTION_NO_GO`；
- 仅使用 synthetic fixture 与一次性本地容器，未访问真实身份、生产数据、provider 或生产环境。

## 6. 精确下一动作

1. 提交并推送 `agent/c005-stable-seed`，创建 base=`agent/c004-daily-checkin` 的 Draft PR；
2. 回写 PR 编号和提交 final head，推送后等待同一 final head 的 11/11 CI SUCCESS；
3. 保持 C-005 In Review、Issue #57 Open、PR Draft，不运行 exact-head merge verifier；
4. 从 verified C-005 final head 创建 `agent/c006-rule-engine`；
5. 把 C-006 设为唯一 In Progress，运行 `pnpm agent:prepare C-006 --remote --deep` 后按返回来源继续。

## 7. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 项目所有者统一审核并明确批准后，才按依赖顺序运行 exact-head verifier、更新状态与准备合并。

# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-21
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-004 — 实现每日签到
- **任务状态**：In Review（C-004～C-015 统一审核批次；不请求逐项审核）
- **任务 Profile**：`security`（C-004 `code` + contract/database/security 路径升级）
- **工作分支**：`agent/c004-daily-checkin`
- **任务 Issue**：[C-004 Issue #56](https://github.com/WeiHan1996/DailyEnergy/issues/56)
- **Draft PR**：待本分支提交并创建
- **下一候选任务**：C-005 — 稳定种子（Planned；C-004 Draft PR 建立后在 stacked branch 启动）
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 连续推进授权

- 项目所有者于 2026-08-21 明确授权按依赖顺序连续推进 C-004～C-015，并在 C-015 完成后统一审核；
- C-004 已结束实现与自动 Gate，但未被提前接受或合并；后续任务使用 stacked branch/PR 保持依赖与审查边界；
- 每项仍独立恢复权威来源、保持聚焦范围、运行 task/full Gate，并记录手工证据缺口；
- 未经统一审核明确批准，不提升 Draft/Proposed 为 Accepted，不合并功能 PR，不声明 RC/Production 可发布。

## 2. C-004 已完成交付

- 共享 CheckIn submit/correct/view Zod + JSON Schema + OpenAPI identity projection + generated API client；
- 服务端 `product-date-v1`：`Asia/Shanghai` 04:00 权威归日，不接收客户端 owner/date；
- PostgreSQL Checkin store：同命令同 payload 重放、异 payload 冲突、owner/date 唯一、revision CAS、更正历史与 command receipt 原子提交；
- ordinary API 只执行稳定 guard-code 函数，无 Safety/deletion 直接 SELECT；账户级 advisory fence 把 Safety/deletion/consent/account transition 与签到读写串行化；
- DLY-001：17 个 ChoiceChip、UNSURE 正式值、同日结构草稿、Loading/Error/Offline/Disabled、跨日清理、Unknown outcome 先读后重放与多端 conflict 恢复；
- ordinary logs/telemetry 不含 account ref 与 mood/energy/sleep 值；签到不写规则分数、结果或 AI 解释；
- Source registry 从 `226/784 COVERED` 更新为 `242/787 COVERED`，`PLANNED=545`，无 `UNMAPPED` 或未批准 `NA`。

## 3. 自动验证

- 精确工具链：临时校验的官方 Node `24.18.0`（SHA-256 与 Node 官方清单一致）+ pnpm `11.17.0`；
- C-004 changed/full Gate：`automated=PASS`，最终 `MANUAL_EVIDENCE_REQUIRED`；
- C-004 task Gate：5/5 命令执行，`automated=PASS`，最终 `MANUAL_EVIDENCE_REQUIRED`；
- API：19 files / 97 tests；Mini Program：9 files / 35 tests；shared-schemas：6 files / 44 tests；server-adapters：10 files / 40 tests；
- PostgreSQL 18 full integration：85/85，包含 C-001、C-002、C-004、SQL-001～020、TX-01～09、migration/seed/drift/restore；
- Contract Gate：56 error codes / 62 paths；Phase Gate：`242/787 COVERED`、`545 PLANNED`；
- supply-chain audit：critical 0 / high 0；全仓 build、artifact scan、queue 与 CI policy 均由 changed/full Gate 通过。

## 4. 手工证据与发布边界

- [C-004 人工证据](../tests/manual-rc/c004-evidence.json)如实保持 `MANUAL_EVIDENCE_PENDING / pass_claim=PROHIBITED`；
- D-004 Frame `220:11`～`220:15` 与 baseline `303:278` 已登记，Normal/Loading/Error/Offline/Disabled、Large Text、Reduced Motion 截图等待统一审核；
- 微信 DevTools 为 `INFRA_BLOCKED / MINIAPP_DEVTOOLS_CLI_PATH_MISSING`；iOS/Android 真机证据待 RC；
- threat boundary review 已准备 owner 审核清单，最终 owner review 等待 C-015 后统一审核；
- Production 授权对 C-004 不适用，Production / RC 继续 `NO_GO`。

## 5. 精确下一动作

1. 提交并推送 `agent/c004-daily-checkin`，创建聚焦 Draft PR；
2. 把 Draft PR 编号回写本文件并推送；
3. 从 C-004 final head 创建 stacked `agent/c005-stable-seed`；
4. 在 stacked branch 把 C-005 移为唯一 Ready，运行 `pnpm agent:prepare C-005 --remote --deep`；
5. 按 C-005 权威来源和 Gate 实现，不请求 C-004 逐项审核。

## 6. C-015 后统一审核

- 比较 C-004～C-015 的 stacked PR/branch 与 `main`，确认每个任务聚焦且依赖顺序明确；
- 运行最终完整 Gate，汇总所有自动与人工证据、视觉差异、安全/隐私边界和未决决定；
- 将 C-004～C-015 一并交付项目所有者审核；获明确批准后才依依赖顺序更新状态、准备合并和验证 main。

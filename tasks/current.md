# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-02（E-007 合并完成并提升 E-009）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-009 — 本地与测试 Docker Compose 环境
- **任务状态**：Ready
- **任务分支**：尚未创建；开工时从最新 `main` 创建
- **当前 Issue**：[E-009 Issue #47](https://github.com/WeiHan1996/DailyEnergy/issues/47)
- **当前 PR**：无
- **基线提交**：`9630691a87b184bafe6ca78900a31244a6e6c237`
- **Gate 结论**：`READY_TO_START`（code profile；开工后按实际路径升级）

## 1. 当前目标

提供可重复的 LOCAL、CI 与 STAGING-like Compose 拓扑，以及受控 fault/stub
profile；让 API、Admin、Worker、PostgreSQL 18、Redis 8 和外部 stub 在不接触生产
凭据或真实数据的前提下可一条命令启动、健康检查、故障注入和停止清理。

```text
common Compose contract
  → local / test / staging-like explicit profiles
  → API / Admin / Worker profile-specific commands
  → PostgreSQL / Redis / synthetic external stubs
  → health / network / egress / fault / shutdown evidence
```

E-009 当前只进入 Ready，尚未创建实现分支或修改 Compose/Docker 资产。开工必须读取
Issue #47、`pnpm agent:prepare E-009 --remote --deep` 返回的全部 required sources，
以及 Accepted deployment、testing、observability、architecture 与 repository-structure
原文，并重新核对 Docker、镜像、端口、网络和依赖状态后给出 GO/NO-GO。

## 2. 状态变更影响

- E-007 已随 [PR #113](https://github.com/WeiHan1996/DailyEnergy/pull/113)
  squash 合并，merge commit 为 `9630691a87b184bafe6ca78900a31244a6e6c237`，
  Issue #45 已关闭；
- 用户已明确接受 E-007 threat boundary、Restricted inbox 最小权限与残余风险；
- merged `main` 的完整 `pnpm run validate` 已通过，真实 PostgreSQL 18 suite 为
  `82/82`，Redis 8 / BullMQ 5 / PostgreSQL 18 queue integration 为 `7/7`；
- E-007 进入 Done，E-009 成为唯一 Ready；其它 Phase 1 工程任务继续保持 Planned；
- D-001～D-005 继续保持 Planned，不创建 Figma、Design Tokens 或业务页面。

## 3. 范围

- 创建 common、local、test、staging-like Compose 文件和显式 profiles；
- 编排 API、Admin、三类 Worker、PostgreSQL、Redis、对象/微信/provider/通知 stub
  与受控 fault service；
- 定义 health、volume、network、egress、synthetic config 和空 Redis 重建编排；
- 提供示例环境文件、无 secret 默认值和固定镜像/工具版本；
- 为 Compose config、cold start、health、shutdown、fault profile、secret/content 与
  network egress 建立正负证据。

## 4. 不做

- 不创建生产云资源、域名、证书、真实备份或高可用声明；
- 不连接真实微信、AI provider、对象存储或通知服务；
- 不提交 production secret、真实账号或真实用户数据；
- 不创建第二套生产拓扑，不合并 API/Admin/Worker capability；
- 不启动 E-010、E-011、E-012、D-001 或业务任务；
- 不实现 E-013 的正式指标、告警或生产 Runbook。

## 5. 验收与证据

- clean checkout 一条命令可启动最小环境、通过健康检查并可重复停止/清理；
- local/test/staging-like 共用一套权威拓扑，profile 与运行时 capability 一致；
- 普通 profile 不能获得 Restricted/Migration capability，网络 egress 默认拒绝未列目标；
- fault profile 可重复触发 PG、Redis、provider、network、clock 与 telemetry 故障；
- Redis 全丢恢复必须循环执行有界 rebuild，直到 PostgreSQL eligible backlog 清零；
- 所有 fixture、日志和 artifact 仅使用合成数据，并通过 secret/content scanner；
- 对应 Accepted Source ID 更新为 `COVERED`，无法覆盖时只能使用获批准的
  `NA_WITH_REASON`；
- 完成实现后运行实际路径要求的 full validation 并提交聚焦 Draft PR。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-003、E-005、E-006、E-007、E-008 已完成；
- **外部依赖**：开工时用 `--deep` 核对 Docker daemon、Compose、镜像和端口能力；
  只允许本地隔离容器与合成数据；
- **安全交接**：E-007 只提供 egress manifest/fingerprint 与错误 profile 的静态/运行时
  拒绝；E-009 必须落地实际容器网络/egress 强制，不能把“测试环境无网络”当证据；
- **恢复交接**：E-007 Redis rebuild 每次扫描有界批次；E-009 恢复编排必须重复执行，
  并以 PostgreSQL eligible backlog 清零为完成条件；
- **可观测性交接**：E-009 只提供 health/fault/telemetry stub 与 smoke evidence；正式
  metrics、alerts 和生产 Runbook 仍由 E-013 交付；
- **并行规则**：E-009 是唯一 Ready，尚未 In Progress；
- **下一动作**：收到 E-009 开工指令后，从最新 `main` 创建
  `agent/e009-docker-compose`，运行 `pnpm agent:prepare E-009 --remote --deep` 并完成
  GO/NO-GO；
- **下一任务**：E-009 完成前不提升其它任务；E-009 获接受后再评估 E-010。

## 7. 最近交接

- E-006 基线已随 [PR #108](https://github.com/WeiHan1996/DailyEnergy/pull/108)
  squash 合并，Issue #44 已关闭；
- E-006 安全返工已随 [PR #110](https://github.com/WeiHan1996/DailyEnergy/pull/110)
  squash 合并，merge commit 为
  `aa78bdd6af5936fddb56bae957a9dd881ef635f9`；
- PR #110 合并后，在完全访问环境运行 full Gate，发现 stale catalog fingerprint、
  S19-DB-011 保留字别名和 `INHERIT FALSE` 下 role probe 未返回稳定 mismatch；
- [PR #111](https://github.com/WeiHan1996/DailyEnergy/pull/111) 使用 clean PG18 重生成
  fingerprint，将 privilege probe 改为 catalog OID，并修复测试 SQL；已 squash 合并为
  `4dd14f742b70c2d69c0b52f377b066237c51e07c`；
- 最终验证：`pnpm run validate` 通过；真实 PostgreSQL 18 数据库测试 `82/82`，API
  `36/36`，Admin Chromium `6/6`，response leak negative fixtures `2/2`；
- E-007 已于 2026-08-02 从 `c14d8a8a8da504f708ecdf3556a1b3a9451fe058` 创建
  `agent/e007-redis-bullmq`；prepare deep/remote 为 READY，GO/NO-GO 结论为 GO；
- 已固定 `bullmq@5.81.3`、`ioredis@5.11.1` 与 Redis
  `8.2.1-bookworm@sha256:5fa2edb1e408fa8235e6db8fab01d1afaaae96c9403ba67b70feceb8661e8621`；
- 已实现 strict versioned envelope、三 profile capability manifest、bounded retry、
  BullMQ producer/consumer、graceful drain、PostgreSQL outbox relay/claim、同事务
  InboxReceipt、terminal receipt、relay/ACK crash hook 与 Redis-loss rebuilder；
- 新增追加型 migration `20260802000000_e007_queue_inbox_permissions`，仅向
  `daily_energy_deletion` 授予 Restricted inbox 所需的 INSERT/UPDATE；checksum、ACL
  fingerprint 与 drift probe 已更新并在 clean PostgreSQL 18 通过；
- unit queue suite `21/21`、Worker entrypoint `4/4`、scoped evidence `3/3` 和真实
  Redis 8 / BullMQ 5 / PostgreSQL 18 integration `7/7` 已通过；37 个直接覆盖的
  Accepted Source IDs 已在 `tests/queue/evidence-manifest.json` 标为 `COVERED`；
- 最终 `pnpm agent:validate --mode=changed`、`--mode=task --task=E-007` 与
  `--mode=full --profile=security` 均为 `automated=PASS`；真实 PostgreSQL 18 suite
  `82/82` 通过；策略因人工安全证据返回 `MANUAL_EVIDENCE_REQUIRED`；
- threat-boundary review 修正了 relay telemetry 的实际 queue-family 归属；最小权限、
  payload/log、profile/egress、终态、重建与合成数据边界无未解决代码发现；
- 用户于 2026-08-02 明确接受 E-007 threat boundary、Restricted inbox 最小权限与
  残余风险；[PR #113](https://github.com/WeiHan1996/DailyEnergy/pull/113) 已 squash
  合并为 `9630691a87b184bafe6ca78900a31244a6e6c237`，Issue #45 已关闭；
- merged `main` 的完整 `pnpm run validate` 已通过：PostgreSQL 18 `82/82`、Queue
  integration `7/7`、API `36/36`、Admin Chromium `6/6`、response leak fixtures
  `2/2`；首次运行仅被本仓库遗留的 3211 端口监听阻断，终止该测试进程后局部重跑与
  单次完整 Gate 均通过，未发现代码缺陷；
- E-009 Issue #47 保持 Open，Milestone 为 Phase 1；E-003、E-005、E-006、E-007、
  E-008 前置均已完成，现提升为唯一 Ready，尚未创建实现分支或修改 Compose 资产。

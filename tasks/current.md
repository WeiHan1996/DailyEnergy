# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-03（E-009 合并完成并提升 E-010）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-010 — 建立多层测试、Fixture 与 Source-ID Registry
- **任务状态**：Ready
- **任务分支**：实现分支尚未创建；状态交接分支为 `agent/e010-ready`
- **当前 Issue**：[E-010 Issue #49](https://github.com/WeiHan1996/DailyEnergy/issues/49)
- **当前 PR**：[状态 Draft PR #116](https://github.com/WeiHan1996/DailyEnergy/pull/116)
- **基线提交**：`4f1d06b498a5db730661cf39dd5ce005932645e2`
- **Gate 结论**：`READY_TO_START`（code profile；实现涉及测试、tooling、fixture 与
  registry，按实际路径运行 task/full Gate）

## 1. 当前目标

建立静态、单元、数据库、契约、HTTP、队列、E2E、恢复与 AI 评价测试骨架，让每个
Accepted Source ID 都有唯一、可执行、可审计的状态，不允许未覆盖场景静默消失。

```text
Accepted Source IDs
  -> versioned registry and synthetic fixture factory
  -> unit / contract / PG / queue / HTTP / Admin / miniapp runners
  -> deterministic fault, retry, flaky and artifact policy
  -> COVERED / PLANNED / approved NA_WITH_REASON evidence
```

E-010 当前只进入 Ready，尚未创建实现分支或修改测试骨架。开工必须读取 Issue #49、
`pnpm agent:prepare E-010 --remote --deep` 返回的全部 required sources，以及 Accepted
testing、evaluation、architecture、repository-structure 和相关 Schema/API/数据库/队列
原文；随后核对现有 runner、fixture、DevTools、Docker 与 Source-ID 集合并给出
GO/NO-GO。

## 2. 状态变更影响

- 用户已明确接受 E-009 threat boundary 与残余风险；
- [PR #115](https://github.com/WeiHan1996/DailyEnergy/pull/115) 已 squash 合并，merge
  commit 为 `4f1d06b498a5db730661cf39dd5ce005932645e2`，Issue #47 已关闭；
- merged `main` 的完整 `pnpm run validate` 已通过，真实 PostgreSQL 18 suite 为
  `82/82`，Redis 8 / BullMQ 5 / PostgreSQL 18 queue integration 为 `7/7`；
- E-009 进入 Done，E-010 成为唯一 Ready；E-011～E-014 与其它任务继续 Planned；
- D-001～D-005 继续 Planned，不创建 Figma、Design Tokens 或业务页面。

## 3. 范围

- 配置 Vitest projects、Playwright HTTP/Admin、Testcontainers 与微信 DevTools runner；
- 创建 fixture registry/source-ID registry，状态仅允许 `PLANNED`、`COVERED`、
  `NA_WITH_REASON`；
- 建立合成数据 factory、故障注入点、固定时间/随机源、网络/provider stub 和 artifact
  目录；
- 接入架构、Schema、SQL/TX、API、S28～S33 场景映射；
- 为 registry completeness、duplicate、skip、runner 与证据边界建立正负测试；
- 至少保留 unit、PG、queue、HTTP、Admin E2E 与 miniapp runner 的可执行示例。

## 4. 不做

- 不要求一次覆盖全部业务场景；未实现项必须保留为 `PLANNED`；
- 不调用真实模型、生产 provider、生产数据库、真实账号或真实用户数据；
- 不把内存替身当作 PostgreSQL/Redis/BullMQ、微信 DevTools 或真机证据；
- 不建立 E-011 的 CI workflow、required checks、托管 artifact 或 SBOM 晋级；
- 不启动 E-011、E-012、E-013、D-001 或业务实现任务；
- 不降低 Accepted ADR、Schema、API、隐私、Safety、删除、幂等、事务或 profile 边界。

## 5. 验收与证据

- 所有 Accepted Source ID 唯一注册；缺失、重复、未知状态或无 assertion 的覆盖必须失败；
- registry 明确区分 `PLANNED`、`COVERED` 与获批准的 `NA_WITH_REASON`；
- 真实 PostgreSQL/Redis/BullMQ 场景继续使用目标主版本，不用内存替身冒充；
- 测试隔离、固定时间/随机源、retry/flaky/quarantine 与 artifact 规则可执行；
- 微信路径明确区分纯逻辑、DevTools 自动化与真机发布前冒烟；
- fixture、日志和 artifact 仅含合成数据并通过 secret/content scanner；
- 完成实现后运行 changed、task 与按实际影响扩大的 full Gate，并提交聚焦 Draft PR。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-002～E-009 均已完成；
- **外部依赖**：开工时用 `--deep` 核对 Docker、浏览器、微信 DevTools 与 runner；
  真机、人工 AI 评价或外部授权缺失时必须保留明确待完成状态，不能伪报 PASS；
- **证据边界**：E-010 建立正式 registry，但不能把现有低层证据自动升级为更高层
  conformance；每个 Source ID 的强制层级以 Accepted testing/evaluation 原文为准；
- **并行规则**：E-010 是唯一 Ready，尚未 In Progress；
- **下一动作**：审核并合并本次纯状态 Draft PR；合并后等待用户指示，再从最新
  `main` 创建 E-010 实现分支并运行 `pnpm agent:prepare E-010 --remote --deep`；
- **下一任务**：E-010 完成前不提升 E-011；E-010 获接受后再评估 E-011。

## 7. 最近交接

- E-009 实现 11 个服务与 11 个隔离网络，覆盖 local/test/staging-like 和 test-only
  fault；API、Admin、三个 Worker、Migration、PostgreSQL 18、Redis 8 与合成 stub/
  fault proxy 均使用 profile-specific capability、secret file 与 network allowlist；
- Compose evidence `23/23`、静态/负例 `9/9`、真实 cold start/health/egress/shutdown 与
  fault integration `2/2` 通过；changed/task/full 均为 `automated=PASS`；
- E-009 threat review 确认 one-shot database-init、secret-free loopback host ingress、
  test-only tokenized fault proxy 与镜像内容边界；用户接受 Prisma migration 镜像依赖树、
  E-011 才补 SBOM/漏洞晋级，以及 staging-like 不代表 TLS/HA/backup/PITR 的残余风险；
- PR #115 于 2026-08-03 squash 合并为
  `4f1d06b498a5db730661cf39dd5ce005932645e2`，Issue #47 已关闭；
- 本地 `main` 已 fast-forward 到该 merge commit 且工作树干净；合并态完整
  `pnpm run validate` 通过：PostgreSQL 18 `82/82`、Queue integration `7/7`、API
  `41/41`、Worker `8/8`、server-adapters `29/29`、Admin unit `14/14`、Chromium
  `6/6`、response leak negative fixtures `2/2`；
- E-010 Issue #49 为 Open、Milestone 为 Phase 1，E-002～E-009 前置全部完成；首次
  pre-transition remote/deep prepare 仅因 `tasks/current.md` 仍指向 E-009 返回
  `CONTEXT_TASK_MISMATCH`，Node、pnpm、dependencies 与 GitHub deep checks 均通过；
- 状态切换后 `pnpm agent:prepare E-010 --remote --deep` 为 `READY`，remote/deep checks
  全部通过；策略要求的 `pnpm agent:validate --mode=full --task=E-010` 为
  `automated=PASS`；
- 状态切换已提交为 `b1a6422f8365a73af808d03a04160a0cb958a825` 并推送；
  [状态 Draft PR #116](https://github.com/WeiHan1996/DailyEnergy/pull/116) 已创建；
- 当前状态分支为 `agent/e010-ready`，只包含项目控制与导航更新；E-010 尚未开工，
  等待状态 PR 审核与合并。

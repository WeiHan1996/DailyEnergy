# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-03（E-010 实现完成并进入审核）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-010 — 建立多层测试、Fixture 与 Source-ID Registry
- **任务状态**：In Review
- **任务分支**：`agent/e010-test-registry`
- **当前 Issue**：[E-010 Issue #49](https://github.com/WeiHan1996/DailyEnergy/issues/49)
- **当前 PR**：[PR #117（Ready for review）](https://github.com/WeiHan1996/DailyEnergy/pull/117)
- **基线提交**：`69138b7e2188084a92d1cf23efbf021b5bab3722`
- **Gate 结论**：`IMPLEMENTATION_COMPLETE`（初始 code profile 因 artifact、runner、
  配置与测试路径提升为 security；完整自动 Gate 已通过，threat boundary review 为 PASS；
  微信 DevTools、真机和外部 AI/人工证据保持明确 pending）

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

E-010 已建立正式 registry：736 个唯一 Source ID 中 138 个为 `COVERED`、598 个为
`PLANNED`、0 个为 `NA_WITH_REASON`。root Vitest projects、真实 Nest HTTP Playwright、
真实 PG/queue、Admin Chromium 与微信 DevTools runner 均有机器可读描述；合成 fixture、
可重放 fault、sticky flaky、quarantine、artifact/corpus scanner 和 pending evidence 模板均
已接入，不改变既有数据库、队列或 Compose 证据层级。

## 2. 状态变更影响

- 用户已明确接受 E-009 threat boundary 与残余风险；
- [PR #115](https://github.com/WeiHan1996/DailyEnergy/pull/115) 已 squash 合并，merge
  commit 为 `4f1d06b498a5db730661cf39dd5ce005932645e2`，Issue #47 已关闭；
- merged `main` 的完整 `pnpm run validate` 已通过，真实 PostgreSQL 18 suite 为
  `82/82`，Redis 8 / BullMQ 5 / PostgreSQL 18 queue integration 为 `7/7`；
- E-009 进入 Done，E-010 成为唯一 In Progress；E-011～E-014 与其它任务继续 Planned；
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

当前实现证据：

- registry completeness/negative tests `5/5`，harness/policy `12/12`；
- root Vitest projects `28 files / 156 tests`，真实 Nest Playwright HTTP `4/4`；
- Playwright known-fail 证明 retry 1 通过后仍以 `FLAKY_FAIL` 非零退出；
- root `pnpm test`、lint、typecheck、build 与 `pnpm validate` 已通过，完整数据库/队列
  数量以 Gate 输出和 Draft PR 为准；
- `pnpm agent:validate --mode=changed` 为 `changed→full automated=PASS`，task Gate 为
  `automated=PASS`，full Gate 为 `automated=PASS`；三者因 security profile 均返回
  `MANUAL_EVIDENCE_REQUIRED`，对应 threat review 已 PASS、生产授权不适用；
- `pnpm test:coverage` 已执行并正确拒绝当前 65.58% statements / 63.93% branches /
  71.35% functions / 65.67% lines 基线；Accepted target 未降低，也未把未实现业务覆盖伪报
  为 PASS；
- 微信 runner 实际返回 `INFRA_BLOCKED: MINIAPP_DEVTOOLS_CLI_PATH_MISSING`；真机、模型、
  load、人评与专业评审继续 pending，不计作 E-010 自动 PASS。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-002～E-009 均已完成；
- **外部依赖**：开工时用 `--deep` 核对 Docker、浏览器、微信 DevTools 与 runner；
  本机未配置微信 DevTools CLI，结果为 `INFRA_BLOCKED`；真机、人工 AI 评价或外部授权
  缺失均保留明确 pending，不能伪报 PASS；
- **证据边界**：E-010 建立正式 registry，但不能把现有低层证据自动升级为更高层
  conformance；每个 Source ID 的强制层级以 Accepted testing/evaluation 原文为准；
- **coverage 边界**：阈值配置保留 Accepted 80/75、90/85、95/95/100 目标；当前继承代码
  未达 target，coverage 命令保持非零缺口信号，不在 E-010 内补写下游业务测试或降低阈值；
- **threat boundary**：只使用合成 identity/token/text；测试服务仅环回监听；外部网络与
  provider 默认封闭；production graph 无 testing import；artifact/trace/output 不提交且受
  content/secret policy；未使用生产凭据、真实账号、真实内容或生产授权；
- **并行规则**：E-010 是唯一 In Review；
- **下一动作**：审核 PR #117，确认自动 Gate、coverage 缺口与外部 pending 证据边界；
  获得明确批准后再执行 squash merge；
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
- PR #116 已合并为 `69138b7e2188084a92d1cf23efbf021b5bab3722`；本地 `main` 与
  `origin/main` 对齐且工作树干净；实现分支 `agent/e010-test-registry` 已从该提交创建；
- `pnpm agent:prepare E-010 --remote --deep` 的本地/deep checks 与 GitHub 读取通过；旧的
  `tasks/current.md` 仍映射已合并 PR #116，导致 `REMOTE_PR_NOT_OPEN`，本次开工状态更新
  已移除该过期映射；
- Issue #49 范围、Accepted testing/evaluation/architecture/repository-structure 及相关
  Schema、API、数据库、队列和既有 evidence manifest 已开始逐项核对，开工结论为 GO。
- 正式 Source-ID registry 从 11 个 Accepted/executable source set 生成 736 个唯一 ID；
  missing、duplicate、unknown state、missing assertion、insufficient layer 与未批准 NA 均
  有稳定失败规则，现有 DB/queue/Compose evidence 只在满足强制层级时合并；
- root runner 使用显式 `vitest.projects.ts`，避免 package-local Vitest 自动发现后重复跨包
  执行；API lifecycle 产物路径锚定 app root，standalone root runner 会先构建所需产物；
- Playwright APIRequestContext 通过真实 Nest 测试应用验证 health、closed validation
  envelope、audience 隔离与 detail-free 404；Admin 两个 Playwright 配置使用一次 retry +
  sticky reporter，首次失败不会被第二次通过擦除；
- `tests/registry/runners.json` 固定 PG18、Redis 8/BullMQ 5、API、Admin、miniapp 与 Vitest
  的命令、真实依赖、隔离和 unavailable 状态；RC/AI evidence 模板默认禁止 PASS；
- 当前无仓库或代码阻塞；coverage target、微信 DevTools、真机与外部 AI/人工证据状态均
  已显式记录，E-011 与下游业务任务未提前开始。
- E-010 实现已提交为 `7a5eddfe3a33771056a31856a203766f3ef4b176` 并推送；
  [PR #117](https://github.com/WeiHan1996/DailyEnergy/pull/117) 已创建并关联 Issue #49；
  用户于 2026-08-03 要求提交 PR，现已标记为 Ready for review；当前等待明确审核批准，
  未将 coverage 缺口或外部 pending 证据升级为 PASS。

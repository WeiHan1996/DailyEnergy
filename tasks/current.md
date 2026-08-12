# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-12（E-014 分层结论、威胁边界复核和本次开发合并残余风险已获接受）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-014 — 执行 Phase 1 工程基础 Gate
- **任务状态**：In Review
- **任务分支**：`agent/e014-phase1-gate`，基于 `a5d83d5a4fe48988c6618fe53fbc0ab0e8039eae`
- **当前 Issue**：[E-014 Issue #52](https://github.com/WeiHan1996/DailyEnergy/issues/52)
- **当前 PR**：[Draft PR #138](https://github.com/WeiHan1996/DailyEnergy/pull/138)；用户审核已通过，等待 acceptance commit 的 exact-head CI 11/11 后标 Ready 并合并
- **最近完成 PR**：[E-013 PR #135](https://github.com/WeiHan1996/DailyEnergy/pull/135)
- **Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO / OWNER_ACCEPTED_FOR_THIS_DEVELOPMENT_MERGE_ONLY`

## 1. 当前目标

用独立、可执行和可追溯的证据决定是否允许 Phase 2 开发，同时不把开发工程基础外推成
Production readiness。

```text
Accepted E-012/E-013 evidence + current full automated Gate
  -> explicit 736-Source-ID ownership inventory
  -> CONDITIONAL_GO_FOR_PHASE_2
  -> Production/RC remains NO_GO until external/manual evidence exists
```

## 2. 已确认决策

- 用户于 2026-08-12 明确要求按务实方案实现 E-014 至可审核合并；
- 用户于 2026-08-12 明确接受上述分层结论、完成 security profile 的
  `threatBoundaryReview`，并仅为 PR #138 本次 development merge 接受 GitHub Free 残余风险；
  Production authorization 明确未授予；
- Phase 2 development admission 与 Production/RC admission 分开判断；前者可建议
  `CONDITIONAL_GO_FOR_PHASE_2`，后者在 PITR、真实告警投递/TTL、微信 runner/真机和完整
  incident/manual RC 未完成时必须 `NO_GO`；
- E-012 已接受且合同未漂移的真实 DEV deploy/rollback/reconciliation 证据直接复用，不重复操作
  服务器或产生新云费用；E-014 仍重跑当前自动化、容器和 fail-closed Gate；
- registry 的 `PLANNED` 不被当作 PASS，也不要求 Phase 2/3 业务在 Phase 1 提前实现；每项必须
  有 owner/reason，任何 silent `PLANNED` 或 `UNMAPPED` 都失败；
- 不创建新 ADR：技术栈、服务边界、Production hard Gate 和安全边界未改变；这是 Accepted
  testing/deployment/observability 规范的分层修订；
- 用户已授权在 acceptance commit 的同 run 11/11、exact-head verifier 和
  `--match-head-commit` 全部通过后标 Ready、squash 合并并关闭 Issue #52；合并前不启动
  D-001、C-001 或其它下游任务。

## 3. 开工与基线证据

- `pnpm agent:prepare E-014 --remote --deep`：开工时 `READY/profile=code`，remote/dependencies/
  environment 均通过；写入 Accepted specs、incident/Production Gate 与测试后，路径影响将最终
  profile 提升为 `security`，因此必须 full Gate + `threatBoundaryReview`，且
  `productionAuthorizationWhenApplicable` 明确未授予；
- branch base、local `main`、`origin/main` 与开工时 GitHub main 均为
  `a5d83d5a4fe48988c6618fe53fbc0ab0e8039eae`；对应 main CI run `31569245433` 为 11/11 SUCCESS；
- E-012 PR #134 final head `5c598132787ba14a62de793827e4fb86a6dfb59c`，CI run
  `31546068208` 11/11，squash merge `dd201713a90b9f49e27cf66f6967210db8dc7f36`；真实 DEV
  已完成 N+1 deploy 18/18、reconcile 17/17、rollback N 18/18、redeploy N+1 18/18；Accepted
  state SHA-256 为 `56433f48fbf743f2ef38dab437647e188d01a40b90e4a3f62f37e9bb9e3d08d6`；
- E-013 PR #135 final head `a123b553e55df0fec939211af608694155e804e9`，CI run
  `31563458000` 11/11，squash merge `d7500333eda31d160667a0ae0e49413f600ee0e0`，merge-main
  CI run `31568032735` 11/11；
- 2026-08-12 只读复核 rulesets 和 `main` branch protection API 均返回 GitHub Free 403；不能
  声称 platform enforcement。testing 22.2 补偿控制修订为只允许 development branch merges，
  每次要求 owner 接受残余风险、同 run 11/11、exact head、`--match-head-commit` 和 receipt；
  任一 RC、平台能力可用、第二 merge-capable actor、owner 撤回或 2026-11-02 到期时停止；
- 已记录 E-013 合并命令遗漏 `--match-head-commit` 的流程偏差，不改写为完全合规；E-014 后续
  merge（若获批准）必须实际使用该参数。

## 4. 已实现交付

- [Phase 1 Gate Accepted](../docs/reports/phase-1-gate.md)：结论、复用证据、PLANNED 解释、Production
  阻塞项、GitHub Free 风险与审核前 Gate；
- `tests/phase-gate/contract.json`：7 项 development requirement、7 项 deferred Production
  requirement、baseline receipts 和 merge-control scope；
- `tests/phase-gate/source-inventory.json`：736 total / 203 COVERED / 533 PLANNED /
  0 NA_WITH_REASON，逐 source set 固定 authority、owner 和数量；
- `tooling/phase-gate/check.mjs` 与 5 个 negative tests：拒绝 baseline receipt 替换、unconditional
  GO、Production PASS、silent PLANNED、inventory drift、RC 使用临时 merge control 和 manual
  evidence false-PASS；
- observability exercise contract 已拆成 development conditional Gate 与 Production/RC
  `NO_GO / completed=false / pass_claim=PROHIBITED`；
- CI policy 已把补偿控制限定为 development merges，并把 `phase-gate:validate` 接入
  `unit-contract`；
- Accepted testing/deployment/observability、authority index、registry evidence、README、
  ROADMAP、docs index、tests README 和 backlog 已同步；没有业务代码、Production 配置或资源变更。

## 5. 验证状态

已通过：

- `pnpm registry:write`：736 total / 203 COVERED / 533 PLANNED / 0 NA；
- `pnpm phase-gate:validate`：checker PASS，negative tests 5/5；
- `pnpm observability:validate`：22 alerts / 5 dashboards / 6 runbooks，tests 7/7；
- `pnpm ci:test`：25/25；`pnpm ci:check`：12 lanes / 9 automated / 3 explicit external pending。
- `pnpm database:validate`：真实 PostgreSQL 18 suite 82/82；SQL-001～020、TX-01～09、role/grant、
  migration/upgrade/drift/restore-ledger/detector 全通过；
- `pnpm queue:validate`：真实 PostgreSQL 18 + Redis 8 + BullMQ suite 7/7；replacement empty Redis
  只重建 eligible PG facts 且 PG fact count 不变；
- `pnpm compose:validate`：static/evidence 9/9、cold start/health/egress/shutdown 1/1、deterministic
  dependency fault matrix 1/1。
- `pnpm run build`：11-package Turbo build 7/7 tasks；Admin production build 与 bundle scan 通过；
- `pnpm observability:runtime`：exact-digest Collector、Prometheus、Alertmanager、Loki、Tempo
  runtime config 5/5 通过。

最终验证状态：

- `pnpm agent:validate --mode=task --task=E-014` 已执行：`profile=security`，格式、lint、typecheck
  通过；测试在 deployment suite 48/50 处以稳定平台错误停止；
- `pnpm agent:validate --mode=full --task=E-014` 已执行：同样在 deployment suite 48/50 处停止；
  本机 automated status 如实为 `FAIL`，未报告为 PASS；
- PR #138 实现与状态一致性 head `93b64a686823f18fb3d942e99e2700f1d2cc7e5a` 的固定 Ubuntu
  CI run `31580514678` 已由同一 run 11/11 SUCCESS；覆盖 Linux `flock`、Linux-only
  supply-chain inventory、固定 npm audit、9 个 automated lanes 和 aggregate Gate；PR 为
  `CLEAN/MERGEABLE` 且仍是 Draft；
- PR #138 首轮 head `2ba9b0b1cbc9ef0fcd517431307948d13b9835d5` 的 CI run `31579999699`
  正确拒绝了 `tasks/current.md=In Review` 与 `tasks/backlog.md=In Progress` 的状态冲突；9 个前置
  checks 成功，`unit-contract` 与 aggregate Gate 失败。该 run 不计作 final-head PASS，本状态提交
  修正冲突后必须整套重跑；
- 仓库 merge-gate verifier 在 PR 仍为 Draft 时正确返回 `CI_MANUAL_MERGE_GATE_PR_NOT_READY`；不为
  预验而提前标 Ready。项目所有者批准后，必须对当时 exact final head 再运行 verifier；
- security profile 的 `threatBoundaryReview` 已完成；审核覆盖开发/Production 分层、receipt
  替换、stale head、跨 run 拼接、`--match-head-commit`、RC/Production 禁用与敏感数据边界；
  Production authorization 明确未授予。

本机已知平台/环境限制：

- task/full Gate 的 deployment suite 均为 48/50；仅两个失败为 macOS 无 Linux `flock`，稳定错误
  `RELEASE_LOCK_RUNTIME_MISSING:flock`，没有放宽合同；
- 本机 `ci:audit` 因配置指向第三方 `registry.npmmirror.com` 且返回 metadata 不符合固定 contract
  而失败；未获授权时不把仓库依赖清单发送到该第三方重试；
- 本机 supply-chain inventory 正确拒绝 Darwin optional
  `@img/sharp-libvips-darwin-arm64@1.3.2` 的 LGPL-3.0-or-later；不增加 Linux 生产 allowlist；
- 上述三项必须由 E-014 final-head Ubuntu GitHub CI 的 11/11 作为权威平台证据补齐。

## 6. Production / RC 未决项

- Production PostgreSQL backup/key、PITR 隔离恢复、独立 current deletion/restore-deny ledger、
  deleted-data detector 和 recovery-copy destruction：`BLOCKED`；
- 真实 on-call recipient、alert canary delivery/ack/escalation：`BLOCKED`；
- 真实 observability backend TTL/RBAC/replica/export/support copy deletion 与独立 outage fault
  domain：`BLOCKED`；
- 微信 DevTools dedicated runner：`INFRA_BLOCKED`；iOS/Android 真机：
  `MANUAL_EVIDENCE_PENDING`；
- named Incident Commander 与 Safety/Privacy/Security reviewer 的完整 incident/recovery observation：
  `MANUAL_EVIDENCE_PENDING`；
- 云/独立 stateful services/域名/主体/Production identity/legal/region/cross-border 授权：
  `BLOCKED/UNVERIFIED`。

上述项目不是 waiver；任何一项缺失都禁止 Production readiness 或 RC PASS 声明。

## 7. 精确下一动作

1. 提交并推送 acceptance evidence，等待其 final head 的固定 Ubuntu CI 同一 run 11/11；
2. 用 PR comment 固化 exact final head/run/checks，标 Ready 后运行 exact-head merge-gate verifier；
3. 使用 `--match-head-commit` 的补偿控制 squash merge，关闭 Issue #52，验证 merged main CI；
4. 把 E-014 设为 Done，并从依赖图选择恰好一个 Phase 2 下一任务 Ready，不在同一交接中开工。

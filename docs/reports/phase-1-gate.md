# DailyEnergy Phase 1 工程基础 Gate

- **文档状态**：Draft
- **所属任务**：E-014 — 执行 Phase 1 工程基础 Gate
- **最后更新**：2026-08-12
- **评审对象**：Phase 2 development admission；不是 Production 或 Release Candidate 审批
- **机器合同**：[E-014 Phase Gate contract](../../tests/phase-gate/contract.json)
- **Source-ID 盘点**：[E-014 Source inventory](../../tests/phase-gate/source-inventory.json)

## 1. 结论

```text
Phase 2 development: CONDITIONAL_GO_FOR_PHASE_2
Production / Release Candidate: NO_GO
Owner decision: PENDING_REVIEW
```

建议允许下一阶段的设计和确定性核心开发，但要满足两个条件：E-014 final PR head 的固定
Ubuntu CI 必须 11/11 全绿，项目所有者必须审核并明确接受本报告和 GitHub Free 的残余合并风险。

这不是“工程已经可以上线”。Production PostgreSQL PITR、当前 deletion/restore-deny ledger、
真实告警投递、真实 backend TTL 删除、微信 DevTools/真机和完整 incident/manual RC 没有证据，
因此 Production 与 RC 明确 `NO_GO`。

## 2. 为什么可以继续开发

| 要求                      | 结论                                 | 证据                                                                                                                        |
| ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 可重复构建与 CI           | 实现 head 已验证，状态 head 仍须重跑 | main `a5d83d5` run `31569245433` 11/11；PR #138 `93b64a6` run `31580514678` 11/11                                           |
| 不可变 DEV 部署与回滚     | 复用 Accepted E-012                  | PR #134 merge `dd201713`；N+1 deploy 18/18、reconcile 17/17、rollback 18/18、redeploy 18/18；state SHA-256 `56433f48...8d6` |
| 数据库与迁移              | 自动化证据可重跑                     | PostgreSQL 18 clean/upgrade/grant/TX suites 与 migration/drift Gate                                                         |
| Redis 整体丢失            | 有真实 replacement Redis 证据        | `T-QUEUE-INTEGRATION-REBUILD-001`：只从 PG 重建 eligible facts，PG fact count 不变                                          |
| Compose 与故障恢复        | 有可重放合成证据                     | clean startup、smoke、PG/Redis/provider/network/clock/telemetry fault tests                                                 |
| secret/content/capability | fail-closed 自动 Gate                | 11-lane CI、artifact scan、profile/runtime/egress/secret known-fail fixtures                                                |
| 监控基线                  | reference stack 可执行               | E-013 48 项 proof、runtime config parse、SLO/alert/cost/outage contracts                                                    |
| Source-ID                 | 无 silent omission                   | 736 项全部有显式状态；203 COVERED、533 PLANNED、0 NA；每个 PLANNED 有 owner 和 reason                                       |

E-012 的部署合同、digest 和 topology 没有被 E-014 修改，因此重复操作真实服务器不能增加新的
证明力，反而增加时间、成本和运行风险。本 Gate 重跑自动化层，并引用已经接受、仍然适用的真实
部署/回滚 receipt。

## 3. `PLANNED` 为什么不阻塞开发

533 个 `PLANNED` 不是遗漏，也没有被算成 PASS。它们主要属于 Phase 2/3 的业务、API、隐私和
AI 实现，例如 269 个 AI corpus、37 个 Gateway、34 个隐私、47 个 API 和 44 个数据库业务场景。
要求它们在 Phase 1 全部 `COVERED` 会形成循环依赖：必须先完成 Phase 2/3，才允许开始 Phase 2。

开发准入采用以下规则：

- 所有 Accepted/Schema Source ID 必须出现在 registry；
- 每个 `PLANNED` 必须有 owner 和未完成原因；
- 下游功能只能在自己的 Issue 完成时转为强制层级的 `COVERED`；
- `PLANNED` 对 Production/RC 仍然不足，不能用于发布声明。

逐来源集合的数量和 owner 由 `tests/phase-gate/source-inventory.json` 固定，checker 会拒绝
unmapped、silent planned、数量漂移、baseline receipt 替换或假覆盖。

## 4. Production / RC 阻塞项

| 阻塞项                    | 当前状态                | 解除条件                                                                                         |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| PostgreSQL PITR 隔离恢复  | BLOCKED                 | 批准 Production backup/key/独立 ledger/RECOVERY，执行 restore、当前删除重放、detector 与副本销毁 |
| 真实告警投递              | BLOCKED                 | 批准真实接收人和独立通道，完成 canary delivery、ack 与 escalation                                |
| 真实 retention/TTL 删除   | BLOCKED                 | 在真实 backend 验证 primary/replica/export/support copy 的 TTL 与 RBAC                           |
| Production backend 故障域 | BLOCKED                 | 后端与 application host 独立，并完成 outage/heartbeat/black-box 演练                             |
| 微信 DevTools             | INFRA_BLOCKED           | 专用 runner、批准的 synthetic project 与固定基础库 evidence                                      |
| iOS/Android 真机          | MANUAL_EVIDENCE_PENDING | 对一个具名 RC 执行合成账号真机矩阵并由 reviewer 签署                                             |
| Incident/manual RC        | MANUAL_EVIDENCE_PENDING | named IC 与 Safety/Privacy/Security reviewer 执行完整恢复和观察窗口                              |
| Production 外部决策       | BLOCKED/UNVERIFIED      | 云、服务、域名/主体/identity/on-call/legal/region/cross-border 全部获授权                        |

这些事项不是 waiver，也没有取消；它们被移到正确的 Production/RC 决策点。任何一项未完成时，
`production_readiness_claim=PROHIBITED`。

## 5. GitHub Free 合并控制

2026-08-12 只读复核显示 private GitHub Free 对 ruleset 和 `main` branch protection API 均返回
403，要求升级 GitHub Pro 或公开仓库。因此当前不能声称 platform-enforced required checks。

开发分支合并继续使用 11/11 机器核验的人工补偿控制：一次读取绑定 exact head、11 个 checks
来自同一 run、`CLEAN/MERGEABLE`、owner 明确批准、`--match-head-commit`、PR comment 和
post-merge receipt。E-013 合并曾遗漏 `--match-head-commit`，本 Gate 将其记录为已知流程偏差，
不改写成完全合规。E-014 及之后必须实际使用该参数。

该控制只适用于 development merges；Phase 2 RC、Alpha/Beta RC 或 Production 前必须停止。
它最迟于 2026-11-02 到期，平台能力可用、第二位 merge-capable actor 出现或 owner 撤回接受时
也必须提前停止。

## 6. 审核前 Gate

E-014 请求合并审核前必须完成：

1. `pnpm agent:validate --mode=task --task=E-014` 与 full code Gate；
2. 真实 PostgreSQL 18、replacement Redis 8 和 Compose fault suites；
3. E-014 contract、source inventory、observability/CI false-PASS tests；
4. final PR head 的固定 Ubuntu 11/11 CI；
5. 项目所有者明确接受 `CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO` 和临时合并残余风险。

本机 task/full Gate 均已执行，但 macOS 因缺少 Linux `flock` 在 deployment suite 48/50
处稳定停止，automated status 如实为 `FAIL`，没有跳过或放宽合同。真实 PostgreSQL 18、replacement
Redis 8、Compose fault、build 和 reference observability runtime 的聚焦 suites 已通过；Linux
平台结论必须由 final PR head 的固定 Ubuntu 11/11 CI 给出。security profile 的
`threatBoundaryReview` 仍待项目所有者完成，Production authorization 明确不在本次请求范围内。

PR #138 首轮 head `2ba9b0b1cbc9ef0fcd517431307948d13b9835d5` 的 CI run `31579999699`
正确拒绝了 current/backlog 的 `In Review`/`In Progress` 状态冲突：9 个前置 checks 成功，
`unit-contract` 与 aggregate Gate 失败。该 run 不是 final-head PASS；状态修正后必须由一个新 run
完整给出 11/11。

修正后的实现与状态一致性 head `93b64a686823f18fb3d942e99e2700f1d2cc7e5a` 已在固定 Ubuntu
CI run `31580514678` 获得同一 run 11/11 SUCCESS，PR 状态为 `CLEAN/MERGEABLE` 且保持 Draft。
本次纯状态证据回写形成的新 final head 仍须完整 11/11，并由 PR comment 固化 final head/run；
Draft 状态下 merge-gate verifier 返回 `CI_MANUAL_MERGE_GATE_PR_NOT_READY` 是预期的 fail-closed
行为，只有项目所有者批准并标 Ready 后才能执行最终 exact-head merge 核验。

通过审核后才把 E-014 置为 Done，并从 Phase 2 依赖图中选择恰好一个下一任务 Ready；本 Draft
报告不提前启动 D-001、C-001 或其它下游任务。

# DailyEnergy Phase 1 工程基础 Gate

- **文档状态**：Accepted
- **接受日期**：2026-08-12
- **所属任务**：E-014 — 执行 Phase 1 工程基础 Gate
- **最后更新**：2026-08-12
- **评审对象**：Phase 2 development admission；不是 Production 或 Release Candidate 审批
- **机器合同**：[E-014 Phase Gate contract](../../tests/phase-gate/contract.json)
- **Source-ID 盘点**：[E-014 Source inventory](../../tests/phase-gate/source-inventory.json)

## 1. 结论

```text
Phase 2 development: CONDITIONAL_GO_FOR_PHASE_2
Production / Release Candidate: NO_GO
Owner decision: ACCEPTED_FOR_THIS_DEVELOPMENT_MERGE_ONLY
Threat boundary review: COMPLETED
Production authorization: NOT_GRANTED
```

项目所有者已接受下一阶段的设计和确定性核心开发条件放行，并仅为 PR #138 本次开发合并
接受 GitHub Free 的残余合并风险。E-014 final PR head 已在固定 Ubuntu CI 中同一 run
11/11 全绿，并按补偿控制完成合并；接受决定没有替代机器 Gate。

这不是“工程已经可以上线”。Production PostgreSQL PITR、当前 deletion/restore-deny ledger、
真实告警投递、真实 backend TTL 删除、微信 DevTools/真机和完整 incident/manual RC 没有证据，
因此 Production 与 RC 明确 `NO_GO`。

## 2. 为什么可以继续开发

| 要求                      | 结论                             | 证据                                                                                                                        |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 可重复构建与 CI           | final head 与 merged main 已验证 | PR #138 `8365e41` run `31586034272` 11/11；merge `c1ad026` run `31586384383` attempt 2 11/11                                |
| 不可变 DEV 部署与回滚     | 复用 Accepted E-012              | PR #134 merge `dd201713`；N+1 deploy 18/18、reconcile 17/17、rollback 18/18、redeploy 18/18；state SHA-256 `56433f48...8d6` |
| 数据库与迁移              | 自动化证据可重跑                 | PostgreSQL 18 clean/upgrade/grant/TX suites 与 migration/drift Gate                                                         |
| Redis 整体丢失            | 有真实 replacement Redis 证据    | `T-QUEUE-INTEGRATION-REBUILD-001`：只从 PG 重建 eligible facts，PG fact count 不变                                          |
| Compose 与故障恢复        | 有可重放合成证据                 | clean startup、smoke、PG/Redis/provider/network/clock/telemetry fault tests                                                 |
| secret/content/capability | fail-closed 自动 Gate            | 11-lane CI、artifact scan、profile/runtime/egress/secret known-fail fixtures                                                |
| 监控基线                  | reference stack 可执行           | E-013 48 项 proof、runtime config parse、SLO/alert/cost/outage contracts                                                    |
| Source-ID                 | 无 silent omission               | 736 项全部有显式状态；203 COVERED、533 PLANNED、0 NA；每个 PLANNED 有 owner 和 reason                                       |

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

2026-08-20 E-016 后续处置：项目所有者明确授权将仓库设为 public，并接受完整历史、提交者
邮箱和 Figma 身份信息公开，要求保持无 LICENSE。上述恢复触发已经满足；临时补偿控制由 active、
无 bypass 的 `main` repository ruleset 取代。11 个 required checks、exact-head verifier、
用户批准和 `--match-head-commit` receipt 保留。public GitHub Actions development artifact 的平台
上限为 90 天；RC/Release 365 天证据在获批归档后端落地前保持
`PENDING_APPROVED_ARCHIVAL / pass_claim=PROHIBITED`。本报告的 Production/RC `NO_GO` 不变。

## 6. Threat Boundary Review

2026-08-12 已按 `security` profile 完成人工威胁边界复核，结论为：

- 开发准入和 Production/RC 准入由不同字段及负向测试约束；所有 Production/RC 未决项仍为
  `NO_GO / completed=false / pass_claim=PROHIBITED`，本次没有授予 Production authorization；
- stale head、跨 run 拼接检查和审核后换头由 exact head、同一 run 11/11、
  `--match-head-commit` 与 post-merge receipt 控制；任一不一致必须停止合并；
- GitHub Free 缺少 platform enforcement 的残余风险只接受于 PR #138 本次 development merge，
  不可复用于 RC/Production，也不构成以后合并的持续授权；
- E-012/E-013 receipt 只可按固定 commit/run/digest 复用；checker 拒绝 receipt 替换、silent
  `PLANNED`、unmapped、Production false-PASS 和 manual RC false-PASS；
- 本 PR 不接触 Production、真实用户数据、secret、云资源或服务器；macOS 的 Linux `flock`
  缺口不作 waiver，仍由 exact final-head Ubuntu CI 提供平台证据。

复核未发现需要改变当前分层结论的新威胁。剩余风险是单一 merge-capable actor 在 GitHub Free
下执行人工补偿控制的操作风险；项目所有者已明确接受其仅用于本次开发合并。

## 7. 最终 Gate 与合并结果

E-014 请求合并审核前要求：

1. `pnpm agent:validate --mode=task --task=E-014` 与 full code Gate；
2. 真实 PostgreSQL 18、replacement Redis 8 和 Compose fault suites；
3. E-014 contract、source inventory、observability/CI false-PASS tests；
4. final PR head 的固定 Ubuntu 11/11 CI；
5. 项目所有者明确接受 `CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`、完成
   `threatBoundaryReview`，并仅为本次开发合并接受临时合并残余风险。

本机 task/full Gate 均已执行，但 macOS 因缺少 Linux `flock` 在 deployment suite 48/50
处稳定停止，automated status 如实为 `FAIL`，没有跳过或放宽合同。真实 PostgreSQL 18、replacement
Redis 8、Compose fault、build 和 reference observability runtime 的聚焦 suites 已通过；Linux
平台结论必须由 final PR head 的固定 Ubuntu 11/11 CI 给出。security profile 的
`threatBoundaryReview` 已完成；Production authorization 明确未授予。

PR #138 首轮 head `2ba9b0b1cbc9ef0fcd517431307948d13b9835d5` 的 CI run `31579999699`
正确拒绝了 current/backlog 的 `In Review`/`In Progress` 状态冲突：9 个前置 checks 成功，
`unit-contract` 与 aggregate Gate 失败。该 run 不是 final-head PASS；状态修正后必须由一个新 run
完整给出 11/11。

修正后的实现与状态一致性 head `93b64a686823f18fb3d942e99e2700f1d2cc7e5a` 已在固定 Ubuntu
CI run `31580514678` 获得同一 run 11/11 SUCCESS，PR 状态为 `CLEAN/MERGEABLE` 且保持 Draft。
随后 acceptance evidence 形成的新 final head 按合同完整重跑 11/11，并由 PR comment 固化
final head/run；Draft 状态下 merge-gate verifier 当时返回
`CI_MANUAL_MERGE_GATE_PR_NOT_READY` 是预期的 fail-closed 行为，只有项目所有者批准并标 Ready
后才执行最终 exact-head merge 核验。

项目所有者审核完成后，acceptance commit
`8365e41ad98034e724bb46bc3cb889c4861569de` 的固定 Ubuntu CI run `31586034272` 同一 run
11/11 SUCCESS；exact-head verifier 返回
`CI_MANUAL_MERGE_GATE_OK:pr=138:head=8365e41ad98034e724bb46bc3cb889c4861569de:run=31586034272:checks=11`，
并由 [PR comment](https://github.com/WeiHan1996/DailyEnergy/pull/138#issuecomment-5265330997)
固化审计记录。PR #138 使用 `--match-head-commit` squash 合并为
`c1ad026cd1ac1be131b56b8f5c82bf76e407b503`，Issue #52 已关闭。

merged-main CI run `31586384383` attempt 1 的 `unit-contract` 仅因 Docker Hub 拉取固定 Tempo
镜像时 `Client.Timeout exceeded while awaiting headers` 失败，aggregate Gate 因依赖失败而停止；
失败 jobs 重跑后 attempt 2 对同一 merge commit 11/11 SUCCESS。该瞬时基础设施失败被保留，
没有改写成首次即通过。

E-014 现为 Done，Phase 1 已结束；Phase 2 development 按已接受的条件放行开始，D-001 成为唯一
Ready 任务。Production/RC 的第 4 节阻塞项、`NO_GO` 与
`production_readiness_claim=PROHIBITED` 均未改变。项目所有者对 GitHub Free 残余风险的接受只
覆盖 PR #138，不自动授权任何后续 PR 合并。

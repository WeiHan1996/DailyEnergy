# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-04（E-011 已合并，E-012 等待开发基础设施授权）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-012 — 部署固定开发环境与可回滚发布流程
- **任务状态**：Blocked
- **任务分支**：尚未创建实现分支；当前仅有状态交接分支 `agent/e012-handoff`
- **当前 Issue**：[E-012 Issue #50](https://github.com/WeiHan1996/DailyEnergy/issues/50)
- **当前 PR**：[状态交接 Draft PR #120](https://github.com/WeiHan1996/DailyEnergy/pull/120)
- **基线提交**：`266a7dc39b87aec23740d64656bf33081a3aa34b`
- **Gate 结论**：`E011_DONE / E012_DEPENDENCIES_PASS / DEVELOPMENT_INFRASTRUCTURE_AUTHORIZATION_BLOCKED`

## 1. 当前目标

在已批准的开发基础设施上建立 digest 晋级、`ReleaseManifestV1`、TLS 入口和可验证回滚；
生产环境、生产身份和真实用户数据继续保持 Gate。

```text
approved development infrastructure
  -> immutable CI digest + ReleaseManifestV1 + release lock/preflight
  -> reverse proxy/TLS + independent PG/Redis/object endpoints
  -> ordered deploy + health/readiness + synthetic observability
  -> recorded rollback target + config/secret compatibility proof
```

## 2. E-011 完成交接

- [PR #119](https://github.com/WeiHan1996/DailyEnergy/pull/119) 已于
  `2026-08-04T08:37:03Z` squash 合并为
  `266a7dc39b87aec23740d64656bf33081a3aa34b`，Issue #48 已关闭；
- 最终 head `e1124be49a731b516e7d1f8d458b55058e503aef` 的 GitHub run
  [#30892281313](https://github.com/WeiHan1996/DailyEnergy/actions/runs/30892281313)
  为 11/11 checks 全部成功；真实 PostgreSQL、Redis/BullMQ、API/Admin E2E、resilience、
  deterministic AI 与 supply-chain 路径均通过；
- 临时合并控制的机器 receipt 为
  `CI_MANUAL_MERGE_GATE_OK:pr=119:head=e1124be49a731b516e7d1f8d458b55058e503aef:run=30892281313:checks=11`，
  PR comment 已记录核验时间、checks、用户批准与 `--match-head-commit` merge guard；
- Actions artifact retention 为 365 天；验证 artifact `8883871771` 从
  `2026-08-04T07:30:28Z` 保留至 `2027-08-04T07:29:16Z`，无 retention clamp；
- Accepted testing 22.2 允许私有 GitHub Free 仓库临时使用机器核验、人工批准的补偿控制。
  它最迟 2026-11-02 到期，并在 platform enforcement 可用、出现第二位 merge-capable actor、
  E-014 开始或 RC 前提前失效；它不豁免任何失败、缺失或 pending check；
- 合并后的本地 `main`、`origin/main` 与 GitHub `main` 已核对为同一提交
  `266a7dc39b87aec23740d64656bf33081a3aa34b`。

## 3. E-012 范围

- 实现幂等部署入口、发布锁、preflight、`ReleaseManifestV1` 与唯一 rollback target；
- 部署单 host Compose application，连接独立受控 PostgreSQL、Redis 和 object endpoint；
- 配置 reverse proxy/TLS、health/readiness、maintenance、Worker 发布顺序与证据保存；
- 编写开发环境发布、回滚、配置轮换、恢复 runbook 与审批点；
- 证明同一 CI image digest 晋级，服务器不现场 build，不使用 mutable tag；
- 验证 staging-like deploy/rollback、并发发布锁、坏配置/坏镜像、Worker drain 与 N/N-1 兼容。

## 4. 不做

- 不创建或修改生产资源、生产数据、生产微信身份、生产 provider、生产 secret 或用户流量；
- 不声称 HA、零停机、自动扩缩、跨区域容灾或 24×7 值班；
- 不用服务器现场 checkout/build、mutable tag、共享 broad credential 或手工未记录回滚；
- 不启动 E-013、E-014、D-001 或任何业务实现任务；
- 不降低 Accepted ADR、Schema、API、隐私、Safety、删除、幂等、事务、profile、测试或
  可观测性边界。

## 5. 当前阻塞与授权边界

- **前置依赖**：E-009 与 E-011 已完成，代码依赖满足；E-012 Issue #50 为 Open，Milestone
  为 Phase 1；
- **权威阻塞**：Issue #50 明确要求云厂商、主机、域名/TLS、区域、身份和真实 secret 未批准时
  保持 Blocked；deployment 26 的外部 Production Gates 也不能由仓库文档或本地模拟解除；
- **需要的用户决定/授权**：开发环境的云厂商与账户主体、region、主机规格/预算、固定域名与
  DNS/TLS 控制权、独立 PostgreSQL/Redis/object 方案、部署身份/secret store、责任人及退出方案；
- **禁止推定**：不得把“继续下一步”解释为购买服务、创建账号/主机/域名、写入 DNS、签发证书、
  创建数据库、保存真实 secret 或开放公网的授权；
- **context prepare**：`node tooling/agent-prepare.mjs E-012 --remote` 已确认 route=`READY`、
  profile=`code`、remote check PASS、Issue/Milestone 正确；这只证明仓库路由和代码前置满足，
  不能替代 Issue #50 要求的开发基础设施授权；
- **下一动作**：先取得上述开发基础设施的明确选择与授权；随后从最新 `main` 创建
  `agent/e012-development-deployment`，重新运行 `pnpm agent:prepare E-012 --remote --deep`，
  阅读全部 required sources 后再给出 GO/BLOCKED 开工结论；
- **下一任务**：E-012 完成后才评估 E-013；当前不提升其它任务。

## 6. 验证与环境说明

- 本次 post-merge handoff 的正式 `agent:validate --mode=full --task=E-012` 在首个
  `pnpm run validate` 前置依赖状态检查返回 `FAIL`：本机 Node `24.6.0` 与固定 `24.18.0`
  不一致，本地 pnpm store 又缺 package index，并尝试不可用的 registry/依赖清理；该结果不
  改写为 PASS，Agent workflow、registry、目标格式与 diff 已分别通过，固定 Linux 状态 PR
  run 将补齐权威自动证据；
- E-011 本地定向 CI policy `23/23`、registry
  `736 total / 155 COVERED / 581 PLANNED / 0 NA_WITH_REASON`、Agent workflow、目标 ESLint、
  format 与 diff Gate 均通过；
- 本机 Node 为 `24.6.0`，低于项目固定 `24.18.0`，且本地 pnpm store 不完整；本机聚合
  changed/task/full Gate 不改写为 PASS，固定 `ubuntu-24.04` GitHub run 是 E-011 权威证据；
- 外部 lane 继续保持 `miniapp-conformance=INFRA_BLOCKED`、
  `ai-model-load-human=PENDING_EXPLICIT_AUTHORIZATION`、
  `manual-rc=MANUAL_EVIDENCE_PENDING`，没有被 E-011 自动化冒充为 PASS。

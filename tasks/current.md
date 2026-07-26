# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-32
- **当前任务名称**：部署、配置和回滚
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/deployment-config-rollback`
- **上游 PR**：[S-31 PR #36](https://github.com/WeiHan1996/DailyEnergy/pull/36)
- **当前 PR**：待创建
- **交付文件**：`docs/technical/deployment.md`

## 1. 当前目标

把 Accepted 的技术栈、系统架构、仓库边界和测试策略转换为可实施的环境、发布与恢复合同，明确：

- LOCAL、CI、DEV、STAGING、PRODUCTION、RECOVERY、EVALUATION 与 MINIAPP_RUNNER 边界；
- 单区域、单活、单 application host 的 Docker Compose MVP 拓扑和非 HA 限制；
- API、Admin、Interactive、Background、Restricted、Migration 与 Evaluation 的最小运行能力；
- immutable image、digest promotion、Release Manifest、SBOM/provenance 和 supply-chain Gate；
- public/deploy/secret/runtime catalog/emergency 配置分级、启动校验和指纹；
- migration、发布顺序、queue/in-flight、回滚、PITR、隔离恢复和删除重放。

## 2. 必须交付

### 2.1 环境、产物与配置

- 环境封闭枚举、数据/身份/网络/外部调用规则；
- production Compose 与独立 PostgreSQL/Redis/object 边界；
- build-once、same digest promotion 和 `ReleaseManifestV1`；
- Config Schema、profile/capability fingerprint 和 fail-closed startup；
- OIDC/短期部署身份、service secret mount、轮换/吊销；
- CI runner、artifact、source map、remote cache 和 evidence retention。

### 2.2 Migration、发布与回滚

- 独立 Migration Job、migration owner、checksum/drift/grant Gate；
- expand → resumable backfill → contract compatibility；
- staging、production preflight、consumer-before-producer 和小程序/server compatibility；
- Worker drain、graceful shutdown、outbox/queue/in-flight 恢复；
- 唯一 rollback target、代码/配置/catalog/secret/DB 回滚矩阵；
- hard stop、maintenance/emergency switch 和 observation。

### 2.3 Backup 与恢复

- PostgreSQL encrypted base backup + WAL/PITR、35 天、RPO/RTO 工程目标；
- backup integrity、synthetic/production-isolated restore drill；
- Redis empty rebuild、object/provider/session/notification 恢复边界；
- RECOVERY 隔离、当前 deletion/restore-deny ledger 重放和 deleted-data detector；
- 48 个唯一 `S32-DEPLOY-*` 场景；
- E-003～E-014 与 S-33～S-35 的交接。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/decisions/ADR-0006-monorepo-and-stack.md`；
3. `docs/technical/architecture.md`；
4. `docs/technical/repository-structure.md`；
5. `docs/technical/testing.md`；
6. `docs/technical/database.md` 与 `prisma/schema.prisma`；
7. `docs/technical/api.md`、`error-codes.md` 与 `openapi/openapi.yaml`；
8. `docs/operations/privacy-data-map.md`；
9. `docs/operations/incident-response.md`；
10. `docs/ai/gateway.md` 与 `evaluation.md`；
11. `docs/technical/deployment.md`。

## 4. 已冻结边界

- Node 24 LTS、TypeScript 7 strict、pnpm 11、Turbo 2、Docker Compose v2；
- 微信原生小程序、NestJS/Express、Next/React、PostgreSQL/Prisma、Redis/BullMQ、Zod 不重新选型；
- 模块化单体、一个 PostgreSQL database/schema、无内部 RPC；
- PostgreSQL 是事实；Redis/BullMQ/cache/artifact/backup catalog 不是；
- API/Admin/Worker profiles、事务/outbox/inbox/Gateway/Safety/删除语义不变；
- production 禁止 `db push` 和应用启动 migration；
- backup 最长 35 天，restore 前必须执行 deletion ledger/restore deny；
- 普通 CI 只用合成数据，不调用生产微信/provider/object/notification；
- S-33 决定 SLO/告警/成本阈值；S-32 不引入 Kubernetes、多云、微服务或自动扩缩。

## 5. 不做

- 不创建 Dockerfile、Compose、workflow、registry、runner、云主机、数据库、Redis 或 object store；
- 不创建/执行 migration、backup、restore、部署、rollback 或 secret rotation；
- 不选择云厂商、region、域名、备案主体、微信生产 AppID、SSO 或 provider；
- 不提交 `.env`、secret、证书、key、生产账号或真实数据；
- 不启用 remote cache、外部 source map/test report 或真实 provider evaluation；
- 不定义 S-33 P95/P99、告警阈值、预算或 on-call；
- 不提前开始 E-009～E-013 或 S-33。

## 6. 验收标准

- `deployment.md` 为 Draft，覆盖环境、拓扑、profile、镜像/manifest、配置/secret、migration、发布/回滚、backup/restore 与 artifact；
- 48 个 `S32-DEPLOY-*` 场景完整且唯一；
- 所有相对链接可解析；
- `testing.md` 根据用户确认转为 Accepted，S-31 backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-32 In Review；
- PR 仅包含 6 个 Markdown 文件，无配置、代码、workflow、container、migration、secret、云资源或生产变更；
- 用户确认前 `deployment.md` 保持 Draft，S-32 保持 In Review。

## 7. 最近交接

- [PR #36](https://github.com/WeiHan1996/DailyEnergy/pull/36) 已于 2026-07-26 合并，S-31 测试策略已获用户明确确认；
- `testing.md` 在本分支补记 Accepted/接受日期，不改变测试层级、工具、Gate 或 48 个场景；
- S-32 Draft 冻结环境、单 host Compose、profile capability、Release Manifest 和 config/secret 分级；
- migration 使用 expand/backfill/contract；发布 consumer-before-producer；普通回滚不执行 down migration；
- PostgreSQL 使用 encrypted base backup + WAL/PITR，Redis 从 PostgreSQL 重建，restore 先重放删除/restore-deny；
- 云厂商、主体、region、跨境、SSO、真实受托方和账号仍是 Production Blocked Gate；
- 当前动作：等待用户审核 Draft PR；不自动接受、合并或开始 S-33。

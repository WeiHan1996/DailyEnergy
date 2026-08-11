# DailyEnergy 部署、配置与回滚规范

- **文档状态**：Accepted
- **所属任务**：S-32 — 部署、配置和回滚
- **最后更新**：2026-08-11（E-012 release-scoped file secret 的容器强制收敛合同已接受）
- **适用范围**：Phase 1～3 的本地/CI/开发/预发布/生产环境、OCI 镜像、Docker Compose、配置与密钥、数据库迁移、发布、回滚、备份和隔离恢复
- **上游权威**：[ADR-0006 Monorepo 与技术栈](../decisions/ADR-0006-monorepo-and-stack.md)、[ADR-0007 临时 DEV 同机例外](../decisions/ADR-0007-development-colocation-exception.md)、[系统架构](./architecture.md)、[仓库结构与模块边界](./repository-structure.md)、[测试策略](./testing.md)、[数据库规格](./database.md)、[隐私数据地图](../operations/privacy-data-map.md)、[故障和安全事件响应](../operations/incident-response.md)
- **下游任务**：S-33～S-35、E-003～E-014、C-014、A-007～A-010

## 1. 目的

本文把已接受的技术栈、运行时拓扑、数据库/队列语义、测试 Gate、保存删除和事件响应边界，转换为一套可以实施和演练的环境、发布与恢复合同。核心验收句是：

> 同一份经验证的不可变产物必须从 CI 晋级到预发布和生产；任何配置、密钥、迁移、发布、回滚或恢复都不能产生第二份业务事实、绕过 Safety/删除 guard、复活已删数据、把 Redis 当备份，或把真实内容复制进构建与运维系统。

本文回答：

1. 哪些环境存在，各自允许什么数据、身份、网络和外部调用；
2. Docker Compose 在 MVP 生产中编排哪些进程，哪些有状态服务必须独立；
3. Release Manifest、镜像 digest、配置 Schema、secret version 和数据库版本怎样形成同一发布指纹；
4. API、Admin、Interactive、Background、Restricted 与 Migration profile 如何获得最小权限；
5. migration 怎样按 expand → backfill → contract 演进；
6. 发布怎样处理旧/新代码、queue event、outbox、in-flight work 和用户流量；
7. 哪些故障可以回滚代码，哪些只能 roll forward 或隔离恢复；
8. PostgreSQL、Redis、对象、provider 和配置分别怎样备份、重建或清理；
9. 恢复怎样先执行 restore deny、删除 ledger、TTL 和 source invalidation，再允许服务；
10. E-009～E-013 需要实现哪些环境、流水线和演练证据。

## 2. 不重开的已接受边界

- 单一 Git repository、pnpm 11 workspace、Turborepo 2、Node.js 24 LTS、TypeScript 7 strict；
- 微信原生小程序、NestJS 11/Express 5、Next.js 16/React 19、PostgreSQL 18/Prisma 7、Redis 8/BullMQ 5、Zod 4；
- Docker Compose v2 是初始本地与 MVP 部署模型，不在 S-32 引入 Kubernetes、Swarm、多云或微服务平台；
- Phase 1～3 是单 PostgreSQL database/application schema、模块化单体、无内部 HTTP/RPC；
- API、Admin、Interactive Generation Worker、Background Worker、Restricted Data Worker 和 Migration Job 是独立运行 profile；
- PostgreSQL 是业务事实；Redis、BullMQ、cache、镜像、artifact、log、trace 和 backup catalog 都不是；
- 普通请求、事务型 outbox/inbox、CommandReceipt、PublishGuard、revision/CAS、Safety 和删除 guard 语义不变；
- shared-schemas 是 JSON 业务字段权威，OpenAPI 是 HTTP path/envelope 权威，Prisma 只在 DB adapter 内；
- AI route、Prompt、template、policy 和 provider data-handling profile 使用已发布版本，不由环境变量临时改写；
- 生产不使用 `prisma db push`，不在应用启动时自动执行 migration；
- 备份最长 35 个自然日；恢复前必须应用 deletion ledger、restore deny、guard、TTL 与 source invalidation；
- 普通 CI 只使用合成数据，不调用生产微信、AI provider、对象存储或通知；
- Safety、删除、owner、SQL/TX、capability、secret 和 contract drift Gate 不得 waiver；
- S-33 冻结生产指标、SLO、告警和成本阈值；本文只定义发布/恢复必须暴露的稳定信号和硬触发。

如本文与 Accepted ADR、产品、Safety、隐私、数据库、API、架构或测试合同冲突，以上游权威为准。

## 3. 范围与不做事项

### 3.1 本文负责

- 环境枚举、信任边界、数据等级和外部调用规则；
- MVP 单区域、单活、Docker Compose 生产拓扑与已知限制；
- OCI 镜像、Release Manifest、SBOM/provenance 和 digest 晋级；
- build-time、deploy-time、secret、runtime catalog 与 emergency switch 配置分层；
- 启动配置校验、profile fingerprint、依赖版本与 fail-closed 规则；
- environment protection、部署身份、审批和最小权限；
- Migration Job、兼容窗口、backfill、contract migration 和 drift Gate；
- 发布顺序、consumer-before-producer、queue/claim 处理、canary 与维护模式；
- 回滚触发、目标、数据库兼容矩阵和 roll-forward 边界；
- PostgreSQL 备份/PITR、Redis 重建、对象清理、恢复隔离和删除重放；
- CI artifact、source map、remote cache、镜像和发布证据期限；
- 48 个 `S32-DEPLOY-*` 固定场景。

### 3.2 本文不负责

- 创建 Dockerfile、Compose、workflow、secret store、registry、云主机、数据库、Redis、DNS、证书或生产账号；
- 选择腾讯云、阿里云、AWS、GitHub-hosted/self-hosted runner 或具体托管数据库厂商；
- 固定真实域名、ICP备案主体、微信生产 AppID、企业 SSO、状态页或监管联系人；
- 创建 migration、运行 `prisma migrate deploy`、建立备份或恢复任何真实数据；
- 定义 S-33 的 P95/P99、队列/错误告警阈值、预算和 on-call 路由；
- 承诺多可用区、高可用、零停机、自动扩缩或 24×7 人工响应；
- 启用第三方 Turbo remote cache、外部 source-map 服务、用户级分析或真实 provider evaluation；
- 把文档中的目标视为现有生产能力；
- 提前开始 E-009～E-013、S-33 或业务实现。

## 4. 部署决策摘要

| 主题 | 唯一结论 |
|---|---|
| MVP 生产形态 | 单区域、单活、单 Linux application host 的 Docker Compose v2；明确接受主机级短时不可用，不声称 HA |
| Compose 范围 | 只编排 reverse proxy、API、Admin、三个 Worker profile 和受控一次性 job；生产 PostgreSQL/Redis/对象存储使用独立受控端点 |
| 有状态服务 | PostgreSQL 18 独立服务并具备加密 base backup + WAL/PITR；Redis 8 可整体丢失并由 PostgreSQL 重建 |
| 构建 | 每个 commit 构建一次 OCI artifact；staging 与 production 使用同一 digest，禁止服务器现场 build |
| 发布权威 | `ReleaseManifestV1` 固定 commit、lockfile、image digest、SBOM、migration、config、contracts 与 Gate evidence |
| 配置 | 公开 build config、非秘密 deploy config、secret ref/version、PostgreSQL runtime catalog、emergency switch 五类分离 |
| 密钥 | 优先短期 OIDC/工作负载身份；运行 secret 通过受控 secret store 生成只读文件并按 service 显式挂载 |
| migration | 独立 Migration Job；expand → resumable backfill → contract；代码启动不迁移，生产禁止 `db push` |
| 发布顺序 | preflight → expand migration → 新 consumer → API producer → Admin → restricted capability → observation |
| 回滚 | 回到上一份 Accepted Release Manifest；只有数据库仍兼容时允许代码回滚，否则 roll forward 或全环境隔离恢复 |
| 备份 | PostgreSQL 目标 RPO ≤15 分钟、Beta 工程 RTO ≤4 小时；最长 35 天；Redis 不恢复 |
| 恢复 | 只在隔离 RECOVERY 环境恢复，先重放 restore-deny/删除/TTL/source invalidation，再运行 detector 和 Gate |
| remote cache | v1 禁用第三方 Turbo remote cache；CI job-local cache 可删除且不含 secret/内容 |
| CI artifact | 普通合成测试 14 天；RC/Release evidence 365 天；真实内容或 secret 一经发现立即隔离并按事件流程处理 |

RPO/RTO 是 Phase 1/Beta 的工程准备目标，不是对用户的公开承诺。真实规模、区域与服务商确定后，S-33/A-008 必须用演练结果校准。

## 5. 环境模型

### 5.1 环境枚举

| 环境 | 生命周期 | 数据 | 外部调用 | 权限/用途 |
|---|---|---|---|---|
| `LOCAL` | 开发者本机、可销毁 | 合成 seed | 默认本地 stub，无生产 egress | 全栈开发；可运行 Compose PG/Redis |
| `CI` | 每次 run 临时 | 合成 fixture | deny-by-default；仅 registry/package 下载等显式 allowlist | static/test/build/security；无生产 secret |
| `DEV` | 共享开发、可重建 | 合成或专用测试身份 | 微信测试/开发能力；provider 默认 template/stub | 集成开发；不得复制生产 |
| `STAGING` | 持久、生产同构 | 只用合成主体 | sandbox/stub；真实 provider 仅显式受限 evaluation run | migration、发布、回滚、恢复与 RC 演练 |
| `PRODUCTION` | 持久、受控 | 真实用户数据 | 只允许已批准微信/provider/object endpoints | 唯一用户服务环境 |
| `RECOVERY` | 临时、隔离 | 加密生产备份的受限副本 | 默认无互联网和用户流量 | 恢复、删除重放、完整性验证；完成后 24h 内销毁 |
| `EVALUATION` | 显式付费 run | SyntheticSubjectRef | 仅受批准 provider/profile | S-16 MODEL/LOAD/HUMAN；与生产身份/数据库隔离 |
| `MINIAPP_RUNNER` | CI/RC 临时 | 合成测试账号 | 只到测试小程序/API | 微信 DevTools automator；不拥有生产 AppSecret |

环境名是封闭枚举。不得使用 `test2`、`prod-copy`、个人命名空间或临时共享数据库绕开规则。

### 5.2 环境隔离

- 每个环境拥有独立 database、Redis namespace/instance、object prefix/bucket、session/signing key、provider route catalog 和 encryption key scope；
- 禁止跨环境数据库连接、queue、session、cookie、object URL、callback、webhook 或 secret 复用；
- `STAGING` 不接受生产流量，不使用真实 openid、AccountRef、用户文本或生产数据库 snapshot；
- `RECOVERY` 是唯一允许处理生产 backup 副本的非生产环境，必须无用户入口、无 ordinary provider/notification egress、独立 Restricted 审计；
- 环境复制只复制代码、Schema、migration、public config template 和合成 seed，不复制 `.env`、secret、数据库、日志或对象；
- production secret 不下发到 CI、LOCAL、DEV、STAGING、EVALUATION 或 MINIAPP_RUNNER；
- 环境标识必须写入 Release Manifest、runtime startup fingerprint、数据库连接期望值和 artifact evidence；错连立即 fail closed。

### 5.3 E-012 临时 DEV 例外

[ADR-0007](../decisions/ADR-0007-development-colocation-exception.md) 仅为当前 E-012 `DEV` 接受一个有期限的数据库/队列拓扑例外：PostgreSQL 18 与 Redis 8 可在同一台临时 application host 上以独立容器、网络和 volume 运行。object endpoint 不再使用 synthetic stub，而是使用腾讯云上海 `ap-shanghai` 的独立私有 COS；application 只能通过同地域 private/internal endpoint 访问 `dev/objects/`。家庭 NAS、生产身份、真实用户对象和生产数据均不进入该环境。

COS 保持私有、版本控制关闭；`dev/objects/` 的当前对象 7 天后删除，未完成分块 1 天后清理，只用于 synthetic、可重新生成的 application object，不承担 PostgreSQL backup 或长期保留。专用 CAM 编程身份只能拥有该 bucket/prefix 的必要 object read/write/delete、受限 list 与 multipart actions，不得控制 bucket 配置、账户其它 bucket/prefix 或控制台登录。真实 bucket/APPID/endpoint 与 credential value 保存在外部 DEV 配置和 root-only secret 中；仓库、镜像、manifest 与日志只保存 endpoint class、region、prefix、配置 fingerprint 和 secret version reference。

PostgreSQL/Redis 与 COS application object 都按 disposable DEV state 管理：不声称 backup、PITR、RPO、RTO、HA 或长期数据耐久性，主机丢失时用同一 release manifest、image digest、migration、无值 COS 配置与 seed 重建。域名完成 ICP 备案并取得 DNS/TLS 授权前，只允许 loopback/SSH tunnel 验证，不开放公网 80/443。

E-012 的 DEV 控制面使用隔离、checksum 固定的 Node 24.18.0，不替换主机系统 Node。手动 publication workflow 只接受已经进入 `main` 且一个 CI run 内 11 个 required checks 全部成功的精确 commit；它分别记录 CI run 与 publication run，发布 `admin/migration/proxy/server/stub` 五个 `linux/amd64` digest，并生成 source-free deployment bundle。服务器安装入口验证 allowlist、SHA-256、publication evidence、外部 COS 配置 fingerprint 与 root-only 权限后，原子安装到版本化 bundle 目录；服务器不 checkout、不 build，也不接收 CI 远程 SSH。

DEV 发布控制器固定执行 preflight、digest pull、stateful readiness、关闭 loopback TLS、worker drain、migration/drift verify、Interactive、Background、API、Admin、Restricted、恢复 TLS、health、COS object、Safety、owner、deletion 与退出维护共 18 个有序阶段；全通过后才写 Accepted state 和唯一 N-1 rollback target。每个创建持久服务容器的 Compose `up` 阶段必须显式 `--force-recreate`：Compose 的 service config hash 不保证包含 top-level file secret 的 source path，不能把“hash 相同”当成 release-scoped secret bind 已收敛。TLS proxy 继续以 UID/GID 1000、`cap_drop: ALL`、`no-new-privileges` 和只读根文件系统运行；因为 DEV 仅监听 8443/8444，proxy image 必须在构建阶段移除上游 Caddy 二进制不再需要的 `cap_net_bind_service` 文件能力，并在 publication 中以同一 capability boundary 实际执行 Caddy，不能靠恢复 capability 绕过启动失败。该短维护窗口只适用于尚无公网和真实用户的 DEV，不构成 Production 零停机设计。具体操作者步骤见 [DEV 发布、回滚与换机 Runbook](../operations/development-deployment-runbook.md)。

首次发布尚无 Accepted state 时，同一失败 manifest 可以重放。若失败发生在 migration 阶段之前、`migration_applied=false`、`migration_verified=false` 且没有 from-current/recovery catalog，显式部署一个不同且已通过 preflight/secret materialization 的新 candidate 可以替换该失败候选；控制器必须先写入绑定旧 `operation_id`、失败阶段和 replacement manifest digest 的 `SUPERSEDED_BEFORE_MIGRATION` receipt，再清除旧 pending 并开始新 operation。active phase 已进入 migration 或任一 migration checkpoint 为 true 时禁止替换，必须保持 dirty state 并人工判定数据库事实；不得删除或编辑 operation/state 绕过。

此例外不改变 5.2 与第 6、18、19 节的生产合同。`STAGING`、`PRODUCTION` 和处理真实备份的 `RECOVERY` 必须使用独立受控 PostgreSQL、Redis 与对象服务，并使用不同 bucket/prefix、credential、retention 与审计边界；其 preflight 遇到 `DEV_COLOCATED_EXCEPTION` 必须 fail closed。DEV volume、dump、COS object 或 secret 不得迁入 STAGING/PRODUCTION。

## 6. MVP 生产拓扑

### 6.1 单区域、单活边界

Phase 1～Beta 的初始生产为：

```text
Internet / WeChat
  → TLS reverse proxy
      → API Runtime
      → Admin Runtime（独立域名/访问策略）

Internal network
  → Interactive Worker
  → Background Worker
  → Restricted Data Worker
  → one-shot Migration / maintenance jobs

Private service endpoints
  → PostgreSQL 18
  → Redis 8 / BullMQ 5
  → object storage / CDN
  → approved WeChat / AI provider endpoints
```

- reverse proxy、API、Admin 和 Worker 在同一 application host 上由 production Compose 编排；
- PostgreSQL、Redis 和对象存储不得依赖 application host 的匿名本地 volume 作为合格生产持久层；
- 生产 PostgreSQL 优先使用满足本文 backup、PITR、加密、访问和区域 Gate 的托管/独立服务；实际厂商未选前 Production Gate 为 `BLOCKED`；
- Redis 可以是独立托管或隔离实例，但丢失时必须从 PostgreSQL outbox/due/task 重建，不恢复旧 queue snapshot；
- Worker 无 inbound public port；Admin 不直连 PG/Redis/provider；
- single host 是明确的可用性限制；主机故障通过新 host + 同一 Release Manifest 重新部署，不通过复制可变容器文件系统恢复；
- 需要多 host、multi-AZ 或自动 failover 时必须基于 S-33/A-008 证据新建 ADR，不能在 Compose 中伪造 HA。

### 6.2 Compose 合同

- root `compose.yaml` 表达共同拓扑；production overlay 只表达生产差异；
- image 必须使用 immutable digest，禁止 `latest`、`node:lts`、浮动 major 或现场 `build:`；
- 生产不 bind mount 应用源码、lockfile、Prompt、migration 或 host Docker socket；
- 每个 service 有只读 root filesystem（必要可写目录显式 tmpfs/volume）、非 root user、capability drop 和资源上限；
- 只暴露 reverse proxy 必要端口；PG、Redis、Worker 和管理端内部端口不得公网绑定；
- service 只能挂载它被批准的 secret/config；
- restart policy 不能把配置/Schema/profile mismatch 变成无限 crash loop；连续启动拒绝须停止并告警；
- `docker compose config` 的规范化结果必须通过 secret/path/port/profile 扫描并写入无值 fingerprint；
- Compose 文件不是业务配置权威，不能承载 route、Safety、Prompt、template、retention、删除或产品开关内容。

Docker 官方文档明确支持用 production override 调整 Compose 配置、在单服务器部署，并通过 service 级 `secrets` 挂载只读文件；本文采用该能力但增加项目自己的最小权限、digest 与隐私 Gate：

- https://docs.docker.com/compose/how-tos/production/
- https://docs.docker.com/compose/how-tos/use-secrets/

## 7. Runtime profile 与最小能力

| Profile | Inbound | DB role | Queue/handler | Egress | Secret |
|---|---|---|---|---|---|
| API | public API only | `api-app` + 封闭 `api-safety` pool | 不消费 BullMQ | 微信身份、必要内部 endpoint | session/signing、微信 server credential、DB role |
| Admin | reverse proxy + enterprise auth | 无直接 DB | 无 queue | 只到 Admin API | SSO/server session；无 DB/provider |
| Interactive | none | `worker-core` | Daily generation/recovery | approved Daily providers | provider role、DB/Redis |
| Background | none | `worker-core` | outbox、relationship、weekly、notification、projection | approved platform/Weekly route | 仅所需 adapter credential |
| Restricted | none | `worker-deletion` | deletion/export/cleanup/backup deadline | provider delete/object cleanup | restricted DB/object/provider cleanup |
| Migration | one-shot | `migration owner` | 无业务 queue | DB only | 临时 migration credential |
| Evaluation | one-shot | `evaluation` | 独立 evaluation queue 或无 queue | approved evaluation providers | evaluation-only provider credential |

要求：

- 一个 service 不能因“同一镜像”获得全部 secret、DB role、network 或 handler；
- profile、handler allowlist、DB expected role、egress policy 和 secret names 形成 `CapabilityFingerprint`；
- startup 必须验证 profile 与 Release Manifest、数据库角色、migration version、queue contract、config/secret refs 相符；
- Restricted 与 Migration credential 不存在于 API、Admin、Interactive、Background image runtime environment；
- secret rotation 或 role mismatch 时 fail closed，不退化到 owner/superuser；
- Interactive 具有保留 CPU/内存和 provider concurrency，Background/Restricted 不能通过 Compose scale 抢占；
- 精确 replica、CPU/内存和连接池由 E-012 基于 S-33 load evidence 固定；无证据时初始每 profile 单实例，不能宣称 HA。

## 8. 不可变构建与镜像晋级

### 8.1 Build once

- 受保护 CI 从 clean checkout、frozen lockfile 和 exact Node/pnpm/toolchain 构建；
- API 与三个 Worker profile可以共享 server artifact，但 entrypoint/profile 必须不同；Admin 使用独立 image；
- image 内包含编译产物、必要 migration/client 和版本 metadata，不包含 `.git`、test fixture、coverage、`.env`、secret、生产数据或任意 provider response；
- production 不重新 `pnpm install`、生成 Prisma、编译 TypeScript 或 build image；
- staging 验证过的同一 image digest 才能晋级 production；
- tag 只便于人读，Release Manifest 中的 digest 才是部署权威；
- 基础镜像 exact version + digest；升级走独立 PR 和 S-31 适用矩阵；
- 构建时间不访问生产 secret；私有依赖如需 token，只使用 ephemeral build secret 且不进入 layer/history。

### 8.2 Supply-chain evidence

每个可发布 image 必须关联：

- source commit SHA；
- root lockfile SHA-256；
- Dockerfile/build definition SHA；
- base image digest；
- output image digest；
- SBOM；
- vulnerability scan result 与 policy version；
- build provenance/attestation；
- license Gate；
- codegen/migration checksum；
- S-31 required lane evidence。

Critical/high vulnerability 的处置时限与例外由安全策略和 S-33/E-011 落地；未知、未扫描或 attestation mismatch 的 image 不得晋级。

## 9. Release Manifest

`ReleaseManifestV1` 的当前可执行闭包为：

```text
ReleaseManifestV1 {
  release_id
  source {
    repository
    commit_sha
    lockfile_sha256
    ci_run_id
    ci_run_attempt
  }
  images {
    admin
    migration
    proxy
    server
    stub
  }
  supply_chain {
    gate_ref
    image_set_sha256
    provenance_sha256
    sbom_sha256
  }
  migrations {
    catalog_fingerprint
    catalog_generation
    migration_head
    destructive=false
    rollback_compatible_release_ids[]
  }
  config {
    config_schema_version
    contract_bundle_version
    environment
    log_level
    product_date_policy_version
    runtime_fingerprints {
      api_capability
      api_deploy_config
      object_config
      worker_background
      worker_interactive
      worker_restricted
    }
    secret_ref_versions[]
  }
  topology {
    stateful_topology
    public_ingress
    object_endpoint
    object_region
    object_prefix
    object_config_ref
    production_enabled=false
  }
  compatibility {
    generation
    accepted_generations[]
    manifest_versions[]
  }
  evidence {
    required_gates[]
    source_ids[]
    synthetic_only
  }
}
```

约束：

- manifest 只保存 ref、version、digest、时间和角色，不保存 secret、环境变量值、数据库 URL、用户内容或 provider payload；
- `release_id` 不可变；任何 image/config/migration/capability 变化创建新 release；
- CI 发布的 `image_set_id` 只标识一组不可变镜像与供应链证据；materializer 以
  `image_set_id + database secret version + COS secret version + object config ref + object config fingerprint`
  派生不同的 `release_id`。因此 secret/config-only 轮换可以复用同一组已验证 image digest，但不能复用旧 release ID；
- 安装入口只接受受 closed pattern 校验的非敏感 version/ref 参数，禁止通过参数传 secret value、路径、URL 或任意 env；
- production 实际 fingerprint 与 manifest 不同则 startup/deployment Gate 失败；
- 当前生产与上一份可回滚 Accepted manifest 必须可查询；
- additive migration 前，当前 application generation 必须声明接受下一 catalog generation；materializer 在无 catalog 变化时使用 `[N, N+1]`，发生 catalog 变化时使用 `[N-1, N]`，同 schema 的后续 release 再向 `[N, N+1]` 滑动，窗口始终最多两代；
- manifest 与 artifact digest 在部署前后均校验，不能在服务器手改后补记；
- runtime catalog 的后续独立发布使用自己的 immutable catalog release，并记录与 application release 的 compatibility；
- emergency switch 不改写历史 manifest，使用单独有期限的操作记录。

## 10. 配置分级

| 类别 | 示例 | 权威/发布 | 是否 secret | 生效 |
|---|---|---|---|---|
| Public build config | app version、public API origin、微信公开 AppID、feature compile target | source + build manifest | 否 | 重新 build |
| Deploy config | port、service URL、pool size、timeouts 上限、profile、region code | versioned template + environment registry | 否，但受控 | restart/redeploy |
| Secret | DB password、session/signing key、provider/API secret、KMS material | secret store 的 ref/version | 是 | reload/restart/rotation |
| Runtime catalog | provider route、model/price/profile、Prompt/template/policy/resource、retention config | PostgreSQL system catalog，受控 publish | 内容可能受限但不是 deploy secret | 新 invocation/明确版本 |
| Emergency switch | feature/route/resource/admin/deletion freeze、maintenance | 受控 operations command + expiry | 否；操作受限 | 同步/短窗口 |

禁止：

- 用 env var 临时改变 ProductDate、Safety、删除、Schema、Prompt、model、price、retention 或数据库事实；
- 把 runtime catalog 塞进 Docker image 后让运营改 tag；
- 把 secret 当 deploy config 写进 `.env.production`、Compose、workflow、PR comment 或 log；
- 让客户端 build config 包含 server origin 内网地址、provider、Prompt、secret、admin route 或受限 capability。

## 11. 配置 Schema、指纹与启动

每个 runtime 使用 closed Zod `RuntimeConfigSchema`：

- 必填项、类型、范围、单位和 environment/profile allowlist 明确；
- 未知项目若属于项目命名空间则拒绝；平台标准变量不进入业务 config；
- URL 必须校验 scheme、host allowlist、TLS 和环境；
- duration/size/concurrency 使用显式单位，不接受模糊字符串；
- config 中不接受 secret value，只接受 `/run/secrets/...` 路径或 secret ref/version；
- production 禁止 debug、body log、source-map public upload、test endpoint、fixture、sandbox provider 和 broad egress；
- startup 读取 expected environment、release、profile、DB role、schema head、config/catalog/capability fingerprints；
- mismatch 返回稳定启动失败码，不监听业务端口、不消费 queue、不执行 migration；
- readiness 只在当前 guard/catalog/DB schema/必需依赖满足后通过；
- config dump/health 只返回字段名、是否存在、fingerprint 和稳定状态，不返回值。

Deploy config 变化创建受审 commit/manifest；secret rotation 创建新 secret version 并更新 manifest ref；runtime catalog 通过受控 Admin/operation publish。三者不能用一个“万能热更新”接口。

E-012 DEV materializer 必须允许操作者为每次安装选择 database secret version、COS secret version 与 object config ref；
这三个参数只包含版本引用，不含值，并与 object config fingerprint 一同进入不可变 release 身份。轮换不得要求修改常量、重跑 CI
或重新构建相同 image，且不得覆盖已有 version directory/config file。

DEV publication runtime evidence 使用 publication `image_set_id` 探测并证明 server image 内的 API deploy fingerprint 算法；安装器生成最终
`devr-*` release identity 后，必须用相同 closed runtime config 和最终 `release_id` 重新计算 manifest 中的 API deploy fingerprint。preflight
分别校验 publication evidence fingerprint 绑定 `image_set_id`、materialized manifest fingerprint 绑定最终 `release_id`，不得把前者原样复制到
后者，也不得用环境变量或手改 `release.env` 绕过 startup mismatch。

## 12. Secret 与凭据

### 12.1 注入

- 优先使用 GitHub Actions OIDC/云工作负载身份获取短期部署 credential，不在仓库保存长期云密钥；
- 若目标平台暂不支持 OIDC，使用 environment-protected、最小权限、短期且可轮换的部署凭据；该路径必须单独记录风险与 expiry；
- Compose service 通过显式 `secrets` 挂载只读文件；应用只从批准路径读取；
- Docker Compose 对 `file` 来源使用 bind mount，`uid/gid/mode` 重映射会被忽略，而 Compose `environment` secret source 不能注入 `read_only: true` 的 Linux 服务。E-012 Linux DEV 因此保持外部源文件 `root:root 0600`；root 部署控制器在 preflight 后把已验证值原子 materialize 到 `/srv/dailyenergy/runtime-secrets/<release_id>`。版本目录及其父目录为 `root:root 0700`，文件按获授权服务使用的 UID/GID 写为 `0400`，相同 release 重放必须逐文件验证内容、owner、mode、link 和闭合文件集，任何漂移 fail closed。Compose 只从 `release.env` 获得该非秘密目录路径并使用 `file` source，所有 Docker/curl 子进程环境均不得携带密钥值；所有 `deploy`、`rollback` 与 `recover-current` 的服务启动阶段必须强制重建容器，并核验实际 bind source 属于目标 `release_id`，不得复用仍指向旧 runtime-secret 目录的相同 service hash 容器；版本目录至少保留 current 与唯一 rollback target，且该 DEV 适配不替代 Production secret store；
- 环境变量只携带 secret file path/ref，不携带 secret 明文；
- 每个 environment/profile/用途独立 secret，不跨环境或跨 profile 复用；
- CI fork/untrusted PR 不获得 environment secret 或 OIDC deployment permission；
- shell trace、process list、Compose config、crash dump、diagnostic endpoint 和 artifact 均不得显示 secret。

Docker file secret 的 bind-mount 限制以 [Compose services 官方说明](https://docs.docker.com/reference/compose-file/services/#secrets) 为准。

GitHub 官方文档说明 OIDC 可用短期 token 代替长期云 secret，deployment environment 可在访问 secret 前应用审批与分支保护；实际云厂商确认后由 E-011/E-012 按其官方 action 实现：

- https://docs.github.com/en/actions/concepts/security/openid-connect
- https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments

### 12.2 轮换和吊销

- secret 记录 owner、purpose、environment、services、created/rotated/expires、version 和 emergency revoke 路径；
- session/signing/encryption key 采用明确 key version；轮换时只允许“新写新 key、受限读旧 key”的窗口；
- DB credential 先创建新 version/验证最小 role，再滚动 profile，最后吊销旧 version；
- provider credential 轮换期间 route 可降级 template，不能把 key 下发到其它 profile；
- suspected leak 立即吊销、轮换、复核使用范围并按 S-23 分类，不等待完整根因；
- secret 失效不能通过关闭 TLS、扩大权限、使用 owner 或在日志打印值进行排查。

## 13. 网络、TLS 与 egress

- 生产只有 TLS reverse proxy 对公网；HTTP 自动跳转不能暴露内部健康/管理端口；
- Admin 使用独立 hostname/audience，且在企业身份、MFA/RBAC/审计未实现前保持 production disabled；
- PostgreSQL、Redis 和 object management endpoint 只在 private network/security group 可达；
- profile egress deny-by-default：API、Interactive、Background、Restricted、Migration 各有独立 allowlist；
- Migration 只到 PostgreSQL；Restricted 只到被清理的 provider/object endpoints；Admin 不到 DB/Redis/provider；
- provider/微信/object DNS、certificate、region 和 endpoint 进入 manifest/fingerprint；未知或漂移 fail closed；
- webhook/callback 入站必须经过独立鉴权、重放保护和 request limit，不直达 Worker；
- recovery network 默认无互联网、无用户流量、无 ordinary provider/notification；
- container 不能访问 host Docker socket、cloud metadata 或其它 environment network；
- TLS certificate 自动更新机制、到期检查和失败路径由 E-012 实现，S-33 告警。

## 14. CI、runner 与 artifact 信任

### 14.1 Runner 分级

| Runner | 允许 | 禁止 |
|---|---|---|
| Untrusted PR | checkout、静态、合成测试、无密钥构建 | secret、OIDC deploy、生产网络、artifact promotion |
| Trusted main | 全量合成 Gate、签名构建、registry push | production deploy without environment approval |
| Deployment | 拉取已验证 digest、preflight、staging/prod release | build source、改 migration、打印 secret |
| Restricted recovery | backup restore、ledger replay、detector | public egress、普通用户流量、长期保留副本 |
| Miniapp | DevTools/automator + 测试身份 | 生产 AppSecret、真实用户账号 |
| Evaluation | approved provider + SyntheticSubjectRef | production DB/identity、普通 CI 自动触发 |

- workflow/action 必须 pin 到不可变 commit SHA；版本 tag 仅作可读说明；
- third-party action 必须经过权限、网络和供应链评审；
- workflow `permissions` 默认 read-only，job 按需最小提升；
- production environment 仅允许 main 上 Accepted release，禁止管理员 bypass/self-approval；
- deployment job 不接收任意 PR 参数作为 image、host、migration 或 command；
- self-hosted runner 若使用，必须 ephemeral/reimaged、无其它项目数据、无常驻生产 secret；
- workflow log/artifact 在上传前执行 secret/content/path scan。

### 14.2 Artifact 期限

| Artifact | 默认期限 | 内容边界 |
|---|---:|---|
| PR/main test report、coverage、trace | 14 天 | 只含合成数据、stable codes、source IDs |
| failed test diagnostic | 14 天 | 不含 request/response body、Prompt、secret |
| RC/Release Gate evidence | 365 天 | manifest、digest、无内容结果与审批 |
| SBOM/provenance/signature | 365 天且不短于 image 可部署期 | 无用户数据 |
| production image | 365 天；至少保留 current + previous 2 Accepted | 只读代码/运行时，无数据 |
| server source map | image 内或受限 artifact 最长 30 天 | 不公开上传，不含 secret |
| client source map | v1 不外传 | 如需服务商须先隐私/区域/TTL评审 |

GitHub artifact 可以为每个上传项配置 `retention-days` 并提供 digest 校验；项目必须显式设置期限，不能依赖组织默认值：

- https://docs.github.com/en/actions/tutorials/store-and-share-data

remote Turbo cache 在 v1 继续禁用。job-local cache 只含可重建依赖/构建结果，key 包含 lockfile、toolchain、source、config inputs；不得缓存 migration、restore、provider、真机、人工或外部副作用 PASS。

## 15. 数据库 migration 策略

### 15.1 唯一入口

- 只有受控一次性 Migration Job 使用 `migration owner`；
- API/Worker/Admin startup 不执行 migration、`db push`、DDL 或 grant；
- production 使用版本化 migration history、Prisma `migrate deploy` 和受审自定义 SQL；
- 已在任何共享/生产环境应用的 migration 文件/checksum 不可修改，只能追加；
- Migration Job 先获取项目 advisory lock，已有 migration/backfill/restore 时拒绝并退出；
- 设置有限 lock/statement timeout；超时 fail，不用无限等待阻塞业务；
- 每次应用后验证 migration head、Prisma drift、SQL-001～020、constraint/index/grant/role；
- DDL 输出、错误与 artifact 不包含行内容、connection string 或 secret。

### 15.2 Expand → backfill → contract

1. **Expand**：新增 nullable/有 default-safe 的列、表、索引或兼容 event/Schema；旧代码仍工作；
2. **Dual compatibility**：新代码能读取 N/N-1 形态，写入唯一权威路径；禁止无期限双写；
3. **Backfill**：长任务由专用一次性/resumable job 分批、checkpoint、限速执行，不占 migration transaction；
4. **Verify**：零缺口、constraint known-fail、grants、source fingerprint、删除/TTL 与性能证明；
5. **Contract**：至少跨一个 Accepted release/观察窗口后删除旧列/enum/path；单独高风险 PR 与 restore plan；
6. **Close**：更新 min/max compatible schema、release manifest 和 coverage registry。

禁止：

- 一次 migration 同时 rename/drop 且要求旧代码继续运行；
- 在 DDL transaction 内回填大量用户数据或调用外部服务；
- 用 application dual-write 代替 PostgreSQL transaction/outbox；
- 将 enum 删除、column type narrowing、constraint validate 或 ciphertext 重加密当普通 patch；
- 通过关闭 owner/Safety/delete/grant Gate让 migration 通过。

### 15.3 Backfill

- task 只使用 opaque range/checkpoint，不把行值写日志/queue；
- 每批短事务，支持暂停、继续、重复执行和 version guard；
- 使用当前 deletion/Safety/source guard，不能处理已删/无效 source；
- backfill 产生的业务副作用必须走原 command/event/idempotency，不直接伪造 projection；
- 完成后校验 count bucket、source IDs 和 invariants，不导出用户清单；
- contract migration 前 backfill 必须 100% 完成且异常为 0，或保持 Blocked。

## 16. 发布准备 Gate

生产部署前必须全部满足：

1. PR 已合并，目标 commit 在 main；
2. S-31 对应 required lanes 全部 PASS，无 critical quarantine/waiver；
3. image digest、SBOM、provenance、signature 和 scan 可验证；
4. Release Manifest 完整且 immutable；
5. staging 使用同一 digest 完成 clean/upgrade/migration/rollback/restore 与 smoke；
6. production config Schema、capability、network、secret refs 和 expiry 通过；
7. migration compatibility 与 code rollback matrix 明确；
8. backup/PITR 当前可用，最近完整性检查与恢复演练未过期；
9. current 与 rollback release image/manifest 可拉取；
10. route/Safety/resource/provider profiles 当前合格；
11. deletion/TTL/backup deadlines 无逾期阻断；
12. maintenance/kill switch、批准角色、观察和停止条件已确定；
13. 小程序版本/审核状态与 server compatibility 明确；
14. 未决 Production Gate（云厂商、主体、区域、跨境、SSO、受托方）全部关闭，否则不得发布真实用户环境。

任何 hard Gate 失败都停止发布，不通过改 workflow conclusion、跳过 step、重跑取最好结果或管理员 bypass 继续。

## 17. 发布流程

### 17.1 Staging

1. 拉取并验证 immutable image digest；
2. 校验 config/secret/capability/environment fingerprint；
3. 从 clean DB 与上一 Accepted schema 各执行 migration；
4. 启动 candidate profile 的 startup/readiness，不接真实流量；
5. 执行 API/Admin/Miniapp/queue/AI deterministic/resilience smoke；
6. 执行 code rollback、Redis loss/rebuild 与 synthetic restore；
7. 生成 RC evidence 和 production Release Manifest；
8. staging 失败不得重新 build 同一 release id，修复需新 commit/digest。

### 17.2 Production 顺序

1. 宣布 deployment，冻结同一环境的其它 migration/config/secret/release；
2. 验证当前 release、backup、rollback target 和 runtime catalog fingerprint；
3. 必要时启用有期限 maintenance/特定入口 freeze，不关闭 Safety/删除；
4. 执行 compatible expand migration 和 drift/grant Gate；
5. 启动新 Worker consumer，证明接受旧 N-1 与新 N event/job envelope；
6. Interactive 先 ready，Background 后 ready；Restricted 只在独立批准后启用；
7. 启动新 API，先内部 synthetic smoke，再切换 reverse proxy；
8. 启动/切换 Admin；企业身份/RBAC 未完成则保持 disabled；
9. API 成为 N producer 后，保留 N/N-1 consumer compatibility 至观察完成；
10. 恢复 relay/scheduler/queue，不清空 Redis、不换 business/event id；
11. 运行 post-deploy owner/Safety/delete/command/publish/queue smoke；
12. 记录 deployed manifest、开始/完成时间、批准、outcome 和 observation；
13. 达到观察 Gate 后才停旧容器并结束 maintenance；
14. contract migration 永远不是同一次普通发布的最后一步，需后续独立 release。

### 17.3 小程序与 Server 兼容

- API/OpenAPI/client 使用版本化兼容窗口；服务端至少支持当前生产小程序与上一可用版本；
- server 不依赖客户端立即更新来修复 Safety、owner、删除或 ProductDate；
- 小程序审核/灰度晚于 server 时，新 API 必须兼容旧 client；
- 移除字段/path 前必须证明旧 client 活跃窗口结束并完成 contract release；
- 客户端 config 不能强制旧版本继续访问不兼容 path；必要时返回稳定 upgrade/maintenance view；
- 小程序发布和 server release 是两个独立状态，Release Manifest 记录 compatibility，不伪装原子发布。

## 18. Queue、Worker 与发布兼容

- job/event envelope 显式 `type/version/event_id/aggregate_ref/revision/guard_epoch`；
- 新 consumer 必须先于新 producer 部署，并至少读取 N 与 N-1；
- unknown future version fail closed，写稳定 contract failure，不 blind retry；
- 发布前暂停/恢复的是 relay/scheduler/consumer intake，不删除 PostgreSQL outbox、due rows、DataTask 或 Redis queue；
- in-flight worker 在 graceful shutdown 窗口完成或释放 claim；被终止后按原 event/job/task ref 重试；
- old worker 不能在新 guard/config/catalog 下发布，handler 必须运行时重查；
- Interactive/Background/Restricted 独立 drain，不能为部署 Restricted 耗尽 Daily；
- completed/failed BullMQ metadata 不是 release evidence；权威 outcome 在 PostgreSQL；
- Redis 丢失或部署时替换，按 outbox/due/task 重新投递，不恢复 queue dump；
- rollback 后旧 consumer 只有在 schema/event 仍 compatible 时启动，否则保持停止并 roll forward。

## 19. Health、readiness、维护与切流

### 19.1 Probe

- `startup`：config/secret ref、release/profile/capability、DB role、schema head、contract/catalog fingerprint；
- `liveness`：进程 event loop 与内部自检；不能因 Redis/provider 短时故障无限重启；
- `readiness`：是否可安全接收该 profile 的新工作；
- `dependency`：PG/Redis/provider/object 状态以封闭枚举和 stable reason code 暴露，不返回 URL/secret/model/internal row；
- Migration/Restricted/Evaluation 不暴露 public health endpoint，使用 one-shot outcome evidence；
- probe 不查询/创建用户事实，不调用真实 provider，不输出 config value。

### 19.2 Readiness 语义

- API 无法确认 PostgreSQL guard/owner 时 not ready；Redis 不可用可对允许路径降级，但不能返回旧授权 cache；
- Interactive 无 DB/queue 或 template 资格时不消费；breaker/budget 不可读时允许受控 template 路径；
- Background 失败不应让 API 自动不 ready，但 notification/weekly/relay lag 进入 S-33；
- Restricted 不 ready 时删除 guard 仍生效，任务保持原状态；
- Admin 身份/RBAC/audit 不合格时 Admin not ready，不影响用户自助权利；
- maintenance view 不得替代 Safety fixed response 或声称删除已经完成。

### 19.3 Canary/切流

单 host v1 不声称真正多节点 canary。最低可接受方式：

- candidate 容器先在 internal network 启动，只跑合成 smoke；
- reverse proxy 以原子配置切换 API/Admin upstream；
- Worker candidate 先验证 envelope/profile，再逐 profile 接收；
- production 不创建“测试真实用户”或按高风险/个人画像分流；
- 任何真实用户灰度需新的实验/隐私评审，不属于 S-32；
- 切流失败回到上一 upstream，前提是数据库兼容。

## 20. 回滚策略

### 20.1 唯一回滚目标

回滚目标必须是上一份已在 production 成功运行、仍受安全支持且数据库兼容的 Accepted Release Manifest。禁止：

- 按 tag 猜测；
- 服务器现场 checkout/patch；
- 回到存在已知 Safety、删除、权限或 secret 缺陷的版本；
- 只回滚一个 Worker 而不验证 event/schema/capability compatibility；
- 用数据库 snapshot 覆盖当前生产作为普通代码回滚。

### 20.2 回滚矩阵

| 变更 | 代码回滚 | 数据动作 |
|---|---|---|
| 无 DB/config contract 变化 | 允许 | 切回旧 digest，验证 startup/smoke |
| additive expand migration | 若旧代码兼容新增结构则允许 | 保留 schema，不执行 down |
| deploy config 变化 | 允许回到旧 manifest/config fingerprint | secret version 需单独判断 |
| runtime catalog publish | 使用上一 Accepted catalog release | 已发布历史结果不重生成 |
| secret rotation | 通常不回到已吊销 secret | 修复 consumer，继续使用新 secret |
| event/job N 且旧 consumer 支持 | 允许 | 原 id 重投，禁止清 queue |
| contract/drop/type narrowing 已执行 | 默认不允许 | roll forward；必要时全环境隔离恢复 |
| 数据写入逻辑损坏但 facts 可识别 | 停写/contain，受审修复 | 不用未经验证脚本直接改生产 |
| 数据/删除/backup corruption | 普通代码回滚不足 | S-23 incident + 隔离 restore |
| secret/provider/profile 泄露 | 先吊销/禁 route | 回滚不能替代轮换和影响调查 |

### 20.3 硬触发

以下任一出现立即停止放量并 containment/回滚或 roll forward：

- Safety ordinary path、删除 guard、owner/audience 或受限权限失效；
- duplicate Daily publish、CommandReceipt/transaction/outbox 不变量破坏；
- migration drift、grant 丢失、schema incompatibility；
- wrong environment/profile/DB role/config/secret/catalog fingerprint；
- image digest/provenance/signature mismatch；
- secret、Prompt、用户内容进入 image/log/artifact；
- provider observed model/data profile/region 不合格；
- restore detector 发现已删或过期数据；
- 新版本无法在 controlled template/外部依赖故障下保持合同语义；
- S-33 已接受的 release threshold 触发。

硬安全/隐私触发不依赖统计阈值；单个确认案例也必须停止。

### 20.4 执行

1. 冻结发布与相关入口，保持 Safety/删除 guard；
2. 记录当前/目标 manifest、原因码、批准与 compatibility；
3. 停止新 producer/consumer intake，允许或回收 in-flight claim；
4. 切回旧 image/config/catalog 的允许组合；
5. 不执行未经演练的 down migration；
6. 重建 readiness、owner/Safety/delete、command/publish、queue smoke；
7. 恢复流量并进入 S-23 规定观察窗口；
8. 任何数据完整性未知保持隔离，不以页面恢复视为完成。

发布控制器必须在第一次可能改变运行态的阶段前生成唯一 `operation_id`、持久化 pending operation，并在每个阶段开始/通过时原子更新。任一阶段失败或进程中断后：

- release/install/deploy/rollback/recover-current 共享 Linux 内核 advisory lock；锁元数据文件可以持久存在，但不得作为占用哨兵，进程异常退出或主机重启后必须由内核释放实际所有权；
- Accepted application release 与唯一 rollback target 不被候选覆盖；
- 普通 deploy/rollback 必须以 `RELEASE_RECOVERY_REQUIRED` fail closed，不能把同一 Accepted release 当作无操作 replay；
- `recover-current` 必须重新执行完整阶段，把当前 Accepted application/config/secret 收敛回来；
- migration 阶段把 role/credential prepare、Prisma migrate、synthetic seed 与 drift verify 作为同一阶段内的独立受控命令；只有 Prisma migrate 自身完成并核验 migration history 后才记录 `migration_applied=true`，只有 seed 与 drift verify 也通过后才记录 `migration_verified=true`；
- prepare 或 Prisma migrate 自身失败且 `migration_applied=false` 时，恢复先用只读 drift probe 核验 state 已记录的 effective catalog；若 host checkpoint 恰好在 migration 生效后、`migration_applied` 落盘前丢失，旧 catalog probe 会失败且候选 probe 必须通过，恢复才能选择候选。Prisma migrate 已核验生效但 seed/drift 等后续命令失败时，恢复必须使用候选 immutable migration image/catalog 收敛；两个 probe 都失败时保持 dirty operation 并 fail closed；
- state 分别记录 Accepted application ref 与 effective catalog ref。代码回滚不声称执行 down migration，也不能把应用切到不接受当前
  effective catalog 的目标；
- Accepted state/effective catalog 写入后，完整 operation phase 记录必须能够按原 `operation_id` 确定性重建同一 PASS receipt；receipt 路径必须绑定该 ID，使 deploy N+1 → rollback N → 再 deploy N+1 等合法重复 release 不复用旧文件。只有 receipt 已写入且内容一致后才能清除 dirty operation，state→receipt 间进程退出不得永久丢失证据；
- recovery 完成完整 health、COS、Safety、owner、deletion smoke 后才清除 dirty operation。首次发布尚无 Accepted release 时，只有同一
  manifest 可完整重试，不能用其它候选跳过 dirty state。

## 21. PostgreSQL 备份

### 21.1 合同

- PostgreSQL 使用加密 base backup + 连续 WAL archive/PITR，不能只依赖 nightly `pg_dump`；
- 目标生产 RPO ≤15 分钟；archive gap 超过目标即 Production/Release Gate 失败；
- 最长保留 35 个自然日，backup、WAL、snapshot 和其密钥销毁都服从该上限；
- backup 存在与 production database 不同的故障域和独立最小权限账户；
- backup encryption key 与 database/application key 分离，application runtime 无权读取 backup；
- 每个 backup 有 manifest、checksum、source cluster/version、start/end、WAL range、key version、expiry 和 integrity result；
- backup job 不输出行、schema secret、connection string 或用户内容；
- 逻辑 dump 可作 migration/小范围辅助证据，不替代 PITR；
- 备份成功通知不等于可恢复，必须有完整性校验和 test restore。

PostgreSQL 官方文档说明 PITR 需要连续 WAL 序列；`pg_verifybackup` 可以验证 base backup manifest，但仍不能替代实际 test restore：

- https://www.postgresql.org/docs/current/continuous-archiving.html
- https://www.postgresql.org/docs/current/app-pgverifybackup.html

### 21.2 验证与演练

- 每个 base backup/WAL chain 做自动完整性与 expiry 检查；
- `STAGING` 每个 RC 使用 production-shaped synthetic backup 完成恢复；
- 真实用户环境启用后，至少每 30 天在 `RECOVERY` 隔离环境恢复最近可用 backup/PITR point；
- migration/backup 架构、key、region 或 deletion ledger 重大变化后追加演练；
- recovery 副本无 public/provider/notification egress，Restricted 审批后访问，验证完成 24h 内销毁；
- 演练记录 RPO/RTO、版本、manifest、ledger checkpoint、detector、结果和稳定失败码，不保存内容截图/row dump；
- 连续两次演练失败或 35 天过期 backup 可用，按 S-23 升级并阻塞发布。

## 22. Redis、对象与外部系统恢复

### 22.1 Redis/BullMQ

- Redis/BullMQ 不做业务 backup、PITR 或 snapshot restore；
- Redis 整体丢失后使用空实例，从 PostgreSQL outbox、due rows、active DataTask 和当前 catalog 重建；
- session acceleration、cache、breaker、semaphore、rate/cost counter 均按合同重建或 fail closed；
- 不能从 Redis AOF/RDB、completed jobs 或 dashboard 导出恢复用户事实；
- 重建前验证 guard/epoch/source fingerprint，旧 cache/job 不复活；
- Redis replacement 是 S-31/S32 必测 release/restore 场景。

### 22.2 Object/CDN

- share/export object 是短期派生，不进入普通长期 backup；
- 用户可见 URL 先失效，对象/CDN 按 PDM 期限清理；
- 需要持久的系统资产以 source-controlled/versioned asset 或受控 object manifest 重建；
- object store versioning/lifecycle 不能使已删对象超过 35 天或对应更短 PDM TTL；
- restore 不自动重新发布 share/export URL；
- object inventory 只保留 opaque key/version/expiry，不进入普通日志或 artifact。

### 22.3 Provider/微信

- provider raw body 本方 T0，不备份；
- attempt/outcome/config 只按 PDM 期限从 PostgreSQL 恢复；
- restore 后旧 provider callback、notification claim、微信 session/token 不能直接生效；
- session/signing/provider credential 按事件/恢复计划轮换或重验证；
- external deletion/expiry 仍以当前 DataTask/ledger 为准，不能因恢复重置期限；
- provider route 必须重新验证 observed model、training、retention、region 和 subprocessor 后 ACTIVE。

## 23. 隔离恢复流程

任何生产恢复均使用完整环境流程：

1. 声明 recovery/incident，选择 backup、PITR point 与目标 release；
2. 创建无 public egress 的 `RECOVERY` network/database，使用临时 Restricted credential；
3. 验证 backup manifest、WAL chain、key version、PostgreSQL major 和 source cluster；
4. 恢复到隔离 PG，不启动 API/Admin/Worker，不连接生产 Redis；
5. 应用目标 Release Manifest 要求的 versioned migration/grants；
6. 从独立当前 deletion/restore-deny authority 获取截至切换点的 ledger checkpoint；
7. 重放 ACCOUNT/DAY/MATTER/RELATIONSHIP guards、DeletionReceipt/DayErasureGuard、provider/object expiry；
8. 执行 TTL、source invalidation、cache/object/provider deny 计划；
9. 运行 deleted-data detector、owner/Safety/delete、SQL/TX、constraint/grant、outbox/inbox 和 PDM Gate；
10. 将旧 session/token/queue/cache/claim 视为不可信；建立空 Redis 并按当前事实重建；
11. 用合成探针启动匹配 release 的 profile，ordinary external egress 仍关闭；
12. Incident Commander 与独立 Privacy/Security/Safety owner 双人确认；
13. 只有所有 Gate PASS 才允许成为 candidate production；否则继续隔离或选择更早 backup；
14. 切换后轮换必要 credential，验证迟到 callback/job 不复活；
15. 按 S-23 观察窗口运行，复发回到 containment；
16. 原/临时 recovery 副本按批准保留或 24h 内销毁，记录无内容完成证明。

关键规则：

- restore-deny/deletion ledger 不能只存在于可能被恢复到过去的同一 backup 内；
- 若无法获得不早于恢复点的当前 ledger/checkpoint，恢复不得对外；
- 禁止“先恢复生产，再异步补删”；
- detector 不只查主表，还覆盖对象、projection、runtime candidate、queue refs、export/share、provider expiry；
- Redis、cache、session、notification 和 provider callback 不从旧环境复制；
- 恢复不改变历史 result/model/Prompt/algorithm version，不重新生成已发布内容。

## 24. 灾难恢复目标与已知限制

| 项目 | Phase 1/Beta 目标 | 限制 |
|---|---|---|
| PostgreSQL RPO | ≤15 分钟 | 依赖连续 WAL；gap 时阻断发布 |
| Application host RTO | ≤2 小时重建到 readiness | 单 host 非 HA，可能用户可见维护 |
| 全数据库恢复 RTO | ≤4 小时工程目标 | 数据量和 detector 增长后需复测 |
| Redis RPO | 不适用 | 不恢复事实；从 PG 重建 |
| Object derivative | 按 PDM 重新生成或保持删除 | share/export 不保证恢复 |
| Region disaster | v1 无自动跨区 failover | 需要新 ADR 和隐私/跨境评审 |

- 目标只在 A-008/RC 演练通过后可声明为内部 readiness；
- 单区域失败可能超过 RTO；MVP 不宣传高可用；
- 恢复时间不能通过跳过删除 ledger、Safety/owner/grant 或 detector 缩短；
- 规模/恢复实际超过目标时，在 S-33/A-008 记录并触发容量/架构评审。

## 25. Emergency switch 与配置回滚

| Switch | 允许作用 | 禁止 |
|---|---|---|
| Maintenance | 暂停普通写/生成或整个普通入口 | 替换 Safety、自称删除完成 |
| Provider route disable | 跳过受影响 provider，走受控 template | 改写历史结果、未评审临时 provider |
| Feature entry disable | 关闭特定入口/写命令 | 解除 owner/consent/delete |
| Admin freeze | 关闭后台/session | 阻断用户自助必要权利 |
| Resource disable | 下线错误 Safety 资源并使用已审核 fallback | 客服临时自由文本 |
| Deletion/restore freeze | 阻止不可信清理/恢复步骤继续 | 解除已生效 guard |
| Queue intake pause | 暂停新消费、保留权威 outbox/task | 清空 queue/换 business id |

- switch 必须有 type/version、environment、scope、reason code、actor/approver role、created/expires 和 outcome；
- 默认自动到期；延长需新批准；
- Safety/删除/owner/retention 不能被普通 switch 关闭；
- switch 状态进入 startup/readiness/Release observation，但不放 secret/用户 ref；
- 恢复前运行适用 Gate，不以“开关已关”证明根因解决；
- emergency 操作不修改历史 Release Manifest 或 runtime catalog。

## 26. Production Gates 与未决选择

以下在真实用户 Production 前必须由 E-011/E-012/A-008 关闭：

| Gate | 当前状态 | 解除条件 |
|---|---|---|
| 云厂商、账户主体、region | BLOCKED | 主体、区域、网络、账单、责任和退出方案确定 |
| PostgreSQL/Redis/object 服务 | BLOCKED | 版本、digest/服务级别、backup、PITR、TTL、加密、访问和演练通过 |
| 域名、TLS、备案/小程序业务域名 | BLOCKED | 合法主体、证书、续期、微信 allowlist 和故障路径 |
| Production WeChat identity | BLOCKED | AppID/secret、回调、轮换、测试/生产隔离 |
| AI provider/subprocessor | BLOCKED | S-12/S-21 data profile、region/training/retention/删除/合同合格 |
| Admin enterprise identity | BLOCKED | SSO/MFA/RBAC、离职撤权、审计；否则生产 Admin disabled |
| CI runner/registry/artifact | BLOCKED | 区域、访问、retention、OIDC、action pin、scan 和退出 |
| Backup key/restore ledger | BLOCKED | 独立 authority、35 天 expiry、隔离恢复和 deleted-data detector |
| On-call/status/legal contacts | BLOCKED | 真实角色、渠道、演练和适用法律路径；不得预填个人信息 |
| Cross-border state | UNVERIFIED | 所有云/provider/support/log/CI 路径确认并完成适用评审 |

文档完成不解除这些 Gate，也不授权创建账号或购买资源。

## 27. E-009～E-013 实施交接

| 任务 | S-32 直接输入 |
|---|---|
| E-003 | API startup/liveness/readiness、config Schema、profile fingerprint、maintenance response |
| E-004 | public build config、环境 API origin、DevTools runner、server compatibility |
| E-005 | Admin 独立 origin/session、production-disabled Gate、bundle/secret scan |
| E-006 | migration owner、expand/backfill/contract、PITR、grants、restore ledger/detector hook |
| E-007 | Redis empty rebuild、queue version、drain、graceful shutdown、profile allowlist |
| E-009 | common/local/staging-like Compose、production overlay contract、stub/fault/recovery profile |
| E-010 | migration/release/rollback/backup/restore 场景注册与 fault hook |
| E-011 | build-once、digest、SBOM/provenance、OIDC/environments、artifact TTL、platform required Gate；能力不可用时仅允许 testing 22.2 的有期限补偿控制 |
| E-012 | 单 host Compose、reverse proxy/TLS、external PG/Redis/object、release/rollback runbook |
| E-013 | S-33 稳定 metrics/alerts、backup/WAL/secret/cert/deploy signals |
| E-014 | clean environment、CI、staging deploy、rollback、PITR/restore、secret/content Gate 证明 |

E-012 不是“SSH 上去运行几条命令”即可完成。必须交付 idempotent deployment entry、Release Manifest、锁、preflight、审批、proof、rollback target 和恢复演练。

## 28. 固定验证场景（48）

### 28.1 环境、配置与 secret（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S32-DEPLOY-001 | STAGING 配置指向 PRODUCTION DB | environment fingerprint 失败，进程不监听/消费 |
| S32-DEPLOY-002 | 未知项目环境变量注入 | closed config Gate 失败 |
| S32-DEPLOY-003 | API 获得 migration owner secret | capability/secret manifest Gate 失败 |
| S32-DEPLOY-004 | Interactive 获得 Restricted provider cleanup key | service secret allowlist 失败 |
| S32-DEPLOY-005 | secret 明文出现在 Compose/config/log | secret scan 失败并按事件流程隔离 |
| S32-DEPLOY-006 | production debug/body log=true | startup fail closed |
| S32-DEPLOY-007 | secret version 已吊销但 manifest 仍引用 | deployment/startup 失败，不回退旧 secret |
| S32-DEPLOY-008 | untrusted PR 请求 OIDC production token | permission/environment protection 拒绝 |

### 28.2 构建、镜像与供应链（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S32-DEPLOY-009 | production host 现场 build | Release Gate 失败 |
| S32-DEPLOY-010 | tag 相同但 image digest 漂移 | manifest/digest 验证失败 |
| S32-DEPLOY-011 | base image 使用 `latest` | static/supply-chain Gate 失败 |
| S32-DEPLOY-012 | image layer 含 `.env`/test fixture/Prompt | image content Gate 失败 |
| S32-DEPLOY-013 | SBOM/provenance 缺失或不匹配 | 不得晋级 staging/production |
| S32-DEPLOY-014 | staging PASS 后 production 重新 build | 新 digest 必须重新完整 Gate |
| S32-DEPLOY-015 | workflow action 只 pin mutable tag | CI policy 失败 |
| S32-DEPLOY-016 | artifact 下载 digest mismatch | 停止部署，artifact 隔离 |

### 28.3 Migration 与兼容（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S32-DEPLOY-017 | API startup 自动运行 migration | startup/static Gate 失败 |
| S32-DEPLOY-018 | 修改已应用 migration checksum | migration history Gate 失败 |
| S32-DEPLOY-019 | rename/drop 与新代码同一 release | compatibility Gate 失败，拆为 expand/contract |
| S32-DEPLOY-020 | backfill 中处理已删 scope | guard/source 检查拒绝 |
| S32-DEPLOY-021 | Migration Job 使用 api-app role | DB role/grant Gate 失败 |
| S32-DEPLOY-022 | migration lock/statement timeout | 原 transaction 失败并停止，不无限等待 |
| S32-DEPLOY-023 | expand 后回滚旧代码仍兼容 | 保留新 schema，旧 release smoke 通过 |
| S32-DEPLOY-024 | contract drop 后请求代码回滚 | 拒绝；roll forward 或隔离 restore |

### 28.4 发布、Worker 与回滚（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S32-DEPLOY-025 | N producer 先于支持 N 的 consumer | deployment order Gate 失败 |
| S32-DEPLOY-026 | deploy 时清空 Redis queue | 禁止；保留 outbox/task 并按原 id 恢复 |
| S32-DEPLOY-027 | Worker commit 后 shutdown/ACK 前终止 | 原 job 重投，Inbox 保证单效果 |
| S32-DEPLOY-028 | old worker 收到新 guard epoch job | 运行时拒绝，不因旧 image 发布 |
| S32-DEPLOY-029 | Admin SSO/RBAC 未完成却启用生产 | readiness/Production Gate 失败 |
| S32-DEPLOY-030 | 单 host candidate internal smoke PASS 后切流 | 记录同一 digest/fingerprint，才能切换 |
| S32-DEPLOY-031 | Safety/owner/delete smoke 失败但普通页面成功 | 立即 containment，发布失败 |
| S32-DEPLOY-032 | rollback target 有已知 Safety 缺陷 | 不得回滚；选择安全 roll-forward/其它 Accepted target |

### 28.5 Backup、PITR 与恢复（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S32-DEPLOY-033 | WAL archive gap 超过 15 分钟目标 | backup/release Gate 失败并升级 |
| S32-DEPLOY-034 | 36 天 backup 仍可恢复 | retention Gate 失败，阻止使用并清理 |
| S32-DEPLOY-035 | `pg_verifybackup` PASS 但未做 test restore | readiness 仍不完整 |
| S32-DEPLOY-036 | 从删除前 PITR point 恢复 | 保持隔离，重放当前 ledger/restore deny 后 detector |
| S32-DEPLOY-037 | 当前 deletion ledger 不可获得 | 恢复不得对外 |
| S32-DEPLOY-038 | 恢复旧 Redis snapshot | 拒绝；空 Redis 从 PG 重建 |
| S32-DEPLOY-039 | restore 后旧 provider callback/notification 到达 | guard/claim/version 拒绝，不复活 |
| S32-DEPLOY-040 | RECOVERY 环境验证完成 | 24h 内销毁副本并记录无内容证明 |

### 28.6 Artifact、网络与运营 Gate（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S32-DEPLOY-041 | CI artifact 含用户文本/Prompt/secret | 上传/晋级失败，隔离并按事件处理 |
| S32-DEPLOY-042 | 普通 test artifact 超过 14 天 | lifecycle 删除 |
| S32-DEPLOY-043 | 未评审启用第三方 remote cache | policy Gate 失败 |
| S32-DEPLOY-044 | Restricted Worker 可访问任意互联网 | egress policy Gate 失败 |
| S32-DEPLOY-045 | container 可访问 Docker socket/cloud metadata | runtime security Gate 失败 |
| S32-DEPLOY-046 | emergency switch 无 expiry/approver | 操作拒绝 |
| S32-DEPLOY-047 | 云/主体/区域/跨境仍 UNVERIFIED | production release BLOCKED |
| S32-DEPLOY-048 | RC 完整发布/回滚/PITR 恢复 | manifest、digest、migration、ledger、detector、Gate 证据全部可追踪 |

## 29. 验收标准

- 环境枚举、数据/身份/网络/外部调用边界完整；
- Docker Compose 单 host MVP 拓扑、外部有状态服务和非 HA 限制明确；
- 每个 runtime profile 的 image、DB role、queue、egress、secret 和 startup fingerprint 可验证；
- build-once/digest promotion、Release Manifest、SBOM/provenance 和 supply-chain Gate 完整；
- public/deploy/secret/runtime catalog/emergency config 分级唯一；
- OIDC/短期部署身份、service secret mount、轮换和吊销规则明确；
- migration owner、expand/backfill/contract、lock、drift、compatibility 和 rollback matrix 可实施；
- consumer-before-producer、queue/in-flight、graceful shutdown、小程序/server compatibility 和切流完整；
- code rollback、roll forward、数据事件/restore 的边界无歧义；
- PostgreSQL base backup + WAL/PITR、35 天、RPO/RTO 工程目标和 test restore 完整；
- Redis 明确不恢复事实；对象/provider/session/notification 的恢复边界明确；
- restore 必须隔离、重放当前 deletion/restore deny、运行 detector 后才开放；
- artifact/source map/cache/image/evidence 期限和敏感内容 Gate 明确；
- Production 未决 Gate 不被文档伪装为已完成；
- 48 个 `S32-DEPLOY-*` 场景完整且唯一；
- E-003～E-014、S-33～S-35 的交接清楚；
- PR 只包含本文、S-31 接受记录和项目控制 Markdown，不创建配置、workflow、容器、migration、secret、云资源或生产变更；
- 本文已随 PR #37 获用户确认并记录为 Accepted；后续实现不得静默降低环境隔离、发布指纹、迁移兼容、回滚、备份恢复、删除重放或 48 个场景。

## 30. 明确禁止

- production host 现场 checkout、install、build 或修改容器文件；
- image、action、base image、PostgreSQL 或 Redis 使用 `latest`/浮动 tag；
- 在应用启动执行 migration、生产 `prisma db push` 或编辑已应用 migration；
- 用自动 down migration 覆盖当前生产事实；
- 在一个 release 同时做破坏性 contract migration 和依赖它的新代码；
- 把 `.env.production`、secret、证书、key、数据库 URL 或 token 提交/上传；
- 用通用 production credential 部署所有 profile；
- production secret 进入 CI/LOCAL/DEV/STAGING/EVALUATION/MINIAPP_RUNNER；
- 将 route、Prompt、Safety、删除、retention 或 model 作为临时 env config；
- 清空 queue、换 event/business id 或恢复 Redis snapshot 来“修复”发布；
- 从 backup 直接恢复到可公开访问生产；
- 在 deletion ledger/restore deny 不可用时开放恢复环境；
- 先上线已删数据再异步补删；
- 用 `pg_dump`、backup success 或 checksum PASS 代替 PITR/test restore；
- 让 backup、WAL、snapshot、object version 或 key 超过 35 天；
- 普通 CI artifact、source map、cache、image 或日志包含真实内容、Prompt、provider body、Safety 原文或 secret；
- 未评审启用 third-party remote cache、外部 source-map/报告平台或 broad egress；
- 在单 host Compose 上声称 HA、零停机、多可用区或 24×7 人工响应；
- 在 S-32 PR 中创建/修改 Docker、workflow、migration、云资源、账号、域名、证书、secret 或生产系统。

## 31. 审核记录

- 状态：Accepted；
- 接受日期：2026-07-26；
- 2026-08-11 修订：用户明确接受 TLS proxy 在构建阶段移除上游 Caddy 对 8443/8444 不需要的
  `cap_net_bind_service` 文件能力，并要求 publication 在非 root、只读根文件系统、`cap_drop: ALL` 与
  `no-new-privileges` 的真实 hardened 边界下执行 Caddy；用户同时批准合并 PR #130；
- 2026-08-11 修订：用户明确接受真实 DEV 证据驱动的 release-scoped file secret 容器强制
  收敛合同；所有服务 `up` 阶段必须显式强制重建并核验目标 release bind，并批准合并 PR #128；
- 2026-08-11 修订：用户明确接受 API deploy fingerprint 必须从 publication `image_set_id` 重新绑定到最终
  materialized `release_id`；首次 synthetic DEV 在 migration 后遇到必须更换 artifact 的不可恢复故障时，必须保持 dirty operation，
  只有项目所有者另行明确批准完整 DEV 环境重建后才可按 ADR-0007 从空状态重新部署；用户同时批准合并 PR #129，
  该合并批准不包含删除 PostgreSQL/Redis volume；
- 2026-08-10 修订：用户明确接受 E-012 的 release-scoped file secret materialization 与
  `SUPERSEDED_BEFORE_MIGRATION` 首次失败候选替换合同，并批准合并 PR #127；
- 2026-08-04 修订：用户明确接受测试策略 22.2 的私有 GitHub Free 临时补偿控制；
  E-014/RC 前必须恢复 platform-enforced required checks；
- 内容 PR：[PR #37](https://github.com/WeiHan1996/DailyEnergy/pull/37)；
- 基线：`main`（S-31 测试策略已随 PR #36 合并并获用户确认）；
- 已确认范围：环境、单 host Compose、profile 能力、Release Manifest、配置/secret、migration、发布/回滚、backup/PITR、隔离恢复、artifact/供应链与 48 个场景；
- 下一任务：S-33 可观测性和成本监控；部署流水线、环境和生产资源仍须等待 E-009～E-013。

# ADR-0009：低配置 DEV_LITE 同机例外

- **状态**：Accepted
- **日期**：2026-09-03
- **接受日期**：2026-09-03
- **所属任务**：E-017 — 2C2G DEV_LITE 可回滚部署
- **决策范围**：阿里云低配置开发主机、阶段化 Compose、synthetic object、发布与退出边界
- **决策所有者**：DailyEnergy 项目
- **取代文档**：[ADR-0007](./ADR-0007-development-colocation-exception.md)
- **相关文档**：[部署规范](../technical/deployment.md)、[DEV Runbook](../operations/development-deployment-runbook.md)、[测试策略](../technical/testing.md)、[当前任务](../../tasks/current.md)

## 1. 背景

腾讯云 4C8G 临时 DEV 即将到期。项目所有者基于当前预算购买了上海地域 2C2G、40 GiB、3 Mbps 的阿里云 ECS，并明确接受它只作为 synthetic `DEV_LITE`，不处理真实用户数据、不取得生产资格，Production/RC 保持 `NO_GO`。

新主机实际只报告约 1.6 GiB RAM，无法常驻 ADR-0007 的九服务 3328 MiB 上限。腾讯云私有 COS 也不能从阿里云内网访问，而 C-016 当前核心路径不依赖持久对象。仅降低 preflight 或复制旧 volume/secret 会制造 OOM、跨云凭据和错误生产证据。

## 2. 决定

### 2.1 环境与发布身份

- runtime environment 继续为 `DEV`，新增闭合 `deployment_profile=DEV_LITE`；
- ReleaseManifestV2 固定 `DEV_LITE_COLOCATED_EXCEPTION`、`synthetic_only=true`、`production_enabled=false`、`production_eligible=false`；
- V1 标准 DEV validator 与历史 rollback 语义保留，不把全局容量门槛降为 2C2G；
- V1/V2、STANDARD/DEV_LITE 不能在同一 release state 普通切换，必须以 fresh host/state/seed 重建；
- 服务器不 checkout、不 build，只安装 main-bound、同 run 11 项 CI 成功、digest 固定且 source-free 的 bundle；
- 3 Mbps 下 digest pull 使用独立最长 30 分钟有界超时，其它阶段保持更短的封闭超时。

### 2.2 主机与资源预算

- Ubuntu 24.04 LTS、x86_64、root、Asia/Shanghai、NTP 同步；
- 至少 2 CPU、1.5 GiB 实际 RAM、20 GiB 可用磁盘和 1 GiB swap；swap 只吸收突发，不替代容器预算；
- 稳态 core 仅为 PostgreSQL、Redis、dependency stub、API、TLS proxy，容器内存上限合计不得超过 704 MiB；
- Admin、Interactive、Background、Restricted 和 migration/verify/smoke 均为受控临时窗口，同一时刻最多启动一个非 core workload；
- maintenance 必须先停止 API/TLS 与全部临时 workload，再执行 pull、migration 或 drift；每阶段和 soak 后验证 `OOMKilled=false`、restart count 未增加、磁盘仍满足门槛；
- 只保留 current 与唯一 N-1 所需镜像，清理仅针对未引用层且不得删除有效回滚证据。

### 2.3 本地 synthetic object

- DEV_LITE 使用 `LOCAL_SYNTHETIC_OBJECT_STUB`，region=`HOST_LOCAL_EPHEMERAL`，prefix=`dev-lite/objects/`；
- object smoke 是 one-shot 非 root 容器，`network_mode:none`、无 secret、volume、host port 或外部 DNS；
- 容器内只监听随机 loopback 端口，以内存 Map 完成单个 `<=4 KiB` synthetic object 的 PUT、GET、SHA-256、DELETE 与 HEAD=404，然后在 `finally` 关闭；
- 仅接受 `/dev-lite/objects/healthchecks/<uuid>` 和 PUT/GET/DELETE/HEAD；拒绝 query、range、redirect、遍历、未知方法和超限 body；
- 输出只含稳定状态与 `transport=loopback-memory`，不输出 body、path 或 UUID；
- 该证据不证明 COS/OSS、ACL、生命周期、地域、持久性、备份或生产对象能力。

### 2.4 数据、secret 与网络

- 仅 synthetic、可重建数据；PostgreSQL/Redis volume 不承诺备份、PITR、RPO、RTO 或 HA；
- 不迁移腾讯云 volume、dump、object、release state、secret、COS credential 或 GHCR credential；新主机使用 fresh seed 与新 secret version；
- V2 不创建伪 COS config/credential，只保留数据库与 fault-control 的最小 secret 闭集；
- 80/443/5432/6379/8443/8444 不在非 loopback 地址监听；DEV_LITE 使用 loopback TLS/SSH tunnel，真机继续使用受控临时 synthetic HTTPS；
- 未获单独授权前不启用公网业务入口、真实微信身份、真实用户数据、第三方日志或云监控正文采集。

## 3. 被拒绝的方案

- **全服务常驻并只降低 preflight**：资源上限确定超过实际内存，拒绝；
- **复制腾讯云 DEV volume/dump/secret**：违反 disposable/fresh rebuild 与跨云凭据边界，拒绝；
- **从阿里云访问腾讯 COS 私网 endpoint**：网络不可达且语义错误，拒绝；
- **购买 OSS 仅为当前核心测试**：当前预算与 C-016 核心路径不需要，延后；
- **长期无鉴权 object stub**：扩大 API/Worker 网络访问面，拒绝；
- **把 swap 当作 RAM**：会隐藏 thrash/OOM 风险，拒绝。

## 4. 后果与限制

正面结果：预算内保留真实 Linux、不可变 bundle、migration、阶段化 Worker、Safety/owner/deletion 与 rollback 证据；不引入新的对象凭据或外部费用。

负面结果：发布和 C-016 测试更慢；Admin/Worker 不能并行；无外部对象、持久备份、HA 或生产容量证据；3 Mbps 首次拉取可能接近超时上限。

DEV_LITE 只能在真实主机完成 fresh deploy、reconcile、N/N+1/rollback/redeploy、完整 synthetic smoke、OOM/restart/disk/port 检查后称为 `DEV_LITE_ACCEPTED / LOCAL_SYNTHETIC_OBJECT_ONLY`。这不会解除 C-015 的生产 bundle 与 Privacy/Legal blocker。

## 5. 接受记录

项目所有者于 2026-09-03 明确确认：该 2C2G ECS 仅作为 `DEV_LITE`，只处理 synthetic 数据，Production/RC 保持 `NO_GO`；并授权绑定专用公钥和必要的空实例普通重启。对象能力按同一预算与 synthetic-only 边界使用本地 one-shot stub，外部对象服务继续 Pending。

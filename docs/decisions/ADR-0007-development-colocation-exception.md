# ADR-0007：临时开发环境有状态服务同机例外

- **状态**：Accepted
- **日期**：2026-08-05
- **接受日期**：2026-08-05
- **所属任务**：E-012 — 部署固定开发环境与可回滚发布流程
- **决策范围**：DEV 主机、PostgreSQL/Redis/object endpoint、数据耐久性、公网入口与迁移退出边界
- **决策所有者**：DailyEnergy 项目
- **相关文档**：[部署规范](../technical/deployment.md)、[数据库实现](../technical/database-implementation.md)、[ADR-0006](./ADR-0006-monorepo-and-stack.md)、[当前任务](../../tasks/current.md)

## 1. 背景

E-012 原计划让单 host Compose application 连接独立受控 PostgreSQL、Redis 和对象端点。项目当前已有一台临时腾讯云轻量应用服务器，可用于开发，但正式上线会迁移到其它服务器或独立数据服务。域名已实名但尚未完成 ICP 备案。项目所有者最初选择不使用家庭 NAS 或腾讯云 COS，随后于 2026-08-05 明确改为使用同地域私有 COS 作为 DEV application object endpoint；家庭 NAS 仍不进入方案。

如果继续等待全部生产同构资源，E-012 的 release lock、`ReleaseManifestV1`、digest 晋级、部署顺序和回滚实现无法取得真实 Linux 主机证据。若把临时 DEV 拓扑误当作 STAGING/PRODUCTION，则又会制造单机故障、无异地备份、数据不可恢复和错误合规结论。

## 2. 决策

仅对当前 `DEV` 环境接受以下有界例外：

- 使用腾讯云上海地域的一台临时 Ubuntu 24.04 LTS x86_64 主机，规格为 4 vCPU、8 GiB RAM、约 180 GB 系统盘；
- PostgreSQL 18、Redis 8 与 application Compose 运行在同一主机，但仍使用不同容器、最小权限、独立网络和显式 volume；
- object endpoint 使用腾讯云上海 `ap-shanghai` 的独立私有 COS；application 仅访问 `dev/objects/`，通过同地域 private/internal endpoint 和专用 CAM 编程身份进行上传、读取、删除、受限列举与分块上传；不接入家庭 NAS；
- COS bucket 名称、APPID、SecretId、SecretKey 和 endpoint 实值不进入仓库、镜像、Release Manifest、日志或聊天；Manifest 只记录无值配置引用、region、prefix、endpoint class、配置 fingerprint 与 secret version reference；
- CAM 身份不得拥有控制台登录、bucket 配置、列举账户全部 bucket、其它 bucket/prefix 或自助管理 API 密钥的权限；DEV 长期密钥仅作为当前临时环境的受限例外，必须保存在主机 root-only secret file 并支持轮换；
- `dev/objects/` 只保存 synthetic、可重新生成的 application object；当前版本 7 天后删除，未完成分块 1 天后清理，版本控制关闭。COS 不承担 PostgreSQL backup、PITR 或长期用户对象保留；
- DEV 只允许 synthetic seed/专用测试身份；主机、磁盘或 volume 丢失时从不可变 release 与 migration 重新创建，不承诺备份、PITR、RPO、RTO 或数据保留；
- 域名完成 ICP 备案、DNS 与 TLS 授权前，UFW 和云防火墙不开放公网 80/443；通过 loopback 与 SSH 隧道验证 TLS、health、readiness 和回滚；
- 服务器不得 checkout/build 应用；只接收 CI 产生并由 digest 固定的镜像与最小部署 bundle；
- `STAGING`、`PRODUCTION` 与处理真实备份的 `RECOVERY` 不继承本例外。它们必须使用独立受控 PostgreSQL、Redis 和对象服务，并满足部署规范中的 backup/PITR、区域、身份、审计与 Production Gate。

## 3. 迁移与退出方案

临时 DEV 主机的退出以“重建环境”而不是“搬运可变主机”为原则：

1. 保留 Compose/deploy bundle、`ReleaseManifestV1`、image digest、migration history、无值 COS 配置 fingerprint、prefix/lifecycle 合同和 synthetic seed 版本；
2. 在新主机或独立状态服务上运行相同 preflight 与 migration；
3. DEV PostgreSQL/Redis 内容默认丢弃并重新 seed；`dev/objects/` 内容由生命周期或显式清理删除，不迁移 Docker volume、DEV dump、COS object 或 DEV credential 到 STAGING/PRODUCTION；
4. 新环境 smoke、rollback 与 synthetic observability 通过后再撤销旧 SSH 身份并销毁旧主机；
5. 上线前必须另行批准生产云资源、备案域名、DNS/TLS、部署身份、secret store、独立数据服务和备份恢复证据。

## 4. 后果与风险

### 正向结果

- E-012 可以在真实 Ubuntu/Docker 主机验证无现场 build、幂等发布、发布锁和回滚；
- 部署资产不绑定腾讯云专有 API，降低后续迁移难度；
- object endpoint 已与临时 application host 分离，主机迁移不要求搬运 object volume；
- 不需要把家庭 NAS 暴露到公网。

### 已接受风险

- application host 故障会同时中断 API、Worker、PostgreSQL 和 Redis；
- 单块系统盘损坏会丢失 DEV 数据；
- 同机资源争用可能造成开发环境延迟抖动；
- COS credential 泄漏会造成 `dev/objects/` 内对象泄漏或删除，因此必须维持专用身份、最小权限、root-only secret 与轮换；
- 7 天生命周期会永久删除该 prefix 下对象，误放长期内容会造成数据丢失；
- 域名未备案期间没有公网固定 TLS 地址，E-012 的该项外部证据保持 pending。

这些风险只对 synthetic、可重建的 DEV 有效，不能用于降低 STAGING/PRODUCTION 验收标准。

## 5. 验收与撤销条件

本 ADR 的实现必须证明：

- manifest 明确记录 `environment=DEV`、`stateful_topology=DEV_COLOCATED_EXCEPTION`、`object_endpoint=TENCENT_COS_PRIVATE_INTERNAL`、`object_region=ap-shanghai`、`object_prefix=dev/objects/` 和 `production_enabled=false`；
- production profile 默认不存在或 fail closed；
- PostgreSQL/Redis 端口不绑定公网；COS 保持私有，专用 CAM 用户只能访问指定 bucket/prefix 的必要 object actions，不能修改 bucket 配置；
- secret value 不进入 manifest 或证据；部署只接受已登记且未撤销的 `cos_secret_id`/`cos_secret_key` version reference；
- synthetic smoke 必须在 `dev/objects/healthchecks/` 完成写入、读取/校验与删除，不保留用户内容；
- 删除主机状态后可以仅凭 release bundle、digest、migration 和 synthetic seed 重建；
- STAGING/PRODUCTION preflight 遇到同机 stateful topology 时拒绝启动。

以下任一条件发生时应复审或废止本 ADR：开始 STAGING/PRODUCTION、接入真实用户/生产身份、需要保留 DEV 数据、需要公网服务，或替换当前临时主机。

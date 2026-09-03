# DailyEnergy DEV / DEV_LITE 发布、回滚与换机 Runbook

- **文档状态**：Accepted
- **所属任务**：E-012 — 标准 DEV；E-017 — DEV_LITE 可回滚部署
- **最后更新**：2026-09-03
- **接受日期**：2026-08-12
- **适用范围**：阿里云上海 DEV_LITE 活动主机与腾讯云标准 DEV 历史证据；loopback TLS；PostgreSQL 18、Redis 8 同机
- **上游权威**：[ADR-0009](../decisions/ADR-0009-development-lite-colocation-exception.md)、[ADR-0007 历史标准 DEV](../decisions/ADR-0007-development-colocation-exception.md)、[部署、配置与回滚规范](../technical/deployment.md)、[测试策略](../technical/testing.md)、[故障和安全事件响应](./incident-response.md)
- **生产资格**：无；本流程和产物都固定为 `production_eligible=false`

## 1. 当前边界

- 域名完成 ICP 备案并取得 DNS/TLS 变更授权前，不开放公网 80/443，只通过 SSH tunnel 访问主机的 `127.0.0.1:8443` 与 `127.0.0.1:8444`；
- 活动 DEV_LITE 只使用 synthetic seed 和专用测试身份，不接收真实用户数据；PostgreSQL/Redis volume 是可丢弃状态，不复制腾讯云状态；
- DEV_LITE 不使用外部对象服务；one-shot local object smoke 只证明本地 synthetic HTTP 语义，不证明 COS/OSS；历史标准 DEV 的私有 COS 证据不适用于新主机；
- STAGING/PRODUCTION 必须迁移到独立 PostgreSQL、Redis 和对象服务，不能晋级本 Runbook 的同机 Compose、secret、volume、dump 或 COS object；
- 服务器只拉取 CI 已发布的 immutable image digest，不 checkout、不现场 build、不使用 mutable tag。

## 2. 一次性主机前置

以下前置只能由获授权的主机管理员执行：

### 2.1 DEV_LITE 活动主机

1. Ubuntu 24.04 LTS、x86_64、2 vCPU、至少 1.5 GiB 实际 RAM、至少 20 GiB 可用磁盘；时区 `Asia/Shanghai` 且 NTP 已同步；
2. 至少 1 GiB swap，只作突发缓冲；真实验收不得出现 OOMKilled、restart loop 或持续 swap thrash；
3. Docker `>=29.0.0`、Compose `>=2.40.0` 与 util-linux `flock`；防火墙只允许 SSH，80/443/5432/6379/8443/8444 不得在非 loopback 地址监听；
4. 稳态 core memory limit 总和最多 704 MiB；Admin、Interactive、Background、Restricted 与 one-shot job 使用互斥窗口；
5. 运行 `tooling/deployment/bootstrap-host.sh` 安装 checksum 固定的 Node 24.18.0；新主机使用 fresh database/fault secret version，不创建或迁移 COS credential；
6. 主机首次拉取允许最长 30 分钟；磁盘只保留 current 与唯一 N-1 必需镜像，清理不得触达有效回滚证据。

### 2.2 E-012 历史标准 DEV 主机

1. Ubuntu 24.04 LTS、x86_64、4 vCPU、至少 7 GiB RAM、至少 20 GiB 可用磁盘；时区 `Asia/Shanghai` 且 NTP 已同步；
2. Docker `>=29.0.0`、Compose `>=2.40.0`，且系统提供 util-linux `flock`；防火墙只允许 SSH，80/443/5432/6379 不得在非 loopback 地址监听；
3. 运行 `tooling/deployment/bootstrap-host.sh`，安装 checksum 固定的隔离 Node `24.18.0` 到 `/opt/dailyenergy/runtime/node-v24.18.0`，部署命令只使用 `/usr/local/bin/dailyenergy-node`；
4. PostgreSQL/故障控制 secret 使用 `dev-secret-v1`，COS credential 使用 `dev-cos-credential-v1`；version directory 为 `root:root 0700`，父目录由 root 拥有且不可被 group/other 写入，文件为 `root:root 0600`；
5. COS 无值配置位于 `/srv/dailyenergy/config/dev-cos-config-v1.env`，也是 `root:root 0600`。Linux Compose 对 `file` secret/config 使用 bind mount且不能重映射源文件 owner；同时 `environment` secret source 不能用于本项目的 `read_only: true` 服务。部署控制器因此在 preflight 后由 root 把已验证内容原子 materialize 到 `/srv/dailyenergy/runtime-secrets/<release_id>`：父目录和版本目录为 `root:root 0700`，文件按目标服务 UID/GID 设置为 `0400`。Compose 只接收该非秘密目录路径并使用 `file` source；密钥值不进入子进程环境、命令参数、`release.env`、Compose 输出或仓库。同一 release 重放会验证闭合文件集、内容、owner、mode 与 link，漂移立即失败。

TLS proxy 必须保持非 root、`cap_drop: ALL`、`no-new-privileges` 和只读根文件系统。上游 Caddy 二进制自带的 `cap_net_bind_service` 文件能力对 8443/8444 没有用途，必须由 CI 构建的 proxy image 移除，并在 publication 中按上述边界实际执行验证。若日志出现 `exec caddy failed: Operation not permitted`，停止发布并修复、重新发布 immutable image；不得在主机上给容器加 capability 或手改镜像。

不得把 SecretId、SecretKey、数据库密码、数据库 URL、fault token 或 GHCR token 粘贴到 issue、PR、聊天、日志或仓库。

## 3. 从 `main` 生成一次 DEV 发布

### 3.1 发布审批点

只有满足以下条件才允许手动触发 `Publish DEV images`：

- 精确 40 位 release commit 已进入 `main`；
- 同一 commit 的一个 CI run 中 11 个 required checks 全部成功；
- 没有 pending、skipped、cancelled 或来自其它 commit/run 的拼接证据；
- 发布者确认本次只用于 DEV，且不触发 SSH 或部署。

从 GitHub Actions 手动运行 `Publish DEV images`，输入精确 `release_sha`。workflow 会：

1. 核验 commit 属于 `main` 且绑定一个完整 CI run；
2. 构建并 push `admin/migration/proxy/server/stub` 五个 `linux/amd64` image；
3. 记录 CI run 与 publication run 两组独立编号；
4. 绑定 BuildKit provenance、SBOM、migration catalog 和 runtime fingerprints；
5. 生成并在 public GitHub Actions 平台保留 90 天的
   `dev-deployment-bundle-<sha>-<run>-<attempt>` artifact。

Artifact 只含 allowlist 内的 Compose、部署控制脚本和三份无 secret 证据，不含源码树、配置值或凭据。
90 天是 public development workflow 的平台上限；它不满足 RC/Release 的 365 天证据要求。
后者在获批归档后端落地前保持 `PENDING_APPROVED_ARCHIVAL`，不得将 DEV bundle 冒充 RC evidence。

### 3.2 下载并传输

在受控本地终端下载该 publication run 的 artifact，并把整个目录传到主机的临时目录。占位符必须替换为本次真实值：

```bash
gh run download <PUBLICATION_RUN_ID> \
  --repo WeiHan1996/DailyEnergy \
  --name <DEV_DEPLOYMENT_BUNDLE_ARTIFACT> \
  --dir <LOCAL_BUNDLE_DIR>

scp -i <SSH_IDENTITY_FILE> -r \
  <LOCAL_BUNDLE_DIR> ubuntu@<DEV_HOST>:/tmp/dailyenergy-dev-bundle
```

不要把 artifact 解包进 `/srv/dailyenergy`，也不要手工修改其中任何文件。安装入口会再次验证完整文件集、每个 SHA-256、release/image/runtime/supply binding 和 materialized manifest。

## 4. 安装并发布

### 4.1 安装部署包

DEV_LITE 登录服务器后执行；version ref 只标识新主机上单独创建的 8 项数据库与
fault-control secret，不包含路径或值：

```bash
sudo /usr/local/bin/dailyenergy-node \
  /tmp/dailyenergy-dev-bundle/tooling/deployment/install-dev-bundle.mjs \
  --dev-lite \
  /tmp/dailyenergy-dev-bundle \
  dev-lite-secret-v1
```

安装器必须生成 `ReleaseManifestV2`，且不得读取、创建或要求 COS config/credential。

历史标准 DEV 登录服务器后执行：

```bash
sudo /usr/local/bin/dailyenergy-node \
  /tmp/dailyenergy-dev-bundle/tooling/deployment/install-dev-bundle.mjs \
  /tmp/dailyenergy-dev-bundle \
  dev-secret-v1 \
  dev-cos-credential-v1 \
  dev-cos-config-v1
```

成功输出只包含 `release_id`、catalog generation 和本次是否首次安装。安装入口会在 release lock 内：

- 通过 Linux 内核 advisory `flock` 获取互斥所有权；`release.lock` 只保存无 secret 的当前 owner 元数据，不是文件存在即占用的哨兵，持锁进程异常退出或主机重启后内核会释放实际锁；
- 校验 source bundle；
- 严格校验命令中的 profile 与 version refs；标准 DEV 还校验 COS secret version 与 object config ref，任何参数都不得包含路径或 secret value；
- DEV_LITE 使用内建 local synthetic object fingerprint；标准 DEV 读取所选 COS 无值配置计算 fingerprint，但不读取 COS credential；
- 结合当前 Accepted release 生成 profile 内 N/N-1 兼容的 `ReleaseManifestV1` 或 `ReleaseManifestV2`，跨 profile/state 转换直接拒绝；
- 以 `root:root`、目录 `0700`、文件 `0600` 原子安装到 `/srv/dailyenergy/bundles/<release_id>`；
- 对同一 bundle 重放时验证已安装内容并返回 `installed=false`。

传输完成且安装成功后，可以删除 `/tmp/dailyenergy-dev-bundle`；已安装 bundle 与 GitHub artifact 必须保留，供回滚和换机重建使用。

### 4.2 为主机配置 GHCR 只读身份

私有 GHCR package 需要一个具备 `read:packages`、且其账户有权读取本仓库/package 的专用或有期限 token。token 由你在服务器交互式密码提示中输入，不提供给 Codex：

```bash
sudo docker login ghcr.io --username <GITHUB_PACKAGE_READER>
sudo chmod 700 /root/.docker
sudo chmod 600 /root/.docker/config.json
```

如 token 被粘贴到非密码提示、日志或聊天，立即停止发布、吊销并重建。DEV token 到期或人员权限变化时应先登录新 token、验证 immutable pull，再吊销旧 token。

### 4.3 执行有序发布

切换到 root shell，使用安装输出中的精确 release ID：

```bash
sudo -i
RELEASE_ID='<RELEASE_ID>'
cd "/srv/dailyenergy/bundles/${RELEASE_ID}"
/usr/local/bin/dailyenergy-node tooling/deployment/deploy-dev.mjs \
  deploy \
  release-manifest.json \
  evidence/dev-image-set.json \
  evidence/dev-runtime-evidence.json
exit
```

控制器固定执行 18 个阶段：preflight、digest pull、stateful readiness、关闭 loopback TLS 进入 DEV 维护、drain workers、migration 与 drift verify、Interactive、Background、API、Admin、Restricted、恢复 TLS、health、object smoke、Safety smoke、owner smoke、deletion smoke、退出维护。DEV_LITE 在 pull/migration 前停止 application/transient workload但保留 PostgreSQL、Redis 与 dependency stub 供失败恢复 probe 使用；每个临时 profile 启动前先停止其它临时 profile，所有 one-shot 使用确定性容器名防止中断重试并发，并在每阶段 receipt 前检查期望 service set、health、OOM、restart、20 GiB 磁盘余量和受保护端口。Admin 窗口会临时启动 TLS、验证 `8444/login` 后关闭 TLS；object smoke 是本地 one-shot，标准 DEV 才使用 COS。任一阶段失败都不写 Accepted release state。

首次全通过后才会更新 `/srv/dailyenergy/deployment/release-state.json`，分别保存当前 Accepted application、实际 effective catalog 和唯一
N-1 rollback target，并写无用户内容的 PASS receipt。同一 release 在没有 dirty operation 时重放只重新核验 manifest/preflight，
不重复迁移或写状态。控制器在第一次运行态变更前生成唯一 `operation_id` 并写
`/srv/dailyenergy/deployment/release-operation.json`；失败后保留该文件并拒绝普通 deploy/rollback，不能把 Accepted release 的幂等返回误当作恢复。
若进程在 Accepted state 写入后、PASS receipt 写入前退出，下次入口会先用完整 operation phases 与原 `operation_id` 确定性补建同一 receipt，
再清除 operation。receipt 文件名绑定 operation ID，因此同一 release 的多次合法 deploy/rollback/recover 不覆盖旧证据；不得手工删除
`release-operation.json` 或伪造 receipt。

## 5. Loopback TLS 验收

在本地建立隧道，保持该 SSH 会话打开：

```bash
ssh -i <SSH_IDENTITY_FILE> \
  -L 8443:127.0.0.1:8443 \
  -L 8444:127.0.0.1:8444 \
  ubuntu@<DEV_HOST>
```

另开本地终端验证：

```bash
curl --fail --insecure https://localhost:8443/health/ready
```

DEV 使用 Caddy internal certificate，因此浏览器会显示本地不受信任证书；这不是公网证书验收。DEV_LITE 的 Admin 不是稳态服务，`8444/login` 已在 18 阶段发布内的 Admin 窗口验证，窗口结束后按资源合同关闭，不能用部署后的 `8444` 结果替代阶段 receipt。不要为了消除警告而开放 80/443、修改 DNS 或导入未授权证书。

## 6. Clean restart 后收敛当前 Accepted release

计划内 Docker daemon clean restart、主机重启或已确认 state 未改变但服务没有全部恢复时，不能用普通 `deploy` 的 `idempotent=true/phases=0` 证明运行态已收敛。先读取无 secret state 并确认：

- `release-state.json` 存在，`current` 与 `catalog` 引用完整；
- `release-operation.json` 不存在；若存在，先按其原操作恢复，不能用 reconciliation 覆盖；
- 当前 bundle、root-only config/secret、全部 immutable image 与 effective catalog bundle 仍在主机；
- 本次只恢复 synthetic DEV 运行态，不删除 volume、network、state、bundle、secret 或审计证据。

`reconcile-current` 只能由 state 中 `current.release_id` 对应的 immutable bundle 自身提供和执行；不得用
新 candidate 的控制器脚本驱动旧 current bundle。首次引入该命令时，如果现有 Accepted release 早于
此能力并返回 `E012_DEPLOY_OPERATION_INVALID:reconcile-current`，先证明失败发生在任何 state/runtime
写入之前、Accepted state 逐字节不变且没有 `release-operation.json`。随后按普通 18 阶段流程先发布
包含该能力的新 candidate；只有它成为 current 后，才通过一次新的 clean restart 和本节命令验证
17 阶段 reconciliation。不得用跨 bundle 控制器、手改旧 bundle、普通 deploy 的幂等返回或
`recover-current` 伪造该一次性 bootstrap。

进入 state 中 `current.release_id` 对应 bundle，执行：

```bash
sudo -i
CURRENT_RELEASE_ID='<STATE_CURRENT_RELEASE_ID>'
cd "/srv/dailyenergy/bundles/${CURRENT_RELEASE_ID}"
/usr/local/bin/dailyenergy-node tooling/deployment/deploy-dev.mjs \
  reconcile-current \
  release-manifest.json \
  evidence/dev-image-set.json \
  evidence/dev-runtime-evidence.json
exit
```

控制器要求调用 manifest 与 state `current` 的 release ID/digest 完全一致，并组合当前 Accepted application/config/secret 与 state `catalog` 指向的 immutable migration image/metadata。它不 pull image，不执行 role/credential prepare、Prisma migrate 或 synthetic seed，也不改写 Accepted state、effective catalog 或 rollback target。固定 17 阶段为：preflight、stateful readiness、关闭 loopback TLS、worker drain、只读 drift verify、Interactive、Background、API、Admin、Restricted、恢复 TLS、health、object smoke、Safety smoke、owner smoke、deletion smoke、退出维护；所有 Compose `up` 都使用 `--force-recreate`。DEV_LITE 的 object smoke 与逐阶段 runtime guard 仍按第 4.3 节执行。

成功后写一份同时绑定 current、effective catalog 与唯一 `operation_id` 的 PASS receipt，再清除 reconciliation operation；`release-state.json` 必须逐字节不变。任一阶段失败时保留 `RECONCILE_CURRENT/FAILED` operation 与原 Accepted state，修复外部原因后只能从同一 current bundle 重跑同一 `reconcile-current`，并沿用原 operation ID。无关 deploy/rollback/recover dirty operation、不同 manifest 或缺失 Accepted state 一律 fail closed。17 阶段已经全部通过而进程在 receipt/cleanup 前退出时，相同入口只确定性补建 receipt 并清理 operation，不重跑运行态命令。

## 7. 发布失败后的恢复

如果已有 Accepted release 的候选发布失败，先查看无 secret 的 state/operation，确认 `current`、`target`、`active_phase`、
`migration_applied` 和 `migration_verified`：

```bash
sudo sed -n '1,220p' /srv/dailyenergy/deployment/release-state.json
sudo sed -n '1,220p' /srv/dailyenergy/deployment/release-operation.json
```

不得删除或编辑 operation/state。进入 state 中 `current.release_id` 对应的已安装 bundle，显式恢复当前 Accepted release：

```bash
sudo -i
CURRENT_RELEASE_ID='<STATE_CURRENT_RELEASE_ID>'
cd "/srv/dailyenergy/bundles/${CURRENT_RELEASE_ID}"
/usr/local/bin/dailyenergy-node tooling/deployment/deploy-dev.mjs \
  recover-current \
  release-manifest.json \
  evidence/dev-image-set.json \
  evidence/dev-runtime-evidence.json
exit
```

控制器会重新执行完整 18 阶段。migration 阶段内部依次执行 role/credential prepare、Prisma migrate、synthetic seed 与 drift verify。Prisma
migrate 自身完成并核验 migration history 后立即记录 `migration_applied=true`；seed 与 drift verify 也通过后才记录
`migration_verified=true`。prepare 或 Prisma migrate 自身失败时，恢复先用只读 drift probe 核验 state 已记录的 effective catalog；如果 host
checkpoint 恰好在 migration 生效后、`migration_applied` 落盘前丢失，旧 catalog probe 会失败，只有候选 probe 通过才能选择候选。migration
已核验生效但 seed、drift 或后续阶段失败时，恢复使用候选 immutable migration image/catalog；两个 probe 都失败时保持 dirty operation 并
以 `RECOVER_CURRENT_CATALOG_UNRESOLVED` 停止，不能猜测 catalog 或启动应用。
随后启动当前 Accepted 的 application、config 和 secret。只有完整 smoke 通过后才更新 effective catalog、写入 PASS receipt 并清除
operation。恢复自身失败时继续保留同一 `operation_id` 的 dirty operation，修复外部原因后重复同一 `recover-current`，不得改用
deploy/rollback 绕过。

首次发布尚无 Accepted state 时不能执行 `recover-current`。修复外部原因后可对同一 manifest 重试 `deploy`。如果根因必须通过新 artifact 修复，只有旧 operation 为 `FAILED`、没有 from-current/recovery catalog、active/completed phase 都在 migration 之前且 `migration_applied=false`、`migration_verified=false` 时，才可从新 candidate bundle 执行普通 `deploy`。控制器会在新 candidate 的 preflight 和 file secret materialization 通过后，先写绑定旧 `operation_id`、失败阶段及 replacement digest 的 `SUPERSEDED_BEFORE_MIGRATION` receipt，再清理旧 pending 并开始新 operation。已进入 migration 或 checkpoint 不明确时，新候选仍被拒绝；不得人工删除 operation/state。

若首次发布已经进入 migration，且根因只能由新 artifact 修复，保持任务为 `Blocked` 并保留完整 dirty operation、已安装 bundle、不可变镜像和
有状态 volume。不得单独删除或移动 `release-operation.json` 来伪造空环境。当前 DEV 仅含 synthetic、可重建数据时，项目所有者可以依据
ADR-0007 另行明确批准“完整 DEV 环境重建”：执行前必须再次证明没有 Accepted release、记录 operation ID/失败阶段/migration checkpoints
与 artifact identity，预览将停止的容器和将永久删除的 PostgreSQL/Redis volume；批准后归档无 secret 的失败证据，删除整个 DEV Compose
环境及其有状态 volume，并从空 deployment state 用新 artifact 重建。该授权不适用于 STAGING/PRODUCTION，也不能由一般发布批准或自动化 Gate
推定获得。

## 8. 回滚

只有 `release-state.json` 中记录的唯一 `rollback_target` 可以回滚。先查看无 secret 状态文件并抄录精确 target release ID：

```bash
sudo sed -n '1,160p' /srv/dailyenergy/deployment/release-state.json
```

确认目标 bundle 仍存在，然后执行：

```bash
sudo -i
ROLLBACK_RELEASE_ID='<RECORDED_ROLLBACK_TARGET>'
cd "/srv/dailyenergy/bundles/${ROLLBACK_RELEASE_ID}"
/usr/local/bin/dailyenergy-node tooling/deployment/deploy-dev.mjs \
  rollback \
  release-manifest.json \
  evidence/dev-image-set.json \
  evidence/dev-runtime-evidence.json
exit
```

控制器会重新校验 manifest digest、双向 catalog generation 兼容和完整 18 阶段 smoke。成功后消费旧 rollback target；禁止手改 state、指定任意历史 tag、恢复旧数据库 volume 或跳过 migration/Smoke。

## 9. Secret/配置轮换

- DEV_LITE 只轮换数据库与 fault-control 的 8 项闭合 secret version；不得为它创建 COS config/credential，使用新 version ref 重新执行 `--dev-lite` 安装入口；
- secret value 变化必须创建新 version directory，并以新 release manifest 引用；不得覆盖 `dev-secret-v1` 或 `dev-cos-credential-v1` 的现有文件；
- COS bucket、region、prefix 或 endpoint 变化属于 deploy config 变化，必须生成新 fingerprint 和 release；
- CAM/API key 泄露时先吊销、记录为凭据事件，再创建新 credential/version；不要在排障输出中读取旧值；
- GHCR token 轮换不改变 application release，但必须验证 digest pull 并记录操作时间和操作者；
- STAGING/PRODUCTION 不复用任何 DEV secret version 或身份。

应用数据库 role 轮换示例：创建 `dev-secret-v2`，保留当前 DEV PostgreSQL administrator/container credential，只轮换各 application login
credential；这使 `database-init` 可先用仍有效的 admin 连接，再原子更新最小角色密码。参数只含 version ref，命令不输出值：

```bash
sudo /usr/local/bin/dailyenergy-node \
  /tmp/dailyenergy-dev-bundle/tooling/deployment/provision-dev-secrets.mjs \
  dev-secret-v2 \
  dev-secret-v1
```

若 PostgreSQL administrator/container credential 泄露，停止普通轮换并按 DEV 可丢弃边界重建 PostgreSQL volume/主机；不得把新 admin
password 只写入文件后假装现有 PostgreSQL 已完成轮换。

COS credential 由 CAM 创建 `dev-cos-credential-v2`，以相同文件名写入新的 root-only version directory；COS deploy config 变化则创建
新的 `/srv/dailyenergy/config/dev-cos-config-v2.env`。完成文件权限和最小权限验证后，用同一 CI bundle 重新运行安装入口：

```bash
sudo /usr/local/bin/dailyenergy-node \
  /tmp/dailyenergy-dev-bundle/tooling/deployment/install-dev-bundle.mjs \
  /tmp/dailyenergy-dev-bundle \
  dev-secret-v2 \
  dev-cos-credential-v2 \
  dev-cos-config-v2
```

安装器会因 version refs/config fingerprint 变化生成新的 `release_id`，manifest 明确绑定 v2；无需修改代码、重跑 CI 或重建相同镜像。
先发布并通过完整 smoke，再吊销旧 application/COS credential。疑似泄露时先 containment/吊销的事件流程优先，不能为了无缝轮换继续使用泄露值。

## 10. 临时主机迁移或丢失

DEV 的恢复单位是“同一 GitHub artifact + immutable image digest + migration catalog + profile 所需配置 + 重新创建的版本化 secret”，不是容器文件系统或旧 volume：

1. 新建符合第 2 节基线的 Ubuntu 主机，保持公网业务端口关闭；
2. 安装 Docker/Compose 和 checksum 固定的隔离 Node；
3. 重新创建/轮换 DEV 数据库、fault 和 GHCR credential；只有历史标准 DEV 才创建 COS config/credential，任何 DEV 凭据都不复制到 STAGING/PRODUCTION；
4. 从 GitHub 下载同一 deployment artifact，安装并执行 deploy；
5. 运行 synthetic seed 和完整 18 阶段 smoke；
6. 通过 SSH tunnel 验收后，再退役旧主机凭据和资源。

PostgreSQL/Redis DEV volume 不承诺备份、PITR、RPO、RTO 或 HA；历史标准 DEV 的 COS application objects 会按 7 天生命周期删除，DEV_LITE local object 在 one-shot 进程结束前已删除且不持久化。需要保留的测试事实必须来自可重复 seed/fixture，而不是迁移可变 DEV 数据。

## 11. 必须停止的情况

出现以下任一情况，停止发布且不得写 PASS：

- bundle 文件集、SHA-256、release/image/runtime/supply binding 或权限不一致；
- CI 11 checks 不来自同一成功的 `main` run；
- image 不是 digest reference，或服务器试图 build；
- profile 对应的 object fingerprint、secret version、host baseline、资源 runtime guard 或非 loopback 端口漂移；
- migration/drift、health、object、Safety、owner 或 deletion 任一 smoke 失败；
- rollback target 不存在、不兼容或与 state digest 不一致；
- 存在 dirty operation 却尝试普通 deploy/rollback，或恢复目标不是 state 中的 current Accepted release；
- DEV_LITE 发现遗留的确定命名 one-shot 容器时，不得启动第二个副本；先保留 operation/state，核验该容器与失败阶段后按明确恢复步骤处理；
- 发现真实用户数据、生产身份、生产 secret 或 DEV 状态正在向生产迁移。

凭据暴露、越权、真实数据进入 DEV 或 Safety/删除控制失效时，按[故障和安全事件响应](./incident-response.md)处理。

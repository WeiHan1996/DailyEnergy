# DailyEnergy DEV 发布、回滚与换机 Runbook

- **文档状态**：Draft
- **所属任务**：E-012 — 部署固定开发环境与可回滚发布流程
- **最后更新**：2026-08-09
- **适用范围**：腾讯云上海临时 DEV 主机；loopback TLS；PostgreSQL 18、Redis 8 与应用同机；私有 COS application object
- **上游权威**：[ADR-0007](../decisions/ADR-0007-development-colocation-exception.md)、[部署、配置与回滚规范](../technical/deployment.md)、[测试策略](../technical/testing.md)、[故障和安全事件响应](./incident-response.md)
- **生产资格**：无；本流程和产物都固定为 `production_eligible=false`

## 1. 当前边界

- 域名完成 ICP 备案并取得 DNS/TLS 变更授权前，不开放公网 80/443，只通过 SSH tunnel 访问主机的 `127.0.0.1:8443` 与 `127.0.0.1:8444`；
- DEV 只使用 synthetic seed 和专用测试身份，不接收真实用户数据；PostgreSQL/Redis volume 与 COS `dev/objects/` 都是可丢弃状态；
- COS 只存 application object，不存 PostgreSQL backup；bucket 名、APPID、endpoint 和 credential value 不写入仓库、artifact、manifest、命令输出或聊天；
- STAGING/PRODUCTION 必须迁移到独立 PostgreSQL、Redis 和对象服务，不能晋级本 Runbook 的同机 Compose、secret、volume、dump 或 COS object；
- 服务器只拉取 CI 已发布的 immutable image digest，不 checkout、不现场 build、不使用 mutable tag。

## 2. 一次性主机前置

以下前置只能由获授权的主机管理员执行：

1. Ubuntu 24.04 LTS、x86_64、4 vCPU、至少 7 GiB RAM、至少 20 GiB 可用磁盘；时区 `Asia/Shanghai` 且 NTP 已同步；
2. Docker `>=29.0.0`、Compose `>=2.40.0`，且系统提供 util-linux `flock`；防火墙只允许 SSH，80/443/5432/6379 不得在非 loopback 地址监听；
3. 运行 `tooling/deployment/bootstrap-host.sh`，安装 checksum 固定的隔离 Node `24.18.0` 到 `/opt/dailyenergy/runtime/node-v24.18.0`，部署命令只使用 `/usr/local/bin/dailyenergy-node`；
4. PostgreSQL/故障控制 secret 使用 `dev-secret-v1`，COS credential 使用 `dev-cos-credential-v1`；version directory 为 `root:root 0700`，父目录由 root 拥有且不可被 group/other 写入，文件为 `root:root 0600`；
5. COS 无值配置位于 `/srv/dailyenergy/config/dev-cos-config-v1.env`，也是 `root:root 0600`。Linux Compose 对 `file` secret/config 使用 bind mount，不能安全重映射非 root UID/GID；部署控制器因此在 preflight 后由 root 读取已验证文件，只在 Docker Compose 根进程的环境中提供 `environment` secret source，并在容器内挂载为目标 UID/GID 的 `0400` 文件。值不进入命令参数、`release.env`、Compose 输出或仓库。

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
5. 生成并保留 365 天的 `dev-deployment-bundle-<sha>-<run>-<attempt>` artifact。

Artifact 只含 allowlist 内的 Compose、部署控制脚本和三份无 secret 证据，不含源码树、配置值或凭据。

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

登录服务器后执行：

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
- 严格校验命令中的 database secret version、COS secret version 与 object config ref；这些参数不得包含路径或 secret value；
- 读取所选 COS 无值配置计算 fingerprint，但不读取 COS credential；
- 结合当前 Accepted release 生成 N/N-1 兼容的 `ReleaseManifestV1`；
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

控制器固定执行 18 个阶段：preflight、digest pull、stateful readiness、关闭 loopback TLS 进入 DEV 维护、drain workers、migration 与 drift verify、Interactive、Background、API、Admin、Restricted、恢复 TLS、health、COS object smoke、Safety smoke、owner smoke、deletion smoke、退出维护。任一阶段失败都不写 Accepted release state。

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
curl --fail --insecure https://localhost:8444/login
```

DEV 使用 Caddy internal certificate，因此浏览器会显示本地不受信任证书；这不是公网证书验收。不要为了消除警告而开放 80/443、修改 DNS 或导入未授权证书。

## 6. 发布失败后的恢复

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

首次发布尚无 Accepted state 时不能执行 `recover-current`；修复失败原因后，只能对同一 manifest 重试 `deploy`。其它候选会被拒绝。

## 7. 回滚

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

## 8. Secret/配置轮换

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

## 9. 临时主机迁移或丢失

DEV 的恢复单位是“同一 GitHub artifact + immutable image digest + migration catalog + 外部无值配置 + 重新创建的版本化 secret”，不是容器文件系统或旧 volume：

1. 新建符合第 2 节基线的 Ubuntu 主机，保持公网业务端口关闭；
2. 安装 Docker/Compose 和 checksum 固定的隔离 Node；
3. 重新创建/轮换 DEV 数据库、fault、COS 和 GHCR credential，不复制到 STAGING/PRODUCTION；
4. 从 GitHub 下载同一 deployment artifact，安装并执行 deploy；
5. 运行 synthetic seed 和完整 18 阶段 smoke；
6. 通过 SSH tunnel 验收后，再退役旧主机凭据和资源。

PostgreSQL/Redis DEV volume 不承诺备份、PITR、RPO、RTO 或 HA；COS application objects 会按 7 天生命周期删除。需要保留的测试事实必须来自可重复 seed/fixture，而不是迁移可变 DEV 数据。

## 10. 必须停止的情况

出现以下任一情况，停止发布且不得写 PASS：

- bundle 文件集、SHA-256、release/image/runtime/supply binding 或权限不一致；
- CI 11 checks 不来自同一成功的 `main` run；
- image 不是 digest reference，或服务器试图 build；
- COS 配置 fingerprint、secret version、host baseline 或非 loopback 端口漂移；
- migration/drift、health、COS、Safety、owner 或 deletion 任一 smoke 失败；
- rollback target 不存在、不兼容或与 state digest 不一致；
- 存在 dirty operation 却尝试普通 deploy/rollback，或恢复目标不是 state 中的 current Accepted release；
- 发现真实用户数据、生产身份、生产 secret 或 DEV 状态正在向生产迁移。

凭据暴露、越权、真实数据进入 DEV 或 Safety/删除控制失效时，按[故障和安全事件响应](./incident-response.md)处理。

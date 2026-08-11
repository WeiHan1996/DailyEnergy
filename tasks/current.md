# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-11（PR #132 已合并并完成新 publication/install 与五镜像收敛；等待第三次 synthetic DEV 重建的精确授权）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-012 — 部署固定开发环境与可回滚发布流程
- **任务状态**：In Progress
- **任务分支**：`agent/e012-post-132-publication`
- **当前 Issue**：[E-012 Issue #50](https://github.com/WeiHan1996/DailyEnergy/issues/50)
- **实现 PR**：[E-012 已合并 PR #121](https://github.com/WeiHan1996/DailyEnergy/pull/121)
- **最近合并 PR**：[E-012 database smoke invocation 修复 PR #132](https://github.com/WeiHan1996/DailyEnergy/pull/132)
- **当前 PR**：[E-012 post-PR #132 publication / reset evidence PR #133](https://github.com/WeiHan1996/DailyEnergy/pull/133)（Draft）
- **实现合并提交**：E-012 latest squash merge `372b3db99b3b4e14a3d5b10f4907232f03b7a646`
- **Gate 结论**：`E012_IN_PROGRESS / PR_132_MERGED / MERGE_MAIN_CI_11_OF_11_PASS / NEW_ARTIFACT_INSTALLED / EXACT_IMAGES_5_OF_5_READY / RESET_REAUTHORIZATION_REQUIRED / REDEPLOY_NOT_STARTED / NO_ACCEPTED_RELEASE_STATE / PUBLIC_TLS_ICP_PENDING / PRODUCTION_STATEFUL_SERVICES_BLOCKED`

## 1. 当前目标

在已批准的开发基础设施上建立 digest 晋级、`ReleaseManifestV1`、TLS 入口和可验证回滚；
生产环境、生产身份和真实用户数据继续保持 Gate。

```text
approved development infrastructure
  -> immutable CI digest + ReleaseManifestV1 + release lock/preflight
  -> reverse proxy/TLS + DEV-only co-located PG/Redis + private COS object endpoint
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
- 部署单 host Compose application；按 ADR-0007 仅 DEV 同机运行 PostgreSQL/Redis，并连接
  上海 `ap-shanghai` 私有 COS 的 `dev/objects/` application object endpoint；
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

## 5. 当前授权、待决证据与边界

- **前置依赖**：E-009 与 E-011 已完成，代码依赖满足；E-012 Issue #50 为 Open，Milestone
  为 Phase 1；
- **已获授权**：腾讯云上海临时 Ubuntu 24.04 LTS 主机作为 DEV；4 vCPU、8 GiB RAM、约
  180 GB 系统盘；PostgreSQL 18 与 Redis 8 同机；不用 NAS；使用上海私有 COS 和专用
  `dailyenergy-dev-cos` CAM 编程身份访问 `dev/objects/`；允许 SSH 部署与更新 E-012 规范/任务记录；
  该决定由 Accepted ADR-0007 固化；
- **已完成主机基线**：DailyEnergy 专用 ED25519 公钥登录通过，旧未知公钥已移除并留有受限备份；
  系统安全更新完成；Docker 29.1.3、Compose 2.40.3 已安装；UFW 仅允许 SSH 入站；COS
  credential/config 已以 `root:root`、`0600` 存入版本化外部路径；checksum 固定的隔离 Node
  24.18.0 已安装到 `/opt/dailyenergy/runtime/node-v24.18.0`，部署入口为
  `/usr/local/bin/dailyenergy-node`；`dev-secret-v1` 的 PostgreSQL 六类角色 URL、admin password 与
  fault-control token 已生成并通过 `root:root 0600` 完整性复核，过程未输出值；
- **待决外部证据**：域名已实名但未备案；ICP备案、DNS/TLS 控制权和公网 80/443 开放尚未授权，
  因此先用 loopback/SSH tunnel 验证 TLS，固定公网地址验收保持 `ICP_FILING_PENDING`；
- **生产仍阻塞**：STAGING/PRODUCTION 必须迁移到独立 PostgreSQL、Redis 和对象服务，并另行批准
  生产身份、secret store、备份/PITR、区域与审计；ADR-0007 不豁免这些 Gate；
- **对象边界**：COS 仅存 synthetic、可重新生成的 application object，不存 PostgreSQL backup；
  bucket 私有、版本控制关闭，`dev/objects/` 当前对象 7 天后删除、未完成分块 1 天后清理；真实
  bucket/APPID/endpoint 与 credential value 不入仓库/镜像/manifest/log，只记录无值配置和 secret
  version；专用 CAM 最小权限策略已绑定，private/internal endpoint 的签名 smoke 已完成 PUT 200、
  GET 200、SHA-256 match、DELETE 204 与删除后 HEAD 404，测试对象和临时脚本均已清理；
- **数据边界**：DEV 只用 synthetic seed/专用测试身份；主机丢失后重建，不把 DEV volume、dump、
  COS object 或 secret 迁入 STAGING/PRODUCTION；
- **context prepare**：`pnpm agent:prepare E-012 --remote --deep` 已确认 route=`READY`、
  profile=`security`、remote/dependency/Node/pnpm check PASS、Issue/Milestone 正确；这只证明仓库路由和代码前置满足，
  不能替代 Issue #50 要求的开发基础设施授权；
- **已完成实现**：手动 `Publish DEV images` workflow 将一个成功的 `main` CI run 与独立 publication
  run 绑定，构建五类 digest-only image、SBOM/provenance、migration/runtime evidence 和 source-free
  deployment bundle；root-only 安装入口验证文件集、digest、权限、COS config fingerprint 后原子生成
  `ReleaseManifestV1`；preflight、release lock、18 阶段 Compose 顺序发布、COS/Safety/owner/deletion
  smoke、Accepted state、唯一 N-1 rollback 与幂等 replay 已进入代码和定向测试；外部 secret/config
  保持宿主机 `root:root 0600`，本 PR 正把 Linux DEV 注入修正为 release-scoped file materialization：父目录
  `root:root 0700`、文件按目标服务 UID/GID 设置为 `0400`，Compose 只接收非秘密目录路径，值不进入子进程环境、
  命令参数、release env、Compose 解析结果或日志；
- **审核修复**：PR #121 的三项审核意见已修复：主机健康探针与 Caddy `localhost` Host/SNI 一致；部分发布失败会留下
  pending/dirty operation，并可显式 `recover-current` 收敛回当前 Accepted application/config/secret 与已验证兼容的
  catalog；安装入口必须接收受严格校验且不含值的 database/COS secret version 与 object config ref，使轮换生成并绑定
  新 release，而不是依赖代码常量；第一轮修复的本地部署 suite、registry、test policy、CI policy、ESLint、目标格式与 diff Gate 已通过；
- **第二轮审核修复**：release/install/deploy/rollback/recover-current 改用 Linux 内核 advisory `flock`，持锁进程退出或主机重启后不会被残留
  元数据文件永久阻塞；dirty operation 与 state→receipt 可恢复提交已进入代码，但复审又发现 migration 阶段内部副作用和 receipt 路径复用缺口；
- **第三轮审核修复**：migration 阶段拆为 prepare/migrate/seed/drift 子步骤，Prisma migrate 核验成功后原子记录 `migration_applied`，完整阶段通过后才记录
  `migration_verified`；checkpoint 落盘窗口丢失时用只读 state/candidate drift probe 判定实际 catalog，两个都不通过则保持 dirty 并 fail closed；每次
  operation 生成持久 UUID，receipt 内容和路径均绑定该 ID，同一 release 合法重复 deploy/rollback 不再碰撞。新增 seed failure、checkpoint loss、
  state→receipt 重建与 deploy N+1 → rollback N → 再 deploy N+1 场景；该轮采用的 Compose environment secret 设计后来被真实 Linux
  `read_only` 运行时证伪，本轮 file materialization 修复取代它，probe 仍不输出值；
- **供应链修复**：head `87af40e` 的 run `31294911129` 中 9 个 automated lane 全部成功，但 supply-chain 因 2026-08-07 完成 GitHub review 的
  `GHSA-2v37-7h3g-55p8` 拒绝 `nanoid 3.3.16`，聚合 Gate 随之失败；已用精确 pnpm override 升到 patched `3.3.17`，未豁免 high Gate；
- **合并交接**：PR #121 最终 head `79b2e8dbfeda68da5ef08a185756e606edaac135` 的固定 Ubuntu CI
  [run #31295404849](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31295404849) 为 11/11 checks 全部成功；人工 merge
  receipt 为 `CI_MANUAL_MERGE_GATE_OK:pr=121:head=79b2e8dbfeda68da5ef08a185756e606edaac135:run=31295404849:checks=11`；
  PR 已于 `2026-08-09T04:55:02Z` squash 合并为 `3c00d952be6fa7e44aba683fc79fee4e1a1687fe`；该实现合并时本地
  `main`、`origin/main` 与 GitHub `main` 已核对一致；Issue #50 保持 Open；
- **首次发布尝试**：用户已明确批准 DEV image publication 与首次真实部署；手动 publication
  [run #31347312900](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31347312900) 在读取固定 main CI
  check-runs 时返回 `HTTP 403`，根因是 job 仅有 `actions: read`、没有 `checks: read`。失败发生在镜像构建、push、artifact
  生成和服务器变更之前，因此没有发布镜像，也没有改变 DEV 主机；修复限定为补充只读 Checks 权限及对应工作流合同测试；
- **权限修复合并**：PR #124 最终 head `2ab09f5d471b26ca3e45b56eab72776b56997747` 的固定 Ubuntu CI
  [run #31348236686](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31348236686) 为 11/11 checks 全部成功；人工 merge
  receipt 为 `CI_MANUAL_MERGE_GATE_OK:pr=124:head=2ab09f5d471b26ca3e45b56eab72776b56997747:run=31348236686:checks=11`；
  用户明确批准后，PR 于 `2026-08-10T01:55:43Z` squash 合并为 `6c122943ffb71175ff8e0d4861b5f226c58876db`；
- **第二次发布尝试**：publication
  [run #31348424543](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31348424543) 已通过 immutable main CI 绑定、supply-chain
  evidence 下载和 job-scoped GHCR 登录，但 runner 默认 Docker driver 不支持 `--provenance=mode=max` 与 `--sbom=true` attestation，
  首个 buildx 调用以 `Attestation is not supported for the docker driver` 失败；没有镜像 push、deployment artifact 或 DEV 主机变更；
  修复限定为固定官方 Buildx action 并显式使用 `docker-container` driver，以及对应工作流合同测试；
- **Buildx 修复合并**：PR #125 最终 head `f44be717255420b52225b1d341cc05826e267324` 的固定 Ubuntu CI
  [run #31348801769](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31348801769) 为 11/11 checks 全部成功；人工 merge
  receipt 为 `CI_MANUAL_MERGE_GATE_OK:pr=125:head=f44be717255420b52225b1d341cc05826e267324:run=31348801769:checks=11`；
  用户明确批准后，PR 于 `2026-08-10T02:17:51Z` squash 合并为 `d56ff92781d4d7d8f9052404681c71ade8ea2299`；
- **DEV publication 成功**：手动 publication
  [run #31349439531](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31349439531) 已成功发布五类 digest-only DEV image 和
  source-free deployment bundle `dev-3c00d952be6f-31349439531-1`；artifact `9048495961` 保留至
  `2027-08-10T02:18:31Z`，下载、离线 bundle 校验与传输后校验均通过，服务器没有现场 checkout/build；
- **COS config v2**：为满足 private endpoint preflight，在保留 v1 的前提下创建 root-only
  `/srv/dailyenergy/config/dev-cos-config-v2.env`，仅将 endpoint 从带 `https://` 的 URL 规范化为私有内网 hostname；文件继续为
  `root:root 0600`，过程未输出 bucket、APPID、endpoint 或 credential value；
- **首次真实安装阻断**：root installer 从 `/tmp/dailyenergy-dev-bundle` 复制传输用户持有的 artifact 后，以
  `DEV_BUNDLE_INSTALL_FILE_PROTECTION:bundle-manifest.json` fail closed；只读诊断确认副本为 regular file、非 symlink、`uid=1000`、
  `gid=1001`、`mode=600`、`nlink=1`，证明 Node `copyFile` 保留源 owner，而 root-only 安装 Gate 正确拒绝。失败后 stage 已清理，
  `/srv/dailyenergy/bundles` 为空且没有 Accepted release state；修复限定为复制后显式 `chown(expectedUid, expectedGid)`、再设 `0600`，
  并增加顺序合同测试；
- **owner 修复合并**：PR #126 最终 head `b5013f9cbb67ee196cd0b683e5174dd44fc9482a` 的固定 Ubuntu CI
  [run #31350663734](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31350663734) 为 11/11 checks 全部成功；人工 merge
  receipt 为 `CI_MANUAL_MERGE_GATE_OK:pr=126:head=b5013f9cbb67ee196cd0b683e5174dd44fc9482a:run=31350663734:checks=11`；
  用户明确批准后，PR 于 `2026-08-10T03:05:57Z` squash 合并为 `7582e3c51238f7917841ed1d269fb6f4e4d364f8`；本地
  `main` 与 `origin/main` 已快进核对一致；
- **修复后 publication**：合并提交的 main CI
  [run #31351619060](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31351619060) 11/11 成功；手动 publication
  [run #31351757432](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31351757432) 已从该精确提交重新发布五类 digest-only image 和
  source-free bundle `dev-7582e3c51238-31351757432-1`。artifact `9049272100` 保留至 `2027-08-10T03:08:52Z`，本地与
  传输后校验均为 `files=16`、`production_eligible=false`；
- **修复后真实安装**：使用 `dev-secret-v1`、`dev-cos-credential-v1` 与 `dev-cos-config-v2` 原子生成 candidate release
  `devr-7582e3c51238-101ee4bf43be64a5ef17f2f4`、generation `1`；18 个文件全部为 `root:root 0600`、`nlink=1`，5 个目录
  全部为 `root:root 0700`，证明传输用户与安装 owner 不同的真实路径已收敛。尚未启动容器或写入 Accepted release state；
- **GHCR 拉取与部署排队**：服务器管理员已在主机上交互式配置有 `read:packages` 的 GHCR 只读身份；Codex 仅验证 root Docker
  config 为 `root:root 0600`，未读取或记录 token。`admin`、`proxy`、`server`、`stub` 四类镜像已按
  `ReleaseManifestV1` 的不可变摘要完成并经本地 image metadata 复核；`migration` 的约 262 MB 独立大层受中国大陆到 GHCR
  链路约 28 KB/s 限制，使用主机 transient systemd unit 继续断点拉取。
  第一版 `dailyenergy-e012-deploy.service` 因把 `activating` 误判为非运行状态而在 image inspect 处 fail closed；bounded journal 与路径检查确认
  部署控制器未启动、没有 Accepted state。修正后的 `dailyenergy-e012-deploy-after-pull.service` 正在每 30 秒轮询精确 migration 摘要，
  仅在拉取保持 `active/activating` 时等待，摘要可 inspect 后才执行 candidate 的 18 阶段部署；拉取失败或摘要不存在时以状态 42
  停止。首次后台拉取于 `2026-08-10T16:15:24+08:00` 在 `137804490/261527051` bytes（约 52.7%）收到远端
  `connection reset by peer` 后失败，deploy waiter 随即以状态 42 停止；bounded journal 和路径检查确认没有运行部署控制器、没有
  Accepted state。两个 transient units 已于 `17:16` 重新创建，Docker 复用原断点，并在 35 秒复测中增长到 `138853066` bytes；
  随后进一步收敛为 `dailyenergy-e012-migration-pull-retrying.service`，配置 `Restart=on-failure`、`RestartSec=30s`，以后连接重置会
  自动复用缓存续传；`dailyenergy-e012-deploy-after-retrying-pull.service` 仅在精确摘要可 inspect 后执行部署，并在 pull unit
  不再 `active/activating` 时以状态 42 fail closed。没有现场 build、没有公网端口变更、尚未写入 Accepted release state；
- **首次真实部署与新阻断**：migration 精确摘要于 `2026-08-10T19:28+08:00` 完成；自动部署首次在 `pull` 阶段失败，诊断确认缺少
  PostgreSQL 18 与 Redis 8 基础镜像且 Docker Hub 直连 443 超时。按腾讯云轻量服务器官方配置加入内网
  `https://mirror.ccs.tencentyun.com`，经 `dockerd --validate`、Docker 重启和配置回读后，两类基础镜像均按 manifest 摘要完成；七类镜像
  digest 全部匹配。相同 candidate 合法重放越过 pull 后在 `stateful-ready` fail closed；Redis 健康，PostgreSQL/依赖桩未启动，migration
  未执行，Accepted state 未写入，监听端口仍只有 SSH。脱敏重放取得 Compose 2.40.3 原始错误：`read_only: true` 服务只支持 `file`
  secret，现有 `environment` source 无法注入。修复限定为把 root-only 源值原子 materialize 到
  `/srv/dailyenergy/runtime-secrets/<release_id>`，使用闭合文件集、目标 UID/GID `0400`、相同 release 漂移拒绝与无密钥子进程环境；
- **首次失败候选替换合同**：真实主机 operation `fc6dc204-140a-4004-bc88-2a051032db31` 已完成 `preflight`/`pull` 并失败停在
  `stateful-ready`，`migration_applied=false`、`migration_verified=false` 且没有 Accepted state；新修复会产生不同 release ID，因此控制器增加严格的 pre-migration initial replacement：新 candidate 先通过 preflight/file secret
  materialization，再为旧 `operation_id` 写入含失败阶段和 replacement digest 的 `SUPERSEDED_BEFORE_MIGRATION` receipt，随后才清旧 pending 并开始
  新 operation。active phase 已进入 migration、任一 migration checkpoint 为 true 或已有 Accepted state 时继续 fail closed，禁止人工删除 state；
- **真实 file secret 兼容性证明**：在同一 DEV Docker 29.1.3 / Compose 2.40.3 上，使用现有 Redis 精确摘要运行一次性
  `read_only: true`、UID/GID 999、无真实值的 file-secret probe，容器成功读取 `0400` 合成文件并以 0 退出；Compose 同时警告声明的
  `uid/gid/mode` 会被忽略，证明宿主 materializer 必须预设实际 owner/mode。临时容器、网络、合成文件和目录已清理；旧失败候选遗留的
  无端口 Redis 容器已停止，PostgreSQL/依赖桩未运行，等待新候选；
- **修复 PR Gate**：提交 `cde89f13e2a26f4fa08e0379e0b70b6ec2c2e5aa` 已推送到草稿 PR #127；固定 Ubuntu CI
  [run #31401247915](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31401247915) 的 9 个 automated lane、supply-chain 与聚合 Gate
  共 11/11 SUCCESS，补齐本机无法执行的 Linux `flock` 证据；
- **规范确认与合并批准**：用户于 2026-08-10 明确接受 Accepted 部署规范中的 release-scoped file secret materialization 与
  `SUPERSEDED_BEFORE_MIGRATION` 首次失败候选替换合同，并批准合并 PR #127；
- **PR #127 合并与再发布**：接受记录提交 `31d0e66d8ccdaea04d863f1e55f7f2d130910a32` 的固定 Ubuntu CI
  [run #31403160907](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31403160907) 为 11/11 SUCCESS，人工 merge receipt 为
  `CI_MANUAL_MERGE_GATE_OK:pr=127:head=31d0e66d8ccdaea04d863f1e55f7f2d130910a32:run=31403160907:checks=11`；PR 于
  `2026-08-10T15:25:52Z` squash 合并为 `6c597fa85d383386bdd257388ce3166bb6d8bcfb`，main CI
  [run #31403542958](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31403542958) 11/11 SUCCESS；publication
  [run #31403819687](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31403819687) 成功生成 source-free bundle
  `dev-6c597fa85d38-31403819687-1`，双端离线校验均为 `files=16`、`production_eligible=false`；
- **新候选安装与镜像收敛**：使用既有 `dev-secret-v1`、`dev-cos-credential-v1`、`dev-cos-config-v2` 安装 candidate
  `devr-6c597fa85d38-702dc533a82eef74e10d230a`、generation `1`；第一次重放在 pull 阶段因三个 GHCR digest 尚未落盘而 fail closed。
  用户于 2026-08-11 明确授权临时使用本机 HTTP proxy 中转 GHCR TLS 流量；端口只通过 SSH 绑定服务器 loopback，TLS verify PASS，认证文件只在服务器本地读取、未输出 token。五类应用镜像最终均按 manifest `RepoDigest` 精确匹配；两个临时转发已关闭，约 2.2 GB 镜像归档与新候选传输目录已删除，临时 `skopeo` 及 5 个自动依赖已按 dry-run 清单卸载，Docker/Compose 与精确镜像复核正常；
- **真实 stale secret bind 阻断**：同一 candidate 再重放越过 pull 后在 `stateful-ready` fail closed；operation
  `410abc67-fb78-44fa-b823-69d6d162e3c7` 只完成 preflight/pull，`migration_applied=false`、`migration_verified=false`，没有 Accepted state。
  PostgreSQL 日志仅报告 `/run/secrets/postgres_password` 不存在；现有容器 `working_dir` 仍指向上一 candidate
  `devr-7582e3c51238-101ee4bf43be64a5ef17f2f4`，而上一与当前 Compose service hash 同为
  `c8eb6b019af4faf00c3c2b75d620208aa4f6f52d494f1c78af0437dd26c44d49`，所以 Compose 复用了没有当前 release bind 的旧容器。
  使用当前已签名 bundle 单独 `--force-recreate --no-deps postgres` 后，实际 mount source 指向当前 release-scoped secret、owner/mode 为
  `999:999 0400`，PostgreSQL 立即 healthy，证明根因不是 secret value 或 materializer，而是服务收敛命令缺少强制重建；
- **force-recreate 修复边界**：所有 Compose `up` 服务收敛阶段必须显式 `--force-recreate`，使 deploy/rollback/recover-current 不会因 top-level
  file secret source path 未进入 service hash 而复用旧 release 容器；不改变 phase 顺序、数据卷、migration/rollback 合同、镜像 digest 或 production Gate。
  精确命令合同测试已通过；用户已接受 Accepted 部署规范修订，真实重新 publication 尚待合并后执行；
- **force-recreate PR 与规范确认**：修复提交 `734b092ce6511fb686b0b52e53a3cb85149f5d8e` 已推送并创建
  [PR #128](https://github.com/WeiHan1996/DailyEnergy/pull/128)；review head `885e38d7671937b647befadb82c9e802e1df752b` 的固定 Ubuntu CI
  [run #31412595534](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31412595534) attempt 2 为 11/11 SUCCESS；attempt 1 仅因 npm registry
  下载超时失败，同一 head 未改代码重跑后通过。用户于 2026-08-11 明确接受强制重建规范修订并批准合并 PR #128；
- **PR #128 合并与 main 验证**：接受记录 head `92ece6883fbb27f7fd58324715885a463fff3520` 的固定 Ubuntu CI
  [run #31449151810](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31449151810) 为 11/11 SUCCESS，人工 merge receipt 为
  `CI_MANUAL_MERGE_GATE_OK:pr=128:head=92ece6883fbb27f7fd58324715885a463fff3520:run=31449151810:checks=11`；PR 于
  `2026-08-11T01:28:48Z` squash 合并为 `7d30e840294413a9169fc83bf3c5c953a106ff65`，本地 `main` 与 `origin/main` 已快进核对一致，合并后 main CI
  [run #31449423856](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31449423856) 为 11/11 SUCCESS；
- **PR #128 精确 publication 与安装**：手动 publication
  [run #31450010969](https://github.com/WeiHan1996/DailyEnergy/actions/runs/31450010969) 从精确 main
  `7d30e840294413a9169fc83bf3c5c953a106ff65` 成功生成五类 `linux/amd64` digest 和 source-free bundle；artifact
  `9086063301`、bundle `dev-7d30e8402944-31450010969-1` 保留至 `2027-08-11T01:40:12Z`，本地与服务器传输后校验均为
  `files=16`、`production_eligible=false`。使用既有 `dev-secret-v1`、`dev-cos-credential-v1` 与 `dev-cos-config-v2`
  原子安装 candidate `devr-7d30e8402944-d3c55bed18694f657bd4f6fe`、generation `1`；旧 operation
  `410abc67-fb78-44fa-b823-69d6d162e3c7` 满足严格 pre-migration replacement 并已形成
  `SUPERSEDED_BEFORE_MIGRATION` receipt；
- **本轮 GHCR 精确镜像收敛**：中国大陆直连在 `admin` 最后一层再次停滞；按用户已有授权启动本机 Clash Verge，经 SSH reverse forward
  仅绑定服务器 `127.0.0.1:17897`，GHCR 返回预期 `401` 且 TLS verify 为 `0`。临时 `skopeo` 使用服务器 root-only Docker auth
  读取凭据但未输出 token，以 `--all --preserve-digests` OCI archive 导入五个完整 image index；Docker 对五个 manifest `RepoDigest`
  均精确匹配。清理临时 tag 时曾暴露 Docker index 引用语义：移除唯一 tag 会使未被容器引用的 migration/proxy index 不可 inspect；两者已立即
  重新导入并保留本地 `e012-index` tag。最终严格复核 `EXACT_IMAGES=5/5`、`RETAINED_INDEX_TAGS=2/2`；2.1 GB 临时归档、传输目录、
  `skopeo` 与同批 5 个依赖均删除，临时 reverse forward 已关闭，服务器 `17897/18080` 无监听；
- **首次 post-migration API 阻断**：candidate 的受控 18 阶段发布 operation
  `9447435d-eef7-448b-ab16-3fcee11acb4f` 已通过 `preflight`、`pull`、`stateful-ready`、`maintenance-on`、`worker-drain`、
  `migration`、`worker-interactive` 与 `worker-background`，并记录 `migration_applied=true`、`migration_verified=true`；API 容器随后以稳定
  `DEPLOY_CONFIG_FINGERPRINT_MISMATCH` 启动失败码退出，operation 保持 `FAILED`/`active_phase=api`，没有写入
  `release-state.json` 或 Accepted release。PostgreSQL、Redis、dependency stub 与两个 Worker 保持 healthy，API exited；未开放公网端口；
- **根因与修复边界**：publication runtime evidence 使用 `image_set_id=dev-*` 运行 server image fingerprint probe，安装器生成最终
  `release_id=devr-*` 后却原样复制该 API deploy fingerprint；应用算法把 release ID 纳入 closed config fingerprint，因此真实启动必然 mismatch。
  修复改为以最终 materialized release ID 复算 manifest API fingerprint，同时分别验证 publication evidence 与最终 manifest 的 ID 绑定，并增加
  publication fingerprint reuse 拒绝测试。因为故障发生在 migration 已核验后，Accepted 合同禁止新 candidate 覆盖 dirty initial operation；不得
  手改 manifest/release env/operation 绕过。ADR-0007 已允许 synthetic DEV 整体重建，但永久删除 PostgreSQL/Redis volume 仍需项目所有者明确授权；
- **修复已合并**：[PR #129](https://github.com/WeiHan1996/DailyEnergy/pull/129) 的最终 head
  `1c2370177365921aa591c7f544f2c85ed7b7426a` 已由固定 Ubuntu run `31454973835` 证明 11/11 checks 全部成功，并以精确 head guard squash
  合并为 `ba1edac2303622d5b5417f23286c72c27eab5d45`；审计 receipt 记录于
  [PR comment](https://github.com/WeiHan1996/DailyEnergy/pull/129#issuecomment-5248613717)。merge SHA 的 main run `31455208851` 也已 11/11 PASS；
- **重新 publication 与安装**：对精确 main merge SHA `ba1edac2303622d5b5417f23286c72c27eab5d45` 手动触发
  `Publish DEV images`，run `31458470966` 已成功；artifact `9088988161`、name
  `dev-deployment-bundle-ba1edac2303622d5b5417f23286c72c27eab5d45-31458470966-1`、digest
  `sha256:50d37af39f73b89cfefa71514ee8a74576dd797c997f1ed1babb9eb557b6082f` 已在本机与服务器双端通过 source-free bundle 和 publication evidence
  校验。使用既有 `dev-secret-v1`、`dev-cos-credential-v1`、`dev-cos-config-v2` 原子安装 candidate
  `devr-ba1edac23036-948f7a62e227544c8a88993c`、generation `1`，首次安装 `installed=true`，幂等重放 `installed=false`；
- **精确镜像就绪**：新 candidate 的五个完整 image index 已导入 Docker 并保留本地
  `e012-index-ba1edac` tag；逐项 `RepoDigest` 精确匹配 admin
  `sha256:7fde70816c2caa540804631e3af9aa03452bb97374a7a4d666974daa85981fa7`、migration
  `sha256:144e9ec4a819b46d2b91ad159a77029a7fd6550393813e12bfa13c446f8b7355`、proxy
  `sha256:b7845b83b613adab72d45b307f083ad6e7e9642991e08c7b0d79fde66babf47f`、server
  `sha256:0a1f21fb328f298178dfd4bc71239453b9c45189b8b297c44b3821e965982520`、stub
  `sha256:bc3ddb72836f2951466878fb2f596bbf67e7455be880080184b810281a099a6e`。下载使用的 loopback-only CONNECT proxy、SSH reverse forward、OCI 归档、共享缓存、短期签名 URL、临时脚本、`skopeo` 与同批 5 个依赖均已清理；本机 `18080` 与服务器 `17897` 无监听；
- **受控重建删除预览**：Accepted release state 仍不存在；dirty operation
  `9447435d-eef7-448b-ab16-3fcee11acb4f` 保持 `FAILED`/`active_phase=api`，已完成
  `preflight`、`pull`、`stateful-ready`、`maintenance-on`、`worker-drain`、`migration`、
  `worker-interactive`、`worker-background`，且 `migration_applied=true`、`migration_verified=true`。
  当前 permanent data 删除目标严格限定为 `dailyenergy-dev_postgres_data` 与
  `dailyenergy-dev_redis_data`；Compose 容器/网络会随空环境重建而移除后重建，installed bundles 和五个精确镜像在重建成功前保留；
- **重建授权与执行结果**：用户于 2026-08-11 明确批准永久删除 `dailyenergy-dev_postgres_data` 与
  `dailyenergy-dev_redis_data`、归档 dirty operation 后从空 deployment state 重建 synthetic DEV。执行前再次核对没有 Accepted state、operation
  `9447435d-eef7-448b-ab16-3fcee11acb4f`、6 个容器、11 个网络和仅上述两个 volume；Compose 环境及两个 volume 已删除，卷内 synthetic 数据不可恢复。
  完整旧 deployment state 与无 secret snapshot 已移至 root-only
  `/srv/dailyenergy/reset-evidence/e012-reset-9447435d-eef7-448b-ab16-3fcee11acb4f`，checksum、空 state、零容器和零 volume 复核通过；installed bundles、root-only secret/config 与 5 个镜像均保留；
- **重建后真实 TLS 阻断**：新 candidate operation `1b3431ea-5b44-4fd9-85f8-4434224a503d` 已通过
  `preflight`、`pull`、`stateful-ready`、`maintenance-on`、`worker-drain`、`migration`、`worker-interactive`、`worker-background`、`api`、`admin` 与
  `worker-restricted`，`migration_applied=true`、`migration_verified=true`；`tls-ingress` 因 proxy 容器
  `[FATAL tini] exec caddy failed: Operation not permitted` 停止，仍没有 Accepted state。无网络一次性真实探针证明 baseline 与仅
  `no-new-privileges` 均可执行、`cap_drop: ALL` 与完整 hardened 组合均以 255 失败；镜像内 `/usr/bin/caddy` 精确携带
  `cap_net_bind_service=ep`，复制为无文件能力的同一二进制后在 UID/GID 1000、`cap_drop: ALL`、`no-new-privileges` 下执行成功；
- **修复边界**：DEV 监听 8443/8444，不需要低端口 capability；保持非 root、只读根文件系统、`cap_drop: ALL` 与
  `no-new-privileges`，在 `e012-proxy` 构建阶段复制替换 Caddy 二进制以移除文件能力，并在 publication workflow 中按真实 hardened 参数执行
  `caddy version`。不得在服务器加 capability、手改 Compose 或覆盖 immutable digest；
- **规范确认与合并批准**：用户于 2026-08-11 明确接受上述 TLS proxy 文件能力移除与 publication hardened runtime probe，并批准合并
  PR #130；review head `9fa70fb2ce980775278f2c7a9882e26656ac6a95` 的固定 Ubuntu run `31474271915` 已 11/11 SUCCESS；
- **PR #130 合并与 main 验证**：Accepted 记录 head `72394439bddb6a8af79361d83b8cf6fb6554dd9b` 的固定 Ubuntu run
  `31475148571` 为 11/11 SUCCESS；PR #130 已于 `2026-08-11T08:56:32Z` squash 合并为
  `a2fdc184e16bfbb0b2ed882ab314973127213ce7`，合并后的 main run `31475462454` 也已 11/11 SUCCESS，本地 `main` 与
  `origin/main` 已快进核对一致；
- **合并后 publication 新阻断**：精确 merge SHA 的 `Publish DEV images` run `31475655703` 已完成五类 image build/push，但在
  `Collect immutable image runtime evidence` 以 `DEV_RUNTIME_IMAGE_PROBE_INVALID:server` 失败，后续 hardened Caddy probe、bundle
  validation 与 artifact upload 均未执行，因此没有新的 qualified deployment bundle，也没有安装或改变 DEV 主机。失败时间精确接近 30 秒；
- **publication 根因与修复边界**：runtime evidence 把 server 精确 digest 的首次 registry pull 包含在 30 秒 `docker run` probe 中，
  把网络下载超时误分类为运行时证据不合格。修复先单独 `docker pull` 经过严格校验的
  `ghcr.io/weihan1996/dailyenergy-server@sha256:*`，使用 180 秒 pull timeout 与稳定
  `DEV_RUNTIME_IMAGE_PULL_FAILED:server`；随后 probe 保持 30 秒、`--network none`、只读文件系统并增加 `--pull never`，确保运行证据不再
  隐式访问 registry。不得接受 mutable tag、延长真正 probe 或绕过 runtime evidence；
- **后续传输路径**：用户提出服务器直连下载较慢时优先由本机下载再上传。新的 qualified bundle 生成后，应用镜像计划按 manifest 精确 digest
  在本机下载和校验，经 SSH/SCP 传到服务器，导入后再次核对 `RepoDigest`，最后清理双端临时 archive；不使用 mutable tag，也不把本机代理或
  registry credential 固化到服务器；
- **PR #131 合并批准**：最终 review head `10b48012ff0db77cb2ad972b310796b69bfc1eb0` 的固定 Ubuntu run `31477768595` 已 11/11
  SUCCESS；用户于 2026-08-11 明确确认 pull/probe 解耦修复并批准合并。批准不授权跳过 final head Gate、改变服务器或复用旧的 destructive reset 授权；
- **PR #131 合并与 main 验证**：批准记录最终 head `66766a26c57bb2f81e482bbc3c429c6d637cc4b5` 的固定 Ubuntu run
  `31478477984` 为 11/11 SUCCESS；机器 receipt 为
  `CI_MANUAL_MERGE_GATE_OK:pr=131:head=66766a26c57bb2f81e482bbc3c429c6d637cc4b5:run=31478477984:checks=11`，并已写入
  [PR 审计评论](https://github.com/WeiHan1996/DailyEnergy/pull/131#issuecomment-5251497273)。PR 于 `2026-08-11T09:41:43Z`
  以精确 head guard squash 合并为 `a03993d2018ee212a1c92169cab8795452c4251d`；本地 `main`、`origin/main` 已快进核对一致，merge-main run
  `31478855276` 为 11/11 SUCCESS；
- **修复后 publication 与安装**：精确 merge SHA 的 `Publish DEV images` run `31479089447` 在 `5m27s` 内通过五镜像 build/push、独立 server
  digest pull、两个 `--pull never` runtime fingerprint probe、hardened Caddy capability probe、supply/catalog/runtime 绑定、source-free bundle
  构建与验证。artifact `9096601945`、name
  `dev-deployment-bundle-a03993d2018ee212a1c92169cab8795452c4251d-31479089447-1`、digest
  `sha256:da320548dee9118d1fded3c222d3312e57201f7ee85a5f4c5bd1a3c03a7b9787` 保留至 `2027-08-11T09:44:51Z`；本机与服务器传输后均验证
  `image_set=dev-a03993d2018e-31479089447-1`、`files=16`、runtime fingerprints `5`、supply evidence `6`、`production_eligible=false`，无 symlink。
  使用既有 `dev-secret-v1`、`dev-cos-credential-v1` 与 `dev-cos-config-v2` 原子安装 candidate
  `devr-a03993d2018e-0e738aec3f7c3b7a6197c896`、generation `1`、`installed=true`；服务器 48 KB 临时传输副本已删除，installed bundle 与 GitHub
  artifact 保留，尚未启动新 candidate 或改变数据库；
- **本机中转与服务端镜像复核**：项目所有者已为本机 GitHub token 增加 `read:packages`，凭据仅通过 stdin 登录 Docker，未输出或复制 token。
  Apple Silicon 本机使用显式 `--platform linux/amd64` 按 manifest 五个精确 digest 下载并逐项复核 `RepoDigest`/平台；五镜像导出为
  `638471680` 字节临时 archive，SHA-256 为
  `2535c11be6037f2a144952489be85f1cec3713820c4cf91a6ba843bbecfa50c7`。SSH 上传后服务器复算完全一致，`docker load` 复用全部层，再按
  精确 digest 仅补拉 registry manifest；admin、migration、proxy、server、stub 均通过 `RepoDigest` 与 `linux/amd64` 复核（`5/5`）。双端临时
  archive 和本机临时 tag 已删除，服务器临时 transfer tag 保留到本轮重建结束；immutable bundle、精确 digest 镜像和 root-only credential 均保留；
- **新的受控重建删除预览**：只读复核确认 `release-state.json` 不存在；dirty operation
  `1b3431ea-5b44-4fd9-85f8-4434224a503d` 为 `FAILED`/`DEPLOY`、`active_phase=tls-ingress`、
  `failure_code=E012_DEPLOY_PHASE_FAILED`，已完成 `preflight` 至 `worker-restricted` 的前 11 阶段，且
  `migration_applied=true`、`migration_verified=true`。失败 target
  `devr-ba1edac23036-948f7a62e227544c8a88993c` 与新 candidate
  `devr-a03993d2018e-0e738aec3f7c3b7a6197c896` 的 immutable bundle 均存在。完整 DEV Compose 重建会停止并移除 9 个现有容器
  `tls-proxy`、`worker-restricted`、`admin`、`api`、`worker-background`、`worker-interactive`、`postgres`、`redis`、
  `dependency-stub`，移除并重建 12 个 Compose network；唯一 permanent data 删除目标严格限定为
  `dailyenergy-dev_postgres_data` 与 `dailyenergy-dev_redis_data`，其中 synthetic 数据永久不可恢复；
- **第二次重建授权与执行结果**：项目所有者于 2026-08-11 基于上述精确预览明确批准完整 synthetic DEV 重建并永久删除两个指定 volume。执行脚本在
  release `flock` 内再次验证 operation、闭合的 9 容器/12 网络/2 volume 集合、两个 bundle 与五个 `linux/amd64` 精确镜像；完整旧 state 和
  无 secret Compose snapshot 已归档到 root-only
  `/srv/dailyenergy/reset-evidence/e012-reset-1b3431ea-5b44-4fd9-85f8-4434224a503d`，checksum manifest SHA-256 为
  `8a3c6943089be1f6d6a06b2ee98f1fb74a7365c3b6b5b55370d07aa2106111ef` 且复核通过。9 个容器、12 个网络和
  `dailyenergy-dev_postgres_data`/`dailyenergy-dev_redis_data` 已删除，卷内 synthetic 数据不可恢复；空 state/零 Compose 资源、两个 bundle 与五个镜像
  保留均复核通过，一次性脚本已从双端删除；
- **重建后 database smoke 阻断**：新 operation `1fe81f82-cdbb-400b-b509-a183e138ae04`、target manifest
  `dcf8c3658997340d4cc73f1a92461f1483444b1220173cb31bdda5195b6583dd` 已通过前 14/18 阶段，包括 migration 两个 checkpoint、完整服务收敛、
  hardened TLS、health 与 COS object smoke；9 个运行容器均 healthy。第 15 阶段 `smoke-safety` 稳定失败，仍无 Accepted state。单独复现证明
  `docker compose run database-smoke safety` 覆盖 Compose service 的 `node tooling/deployment/database-smoke.mjs` 默认 command；Node 官方入口因而
  尝试加载 `/workspace/safety` 并返回 `MODULE_NOT_FOUND`，不是数据库、权限或服务器故障；
- **修复与自动证明**：部署控制器改为对 Safety、Owner、Deletion 三个 smoke 显式执行
  `node tooling/deployment/database-smoke.mjs <mode>`；跨 Compose 合同新增逐项断言，确保 phase 只能附加在完整 service command 后。定向
  `tests/deployment/dev-compose.test.mjs` 为 `7/7` PASS；changed Gate 自动扩大为 full，E-012 task Gate 也已执行，两者 deployment suite 均为
  `40/42`，仅两个失败严格限定为 macOS 缺少 Linux `flock`，其余格式、Lint、类型、架构、codegen、contracts、agent、CI policy、数据库与新增断言
  均通过，不将结果冒充为 PASS；固定 Ubuntu review head `6ec99a72345dfedb0d1982e7dfd8801767ddd543` 的 PR CI run
  `31483290015` 已 11/11 SUCCESS，补齐 Linux `flock` 权威证据。不得手改已安装 bundle 绕过；
- **PR #132 批准、合并与 main 证明**：项目所有者于 2026-08-11 明确确认修复并批准 squash 合并；最终 head
  `f70e05daf1420fb8fac773376fa3b90ef808a30f` 的固定 Ubuntu run `31483551073` 为 11/11 SUCCESS，机器 receipt 为
  `CI_MANUAL_MERGE_GATE_OK:pr=132:head=f70e05daf1420fb8fac773376fa3b90ef808a30f:run=31483551073:checks=11`，审计记录在
  [PR comment](https://github.com/WeiHan1996/DailyEnergy/pull/132#issuecomment-5252959644)。PR 已 squash 合并为
  `372b3db99b3b4e14a3d5b10f4907232f03b7a646`，merge-main run `31489984647` 也为 11/11 SUCCESS；
- **新 publication 与 bundle 安装**：对精确 merge SHA 触发的 `Publish DEV images` run `31490307068` 在 `5m30s` 内完成五镜像构建、
  runtime/supply evidence、hardened Caddy probe 与 source-free bundle Gate。artifact `9100900114`、name
  `dev-deployment-bundle-372b3db99b3b4e14a3d5b10f4907232f03b7a646-31490307068-1`、digest
  `sha256:9a3a29a6117f656ed61441fcb130b3dce609c719e373d68c6f197b887849ae4f` 保留至 `2027-08-11T12:14:57Z`；本机和服务器均通过
  `image_set=dev-372b3db99b3b-31490307068-1`、runtime `5`、supply `6`、bundle files `16`、无 symlink/源码与
  `production_eligible=false` 校验。使用 `dev-secret-v1`、`dev-cos-credential-v1`、`dev-cos-config-v2` 原子安装 root-only candidate
  `devr-372b3db99b3b-78988352a735ec2d1a6ea69b`，generation `1`、manifest SHA-256
  `ecde45be5c5a04808932d8c05cf3a0ffc66c57d8b2f48304f0dbf0c89f87acba`；临时上传副本已删除；
- **新五镜像本机中转与服务器复核**：按新 manifest 精确 digest 在本机下载并验证 `linux/amd64`，五镜像导出为
  `638471168` 字节 archive、SHA-256 `6a856583614b9add6c34e8fb9775002844e1685c53145e82b062d5160953d12d`，以约
  `4.97 MiB/s` 经 SSH 中转。服务器复算完全一致后 `docker load`，再只读取 registry manifest 绑定正式 digest；admin、migration、proxy、server、stub
  均通过 `RepoDigest` 与平台 `5/5` 复核。双端临时 archive 和本机 transfer tag 已删除；服务器 transfer tag 保留到重建结束；
- **第三次受控重建删除预览**：只读复核确认 `release-state.json` 不存在；dirty operation
  `1fe81f82-cdbb-400b-b509-a183e138ae04` 仍为 `FAILED`/`DEPLOY`、`active_phase=smoke-safety`、
  `failure_code=E012_DEPLOY_PHASE_FAILED`，已完成前 14/18 阶段，且 `migration_applied=true`、`migration_verified=true`、
  `from_current=null`、`recovery_catalog=null`。失败 target manifest SHA-256 为
  `dcf8c3658997340d4cc73f1a92461f1483444b1220173cb31bdda5195b6583dd`；新 candidate、五个正式 digest 镜像和 root-only secret/config 均已就绪。
  完整重建会停止并移除 9 个健康容器 `admin`、`api`、`dependency-stub`、`postgres`、`redis`、`tls-proxy`、
  `worker-background`、`worker-interactive`、`worker-restricted`，移除并重建 13 个 Compose network
  `admin_api`、`api_data`、`api_external`、`background_data`、`background_external`、`dev_ingress`、`fault_control`、
  `interactive_data`、`interactive_external`、`migration_data`、`object_external`、`restricted_data`、`restricted_external`；唯一永久数据删除目标严格限定为
  `dailyenergy-dev_postgres_data` 与 `dailyenergy-dev_redis_data`，其中 synthetic 数据不可恢复。新的 root-only 归档目标
  `/srv/dailyenergy/reset-evidence/e012-reset-1fe81f82-cdbb-400b-b509-a183e138ae04` 已确认不存在；
- **当前阻塞与解锁条件**：当前 operation 已进入并核验 migration，不能普通重放或手动清理；只有项目所有者针对上述精确
  9 容器/13 网络/2 volume 集合重新明确批准完整 synthetic DEV 重建，才可在 release `flock` 内归档 dirty evidence、删除完整 Compose 环境及两个卷，
  再从空 deployment state 发布新 candidate。此前重复发送的旧重建批准发生在新 artifact/镜像/预览形成前，未执行且不得复用；
- **下一动作**：取得第三次精确 destructive reset 授权后执行受控重建；随后完成 18 阶段 acceptance、幂等重放、rollback/redeploy 证据并关闭 E-012；
- **下一任务**：E-012 完成后才评估 E-013；当前不提升其它任务。

## 6. 验证与环境说明

- publication runtime evidence 的定向合同 `2/2` PASS，完整 publication 文件为 `7/8`：新增逻辑已证明只接受 server 精确 GHCR digest；pull
  独立使用 180 秒 timeout；真正 probe 使用 `--pull never` 并保持 30 秒 hardened boundary；mutable tag 与 pull failure 均返回稳定错误。
  `pnpm agent:validate --mode=changed --task=E-012` 自动提升为 full，`pnpm agent:validate --mode=task --task=E-012` 也已执行；两者均通过格式、
  Lint、类型、架构、codegen、contracts、agent、CI policy、数据库与新增断言，deployment suite 为 `39/41`。仅两项失败严格限定为本机 macOS
  缺少 Linux `flock`，不将结果伪装为 PASS；固定 Ubuntu PR #131 review head `24743a3dd12cc0c191295b1d42009baa2f2b1ef9` 的 run
  `31477403956` 与最终 review head `10b48012ff0db77cb2ad972b310796b69bfc1eb0` 的 run `31477768595` 均已 11/11 SUCCESS，补齐 Linux
  权威自动证据；
- 本轮 TLS proxy 修复的 Compose/Caddy/host 定向合同 `7/7` PASS，publication workflow 合同 `1/1` PASS；真实主机无网络探针分别证明原始镜像在
  baseline 与仅 `no-new-privileges` 下可执行、在 `cap_drop: ALL` 下因 `cap_net_bind_service=ep` 失败，并证明复制后的无文件能力二进制在完整
  hardened 边界下成功执行。`pnpm agent:validate --mode=changed --task=E-012` 自动提升为 `security/full`，
  `pnpm agent:validate --mode=task --task=E-012` 也已执行；两者均通过格式、Lint、类型、架构、codegen、contracts、agent、CI policy、数据库及新增断言，
  deployment suite 均为 `38/40`，仅两个失败严格限定为本机 macOS 缺少 Linux `flock`，不将结果伪装为 PASS；固定 Ubuntu PR #130 review head
  `9fa70fb2ce980775278f2c7a9882e26656ac6a95` 的 run `31474271915` 已 11/11 PASS，补齐 Linux `flock` 权威自动证据；
- 本轮 publication/install/镜像就绪状态更新执行 `pnpm agent:validate --mode=changed --task=E-012`，结果为
  `PASS`、rule=`STATUS_DOCS_TARGETED`、executed=`2`；随后执行完整
  `pnpm agent:validate --mode=task --task=E-012`，结果保持 `FAIL 38/40`，两项失败仍严格限定为本机 macOS 缺少 Linux
  `flock`，其余 deployment、publication fingerprint、配置、类型、架构、contracts、agent 与 policy Gate 通过，不将该结果冒充为 task PASS；
- 最终 release 指纹修复的精准 Node 用例与 DEV preflight 共 `7/7` PASS；新增独立 materialized `devr-*` fingerprint、publication
  fingerprint reuse 拒绝与 runtime evidence 漂移拒绝断言均已执行。`pnpm agent:validate --mode=changed --task=E-012` 自动升级 full，格式、
  ESLint、类型、架构、codegen、contracts、agent、数据库及新增测试通过后，deployment suite 为 `38/40`；
  `pnpm agent:validate --mode=task --task=E-012` 结果同为 `38/40`。两项失败均限定为 macOS 缺少 Linux `flock`，不伪装为代码失败或 PASS；
  固定 Ubuntu PR #129 最终 head `1c2370177365921aa591c7f544f2c85ed7b7426a` 的 run `31454973835` 已 11/11 PASS；
  squash merge `ba1edac2303622d5b5417f23286c72c27eab5d45` 的 main run `31455208851` 也已 11/11 PASS；
- 本轮 stale secret bind 证据已在真实 DEV Compose 2.40.3 上复现：未强制重建时容器继续绑定上一 bundle/无当前 secret mount，使用当前签名 bundle
  `--force-recreate` 后 PostgreSQL 实际 bind source、预设 owner/mode 与 health 全部正确；新增
  `T-E012-DEPLOY-001 force-recreates every service convergence phase` 精确合同测试 `1/1` PASS。macOS 定向 release/Compose suite 为
  `24/25`；changed Gate 自动扩大为 full、task Gate 均执行到 deployment suite 并为 `37/39`，两个失败仍是本机缺少 Linux `flock`，不伪装为 PASS；
  格式、ESLint、类型、架构、codegen、合同、数据库静态检查与新增测试均通过，固定 Ubuntu PR CI 将作为完整权威自动证据；
- 本轮真实服务器已证明 Docker Compose 2.40.3 对 `read_only: true` + `environment` secret fail closed；file materialization 修复的真实
  Compose merged-config policy、DEV overlay 负例、materializer 权限/漂移/无密钥命令环境、pre-migration initial replacement 与
  migration-active replacement rejection 用例均通过。`pnpm agent:validate --mode=changed --task=E-012` 自动升级 `security/full`，格式、全仓
  ESLint、架构、codegen、contracts、agent、数据库等前置 Gate 通过后，在 deployment suite 停止；task Gate 结果相同。完整 deployment suite
  为 `36/38`，仅两个失败因 macOS 没有 Linux `flock`，固定 Ubuntu PR CI 将作为合并前权威自动证据；
- PR #126 合并后的 main CI、publication、artifact 双端 digest 校验和 root-only 原子安装均通过；真实安装后的全部文件/目录 owner、mode
  与 hardlink Gate 满足预期；GHCR 只读身份已由管理员交互式配置，四类不可变镜像摘要已落盘，migration 拉取与后续部署由主机 transient
  systemd units 持续执行；
- owner 规范化顺序合同 `1/1`、目标 ESLint、Prettier、CI policy 与 `git diff --check` 通过；本机完整 E-012 code Gate 已运行并保持
  `FAIL`，deployment suite 为 `34/36`，两个失败均限定为 macOS 缺少 Linux `flock`，新增 owner 合同通过；合并前以固定
  `ubuntu-24.04` PR CI 为权威自动证据。真实主机证据已证明 transfer owner 与 root-only 安装目标不同，失败未留下 candidate bundle
  或 Accepted release state；
- Buildx attestation 修复的精确工作流合同用例、Prettier、CI policy 与 `git diff --check` 通过；本机完整 E-012
  security Gate 已运行并保持 `FAIL`，失败仍限定为 macOS 缺少 Linux `flock` 导致 deployment suite `33/35`，
  Buildx action/driver 合同断言本身通过；合并前以固定 `ubuntu-24.04` PR CI 为权威自动证据；
- publication 权限修复的精确工作流合同用例通过，Prettier 与 `git diff --check` 通过；本机完整 E-012
  security Gate 已运行并保持 `FAIL`，唯一失败仍是 macOS 缺少 Linux `flock` 导致 deployment suite `33/35`，
  权限合同断言本身通过；合并前以固定 `ubuntu-24.04` PR CI 为权威自动证据；
- 第三轮新增的 seed failure、checkpoint loss、state→receipt 重建和重复 release receipt 场景 `4/4` 通过；目标 ESLint、Prettier 与
  `git diff --check` 通过；DEV Compose/image/preflight 的 Windows 可执行子集 `15` 项通过，另 `1` 项只因 Windows 无 `process.getgid()` 未进入逻辑；
- 本轮私有 COS 决策与审核修复已进入 ADR-0007、部署规范、Runbook、任务状态和 `ReleaseManifestV1` 合同；PR 前一 head 定向
  deployment suite `31/31` 通过，覆盖 Caddy Host/SNI 一致性、source-free bundle
  build/verify、root-only 原子安装、首次 materialize、幂等 replay、篡改拒绝、顺序发布失败不落状态和
  dirty operation、`Accepted N → N+1 中途失败 → recover-current N`、唯一 rollback、v1→v2 配置/secret 引用轮换，以及
  root-only 外部值通过 service-specific Compose file secret 进入容器且 Docker/curl 子进程环境不含值；source registry 为
  `736 total / 170 COVERED / 566 PLANNED / 0 NA_WITH_REASON`，`git diff --check` 通过；真实 DEV
  主机的 root-only credential/config 权限、内网 DNS/TLS、最小 CAM 策略和 signed
  write/read/delete/delete-verification smoke 均通过，输出不含 secret 或对象内容；
- `pnpm agent:prepare E-012 --remote --deep` 在固定 Node `24.18.0`、pnpm `11.17.0` 与当前依赖上 PASS；Docker Linux 定向复核因 Docker Hub
  manifest 请求 EOF 未取得容器，未伪装为 PASS；
- `pnpm audit --prod` 返回无已知漏洞，`pnpm run ci:audit` 返回 `CI_AUDIT_OK:critical=0:high=0`；override 只把 `postcss` 的 nanoid 3.x
  解析从 `3.3.16` 提升到 GitHub advisory 指定的首个补丁版本 `3.3.17`；完整 workspace build `7/7` 成功，Admin bundle Gate 扫描 28 个静态文件通过；
- 正式 `pnpm agent:validate --mode=full --task=E-012` 返回 `FAIL`：在 format、workspace、config、ESLint、architecture、codegen、contracts 与 agent
  workflow 通过后，既有 Windows 路径处理把 migration 目录解析为 `D:\D:\Projects\...`，database static Gate 以 `ENOENT` 停止。该结果保持 FAIL；
  最终 head `79b2e8d` 的固定 Ubuntu run `31295404849` 为 11/11 SUCCESS，包含 nanoid override、数据库集成、队列集成、API/Admin E2E、
  resilience、deterministic AI、静态/合同/docs 与 supply-chain Gate；
- E-011 本地定向 CI policy `23/23`、registry
  `736 total / 155 COVERED / 581 PLANNED / 0 NA_WITH_REASON`、Agent workflow、目标 ESLint、
  format 与 diff Gate 均通过；
- 本机 Node 已为项目固定 `24.18.0`；Windows-only path/UID/flock 差异不改写为 PASS，固定 `ubuntu-24.04` GitHub run 是本 PR 的权威自动证据；
- 外部 lane 继续保持 `miniapp-conformance=INFRA_BLOCKED`、
  `ai-model-load-human=PENDING_EXPLICIT_AUTHORIZATION`、
  `manual-rc=MANUAL_EVIDENCE_PENDING`，没有被 E-011 自动化冒充为 PASS。

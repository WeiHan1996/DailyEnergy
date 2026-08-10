# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-10（DEV image publication 已获授权；首次运行因缺少 Checks 读取权限在构建前失败，正在最小修复）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-012 — 部署固定开发环境与可回滚发布流程
- **任务状态**：In Review
- **任务分支**：`agent/e012-publish-checks-permission`
- **当前 Issue**：[E-012 Issue #50](https://github.com/WeiHan1996/DailyEnergy/issues/50)
- **实现 PR**：[E-012 已合并 PR #121](https://github.com/WeiHan1996/DailyEnergy/pull/121)
- **发布修复 PR**：[E-012 草稿 PR #124](https://github.com/WeiHan1996/DailyEnergy/pull/124)
- **实现合并提交**：E-012 squash merge `3c00d952be6fa7e44aba683fc79fee4e1a1687fe`
- **Gate 结论**：`E012_IN_REVIEW / PR_MERGED / FIXED_LINUX_GATE_PASS / DEV_PUBLICATION_CHECKS_PERMISSION_REPAIR / PUBLIC_TLS_ICP_PENDING / PRODUCTION_STATEFUL_SERVICES_BLOCKED`

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
  保持宿主机 `root:root 0600`，部署控制器只在内存中将值交给 Compose，容器按服务以 `0400`
  secret mount 获取最小集合，值不进入命令参数、release env、Compose 解析结果或日志；
- **审核修复**：PR #121 的三项审核意见已修复：主机健康探针与 Caddy `localhost` Host/SNI 一致；部分发布失败会留下
  pending/dirty operation，并可显式 `recover-current` 收敛回当前 Accepted application/config/secret 与已验证兼容的
  catalog；安装入口必须接收受严格校验且不含值的 database/COS secret version 与 object config ref，使轮换生成并绑定
  新 release，而不是依赖代码常量；第一轮修复的本地部署 suite、registry、test policy、CI policy、ESLint、目标格式与 diff Gate 已通过；
- **第二轮审核修复**：release/install/deploy/rollback/recover-current 改用 Linux 内核 advisory `flock`，持锁进程退出或主机重启后不会被残留
  元数据文件永久阻塞；dirty operation 与 state→receipt 可恢复提交已进入代码，但复审又发现 migration 阶段内部副作用和 receipt 路径复用缺口；
- **第三轮审核修复**：migration 阶段拆为 prepare/migrate/seed/drift 子步骤，Prisma migrate 核验成功后原子记录 `migration_applied`，完整阶段通过后才记录
  `migration_verified`；checkpoint 落盘窗口丢失时用只读 state/candidate drift probe 判定实际 catalog，两个都不通过则保持 dirty 并 fail closed；每次
  operation 生成持久 UUID，receipt 内容和路径均绑定该 ID，同一 release 合法重复 deploy/rollback 不再碰撞。新增 seed failure、checkpoint loss、
  state→receipt 重建与 deploy N+1 → rollback N → 再 deploy N+1 场景；secret 仍只通过 root Compose 环境进入最小 mount，probe 不输出值；
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
- **下一动作**：合并上述最小权限修复后，重新从合并提交 `3c00d952be6fa7e44aba683fc79fee4e1a1687fe` 发布 digest-only
  images 与 deployment artifact。服务器管理员再交互式配置有 `read:packages` 的 GHCR 只读身份，安装 artifact、执行首次真实
  Compose 发布并通过 SSH tunnel 验收；不在服务器现场 build；
- **下一任务**：E-012 完成后才评估 E-013；当前不提升其它任务。

## 6. 验证与环境说明

- publication 权限修复的精确工作流合同用例通过，Prettier 与 `git diff --check` 通过；本机完整 E-012
  security Gate 已运行并保持 `FAIL`，唯一失败仍是 macOS 缺少 Linux `flock` 导致 deployment suite `33/35`，
  权限合同断言本身通过；合并前以固定 `ubuntu-24.04` PR CI 为权威自动证据；
- 第三轮新增的 seed failure、checkpoint loss、state→receipt 重建和重复 release receipt 场景 `4/4` 通过；目标 ESLint、Prettier 与
  `git diff --check` 通过；DEV Compose/image/preflight 的 Windows 可执行子集 `15` 项通过，另 `1` 项只因 Windows 无 `process.getgid()` 未进入逻辑；
- 本轮私有 COS 决策与审核修复已进入 ADR-0007、部署规范、Runbook、任务状态和 `ReleaseManifestV1` 合同；PR 前一 head 定向
  deployment suite `31/31` 通过，覆盖 Caddy Host/SNI 一致性、source-free bundle
  build/verify、root-only 原子安装、首次 materialize、幂等 replay、篡改拒绝、顺序发布失败不落状态和
  dirty operation、`Accepted N → N+1 中途失败 → recover-current N`、唯一 rollback、v1→v2 配置/secret 引用轮换，以及
  root-only 外部值仅通过 service-specific Compose environment secret 进入容器；source registry 为
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

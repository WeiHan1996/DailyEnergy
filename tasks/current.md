# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-09-06
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-016 — 建立确定性核心全路径端到端测试
- **任务状态**：In Review
- **任务 Profile**：`code`（HTTP/Admin/Mini Program/真实 PostgreSQL、Redis、BullMQ 的合成黑盒与故障恢复）
- **工作分支**：`agent/c016-core-e2e`
- **任务 Issue**：[C-016 Issue #66](https://github.com/WeiHan1996/DailyEnergy/issues/66)
- **当前 PR**：[PR #183](https://github.com/WeiHan1996/DailyEnergy/pull/183)（Draft；实现、自动核心、三次 stability 与 Mini Program DevTools evidence 已完成，等待 owner 审核）
- **开工控制合并**：[PR #182](https://github.com/WeiHan1996/DailyEnergy/pull/182) exact head `6d37f79dff906244615302ef70af81586541f687` / CI run `33974824119` / 11 checks 通过后 squash 合并为 `d9b696d2fc264168b462edacfcfd1505097bfee2`；merged-main CI run `33975208632` 11/11 SUCCESS
- **Stacked 基线**：[C-015 PR #170](https://github.com/WeiHan1996/DailyEnergy/pull/170) 已在 exact head `c3c716605cb458ddcd88cf9bd2cbdc06d130c968` / CI run `33713182325` / 11 checks 验证后 squash 合并为 `0de26bf56f226246825a9a34fdd2a8967574dcda`；merged-main CI run `33736831445` 11/11 SUCCESS
- **已完成的中断任务**：E-017 Done；PR #179 squash 合并为 `ab3dd7768d939588d4992c149cb1990fbfff648d`，merged-main CI run `33971805374` 11/11 SUCCESS，Issue #171 Closed；阿里云环境仅为 `DEV_LITE_ACCEPTED / LOCAL_SYNTHETIC_OBJECT_ONLY / PRODUCTION_INELIGIBLE`
- **延期任务**：C-015 保持 Blocked；production origin/image/Release Manifest bundle、处理主体/位置/受托方/跨境、最终用户说明与合格 Legal review 继续延期并阻塞 Production/RC
- **依赖例外**：owner 于 2026-09-05 明确允许 C-016 在现有 DEV_LITE 上仅使用 synthetic 数据继续；C-015 已合并实现与威胁审核仍是代码前置，其延期的 Production/Privacy/Legal 证据不阻塞 development-only C-016，也不能由 C-016 反向关闭
- **环境边界**：`DEV_LITE_ACCEPTED / LOCAL_SYNTHETIC_OBJECT_ONLY / REAL_USER_DATA_PROHIBITED / PRODUCTION_INELIGIBLE`
- **下一候选动作**：提交 DevTools evidence 与最终 Gate receipt，等待 PR #183 exact-head CI 后请求 owner 审核；未经明确批准不标记 Ready、不运行 merge verifier、不合并，C-017 继续 Planned
- **Phase Gate 结论**：`DEVELOPMENT_ONLY_GO_FOR_C-016 / PRODUCTION_AND_RC_NO_GO`

## 2026-09-05 C-016 development-only 开工授权

- owner 明确确认“按 DEV_LITE 继续完成开发、生产证据延期”；该决定只调整任务顺序，不降低 C-015 原验收条件，也不改变 ADR-0009 的 synthetic-only 与 production-ineligible 边界；
- C-015 保持 Blocked 和 Issue #68 Open；现有 2C2G 阿里云上海 ECS 继续只作为 DEV_LITE，不登记为 production application host，不处理真实用户、生产身份或 production secret；
- C-016 只运行合成 HTTP/Admin/Mini Program/真实 PostgreSQL、Redis、BullMQ 组合 E2E、故障与恢复证据；不验证生产域名、外部对象、HA、备份恢复、真实微信用户或 Production authorization；
- C-017 继续依赖 C-016 Done，结论只决定能否进入 Phase 3 development；即使 Development GO，也不授予 Production/RC GO；
- owner 提供小程序名称“见见今天”、ICP 备案主体“陈斌”、服务地区中国大陆、现有 2C2G 阿里云上海主机、网页 URL 偏好和 `Legal reviewer=PENDING`。处理主体暂按“个人 / 陈斌”记录，小程序名称不作为法定主体；正式生效前仍须微信后台主体原始证据与合格法律审核；
- `docs/operations/privacy-notice.html` 为候选 `necessary-consent-v2` 网页草案，目标地址 `https://api.weihan.ltd/privacy` 尚未发布；草案不更新当前 runtime `necessary-consent-v1`，不解除 C-015，也不替代生产受托方/位置/跨境和 Legal evidence。

## 2026-09-06 C-016 实施进度

- PR #182 经 exact-head verifier 后已合并，merged-main CI 11/11 SUCCESS；实现分支 `agent/c016-core-e2e` 已从该 main 创建；
- C-016 实现 Draft PR #183 已创建；实现基线 commit `9cc3498`，保持 Draft/Blocked，不得在 DevTools evidence 前标记 Ready 或合并；
- 新增真实 Nest HTTP + PostgreSQL 18 + Redis 8 + BullMQ 5 + Interactive/Background/Restricted 三 profile 的 synthetic-only 组合 E2E，覆盖首次进入、同日返回、双设备并发、unknown outcome、七个产品日、任务/点亮/晚间/weekly、Worker 重启、Redis loss、DAY 删除、Safety、维护和 Admin audience；
- `pnpm test:core:e2e:stability` 使用三套全新容器连续 `3/3` PASS、retry=`0`；provider calls=`0`，queue/log/HTTP 敏感字段扫描通过；
- 组合测试发现完整七天 + helpful pattern + 两个 observation 会把客户端 summary 投影成 6 段并违反最多 5 段 Schema；现已把 next-week 与 closing 按原顺序合并为一段，聚焦单元 `6/6` 与三次组合回归通过；
- C-016 evidence manifest 将 24 个实际证明的 Source ID 从 PLANNED 提升为 COVERED，registry 当前 `562/1004 COVERED`、`442 PLANNED`、`0 NA_WITH_REASON`；未实现/未执行的 backup restore、Safety 两步恢复和 Admin 受限列表未被冒充覆盖；
- owner 于 2026-09-06 完成动作时确认后，临时开启本地 Service Port；DevTools `Stable v2.01.2510290` / 基础库 `3.7.12` 对 11 个注册页面与路由全部 PASS，build source fingerprint=`f73bc61f8498cfdc16a02591bee4edf0bd8a1b9fa94db7aa1c9ced609baa2eb4`。完成后 Service Port 已恢复关闭，并复核登录票据、默认信任和多端插件端口均关闭；该证据不包含真机、RC 或 Production；
- 固定 Node `24.18.0` 下 evidence 更新后的 `pnpm agent:validate --mode=changed --task=C-016` 已保守升级为 full 并返回 `automated=PASS`（174248ms）；此前本机 Node 24.6.0 生成的 supply-chain provenance 被 exact-version scanner 正确拒绝，未被当作 PASS。
- 固定 Node `24.18.0` 下 evidence 更新后的 `pnpm agent:validate --mode=task --task=C-016` 返回 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`（87524ms），路径提升 Profile=`security`，required evidence=`threatBoundaryReview, productionAuthorizationWhenApplicable`；PR #182/ADR-0009 的 development-only threat boundary 已获 owner 接受，Production authorization 不适用于本任务且保持 `NO_GO`，Mini Program DevTools conformance 已完成。

## 2026-09-03 E-017 启动

- owner 明确接受阿里云 ECS 只作为 `DEV_LITE`，仅处理 synthetic 可重建数据，`production_eligible=false`，Production/RC 保持 `NO_GO`；该决定记录于 Accepted ADR-0009；
- 新 ECS 位于上海地域，Ubuntu 24.04.4 x86_64、2 CPU、实际 `MemTotal=1651684kB`、40 GiB 系统盘且约 35 GiB 可用、3 Mbps；时区/NTP 合格，Docker 未安装、swap=0、UFW 未启用，当前只监听 SSH；
- owner 授权后，阿里云控制台已完成安全验证，导入现有公钥为 `dailyenergy-dev-lite-2026`、绑定唯一空实例并普通重启；固定 ED25519 主机指纹下 `root` BatchMode 登录通过；公钥、IP、实例 ID 与账号信息不进入仓库；
- DEV_LITE 不购买外部对象存储；使用 `network_mode:none`、无 secret/volume/host port 的 one-shot 内存对象 smoke。该证据只证明本地 synthetic PUT/GET/hash/DELETE 合同，不替代旧 E-012 COS 或未来生产 OSS/CDN；
- 约 1.6 GiB 实际 RAM 禁止九服务常驻：只保留 PostgreSQL、Redis、dependency stub、API、TLS core；Admin、Interactive、Background、Restricted 与一次性 job 按锁保护的窗口逐个启动并立即停止；swap 仅作突发缓冲，不替代资源预算；
- 不复制腾讯云 DEV volume、dump、release state、object、secret 或 credential；服务器不 checkout、不现场 build，只接受 main-bound、同 run CI 通过且 digest 固定的 bundle；
- 只读安全审查发现并修复旧 bundle 安装、跨 topology dirty state、阶段 service set/one-shot、pull recovery 与 Admin TLS 边界；Node 24.18.0 与官方 npm registry 下，最终 `pnpm agent:validate --mode=full --task=E-017` 为 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`，部署测试 `74/74`，Source registry 为 `1004 total / 538 COVERED / 466 PLANNED`；Gate 生成的 15 个 Prisma 非语义格式副作用已按 owner 授权恢复；
- owner 已审核通过 PR #172 的 DEV_LITE threat boundary，并授权依赖顺序合并 #170/#172；两者均经正式 exact-head verifier、squash merge 与 merged-main 11/11。owner 另行授权触发 `main@9db16852` publication，并对阿里云空实例创建 2 GiB swap、安装 Docker/Compose 和固定 Node、启用仅 SSH 入站 UFW、创建 fresh synthetic secrets；继续禁止腾讯云状态/凭据迁移、公网 80/443 和 Production/RC；
- E-017 implementation PR #172 已在 exact head `1be36235bf3050b3d0925c2fabfdd1319336ff6f` / CI run `33737332264` / 11 checks 验证后 squash 合并为 `9db168528ffc9e25e476f6390be85c9403dc7252`；merged-main CI run `33737657223` 11/11 SUCCESS；
- main-bound publication run `33738800444` 已通过 source/CI gate 并推送五个 role image，但真实 image probe 以 `DEV_RUNTIME_IMAGE_PROBE_INVALID:api-deploy-config` 拒绝，未生成或上传 bundle；根因是 E-013 后 Redis/telemetry fingerprint 字段未同步，且 DEV_LITE prefix 需要 profile 绑定。该 run 的 tag 禁止安装/部署，修复必须重新走完整 PR/main Gate 后产生新 run；
- 阿里云 bootstrap 已完成：2 GiB persistent swap、Docker `29.7.2`、Compose `5.5.0`、固定 Node `24.18.0`；UFW active 且仅允许 SSH，Docker active/enabled、零容器/零镜像，`/srv/dailyenergy` 仍不存在，受保护端口无非 loopback 监听；Docker 官方 CDN 在上海 reset 后改用 Docker 官方签名 key 验证的阿里云 Docker CE 镜像完成安装；
- runtime fingerprint 修复已将 Redis/telemetry 字段与 STANDARD/DEV_LITE prefix 绑定到 deployment helper、image probe、materializer 与 manifest validator；编译后 API parity 为 2/2，部署测试 `74/74`，Node 24.18.0 + 官方 npm registry 下 full security Gate 为 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`；本次 15 个 Prisma 非语义生成副作用已按 owner 授权恢复；
- runtime fingerprint 修复 PR #173 已在 exact head `a9b60ca43816bb9154df15a52e80880dfb283bbb` / CI run `33740464810` / 11 checks 验证后 squash 合并为 `8640a12bb1457f13b90c39d499a8cb36a0e06a72`；merged-main CI run `33741540390` 11/11 SUCCESS；replacement publication run `33741778621` 的真实 image probe、proxy、supply、V3 bundle 18-file 校验与 artifact 上传全部 PASS；
- 阿里云已创建 fresh 8-file secret version 并安装 generation 1 bundle；首次 deploy 在 pull 阶段因 Docker Hub 国内直连 DNS/网络超时而按合同失败，migration 未进入、Accepted state 未写、dirty operation 保留。五个 GHCR digest 已串行缓存；最初从 Apple Silicon 本机传输的 PostgreSQL/Redis archive 虽通过 SHA-256 与 `tag@digest` 解析，但实际只含 `linux/arm64` platform content，证明 tag/index 可解析不能替代容器内架构执行证据；第三方 registry mirror 未获授权且未配置；
- offline pull 修复的部署测试 `74/74` 通过；完整 Gate 连续两次只在 audit metadata 阶段失败，根因是本机全局 npmmirror 与 corepack 子进程覆盖不稳定，而显式 npm 官方 registry audit 为 `critical=0/high=0`。修复将官方 `registry.npmjs.org` 固定进生产 audit 命令并以 CI policy test 防止回退；阈值仍为 high/critical=0；
- DEV_LITE `pull --policy missing`、STANDARD `pull --policy always` 与官方 audit registry pin 的最终 full security Gate 为 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`；部署测试 `74/74`、CI policy `29/29`、audit `critical=0/high=0`，本次 Prisma 非语义生成副作用已按 owner 授权恢复；
- owner 于 2026-09-05 审核并授权合并 offline pull 修复；PR #174 在 exact head `137c88d34e3183ad7d14c808df67302ca6f01e55` / CI run `33845762969` / 11 checks 验证后 squash 合并为 `b4dba9f26d0318080e0bde36f9d6d3238f16912d`，merged-main CI run `33939690862` 11/11 SUCCESS；publication run `33939833910` 的五 role image、runtime/proxy/supply、V3 bundle 18-file 校验与 artifact 上传全部 PASS；
- 新 bundle `devr-b4dba9f26d03-88fa366d62c70ea4b9ba236b` 安装通过并按合同以 `SUPERSEDED_BEFORE_MIGRATION` 取代旧 pull failure；五个新 GHCR digest 最终全部拉取。旧腾讯云 x86_64 主机只导出同一官方 PostgreSQL/Redis exact digest 的公开 immutable image layers，不读取或迁移 volume、dump、secret、release state、object、credential 或日志；amd64 archive SHA-256=`72ef84f3317c316404a591816a8c7a04b1392a91dfd1b8f653711c0ff55617c3`，远端 gzip/SHA、image metadata 与 network-none `uname -m=x86_64` 均通过；
- amd64 修复后 PostgreSQL 18 与 Redis 8 均 healthy，dependency stub 本身通过 bash loopback HTTP 返回 200，但继承的每 2 秒 Node `fetch` healthcheck 在 0.1 CPU / 64 MiB 限额下持续超过 2 秒、占满 CPU 并积累 health PID，导致 `stateful-ready` 假阴性；deployment 仍在 migration 前失败、Accepted state 不存在、原 operation 与 volumes 保留。聚焦修复只为 DEV_LITE 固定轻量 bash loopback HTTP 探针并增加 policy negative test，不提高资源限额或放宽 healthy 要求；
- owner 于 2026-09-05 审核并授权合并 healthcheck 修复；PR #175 在 exact head `a835b8c43efede246b6fa7a70ec49f46f5623363` / CI run `33944596672` / 11 checks 验证后 squash 合并为 `4b12d08c220cdf519d8b8d3d92d5995783e7c346`，merged-main CI run `33950575390` 11/11 SUCCESS；publication run `33950701210` 的五 role image、runtime/proxy/supply、V3 bundle 18-file 校验与 artifact 上传全部 PASS；
- 新 bundle `devr-4b12d08c220c-586c629cb1a811d78a81b17e` 安装并按合同取代旧 pre-migration failure；分段缓存五个新 GHCR digest 后，轻量 dependency-stub healthcheck 与 PostgreSQL/Redis stateful readiness 均在真实 2C2G 主机通过。migration 第一条 `database-init prepare` 在启动容器前被 Compose v5 以 `service database-smoke depends on undefined service postgres` 拒绝；根因是 one-shot 命令只激活 `dev-lite-one-shot` 而未激活依赖模型所需的 `dev-lite-core`。`migration_applied=false`、`migration_verified=false`、Accepted state 不存在、operation 与 volumes 保留；修复只让所有 one-shot 命令同时激活 core/one-shot profiles，仍固定 `run --no-deps`，不增加实际并发服务；
- owner 于 2026-09-05 审核并授权合并 one-shot profile 修复；PR #176 在 exact head `c63e8de93e79cbaaeb49e097c00a9307e9948d79` / CI run `33953077320` / 11 checks 验证后 squash 合并为 `98b7c33e12b1c95be5e1b0ed482c46759045f506`，merged-main CI run `33955032026` 11/11 SUCCESS；publication run `33955155237` 的五 role image、runtime/proxy/supply、V3 bundle 18-file 校验与 artifact 上传全部 PASS；新 bundle `devr-98b7c33e12b1-84a47aea55262c8708b1e7d7` 已服务器端二次验证并安装；
- 现有失败 operation `b170b082-692c-47ad-a46e-5192515a7827` 的 `active_phase=migration`，即使 `migration_applied=false`、`migration_verified=false`，Accepted Runbook 与 `replaceableFailedInitialOperation` 仍禁止新 artifact replacement；不得手工改 operation 或跨 bundle 执行控制器。重建预览固定为 project `dailyenergy-dev-lite` 的 3 个 stopped containers、`dailyenergy-dev-lite_postgres_data` 48.54 MB、`dailyenergy-dev-lite_redis_data` 0 B、dirty deployment state；Accepted state 不存在、受保护端口无监听。执行前必须取得 owner 对永久删除上述 synthetic volumes/state 的单独明确授权并先归档无 secret failure receipts；
- owner 于 2026-09-05 明确审核通过重建预览并授权：先归档无 secret operation/receipts，再删除上述 3 个 stopped containers、2 个 synthetic volumes、Compose networks、dirty deployment state 与 3 个失败 release runtime-secret 目录；保留 immutable bundles、镜像、GHCR 登录和 `dev-lite-secret-v1`，创建 fresh `dev-lite-secret-v2`，使用 publication run `33955155237` 的同一已验证 source bundle 从空状态部署；Production/RC 继续 `NO_GO`；
- 重建前 `/srv/dailyenergy/deployment` 已归档到 ignored 本地 artifact，远端/本地 SHA-256 均为 `d1313f9254f9bf18164358ebd45eb1c4b54c7b2c46c26df03b576578eb64a7cb`；gzip、闭合文件清单和 6 个 JSON 敏感值扫描通过，只含 operation、两份 supersede receipt、三个无值 ReleaseManifest 与 lock 元数据。随后已按授权删除 3 个 containers、2 个 volumes、10 个 networks、dirty deployment state 与 3 个 runtime-secret 目录；复核全部为 0，5 个 bundles、GHCR、v1 和 images 保留；
- fresh `dev-lite-secret-v2` 已在主机生成完整 8-file `0600` 集，未继承 v1 admin credential；同一 run `33955155237` source bundle 安装得到 v2-bound `devr-98b7c33e12b1-1fa3c9a0f22237f60b66f104`。五个新 application digests 已逐个缓存，七个 Compose images 均验证 `linux/amd64`；fresh deploy 在创建 operation 前以 `PREFLIGHT_HOST_CAPACITY` 拒绝。清理两份已有本地校验副本的远端 base-image transfer archives 与可重建 apt cache/lists 后，可用空间为 `21631524864` bytes，仅高于 20 GiB 门槛 `156688384` bytes（约 149 MiB），不足以承担 PostgreSQL 初始化和逐阶段 20 GiB guard；
- 当前 22 个 image refs 包含 PostgreSQL/Redis、latest `main@98b7c33e` 五 role set 与三个从未成为 Accepted/N-1 的旧五 role sets；Docker 报告 images `12.91 GB`、reclaimable `12.49 GB`。删除旧 15 refs 可由保留 bundles/GitHub artifacts/GHCR exact digest 重建，但 owner 此前明确要求保留 images，因此在取得新的精确 image-removal 授权前 E-017 保持 Blocked；
- owner 于 2026-09-05 明确批准删除三个从未成为 Accepted/N-1 的旧五 role image sets 共 15 个精确 digest refs；删除未使用 `--force` 或 prune，复核镜像闭集只剩 latest `main@98b7c33e` 五 role 与 PostgreSQL/Redis 共 7 refs，bundles/GHCR/v1/v2 保留。可用磁盘从 `21631524864` 提升到 `29649711104` bytes，增加约 7.6 GiB 运行余量；
- v2-bound release fresh deploy 已通过 preflight、pull、stateful-ready、maintenance、worker-drain 与完整 migration，operation `38877a0e-97c1-4c8d-9baf-a3152b06be1c` 记录 `migration_applied=true`、`migration_verified=true`；随后 `worker-interactive` 在创建容器前因只激活 `dev-lite-interactive`、未激活其 Compose dependency model 所需的 `dev-lite-core` 而失败。修复将 Admin/Interactive/Background/Restricted convergence 同时激活 core+目标 profile，仍固定 `up --no-deps`；当前 migrated volumes/operation 保留，core 已停止，Accepted state 仍不存在；
- transient profile closure 的 deployment suite `75/75` 通过；真实阿里云以 core+interactive profiles、`up --no-deps` 启动 worker-interactive 并通过 phase runtime guard：4 running、1 transient、OOM/restart/public ports 均为 0、disk floor 20 GiB，trap 随后停止全部服务。固定 Node 24.18.0 full security Gate 首次仅因本机 Testcontainers PostgreSQL host port 10 秒绑定超时失败，聚焦 queue integration `8/8` 复核后完整 Gate 为 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- 因当前 operation 已完成 migration，新 artifact 仍不能替换；第二次重建预览为 4 个 stopped containers、`dailyenergy-dev-lite_postgres_data` 71.4 MB、`dailyenergy-dev-lite_redis_data` 0 B、10 networks、dirty operation/state 与 `devr-98b7c33e12b1-1fa3c9a0f22237f60b66f104` runtime-secret 目录。Accepted state 不存在；删除前仍需 owner 在审核 PR #177 后单独明确授权，计划保留 latest 7 images、所有 bundles、GHCR、v1/v2 并创建 fresh v3；
- owner 审核通过并授权合并 PR #177、发布新 bundle 与第二次完整 synthetic DEV_LITE 重建；PR #177 exact head CI run `33961266770` 11/11 PASS，squash 合并后 merged-main run `33964293962` 11/11 PASS，publication run `33964437990` 的 V3 bundle 与五 role image PASS；第二次重建归档 SHA-256=`55fd3d9284f226fda697abe23d9733679bd224f4f18817d68d1a5daa5c16ecb2`，闭合成员、gzip、operation 与敏感值扫描通过，随后仅删除授权的 4 containers、2 synthetic volumes、10 networks、dirty state 与一个 v2 runtime-secret，保留 images/bundles/GHCR/v1/v2 并创建不继承旧 credential 的 fresh v3；
- v3-bound fresh N `devr-adb8a7a5ac0f-29ca176313a877805c7428f9` 从空状态完成 18/18 deploy，Accepted current/catalog 与 PASS receipt 写入，operation 清除。首次 Docker clean restart 暴露 Admin 因继承 `on-failure:3` 在 daemon restart 后复活，reconcile preflight 正确 fail closed；显式 containment 后同一 operation 完成 17/17 且 state SHA-256 不变；
- 修复将 Admin 与三个 Worker 及所有 one-shot 的 transient restart policy 闭合为 `no`，并同时验证 source 与 canonical merged Compose；PR #178 exact head `064306653d37183c7e27688afbabf57ed0f365ae` / CI run `33965800866` 11/11 PASS，squash 合并为 `921f2eb1bec4d3e21d54fdbbc702120ea5025783`，merged-main run `33965927848` 11/11 PASS，publication run `33966042523` PASS；
- v4 只继承 v3 PostgreSQL admin/container credential 并轮换其余 6 个 application/fault 值；N+1 `devr-921f2eb1bec4-1723de8b593718c7dab57816` 已完成 N→N+1 18/18、无人工 stop 的 Docker clean restart + reconcile 17/17、唯一 target rollback N 18/18 和 redeploy N+1 18/18，共 6 份独立 PASS receipt；最终 current/catalog=N+1、rollback target=N、operation 不存在、5 core healthy、OOM/restart/public protected ports=0。31 个一分钟 soak 样本全部通过，持续约 30 分钟，最小可用内存 `797798400` bytes、最大 swap 使用 `0`、`pswpin/pswpout` 增量 `0/0`、最小磁盘 `24158523392` bytes；无值原始 JSONL 已按远/本相同 SHA-256 `fd0022ef4944fe8f748e4209c6efb7953aa1aa7e7e68c5e1d5b89ca113a4801e` 保存在 ignored 本地 artifact；
- 在 E-017 完成和返回 C-015 前，不启动 C-016；C-015 的生产 bundle、主体/位置/受托方/跨境和 Legal review 继续阻塞 Production/RC。

## 2026-09-02～09-03 外部证据补齐进度

- 项目所有者已授权 Agent 准备 C-015 剩余证据，并在微信开发者工具中提供“见见今天”的既有 AppID；AppID 只用于本机忽略配置和 IDE 项目，不写入仓库或证据正文；
- 微信开发者工具 `Stable v2.01.2510290` / 基础库 `3.7.12` 已通过 11 路由 smoke；owner 明确允许后仅开启本地服务端口，登录票据、默认信任和多端插件端口保持关闭；增强 no-replay runner 证明 `dimensions_expanded` 的 restart replay=`0`、fresh signal=`1`、storage keyword/digest change=`0`，完成后服务端口已恢复关闭；
- iPhone 17 / iOS 26.5 / 微信 `8.0.76` 使用 ENT-001 真机调试和只接收合成 `landing_viewed` 的临时 HTTPS recorder：正向通路先验证，正式清零后离线重启=`0`、恢复网络缓存恢复=`0`、显式新调试刷新产生正向事件；AppID 未持久化，私有 `urlCheck` 已恢复 `true`，Quick Tunnel 与 recorder 已终止；iOS no-replay 证据完成；
- Xiaomi MIX 2S / Android 10 / MIUI 12.5.1 / 微信 `8.0.76` 使用 ENT-001 真机调试和合成 recorder：模拟器基线 `1` 被排除，真机连接新增正向 delta=`1`；正式清零后离线重启=`0`、原页恢复网络 replay=`0`、显式刷新未产生新进程=`0`、联网冷进程重新扫码正向事件=`1`；Android no-replay 证据完成，Quick Tunnel 与 recorder 已终止，私有 `urlCheck` 和 LOCAL build 已恢复；
- 当前 head 的 LOCAL 候选 bundle build、Mini Program bundle Gate、C-015 analytics static test、已构建产物与 lockfile 禁止 SDK 名称扫描均通过；使用 Node `24.18.0` 生成的 supply-chain evidence 为 `5406` 个 build files、`750` 个 SBOM packages，artifact scanner PASS；这些结果未绑定实际 PRODUCTION API origin 或生产 OCI image，不能升级为生产 bundle PASS；
- 2026-09-02 npm 官方 audit 新报告 transitive optional `mysql2@3.15.3` 的 high advisory `GHSA-3f6p-5ww8-9rcr`；当前分支用最小 override `mysql2@3.22.0` 修复，复核为 `critical=0/high=0`，完整自动 Gate 已在 `9022e5b` 通过；
- 2026-09-03 npm 官方 audit 新报告 transitive optional `fast-uri@3.1.5` 的四个 high advisory（`GHSA-5jgf-p345-68v8`、`GHSA-f65p-4m7j-42xc`、`GHSA-fph4-wmhf-6fwf`、`GHSA-jqff-g426-hqxp`）；当前分支将既有最小 override 提升到 `fast-uri@3.1.6`，唯一生产解析版本与 frozen lockfile 策略通过，官方 audit 复核为 `critical=0/high=0`；Node `24.18.0` 下 `changed→full` Gate 为 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`，exact-head CI run `33698970649` 为 11/11 SUCCESS；
- 首次修复 head `284f707` 的 CI 暴露 C-014 固定 2026-08-25 业务时钟与 queue `now()` 混用，导致 2026-09-02 后 status retention 抢先；`9022e5b` 为 due query 增加默认服务端当前时间、测试可注入的 `asOf`，真实 PostgreSQL 18 回归和 CI db-integration 均通过；
- `9022e5b` 的 CI run `33579547592` 为 11/11 SUCCESS，覆盖 docs/static/unit-contract/db/queue/API/Admin/resilience/AI/supply-chain/full Gate；这些自动证据仍不替代 DevTools/真机和 Privacy/Legal 人工证据；
- GitHub 当前只有 `development` environment，仓库和该环境均无 Actions variable/secret；没有可绑定的 STAGING/PRODUCTION API origin、生产 image set 或 Release Manifest；
- `api.weihan.ltd` 已通过两台阿里云权威 DNS 和系统 resolver 验证 A 记录发布，未发布 AAAA/CNAME；公网 HTTPS/HTTP 端口均超时而 SSH 可达，因此 TLS handshake、API 健康检查和生产 origin 绑定仍未通过；owner 已将旧腾讯云主机定为 `DEV_ONLY_EXPIRING`，新阿里云主机严格为 `DEV_LITE / PRODUCTION_INELIGIBLE`，不承接该生产 origin；
- 腾讯云 `DEV_ONLY_EXPIRING` 主机已通过已加载的专用密钥完成严格只读盘点：Ubuntu 24.04 x86_64、4 CPU/约 8 GiB/178 GiB、时钟同步、Docker/Compose 可用，9 个 synthetic DEV 容器健康；PostgreSQL/Redis 为本机 DEV 容器，TLS proxy 只绑定 loopback 8443/8444，主机未监听 80/443、UFW 只允许 SSH，且正式 `api.weihan.ltd` SNI 在 DEV proxy 上握手失败，因此该主机和 bundle 不具备生产资格；未读取 secret、env、日志、dump、volume 或用户内容；
- owner 已购买上海地域 Ubuntu 24.04 的阿里云 ECS（2 vCPU / 2 GiB / 40 GiB / 3 Mbps）；首次盘点时专用公钥尚未绑定，随后已按明确授权完成安全验证、key pair 绑定、普通重启和固定 host key 下的 `root` BatchMode 登录。该主机只获 `DEV_LITE / SYNTHETIC_ONLY / PRODUCTION_INELIGIBLE` 决策，不能替代 C-015 的生产 origin/image/manifest 证据；
- 本地脱敏 receipt 为 `.artifacts/c015/evidence-receipt.json`，SHA-256=`b1ea6a47128af3bdb7353ff10fdac26df49bd15c22ee91df7b6e1c28efc5a582`；该 ignored artifact 不替代 tracked 摘要、owner 接受或 CI；
- 实际处理主体、安徽合肥登记属地、隐私联系、Android 版本和“不向不满十四周岁用户提供服务”的 owner 输入仅保存于 ignored 本地表；未成年人决定仍需 Accepted 规范与最小拒绝路径，Privacy 工程自审仍 Pending，Legal reviewer 保持 `PENDING_QUALIFIED_PRC_LEGAL_REVIEWER`；
- 仍需完成：生产 origin/image/manifest、生产组件/受托方/region/跨境矩阵、最终用户说明和合格 Legal review。

## Post-merge receipt

- #157～#169 均先通过 exact-head verifier，再以 `--merge --match-head-commit` 合入 main；13 个原 PR head 均已验证为最终 main 的祖先，13 个 merge commit 均为双父；
- merge commits：#157 `4ac2009b`、#158 `38138a78`、#159 `aad63032`、#160 `873bcc24`、#161 `7d6d5cb9`、#162 `2e8935ed`、#163 `812595cf`、#164 `0ee0e66c`、#165 `90e8e23c`、#166 `6ee5e9fd`、#167 `2fa0df61`、#168 `d7411c18`、#169 `fec5c96d`；
- 最终 PR #169 exact head `453eb55504dab35209c0886eefede51342547199`，CI run `33373613585` 11/11 SUCCESS；merged-main CI run `33374088290` 11/11 SUCCESS；
- 一次性 merge window 完成后，repository `allow_merge_commit=false` 已恢复；main ruleset `21080906` 已恢复 deletion、non-fast-forward、required-linear-history、squash-only、11 strict checks、空 bypass；
- post-merge 状态最初通过 docs-only Draft PR #170 提交；owner 后续授权在同一 C-015 PR 完成证据准备、供应链 high 修复和固定时钟回归，PR 继续保持 Draft 且不解除剩余人工/生产 blocker；
- PR #170 exact head `c3c716605cb458ddcd88cf9bd2cbdc06d130c968` 的 CI run `33713182325` 为 11/11 SUCCESS，正式 merge verifier 通过后 squash 合并为 `0de26bf56f226246825a9a34fdd2a8967574dcda`；merged-main CI run `33736831445` 11/11 SUCCESS；C-015 仍因生产 bundle 与 Privacy/Legal 证据保持 Blocked；
- C-004～C-014 Issues #56/#57/#58/#59/#62/#60/#61/#63/#64/#70/#65 均已 CLOSED 并附 merge receipt；C-015 Issue #68 因外部证据 Pending 保持 OPEN；
- owner 代码与 differential-query/four-plane threat-boundary 审核已通过；外部/真机证据仍 Pending，因此当前任务不标记 Done，Production/RC 保持 `NO_GO`。

## 0. 统一审核修复

- 项目所有者于 2026-08-31 明确要求修复 C-004～C-015 统一审核发现；该安全/正确性缺陷批次中断原 In Review 状态；
- 项目所有者已明确授权基于 PR #168 创建统一修复 Draft PR；授权不包含 force-push、改写 #157～#168、运行 exact-head verifier、标记 Ready 或合并；
- 统一修复 Draft PR #169 已基于 PR #168 精确 head 创建；verified status head `884a2050f19352bfb2371535a1c9f9abc29b2e6e` 的同一 CI run `33357674745` 已 11/11 SUCCESS；
- 项目所有者于 2026-08-31 明确“审核通过”，接受 PR #169 的代码修复与 differential-query/four-plane threat boundary；该决定不替代真机、生产 bundle、处理主体/位置/用户说明证据，也不授权 force-push、错误 base merge 或 Production/RC；
- 项目所有者随后明确选择 merge commit 保留 #157～#168 stack ancestry；仓库当前仅允许 squash，因此该一次性策略要求在受控合并窗口临时启用 `allow_merge_commit`，逐项 exact-head 合并后恢复为关闭，不执行 branch rewrite；
- PR #157 exact-head verifier 已以 head `9a902a5d2d5b666be33f9c90faa92dffafce0037` / run `32456442334` / 11 checks 通过，但 GitHub ruleset 因 `required_linear_history` 与 squash-only 拒绝 merge commit；没有发生合并；
- 仓库 `allow_merge_commit` 已恢复为 `false`，main ruleset 仍保持 deletion/non-fast-forward/linear-history/squash-only/11 strict checks/no bypass，PR #157 已恢复 Draft，main 仍为 `97b7181ea172f86d0ac3fe37af464f6bd0f169d8`；
- 项目所有者于 2026-08-31 明确批准一次性 ruleset 变更：临时启用 `allow_merge_commit`、移除 main `required_linear_history`、把 allowed method 从仅 `squash` 改为仅 `merge`；其它规则必须保持，完成或中止后原样恢复；
- 修复范围只覆盖已报告的幂等与时间边界、continuation/DayLit 收敛、Safety/删除竞态、本地敏感缓存与期限、规则/template invariant，以及 C-015 信号、指标、Gate 和基数合同；
- 不改变 Accepted 产品方向、框架、数据库或服务边界，不启动 C-016，不将人工证据或 Production/RC Gate 冒充完成；
- 修复先在独立顶层分支完成并验证；未经项目所有者授权，不 force-push 或重写现有 stacked PR；
- 原 PR head/CI 只作为修复前基线，不能继续作为修复后通过证据。

## 1. 连续推进授权与 stacked 规则

- 项目所有者于 2026-08-21 授权按依赖顺序连续完成 C-004～C-015，并在 C-015 后统一审核；
- C-004～C-015 不逐项请求用户审核，仍各自使用聚焦 stacked branch/PR、独立任务 Gate 与持久证据；
- 下游 branch 基于上游 verified final head；上游 PR 未被提前接受或合并，统一审核前全部保持 Draft；
- 任一缺失 Accepted 决策、无法满足的依赖、外部授权或手工证据仍须如实阻断，不因连续授权而猜测。

## 2. 修复前已验证 C-004～C-015

- C-004 Draft PR #157 verified head `9a902a5d2d5b666be33f9c90faa92dffafce0037`，CI run `32456442334` 11/11 SUCCESS；
- C-005 Draft PR #158 verified head `e0383934f2d224e1d3e1636ab24311656f7b2604`，CI run `32463505126` 11/11 SUCCESS；
- C-006 Draft PR #159 verified head `743e1d8679478f6feec961c87cca0b31c81230b5`，CI run `32468906982` 11/11 SUCCESS；
- C-007 Draft PR #160 verified head `4fdf0b557d699369b60f72f872d74599b403bd2f`，CI run `32680445291` 11/11 SUCCESS；
- C-008 Draft PR #161 verified head `7e4a6e1b1b21eda9ea5fb51184cc7ca0047b86ac`，CI run `32688523258` 11/11 SUCCESS；
- C-009 Draft PR #162 verified head `941c302995935b763dae3b45c5a56fddf68bdae2`，CI run `32692776724` 11/11 SUCCESS；
- C-010 Draft PR #163 verified head `e6dc3717ad94799ab821e6d5c983dec6dd568043`，CI run `32697952655` 11/11 SUCCESS；
- C-011 Draft PR #164 verified head `3ca1105b676cc01b6af1d9d6b4f1bf28e84d7589`，CI run `32705520165` 11/11 SUCCESS；
- C-012 Draft PR #165 verified head `b70b9e390ab5d8514d13c576f21bdade18ad18e6`，CI run `32728000420` 11/11 SUCCESS；
- C-013 Draft PR #166 verified head `e43e75ba8a18e013709578d5dfc64764c0d7b787`，CI run `32742512307` 11/11 SUCCESS；
- C-014 Draft PR #167 verified head `42be22699254a57a1607b4c2725c73e4006e6a45`，CI run `33317649790` 11/11 SUCCESS；
- C-015 Draft PR #168 当前 remote head `fd04b787926127bda64fc6cb07cfcf356d85ed8b`，CI run `33323476723` 11/11 SUCCESS；此前 implementation/status heads 只保留为历史证据；
- C-004～C-015 均保持 In Review、PR Draft、Issue Open；owner manual evidence 进入当前统一审核；
- exact-head merge verifier 因 Draft/unified review 延后，Production / RC 继续 `NO_GO`。

## 3. C-015 修复前交付

- `packages/shared-schemas` 建立 58 个事件的 executable registry：25 PRODUCT、14 optional PRODUCT、4 GOVERNANCE、10 RUNTIME、5 SAFETY_CONTROL；逐事件平面、生产者、属性和枚举封闭，wrong plane/unknown field/provider-model/正文/高基数 ref 整条拒绝；
- `POST /v1/analytics/signals` 只接受八类 identity-free 客户端信号；服务端绑定 product date/environment，前九个计数只在进程内，第十个才写 T4，写失败直接丢弃；Mini Program 2 秒超时、不附 session、不写 storage、不跨重启 replay；
- `@daily-energy/server-core/analytics` 实现 T0 transient observation → T4 的 `k=10`、最多两维、父桶/OTHER/移除第二维/全抑制和 raw-content detector；subject key 只存在于函数入参，不进入输出；
- 23 个 S-25 metric、4 个 count-free Gate、Wilson 95% 区间和 10 个 fixed fixture 已实现；D1/D3/D7 使用当前 ActivationCycle + EncounterLink 精确 D0+1/+3/+7 和成熟窗口；Q01/Q02 明确 `UNAVAILABLE`；
- PostgreSQL 新增四张物理隔离 T4 aggregate 表、metric snapshot 与 Gate snapshot；无 raw event/user/session/device/cross-day subject 表，API/Background 均无直接读取权限；约束强制 k、两维、suppressed 无精确值、revision replacement 和 13 个自然月 expiry；
- Background 静态 capability 新增 `AnalyticsAggregationDue` / `AnalyticsRetentionDue`；queue envelope 只有既有 opaque ref/revision/time，按上一 finalized product date 调封闭 rebuild/TTL 函数；
- 第三方 analytics/BI/ad/replay SDK、用户下钻、session replay、个体实验 assignment、素材/渠道 D1/D3/D7 均有静态 Gate 并保持关闭；只使用粗 `scene_code`；
- authority/source registry 新增 S-24 106 个 Source ID 与 S-25 79 个 Source ID，当前 `538/1004 COVERED`、`466 PLANNED`、`0 NA_WITH_REASON`。

## 4. C-015 修复前验证

- `pnpm agent:prepare C-015 --remote --deep`：`READY`，Profile=`security`，15 个 required sources，remote/dependencies/Node 24.18.0/pnpm 11.17.0/GitHub PASS；
- format、lint、architecture、typecheck、contract/codegen、registry、analytics static、phase Gate 与 `git diff --check` 全部通过；contract Gate 为 60 error codes / 66 paths，55 个根 JSON Schema；
- root tests `18/18` Turbo tasks、build `9/9`；API `155/155`、Mini Program `81/81`、server adapters `56/56`、server core `61/61`、shared schemas `64/64`、Worker `10/10`、API Client `4/4`；
- 真实 PostgreSQL 18 完整 Gate `90/90`：15 migrations、80 application tables、36 enums、81 functions、SQL-001～020、TX-01～09、角色/grant、catalog drift、upgrade/rollback/restore 与 C-001～C-015 专项全部 PASS；
- C-015 PG18 专项证明 API/Background 无直接 T4 read、sub-k/第三维/未知事件拒绝、23 metric/4 Gate、D1/D3/D7=`7/20`/`4/20`/`3/20`、same revision 不加倍、revision 2 重算 D1=`8/20`、Q01 UNAVAILABLE、forbidden columns=0 与 13-month purge；
- 真实 Redis 8 / BullMQ 5 / PostgreSQL 18 queue integration `8/8`；新增 Background capability 未破坏 outbox/inbox、empty Redis rebuild、profile、guard 和 drain；
- `pnpm agent:validate --mode=changed`：`changed→full / automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=task --task=C-015`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- `pnpm agent:validate --mode=full --task=C-015`：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- CI audit 单次 registry response metadata 异常后直接复核为 `critical=0/high=0`，三个最终 Gate 均在正常 audit 下自动化 PASS。

## 5. 统一审核修复结果

- C-004 固定跨 04:00 幂等回放与持久接受时钟；C-005 关闭 continuation visibility 竞态，并把实际 Node tzdb release 绑定到 runtime evidence、supply digest 与向后兼容的 ReleaseManifest；
- C-006 重算并验证 overall score；C-007 建立 12 类稳定 Safety violation code、精确 controlled-template binding 与一字称呼回归；
- C-008/C-010/C-011 在锁后复核 04:15/04:30、补 DAY guard 投影与可重试 DayLit outbox，并修复历史 cache note/MISSING/TTL/scope；C-009 恢复 Today 接受布局顺序；
- C-012/C-014 对 Safety/DataTask 写入强制 ACTIVE account fence；C-013 对 superseded weekly snapshot/summary 使用不续期的固定 30 天 expiry；C-014 客户端在发请求前拒绝并清除过期删除状态 grant；
- C-015 修正内存 cell identity、封闭版本桶、页面 signal wiring、M05/M19/M22、G01～G04 fail-closed evidence 与 deletion-aware source query；
- Prisma migration checksum、catalog fingerprint 与 API contract 已重新生成；正式 contract fingerprint 为 `4f25a52e42831a6ecaee032c92a92244e262169e452cf8a25389c0ba450a89a5`。

## 6. 修复后验证

- `pnpm agent:validate --mode=full --task=C-015` 使用 checksum 校验的临时 Node `24.18.0` 与官方 registry：`automated=PASS / MANUAL_EVIDENCE_REQUIRED`；required manual evidence=`threatBoundaryReview, productionAuthorizationWhenApplicable`；
- root tests `18/18` Turbo tasks、build `9/9`；API `158/158`、Mini Program `87/87`、shared schemas `64/64`、server core `65/65`、prompt library `12/12`、server adapters `57/57`；
- 真实 PostgreSQL 18 完整 Gate `90/90`，DB drift=`80 tables / 36 enums / 208 indexes / 225 constraints / 36 triggers / 83 functions`；真实 Redis 8 / BullMQ 5 / PostgreSQL queue Gate `8/8`；
- E-012 deployment contract `50/50`，证明新发布必须保存真实 tzdb release、runtime/manifest 漂移 fail closed，同时历史 ReleaseManifestV1 仍可读取；
- PR #169 verified status head `884a2050f19352bfb2371535a1c9f9abc29b2e6e` 的 CI run `33357674745` 为 11/11 SUCCESS；
- PR #169 owner-reviewed head `405f3c29fc916cfb314f9a665e8093df57911bf6` 的 CI run `33357978808` 为 11/11 SUCCESS；
- PR #169 merge-strategy head `3d33a80df646097cc1fcef361e9c4a08703cd656` 的 CI run `33368423171` 为 11/11 SUCCESS；
- format、lint、architecture、typecheck、codegen、contract、registry、agent workflow、CI audit/supply chain、`git diff --check main` 均通过；
- full Gate 内部 `prisma generate` 的非语义格式副作用已按项目所有者授权恢复；四个 C-014 生成模型只保留行尾空白清理。

## 7. 手工证据与发布边界

- manual evidence：`tests/manual-rc/c015-evidence.json`；owner differential-query/four-plane threat review 已通过；WeChat DevTools/真机 offline no-replay、生产 bundle 无第三方 SDK 与实际主体/位置/用户说明仍 Pending，不由 Agent 自签；
- C-004～C-015 的 owner content/design/threat/real-device evidence 进入统一审核，不因自动 Gate 全绿而伪造人工 PASS；
- 生产 scheduler、incident threshold、受托方、部署、发布与 Production authorization 不属于自动 C-015 证明；Production / RC 保持 `NO_GO`。

## 8. 精确下一动作

1. C-016 只使用 synthetic DEV_LITE 完成首次进入到七天、删除、并发、离线、Redis loss、Worker crash、维护和 Safety 的黑盒回归；
2. C-015 生产 bundle、主体/位置/受托方/跨境、最终用户说明与 Legal review 继续独立补齐；这些延期项不阻塞 C-016 development，但持续阻塞 Production/RC；
3. C-016 Done 后才能把 C-017 提升为 Ready；C-017 只形成 Phase 3 development 的 go/fix/no-go，不自动部署生产、招募用户或开始 Alpha。

## 9. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 修复与新增证据通过后重新进行统一审核；项目所有者明确批准前不运行 exact-head verifier、不更新完成状态或准备合并。

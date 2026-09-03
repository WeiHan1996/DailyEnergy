# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-09-03
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-015 — C-004～C-015 统一审核修复
- **任务状态**：Blocked（实现与统一修复已 merge；DevTools/iOS no-replay 已执行，等待 Android、生产 bundle 与 Privacy/Legal 证据）
- **任务 Profile**：`security`（幂等、Safety、删除不复活、隐私、确定性与 analytics 可信性）
- **工作分支**：`agent/c015-post-merge-handoff`
- **修复基线**：[C-015 Draft PR #168](https://github.com/WeiHan1996/DailyEnergy/pull/168)，remote head `fd04b787926127bda64fc6cb07cfcf356d85ed8b`，CI run `33323476723` 11/11 SUCCESS
- **任务 Issue**：[C-015 Issue #68](https://github.com/WeiHan1996/DailyEnergy/issues/68)；保持 Open
- **当前 PR**：[C-015 外部证据准备 Draft PR #170](https://github.com/WeiHan1996/DailyEnergy/pull/170)；base=`main`，verified implementation head `9022e5b713d838196c14e6280d481f444e65cb15`，CI run `33579547592` 11/11 SUCCESS
- **合并状态**：main head `fec5c96d368f8d4427ecca861f8ce42adad7a270`，CI run `33374088290` 11/11 SUCCESS
- **下一候选动作**：执行 Android no-replay；修复并绑定实际生产 origin/image/manifest；完成处理主体、位置/受托方/跨境与最终用户说明审核；不启动 C-016
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 2026-09-02～09-03 外部证据补齐进度

- 项目所有者已授权 Agent 准备 C-015 剩余证据，并在微信开发者工具中提供“见见今天”的既有 AppID；AppID 只用于本机忽略配置和 IDE 项目，不写入仓库或证据正文；
- 微信开发者工具 `Stable v2.01.2510290` / 基础库 `3.7.12` 已通过 11 路由 smoke；owner 明确允许后仅开启本地服务端口，登录票据、默认信任和多端插件端口保持关闭；增强 no-replay runner 证明 `dimensions_expanded` 的 restart replay=`0`、fresh signal=`1`、storage keyword/digest change=`0`，完成后服务端口已恢复关闭；
- iPhone 17 / iOS 26.5 / 微信 `8.0.76` 使用 ENT-001 真机调试和只接收合成 `landing_viewed` 的临时 HTTPS recorder：正向通路先验证，正式清零后离线重启=`0`、恢复网络缓存恢复=`0`、显式新调试刷新产生正向事件；AppID 未持久化，私有 `urlCheck` 已恢复 `true`，Quick Tunnel 与 recorder 已终止；iOS no-replay 证据完成；
- Android 设备已确认为 Xiaomi MIX 2S / Android 10 / MIUI 12.5.1 / 微信 `8.0.76`；2026-09-03 已构建 STAGING 合成包并生成 Android 真机调试二维码，但 DevTools session 持续报告微信 websocket 域名解析失败且未建立真机会话；模拟器产生的两条正向事件已排除，no-replay 仍为 `INFRA_BLOCKED / PENDING_EXECUTION`，Quick Tunnel 与 recorder 已终止并恢复 LOCAL 配置；
- 当前 head 的 LOCAL 候选 bundle build、Mini Program bundle Gate、C-015 analytics static test、已构建产物与 lockfile 禁止 SDK 名称扫描均通过；使用 Node `24.18.0` 生成的 supply-chain evidence 为 `5406` 个 build files、`750` 个 SBOM packages，artifact scanner PASS；这些结果未绑定实际 PRODUCTION API origin 或生产 OCI image，不能升级为生产 bundle PASS；
- 2026-09-02 npm 官方 audit 新报告 transitive optional `mysql2@3.15.3` 的 high advisory `GHSA-3f6p-5ww8-9rcr`；当前分支用最小 override `mysql2@3.22.0` 修复，复核为 `critical=0/high=0`，完整自动 Gate 已在 `9022e5b` 通过；
- 2026-09-03 npm 官方 audit 新报告 transitive optional `fast-uri@3.1.5` 的四个 high advisory（`GHSA-5jgf-p345-68v8`、`GHSA-f65p-4m7j-42xc`、`GHSA-fph4-wmhf-6fwf`、`GHSA-jqff-g426-hqxp`）；当前分支将既有最小 override 提升到 `fast-uri@3.1.6`，唯一生产解析版本与 frozen lockfile 策略通过，官方 audit 复核为 `critical=0/high=0`；Node `24.18.0` 下 `changed→full` Gate 为 `automated=PASS / MANUAL_EVIDENCE_REQUIRED`；
- 首次修复 head `284f707` 的 CI 暴露 C-014 固定 2026-08-25 业务时钟与 queue `now()` 混用，导致 2026-09-02 后 status retention 抢先；`9022e5b` 为 due query 增加默认服务端当前时间、测试可注入的 `asOf`，真实 PostgreSQL 18 回归和 CI db-integration 均通过；
- `9022e5b` 的 CI run `33579547592` 为 11/11 SUCCESS，覆盖 docs/static/unit-contract/db/queue/API/Admin/resilience/AI/supply-chain/full Gate；这些自动证据仍不替代 DevTools/真机和 Privacy/Legal 人工证据；
- GitHub 当前只有 `development` environment，仓库和该环境均无 Actions variable/secret；没有可绑定的 STAGING/PRODUCTION API origin、生产 image set 或 Release Manifest；
- `api.weihan.ltd` 已通过两台阿里云权威 DNS 和系统 resolver 验证 A 记录发布，未发布 AAAA/CNAME；公网 HTTPS/HTTP 端口均超时而 SSH 可达，因此 TLS handshake、API 健康检查和生产 origin 绑定仍未通过；owner 已将旧腾讯云主机定为 `DEV_ONLY_EXPIRING`，阿里云主机仅为 `PRODUCTION_CANDIDATE / ADMISSION_PENDING`；
- 腾讯云 SSH 用户名由 owner 确认为 `ubuntu`，但专用密钥的严格公钥认证于 2026-09-03 被主机拒绝；未读取服务器内容，也未尝试其它账户。解锁条件是确认该公钥已安装到 `ubuntu` 或更正实际用户名；
- 本地脱敏 receipt 为 `.artifacts/c015/evidence-receipt.json`，SHA-256=`88038807f15fdfa3ccf67e4441018f789eb591d989f9d78103353019ec6a74f5`；该 ignored artifact 不替代 tracked 摘要、owner 接受或 CI；
- 实际处理主体、安徽合肥登记属地、隐私联系、Android 版本和“不向不满十四周岁用户提供服务”的 owner 输入仅保存于 ignored 本地表；未成年人决定仍需 Accepted 规范与最小拒绝路径，Privacy 工程自审仍 Pending，Legal reviewer 保持 `PENDING_QUALIFIED_PRC_LEGAL_REVIEWER`；
- 仍需完成：Android no-replay、生产组件/受托方/region/跨境矩阵、最终用户说明和合格 Legal review。

## Post-merge receipt

- #157～#169 均先通过 exact-head verifier，再以 `--merge --match-head-commit` 合入 main；13 个原 PR head 均已验证为最终 main 的祖先，13 个 merge commit 均为双父；
- merge commits：#157 `4ac2009b`、#158 `38138a78`、#159 `aad63032`、#160 `873bcc24`、#161 `7d6d5cb9`、#162 `2e8935ed`、#163 `812595cf`、#164 `0ee0e66c`、#165 `90e8e23c`、#166 `6ee5e9fd`、#167 `2fa0df61`、#168 `d7411c18`、#169 `fec5c96d`；
- 最终 PR #169 exact head `453eb55504dab35209c0886eefede51342547199`，CI run `33373613585` 11/11 SUCCESS；merged-main CI run `33374088290` 11/11 SUCCESS；
- 一次性 merge window 完成后，repository `allow_merge_commit=false` 已恢复；main ruleset `21080906` 已恢复 deletion、non-fast-forward、required-linear-history、squash-only、11 strict checks、空 bypass；
- post-merge 状态最初通过 docs-only Draft PR #170 提交；owner 后续授权在同一 C-015 PR 完成证据准备、供应链 high 修复和固定时钟回归，PR 继续保持 Draft 且不解除剩余人工/生产 blocker；
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

1. **解锁条件**：完成 Android 真机网络证据，证明 offline signal 不持久化、不跨重启 replay；
2. 提供生产 bundle 检查，证明不含第三方 analytics/BI/ad/replay/attribution SDK；
3. 提供实际处理主体、生产位置与用户说明的 privacy/legal 确认；生产 scheduler 与 incident threshold 继续留在 Production Gate；
4. 证据齐备并获 owner 接受前，C-015 保持 Blocked、Issue #68 保持 Open、C-016 不启动、Production/RC 保持 `NO_GO`。

## 9. C-015 后统一审核

- 汇总 C-004～C-015 每个 Draft PR 的 final head、同 run CI、自动 Gate、手工证据和未决决定；
- 比较完整 stack 与 `main`，确认无任务越界、无下游偷跑、无安全/隐私/发布边界降低；
- 修复与新增证据通过后重新进行统一审核；项目所有者明确批准前不运行 exact-head verifier、不更新完成状态或准备合并。

# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-04（E-011 security 复核与 Linux Gate 10/10 通过，365 天 retention 待授权）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-011 — 建立 GitHub Actions CI 与供应链 Gate
- **任务状态**：Blocked
- **任务分支**：`agent/e011-ci-supply-chain`
- **当前 Issue**：[E-011 Issue #48](https://github.com/WeiHan1996/DailyEnergy/issues/48)
- **当前 PR**：[Draft PR #119](https://github.com/WeiHan1996/DailyEnergy/pull/119)；[状态 PR #118](https://github.com/WeiHan1996/DailyEnergy/pull/118) 已合并
- **基线提交**：`604db047938444898c222f7136cc9ac1ec333dd4`
- **Gate 结论**：`GITHUB_AUTOMATED_PASS / RETENTION_AUTHORIZATION_BLOCKED / MANUAL_EVIDENCE_PENDING`
  （security profile；GitHub clean run 10/10 automated job 通过；Accepted supply-chain evidence
  要求 365 天，但仓库上限将其降为 90 天；外部/人工 lane 保持明确 pending，不能报告任务 PASS）

## 1. 当前目标

把 clean checkout、代码质量、契约、测试、构建、安全和供应链检查变成最小权限、
可复现、fail-closed 的 GitHub Actions required CI lanes。

```text
clean checkout + pinned Node/pnpm/actions/images
  -> install / format / lint / type / arch / schema / db / test / build / security
  -> Source-ID / coverage / secret / raw-content / cardinality evidence
  -> bounded, redacted artifacts + SBOM / provenance
  -> required checks and branch protection evidence
```

E-011 已从状态 PR #118 的 squash merge `604db047938444898c222f7136cc9ac1ec333dd4`
创建实现分支。Issue #48、`pnpm agent:prepare E-011 --remote --deep` 返回的 required
sources，以及 Accepted testing、deployment、observability、architecture、
repository-structure、ADR-0006 和 E-010 registry/policy 原文均已读取；开工结论为 GO。

## 2. 状态变更影响

- [PR #118](https://github.com/WeiHan1996/DailyEnergy/pull/118) 已于 2026-08-03 squash
  合并为 `604db047938444898c222f7136cc9ac1ec333dd4`，E-010 已完成交接；
- 本地 `main` 与 `origin/main` 已对齐到该提交，E-011 分支基于同一提交；
- E-010 进入 Done，E-011 成为唯一 In Progress；E-012～E-014 与其它任务继续 Planned；
- E-010 已建立的 registry 仍有 736 个唯一 Source ID；E-011 新增可执行 proof 后为
  155 个 `COVERED`、581 个 `PLANNED`、0 个 `NA_WITH_REASON`；
- D-001～D-005 继续 Planned，不创建 Figma、Design Tokens 或业务页面。

## 3. 范围

- 创建 install、format、lint、type、arch、schema、db、test、build 与 security CI lanes；
- 固定 Node、pnpm、Actions、容器 image 和工具的受审版本或 digest；
- 为 workflow 设置最小 `permissions`、concurrency、timeout、fork/PR secret 隔离；
- 生成 SBOM/provenance、测试报告、Source-ID/coverage 与 secret/raw-content/cardinality 证据；
- 设置 bounded artifact TTL、失败摘要、cache key/内容边界与可复现诊断；
- 建立 workflow lint、最小权限和 known-fail fixture，证明 drift、skip、未知 ID 与泄漏命中
  会 fail closed；
- 在 GitHub 真实运行中证明 clean checkout 稳定，并记录 required-check/branch-protection 证据。

## 4. 不做

- 不创建生产部署权限、长期 PAT、自动合并或真实环境资源；
- 不向 PR/fork workflow 暴露部署、生产、provider 或用户数据 secret；
- 不上传 Prompt、真实用户内容、Safety 原文、provider raw body 或高基数标识；
- 不把 cache、artifact、SBOM 或 provenance 当作授权真值；
- 不启动 E-012、E-013、E-014、D-001 或业务实现任务；
- 不降低 Accepted ADR、Schema、API、隐私、Safety、删除、幂等、事务、profile 或
  可观测性边界。

## 5. 验收与证据

- required checks 覆盖 clean checkout 与全部 12 类边界/供应链 Gate；
- workflow/action 权限最小，PR workflow 不获得生产 secret，cache/artifact 不含敏感内容；
- Schema/codegen/drift、跳过测试、未知 Source ID、泄密/正文/高基数命中均 fail closed；
- workflow lint、最小权限检查与 known-fail fixture 通过；
- clean CI 重复运行稳定、无隐式 provider/生产网络调用，失败摘要可复现且经过脱敏；
- SBOM/provenance、artifact TTL 与 retention 符合 Accepted testing/deployment 合同；
- E-011 覆盖的 Source ID 从 `PLANNED` 更新为 `COVERED`，或使用获批准的
  `NA_WITH_REASON`；
- 实现后运行 changed、task 与 full security Gate，并提交一个聚焦 Draft PR。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **前置依赖**：E-001～E-010 均已完成，E-010 registry、runner 与 artifact policy 可用；
- **外部依赖**：开工时用 `--remote --deep` 核对 GitHub Actions、Docker、浏览器、
  微信 DevTools、runner 与 branch protection；缺失外部能力时返回明确 pending/blocked，
  不能伪报 PASS；
- **外部 lane**：`miniapp-conformance=INFRA_BLOCKED`、
  `ai-model-load-human=PENDING_EXPLICIT_AUTHORIZATION`、
  `manual-rc=MANUAL_EVIDENCE_PENDING`；普通 PR workflow 不创建替代 PASS；
- **artifact retention**：Accepted supply-chain evidence 要求 365 天，但仓库当前最大值为
  90 天，GitHub 首轮已明确把 workflow 的 365 天请求降为 90 天；修改仓库 retention 或选择
  其它获批准的 365 天存储前需要显式授权，当前不能报告 retention PASS；
- **授权边界**：提交 workflow 与 Draft PR 属于本任务；启用或修改 required checks、
  branch protection、repository secret/environment 前必须核对目标并保留用户授权证据；
- **security profile**：人工边界复核已完成；checkout credential、secret/fork、第三方 action、
  artifact scan-before-upload、cache、SBOM/provenance 绑定和供应链残余风险均已核对，发现的
  credential 持久化、扫描失败仍上传与 provenance 绑定缺口已修复并由 Linux clean run 验证；
- **Windows Gate 结果**：changed/task/full Agent Gate 均在全仓 `format:check` 首步正式
  `FAIL`，原因是系统 `core.autocrlf=true` 使 333 个未修改基线文件以 CRLF 检出；后续直接
  诊断还确认 contract/codegen 字节指纹、POSIX 单引号 architecture script、数据库
  `D:\D:\...` URL pathname、CRLF shebang fixture 与 SIGTERM 语义均受 Windows 环境影响。
  这些结果保持 FAIL/infra 证据，不改写为 PASS；权威 clean run 由固定
  `ubuntu-24.04` 的 GitHub Actions 补齐；
- **并行规则**：E-011 是唯一当前任务并处于 Blocked；不提升其它任务；
- **下一动作**：取得用户对以下二选一的明确授权：把 DailyEnergy 仓库 Actions artifact
  retention 上限提高到 365 天，或批准等价的受控 365 天 supply-chain evidence 存储；落实并
  验证后把本文件更新为 In Review；
- **下一任务**：E-011 完成前不提升 E-012；E-011 获接受后再评估 E-012。

## 7. 最近交接

- E-010 配置 root Vitest projects、真实 Nest HTTP Playwright、PG/queue、Admin Chromium
  与微信 DevTools runner，并建立合成 fixture、fault plan、sticky flaky、quarantine、
  artifact/corpus scanner 和 pending evidence 模板；
- registry completeness/negative tests `5/5`、harness/policy `12/12`、root Vitest projects
  `28 files / 156 tests`、真实 Nest HTTP Playwright `4/4` 均通过；
- E-010 changed/task/full Agent Gate 在 PR 前均为 `automated=PASS`；security 人工复核确认
  只使用合成数据、环回测试服务、默认封闭 provider/外部网络，生产授权不适用；
- coverage target 保持 Accepted 阈值，当前继承基线缺口未被降级或伪报 PASS；微信
  DevTools、真机、外部 AI/load/人评/专业证据继续显式 pending；
- PR #117 已 squash 合并为 `68bcc2e0bd7002b20e1de39a06a96f32e0ad21c4`，Issue #49
  已由合并关闭，本地与远端 `main` 已对齐；
- 合并态 LF worktree 的 format、workspace/config/ESLint、architecture dependency/boundary、
  codegen、contract 与 agent workflow Gate 已通过；Windows 聚合 full Gate 的环境限制已在
  本文记录，未把基础设施限制升级为代码 PASS；
- E-011 Issue #48 为 Open、Milestone 为 Phase 1，前置 E-001～E-010 均已完成；状态
  交接提交 `26ea3c58858f07346e40e1f2a1844d7e28660b3b` 已推送到
  `agent/e011-ready`，[Draft PR #118](https://github.com/WeiHan1996/DailyEnergy/pull/118)
  已 squash 合并为 `604db047938444898c222f7136cc9ac1ec333dd4`；
- 本地 `main`、`origin/main` 与 GitHub `main` 已验证指向同一签名提交，E-011 实现分支
  `agent/e011-ci-supply-chain` 已从该提交创建；
- E-011 实现提交 `a407201957c7c2a94166756e09daf6c1eb4b1d86` 已推送并创建
  [Draft PR #119](https://github.com/WeiHan1996/DailyEnergy/pull/119)；PR 保持 Draft，不启用自动
  合并或仓库权限变更；
- 首轮修复提交 `8cd0b36ed0830ede6a068533a8952e4be5ff96a2` 已推送；GitHub clean run
  [#30874806384](https://github.com/WeiHan1996/DailyEnergy/actions/runs/30874806384) 的 10/10
  automated job 全部成功，包括真实 PostgreSQL、Redis/BullMQ、API/Admin E2E 与 supply-chain；
- security 人工边界复核发现 checkout 默认持久化 credential、artifact scan 失败后仍会执行上传、
  provenance subject 文件名及 digest/commit/lockfile/SBOM 绑定不完整；修复提交
  `7a516e6823d1b6337ebc9d51ab4bd3604c2450d7` 已推送，GitHub clean run
  [#30875863656](https://github.com/WeiHan1996/DailyEnergy/actions/runs/30875863656) 再次 10/10
  通过，PR #119 保持 Draft、mergeable/clean；
- `agent:prepare --remote --deep` 的自动结果因缺少 `gh` 与裸 `pnpm.exe` 为
  `INFRA_BLOCKED`；Issue/main/commit 由 GitHub API/页面复核，Node、Corepack pnpm
  `11.17.0` 与 12 个 workspace 依赖均通过等价检查，开工结论为 GO；
- 已创建 `.github/workflows/ci.yml`：固定 `ubuntu-24.04`、Node `24.18.0`、pnpm
  `11.17.0` 和三个 immutable action SHA，使用只读 contents 权限、concurrency、45 分钟
  timeout、9 个自动 lane、14 天合成证据与 365 天供应链证据；checkout 不持久化 credential，
  artifact 只有在前置扫描成功后才上传；不使用 secret、OIDC、environment 或第三方 Turbo remote cache；
- `tests/ci` 与 `tooling/ci` 已建立 workflow/policy、fork secret、artifact TTL、cache、
  telemetry 基数、license、production vulnerability、SPDX 2.3 SBOM、build digest 与明确
  `UNSIGNED/PENDING` provenance Gate；CI policy 测试 `19/19` 通过；
- production audit 当前 `critical=0`、`high=0`；root build `7/7` 通过；supply-chain evidence
  已覆盖 12,956 个 build files 与 715 个 dependency packages，4 个 JSON artifact 约 3.3 MB，
  内容扫描、digest、SBOM/provenance 校验均通过；
- Next 已从 `16.2.12` 升级到 `16.3.0`，并对 `brace-expansion` 与 `fast-uri` 采用精确安全
  override；`apps/admin/next-env.d.ts` 是 Next 16.3 生成的合法变化；Admin 使用官方
  `--webpack` 构建路径，并以 `fileURLToPath` 规范化 `outputFileTracingRoot`，Windows 完整
  build 已验证 standalone 只写入 `.next/standalone`，不再生成仓库根 `Projects/` 副本；
- build digest 允许解析后仍位于仓库内的 Linux symlink/Windows junction，并以构建逻辑路径
  记录目标文件字节；外部链接、断链、特殊文件和祖先循环均 fail closed，正向、逃逸与循环
  测试均已通过；artifact 不记录机器绝对链接目标；
- changed/task/full security Gate 已在 Windows 执行并按上文保持正式 FAIL；目标 E-011 文件
  Prettier、workspace/config、ESLint、架构边界与 dependency-cruiser 直接入口、14/14
  typecheck、7/7 build、registry `5/5`、CI policy `19/19`、agent/admin/Playwright/queue
  evidence、production audit 与 supply-chain evidence 均已分别通过；
- GitHub 首轮 clean run [#30873436444](https://github.com/WeiHan1996/DailyEnergy/actions/runs/30873436444)
  为 3/10 job 通过：失败根因为 shallow checkout 缺少 `origin/main`、clean checkout 未先构建
  Admin/API workspace 依赖、Next build config 被误分为 client bundle、TX fixture 硬编码 macOS
  Prisma 路径、BullMQ failed-job 对象读取竞争和 Linux sharp/libvips license 表达式差异；以上均已
  以完整 checkout policy/负向 fixture、显式依赖构建、边界 fixture、跨平台路径、settled-job
  重取和精确 license policy 修复；本机无容器 runtime，PG/Redis 真实回归等待 GitHub runner；
- registry 当前为 `736 total / 155 COVERED / 581 PLANNED`，净新增 17 个覆盖；
  `S33-OBS-041` 因 PAGE/IR 行为尚未实现继续为 `PLANNED`；
- 尚未创建 required checks、branch protection、repository secret/environment、OIDC、生产
  资源或自动合并；这些能力必须在核对目标并取得明确授权后另行处理。

# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-03（E-010 合并完成并提升 E-011）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-011 — 建立 GitHub Actions CI 与供应链 Gate
- **任务状态**：Ready
- **任务分支**：实现分支尚未创建；状态交接分支为 `agent/e011-ready`
- **当前 Issue**：[E-011 Issue #48](https://github.com/WeiHan1996/DailyEnergy/issues/48)
- **当前 PR**：[状态 Draft PR #118](https://github.com/WeiHan1996/DailyEnergy/pull/118)
- **基线提交**：`68bcc2e0bd7002b20e1de39a06a96f32e0ad21c4`
- **Gate 结论**：`READY_TO_START`（security profile；workflow、权限、secret、artifact、
  provenance 与供应链路径必须运行 full Gate，并保留 GitHub 运行和人工授权证据）

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

E-011 当前只进入 Ready，尚未创建实现分支或 CI workflow。开工必须读取 Issue #48、
`pnpm agent:prepare E-011 --remote --deep` 返回的全部 required sources，以及 Accepted
testing、deployment、observability、architecture、repository-structure、ADR-0006 和 E-010
registry/policy 原文；随后核对 GitHub Actions、runner、权限、cache、artifact 与分支保护
现状并给出 GO/NO-GO。

## 2. 状态变更影响

- [PR #117](https://github.com/WeiHan1996/DailyEnergy/pull/117) 已于 2026-08-03 squash
  合并为 `68bcc2e0bd7002b20e1de39a06a96f32e0ad21c4`，E-010 Issue #49 已关闭；
- 本地 `main` 与 `origin/main` 已对齐到该提交，合并态工作树干净；
- E-010 进入 Done，E-011 成为唯一 Ready；E-012～E-014 与其它任务继续 Planned；
- E-010 已建立 736 个唯一 Source ID：138 个 `COVERED`、598 个 `PLANNED`、
  0 个 `NA_WITH_REASON`，E-011 必须更新自己覆盖的 ID，不得静默跳过；
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
- **授权边界**：提交 workflow 与 Draft PR 属于本任务；启用或修改 required checks、
  branch protection、repository secret/environment 前必须核对目标并保留用户授权证据；
- **security profile**：需要人工复核 workflow 权限、secret/fork 边界、第三方 action、
  artifact/caching、SBOM/provenance 与供应链残余风险；
- **Windows Gate 风险**：合并后本地复核确认系统 `core.autocrlf=true` 会把 LF checkout
  转为 CRLF；Node `execFile("pnpm")` 需要可执行 shim；部分 package script 使用 POSIX
  quoting；database tooling 用 URL pathname 组装 Windows 盘符会得到重复盘符。E-010 PR
  的完整自动 Gate 已在合并前 PASS，合并 SHA/格式与主要叶子 Gate 已复核；E-011 必须把
  clean Linux CI 设为权威执行环境，并为 Windows 开发者入口记录或修复明确兼容路径；
- **并行规则**：E-011 是唯一 Ready，尚未 In Progress；
- **下一动作**：审核并 squash 合并状态 PR #118；合并后从最新 `main` 创建 E-011 实现分支，运行
  `pnpm agent:prepare E-011 --remote --deep`，读取全部 required sources 并给出 GO/NO-GO；
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
  已创建且无冲突；当前未创建 workflow、required checks 或外部资源。

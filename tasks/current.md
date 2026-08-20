# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-20
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：E-016 — 公开仓库并恢复平台强制 CI Gate
- **任务状态**：In Progress
- **任务 Profile**：`security`
- **当前分支**：`agent/public-repository-controls`
- **当前 Issue**：[E-016 Issue #148](https://github.com/WeiHan1996/DailyEnergy/issues/148)
- **当前 PR**：[Draft PR #149](https://github.com/WeiHan1996/DailyEnergy/pull/149)
- **被中断任务**：C-001 — 实现微信身份与安全会话；分支 `agent/c-001-wechat-auth`，Draft PR #147，精确 head `c5e7cd19edea1a3c62a747fbb24b9e7d6e3d036d`
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

将 `WeiHan1996/DailyEnergy` 从 private GitHub Free 转为 public，在不增加 LICENSE、
不重写历史、不暴露生产 secret 的前提下恢复免费 GitHub-hosted Actions，并把 testing 22.2
的临时人工补偿控制迁移为 GitHub 平台强制的 `main` 保护。

E-016 范围：

- 公开前扫描 Git 历史、Issue / PR / 评论、Actions 日志、artifact 元数据和设计截图；
- 用户明确接受公开历史、提交者邮箱和 Figma 身份信息，仓库保持无 LICENSE；
- 可见性切换后立即启用无 bypass 的 `main` ruleset；
- 只允许 PR 和 squash merge，禁止 direct / force push 与 `main` 删除；
- 强制 strict、同一 CI workflow 的 11 个 required checks；
- 启用 secret scanning、push protection 与外部贡献者 Actions 审批；
- 更新 executable CI policy、测试、registry、Accepted 当前状态和 durable handoff；
- E-016 合并并验证后恢复 C-001，不修改其业务代码。

不做开源许可证选择、Git 历史重写、历史分支 / Issue / PR / Actions 删除、生产凭据、部署或发布。

## 2. 授权与公开前证据

- 用户于 2026-08-20 明确授权将目标仓库设为 `PUBLIC`；
- 用户接受 92 个远端分支、54 个 Issue、93 个 PR、143 次 Actions 历史、提交者邮箱和
  Figma 截图中的 `han wei` 身份信息公开；
- 用户要求保持无 LICENSE；
- 仓库无 Actions secrets / variables；1,107 个 artifact 合计约 25.75 MiB；
- 高置信格式扫描覆盖 4,493 个远端对象 / 2,024 个 blob、全部 Issue / PR / 评论和
  143 次 Actions 日志，未发现真实 provider token、有效私钥或本机路径泄漏；
- 命中项均为合成测试、localhost credential URL、环境变量名、secret 文件路径或脱敏负例；
- 官方 Gitleaks 二进制的两次下载校验失败、Docker registry 返回 EOF，未执行不可验证程序；
  这是已披露残余风险，公开后必须立即启用 GitHub secret scanning / push protection。

## 3. 必须保持的边界

- GitHub 可见性改变会公开完整历史与 Actions 日志，执行前后必须核对精确仓库；
- visibility 改为 public 会禁用既有 push rulesets，转换后必须立即建立并验证新 ruleset；
- required checks 不得少于现有 11 项，aggregate Gate 不替代各 lane 的独立 required 状态；
- ruleset 不允许 bypass actor；独立 owner 的聊天批准继续是项目流程证据，但单人仓库不伪造
  GitHub reviewer；
- public fork PR 不获得 secret、OIDC、environment 或生产网络；外部贡献者 workflow 运行需批准；
- platform Gate 只是 Production / RC 基线，不能解除现有 `NO_GO`；
- C-001 代码和既有精确 head 保持不变，E-016 使用独立 PR。

## 4. 已完成实现与验证

- executable policy 已迁移到 `e-016-ci-policy-v4`，固定 public、无 LICENSE、squash-only、
  strict 11 checks、无 bypass `main` ruleset、外部贡献者审批与 GitHub 安全控制；
- 新增只读 `pnpm ci:verify-repository-controls`，保留 exact-head / 同一 run PR verifier；
- CI policy 27/27、Phase Gate 5/5、registry 736 项均通过；
- `pnpm agent:validate --mode=task --task=E-016` 在允许本地监听的环境中 automated `PASS`；
- security profile 所需 threat-boundary review 已完成，公开授权已由用户明确给出；Production
  authorization 不适用，Production/RC 继续 `NO_GO`；
- 初始实现提交 `b46715b` 已推送并创建 Draft PR #149。
- `WeiHan1996/DailyEnergy` 已切换为 public；merge/rebase/auto-merge 已关闭，仓库保持无 LICENSE；
- active、无 bypass 的 `DailyEnergy main protection` ruleset 已强制 PR、squash-only、linear
  history、review thread resolution、禁止 force push / 删除及 11 个 strict GitHub Actions checks；
- 外部贡献者 workflow 审批、secret scanning、push protection、vulnerability alerts 与
  automated security fixes 已启用；`pnpm ci:verify-repository-controls` 远端逐字段验证通过。

## 5. 精确执行顺序

1. 在当前分支更新 CI policy、校验器、测试、registry 和状态文档；
2. 本地执行针对性 Gate，创建 Draft PR 并记录 exact head；
3. 将精确仓库设为 `PUBLIC`，立即限制为 squash-only 并创建 active `main` ruleset；
4. 启用 secret scanning / push protection / vulnerability controls 与外部贡献者 Actions 审批；
5. 运行远端配置 verifier，并在 E-016 exact head 上取得 11/11 CI；
6. 用户审核后 squash merge E-016，验证 merged `main`；
7. 回到 PR #147，更新到新 `main`，只重跑 C-001 当前最终 head 的 CI；若业务 diff 未发生
   material change，可沿用既有 C-001 审核，否则重新请求审核。

## 6. 下一任务

E-016 完成后恢复 C-001；不要提前开始 C-002。

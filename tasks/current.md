# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-29
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-015 — 建立 Agent 上下文路由与分级验证入口
- **任务状态**：In Progress
- **当前分支**：`agent/e-015-agent-workflow`
- **当前 Issue**：[E-015 Issue #105](https://github.com/WeiHan1996/DailyEnergy/issues/105)
- **当前 PR**：无
- **基线提交**：`38676cad32ba16d242050570e943b812c0ae6018`
- **Gate 结论**：`GO_TO_IMPLEMENT`

## 1. 当前目标

实现已获用户确认的 Agent Token 优化 P0/P1：

```text
权威来源路由
  → 任务类型与影响范围
  → Requirement-to-Proof Matrix
  → changed / task / full 分级验证
  → 有界、脱敏的结果摘要
```

摘要只负责路由，相关权威原文和原始设计证据仍必须实际读取。无法确定影响
范围时必须扩大读取与验证，不能为了减少 Token 静默降低实现或审核质量。

## 2. 状态变更影响

- 用户明确要求先实施 E-015，因此 E-006 暂时从唯一 Ready 调整为 Planned；
- E-015 是唯一 In Progress，完成审核与合并后 E-006 恢复为唯一 Ready；
- [PR #103](https://github.com/WeiHan1996/DailyEnergy/pull/103) 已合并，
  最新 `main` 为 `38676cad32ba16d242050570e943b812c0ae6018`；
- D-001～D-005 继续保持 Planned，不创建 Figma、Design Tokens 或业务页面。

## 3. 范围

- 更新 `AGENTS.md`，允许通过索引路由相关权威原文；
- 建立 `docs/agent/PROJECT_CONTEXT.md`、正式工作流规范和版本化策略；
- 实现只读、默认快速的 `pnpm agent:prepare <TASK_ID>`；
- 实现统一的
  `pnpm agent:validate --mode=changed|task|full --profile=<PROFILE>`；
- 支持 `code`、`design`、`hybrid`、`docs`、`research`、`security`；
- 建立上下文冲突、D 系列依赖阻断、路径升级和输出脱敏 fixtures；
- 把 E-015 Gate 接入现有全仓 `pnpm run validate`。

## 4. 不做

- 不实现 P2 validation receipt、有效输入集哈希或日志 artifact 流水线；
- 不创建 GitHub Actions workflow、required checks、CI lane 或生产监控；
- 不建立完整 Source-ID registry、Testcontainers、Dev Container 或 remote cache；
- 不实现完整 Figma 自动化、视觉回归平台或 Design Token 生成；
- 不启动 E-006、D-001 或其他下游任务；
- 不修改产品定位、业务 Schema、数据库、API 或运行时 capability。

## 5. 验收与证据

- `agent:prepare` 默认只读、无远端调用、无文件修改且输出有界；
- `--remote` 和 `--deep` 必须显式启用；
- Task Packet/PROJECT_CONTEXT 不成为新权威源；
- `changed` 模式对未知、高风险、tooling/config 变化保守升级 full；
- D-004/D-005 未完成时，对相应 C 系列页面任务返回
  `DEPENDENCY_BLOCKED`；
- design/hybrid Profile 显式报告 Figma、Frame、人工和用户决定证据；
- 成功验证只输出摘要，失败只输出脱敏的根因附近内容；
- fixtures、format、lint、typecheck、test、build 和完整 validate 全部通过。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；
- **外部依赖**：无，不需要真实账号、密钥、Figma 或生产资源；
- **范围决定**：本任务只实施 P0/P1，P2～P4 保持后续；
- **并行规则**：E-015 是唯一 In Progress；
- **下一动作**：实现工具、fixtures 和文档，然后运行完整验证并创建 Draft PR；
- **接受后的下一任务**：E-006 — PostgreSQL 与 Prisma。

## 7. 最近交接

- E-005 已随 PR #98 合并，Issue #43 已关闭；
- D-001～D-005 已随 PR #103 纳入 Phase 2，当前全部 Planned；
- PR #103 已合并，merge commit 为
  `38676cad32ba16d242050570e943b812c0ae6018`；
- 已创建 E-015 Issue #105 并绑定 Phase 1 Milestone；
- 已从最新 `main` 创建 `agent/e-015-agent-workflow`；
- 已读取 README、ROADMAP、docs/INDEX、current/backlog、ADR-0006、
  repository-structure、testing 及相关 deployment/observability 边界；
- GO/NO-GO 结论为 `GO_TO_IMPLEMENT`；
- 已建立非权威 `PROJECT_CONTEXT`、版本化 authority index、validation policy
  与 Accepted Agent 工作流规范；
- 已实现默认只读本地的 `agent:prepare`，显式 `--remote` / `--deep` 可核对
  GitHub Issue、远端 main、Node、pnpm、依赖与登录状态；
- 已实现 `agent:validate` 的 changed/task/full 与六类 Profile，禁止显式 Profile
  降级，并对上下文冲突、D 系列依赖和人工/外部证据 fail closed；
- 为遵循 Accepted testing 规范，在 E-010 Source-ID dependency map 完成前，
  生产代码、测试、配置、tooling 和 Accepted 规范变化均保守升级 full；
- 已通过 24 条版本化 Agent workflow cases 与 3 条 CLI cases，覆盖只读准备、
  stale main、多活动任务、D-004/D-005 阻断、Profile 降级、输出边界与脱敏；
- `agent:prepare E-015 --remote --deep` 在可访问系统凭据的环境中全部 PASS；
- 最终实现已通过完整 `pnpm run validate`：format、lint、typecheck、test、
  Playwright、bundle/contract/architecture Gate 与 build 全部 PASS；
- 首次沙箱 run 因禁止监听 `127.0.0.1:3210` 以 `EPERM` 被环境阻断；在受控
  本地端口环境重跑同一完整 Gate 后 PASS，未放宽任何检查。

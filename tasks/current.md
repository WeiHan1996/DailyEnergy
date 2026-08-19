# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-19
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-001 — 实现微信身份与安全会话
- **任务状态**：Ready
- **任务 Profile**：`code`
- **计划分支**：`agent/c-001-wechat-auth`
- **当前 Issue**：[C-001 Issue #53](https://github.com/WeiHan1996/DailyEnergy/issues/53)
- **当前 PR**：无；开始实现后创建一个聚焦 Draft PR
- **最近完成设计任务**：D-005 已于 2026-08-19 获项目负责人明确接受；PR #146 合并后关闭 Issue #104
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

建立微信 code 交换、稳定账户身份和可撤销安全会话，客户端永不持有服务端身份密钥。

C-001 范围：

- 微信 auth adapter 与开发 stub；
- 账户查找 / 创建；
- session issuance / rotation / revoke；
- 公开身份 API、session guard、owner 绑定；
- 重放、限流、超时和微信不可用处理；
- 只保存允许的微信标识，按隐私数据地图最小化 / 保护，禁止进入日志和 analytics；
- 登录失败、session 过期和多端恢复。

不做手机号登录、社交关系、生产微信凭据或设备指纹。

## 2. 前置状态

- E-014 Phase 1 Gate 已完成，Phase 2 development 为 `CONDITIONAL_GO`；
- D-001～D-005 正式视觉前置全部 Accepted；
- D-005 Accepted 只解除 C-012 / C-013 / C-014 的设计前置，不改变 Production / RC `NO_GO`；
- C-001 Issue #53 的直接前置 E-014 已满足，因此 C-001 现在是唯一 Ready 工程任务。

## 3. 权威输入

开始实现前按 `AGENTS.md` 执行 routed context restore，优先运行：

`pnpm agent:prepare C-001`

若当前 connector 会话不能执行用户本机 checkout，则按 AGENTS fallback 至少读取：

- `docs/agent/PROJECT_CONTEXT.md`
- `docs/product/mvp.md`
- `docs/product/state-machine.md`
- `docs/technical/api.md`
- `docs/technical/database.md`
- 相关 Accepted ADR、privacy data map、error codes、OpenAPI / Zod contracts；
- 现有 auth / session / owner 附近代码和测试；
- C-001 对应 Accepted Source ID / 测试注册表。

如果权威源冲突或所需决策仍是 Draft，停止实现并报告 blocker，不自行猜测。

## 4. 必须保持的工程边界

- 同一微信主体并发首次登录只能产生一个有效账户；
- 客户端和公开 API 不暴露 openid / unionid 或服务端身份密钥；
- 无效、过期、撤销 session 必须 fail closed；
- owner guard 不能跨用户读取 / 写入；
- 微信外部调用必须在数据库事务外；
- 外部调用失败不能留下半账户事实；
- 真实 AppID / secret 未获批准时只使用 stub / development configuration；
- 身份标识不得进入普通日志、analytics、错误详情或 client-safe payload；
- 不降低既有事务、幂等、限流、超时、可观测性和 secret 边界。

## 5. 验收与测试

至少覆盖：

- 并发首次登录；
- code 重放 / 无效 code；
- session issuance、rotation、expiry、revoke；
- owner 越权；
- 微信外部故障 / timeout；
- 多端恢复；
- 敏感身份标识的日志 / client-safe 泄漏负例。

所有 C-001 覆盖的 Accepted Source ID 必须在测试注册表从 `PLANNED` 更新为 `COVERED`；无法覆盖时只能使用带批准理由的 `NA_WITH_REASON`。

## 6. CI 使用原则

延续项目约束：先在分支完成实现、针对性验证和 branch diff 自审，再创建 Draft PR；不要用反复推送 + CI 代替本地 / 静态分析。首次 PR CI 出现失败时先诊断原因，不自动 rerun。

## 7. 精确下一动作

1. D-005 PR #146 final-head 合并并关闭 Issue #104；
2. 从最新 `main` 创建 `agent/c-001-wechat-auth`；
3. 恢复 C-001 routed context，读取全部权威输入和附近实现；
4. 先形成实现 / 测试计划并确认范围仍能收敛在一个聚焦 PR；
5. 开始 C-001 实现。

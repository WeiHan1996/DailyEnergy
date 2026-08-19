# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-19
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-001 — 实现微信身份与安全会话
- **任务状态**：In Progress
- **任务 Profile**：`code`
- **当前分支**：`agent/c-001-wechat-auth`
- **当前 Issue**：[C-001 Issue #53](https://github.com/WeiHan1996/DailyEnergy/issues/53)
- **当前 PR**：无；本地生成物与验证收口后再创建一个聚焦 Draft PR
- **最近完成设计任务**：D-005 已接受并随 PR #146 squash 合并，Issue #104 已关闭
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

## 2. 当前实现状态

已在 `agent/c-001-wechat-auth` 完成实现并进行 connector 侧 branch diff / 权限边界自审：

- `PostgresAuthStore`：provider lookup token 级事务锁、Account / ExternalIdentity 原子建立、session hash 持久化、rotation / revoke；
- synthetic WeChat adapter：仅 LOCAL / CI / DEV 可用，同一 code 不可重放；STAGING / PRODUCTION / RECOVERY fail closed；
- AuthService / AuthController / SessionGuard：登录、refresh、logout、session principal；
- provider exchange 在数据库事务外；provider 失败不留下半账户事实；
- 登录 code exchange 有进程内短窗口 limiter，临时 key 由进程随机 HMAC 派生，不保存原始地址、不进日志 / analytics；
- provider timeout 有 3 秒 fail-closed 分支与单测；
- client-safe 响应不返回 `openid` / `unionid` / provider subject / lookup token / ciphertext / internal accountId；
- C-001 unit / contract / Nest HTTP E2E / PostgreSQL 18 DB evidence；
- `database:test:integration` 已接入 `tests/database/auth-identity.test.mjs`；
- C-001 evidence manifest 已映射 `S19-DB-001/002`、`S20-A01/A02/A06/C04`、`PDM-C01`；
- 新增 C-001 最小列级 ACL migration：`daily_energy_api` 只读取认证所需非 ciphertext 列，secret-bearing 列继续不可读。

## 3. 前置与权威状态

- E-014 Phase 1 Gate 已完成，Phase 2 development 为 `CONDITIONAL_GO`；
- D-001～D-005 正式视觉前置全部 Accepted；
- C-001 Issue #53 的直接前置 E-014 已满足；
- connector 会话无法执行用户本机 checkout，因此已按 `AGENTS.md` fallback 恢复 `PROJECT_CONTEXT`、authority index、API / database / privacy / testing / OpenAPI / Prisma / nearby code / registry 权威上下文。

## 4. 必须保持的工程边界

- 同一微信主体并发首次登录只能产生一个有效账户；
- 客户端和公开 API 不暴露 openid / unionid 或服务端身份密钥；
- 无效、过期、撤销 session 必须 fail closed；
- owner 只能来自服务端 session principal，不能接受客户端 accountId；
- 微信外部调用必须在数据库事务外；
- 外部调用失败不能留下半账户事实；
- 真实 AppID / secret 未获批准时只使用 synthetic development adapter；
- 身份标识不得进入普通日志、analytics、错误详情或 client-safe payload；
- API runtime 继续使用 `daily_energy_api` 最小数据库角色，不借用 migration / deletion / admin 权限。

## 5. 已建立的证据

- UNIT：同 subject 并发登录、code replay、session rotation / revoke、provider failure / timeout、server-side auth limiter、release synthetic-adapter deny；
- CONTRACT：严格 WeChat request、opaque SessionView、稳定 auth/rate-limit error surface；
- E2E：真实 Nest HTTP login / refresh / logout / expiry / client owner forgery rejection；
- DB：真实 PostgreSQL 18 + `daily_energy_api` login，验证身份唯一性、lookup token / randomized ciphertext 解耦、列级 ACL 与 ciphertext deny。

## 6. 当前剩余本地收口

由于当前 connector 不能执行本机命令，PR 创建前仍需在用户 checkout 上生成 / 验证以下仓库生成物：

1. `pnpm format`；
2. `pnpm registry:write`，生成新的 `tests/registry/coverage-registry.json`；
3. 在应用 C-001 migration 的真实 PostgreSQL 上重算 `prisma/migrations/catalog-fingerprint.json`；
4. 执行 C-001 routed / targeted validation；
5. 生成物与验证无误后再创建 Draft PR，避免用 CI 反复试错。

## 7. CI 使用原则

延续项目约束：PR 前完成本地格式化、registry / catalog 生成、针对性验证和 branch diff 自审；只在收口后创建一个聚焦 Draft PR。首次 PR CI 失败时先诊断，不自动 rerun。

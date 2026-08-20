# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-20
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-001 — 实现微信身份与安全会话
- **任务状态**：In Review
- **任务 Profile**：`security`（C-001 初始路由为 `code`，认证与数据库权限变更将有效 Profile 提升为 `security`）
- **当前分支**：`agent/c-001-wechat-auth`
- **当前 Issue**：[C-001 Issue #53](https://github.com/WeiHan1996/DailyEnergy/issues/53)
- **当前 PR**：待创建；本轮提交推送后创建聚焦 Draft PR，并由 Linux CI 完成平台限定的供应链 Gate
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

已在 `agent/c-001-wechat-auth` 完成实现与本轮安全修正：

- `PostgresAuthStore`：provider lookup token 级事务锁、Account / ExternalIdentity 原子建立、session hash 持久化、rotation / revoke；
- 现有身份登录对 Account 行加锁，refresh / logout 同时锁定 Session 与 Account，阻止并发 `DELETING` 或受限账户继续签发、轮换会话；
- 连接时复用数据库 runtime 的 closed-factory 角色探针，并保留 raw pool 身份校验，API runtime 只能使用预期最小权限角色；
- logout 将 command receipt 与 session revoke 放在同一事务，覆盖 `ACCEPTED` / `DUPLICATE` / `CONFLICT`，header / body command ref 不一致返回稳定幂等冲突；
- synthetic WeChat adapter：仅 LOCAL / CI / DEV 可用，同一 code 不可重放；STAGING / PRODUCTION / RECOVERY fail closed；
- AuthService / AuthController / SessionGuard：登录、refresh、logout、session principal；
- provider exchange 在数据库事务外；provider 失败不留下半账户事实；
- 已按 Accepted 单 Caddy hop 部署边界设置 `trust proxy = 1`；登录 limiter 使用 Express 解析后的客户端 IP，临时 key 由进程随机 HMAC 派生，不保存原始地址、不进日志 / analytics；
- 限流响应包含 `Retry-After` 与有界 `retry_after_seconds`，并记录低基数 rate-limit decision telemetry；
- production dependency audit 发现的 `deepmerge-ts <8.0.0` High 已通过最小 pnpm override 修复为 `8.0.0`，Prisma 保持 `7.9.1`；
- provider timeout 有 3 秒 fail-closed 分支与单测；
- client-safe 响应不返回 `openid` / `unionid` / provider subject / lookup token / ciphertext / internal accountId；
- C-001 unit / contract / Nest HTTP E2E，以及生产 `PostgresAuthStore` 的 PostgreSQL 18 集成测试代码；
- `database:test:integration` 会先构建 server adapter，再执行 `tests/database/auth-identity.test.mjs`；
- C-001 evidence manifest 已映射 `S19-DB-001/002`、`S20-A01/A02/A06/C04`、`PDM-C01`；
- 新增 C-001 最小列级 ACL migration：`daily_energy_api` 只读取认证所需非 ciphertext 列，secret-bearing 列继续不可读。

## 3. 前置与权威状态

- E-014 Phase 1 Gate 已完成，Phase 2 development 为 `CONDITIONAL_GO`；
- D-001～D-005 正式视觉前置全部 Accepted；
- C-001 Issue #53 的直接前置 E-014 已满足；
- `pnpm agent:prepare C-001 --deep` 已恢复 `PROJECT_CONTEXT`、authority index、API / database / privacy / testing / OpenAPI / Prisma / nearby code / registry 权威上下文，并报告 `READY`；
- 变更路径命中认证与数据库安全边界，有效 Profile 已从初始 `code` 提升为 `security`，必须执行 full Gate 与人工 threat-boundary review。

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

## 5. 已建立的证据与验证

- UNIT / CONTRACT / E2E：API 11 files、58 tests；server-adapters 10 files、40 tests；shared schemas 38 tests；miniapp 10 tests及 fixture Gates；worker 10 tests；API client 4 tests；Admin 14 unit tests、6 browser E2E、2 known-fail fixture tests，全部通过；
- WORKSPACE：`pnpm exec turbo run test` 10 / 10 workspace tasks 通过；`pnpm build`、`pnpm typecheck`、`pnpm lint:eslint`、`pnpm format:check` 通过；
- CONTRACT / REGISTRY / DB STATIC：Contract Gate 56 error codes / 62 paths；Registry 736 total / 210 covered / 526 planned；`codegen:check`、`registry:check`、`registry:test`、`database:check`、`database:test` 通过；
- DIFF：`git diff --check` 通过，最终变更只涉及 C-001 认证、契约、测试、证据和项目状态；
- MANUAL：已完成人工 threat-boundary review，未发现新的代码级阻断；确认身份密钥不进入公开响应 / 普通日志 / analytics，Account 删除状态与会话写入共享行锁，logout 收据与撤销原子提交，release 环境 synthetic adapter fail closed；
- FULL GATE：已安装本机 `flock 0.4.0` 并通过 deployment 阶段；format、architecture、codegen、contract、agent workflow、typecheck、全部 workspace tests、build、Registry、DB static、Phase Gate 与 dependency audit 均通过；
- POSTGRESQL 18：`pnpm database:validate` 全部通过；真实 Testcontainers 套件 83 / 83，覆盖生产 `PostgresAuthStore` 角色探针、列级 ACL、身份唯一性、登录 / 删除与 refresh / 删除锁竞争、logout receipt、migration lifecycle 和 TX-01～TX-09；
- QUEUE：真实 Redis 8、BullMQ 5、PostgreSQL 18 集成套件 7 / 7 通过；
- CATALOG：已在应用全部 migration 的临时 PostgreSQL 18 上重算并验证 fingerprint；仅总哈希与 `columnAcl` 从 0 条变为 5 条，其他 14 个 section 不变；
- SUPPLY CHAIN：官方 npm registry production audit 为 Critical 0 / High 0；本机 full Gate 在 license inventory 阶段按策略拒绝 macOS 可选包 `@img/sharp-libvips-darwin-arm64`，而 Accepted policy 只为生产 Linux 包提供条件许可，因此不得在本地放宽，必须由 Linux PR CI 完成该平台证据；
- MANUAL APPROVAL：用户于 2026-08-20 确认 C-001 审核通过并授权进入下一步。

安全 Profile 所需 threat-boundary review 与用户审核已完成；生产微信凭据与生产发布不在 C-001 当前授权范围，production authorization 当前不适用。自动化结论为 `LINUX_CI_PENDING`，不得在 Linux 供应链与 required checks 成功前合并。

## 6. PR 与精确下一步

1. 提交并推送当前聚焦变更，创建 C-001 Draft PR；
2. 由 Linux PR CI 验证 license inventory、供应链 artifacts 与全部 required checks；
3. required checks 全部成功后，按用户已给出的审核批准将 PR 标记 ready，并使用 squash merge；
4. 合并后切回并同步 `main`，把 C-001 更新为 Done，只将一个后续任务移动到 Ready。

**精确下一步**：提交、推送并创建 C-001 Draft PR，等待 Linux CI 结果。

## 7. CI 使用原则

延续项目约束：PR 前完成本地格式化、registry / catalog 生成、针对性验证和 branch diff 自审；只在收口后创建一个聚焦 Draft PR。首次 PR CI 失败时先诊断，不自动 rerun。

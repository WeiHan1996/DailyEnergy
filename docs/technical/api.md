# DailyEnergy API 契约

- **文档状态**：Accepted
- **接受日期**：2026-07-22
- **所属任务**：S-20 — API 契约
- **最后更新**：2026-08-28（C-014 按 ADR-0008 增补 revision discovery、零正文导出与删除状态续读）
- **适用范围**：微信小程序、NestJS API、最小管理后台的 HTTP 契约；幂等、权限、revision/CAS、Safety/deletion 阻断与 Unknown outcome
- **上游规范**：[产品状态机](../product/state-machine.md)、[业务规则](../product/business-rules.md)、[交互状态](../design/interaction-states.md)、[页面规格](../design/screen-specs.md)、[共享 Schema](../../packages/shared-schemas/README.md)、[领域模型](../data/domain-model.md)、[ADR-0005](../decisions/ADR-0005-data-retention-and-deletion.md)、[ADR-0008](../decisions/ADR-0008-data-rights-delivery-and-status.md)、[数据权利传输契约修订](./data-rights-contract-amendment.md)、[数据库规格](./database.md)、[AI Gateway](../ai/gateway.md)、[内容安全](../ai/safety.md)、[结构化记忆](../ai/memory.md)
- **配套**：[错误码](./error-codes.md)、[OpenAPI 草案](../../openapi/openapi.yaml)
- **下游任务**：S-21、S-24、S-29～S-33、E-003、C-001～C-016、AI 实现任务、A 系列后台

## 1. 文档目的

本文把已接受的领域模型、数据库规格、页面状态与共享 Schema 转换为**小程序与后端可独立开发**的 HTTP 契约。核心验收句是：

> 每个 P0 用户故事都能映射到明确的命令或查询；客户端只接收白名单视图；所有写操作可幂等恢复；Safety、删除与账户阻断不能被深链、缓存或 UUID 猜测绕过。

API 负责“授权边界上的命令与投影”，不负责“分数怎么算”“Prompt 怎么写”或“表怎么迁移”。

## 2. 权威边界

本文继承且不得重开：

- 产品日期由服务端 `product-date-v1` 解析（`Asia/Shanghai`，04:00 边界）；客户端不得提交 ProductDate 真值作为权威；
- 同一逻辑用户、同一产品日期最多一个生成意图与一个 AVAILABLE 每日结果；
- 规则出事实、AI 只表达；primary/backup/template 不竞速、不修补、不拼接；
- Safety ACTIVE / RECOVERY_PENDING 是最高优先级覆盖，高于账户删除、维护、会话、同意以及普通写与普通读投影；
- high-risk 时 ordinary Gateway/template 调用数 = 0；
- DTO **不直接等于** Prisma model；数据库 UUID 不是授权；
- 客户端不得提交 owner、Safety/deletion epoch、seed、ciphertext、内部 fingerprint 或 raw provider 字段；
- 晚间 note 不进入周总结、普通 AI、记忆、通知、分享或 analytics；
- 删除遵循 ADR-0005；删除任务与业务对象状态分离；
- 白名单 Client*View / SafetyView / DataTaskView 是唯一客户端内容形态。

冲突时：Accepted ADR → Accepted 规范 → shared Zod Schema → 领域模型 → 数据库规格 → 本文 → OpenAPI。

## 3. 范围

### 3.1 本文负责

- HTTP 约定：版本、认证、请求信封、响应信封、分页、限流提示；
- P0/P1 小程序命令与查询映射；
- 最小管理后台只读/受控写接口边界；
- 幂等 `command_ref`、expected revision/CAS、Unknown outcome 恢复；
- Safety overlay、删除/导出任务与普通旅程的交互；
- 与 [error-codes.md](./error-codes.md) 对齐的稳定错误语义；
- OpenAPI 草案路径与组件命名。

### 3.2 本文不负责

- NestJS module、controller、DTO class 实现；
- 真实微信登录 SDK 细节与证书；
- migration、Prisma Client 接线、Redis/BullMQ 配置；
- 埋点事件字典（S-24）与 KPI 口径（S-25）；
- 完整运营 RBAC 矩阵与客服工单 SLA（S-22）；
- GraphQL、WebSocket、开放第三方 API。

## 4. S-20 决策摘要

1. **Transport**：HTTPS JSON REST；资源路径稳定，写操作为**命令**（`POST .../commands/{operation}` 或资源子路径 POST），读操作为**查询**。
2. **Version**：URL 前缀 `/v1`；破坏性变更必须新版本，不静默改语义。
3. **Auth**：小程序使用服务端会话（微信 code 换会话）；管理端使用独立企业身份 + 二次验证占位；所有业务接口校验会话与账户状态。
4. **CommandIdentity**：每个可重试写携带 `command_ref` + 规范化 payload；同 ref 同 payload 幂等；同 ref 不同 payload → `IDEMPOTENCY_CONFLICT`。
5. **CAS**：可变事实写携带 `expected_revision`（不存在为 0）；冲突返回最新投影 + `REVISION_CONFLICT`。
6. **Server time/date**：响应暴露 `server_now` 与 `product_date`；客户端显示用，不作为写权威。
7. **Guards 顺序**（服务端）：解析最小 Safety 路由上下文 → Safety 覆盖 → 普通会话 → 账户/删除 → 维护/同意/认识 → 产品日期/窗口 → owner/revision/领域校验 → 写入/查询。
8. **Unknown outcome**：超时后先 `GET` 原 command/聚合，禁止换 `command_ref` 重开第二意图。
9. **Views only**：成功读返回白名单 view；永不返回 Prisma 行、ciphertext、epoch、seed、attempt、Prompt、Safety 原文。
10. **Safety**：HIGH_RISK 写命令返回 `SAFETY_OVERLAY` + `SafetyView`，不完成普通写；恢复需两步显式命令。
11. **Admin**：默认脱敏；不提供“浏览任意用户全文”接口。
12. **OpenAPI**：`openapi/openapi.yaml` 与本文同版本演进；Zod/shared-schemas 仍是内容字段权威。

## 5. 协议约定

### 5.1 Base

| 项              | 约定                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Base URL        | `https://{api-host}/v1`                                                                                          |
| Content-Type    | `application/json; charset=utf-8`                                                                                |
| 字符            | UTF-8；文本字段 grapheme 规则遵循 shared-schemas                                                                 |
| 时间            | ISO-8601 带时区；产品日期 `YYYY-MM-DD`                                                                           |
| 认证头          | 小程序 `Authorization: Bearer {session_token}`；管理端使用独立 `admin_session_token`；二者不可互换               |
| Safety 连续凭证 | `X-Safety-Continuation: {opaque_token}`；只允许 bootstrap、SafetyView 与 recovery 白名单，绝不授予普通权限       |
| 删除状态凭证    | `Authorization: DeletionStatus {status_token}`；只允许读取绑定的一个 ACCOUNT DataTask，不接受普通 Bearer 替代    |
| 幂等头          | 所有写命令必须同时发送 `Idempotency-Key: {command_ref}` 与 body `command_ref`，二者不同即 `IDEMPOTENCY_CONFLICT` |
| 追踪            | 请求 `X-Request-Id` 可选；所有响应都必须返回同名 header 与 body `request_id`                                     |
| 退避            | 429/503 在可确定时返回 `Retry-After`，并与 body `retry_after_seconds` 一致                                       |
| 语言            | `Accept-Language` 默认 `zh-CN`；未支持 locale 不静默混用未审文案                                                 |

### 5.2 成功响应信封

```text
ApiSuccessV1<T> {
  ok: true
  request_id: string
  server_now: string                 // timestamptz
  product_date: string               // 服务端解析的当前产品日
  product_date_policy_version: string
  data: T
}
```

列表：

```text
ApiListSuccessV1<T> {
  ok: true
  request_id, server_now, product_date, product_date_policy_version
  data: { items: T[]; next_cursor?: string; page_info?: { has_more: boolean } }
}
```

Export download 是唯一不使用成功信封的 v1 JSON 路径；成功时直接返回完整
`DataExportDocument` attachment，并固定 `Cache-Control: no-store`、`nosniff` 与文件名。
超过 2 MiB 时在发送任何正文前整份失败，不截断或分块。

### 5.3 错误响应信封

```text
ApiErrorV1 {
  ok: false
  request_id: string
  server_now: string
  product_date?: string
  error: {
    code: string                 // 见 error-codes.md
    category: AUTH | GUARD | VALIDATION | CONFLICT | NOT_FOUND | RATE_LIMIT | TRANSIENT | TERMINAL | SAFETY
    message_key: string          // 稳定 i18n key，非内部堆栈
    message: string              // 用户可读短句，无内部细节
    retryable: boolean
    details?: object             // 仅白名单字段，如 field errors、current_revision
    safety_view?: SafetyViewV1   // category=SAFETY 时
    command_receipt?: CommandReceiptV1
  }
}
```

禁止在错误中出现：堆栈、SQL、Prisma、模型名、Prompt、Token、供应商、内部策略、openid、手机号、ciphertext。

### 5.4 Command 请求公共字段

```text
CommandRequestV1 {
  command_ref: string            // ULID/UUID 高熵，客户端生成，不可反查用户
  // operation 由路径表达
  client_context?: {
    app_version?: string
    scene?: string               // 小程序场景值摘要，非追踪画像
  }
}
```

所有请求 DTO 默认封闭：未知字段必须返回 `VALIDATION_FAILED`。`client_context` 只允许 `app_version` 与 `scene`；owner、epoch、seed、内部 revision map、provider 或任意 Prisma 字段一律不得透传。

协调写（多组件）使用封闭的逐组件字段，不接收任意 revision map：

```text
EveningSaveRequestV1 {
  expected_feedback_revision: number
  expected_helpfulness_revision: number
  task_patch?: { task_ref, expected_revision, status }
}
```

### 5.5 Command 回执

```text
CommandReceiptV1 {
  command_ref: string
  operation: string
  outcome: ACCEPTED | DUPLICATE | CONFLICT | REJECTED | UNKNOWN_PENDING
  resource_refs?: { checkin_ref?, intent_ref?, result_ref?, task_ref?, matter_ref?, feedback_ref?, share_ref?, recovery_ref? }
}
```

冲突的最新状态只允许放在错误信封 `details.current`，并且必须是 OpenAPI 列出的白名单 View 之一；回执和错误均不接受任意对象。

## 6. 认证与启动

### 6.0 Safety-first 路由解析

服务端必须先解析“最小路由身份”，再决定是否进入普通认证：

1. 有效普通会话可以解析账户与 Safety 状态；
2. Safety ACTIVE / RECOVERY_PENDING 时，服务端签发短期、可撤销、不含风险类别或用户原文的 `safety_continuation_token`；
3. 普通会话过期、账户 RESTRICTED/DELETING 或维护 BLOCKING 时，该 token 仍只可读取 `GET /bootstrap/launch`、`GET /safety/current` 和提交两步 recovery；
4. token 不能刷新普通会话、读取普通资料/历史、执行普通业务写，也不能覆盖账户删除；Safety CLEAR、账户 DELETED 或 token 到期后立即失效；
5. 普通 token 与 Safety token 都不可验证时，保持 SYS-001 最小骨架或进入 ENT-002；不得猜测 Safety 已 CLEAR，也不得凭本地缓存恢复普通权限。

这使“Safety 高于会话/删除”成为可实现的路由能力，而不是绕过认证的匿名数据入口。

### 6.1 微信会话

| Method | Path                    | 说明                                                                                       |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/auth/wechat/session`  | `wx.login` code → 建立/恢复会话；返回 `session_token`、账户摘要、是否需同意                |
| POST   | `/auth/session/refresh` | 刷新会话                                                                                   |
| POST   | `/auth/session/logout`  | 注销本会话                                                                                 |
| POST   | `/auth/reauth/verify`   | 对删除确认 challenge 做微信身份复核；返回仅绑定该 challenge 的 `identity_verification_ref` |

`POST /auth/wechat/session` **不**把 openid 返回客户端。失败不泄露“是否已注册”。

### 6.2 启动路由查询

| Method | Path                | 说明                                                                            |
| ------ | ------------------- | ------------------------------------------------------------------------------- |
| GET    | `/bootstrap/launch` | `LaunchStateSnapshot`：账户、Safety、同意、onboarding、今日是否有结果、维护标志 |

映射 SYS-001。优先级：Safety → Deleting → 维护/账户 → 会话 → 深链资格 → 今日状态。

### 6.3 必要同意

| Method | Path                | 说明                                 |
| ------ | ------------------- | ------------------------------------ |
| GET    | `/consent/current`  | 当前必要同意版本与状态               |
| POST   | `/consent/accept`   | 接受指定 notice version（command）   |
| POST   | `/consent/withdraw` | 撤回（command；不删除 profile 事实） |

## 7. 资料与首次认识

| Method | Path                         | 说明                                              |
| ------ | ---------------------------- | ------------------------------------------------- |
| GET    | `/profile`                   | 白名单资料与风格                                  |
| POST   | `/onboarding/complete`       | 首次认识完成：称呼（可选）、风格；Safety 检查称呼 |
| POST   | `/profile/update`            | 修改称呼/风格；`expected_revision`                |
| POST   | `/profile/style-calibration` | CMP-001 表达校准（枚举，非自由文本）              |

- 称呼经 Safety；注入式/越界按 safety 规范省略或拒绝。
- 完成 onboarding 不因后续 profile 修改回退。

## 8. 今日：签到、生成、读取、点亮

### 8.1 签到

| Method | Path                     | 说明                                                       |
| ------ | ------------------------ | ---------------------------------------------------------- |
| GET    | `/daily/today/checkin`   | 当前产品日签到投影（若有）                                 |
| POST   | `/daily/checkin/submit`  | 仅创建晨间 mood/energy/sleep；`expected_revision` 固定为 0 |
| POST   | `/daily/checkin/correct` | 显式更正（OPEN 窗口，`expected_revision`）                 |
| POST   | `/daily/checkin/rebuild` | DAY 删除成功后的“重新记录今天”；显式确认并原子创建新的签到 |

规则：

- 服务端绑定当前 `product_date`；
- “说不准”是合法枚举；
- `submit` 仅允许不存在时创建：同 command + 同 payload 返回原 revision；已有签到且 payload 不同返回 `CHECKIN_ALREADY_EXISTS`，必须改走 `correct`；
- `correct` 必须携带当前正 revision；冲突返回最新 `CheckinView`，不做 last-write-wins；
- 更正**不**重写已发布每日结果；
- `rebuild` 只在 ADR-0005 §10 的全部条件成立时接受：当前权威产品日、OPEN 窗口、原 DAY DataTask SUCCEEDED、普通守卫通过、用户再次明确确认、DayErasureGuard 与原 `result_version` 可验证；客户端不得提交 epoch、seed 或 result_version；
- 同日重记后生成必须由服务端复用原 `result_version`，默认使用兼容 `CONTROLLED_TEMPLATE`；删除前从未创建 intent 时才可冻结当前版本。

### 8.2 生成与读取

| Method | Path                             | 说明                                                                        |
| ------ | -------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/daily/generation/start`        | 基于已有签到启动/恢复 GenerationIntent                                      |
| GET    | `/daily/generation/{intent_ref}` | 查询意图状态：RUNNING / SUCCEEDED / FAILED / CANCELLED                      |
| GET    | `/daily/today`                   | `TodayView`：ClientDailyContentView + interaction 摘要 + 关系模块（白名单） |
| GET    | `/daily/by-date/{product_date}`  | 历史日只读；无写窗口                                                        |

生成语义：

- 同用户同日唯一 intent；重复 start 同 payload → 同一 intent；
- 客户端轮询 `GET generation` 或依赖 `today` 出现 AVAILABLE；
- F3/F4/模板降级只体现在 view 标志与文案，不暴露供应商；
- Unknown：先 GET intent/today，禁止新 command_ref 开第二 intent。

### 8.3 点亮与任务/帮助度（互动组件）

| Method | Path                             | 说明                              |
| ------ | -------------------------------- | --------------------------------- |
| POST   | `/daily/interaction/light`       | 点亮（幂等）                      |
| POST   | `/daily/interaction/task`        | 更新任务状态；`expected_revision` |
| POST   | `/daily/interaction/helpfulness` | 更新帮助度；`expected_revision`   |
| GET    | `/daily/interaction`             | 当日互动投影                      |

点亮成功可派生关系相遇链接；关系计数由服务端派生，客户端只读展示字段。

## 9. 晚间反馈

| Method | Path             | 说明                                                                            |
| ------ | ---------------- | ------------------------------------------------------------------------------- |
| GET    | `/evening/today` | `EveningView` + 写窗口                                                          |
| POST   | `/evening/save`  | **协调命令**：feedback + helpfulness + 可选 task patch；多 `expected_revisions` |
| POST   | `/evening/skip`  | “稍后再说”（若产品允许的显式跳过）                                              |

- 可选 note 经 Safety；HIGH_RISK → 整命令停止，返回 `SAFETY_OVERLAY`；
- note 不进入 Weekly/AI/memory/通知/分享；
- 任一分量 revision 冲突 → 整命令失败，无部分写。

## 10. 七天趋势与历史

| Method | Path                           | 说明                                              |
| ------ | ------------------------------ | ------------------------------------------------- |
| GET    | `/weekly/current`              | `WeeklyView`：聚合事实 + 当前有效 summary（若有） |
| GET    | `/weekly/window/{end_date}`    | 指定窗口只读（服务端校验连续性）                  |
| GET    | `/history/days`                | 光标分页的历史日摘要（无内部 raw score）          |
| GET    | `/history/days/{product_date}` | 历史日详情白名单                                  |

- source fingerprint 变化导致旧 summary 不可见时，API 返回 facts + `summary_status: INVALIDATED|ABSENT`，不返回过期正文冒充当前。

## 11. 事项与记忆管理

| Method | Path                             | 说明                                                   |
| ------ | -------------------------------- | ------------------------------------------------------ |
| GET    | `/matters`                       | 列表（MemoryManagementView 片段）                      |
| POST   | `/matters`                       | 创建；title Safety 检查；grant 开关                    |
| PATCH  | `/matters/{matter_ref}`          | 更新；`expected_revision`                              |
| POST   | `/matters/{matter_ref}/pause`    | 暂停                                                   |
| POST   | `/matters/{matter_ref}/resume`   | 恢复                                                   |
| POST   | `/matters/{matter_ref}/complete` | 完成                                                   |
| POST   | `/matters/{matter_ref}/delete`   | 删除命令（进入 DataTask 或同步硬删路径由领域/S-18 定） |
| GET    | `/memory/preferences`            | master switch 与用途授权摘要                           |
| POST   | `/memory/preferences`            | 更新 master/grants；`expected_revision`                |

- v1 Daily/Weekly **不**因事项自动获得模型记忆输入；
- HIGH_RISK matter 文本不成为 ordinary memory 候选；
- 客户端永不收到 source dependency 图或内部 grant ref 明文以外的服务端秘密。

## 12. 通知与分享（P1 边界）

| Method | Path                             | 说明                                       |
| ------ | -------------------------------- | ------------------------------------------ |
| GET    | `/notifications/settings`        | 偏好 + 平台权限观察                        |
| POST   | `/notifications/settings`        | 更新偏好；默认关闭                         |
| POST   | `/notifications/permission-sync` | 上报微信订阅权限观察结果（非伪造系统权限） |
| POST   | `/share/preview`                 | 生成分享预览白名单字段；拒绝敏感           |
| POST   | `/share/intent`                  | 记录分享意图（不等于已分享成功）           |

- 通知文案不得含低分恐惧、断签压力、敏感原文；
- 分享默认隐藏称呼、原始状态、自由文本与记忆。

## 13. Safety

| Method | Path                       | 说明                                                             |
| ------ | -------------------------- | ---------------------------------------------------------------- |
| GET    | `/safety/current`          | `SafetyView`：状态 CLEAR/ACTIVE/RECOVERY_PENDING + 固定响应投影  |
| POST   | `/safety/recovery/start`   | 用户显式意图 1 → RECOVERY_PENDING（需 expected safety revision） |
| POST   | `/safety/recovery/confirm` | 用户显式意图 2 → 请求 CLEAR（服务端条件门控）                    |

- 资源点击、拨号、仅浏览 **不是** recovery 证据；
- 固定文案与资源来自版本化计划，不经 ordinary 生成；
- 地区资源失败时仍返回通用紧急说明。

任何业务写在 ACTIVE/RECOVERY_PENDING 下默认 `SAFETY_BLOCKED` 或直接返回 overlay（除 recovery 与退出相关只读）。

## 14. 隐私：导出与删除

| Method | Path                                                       | 说明                                                                                                                  |
| ------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/data-rights/summary`                                     | `DataRightsSummaryView`：account/relationship expected revision、capability、确认版本与固定 SLA；不含 ref/epoch/token |
| GET    | `/data-rights/tasks`                                       | 当前 DataTask 列表摘要                                                                                                |
| GET    | `/data-rights/tasks/{task_ref}`                            | `DataTaskView`：阶段、范围、online erased、backup deadline                                                            |
| POST   | `/data-rights/export`                                      | 创建导出任务                                                                                                          |
| GET    | `/data-rights/exports/{task_ref}/artifacts/{download_ref}` | active owner session 下载 READY JSON；无通用成功信封，正文零持久化                                                    |
| POST   | `/data-rights/delete/day`                                  | DAY 一次明确确认；target 为 `product_date`                                                                            |
| POST   | `/data-rights/delete/matter`                               | MATTER 一次明确确认；target 为 `matter_ref`                                                                           |
| POST   | `/data-rights/delete/relationship/prepare`                 | 第一阶段：冻结范围并返回一次性 confirmation challenge                                                                 |
| POST   | `/data-rights/delete/relationship/confirm`                 | 第二阶段：校验 challenge、确认版本、范围、修订和必要身份复核后创建任务                                                |
| POST   | `/data-rights/delete/account/prepare`                      | 第一阶段：返回账户删除影响与一次性 challenge                                                                          |
| POST   | `/data-rights/delete/account/confirm`                      | 第二阶段：校验 challenge 与身份复核后启动账户删除；返回 task 与一次 status grant                                      |
| GET    | `/data-rights/deletion-status/{task_ref}`                  | 普通 session 吊销后用 `DeletionStatus` 只读同一 task；最长 7 天且不刷新                                               |
| POST   | `/data-rights/tasks/{task_ref}/cancel`                     | 仅允许在领域规定可取消阶段                                                                                            |

- DAY / MATTER DTO 必须包含 `command_ref`、固定 `scope`、封闭 `target`、`confirmation_version`、`confirmed=true` 与 `expected_revision`；它们是一次明确确认，不是无参删除按钮；
- RELATIONSHIP_DATA / ACCOUNT 的 prepare 返回 `confirmation_challenge_ref`、规范化 scope/target、影响摘要、`confirmation_version`、过期时间与 `identity_reverification_required`；confirm 必须逐项原样回传并携带 `expected_revision(s)`，需要时还要携带 challenge-scoped `identity_verification_ref`；
- challenge 单次、短期、绑定 owner + scope + target + confirmation_version + expected revision；任一字段变化、过期或复用均拒绝，不允许服务端替客户端扩大范围；
- RELATIONSHIP_DATA 可显式选择 `included_day_product_dates`，并逐日提交同序的 `included_day_expected_revisions`；每个日期创建或关联 DAY 子任务；两个数组默认都为空，不能静默删除全部 DAY；
- Export Worker 只保存 source revision vector/fingerprint、schema/policy、opaque download ref 与 READY/expiry 元数据；下载时从当前 owner facts 确定性生成，源变化立即使旧 manifest `INVALIDATED`；
- `DataTaskView` 按 kind 分开成功语义：DELETE 需要 online/backup 时间；EXPORT 需要 READY/EXPIRED/INVALIDATED artifact 且不得伪造 erasure 时间；
- ACCOUNT confirm 的 status token 只返回一次，数据库只保存 hash；普通 Bearer、换 task、错误 token、到期或成功终态重放均拒绝；
- 响应不回显被删业务正文；
- Deleting 账户：普通写拒绝；bootstrap 给 SYS-003 类投影。

## 15. 支持反馈

| Method | Path                | 说明                                           |
| ------ | ------------------- | ---------------------------------------------- |
| GET    | `/support/faq`      | 静态/版本化 FAQ                                |
| POST   | `/support/feedback` | 分类 + 可选文本；Safety 检查；不进 ordinary AI |

## 16. 管理后台最小接口

前缀 `/v1/admin`；独立鉴权。

| Method | Path                                          | 说明                                                 |
| ------ | --------------------------------------------- | ---------------------------------------------------- |
| POST   | `/admin/auth/login`                           | 企业身份登录占位                                     |
| GET    | `/admin/ops/overview`                         | 成功率、延迟、降级、队列、安全告警、成本摘要（聚合） |
| GET    | `/admin/safety/events`                        | 脱敏 Safety 事件列表                                 |
| GET    | `/admin/data-rights/tasks`                    | 数据任务队列                                         |
| POST   | `/admin/data-rights/tasks/{task_ref}/advance` | 受控推进（审计）；不能改写用户原文解除 Safety        |

禁止：任意用户全文浏览、编辑已发布结果、下调 Safety 政策、导出未脱敏语料到通用分析。

## 17. 与页面映射（P0）

| 页面     | 主要 API                                                                   |
| -------- | -------------------------------------------------------------------------- |
| SYS-001  | `GET /bootstrap/launch`                                                    |
| ENT-002  | session refresh / re-login                                                 |
| ONB-001  | `POST /onboarding/complete`                                                |
| DLY-001  | `POST /daily/checkin/submit`；同日删除后使用 `POST /daily/checkin/rebuild` |
| DLY-002  | `POST /daily/generation/start` + `GET /daily/generation/{intent_ref}`      |
| DLY-003  | `GET /daily/today` + light/task/helpfulness                                |
| EVE-001  | `GET/POST /evening/*`                                                      |
| REC-001  | `GET /weekly/current`                                                      |
| REC-002  | `GET /history/days/{date}`                                                 |
| MEM-*    | `/matters*` `/memory/preferences`                                          |
| SET-*    | profile、notifications、data-rights prepare/confirm、support               |
| SAFE-001 | `GET /safety/current` + recovery commands                                  |

## 18. 权限与守卫矩阵（摘要）

| 条件                                  | 写                                       | 普通读                                                      |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Safety ACTIVE/RECOVERY_PENDING        | 仅 recovery 等 Safety 白名单             | 先返回 SafetyView；可用 Safety continuation，不恢复普通权限 |
| 无普通会话且无 Safety continuation    | 401                                      | 401 / ENT-002                                               |
| 账户 RESTRICTED（Safety CLEAR）       | 按能力拒绝                               | 有限                                                        |
| 账户 DELETING/DELETED（Safety CLEAR） | 拒绝业务写                               | DataTask/结束态                                             |
| 仅有有效 DeletionStatus grant         | 拒绝全部业务写                           | 只读绑定的一个 ACCOUNT DataTask                             |
| 产品日写窗口关闭                      | 拒绝对应写                               | 可读历史/冻结                                               |
| revision 不匹配                       | 409 CONFLICT                             | —                                                           |
| 资源非 owner                          | 404 或 403（不泄露存在性策略：默认 404） | 同左                                                        |

## 19. 限流与体量

- 认证接口按 IP + 设备粗限流；业务写按 account 限流；
- 超限 `RATE_LIMITED` + `retryable=true`；
- 请求体上限：普通 JSON 32 KiB；feedback/matter 文本按 Schema；
- 列表默认 limit 20，最大 50，cursor 不透明。

## 20. 可观测性（API 层）

- 只记录 `request_id`、operation、account hash/ref 桶、code、latency、retryable；
- 不记录 note、matter title、称呼、Prompt、token、code 原文；
- Safety 只记类别桶与 policy version。

## 21. 版本与兼容

- `/v1` 内：只加可选字段与新 endpoint；不改现有字段语义；
- 移除或改语义 → `/v2`；
- shared-schemas 字段变更需双周兼容或显式版本 pin；
- OpenAPI `info.version` 与本文 `api_contract_version` 同步：`api-contract-v1`。

## 22. 最小回归场景（48）

### 22.1 Auth / Bootstrap（8）

| ID      | 场景                    | 期望           |
| ------- | ----------------------- | -------------- |
| S20-A01 | code 换会话成功         | 无 openid 外泄 |
| S20-A02 | 无效 code               | 稳定 AUTH 错误 |
| S20-A03 | launch 时 Safety ACTIVE | 不进今日写路径 |
| S20-A04 | launch 时 DELETING      | SYS-003 类     |
| S20-A05 | 无同意                  | 拦截主写       |
| S20-A06 | refresh 过期            | 401 + 可重登   |
| S20-A07 | 深链 + ACTIVE           | 仍 Safety      |
| S20-A08 | 维护 BLOCKING           | 维护投影       |

### 22.2 Daily write（10）

| ID      | 场景                                  | 期望                                                    |
| ------- | ------------------------------------- | ------------------------------------------------------- |
| S20-D01 | 签到 submit 重放 / 已存在不同 payload | 同 payload 同 revision；不同 payload 拒绝并要求 correct |
| S20-D02 | 生成 start 双击                       | 单 intent                                               |
| S20-D03 | 生成 Unknown 恢复                     | GET 原 intent                                           |
| S20-D04 | 点亮幂等                              | 单 light fact                                           |
| S20-D05 | 任务 revision 冲突                    | 409 + 最新                                              |
| S20-D06 | 跨日写旧日                            | 拒绝或 grant 规则                                       |
| S20-D07 | 无签到生成                            | VALIDATION                                              |
| S20-D08 | 已有 AVAILABLE 再 start               | 返回已有                                                |
| S20-D09 | F4 全失败                             | 可重试语义无第二结果                                    |
| S20-D10 | 模板降级成功                          | today 可读，无供应商字段                                |

### 22.3 Evening / Weekly / Memory（10）

| ID      | 场景                    | 期望                     |
| ------- | ----------------------- | ------------------------ |
| S20-E01 | evening 协调保存成功    | 三分量一致               |
| S20-E02 | 单分量 revision 错      | 全失败                   |
| S20-E03 | note HIGH_RISK          | SAFETY_OVERLAY，无保存   |
| S20-E04 | weekly 无 summary       | facts 仍可读             |
| S20-E05 | summary invalidated     | 不展示旧正文             |
| S20-E06 | matter 创建             | Safety clear 才 ordinary |
| S20-E07 | matter HIGH_RISK        | 不进 memory ordinary     |
| S20-E08 | grant 关闭              | 偏好更新                 |
| S20-E09 | 删除 matter             | 列表消失/任务可见        |
| S20-E10 | v1 today 无记忆字段泄露 | 无内部 dependency        |

### 22.4 Safety / Rights（10）

| ID      | 场景                                | 期望                                               |
| ------- | ----------------------------------- | -------------------------------------------------- |
| S20-S01 | ACTIVE 下签到写                     | 阻断                                               |
| S20-S02 | recovery 一步不足                   | 仍 PENDING                                         |
| S20-S03 | 两步 + 条件满足                     | CLEAR                                              |
| S20-S04 | 资源点击不 CLEAR                    | 状态不变                                           |
| S20-S05 | 导出任务创建                        | DataTaskView                                       |
| S20-S06 | 账户删除 prepare → reauth → confirm | challenge 绑定一致后才 DELETING                    |
| S20-S07 | DAY 删除成功后显式重新记录今天      | 满足 ADR 条件并复用原 result_version；否则稳定错误 |
| S20-S08 | 关系删除 prepare/confirm 范围       | 不默删全部 DAY；选中日期建 DAY 子任务              |
| S20-S09 | 任务查询不回正文                    | 无被删内容                                         |
| S20-S10 | 跨日仍 ACTIVE                       | bootstrap 仍 overlay                               |

### 22.5 Error / Admin / Contract（10）

| ID      | 场景                      | 期望                 |
| ------- | ------------------------- | -------------------- |
| S20-C01 | idempotency 冲突          | IDEMPOTENCY_CONFLICT |
| S20-C02 | 错误无堆栈/模型名         | 扫描通过             |
| S20-C03 | 非 owner ref              | 404                  |
| S20-C04 | 限流                      | RATE_LIMITED         |
| S20-C05 | 校验失败字段              | details 白名单       |
| S20-C06 | admin 事件脱敏            | 无原文               |
| S20-C07 | admin 无下放 Safety       | 无 endpoint          |
| S20-C08 | OpenAPI 与路径表一致      | 清单对齐             |
| S20-C09 | Client view 无 epoch/seed | 字段审计             |
| S20-C10 | command_ref 重放同结果    | DUPLICATE/ACCEPTED   |

## 23. 验收标准

- P0 页面均可映射到命令/查询；
- 错误码表覆盖 Auth/Guard/Validation/Conflict/Safety/Transient/Terminal；
- OpenAPI 草案列出全部 `/v1` 路径与主要 schema 组件；
- Auth、Bootstrap、Checkin、Generation、Evening、Safety、DataRights 的请求与白名单 View 使用封闭 Schema；所有 operation 明确 4xx，所有命令声明幂等头；
- 与 domain-model、database、interaction-states、safety 无冲突；
- 48 场景 ID 唯一；
- 无 NestJS/migration/生产代码；
- docs/INDEX、current、backlog 同步；
- 用户确认前保持 Draft。

## 24. 下游约束

- S-21：API 字段进入隐私地图；
- S-24：只允许批准的 analytics 属性，不扫正文；
- S-29：模块边界与事务/outbox 对齐命令；
- E-003：NestJS 按本文实现；
- C/AI 任务：端到端不得绕过 guards。

## 25. 明确延期

- 精确微信订阅消息模板 ID；
- 管理端完整 RBAC 与 SSO 厂商；
- 多区域路由与灰度 header；
- 文件上传/头像；
- 第三方开放平台 API；
- 自动生成客户端 SDK。

延期不得削弱：幂等、CAS、Safety 旁路、白名单视图、Unknown 恢复、删除不复活。

## 26. 审核记录

- 状态：Accepted；
- 接受日期：2026-07-22；
- 2026-08-28：项目所有者接受 ADR-0008 与数据权利传输契约修订；C-014 以 additive endpoint/optional field 增补 summary、24 小时 manifest/download、7 天 status grant 与 2 MiB 上限；
- 内容 PR：[PR #24](https://github.com/WeiHan1996/DailyEnergy/pull/24)，squash 合并提交 `207de0e`；
- 审核修复：DAY 重记、Safety-first、删除确认、签到 CAS 与 OpenAPI 可执行性；
- 最终验证：48 个 API 场景唯一；OpenAPI 62 paths / 65 operations / 136 schemas；Redocly recommended 0 errors / 0 warnings；
- 下一任务：S-21 隐私数据地图。

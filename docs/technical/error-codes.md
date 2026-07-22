# DailyEnergy API 错误码

- **文档状态**：Draft
- **所属任务**：S-20 — API 契约
- **最后更新**：2026-07-22
- **适用范围**：`/v1` 小程序与管理端 HTTP 错误语义、重试与客户端恢复
- **配套**：[API 契约](./api.md)、[OpenAPI 草案](../../openapi/openapi.yaml)
- **上游**：[交互状态](../design/interaction-states.md)、[领域模型](../data/domain-model.md)、[数据库规格](./database.md)、[内容安全](../ai/safety.md)

## 1. 目的

定义稳定、可测试、对用户安全的错误码。客户端只依赖 `error.code` / `category` / `retryable`，不解析自由文本做分支。

## 2. 总则

1. **稳定 code**：`SCREAMING_SNAKE`；语义变更必须新 code，不复用。
2. **category** 决定默认 UI：AUTH、GUARD、VALIDATION、CONFLICT、NOT_FOUND、RATE_LIMIT、TRANSIENT、TERMINAL、SAFETY。
3. **retryable**：仅表示“用同一 command_ref 或同一查询再试可能成功”；不表示换参数硬撞。
4. **HTTP 状态** 为提示；**code 为权威**。映射见第 4 节。
5. **message** 面向用户；**message_key** 用于 i18n；均不得含内部细节。
6. **details** 仅白名单：`fields[]`、`current_revision`、`current_product_date`、`command_receipt`、`retry_after_seconds`。
7. Safety 命中时 category=`SAFETY`，可附 `safety_view`；不附 raw 输入。
8. 不存在性：默认 `NOT_FOUND`，避免跨用户探测（管理端可另议，仍不返回他用户正文）。

## 3. 类别与客户端默认行为

| category | 默认 HTTP | 客户端 |
| --- | --- | --- |
| AUTH | 401 | 清会话 / 重新登录 |
| GUARD | 403 | 说明阻断（删除中、维护、窗口关闭） |
| VALIDATION | 400 | 字段级提示，保留草稿 |
| CONFLICT | 409 | 拉最新投影，勿盲重放不同 payload |
| NOT_FOUND | 404 | 回合法落点（如 launch） |
| RATE_LIMIT | 429 | 退避，`retry_after_seconds` |
| TRANSIENT | 503/502 | 可重试；写操作先查 command/资源 |
| TERMINAL | 422/500* | 换策略或联系支持；不盲目重试同一错误输入 |
| SAFETY | 409 或 200+overlay 策略见 api.md | 进入 SAFE-001；停止普通写 |

\* 对用户仍是友好 TERMINAL；5xx 仅用于未分类故障，应尽快归一到稳定 code。

## 4. HTTP 映射建议

| HTTP | 典型 code |
| --- | --- |
| 400 | `VALIDATION_FAILED`、`UNSUPPORTED_LOCALE` |
| 401 | `AUTH_REQUIRED`、`AUTH_SESSION_EXPIRED`、`AUTH_INVALID` |
| 403 | `ACCOUNT_RESTRICTED`、`ACCOUNT_DELETING`、`WRITE_WINDOW_CLOSED`、`MAINTENANCE_BLOCKING`、`CONSENT_REQUIRED` |
| 404 | `RESOURCE_NOT_FOUND`、`COMMAND_NOT_FOUND` |
| 409 | `REVISION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`UNIQUE_ALREADY_EXISTS`、`SAFETY_BLOCKED`、`SAFETY_OVERLAY` |
| 422 | `CONTRACT_VIOLATION`、`STATE_PRECONDITION_FAILED` |
| 429 | `RATE_LIMITED` |
| 503 | `UPSTREAM_TRANSIENT`、`GENERATION_PENDING`、`DEPENDENCY_UNAVAILABLE` |

生成进行中可用 **200** + `data.status=RUNNING`，或 **202**；若客户端当作错误轮询，用 `GENERATION_PENDING` + retryable。

## 5. 错误码目录

### 5.1 Auth

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `AUTH_REQUIRED` | AUTH | no | 缺少或无效 Bearer |
| `AUTH_INVALID` | AUTH | no | 登录凭证无效（不区分用户是否存在） |
| `AUTH_SESSION_EXPIRED` | AUTH | no | 会话过期 |
| `AUTH_WECHAT_CODE_INVALID` | AUTH | no | wx code 无效/已用 |
| `AUTH_ADMIN_REQUIRED` | AUTH | no | 管理端权限不足 |

### 5.2 Account / Consent / Maintenance guards

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `CONSENT_REQUIRED` | GUARD | no | 必要同意未完成 |
| `ONBOARDING_REQUIRED` | GUARD | no | 首次认识未完成 |
| `ACCOUNT_RESTRICTED` | GUARD | no | 账户受限 |
| `ACCOUNT_DELETING` | GUARD | no | 注销/删除进行中 |
| `ACCOUNT_DELETED` | GUARD | no | 已删除 |
| `MAINTENANCE_BLOCKING` | GUARD | yes | 全站阻断维护 |
| `MAINTENANCE_DEGRADED` | TRANSIENT | yes | 降级提示（可部分成功时也可用警告头，非必须错误） |
| `WRITE_WINDOW_CLOSED` | GUARD | no | 产品日写窗口关闭 |
| `VIEW_CONTINUATION_EXPIRED` | GUARD | no | 跨日 continuation grant 失效 |
| `FEATURE_DISABLED` | GUARD | no | 能力未对账户开放 |

### 5.3 Safety

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `SAFETY_OVERLAY` | SAFETY | no | 输入 high-risk；普通写未执行；附 SafetyView |
| `SAFETY_BLOCKED` | SAFETY | no | 当前 ACTIVE/RECOVERY_PENDING，拒绝普通写 |
| `SAFETY_RECOVERY_PRECONDITION` | SAFETY | no | 恢复步骤/revision 不满足 |
| `SAFETY_INDETERMINATE` | SAFETY | yes | 分类不确定/故障；fail closed，不保存自由文本 |

### 5.4 Validation

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `VALIDATION_FAILED` | VALIDATION | no | 字段/Schema 失败；`details.fields` |
| `UNSUPPORTED_LOCALE` | VALIDATION | no | locale 未支持 |
| `PAYLOAD_TOO_LARGE` | VALIDATION | no | 体过大 |
| `INVALID_COMMAND_REF` | VALIDATION | no | command_ref 格式非法 |
| `CHECKIN_INCOMPLETE` | VALIDATION | no | 生成前签到不完整 |
| `NOTE_OPERATION_INVALID` | VALIDATION | no | note SET/CLEAR 判别错误 |

### 5.5 Conflict / concurrency

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `REVISION_CONFLICT` | CONFLICT | no | expected_revision 不匹配；返回 current |
| `IDEMPOTENCY_CONFLICT` | CONFLICT | no | 同 command_ref 不同 payload |
| `UNIQUE_ALREADY_EXISTS` | CONFLICT | no | 唯一业务事实已存在（如同日 intent） |
| `STATE_PRECONDITION_FAILED` | CONFLICT | no | 状态机不允许该迁移 |
| `SOURCE_CHANGED` | CONFLICT | no | 发布前源/grant revision 变化 |

### 5.6 Not found

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `RESOURCE_NOT_FOUND` | NOT_FOUND | no | 资源不存在或非 owner |
| `COMMAND_NOT_FOUND` | NOT_FOUND | no | 未知恢复时无此 command（可安全同 ref 重放前确认） |
| `TASK_NOT_FOUND` | NOT_FOUND | no | DataTask 不存在 |

### 5.7 Generation / dependency

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `GENERATION_PENDING` | TRANSIENT | yes | 仍在进行；继续 GET |
| `GENERATION_FAILED_RETRYABLE` | TRANSIENT | yes | 瞬时失败，可同 intent 策略重试（服务端定） |
| `GENERATION_FAILED_TERMINAL` | TERMINAL | no | F4/契约级失败；需用户回到合法路径 |
| `DEPENDENCY_UNAVAILABLE` | TRANSIENT | yes | 依赖暂不可用 |
| `UPSTREAM_TRANSIENT` | TRANSIENT | yes | 网关/基础设施瞬时错误 |
| `RATE_LIMITED` | RATE_LIMIT | yes | 限流 |

### 5.8 Data rights

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `DATA_TASK_NOT_CANCELLABLE` | GUARD | no | 任务阶段不可取消 |
| `DATA_TASK_SCOPE_INVALID` | VALIDATION | no | 删除/导出范围非法 |
| `DAY_REBUILD_FORBIDDEN` | GUARD | no | DAY 删除后同日重建禁止 |
| `EXPORT_NOT_READY` | TRANSIENT | yes | 导出未完成 |

### 5.9 Contract / terminal

| code | category | retryable | 含义 |
| --- | --- | --- | --- |
| `CONTRACT_VIOLATION` | TERMINAL | no | 版本/指纹/不变量破坏 |
| `INTERNAL_TERMINAL` | TERMINAL | no | 归一化内部故障（无堆栈） |

## 6. 与交互状态的对应

| 交互状态 | 典型 code |
| --- | --- |
| 会话失败 | `AUTH_*` |
| Safety 全屏 | `SAFETY_OVERLAY` / `SAFETY_BLOCKED` |
| 删除中 | `ACCOUNT_DELETING` |
| 维护 | `MAINTENANCE_BLOCKING` |
| 写窗口关闭 | `WRITE_WINDOW_CLOSED` |
| 局部可恢复错误 | `UPSTREAM_TRANSIENT` / `DEPENDENCY_UNAVAILABLE` |
| 硬失败 F4 | `GENERATION_FAILED_TERMINAL` |
| Unknown 提交 | 先查；`GENERATION_PENDING` 或成功 data |
| 修订冲突 | `REVISION_CONFLICT` |
| 离线 | 客户端本地；上线后原 command 恢复 |

## 7. Unknown outcome 专用规则

1. 网络超时 **不是** 自动 `INTERNAL_TERMINAL`。
2. 客户端必须：`GET` command receipt / 目标资源 / `bootstrap`。
3. 若 `COMMAND_NOT_FOUND` 且业务允许：用**同一** `command_ref` 重放。
4. 禁止：新 `command_ref` 创建第二 intent/第二点亮/第二删除任务（除非产品定义的新用户意图）。

## 8. 幂等结果与错误的关系

| 服务端判定 | HTTP | code/outcome |
| --- | --- | --- |
| 同 ref 同 payload 已成功 | 200 | `ok=true`，receipt `DUPLICATE` 或静默同结果 |
| 同 ref 不同 payload | 409 | `IDEMPOTENCY_CONFLICT` |
| 业务唯一已存在且 payload 等价 | 200 | 返回已有资源 |
| 业务唯一已存在且冲突 | 409 | `UNIQUE_ALREADY_EXISTS` 或 `STATE_PRECONDITION_FAILED` |

## 9. 日志红线

错误日志允许：`request_id`、code、category、account 桶、path、latency。  
禁止：Authorization、note、matter、称呼、Prompt、provider body、Safety 原文、SQL。

## 10. 验收场景（16）

| ID | 场景 | 期望 |
| --- | --- | --- |
| S20-ERR01 | 无 token | `AUTH_REQUIRED` |
| S20-ERR02 | 过期 token | `AUTH_SESSION_EXPIRED` |
| S20-ERR03 | ACTIVE 写签到 | `SAFETY_BLOCKED` 或 `SAFETY_OVERLAY` |
| S20-ERR04 | note high-risk | `SAFETY_OVERLAY` + 无保存 |
| S20-ERR05 | revision 错 | `REVISION_CONFLICT` + current |
| S20-ERR06 | idempotency 冲突 | `IDEMPOTENCY_CONFLICT` |
| S20-ERR07 | 他用户 result id | `RESOURCE_NOT_FOUND` |
| S20-ERR08 | 窗口外更正签到 | `WRITE_WINDOW_CLOSED` |
| S20-ERR09 | 生成中轮询 | `GENERATION_PENDING` 或 200 RUNNING |
| S20-ERR10 | 超时后同 ref 恢复 | 不双写 |
| S20-ERR11 | DAY 重建 | `DAY_REBUILD_FORBIDDEN` |
| S20-ERR12 | 限流 | `RATE_LIMITED` + retry_after |
| S20-ERR13 | 校验失败 | `VALIDATION_FAILED` + fields |
| S20-ERR14 | DELETING 写 | `ACCOUNT_DELETING` |
| S20-ERR15 | 错误 body 无堆栈/模型名 | 审计通过 |
| S20-ERR16 | admin 无权限 | `AUTH_ADMIN_REQUIRED` |

## 11. 审核记录

- 状态：Draft；
- 与 `api-contract-v1` 同步；
- 实现时 code 表可进 shared 常量，但语义变更需改本文版本。

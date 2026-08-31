# C-014 数据权利传输契约修订

- **文档状态**：Accepted
- **日期**：2026-08-25
- **接受日期**：2026-08-28
- **所属任务**：C-014 — 数据查看与删除
- **决策前置**：[ADR-0008 Accepted](../decisions/ADR-0008-data-rights-delivery-and-status.md)
- **修改目标**：[API 规范](./api.md)、[OpenAPI](../../openapi/openapi.yaml)、[共享 Schema](../../packages/shared-schemas/README.md)
- **权威边界**：本修订是 C-014 修改 API/OpenAPI、共享 Schema 与实现的 Accepted 合同

## 1. 目的

本修订把 ADR-0008 的决定转换为可实现、可生成、可做 negative fixture 的精确
transport shape。

## 2. 新增 View

### 2.1 DataRightsSummaryView

```text
DataRightsSummaryView = strict {
  account: strict {
    expected_revision: PositiveRevision
    state: "ACTIVE"
  }
  relationship?: strict {
    expected_revision: PositiveRevision
    state: "PRESENT"
  }
  capabilities: strict {
    export_account: boolean
    delete_day: boolean
    delete_matter: boolean
    delete_relationship_data: boolean
    delete_account: boolean
  }
  confirmation_versions: strict {
    export_account: VersionToken
    delete_day: VersionToken
    delete_matter: VersionToken
    delete_relationship_data: VersionToken
    delete_account: VersionToken
  }
  online_erasure_sla_hours: 72
  backup_max_days: 35
}
```

不存在 active RelationshipCycle 时省略 `relationship`，不得用 revision `0` 伪造一个
可删 cycle。capability 为服务端当前状态能力，不含内部角色或 feature flag 名称。

### 2.2 ExportArtifactView

```text
ExportArtifactView = discriminated strict union on state

PREPARING = {
  state: "PREPARING"
  format: "JSON"
}

READY = {
  state: "READY"
  format: "JSON"
  download_ref: OpaqueRef
  ready_at: Rfc3339Timestamp
  expires_at: Rfc3339Timestamp
}

EXPIRED | INVALIDATED = {
  state: "EXPIRED" | "INVALIDATED"
  format: "JSON"
}
```

`DataTaskView` 增加可选 `export_artifact`，并使用交叉规则：

- `kind=DELETE` 时必须不存在；
- `kind=EXPORT,status=PENDING|RUNNING` 时 state=PREPARING；
- `kind=EXPORT,status=SUCCEEDED` 时 state=READY|EXPIRED|INVALIDATED；
- DELETE SUCCEEDED 才要求 `online_erased_at` 与 `backup_purge_deadline`；
- EXPORT 不得伪造 erasure 时间。

### 2.3 DeletionStatusGrantView 与 AccountDeletionAcceptedView

```text
DeletionStatusGrantView = strict {
  task_ref: OpaqueRef
  status_token: string(min=32,max=256,base64url)
  expires_at: Rfc3339Timestamp
}

AccountDeletionAcceptedView = strict {
  task: DataTaskView(kind="DELETE",scope="ACCOUNT")
  status_grant: DeletionStatusGrantView(task_ref == task.task_ref)
}
```

`status_token` 只出现在 confirm 成功响应，不进入 `DataTaskView`、list、error、log 或
analytics。

## 3. 路径修改

| Method | Path                                                       | 成功响应                      | 授权                                                        |
| ------ | ---------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| GET    | `/data-rights/summary`                                     | `DataRightsSummaryView`       | active user bearer                                          |
| POST   | `/data-rights/delete/account/confirm`                      | `AccountDeletionAcceptedView` | active user bearer + challenge-scoped identity verification |
| GET    | `/data-rights/exports/{task_ref}/artifacts/{download_ref}` | JSON attachment               | active user bearer + owner/task/ref/state/expiry            |
| GET    | `/data-rights/deletion-status/{task_ref}`                  | `DataTaskView`                | `DeletionStatus <status_token>` only                        |

所有路径继续带 request id。JSON download 是唯一不使用通用 JSON success envelope 的
路径；它必须设置：

```text
Content-Type: application/json; charset=utf-8
Content-Disposition: attachment; filename="dailyenergy-export.json"
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

download 正文不包含内部 envelope metadata、request id 或 server error stack。失败仍使用
标准 `ApiErrorBody`，不得部分输出 artifact 后再返回 JSON error。

## 4. 命令与幂等

- `POST /data-rights/export` 仍使用 `ExportRequest` 和 idempotency key；相同 command/payload
  返回同一 task；同 owner 进行中的 EXPORT_ACCOUNT 复用 active task；
- manifest 使用 task ref 唯一；source vector/fingerprint 变化把旧 READY 转
  INVALIDATED，不原地重绑新 source；
- account confirm 同一事务创建/读取 task、递增 ACCOUNT guard、创建 hash-only status
  grant、设置 DELETING、吊销普通 session、写 allowlisted outbox；
- confirm Unknown outcome 使用 command receipt 恢复同一 task/grant；重复响应不得生成第二
  token。若 plaintext token 已丢失，不能从 hash 恢复；客户端必须保留首次成功响应，服务端
  不通过普通 session 重新签发。

## 5. 错误补充

建议新增稳定错误码：

| Code                            | Category | Retryable | 语义                                 |
| ------------------------------- | -------- | --------- | ------------------------------------ |
| `EXPORT_ARTIFACT_EXPIRED`       | GUARD    | no        | READY 后 24h 已过                    |
| `EXPORT_SOURCE_CHANGED`         | CONFLICT | no        | source vector 已变化，需新建 export  |
| `DELETION_STATUS_GRANT_INVALID` | AUTH     | no        | token/hash/task 不匹配、到期或已终止 |
| `EXPORT_TOO_LARGE`              | TERMINAL | no        | 超出 v1 受控内存/响应上限；不得截断  |

不返回 object key、source fingerprint、token hash、SQL、provider 或内部 policy 名称。

## 6. 数据与大小边界

Export JSON 顶层固定：

```text
{
  "schema_version": VersionToken,
  "generated_at": Rfc3339Timestamp,
  "profile": ClientProfileView?,
  "consent_summary": ClientConsentSummary,
  "days": ClientExportDay[],
  "matters": ClientMatterView[],
  "relationship_summary": ClientRelationshipSummary?,
  "notification_preferences": ClientNotificationPreferences,
  "safety_summary": ClientSafetySummary?,
  "data_task_summaries": DataTaskView[]
}
```

- 每个组成 View 必须另有 strict shared Schema；不得直接序列化 Prisma model；
- 不包含 preferred-name ciphertext、note 之外的隐藏文本、Prompt、provider body、raw score、
  seed、dependency、epoch、checkpoint、receipt、security log 或其它用户；
- v1 uncompressed UTF-8 最大 2 MiB，超过时整份拒绝 `EXPORT_TOO_LARGE`，不截断、不分块；
- object/DB artifact body 持久化行数为 0；普通 cache 和 CDN 命中数为 0。

## 7. Requirement-to-Proof

| Requirement                 | Automated proof                                      | 不能自动替代                      |
| --------------------------- | ---------------------------------------------------- | --------------------------------- |
| revision 可发现且无内部 ref | strict Schema + owner DB integration + leak negative | owner privacy review              |
| 24h export grant            | fake clock boundary + PG manifest + download E2E     | production legal text             |
| source 变化立即失效         | correction/delete race + fingerprint CAS             | owner UX wording review           |
| 正文零持久化                | DB/object/log/cache/analytics canary scan            | production provider authorization |
| 删除后终态可读              | session revoke + status-only auth E2E                | owner threat review               |
| status token 不越权         | task swap/replay/expiry/rate-limit negatives         | real-device secure storage review |

## 8. 接受记录

项目所有者于 2026-08-28 明确接受：

1. server-generated、正文零持久化的 24 小时 manifest artifact，而不是 v1 COS object；
2. 新增 `DataRightsSummaryView` 作为 revision discovery；
3. 最长 7 天、只读单 task 的 `DeletionStatus` grant；
4. v1 JSON 2 MiB 上限与超限整份拒绝。

本文件据此转为 Accepted；C-014 继续更新 `api.md`、OpenAPI、shared Schema、
Prisma/migration、代码与测试。

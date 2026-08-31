# ADR-0008：数据权利修订发现、短期导出与删除状态续读

- **状态**：Accepted
- **日期**：2026-08-25
- **接受日期**：2026-08-28
- **所属任务**：C-014 — 数据查看与删除
- **决策范围**：DataRights revision discovery、Export artifact、ACCOUNT 删除后的任务状态授权
- **决策所有者**：DailyEnergy 项目
- **相关文档**：[ADR-0005](./ADR-0005-data-retention-and-deletion.md)、[API 规范](../technical/api.md)、[C-014 数据权利传输契约修订](../technical/data-rights-contract-amendment.md)、[隐私数据地图](../operations/privacy-data-map.md)、[D-005 交付](../design/phase2-remaining-handoff.md)、[当前任务](../../tasks/current.md)

## 1. 背景

C-014 开始把 Accepted 数据权利规范实现为严格 Schema、TX-09、Restricted
Worker 和 SET-004 / SET-006 页面时，发现三个权威合同之间的不可达状态：

1. ADR-0005 要求 Export artifact 在 READY 后最多可访问 24 小时，但 Accepted
   OpenAPI 的 `DataTaskView` 没有 artifact 状态、到期时间或下载 endpoint；
2. ACCOUNT / RELATIONSHIP_DATA prepare 要求客户端提交 expected revision，现有
   Client View 却不提供 account revision 或 relationship revision；
3. ACCOUNT confirm 同步进入 DELETING 并吊销普通 session，但 DataTask query
   只接受普通 session，无法满足“最迟 7 天向用户展示 SUCCEEDED / FAILED”以及
   D-005 SET-006 Completed / Recoverable Error。

这些缺口不能通过硬编码 revision、复用 `target_summary`、延迟 account guard、保留
普通 session 或把失败任务标成成功来绕过。它们会分别破坏 CAS、隐私最小化、删除
立即阻断或用户可见状态真实性。

## 2. 决定

### 2.1 DataRightsSummary 是 revision discovery 的唯一入口

新增 owner-scoped `GET /v1/data-rights/summary` 和白名单
`DataRightsSummaryView`，只返回：

- `account.expected_revision` 与可执行数据权利操作；
- 当前关系数据是否存在，以及存在时的 `relationship.expected_revision`；
- 固定确认版本、在线清理目标和备份最长天数；
- 当前 active DataTask 的最小摘要可以继续由 `DataTaskListView` 提供，不在 summary
  重复用户正文。

它不返回 AccountRef、RelationshipCycle ref、guard/deletion epoch、owner token、
identity、seed、source dependency、被删内容或内部 capability topology。

DAY 的 expected revision 继续来自用户已读取的 `HistoryDayView.checkin.revision`；无
MorningCheckin 但存在其它日事实时使用公开合同中的 `0`。RELATIONSHIP_DATA 同时选择
DAY 时，每个选中日期必须先读取自己的历史详情，并原序回传 date/revision vector；
summary 不静默扩展日期范围。

### 2.2 Export 使用无正文持久化的 24 小时 manifest artifact

`DataTaskView` 对 `kind=EXPORT` 增加 `export_artifact` 白名单投影：

- `state=PREPARING | READY | EXPIRED | INVALIDATED`；
- `format=JSON`；
- READY 时返回 opaque `download_ref`、`ready_at` 与 `expires_at`；
- 客户端只显示真实状态，不显示 object key、source ref、fingerprint 或内部失败。

新增 owner-authenticated：

`GET /v1/data-rights/exports/{task_ref}/artifacts/{download_ref}`。

v1 不持久化导出正文或创建新的对象副本。Restricted Worker 只冻结允许资产的最小
source revision vector、不可逆 fingerprint、schema/policy version、ready/expiry 和
opaque download ref。下载请求重新从当前仍有效的 owner facts 生成确定性 JSON，并在
响应内存中完成序列化：

- source vector 未变化且未过期时返回 JSON attachment；
- 任一 source 更正、撤回、删除、guard 变化或 owner 状态不再允许时，旧 manifest
  原子转为 INVALIDATED，不返回旧内容；用户需要创建新的 export intent；
- READY 后 24 小时链接先失效；manifest 元数据按 ADR-0005 的 Export DataTask 期限
  清理；响应正文不进入数据库、对象存储、日志、outbox、cache 或 analytics；
- download 不延长 TTL；重复下载在同一 source vector 下字节一致；
- export 只包含 PDM 明确允许的 active product 数据和受限摘要，不含 secret、Prompt、
  Safety 内部类别、provider 字段、其它用户、内部 ref/epoch/seed 或删除防复活证据。

该选择比为 v1 引入新的持久 object artifact 更符合数据最少化，也避免在生产对象
provider 尚未完成授权时伪造合规状态。若未来导出体量超过受控内存/响应上限，需要新
ADR 决定加密对象存储、分块、密钥、下载授权和删除传播；不得静默切换。

### 2.3 ACCOUNT 删除返回 scope-limited status continuation

ACCOUNT confirm 成功响应改为 `AccountDeletionAcceptedView`：

- 内含创建或复用的 `DataTaskView`；
- 内含一次生成的 `DeletionStatusGrantView`：`task_ref`、bearer
  `status_token`、`expires_at`；
- token 只在响应中出现一次，服务端只保存 hash；最长 7 天，不刷新，不可用于其它
  task、普通 API、导出、support、Safety recovery 或新账户关联。

新增：

`GET /v1/data-rights/deletion-status/{task_ref}`

它使用独立 `DeletionStatus` authorization scheme，不接受普通 user bearer 作为替代，
只返回同一 task 的白名单 `DataTaskView`。ACCOUNT 进入 DELETING/DELETED 后：

- 普通 session 仍立即吊销，所有普通旅程 fail closed；
- status grant 只读取 PENDING/RUNNING/FAILED/SUCCEEDED、online erased、provider/backup
  deadline 与稳定失败摘要；
- 不能读取账户、身份、被删内容、checkpoint、receipt token、restore deny 或其它任务；
- token hash、失败计数和到期时间属于 Restricted runtime；成功终态或 7 天到期后清理；
- 小程序只在账户删除流程的 session-scoped storage 保存 token，完成/到期/退出后删除，
  不进入日志、analytics、分享、通知或普通 cache。

### 2.4 `DataTaskView` 的完成语义按 kind 分开

- DELETE SUCCEEDED 继续要求 `online_erased_at`、backup/provider deadline 登记与最小
  receipt；
- EXPORT SUCCEEDED 要求 `export_artifact.state=READY`，不伪造
  `online_erased_at`；
- CANCELLED 只允许 guard 生效前的 Export PREPARING；任何 DELETE guard 提交后不可
  cancel；
- 7 天未完成的删除必须 FAILED 且 guard 保持；Export manifest 过期/失效是 artifact
  状态，不改写成删除完成。

## 3. 安全与隐私边界

- 三个新 View 都使用 strict shared Schema，拒绝未知字段；
- summary、download 和 deletion-status 都做 owner/task/ref/状态授权，不依赖 opaque ref
  难猜；
- download 响应设置 `Cache-Control: no-store`、attachment、固定 JSON media type、大小
  上限和超时；Caddy/CDN/Service Worker 不缓存；
- ordinary log 只记录 operation、outcome、稳定 reason、耗时和响应大小桶，不记录 token、
  task/download ref、正文、source vector 或 identity；
- status token 与普通 bearer 使用不同 scheme/prefix、校验路径和 rate-limit bucket，防止
  confused deputy；
- export/download 在 Safety ACTIVE 下仍按用户权利最小路径处理，但不得把 Safety 原始
  输入或内部检测细节纳入 export；
- Production/RC 仍需 owner threat review、真实身份复核、受托方/地区、密钥与 incident
  evidence；本 ADR 的接受不改变 `PRODUCTION_NO_GO`。

## 4. 备选方案

### 4.1 硬编码 expected revision 为 1

关系 cycle 每次合法点亮会递增 revision。硬编码会在真实使用后稳定失败，也无法区分
过期页面与当前范围。拒绝。

### 4.2 prepare 忽略客户端 expected revision并使用数据库当前值

这会让服务端替客户端改变最终确认范围，破坏 Accepted challenge 冻结和 CAS。拒绝。

### 4.3 继续保留普通 session 直到 ACCOUNT worker 完成

与 ADR-0005 “guard 提交即普通路径阻断”冲突，并扩大被盗 session 在删除期间的能力。
拒绝。

### 4.4 在 `target_summary` 放下载 URL 或 status token

字段语义错误，容易进入日志/界面，并绕过 strict View 和授权。拒绝。

### 4.5 v1 立即引入持久化 COS artifact

需要新的 application object adapter、凭据、加密、对象生命周期、下载签名、provider
删除和生产授权；当前只有部署 smoke capability。相对当前小体量 JSON 增加不必要副本和
风险。v1 拒绝，超出受控响应上限时另立 ADR。

## 5. 后果

正面结果：

- 所有 expected revision 都来自用户可读取的权威 View，prepare/confirm 可真实到达；
- 导出满足 24 小时访问、源删除立即失效和正文零持久化；
- ACCOUNT 普通访问立即停止，同时用户仍能查看同一删除任务终态；
- D-005 SET-004 Export Ready 与 SET-006 Deleting/Completed 获得可执行后端语义。

成本与风险：

- 新增 summary、artifact manifest、download 与 status grant Schema/API/数据库对象；
- 下载时重新投影数据，需要严格大小上限、稳定序列化和超时；
- 客户端短期保存 status token，需要独立清理和 leak-negative 测试；
- C-014 必须完成本 ADR 的实现与安全证据，不能把接受决定或现有 scaffold 报告为功能完成。

## 6. 验收标准

- OpenAPI、shared Zod、generated client 和 controller 对三项合同无 drift；
- summary 只返回 account/relationship revisions 和批准 capability，不含内部 ref/epoch；
- stale summary/relationship/day vector 的 prepare/confirm 全量回滚并返回稳定 conflict；
- Export 同 source 重复下载字节一致，24 小时后拒绝，source 更正/删除后旧 grant 立即
  INVALIDATED，正文持久化/日志/analytics 扫描为 0；
- ACCOUNT confirm 同事务创建 task/guard/status grant 并吊销普通 session；普通 API
  拒绝而 status endpoint 仍只读同一 task；越权、换 task、过期、重放和 token leak 均拒绝；
- DELETE/EXPORT 两种 SUCCEEDED 语义分别由 executable Schema 和真实 PostgreSQL 测试
  证明；Redis 整体丢失可从 PostgreSQL active task/manifest 重建；
- SET-004/SET-006/REC-002 覆盖 Loading、Offline、Error、Processing、Failed、Ready、
  Deleting、Completed、Large Text、Reduced Motion；离线不排队；
- security task Gate 返回 `MANUAL_EVIDENCE_REQUIRED`，owner threat/design review 未完成时
  不得声称完整 PASS 或 Production ready。

## 7. 接受记录

- 当前状态：Accepted；
- 接受日期：2026-08-28；
- 项目所有者明确接受第 2 节全部决定、第 3 节安全与隐私边界，以及正文零持久化的
  24 小时 export manifest、`DataRightsSummary`、7 天删除状态 grant 和 2 MiB 导出上限；
- 后续动作：更新 API/OpenAPI/隐私地图/数据库/代码与测试，完成 C-014；C-014 精确
  final-head CI 验证通过前不启动 C-015。

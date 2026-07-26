# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-23
- **当前任务名称**：故障和安全事件响应
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/incident-response`
- **上游 PR**：[S-22 PR #27](https://github.com/WeiHan1996/DailyEnergy/pull/27)
- **当前 PR**：[Draft PR #28](https://github.com/WeiHan1996/DailyEnergy/pull/28)
- **交付文件**：`docs/operations/incident-response.md`

## 1. 当前目标

把 Accepted 的 Safety、隐私、删除、内容审核和用户支持边界转换为 Alpha 可执行的事件响应流程，明确：

- 哪些异常属于故障、Safety control、隐私安全、数据生命周期、provider 或发布配置事件；
- 怎样分级、声明、指挥、停用、隔离、回滚、恢复、沟通和复盘；
- 单个用户 high-risk 输入为什么不能进入普通 incident、客服或人工危机队列；
- 事件证据怎样最小化、隔离、保存和删除；
- 中国大陆法律/监管与个人通知怎样独立于内部严重度完成研判；
- 哪些能力仍是 S-29/S-31～S-33/A-008 production Gate。

## 2. 必须交付

### 2.1 事件分级与处置

- 事件类别、四级严重度、强制升级与降级规则；
- DETECTED 到 CLOSED 的状态和 revision/CAS 语义；
- 前 30 分钟通用流程与可用性、Safety、隐私、删除、provider 分类 Runbook；
- feature/route/resource/admin/deletion kill switch、维护、回滚和恢复 Gate；
- SEV0/1/2 的响应、更新、观察和复盘目标。

### 2.2 角色、沟通与通知

- Incident Commander、Technical、Safety、Privacy/Security、Communication、Scribe、Legal/Regulatory 和 Support Liaison；
- 内部、状态页、应用内、用户和支持话术边界；
- 内部 `IR-SEV*` 与法定网络安全事件分级独立；
- 个人信息泄露/篡改/丢失、网络数据安全与较大以上网络安全事件的官方现行处理 Gate；
- 主体、属地、联系人和行业规则未确定时保持 production blocker。

### 2.3 证据、恢复与下游交接

- IncidentRecord 目标最小合同、允许/禁止证据和 opaque ref；
- 网络安全日志、RestrictedAuditEvent、SafetyEvent、DeletionReceipt、LegalHold 的既有期限不被 incident 延长；
- 恢复 Gate、最短观察窗口、postmortem、行动项和演练；
- IncidentRecord/权限/监控/部署/值班/通知交给 S-29/S-31～S-33/A-005～A-008；
- 不在 S-23 修改 Prisma、API、OpenAPI、生产代码或真实配置。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/ai/safety.md`、`docs/ai/gateway.md`；
3. `docs/operations/privacy-data-map.md`；
4. `docs/operations/content-moderation.md`、`docs/operations/user-support.md`；
5. `docs/decisions/ADR-0005-data-retention-and-deletion.md`；
6. `docs/technical/error-codes.md`、`docs/technical/api.md`；
7. `docs/technical/database.md`、`prisma/schema.prisma`；
8. 中国大陆官方现行个人信息、网络数据与网络安全事件报告规则。

## 4. 已接受边界

- 单个 high-risk 输入只进入固定 SAFE-001，不创建普通事件、工单或人工危机值守；
- Safety 原文、Prompt、provider body、note、事项、签到和受限证据不得进入 incident timeline、聊天群、支持或普通日志；
- ordinary flow 不能绕过 Safety、Schema、事实、隐私、删除、认证和权限 Gate；
- 已删除数据不能为了调查、恢复或复盘重新服务；
- provider/profile 漂移必须停用 route，不以供应商口头结论恢复；
- 内部严重度不替代法定分级、监管报告或个人通知判断；
- S-22 的 SupportCase/受限摘要/受限后台仍是实现 Gate，不能由 S-23 文档解除。

## 5. 不做

- 不创建 Incident Prisma model、migration、API、OpenAPI、NestJS module、worker 或生产告警；
- 不配置真实 on-call、状态页、监管账号、邮箱、电话、群聊、provider 或 cloud；
- 不使用真实用户数据、生产日志 body、截图、导出包或真实安全事件；
- 不提供医疗/心理危机响应，不自动联系亲友、机构、警方或医院；
- 不把本文当作最终法律意见；
- 不提前完成 S-24 埋点事件字典、S-25 指标或 S-29 架构。

## 6. 验收标准

- incident 与 user Safety 隔离，普通事件/支持人员不接触 high-risk 原文；
- 类别、级别、状态、角色、声明、处置、恢复、通知和复盘相互一致；
- 官方规则引用当前有效来源，法定分级/时限有独立核验 Gate；
- IncidentRecord 与证据最小化不发明用户全文、任意后台或永久保存；
- 40 个场景 ID 唯一，覆盖正常降级、强制升级、权限、删除、provider、通知、恢复和演练；
- README、INDEX、tasks/current 和 backlog 一致标记 S-23 In Review；
- S-22 两份文档根据用户确认转为 Accepted，S-22 在 backlog 为 Done；
- PR 不包含业务代码、Schema、接口、真实配置、secret 或真实用户数据；
- 用户确认前 `incident-response.md` 保持 Draft，S-23 保持 In Review。

## 7. 最近交接

- [PR #27](https://github.com/WeiHan1996/DailyEnergy/pull/27) 已于 2026-07-26 合并，S-22 已获用户明确确认；
- `content-moderation.md` 与 `user-support.md` 在本分支补记 Accepted/接受日期，不改内容结论；
- S-23 Draft 已定义 7 类事件、4 级严重度、8 个核心角色、事件状态、前 30 分钟流程和 5 类 Runbook；
- 已冻结 SEV0/1 响应目标、法律/监管独立研判、IncidentRecord 最小合同、12 个月普通记录上限、恢复/观察/复盘与 40 个验证场景；
- Incident 模型、RBAC、告警、kill switch、状态页、真实值班、用户通知与监管联系人仍为 S-29/S-31～S-33/A-005～A-008 production Gate；
- 当前动作：等待用户审核 [Draft PR #28](https://github.com/WeiHan1996/DailyEnergy/pull/28)；不自动接受或合并，不开始 S-24。

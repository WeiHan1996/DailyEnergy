# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-22
- **当前任务名称**：内容审核和用户支持流程
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/content-moderation-support`
- **上游 PR**：[S-21 PR #26](https://github.com/WeiHan1996/DailyEnergy/pull/26)
- **当前 PR**：[Draft PR #27](https://github.com/WeiHan1996/DailyEnergy/pull/27)
- **交付文件**：`docs/operations/content-moderation.md`、`docs/operations/user-support.md`

## 1. 当前目标

把 Accepted 的内容安全、评测和隐私边界转换为 Alpha 可执行的运营流程，明确：

- 内容怎样分类、抽检、处置、复核和申诉；
- 用户支持怎样受理、分级、答复、升级和关闭；
- 运营人员能看到什么，何时需要审批与受限访问审计；
- Safety 原文、普通支持反馈、受限审计和用户权利摘要怎样隔离；
- 哪些流程仍是 production Gate，不能靠人工兜底或文档描述视为已实现。

## 2. 必须交付

### 2.1 内容审核

- 风险分类、处置动作、抽检策略、复核与申诉路径；
- 生成内容、固定 Safety 响应、用户自由文本和分享内容的不同边界；
- 高风险内容只能进入专业安全路径，不得落入普通客服或常规审核队列；
- 角色、最小权限、break-glass、审批和访问审计；
- 能覆盖正常、误判、漏判、重复提交、升级失败和删除中的验证场景。

### 2.2 用户支持

- 咨询、故障、反馈、账户与用户权利请求的受理和分流；
- FAQ、状态反馈、服务级别、升级、关闭、纠正与申诉路径；
- 支持记录的最小字段、权威位置、访问者、保存期限、删除、导出和受托方约束；
- 解决 S-21 `support feedback` 当前仅允许 T0 处理后丢弃、不得持久化或人工转交的 Gate；
- 定义 Safety/删除/受限审计查阅复制摘要路径，但不得向普通支持暴露原文。

### 2.3 受限访问与下游交接

- 按最短必要原则冻结 `RestrictedAuditEvent.expiresAt` 的最大期限，或在无法冻结时明确 ADR owner 与 production blocker；
- 将需要数据库/API/架构实现的内容交给 S-29 及后续工程任务，不在 S-22 直接改 Schema 或接口；
- 将安全事件响应留给 S-23，将 analytics 事件和指标留给 S-24/S-25。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/operations/privacy-data-map.md`；
3. `docs/ai/safety.md`、`docs/ai/evaluation.md`、`docs/ai/personality.md`；
4. `docs/product/journey.md`、`docs/product/mvp.md`；
5. `docs/design/screen-specs.md`、`docs/design/interaction-states.md`；
6. `docs/data/domain-model.md`、`docs/decisions/ADR-0005-data-retention-and-deletion.md`；
7. `docs/technical/database.md`、`prisma/schema.prisma`；
8. `docs/technical/api.md`、`docs/technical/error-codes.md`、`openapi/openapi.yaml`。

## 4. 已接受边界

- 普通支持、审核、日志和通知不得收集或复制 Safety 原始输入；
- 普通运营后台不得提供任意用户全文浏览；
- 在 S-22 冻结支持模型和流程前，`support feedback` 只能 T0 处理后丢弃，不得持久化、建工单或人工转交；
- 用户权利摘要按 Privacy Data Map 第 12.1 节执行，restricted 域不能成为自动拒绝访问、复制或删除请求的理由；
- 未成年人生产策略、analytics 用户级收集、真实受托方和跨境状态继续保持 Gate；S-22 不得静默解除；
- 所有新保存期限、字段、目的、接收方或系统能力必须有 Accepted 上游；缺失时记录阻塞项，不自行发明。

## 5. 不做

- 不修改数据库、Prisma、migration、API、OpenAPI、NestJS、worker 或生产代码；
- 不配置真实客服、审核、AI provider、云服务、账号或 secret；
- 不写最终隐私政策、用户协议或法律意见；
- 不创建真实工单、使用真实用户数据或启用人工高风险处置；
- 不提前完成 S-23 故障和安全事件响应、S-24 埋点或 S-25 指标口径。

## 6. 验收标准

- 两份 Draft 文档覆盖角色、入口、状态、处置、升级、审计、保存删除和用户权利；
- moderation/support 场景具有稳定唯一 ID，并覆盖正常、异常、权限、删除和 Safety 隔离；
- 每项记录都能追踪到权威对象、位置、访问者、期限和删除路径；未冻结项有 owner、任务与阻塞条件；
- ordinary support/moderation 不出现 Safety 原文、任意全文后台或隐式永久保存；
- docs/INDEX、tasks/current、backlog 和 README 状态一致；
- PR 不包含业务代码、Schema、接口、真实配置、secret 或真实用户数据；
- 用户确认前两份文档保持 Draft，任务保持 In Review。

## 7. 最近交接

- 两份运营 Draft 已完成，共包含 24 个内容审核场景与 30 个用户支持场景；
- 内容审核冻结全候选硬 Gate、合成抽检、用户主动反馈、独立 Safety 复核与资源 90 天核验；
- 用户支持冻结现有 OpenAPI 五类入口、SupportCase 目标合同、正文关闭后 30 天/元数据 90 天/正文绝对 180 天上限；
- break-glass 冻结为案例级、只读、独立审批、最长 60 分钟；`RestrictedAuditEvent.expiresAt` 普通上限为 6 个自然月；
- 数据模型、API、独立 case 删除/导出、受限摘要、RBAC 与到期 worker 仍是 S-29/C-014 等下游 production Gate；
- 当前动作：创建 Draft PR，等待用户审核；不自动接受或合并，不开始 S-23。

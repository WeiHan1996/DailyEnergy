# DailyEnergy 故障和安全事件响应

- **文档状态**：Accepted
- **接受日期**：2026-07-26
- **所属任务**：S-23 — 故障和安全事件响应
- **最后更新**：2026-07-26
- **适用范围**：Phase 0B / P0～P1 的系统故障、内容 Safety 控制失效、个人信息与网络安全事件、删除/恢复异常、AI provider 与受托方事件
- **上游权威**：[内容安全](../ai/safety.md)、[AI Gateway](../ai/gateway.md)、[隐私数据地图](./privacy-data-map.md)、[内容审核](./content-moderation.md)、[用户支持](./user-support.md)、[ADR-0005](../decisions/ADR-0005-data-retention-and-deletion.md)、[API 错误码](../technical/error-codes.md)
- **下游任务**：S-29、S-31～S-33、A-005～A-008、C-014、AI-012～AI-015

## 1. 目的、范围与非目标

本文把已接受的 Safety、隐私、删除、审核和支持边界转换为可执行的事件响应流程。目标是：

- 尽快识别影响用户、安全控制、数据或核心旅程的异常；
- 用统一分级和指挥角色决定是否停用、降级、隔离、回滚和通知；
- 在不复制用户原文、不扩大访问范围的前提下保存最小证据；
- 明确恢复 Gate、观察窗口、复盘和整改闭环；
- 把仍需架构、部署、可观测性、权限和人员实现的能力列为 production Gate。

本文不：

- 建立人工危机热线、危机陪聊、医疗或心理专业服务；
- 把单个用户的 high-risk 输入自动升级为系统事件或客服工单；
- 创建数据库表、Prisma model、API、告警平台、状态页、值班账号或生产配置；
- 指定真实个人电话、邮箱、群聊或未评审的外部通道；
- 替代法律意见，或在主体、地区和事件事实未确认时决定最终监管/个人通知义务；
- 提前定义 S-33 的精确 SLO、指标阈值和监控实现；
- 允许为了调查而恢复已删除内容、打开任意全文后台或绕过 Safety/删除 guard。

本文为 Draft 时不解除任何生产 Gate。只有用户明确接受、下游能力实现并完成演练后，才能把本流程视为可运行的事件响应能力。

## 2. “用户 Safety”与“系统安全事件”必须分离

DailyEnergy 中有两种不能混淆的“安全”：

| 类型 | 含义 | 权威流程 |
|---|---|---|
| 用户输入触发的 Safety | 单次用户文本命中自伤、自杀、伤害他人、医疗急症或现实人身危险 | `docs/ai/safety.md` 的固定 SAFE-001；不进入普通客服或事件群 |
| 系统/流程安全事件 | Safety Gate、资源、权限、数据、删除、provider、日志或基础设施发生失效或异常 | 本文的 Incident 流程 |

边界：

- 单个 high-risk 输入本身不是 incident，不通知工程、运营或管理层，也不创建含原文记录；
- high-risk 输入原文不得进入 incident timeline、工单、聊天群、日志、截图、录屏、复盘或监管报告草稿；
- 系统性漏判、固定响应不可用、资源错误、Safety 原文泄露或普通路径绕过权威 Safety 状态，才可能构成 incident；
- 事件响应人员不判断用户是否“安全”、是否康复或是否需要报警；产品仍只展示经审核的固定现实求助入口；
- 事件处理不能清除某个用户的 Safety 状态；用户恢复继续服从已接受的两步恢复协议。

## 3. 事件类别

一个事件可以同时属于多个类别；主类别用于分配负责人，不得掩盖其它影响。

| 类别码 | 范围 | 典型例子 |
|---|---|---|
| `INC-RELIABILITY` | 可用性、延迟、队列、数据库、缓存、网络和核心旅程 | 登录不可用、生成全路径失败、点亮/反馈写入持续失败 |
| `INC-SAFETY-CONTROL` | 输入 Safety、覆盖状态、固定响应、资源 registry、输出 Safety Gate | high-risk 进入普通运势、SAFE-001 不可展示、资源错误 |
| `INC-PRIVACY-SECURITY` | 越权、泄露、篡改、丢失、攻击、凭据和受限访问 | 任意全文浏览、密钥暴露、未经授权导出、Safety 原文进日志 |
| `INC-DATA-LIFECYCLE` | 删除、保存期限、备份、恢复、provider 到期和 legal hold | deletion guard 失效、已删数据复活、备份超过 35 天仍可用 |
| `INC-AI-PROVIDER` | provider、模型、route、成本、协议、数据处理配置 | observed model 漂移、训练设置开启、primary/backup 同时异常 |
| `INC-RELEASE-CONFIG` | 发布、配置、Prompt、模板、Schema、资源或权限变更 | 未审核版本激活、回滚目标不可用、权限策略误发布 |
| `INC-SUPPORT-OPS` | FAQ、支持工具、审核队列、用户权利协助 | 支持工具不可用、DataTask 摘要冲突、资源报告未升级 |

事件类别不是 metric label 的授权。用户级类别、Safety category、原始输入、具体事项和其它高基数内容永久禁止进入普通指标。

## 4. 严重级别

### 4.1 分级表

| 级别 | 定义 | 典型触发 | 默认响应 |
|---|---|---|---|
| `IR-SEV0` Critical | 正在发生或极可能发生严重用户/数据伤害，关键安全边界已失效，必须立即停止影响面 | Safety 原文泄露；认证/授权绕过；密钥泄露；删除数据复活并可读；high-risk 可进入普通路径；错误固定资源且无已核验兜底 | 立即声明；先停用/隔离再调查；24×7 指挥；法律/监管判断并行 |
| `IR-SEV1` High | 核心旅程大范围不可用、重要控制显著退化，或有限范围数据/安全风险仍在扩大 | 主备与模板全失败；多用户数据完整性异常；资源失效但有安全兜底；provider 违反已接受数据处理配置 | 30 分钟内声明；一小时内开始明确控制；按小时更新 |
| `IR-SEV2` Medium | 局部功能退化或单一受控范围异常，安全/删除 guard 仍有效且有可接受降级 | 单区域/单版本故障；支持工具不可用但 FAQ/权利入口仍可用；单账户一致性异常且未暴露数据 | 工作时段响应；限定范围；下一工作日内给出恢复计划 |
| `IR-SEV3` Low | 没有当前用户影响，来自 canary、演练或预发布检查的可控缺陷 | STAGED route 配置失败、合成回归失败、过期版本未激活 | 进入正常缺陷流程；禁止把失败版本发布 |

### 4.2 强制升级

无论受影响用户数量多少，以下情况至少为 `IR-SEV0`：

- Safety raw input、preferred name、evening note、matter title、Prompt、provider body 或受限证据出现在公开/普通日志、分析、支持或非授权系统；
- 已删除范围通过普通 API、缓存、搜索、备份恢复或 provider 迟到结果重新可用；
- 生产凭据、签名密钥、KMS 访问或管理员高权限可能被未授权使用；
- ordinary flow 已知能够绕过 `ACTIVE / RECOVERY_PENDING`、输入 high-risk 或完整候选 Safety Gate；
- 普通运营后台出现跨用户任意全文读取、导出或批量关联能力；
- 事件响应人员准备通过个人邮箱、IM、表格、本地文件或截图复制真实用户材料。

以下情况至少为 `IR-SEV1`：

- Daily 的 primary、backup 和 controlled template 对一批用户同时不可用；
- 固定 Safety 资源失效或错误，但仍有不依赖该资源的已审核安全兜底；
- provider 的 training、retention、region、subprocessor 或 observed model 与 ACTIVE profile 不一致；
- 删除、导出、Safety 或受限访问任务超过 Accepted SLA，尚未出现数据复活或越权；
- 支持/审核发现系统性 hard-gate 漏判或资源错误。

### 4.3 降级与关闭

- 初始信息不足时按更高一级处理；不能因为“尚未证明有影响”自动降级；
- 只有 Incident Commander 与对应 Safety/Privacy/Security owner 共同确认控制已生效，才能从 SEV0/1 降级；
- 用户数量少不能抵消 Safety、凭据、删除或越权影响；
- 供应商声明“已修复”不等于恢复 Gate 通过；
- 法定网络安全事件分级与内部 `IR-SEV*` 独立研判，不能把内部降级当作无需报告的依据。

## 5. 检测来源与声明阈值

| 信号 | 默认动作 |
|---|---|
| 自动硬 Gate、raw-content detector、越权或删除 detector 命中 | 立即创建受限事件候选并执行保守分级 |
| 多个 SupportCase 报告同一稳定错误码/版本 | 聚合无原文 refs；达到 S-33 阈值后声明 |
| 用户报告 Safety 资源错误或 hard-gate 漏判 | 立即由 Safety owner 复核；不得要求用户重述 high-risk 原文 |
| provider/受托方安全通知 | 先禁用受影响 route/数据流，再验证范围 |
| 凭据扫描、仓库 secret 扫描或异常管理员访问 | 按 SEV0 处理，先吊销/隔离 |
| 删除 SLA、provider expiry、备份 35 天或审计到期超限 | 立即阻断相关恢复/使用，按影响至少 SEV1 |
| 合成 canary 或预发布回归失败 | 阻止激活；无生产影响时 SEV3 |
| 社交媒体、公开评论或外部研究者报告 | 记录公开 URL/时间和最小事实；不要求在公开渠道发送用户数据或漏洞利用细节 |

声明原则：

1. 任何员工、自动化检测或已评审供应商都可以提出 incident candidate；
2. SEV0/1 不等待根因、精确数量或完整日志才声明；
3. 初始记录只需类别、发现时间、受影响能力、当前风险和已采取的第一项控制；
4. 未达到 incident 阈值的缺陷仍进入正常 bug/内容审核流程，不得用“不是 incident”丢失整改；
5. 同一根因或同一影响面的告警合并到 canonical incident，不复制证据或刷新保存期。

## 6. 角色与指挥结构

| 角色 | 主要职责 | 禁止事项 |
|---|---|---|
| `INCIDENT_COMMANDER` | 声明级别、分配角色、确定优先级、批准恢复与关闭 | 同时亲自执行所有技术操作；跳过独立审批 |
| `TECHNICAL_LEAD` | 隔离、回滚、修复、验证、记录技术时间线 | 为方便排障打开 raw body 日志或复制生产数据 |
| `SAFETY_LEAD` | Safety control、固定响应、资源和 fail-closed 判断 | 接触/要求重述用户 high-risk 原文；提供个案危机服务 |
| `PRIVACY_SECURITY_LEAD` | 数据范围、越权、证据、通知与受限访问判断 | 把受限证据复制给普通支持或事件群 |
| `COMMUNICATIONS_LEAD` | 内部、状态页、应用内、用户和支持话术 | 猜测根因、数量、恢复时间或法律结论 |
| `SCRIBE` | 维护 UTC 时间线、决策、行动、owner 和结果码 | 粘贴日志 body、用户文本、secret 或截图 |
| `LEGAL_REGULATORY_OWNER` | 适用主体、事件法定分级、监管/个人通知和留存例外 | 用内部 SEV 代替法律判断；延迟补救等待完整意见 |
| `SUPPORT_LIAISON` | 给 FAQ/支持提供批准话术和事件 ref | 让普通客服查看事件证据、Safety 原文或攻击细节 |

规则：

- SEV0/1 必须指定 Incident Commander、Technical Lead、Privacy/Security 或 Safety owner、Communications Lead 和 Scribe；
- 请求 break-glass 的人不能审批自己的访问；最长 60 分钟、只读、案例/对象级，服从 S-22；
- 生产前必须配置真实、已演练的 24×7 SEV0/1 值班和替补；本文不写个人联系方式；
- 当前没有真实值班、状态页和监管联系人，因此不能声称已经具备生产事件响应能力；
- 任何人都可以要求暂停高风险变更；恢复必须由 Incident Commander 和独立 owner 双人批准。

## 7. 生命周期与状态

```text
DETECTED → DECLARED → CONTAINING → RECOVERING → MONITORING → RESOLVED → CLOSED
     └────────────────────────────→ DISMISSED
```

| 状态 | 进入条件 | 退出条件 |
|---|---|---|
| `DETECTED` | 有可验证信号，但尚未完成分级 | 声明 incident，或证明为误报 |
| `DECLARED` | 已有级别、Incident Commander、影响能力和第一控制动作 | 开始执行明确 containment |
| `CONTAINING` | 停用、隔离、吊销、maintenance 或 route disable 正在执行 | 影响不再扩大，guard 可验证 |
| `RECOVERING` | 修复/回滚已准备，正在验证数据与控制 | 所有恢复 Gate 通过并逐步放量 |
| `MONITORING` | 服务已恢复但仍在观察复发与遗漏 | 完成对应最短观察窗口且无新异常 |
| `RESOLVED` | 用户影响停止，数据/安全边界恢复，短期行动有 owner | 复盘、通知、整改登记完成 |
| `CLOSED` | 复盘完成，必须行动全部进入有 owner/期限/验收的任务 | 终态；复发建立新 incident 并关联 |
| `DISMISSED` | 经证据确认是误报且无用户/数据影响 | 记录依据；若证据不足不得使用 |

状态转换使用 revision/CAS；不能静默改写时间线。升级、降级、恢复、通知与关闭都是追加决策事件。

## 8. 前 30 分钟通用流程

1. **保护用户优先**：停止可能继续造成伤害的写入、展示、导出、分享、provider 调用或管理员访问；
2. **声明与分级**：记录发现时间、初始级别、类别、影响能力和 Incident Commander；
3. **验证 guard**：Safety、deletion、account、date、consent 和 maintenance guard 必须 fail closed；
4. **选择最小控制**：优先 feature/route/config disable、只读、已接受 template、上一受审版本或全站阻断维护；
5. **限制访问**：关闭任意后台查询，吊销可疑会话/凭据，禁止下载/截图/复制；
6. **建立时间线**：只写 UTC 时间、版本、稳定错误码、无内容计数、动作和结果；
7. **并行法律判断**：涉及泄露、篡改、丢失、违法犯罪线索或较大以上网络安全事件时，立即交 Legal/Regulatory owner；
8. **发布首次内部更新**：已知事实、未知项、当前控制、用户可用替代路径、下次更新时间；
9. **不要等待根因**：控制和必要通知不以完整根因分析为前提；
10. **禁止临时旁路**：不能为了恢复指标关闭 Safety、Schema、权限、删除或隐私 Gate。

## 9. 分类处置 Runbook

### 9.1 可用性与核心旅程

- 优先保留登录后的已有结果读取、确定性事实、用户权利入口和固定 Safety 响应；
- AI primary 异常依次使用 Accepted backup 与 controlled template；不能并行拼接、重复调用或展示 partial candidate；
- Daily 全路径失败时返回稳定失败/维护状态，不生成随机文本；
- Weekly AI 失败不阻断已验证的真实图表与计数；
- 数据库写入 unknown outcome 先查询 command receipt/权威对象，不能换 command ref 重复写；
- 必须阻断的维护使用 `MAINTENANCE_BLOCKING`；可安全部分服务使用 `MAINTENANCE_DEGRADED`；
- 缓存、队列或依赖不可见时不能假装成功，也不能绕过权威 guard。

### 9.2 Safety control

- 输入 high-risk 绕过、Safety state 不生效或固定响应不能可靠展示时，立即关闭受影响自由文本和普通旅程写入；
- 如果 SAFE-001 固定核心说明仍可信，只下线错误/过期资源项并使用已审核的无资源兜底；
- 如果固定说明、状态或资源整体不可信，fail closed，不回退普通运势、普通模板或客服人工回复；
- 停止受影响 Prompt、route、template、resource registry 或 policy version 的新激活；
- 只用合成 fixtures 和无原文 event ref 复现；不得从日志、支持或用户处恢复原文；
- 系统性漏判必须增加合成回归并完成独立 Safety 审批后才能恢复。

### 9.3 隐私、越权与凭据

- 立即停止受影响 admin、export、share、support、日志查询或 provider 数据流；
- 吊销会话、API key、token、证书或管理员权限；轮换前先记录不含 secret 的版本/指纹；
- 保留最小网络安全日志、访问结果和 opaque refs，不把生产数据复制到个人工具；
- 评估是否发生或可能发生泄露、篡改、丢失，以及数据类别、人数区间、时间范围、受托方和可能危害；
- 不能确认范围时按可能影响处理；不得以“还没看到下载证据”否认未授权访问；
- 用户支持只接收批准的事件摘要和公开建议，不接收证据或个体受影响清单。

### 9.4 删除、保存与恢复

- deletion guard、账户 `DELETING` 和 restore deny 永远优先；故障期间不能恢复 ACTIVE；
- 发现已删数据可读时，立即阻断相关 scope 的读取、生成、导出、通知、分享和缓存；
- 备份恢复必须重新隔离，重放 deletion ledger/guard 并运行 deleted-data detector 后才能对外；
- provider 删除失败继续使用原 task ref 重试，数据保持 restricted，不创建第二任务绕过；
- 备份超过 35 天、在线清理超过 72 小时、provider 请求超过 24 小时或任务 7 天未完成时，按 Accepted SLA 升级；
- 事件证据不能成为保存被删正文的新理由；需要依法保留时只使用独立 LegalHold 的最小范围。

### 9.5 Provider、受托方与供应链

- data-handling profile 未知、训练开启、retention 超过 30 天、region/subprocessor 漂移或 observed model 不符时，立即将 route 置为不可 ACTIVE；
- provider 事件不影响 fixed Safety、existing result、确定性事实和用户删除；
- primary/backup 同故障域时不能声称已有 provider-level redundancy；
- 对可能已披露的数据登记 provider、时间窗口、允许字段、profile version 和 opaque request refs，不保存 request body；
- 按合同要求供应商保存其调查证据、通报进展并执行删除/隔离；供应商“无影响”结论必须由本方验证；
- 凭据疑似泄露时先禁用和轮换，再恢复 route；不能只改监控阈值。

## 10. Containment、回滚与紧急开关

下游架构必须提供并演练以下受控能力：

| 控制 | 使用条件 | 不得影响 |
|---|---|---|
| 全站阻断维护 | 不能保证认证、Safety、删除或数据完整性 | 固定安全说明、必要状态说明和合法用户权利支持 |
| 功能级 disable | 单一入口、写入、分享、导出或后台不可信 | 其它已证明安全的只读能力 |
| provider route disable | provider、模型、凭据、profile 或 breaker 异常 | controlled template 与已有结果读取 |
| resource entry disable | 单个 Safety 资源错误/过期 | 已审核的固定说明与其它有效资源 |
| admin/support access freeze | 越权、泄露或审计异常 | 用户自助权利和前台必要服务 |
| session/key revocation | 凭据或管理员会话疑似泄露 | 新的合法重认证 |
| deletion/restore freeze | guard、备份或恢复异常 | 已生效删除语义；不能解封已删数据 |
| rollback to Accepted version | 新发布版本导致异常 | 历史已发布结果不重生成、不改写 |

紧急开关必须：

- 使用预先登记、最小权限、双人审批或事后在极短窗口补审的机制；
- 记录 config/version、发起人角色、批准人角色、时间、原因码和结果；
- 不携带用户内容或 secret；
- 可自动到期或显式恢复，不能留下永久隐藏旁路；
- 恢复前重新运行完整适用 Gate。

## 11. 沟通规则

### 11.1 内部更新

| 级别 | 首次内部更新 | 后续节奏 |
|---|---:|---:|
| `IR-SEV0` | 声明后 15 分钟内 | 至少每 30 分钟，或重大变化立即 |
| `IR-SEV1` | 声明后 30 分钟内 | 至少每 60 分钟 |
| `IR-SEV2` | 4 个工作小时内 | 每个工作日，或恢复时 |
| `IR-SEV3` | 进入缺陷系统时 | 按任务节奏 |

每次更新只包含：

- incident ref、级别、类别、开始/发现时间；
- 已确认影响能力和粗粒度范围；
- 当前用户可见状态与替代路径；
- 已完成/下一步控制及 owner；
- 仍未知的关键项；
- 下次更新时间。

### 11.2 用户与公开沟通

- 使用状态页、应用内公告或用户可访问页面；在真实通道确定前不写个人账号；
- 说明“发生了什么能力影响、我们采取了什么措施、用户现在能做什么、何时再更新”；
- 不暴露攻击细节、内部规则、Safety classifier、员工身份、其它用户信息或可被利用的漏洞；
- 不声称“数据绝对没有泄露”“已经完全删除”“一定在某时恢复”，除非有可验证证据；
- 不把 provider、AI、网络或用户归咎为原因；根因未确认时明确写“仍在调查”；
- 不向曾触发 Safety 的用户发送基于个体风险的事件通知，也不把资源点击当作送达/安全证明；
- 普通支持使用 approved incident message，不自行补充技术、法律或 Safety 结论；
- 纠正错误公告时追加 correction 和时间，不静默改写历史。

### 11.3 服务目标，不是当前承诺

| 级别 | 确认/声明目标 | 开始 containment | 首次用户状态更新 |
|---|---:|---:|---:|
| `IR-SEV0` | 15 分钟 | 立即 | 60 分钟内，若用户受影响 |
| `IR-SEV1` | 30 分钟 | 60 分钟内 | 2 小时内，若用户受影响 |
| `IR-SEV2` | 4 个工作小时 | 1 个工作日内 | 有持续可见影响时 1 个工作日内 |
| `IR-SEV3` | 1 个工作日 | 按发布阻断处理 | 通常不需要 |

这些目标只有在 S-29/S-32/S-33、真实值班和通信通道实现后才成为运行目标。当前不得对用户宣传 24×7 响应。

## 12. 法律、监管与个人通知 Gate

### 12.1 当前官方基线

截至 2026-07-26，文档采用以下中国大陆官方基线：

- 《个人信息保护法》第五十一条要求制定并实施个人信息安全事件应急预案；第五十七条要求在发生或者可能发生个人信息泄露、篡改、丢失时立即采取补救措施，并通知履行个人信息保护职责的部门和个人；如果措施能够有效避免危害，可以不通知个人，但主管部门仍可要求通知。  
  官方来源：https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm
- 《网络数据安全管理条例》第十至十一条要求对安全缺陷、漏洞和网络数据安全事件立即采取补救、启动预案、防止危害扩大，并按规定报告；对个人或组织合法权益造成危害时，应及时通知利害关系人。  
  官方来源：https://www.cac.gov.cn/2024-09/30/c_1729384452307680.htm
- 《国家网络安全事件报告管理办法》自 2025-11-01 施行。属于“较大以上”的事件时，其他网络运营者应及时向属地省级网信部门报告，最迟不超过 4 小时；原因或范围尚不完整时可以先报基本情况并及时补报，处置结束后 30 日内按原渠道提交总结报告。关键信息基础设施、中央和国家机关及行业专门规则适用不同路径与时限。  
  官方来源：https://www.cac.gov.cn/2025-09/15/c_1759583017717009.htm

### 12.2 决策流程

1. 发现泄露、篡改、丢失、安全缺陷、网络攻击、越权、数据复活或疑似违法犯罪线索时，立即补救；不能等待通知结论；
2. `LEGAL_REGULATORY_OWNER` 核验实际运营主体、注册地/属地、是否网络运营者、是否关键信息基础设施、是否有行业专门规则；
3. 按法定指南独立研判是否达到“较大以上”等级；内部 `IR-SEV*` 仅用于运营，不能替代；
4. 记录 `discovered_at`、`legal_clock_started_at`、适用规则版本、判断人角色、已知/未知事实和最晚决策时间；
5. 符合报告条件时按适用渠道先报基础情况；未知原因、人数和趋势及时补报，不因信息不完整错过时限；
6. 依据个人信息保护法判断是否通知个人、通知范围、方式和内容；不通知个人必须有“措施已有效避免危害”的可验证依据和批准；
7. 涉嫌违法犯罪时按规定向公安机关等报案；普通工程/支持人员不得自行联络或公开披露；
8. 保存报告回执、决定和版本的最小受限证据；不得把用户原文或无关数据库行复制进报告；
9. 法律或监管要求与本文更严格边界冲突时立即升级并记录新 ADR/隐私评审，不静默修改期限或用途。

### 12.3 上线前未决项

在真实主体、属地、联系人、行业属性、受托方和跨境路径没有 Accepted 结论前：

- 不得预填监管部门、个人邮箱、电话或报送账号；
- 不得宣称所有 incident 统一适用 4 小时或无需通知个人；
- 不得把本文当作最终法律意见；
- 必须将主体与报告路径核验列为 Alpha/Beta 前 production Gate。

## 13. IncidentRecord 最小合同与证据边界

S-23 冻结目标运营合同，不直接新增 Prisma model。

### 13.1 最小字段

```text
IncidentRecordV1 {
  incident_ref
  category_codes[]
  severity
  state
  revision

  detected_at
  declared_at?
  contained_at?
  resolved_at?
  closed_at?

  affected_capability_codes[]
  affected_version_refs[]
  environment
  coarse_impact_range
  stable_reason_codes[]

  commander_role
  assigned_role_codes[]
  current_action_summary
  next_update_at?

  regulatory_assessment_status
  user_notification_status
  linked_opaque_refs[]

  retention_policy_version
  expires_at
}
```

约束：

- `incident_ref`、版本和关联 ref 不可反查用户；不保存 AccountRef、openid、手机号或支持正文；
- `coarse_impact_range` 使用封闭区间，不记录受影响用户清单；需要通知个人时由独立受限流程生成，不复制到 IncidentRecord；
- timeline 只保存 UTC 时间、角色、动作码、版本、结果和中性摘要；
- root cause、修复和复盘使用系统/版本事实，不粘贴生产数据、日志 body、SQL、Prompt 或截图；
- 任何受限证据只通过 opaque ref 关联，普通事件参与者无权打开；
- 数据主体访问、导出或删除涉及事件时按 Privacy Data Map 的受限摘要路径处理。

### 13.2 允许的证据

- 代码 commit、route/config/policy/resource version 与 fingerprint；
- 稳定错误码、metric bucket、粗粒度时间窗口和不可识别计数；
- 受限网络安全日志、RestrictedAuditEvent、DeletionReceipt、provider evidence 的 opaque ref；
- 操作批准、kill switch、key rotation 和回滚结果；
- 合成复现、回归和 canary 结果。

### 13.3 禁止的证据

- 用户自由文本、Safety raw input、分类 rationale/confidence；
- preferred name、签到、note、事项、记忆、完整内容快照；
- Prompt/provider request/invalid raw response、token、cookie、key、完整 IP；
- 数据库行、对象文件、支持附件、导出包、截图、录屏和本地 dump；
- 以“复盘需要”为理由延长或恢复已删内容。

### 13.4 保存

- IncidentRecord、无个人信息 timeline 和无个人信息 postmortem 属于系统运营文档；目标普通保存上限为 `CLOSED` 后 12 个自然月；
- 与个人信息保护影响评估或处理情况合并的记录至少 3 年，必须保持文档级、去除真实用户样本；
- 网络安全日志按 ADR-0005 保存 6 个自然月；
- `RestrictedAuditEvent` 普通上限为 6 个自然月；
- SafetyEvent、DeletionReceipt、provider/backup 与 LegalHold 各自服从 Accepted 期限，不因 incident 自动延长；
- 依法需要保留受限证据时使用独立 LegalHold，最小范围、每 90 天复核；不能把 IncidentRecord 的 `expires_at` 改成永久。

IncidentRecord 尚未进入 Privacy Data Map、database、Prisma 或 API；S-29 必须决定是否建立实体或使用等价受控系统，并同步 S-21 映射。完成前不得在生产持久化个人关联 incident 数据。

## 14. 恢复 Gate

任何 SEV0/1 恢复必须逐项满足：

1. 影响面已停止扩大，当前 guard 与紧急开关状态可验证；
2. 根因或足以保证安全恢复的失效机制已确认；
3. 修复使用新不可变版本或明确 Accepted 回滚目标，不在线热改历史版本；
4. 适用的 Schema、事实、隐私、Safety、删除、认证和权限测试全部通过；
5. 使用合成 fixtures 完成原场景复现与回归，不读取真实用户原文；
6. 迟到 provider、队列、缓存、分享、导出和客户端旧版本不会绕过新 guard；
7. 删除/恢复事件完成 deletion ledger replay 与 deleted-data detector；
8. 凭据事件完成吊销、轮换、权限缩减与异常访问复核；
9. provider 事件完成 data-handling profile、observed model、retention/training/region 复核；
10. 用户状态页、支持话术和必要法律/监管通知已更新；
11. Incident Commander 与独立 Safety 或 Privacy/Security owner 双人批准；
12. 已定义放量顺序、回滚触发和观察窗口。

禁止恢复方式：

- 临时关闭 Safety、输出 validator、权限、删除 guard、rate/cost 或 retention Gate；
- 让客服人工发送普通运势、固定 Safety 文案或资源号码；
- 使用“多数请求成功”掩盖 Safety、越权或删除失败；
- 把数据恢复到生产后再异步补删；
- 用 provider 的口头确认替代本方验证；
- 为了复现打开 body logging 或复制真实生产数据。

## 15. 观察、解决与复盘

### 15.1 最短观察窗口

| 级别 | 最短观察 |
|---|---:|
| `IR-SEV0` | 24 小时，并至少覆盖一个关键业务窗口 |
| `IR-SEV1` | 12 小时 |
| `IR-SEV2` | 2 小时或一个受影响任务周期，取更长者 |
| `IR-SEV3` | 预发布回归通过即可 |

观察期内复发直接回到 `CONTAINING`，不能新建无关联 incident 隐藏复发。

### 15.2 解决标准

- 当前用户影响停止且替代路径可用；
- 安全、隐私、删除和数据完整性控制已恢复；
- 必要通知已发送或有经批准的不通知决定；
- 受影响版本、凭据、资源和数据流状态明确；
- 短期纠正行动有 owner、期限和验收；
- 残余风险已明确接受或继续阻断生产。

### 15.3 复盘时限

- SEV0/1：`RESOLVED` 后 5 个工作日内完成内部 postmortem；
- SEV2：10 个工作日内完成简化复盘；
- SEV3：记录到缺陷/发布评审即可；
- 法定“较大以上”网络安全事件：处置结束后 30 日内按原渠道提交总结报告，服从当时适用规则。

复盘至少包含：

- 事件摘要、影响、UTC 时间线和 detection gap；
- 哪个控制应阻止、检测或限制事件，为什么没有；
- containment、恢复和沟通是否及时；
- 数据/用户/监管判断及证据；
- 做得有效的控制与需要改进的系统；
- 带 owner、期限、优先级、验收和关联任务的行动项；
- 防止重复的自动测试、告警、权限或发布 Gate。

复盘不追责个体，不包含用户文本、秘密、攻击可利用细节或真实用户样本。`CLOSED` 之前，所有 P0/P1 行动必须进入 backlog/issue，不能只写“持续关注”。

## 16. 演练、培训与准备度

Alpha 前 A-008 至少完成以下桌面/故障注入演练：

1. Safety fixed response 可用但一个地区资源错误；
2. high-risk 输入意外进入普通生成路径；
3. Safety raw text 被 raw-content detector 在日志中发现；
4. Daily primary、backup 和 template 同时失败；
5. 管理后台越权读取或导出；
6. provider key 泄露并发生 observed model/profile 漂移；
7. DAY/ACCOUNT 删除后从 20 天备份恢复并检测到复活；
8. 支持工具不可用，用户权利任务仍需继续；
9. 需要在原因和人数未知时完成监管初报；
10. 状态页错误公告的追加纠正。

要求：

- 每次演练使用合成数据和测试环境；
- 记录声明、角色、控制、恢复、沟通、法律判断和实际耗时；
- SEV0/1 值班、权限、紧急开关和联系人每 90 天演练/核验一次；
- route、Safety policy、resource registry、删除/恢复、权限或部署架构重大变更后追加定向演练；
- 演练失败是 production Gate，不以文档完成替代。

## 17. 验证场景

| ID | 场景 | 预期 |
|---|---|---|
| `S23-IR-001` | 单个用户提交 high-risk 输入 | 只进入 SAFE-001；不创建 incident、工单或人工危机队列 |
| `S23-IR-002` | high-risk 输入可到达 ordinary provider | 至少 SEV0；立即关闭受影响自由文本/普通路径 |
| `S23-IR-003` | Safety raw input 出现在普通日志 | SEV0；停止日志流、隔离访问、按泄露可能性研判 |
| `S23-IR-004` | Safety classifier 超时但 must-trigger 命中 | 仍显示固定响应；不因 classifier 故障回退普通流程 |
| `S23-IR-005` | classifier 不确定且 must-trigger 未命中 | 自由文本 fail closed；结构化无文本路径可按上游继续 |
| `S23-IR-006` | 单个资源错误但无资源固定兜底有效 | 下线错误资源，至少 SEV1；普通运势不能替代 |
| `S23-IR-007` | 固定响应和资源整体不可信 | SEV0；受影响入口阻断维护，不让客服临时写危机回复 |
| `S23-IR-008` | Daily primary 超时、backup 成功 | 正常降级，不自动声明 incident；按 S-33 阈值观察 |
| `S23-IR-009` | primary、backup、template 同时失败并影响多用户 | SEV1；显示稳定维护/失败状态，不拼接 partial candidate |
| `S23-IR-010` | provider observed model 与 manifest 不符 | 立即 disable route，至少 SEV1，复核已披露范围 |
| `S23-IR-011` | provider training 意外开启 | 禁用数据流；按隐私安全事件研判，不以合同口头说明恢复 |
| `S23-IR-012` | 生产 key 出现在仓库或日志 | SEV0；立即吊销轮换、调查使用范围，不把 key 复制进 timeline |
| `S23-IR-013` | 普通后台可跨用户全文搜索 | SEV0；冻结后台和会话，按未授权访问可能性处置 |
| `S23-IR-014` | break-glass 无 ticket 或范围过宽 | 拒绝并记录 RestrictedAuditEvent；不影响事件继续控制 |
| `S23-IR-015` | break-glass 达到 60 分钟 | 自动撤销；继续访问需新申请和独立审批 |
| `S23-IR-016` | DAY 删除后旧缓存可读 | SEV0；scope 立即 fail closed、清缓存并复核所有派生 |
| `S23-IR-017` | 从 20 天备份恢复发现已删数据 | 保持隔离，不对外服务；重放 ledger/guard 后重新检测 |
| `S23-IR-018` | 36 天备份仍 AVAILABLE | 至少 SEV1；阻止恢复/发布，清理并调查 TTL 失效 |
| `S23-IR-019` | provider 删除请求失败 | guard 保持；原 DataTask 重试，不创建第二任务或恢复使用 |
| `S23-IR-020` | 支持工具不可用 | 不转个人邮箱/IM；FAQ、状态说明和 DataTask 权威路径保持 |
| `S23-IR-021` | 多个 case 报同一错误 | 只聚合 case refs/错误码，不复制正文；达到阈值后声明 |
| `S23-IR-022` | 初始原因和影响人数未知 | 先声明/控制；时间线明确 unknown，不等待完整根因 |
| `S23-IR-023` | 事件内部 SEV 从 0 降到 1 | 需要 IC 与独立 Safety/Privacy/Security owner 双人确认 |
| `S23-IR-024` | 内部 SEV2 但可能达到法定“较大” | 独立法律分级与报告；内部级别不能阻止报送 |
| `S23-IR-025` | 法定报告时限内原因未知 | 先报单位/系统、时间、类型、级别与已知影响，随后补报 |
| `S23-IR-026` | 个人信息可能泄露但措施已阻止危害 | 记录补救与不通知个人的法律判断；主管部门仍可要求通知 |
| `S23-IR-027` | 用户需要事件通知 | 只通知必要类别、危害、补救、个人措施和联系方式，不发内部证据 |
| `S23-IR-028` | 公告错误 | 追加带时间 correction；不静默改写 |
| `S23-IR-029` | 工程师想开 raw body 日志复现 | 拒绝；使用合成 fixture、版本和稳定错误码 |
| `S23-IR-030` | 恢复修复通过单元测试但未过 Safety/删除回归 | 不恢复；完整恢复 Gate 不可补偿 |
| `S23-IR-031` | provider 声称已修复 | route 仍禁用，直到本方 profile、conformance 和 canary 验证 |
| `S23-IR-032` | SEV0 恢复后 6 小时无异常 | 仍在 MONITORING；至少完成 24 小时/关键窗口 |
| `S23-IR-033` | 观察期复发 | 回到 CONTAINING，关联同一 incident，不重置历史 |
| `S23-IR-034` | IncidentRecord 准备保存用户清单或文本 | Schema/权限拒绝；只保留粗粒度范围与受限 opaque ref |
| `S23-IR-035` | 普通 incident 记录关闭满 12 个月 | 到期删除；依法保留只走独立 LegalHold |
| `S23-IR-036` | 复盘行动没有 owner/期限/验收 | incident 不能 CLOSED |
| `S23-IR-037` | 演练使用真实生产数据 | 演练失败并停止；改用合成数据和测试环境 |
| `S23-IR-038` | 90 天未核验 SEV0/1 值班或开关 | production readiness Gate 失败 |
| `S23-IR-039` | 受托方事件只提供模糊“无影响”结论 | 本方继续验证，必要 route/数据流保持禁用 |
| `S23-IR-040` | 处置结束且属于法定较大以上事件 | 30 日内按原渠道提交总结报告并保留最小回执 |

## 18. Production Gates 与下游交接

| Gate | Owner / 下游任务 | 解除条件 |
|---|---|---|
| IncidentRecord、timeline、revision 与状态机 | S-29、E-006 | 权威位置、Schema、RBAC、期限、删除和测试 Accepted/Implemented |
| 监控、detector、阈值、告警与 SLO | S-25、S-33、E-013 | 无内容指标、值班路由、告警演练和误报处理完成 |
| feature/route/resource/admin/deletion kill switch | S-29、S-32 | 最小权限、审计、自动到期、回滚和演练完成 |
| 发布、维护、回滚与逐步恢复 | S-31、S-32 | CI Gate、不可变版本、回滚目标、canary 和恢复测试完成 |
| 24×7 SEV0/1 值班、替补和状态页 | A-005、A-008 | 真实角色、联系方式、权限、值班轮换和 90 天演练完成 |
| 法律主体、属地、事件分级与监管渠道 | Privacy/Legal owner，Alpha/Beta Gate | 实际主体、是否 CII/行业规则、属地网信/公安路径与通知模板核验 |
| provider/受托方事件通报 | S-29、S-32、采购/隐私 owner | 合同通知时限、证据、联系人、数据处理 profile 与演练完成 |
| 用户通知与受影响人受限清单 | S-29、C-014、A-005 | 最小受限查询、去重、送达、撤回、审计、用户权利和删除完成 |
| 事件演练 | S-31、A-008 | 第 16 节 10 类演练通过并形成改进闭环 |

上述 Gate 未完成前：

- 不得把文档视为真实 on-call；
- 不得在生产持久化个人关联 incident 数据；
- 不得启用任意全文事件调查后台；
- 不得宣传 24×7 危机/故障人工响应；
- Safety、删除、受限访问和真实受托方仍按各自上游 Gate 保持关闭或 fail closed。

## 19. S-23 验收标准

- 用户 Safety 与系统 incident 明确分离，普通客服/事件群永远不接收 high-risk 原文；
- 7 类事件、4 级严重度、强制升级与降级规则可执行；
- DETECTED 到 CLOSED 的状态、角色、前 30 分钟、分类 Runbook、恢复和复盘完整；
- SEV0/1 服务目标被明确标为实现后的目标，不伪装成当前 24×7 能力；
- 中国大陆个人信息、网络数据与网络安全事件报告基线引用官方现行来源，内部 SEV 与法定分级分离；
- IncidentRecord 只使用最小系统事实和 opaque refs，不创建用户全文或幽灵副本；
- 已接受的 6 个月安全日志/受限审计、35 天备份、30 天 provider、72 小时在线删除和 LegalHold 边界不被改变；
- 40 个验证场景 ID 唯一，覆盖 Safety、可用性、provider、凭据、越权、删除、恢复、通知、证据、复盘和演练；
- production Gate 明确交接到 S-29、S-31～S-33、A-005～A-008 等下游；
- PR 不包含数据库、Prisma、API、生产代码、真实联系人、secret、真实用户数据或生产外部操作；
- 本文已于 2026-07-26 经用户确认并随 PR #28 合并，现为 Accepted。

## 20. 审核记录

- 状态：Accepted；
- 接受日期：2026-07-26；
- 内容 PR：[PR #28](https://github.com/WeiHan1996/DailyEnergy/pull/28)；
- 接受范围：事件分级、强制升级、角色、服务目标、法律/通知 Gate、IncidentRecord 最小合同、12 个月普通记录上限、恢复/复盘/演练和 40 个验证场景；
- 下一任务：S-24 埋点事件字典，已开始并进入 In Review。

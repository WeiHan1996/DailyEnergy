# ADR-0003：服务端 AI Gateway 与供应商隔离

- **状态**：Proposed
- **日期**：2026-07-22
- **所属任务**：S-12 — AI Gateway 决策与规范
- **决策范围**：AI 调用边界、供应商与模型隔离、完整表达路径、路由版本、失败降级、成本与隐私
- **决策所有者**：DailyEnergy 项目
- **相关文档**：[数字朋友人格](../ai/personality.md)、[今日内容 Schema](../ai/daily-content-schema.md)、[七天趋势与总结 Schema](../ai/weekly-summary-schema.md)、[确定性生成引擎](../ai/generation-engine.md)、[评分与规则选择](../ai/scoring-rules.md)、[Gateway 规范](../ai/gateway.md)、[ADR-0002](./ADR-0002-deterministic-daily-result.md)

## 1. 背景

DailyEnergy 的规则事实必须稳定，但自然表达不适合由规则表承担。每日内容和七天回望需要大模型把已批准事实表达成简短、自然、克制的中文，同时保持人格、安全、隐私和结构约束。

如果业务服务直接调用某个供应商 SDK，会产生以下问题：

- provider、model、Prompt、重试和业务事实混在一起；
- 单一供应商故障会阻断每天一分钟的核心旅程；
- 切换模型时容易改变输入边界、Schema 或降级语义；
- 不同模块可能各自重试、修补 JSON、拼接段落和重复计费；
- 密钥、原始响应、Token、成本和错误可能泄漏给客户端或普通日志；
- 模型恢复后可能覆盖已经展示的结果，破坏同日稳定；
- 动态“智能路由”或并发竞速会让成本、隐私披露和最终路径不可解释。

Accepted ADR-0002 与生成引擎已经决定：规则引擎独占 RuleFacts，AI 只完成受控表达；主模型、备用模型和模板使用同一份事实与表达计划；第一份完整合格结果原子发布；已发布历史不重算。现在需要固定所有模型调用的唯一边界。

## 2. 决策

DailyEnergy 采用一个仅服务端可访问、供应商中立的 AI Gateway。所有普通 AI 表达必须经过 Gateway；小程序、管理后台、规则引擎、定时任务和业务模块都不得直接调用模型供应商。

Gateway 使用不可变、版本化的 route manifest，把业务 workload 映射为：

1. `PRIMARY_AI`：首选 provider adapter 与精确 model ID；
2. `BACKUP_AI`：独立故障域的备用 provider adapter 与精确 model ID；
3. `CONTROLLED_TEMPLATE`：本地、版本化、无需模型的完整表达 renderer。

三条路径必须读取逐字段相同的 RuleFacts / ExpressionPlan。调用顺序固定为 primary → backup → template；禁止并发竞速、hedged request、跨路径拼段和已发布后替换。

Gateway 只接受受控表达计划和最小批准事实，只返回一份完整候选或规范化失败。它不能选择日期、重算规则、修改行动、读取数据库自由文本、发布结果或解除 Safety / 删除守卫。

## 3. 决策细则

### 3.1 唯一调用边界

- 业务代码只依赖内部 `ExpressionGateway` 契约，不依赖供应商 SDK 类型。
- 每个供应商只能通过 adapter 接入。adapter 只负责认证、请求映射、超时取消、结构化输出能力和 usage 归一化。
- 路由、重试、熔断、预算、验证和降级属于 Gateway 编排器，不放入 adapter。
- provider key、account、endpoint 和原始错误只存在于受限服务端，不进入客户端、Prompt 或业务对象。
- 普通 AI 路径禁用网页、文件、代码执行、工具调用和模型发起的外部请求。

### 3.2 不可变 route manifest

每个可发布路由版本必须明确冻结：workload、Gateway policy、primary/backup adapter、provider、account/endpoint 故障域、精确 model ID、provider-native 参数集、能力声明、超时、输入输出上限、价格目录版本、Prompt/Schema 兼容范围和 template renderer/version。

禁止 `latest`、隐式默认模型、运行时模糊匹配或在同一路由版本下原地换模型。若供应商只返回可漂移 alias，必须记录实际响应 model revision，并把 alias 漂移视为新的 route revision 风险，不能声称精确可重放。

具体供应商和模型不写死在业务代码或本 ADR 中。它们必须先通过 S-16 的结构、事实绑定、人格、安全、延迟与成本评测，再进入受审 route manifest。模型迭代只影响未发布表达，不改变 RuleFacts、result identity 或历史。

### 3.3 主备与模板职责

- primary 和 backup 必须有独立 adapter 配置；生产默认应使用不同供应商或至少不同账户、endpoint 与故障域。
- 同一故障域的第二个 model 只能算降级 route，不能宣称供应商级容灾。
- template 是最终、必需的产品能力，不是临时错误页。它必须产生同构、完整、可校验的 ExpressionPayload。
- route 发布前必须验证 template compatibility；请求时 template preflight 失败则不浪费模型成本，并返回配置级硬失败。
- F1 模型切换和 F2 模板降级不向用户暴露技术变化；F3 只表示允许上下文减少，不表示模型失败。

### 3.4 调用与重试

- 每个 workload 一次 Gateway invocation 最多调用 primary 一次、backup 一次。
- provider timeout、网络失败、429/5xx、协议错误、结构错误、事实越界或普通表达 Safety 拒绝都丢弃整份候选并进入下一完整路径。
- v1 不在同一角色内盲重试，不用第二次模型调用“修复”第一次输出。
- 禁止同时调用主备后选择最快者；这会增加不必要的数据披露和成本，并让路径受网络竞速影响。
- provider 请求使用稳定 attempt key；结果未知时先查询已有 intent/candidate 状态，不重复同一角色调用。
- deadline、取消、Safety、Deleting、DAY 删除和已有 AVAILABLE 结果会停止尚未开始的路径，并取消可取消的在途请求。

### 3.5 结构化输出与完整校验

- 优先使用供应商原生 JSON Schema / structured output 能力，但服务端严格 Schema 仍是唯一发布依据。
- 模型只返回单个 JSON 对象。禁止 Markdown fence、自由文本前后缀、正则提取、宽松解析、未知字段忽略和启发式修复。
- 每份候选依次通过：结构、字符、ID/事实绑定、人格、隐私依赖、Safety、预算和客户端投影预检。
- 任一步失败都丢弃整份候选；禁止保留“安全段落”、替换单个字段或与模板拼接。
- Daily 与 Weekly 使用不同 workload 和输出 Schema；Weekly 只能引用计划批准的 fact IDs，不能计算新数字或原因。

### 3.6 稳定性与发布

- Gateway 不承诺模型文本按字节确定；稳定承诺仍是 RuleFacts、计划、身份和已发布快照不变。
- 同一 invocation 的所有路径使用同一份冻结计划；路由状态只决定表达来源，不能改变事实。
- Gateway 产出 candidate，不直接写 PublishedDailyResult 或 PublishedWeeklySummary。
- 发布服务在 live guards、唯一性和完整校验通过后原子发布第一份合格 candidate。
- 已发布内容不因 provider 恢复、模型升级、成本状态变化或后续候选更好而替换。

### 3.7 超时、熔断与成本

- 每个 workload 使用固定总 deadline，并为 template 与本地验证保留预算。
- 排队、连接、响应读取和验证都计入总 deadline；超时必须真正取消或隔离迟到响应。
- 熔断按 provider + model + endpoint + workload 隔离；认证/配置错误立即阻断该 route，基础设施故障和输出质量故障分别统计。
- 熔断或预算 hard stop 时跳过模型，直接使用已经验证的 template；禁止为了“尽量 AI”绕过预算或熔断。
- 单 invocation 最多两次 provider call；输入、输出、并发、单位成本和全局成本都有硬上限。
- 价格变化通过版本化 price catalog 和 route revision 管理，不把易变价格写入业务结果。

### 3.8 隐私与安全

- v1 模型输入只包含 ControlledExpressionPlan 或 WeeklyExpressionPlan 的安全投影、批准事实值和 S-13 Prompt；不含 stable subject、root seed、raw score、choice trace、源 ID、晚间 note 或无关历史。
- Daily v1 的 `resolved_context_slots` 为空；Gateway 不自行解析 `permitted_context`。S-14 接受前不能把事项或记忆原文加入模型。
- 默认不持久保存无效原始模型输出；只记录规范化失败类型、不可逆 fingerprint、usage、延迟和 route metadata。
- 有效表达只随最终发布对象保存，不在 Gateway 再复制一份长期原文。
- 日志、指标和告警禁止包含 Prompt 正文、用户称呼、模型输出、事实值或供应商密钥。
- 输入 Safety overlay 命中时不进入普通 Gateway；模型产生的普通不安全表达只触发候选拒绝，不能替代 S-15 固定安全流程。

## 4. 采用理由

本决策优先满足：

- 核心旅程在模型或供应商故障时仍可完成；
- AI 不能改写确定性事实；
- 供应商切换不渗透到业务服务；
- 所有失败只影响一份完整候选，不产生混合内容；
- 延迟、成本、隐私披露和路由选择可解释；
- 模型快速变化时只更新受审配置和评测，不反复改业务架构；
- 每次调用、最终来源和降级原因都可追踪，但不向用户暴露技术细节。

## 5. 备选方案

### 方案 A：业务模块直接调用单一供应商

优点是初期代码少。缺点是供应商类型、密钥、错误和重试渗入业务，单点故障明显，无法统一验证与成本。拒绝。

### 方案 B：只用一个供应商的两个模型

可以覆盖单模型质量问题，但不能覆盖账户、区域、配额或供应商故障。可以作为临时开发配置，不能作为生产容灾结论。拒绝作为目标架构。

### 方案 C：主备并发竞速，最快者发布

可降低尾延迟，但每次都向两个供应商披露相同输入、双倍计费，并让最终模式受网络竞速影响。与最小披露、成本克制和路径可解释性冲突。拒绝。

### 方案 D：模型输出失败后自动修补 JSON 或拼接模板

表面成功率高，但会隐藏 Schema/Prompt 缺陷，容易把未批准事实带入安全段落，也无法证明整体一致。拒绝。

### 方案 E：完全不用模型，只用模板

可靠、便宜，但难以验证“自然、像朋友”的核心价值。模板保留为确定性底线，不作为唯一表达路径。

### 方案 F：自研或自托管模型

当前规模下会增加训练、推理、安全和运维负担，且不直接验证 MVP 留存。Phase 0B 不采用；未来需要独立 ADR 和成本/质量证据。

## 6. 影响

### 6.1 正向影响

- 业务、规则、Prompt、供应商和发布职责清晰；
- 主模型故障不会阻断每日核心旅程；
- 可以在不重写业务代码的情况下评测和切换模型；
- Schema、事实绑定、Safety、成本和可观测性集中治理；
- 供应商数据披露与实际调用次数更少、更可审计；
- 模板路径从第一天就是正式能力。

### 6.2 代价与限制

- 需要维护 adapter conformance、route registry、熔断和 usage 归一化；
- sequential failover 的最坏延迟高于并发竞速；
- 不做宽松修补会暴露更多模型输出失败，需要 S-13/S-16 正面解决；
- 不在 ADR 中固定某个“最佳模型”，上线前必须完成模型评测与路由发布；
- 不持久保存无效原文会降低逐字调试便利，需要通过测试集和受控复现弥补。

## 7. 实施与迁移要求

1. S-13 为 Daily / Weekly 定义版本化 Prompt 与严格输出说明；
2. S-15 提供可调用的普通表达 Safety policy 和固定高风险旁路；
3. S-16 建立 provider/model bake-off、回归集和 adapter conformance；
4. S-17～S-20 固化 invocation、attempt、candidate、provenance、API 状态和原子发布；
5. S-25/S-33 定义成功率、模板率、延迟、成本、熔断与告警口径；
6. AI-001 实现 Gateway 内核，AI-002 通过受审 route manifest 上线具体主备；
7. 任何业务侧直接 provider SDK 调用都应由静态检查、依赖边界或代码评审阻止。

## 8. 验收标准

- 一个业务契约可在不暴露 provider 类型的情况下调用 Daily 与 Weekly 表达；
- primary、backup、template 使用相同冻结计划和严格输出契约；
- primary 超时、429、结构失败、事实越界和 Safety 拒绝均不会局部发布；
- backup 与 template 能在同一 invocation 内完成完整降级；
- 熔断、预算 hard stop 和 provider 配置错误不会阻断 template；
- 同一用户同日只发布一份结果，模型恢复不替换历史；
- route manifest 不允许 latest、隐式默认或同版本换模型；
- 客户端、普通日志和分析不出现 provider secret、Prompt、原始输出或内部事实；
- 高风险输入不进入普通模型链路；
- 所有精确行为与测试矩阵在 gateway.md 中可实现、可验证。

## 9. 决策状态

本 ADR 当前为 Proposed。只有用户确认后才能改为 Accepted。在此之前不得据此开始生产 AI Gateway 实现。

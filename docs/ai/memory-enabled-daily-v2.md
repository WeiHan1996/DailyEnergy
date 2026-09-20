# Daily 记忆表达 v2 合同

- **文档状态**：Accepted
- **接受日期**：2026-09-20
- **所属任务**：AI-009 — 用途受限的结构化记忆选择
- **最后更新**：2026-09-20
- **决策所有者**：DailyEnergy 项目所有者
- **上游规范**：[ADR-0004](../decisions/ADR-0004-structured-memory.md)、[结构化记忆](./memory.md)、[今日内容 Schema](./daily-content-schema.md)、[Prompt 规范](./prompt-spec.md)、[内容安全](./safety.md)、[AI 评价](./evaluation.md)、[今日页面规格](../design/screen-specs.md)
- **状态说明**：项目所有者已接受版本、段落位置、无标题方案、Daily-only 范围与旧事项 Safety 证明迁移；允许继续开发与验证，不授权真实 provider、真实用户、RC 或 Production

## 1. 已接受的决定

建议第一个带记忆的表达版本只允许 **Daily 的用户主动重要事项**，一次最多一条；提及只能出现在现有 `state_response` 段。模型不接收事项标题，仅接收“用户主动保存并允许每日引用一件事”及经过规则计算的有限时间关系。没有事项或任一守卫失败时，仍生成完整的无记忆 Daily 内容。

`state_response` 是现有今日页“朋友式解释”的一部分，不新增页面控件。首版接受无标题表达；若未来选择展示标题或新增段落，必须先重订 Safety 投影、输出 Schema、页面证据和删除回退合同。

## 2. 版本与适用面

| 契约             | Accepted 版本                            | 原 v1 行为                                  |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| Workload         | `DAILY_EXPRESSION_V2`                    | `DAILY_EXPRESSION_V1` 不变，记忆为空        |
| Prepared input   | `prepared-daily-prompt-input-v2`         | v1 禁止事项、近期状态与关系事实             |
| Prompt package   | `daily-expression-zh-cn-v2`，先 `STAGED` | `daily-expression-zh-cn-v1` 不变            |
| Strict output    | `daily-expression-payload-v2`            | v1 `ExpressionPayloadSchema 1.0.0` 不加字段 |
| Context snapshot | `memory-context-snapshot-v1`             | v1 不创建带记忆的 invocation                |

实现冻结值：Prompt package fingerprint=`31adaeebbf49b9d9808b7e9edaae870893a57d98fcb00ac153212c5bd46e5a43`，output Schema fingerprint=`6effe83faf6fa75423055b590f054f65070101ace0146544503872b32885bd35`。Prompt package 保持 `STAGED`，evaluation 明确禁止外部 provider 调用。

Weekly v1 保持无记忆，不能借用 Daily grant；近期状态无独立授权 UI、关系事实无 Daily 用途许可，均不进入本版本。`IMPORTANT_MATTER_REMINDER` 与分享不继承 Daily 授权。本提案不改变 RuleFacts、评分、行动、任务、仪式、娱乐元素或稳定结果身份。

## 3. 输入与选择

1. 在当前 owner、ProductDate、必要同意、账户 ACTIVE、Safety CLEAR、删除守卫 CLEAR、master 与 Daily 用途开关都可读且允许时，从权威 PostgreSQL 来源取候选；不可读时使用无记忆路径。
2. 只选 `ACTIVE` Matter，精确 `DAILY_EXPRESSION` grant 必须 `ACTIVE` 且 policy/revision 匹配。来源还必须有与当前 source revision 和当前 Safety policy 绑定的 `CLEAR_FOR_DECLARED_USE` 证明；证书未知、旧版本或专业边界均不合格。现有 AI-008 事项没有这份证明，不能仅凭旧 grant 升为表达候选；需要用户主动重新保存或确认该事项，并由当前 Safety Input Gate 通过后原子写入不含标题的证明。Safety Gate 不可用时不创建证明、不发送模型。目标日前三日至当天，或无日期事项创建起七个产品日；目标日后与第八日不可用。
3. 先按今天到期、未来日期距离、来源日期距离、修订时间、稳定 source ref 排序；同一事项每天最多提及一次，非目标日的滚动七日最多两次。频率满额时不以其它措辞绕过。
4. provider-facing fact 只有 invocation 内的 `fact_id`、`IMPORTANT_MATTER`、`USER_SAVED_MATTER` 这一允许断言和可选的 `TARGET_TODAY / FUTURE_WINDOW / UNSPECIFIED` 时间 token；不含标题、owner/source/grant ref、修订、原始日期、内部原因或其它历史。输入事实 JSON 最多 1 KiB，仍计入 Daily prepared input 与总 Prompt 预算。标题既不解密也不发送。
5. 服务端快照另外绑定 owner、source/grant/master 修订、来源 Safety 证明版本、Safety/deletion epoch、用途、有效期和 policy/resolver 版本；仅在受控 invocation 生命周期内使用，不写普通日志、队列正文、客户端或分析。来源证明不得反向恢复标题，也不能作为跨用途授权。

## 4. 严格输出与回退

- v2 输出保留 v1 的完整表达字段，并新增封闭的 `memory_bindings` 与 `privacy_fallbacks`。有记忆时仅 `expression.state_response` 可带预分配的单个 exact `fact_id`；无记忆时 `memory_bindings` 必须为空，文案不得暗示“记得”用户事项。
- 同一完整候选必须携带 `expression.state_response` 的经结构、事实、人设、Safety 与长度校验的无源回退。回退不能称“你删掉了”或描述历史记忆；若无法独立回退，拒绝整个记忆候选并使用完整无记忆计划。
- 来源依赖只保存在服务端，含 source/grant revision、purpose、`expression.state_response` 与对应 fallback path。客户端只接收通过当前可见性解析的文字及可理解来源说明，不收到内部 ref 或绑定图。
- primary、backup 与模板复用同一个冻结快照。输出中 fact ref 缺失、移位、额外日期/数字/因果结论、无回退、跨尝试拼接或借另一用途 grant，整份拒绝；不修补 JSON、不重问模型。
- 发布事务与每日结果唯一性、source/grant/master/来源 Safety 证明/Safety/deletion epoch 复查、七日 mention receipt 和依赖写入保持同一提交。事务输家不留下 receipt；在途撤销/删除使旧候选失败并使用已预检无记忆路径。已发布内容在源失效后切换同候选回退，回退不可用时整份不可见。

## 5. 激活门槛

- 执行严格 Zod/JSON Schema、Prompt 资产和 client bundle Gate、真实 PG 并发与角色权限、删除/恢复、provider late/unknown、Redis loss 和无记忆回归；相关 Source ID 才能记为 `COVERED`。
- 通过 S-15 当前 Safety policy 的输入与输出审查、S-16 deterministic/MODEL/LOAD/HUMAN 适用评价、隐私与“被监视感”人工审核；项目所有者确认文案位置和无标题方案。
- 模型/供应商、真实用户、RC 与 Production 各自仍需独立授权。本文 Accepted 或 PR 通过自动 CI 均不等于模型资格通过或生产激活。

## 6. 接受记录

项目所有者于 2026-09-20 审核通过：

1. 在既有 `state_response` 受控提及，首版不发送事项标题；旧事项必须经用户主动重新保存并通过当前 Safety Gate 后才有资格；
2. 本版本只启用 Daily Matter，Weekly、近期状态与关系事实继续保持空槽；
3. 允许冻结 exact 输入、输出 Schema 与 Prompt 正文并完成开发 Gate；真实 provider、真实用户、RC 与 Production 仍需独立授权。

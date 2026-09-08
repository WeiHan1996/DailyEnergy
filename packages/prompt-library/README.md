# Prompt Library

存放版本化、server-only 的 Prompt 与受控模板资产。C-007 首先实现
`daily-template-v1`：它只消费严格 `ControlledExpressionPlanV1`，不读取数据库、
网络、当前时间、随机数、provider 输出、历史正文或重要事项。

每份 Prompt 必须：

- 有稳定标识和版本号；
- 说明输入、输出与禁止事项；
- 绑定结构化输出 Schema；
- 保留变更记录和回滚能力；
- 不包含真实用户隐私、密钥或生产数据。

当前 public surface 导出：

- AI-003 的 `daily-expression-zh-cn-v1` 与 `weekly-expression-zh-cn-v1` immutable
  Prompt packages；common/Daily/Weekly 规范指令与 Accepted S-13 原文逐字一致，package、
  registry、release catalog 与 deterministic evaluation 均有固定 SHA-256 fingerprint；
- `buildPreparedDailyPromptInputV1` 与 `buildPreparedWeeklyPromptInputV1`：只从严格 plan
  或 aggregate+plan 投影批准语义，Daily v1 省略注入式称呼且不解析 context/memory，Weekly
  不发送 day slots、缺失日期、source/window ref、note、历史 AI 文本或娱乐分数；
- `compilePromptRequestV1`：分离 system、developer 与 canonical user-data JSON，绑定 strict
  output Schema，执行 Daily 16 KiB / Weekly 24 KiB 及子预算，并生成包含
  model/route/gateway/safety/template/prompt/schema/plan/rule/result 的 server-only trace；
- 不可变 `daily-template-v1` registry、renderer version 与 SHA-256 fingerprint；
- `renderControlledDailyTemplateV1`，产出完整、严格的
  `CONTROLLED_TEMPLATE` candidate；
- `validateControlledDailyTemplateCandidateV1`，复查 Schema、事实 ID、字符预算、
  人格、低压力、仪式与 Safety 禁止项。

模板候选保留四份 Accepted 规范的 source attribution；Daily v1 不解析记忆或事项，
因此 `source_dependencies=[]`、`privacy_fallbacks={}`。发布、唯一性、live guard、
缓存和历史冻结由 C-008 实现，本包不把候选写成 AVAILABLE 结果。

两套 AI Prompt package 当前均为 `STAGED`；evaluation registry 固定为
`DETERMINISTIC_ONLY / externalProviderCallsAllowed=false`。S-16 provider bake-off、AI-004
candidate semantic validator 与 AI-006 template 路径完成前，不得升级为 ACTIVE，也不得接入
真实 provider、key 或生产出网。

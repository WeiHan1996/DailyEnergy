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

- 不可变 `daily-template-v1` registry、renderer version 与 SHA-256 fingerprint；
- `renderControlledDailyTemplateV1`，产出完整、严格的
  `CONTROLLED_TEMPLATE` candidate；
- `validateControlledDailyTemplateCandidateV1`，复查 Schema、事实 ID、字符预算、
  人格、低压力、仪式与 Safety 禁止项。

模板候选保留四份 Accepted 规范的 source attribution；Daily v1 不解析记忆或事项，
因此 `source_dependencies=[]`、`privacy_fallbacks={}`。发布、唯一性、live guard、
缓存和历史冻结由 C-008 实现，本包不把候选写成 AVAILABLE 结果。

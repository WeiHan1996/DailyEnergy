# @daily-energy/shared-schemas

DailyEnergy Phase 0B 的自包含运行时契约包。它把已接受的今日内容、晚间反馈与七天总结文档转换为 TypeScript + Zod Schema、由 Schema 推断的类型、稳定 JSON Schema 导出和契约测试。

本包不连接数据库、网络、缓存、队列或模型，不生成分数、趋势或文案，也不包含前端组件、后端服务或真实用户数据。

## 使用

在本目录独立安装和验证：

```bash
npm ci
npm run validate
```

运行时校验与类型共用同一个来源：

```ts
import {
  EveningReflectionSubmissionSchema,
  type EveningReflectionSubmission,
} from "@daily-energy/shared-schemas";

const submission: EveningReflectionSubmission =
  EveningReflectionSubmissionSchema.parse(input);
```

JSON Schema 使用稳定 `$id`：

```ts
import {
  JSON_SCHEMA_IDS,
  jsonSchemas,
} from "@daily-energy/shared-schemas/json-schema";

jsonSchemas.eveningReflectionSubmission.$id ===
  JSON_SCHEMA_IDS.eveningReflectionSubmission;
```

## 文档映射

| 已接受规范                           | 主要运行时 Schema                                                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ai/daily-content-schema.md`    | `GenerationInputSnapshotSchema`、`RuleFactsSchema`、`ExpressionPayloadSchema`、`PublishedDailyResultSchema`、`ClientDailyContentViewSchema`、`DailyInteractionStateSchema`                                                   |
| `docs/ai/evening-feedback-schema.md` | `EveningFeedbackDraftSchema`、`EveningReflectionSubmissionSchema`、`EveningFeedbackRecordSchema`、`EveningFeedbackRevisionSchema`、`DailyHelpfulnessRecordSchema`、`DailyTaskStateSchema`、`ClientEveningFeedbackViewSchema` |
| `docs/ai/weekly-summary-schema.md`   | `WeeklySourceSnapshotSchema`、`WeeklyAggregateFactsSchema`、`WeeklyExpressionPlanSchema`、`WeeklyExpressionPayloadSchema`、`PublishedWeeklySummarySchema`、`ClientWeeklySummaryViewSchema`                                   |

所有对象默认严格拒绝未知字段。已发布对象无值时省略可选字段，不使用 `null`、空字符串或占位值。客户端类型是显式白名单投影，不从内部对象做黑名单裁剪。

## 运行时强制的不变量

- 产品日期必须是真实存在的 `YYYY-MM-DD`，时间戳必须包含时区。
- 文本按 Unicode grapheme 计数；生成文本拒绝换行、Markdown、HTML、URL、文本 emoji 和重复感叹号/问号。
- 今日内容固定五维、canonical/display order、focus、action/task/ritual 引用与核心/全文字符预算保持一致。
- 晚间 note 使用 `SET` / `CLEAR` 判别联合；修订非负，已提交记录修订为正数；availability、写入窗口与主操作互相一致。
- 七天窗口恰好七个连续日期；coverage、missing dates、指标计数、方向门槛、mode、帮助类型和任务计数等式保持一致。
- AI 或模板表达只能引用计划批准的 fact IDs；Schema 或 Safety 失败不能局部发布。

## JSON Schema 限制

Zod 运行时 Schema 是完整校验权威。JSON Schema 用于字段发现、基础格式校验、文档和跨语言预校验，但不能单独等价表达以下规则：

- Unicode grapheme 字符数；
- 五维 canonical order、跨对象 ID 引用和核心/全文总字符预算；
- 七个日期的真实日历连续性；
- coverage、distribution、任务与帮助度计数等式；
- direction、mode 和 top helpful kind 的样本门槛；
- expression `fact_refs` 是否属于当前批准目录。

因此任何信任边界都必须再次通过对应 Zod Schema 的 `parse` 或 `safeParse`。

## 包边界

这是 Phase 0B 契约草案包，版本从 `0.x` 开始。根 workspace、统一包管理、CI 和发布策略留给 S-28 / Phase 1；当前包只保证在自身目录可安装、格式化、类型检查、测试和构建。

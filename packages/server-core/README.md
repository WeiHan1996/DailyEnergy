# Server Core

无框架、无数据库 SDK 的服务端领域与 application contract 包。

C-005 建立首批 public subpath：

- `@daily-energy/server-core/product-time`：`product-date-v1`、七天民用日期窗口、
  VIEW_CONTINUATION 与 generation-completion 纯策略；
- `@daily-energy/server-core/product-time/spi`：continuation grant 持久化 port；
- `@daily-energy/server-core/generation`：StableSubjectId、seed-v1、choice-v1、
  canonical candidate order、GenerationManifest 与冻结版本选择；
- `@daily-energy/server-core/generation/spi`：不可变 manifest registry port。

C-006 在 `generation` public subpath 增加 `daily-rules-v1` / `daily-score-v1`：

- strict GenerationInputSnapshot、manifest 与 root-seed binding；
- 五维整数评分、focus/care/support、行动/任务/仪式目录和具名选择；
- 严格 RuleFacts 与 ControlledExpressionPlanV1；
- server-only 有限 choice trace，不含 root seed、digest 或用户身份。

C-013 新增 `@daily-energy/server-core/weekly-reflection`：

- `weekly-aggregate-v1` 的七日 coverage、direction、mode、帮助度与任务聚合；
- 只引用 approved fact IDs 的 `weekly-expression-v1` 计划；
- 不调用网络的完整本地模板，以及不含源 ref/fingerprint/note/score 的 Client View 投影。

本包不得导入 Nest、Prisma、Redis、BullMQ、provider SDK、环境变量或客户端代码。
PostgreSQL 和运行 profile 实现位于 `@daily-energy/server-adapters` 的显式 capability
subpath。Weekly 持久化、TX-07 与 HTTP 适配仍位于 adapters/API，不进入本包。

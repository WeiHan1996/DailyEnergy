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

C-015 新增 `@daily-energy/server-core/analytics`：

- T0 transient observation 到 T4 的 `k=10`、最多两维、父桶/OTHER/全抑制纯函数；
- 23 个 S-25 指标、四个 count-free Gate、Wilson 95% 区间和十个固定 fixture；
- ActivationCycle/EncounterLink 的精确 D1/D3/D7 只在函数调用内使用 owner/cycle key，
  返回值不含持久 subject。

AI-001 新增 `@daily-energy/server-core/ai-gateway` 与 `/spi`：

- `expression-gateway-v1` 的 Daily/Weekly workload、不可变 route manifest、兼容性、
  deadline、input/response limit、cost ceiling 与 request fingerprint；
- 调用方显式选择单个 primary 或 backup role；provider UNKNOWN 不重复同一
  invocation/role/ordinal，不可用或 admission 关闭时返回 `FALLBACK_REQUIRED`，不提前实现
  AI-002/AI-006 的路由与模板策略；
- prepared input 拒绝身份、seed、raw score、source ref、raw note 和 Safety 类别键；
- attempt store、provider registry/adapter、candidate validator 与 template renderer SPI，
  attempt 只接收脱敏元数据，不接收 Prompt、正文或 provider raw response。

AI-002 在同一边界内新增有限路由与熔断策略：

- 严格按 `PRIMARY_AI` → `BACKUP_AI` 顺序，每个 role 最多一次；主备均失败时只返回
  `CONTROLLED_TEMPLATE_REQUIRED`，不提前执行 AI-006 renderer；
- total deadline 保留本地 template/validation 预算，Safety、删除、取消、已有结果和预算
  hard stop 均优先于 provider；candidate 返回后再次读取 live PublishGuard；
- infrastructure、quality、auth/config 使用隔离的纯 breaker 状态机，支持 20 样本窗口、
  HALF_OPEN 两探测、递增 cooldown 与 route fingerprint reset；
- breaker store、live guard 或 Gateway 执行不可读时 fail closed，attempt telemetry 只携带
  封闭 role/model bucket、归一化 usage/cost 与完整性，不携带正文或用户引用。

AI-004 收紧 candidate validator SPI 与 PASS receipt：

- validation outcome 固定为 `PASS / INVALID / REJECTED / INDETERMINATE`；后三者只保留稳定
  reason 并进入下一完整路径，不保存或拼接 raw candidate；
- PASS receipt 的 SHA-256 同时绑定 payload、workload、route role、plan、Prompt、output
  Schema、Safety policy 与 validator version；任一字段或 fingerprint 漂移都拒绝 candidate；
- route 继续在 dispatch 前和 candidate 返回后读取 live guard，existing、Safety、删除和 stale
  revision 均阻断迟到结果；双 provider 失败只返回 AI-006 可消费的 template 决策。

AI-006 将上述决策闭合为完整本地候选：

- `ControlledTemplateGatewayV1` 在 provider dispatch 前校验 frozen plan fingerprint，用版本化
  renderer 生成完整 payload，并通过与 AI 相同的 candidate validator 和 receipt；
- route 仍严格按 `PRIMARY_AI` → `BACKUP_AI`，但主备失败、breaker/预算/成本不可用时直接
  返回已 preflight 的 `CONTROLLED_TEMPLATE` candidate，不再返回占位决策；
- Safety/删除、live guard 不可读、template 版本/Schema/Safety/执行预算失败继续 fail closed；
- PRIMARY/BACKUP/TEMPLATE candidate 通过同一 Daily publish assembler，provider/model/Prompt
  provenance 只留在内部结果，客户端投影不包含技术来源。

AI-007 新增 `@daily-energy/server-core/relationship`：

- `relationship-policy-v1` 只从有效、按产品日期去重的 LightFact 源投影 count、stage、
  第 1/3/4/7 日资格和 SHA-256 source fingerprint；
- 日历中断不清零，同日精确重放不增加，冲突源 fail closed，删除源后可确定性降级；
- 第 1/3/7 日是当前可发布连续性节点；第 4 日资格保留给 AI-008，不由 AI-007 提前实现事项。

本包不得导入 Nest、Prisma、Redis、BullMQ、provider SDK、环境变量或客户端代码。
PostgreSQL 和运行 profile 实现位于 `@daily-energy/server-adapters` 的显式 capability
subpath。Weekly 持久化、TX-07 与 HTTP 适配仍位于 adapters/API，不进入本包。

# DailyEnergy 可观测性与成本监控规范

- **文档状态**：Accepted
- **所属任务**：S-33 — 可观测性和成本监控
- **最后更新**：2026-07-26
- **适用范围**：Phase 1～3 的 API、Admin、Worker、PostgreSQL、Redis/BullMQ、AI Gateway、数据权利、发布、备份恢复、日志、指标、Trace、SLO、告警与成本治理
- **上游权威**：[指标唯一口径](../analytics/metrics.md)、[埋点事件字典](../analytics/event-tracking.md)、[AI Gateway](../ai/gateway.md)、[隐私数据地图](../operations/privacy-data-map.md)、[故障和安全事件响应](../operations/incident-response.md)、[系统架构](./architecture.md)、[测试策略](./testing.md)、[部署、配置与回滚](./deployment.md)
- **下游任务**：S-34～S-35、E-003、E-006～E-014、C-014～C-015、AI-002、AI-006、AI-012、AI-016、A-005～A-010

## 1. 目的

本文把已接受的产品指标、运行时架构、隐私期限、事件响应和部署恢复合同，转换为一套可实施、可验证且成本可控的生产观测合同。核心验收句是：

> DailyEnergy 必须能在不记录用户正文、不制造用户级行为轨迹、不把高基数引用塞进标签、也不依赖业务数据库人工排查的前提下，及时回答“用户是否能完成核心旅程、哪一层正在失效、错误预算是否正在快速消耗、AI 与基础设施花费是否仍在批准范围内、删除和恢复是否仍安全”。

本文回答：

1. 应用怎样产生结构化日志、OpenTelemetry Trace 与 Prometheus/OpenMetrics 指标；
2. 哪些资源属性、日志字段、span 属性和 metric labels 被允许；
3. ordinary telemetry、网络安全日志、受限审计和产品分析怎样隔离；
4. 核心 API、生成、outbox/queue、数据库、删除、备份和 AI 的 SLI/SLO 是什么；
5. 低流量 Alpha/Beta 怎样结合真实请求、无业务写入探针和绝对故障数告警；
6. error budget、multi-window burn rate、发布冻结和事件分级怎样协作；
7. AI token/cost、基础设施、监控自身和第三方费用怎样归集、预测与 hard stop；
8. Dashboard、告警、Runbook、on-call 与 Release Manifest 需要哪些证据；
9. E-013/E-014 必须实现和演练哪些能力。

## 2. 不重开的已接受边界

- S-25 是产品指标、D1/D3/D7、AI 8 秒达标率、模板降级和单核心活跃用户日 AI 成本的唯一口径；
- observability 不创建用户级 analytics stream，不保存跨日 subject、device/session 轨迹或持久用户标签；
- PostgreSQL 是业务事实；日志、Trace、指标、Dashboard、告警和成本面板都不是；
- API、Admin、Interactive、Background、Restricted、Migration 与 Evaluation profile 的权限和职责不变；
- Redis/BullMQ 可以整体丢失，必须从 PostgreSQL outbox、due rows 和 DataTask 重建；
- Safety、owner、deletion guard、PublishGuard、CommandReceipt、唯一约束和 revision/CAS 是硬栅栏，不能用统计误差预算抵消；
- provider/model/route/Prompt、attempt、Token 和成本属于 server-only 运行信息，不进入客户端；
- ordinary trace 最长 30 天，网络安全日志六个自然月，T4 匿名产品/运行/成本聚合最长 13 个自然月；
- backup 最长 35 天，目标 RPO ≤15 分钟；恢复只能先进入隔离 RECOVERY 环境；
- 生产为单区域、单活、单 application host Compose MVP，不声称 HA、零停机或 24×7 能力已经存在；
- 真实日志/监控供应商、区域、跨境、值班人、通知通道和绝对基础设施预算在实施前仍是 Production Gate；
- 观测系统故障不能放宽 Safety、删除、预算、breaker、权限、迁移或发布 Gate。

如本文与 Accepted ADR、产品、Safety、隐私、数据库、API、架构、测试或部署合同冲突，以上游权威为准。

## 3. 范围与不做事项

### 3.1 本文负责

- 三类信号的应用合同、采集边界、关联方式和降级；
- vendor-neutral OTLP/OpenMetrics 边界与参考后端；
- resource attributes、日志字段、span attributes、metric labels 的封闭 allowlist；
- cardinality、采样、保留、访问、导出、脱敏和 raw-content detector；
- 用户旅程 SLO、运行目标、硬不变量和 error budget；
- multi-window burn-rate、低流量、绝对数量、synthetic 与 hard trigger 告警；
- API、Worker、outbox、BullMQ、PostgreSQL、Redis、Gateway、DataTask、backup 与发布指标；
- AI 与基础设施成本目录、完整性、预算、预测、异常与 hard stop；
- Dashboard、Runbook、告警 ownership、值班准备和事件交接；
- 48 个 `S33-OBS-*` 固定场景。

### 3.2 本文不负责

- 创建 OpenTelemetry、Prometheus、Loki、Tempo、Grafana、Alertmanager、探针或告警配置；
- 选择或购买真实监控 SaaS、云厂商、短信、电话、IM、状态页或 on-call 产品；
- 创建生产 Dashboard、值班账号、个人联系人、Runbook 工单或 Incident 系统；
- 承诺公开 SLA、赔偿、HA、自动扩缩、多区域或 24×7 人工响应；
- 改写 S-25 产品指标、事件字典、保存期限、Safety、删除或事件分级；
- 开启小程序自动采集、session replay、录屏、热力图、设备指纹或用户级 RUM；
- 把日志、Trace、请求体、provider body 或支持文本当成产品分析源；
- 在业务高基数字段上建立 metric/log index；
- 实现 E-013/E-014 或提前创建 S-34 GitHub Milestones/Issues。

## 4. S-33 决策摘要

| 主题 | v1 唯一结论 |
|---|---|
| 应用标准 | Node 服务使用 OpenTelemetry API/SDK 产生 Trace 与 Metrics；OTLP 作为 Trace 传输合同 |
| 指标暴露 | 每个服务只在 internal network 暴露 Prometheus/OpenMetrics endpoint；不公网开放 |
| 日志 | 继续使用成熟的结构化 JSON logger 输出 stdout；不等待 OpenTelemetry JS Logs API 稳定 |
| 采集 | 每 application host 部署 OpenTelemetry Collector 或等价批准 agent；应用不直接持有第三方 telemetry key |
| 参考后端 | Prometheus + Loki + Tempo + Grafana + Alertmanager 用于 LOCAL/CI/STAGING-like 验证 |
| 生产后端 | 必须兼容 OTLP/OpenMetrics、位于独立故障域并通过 region/TTL/RBAC/跨境/退出 Gate；厂商未选前为 BLOCKED |
| 关联 | `trace_id` 可进入普通日志字段但不作为 index label；metric exemplar 只关联已采样无正文 Trace |
| 标签 | 只允许低基数 environment/service/profile/operation/outcome/version；用户、opaque ref 和自由文本永久禁止 |
| 时间窗口 | SLO 使用滚动 28 天；ProductDate 指标继续使用 S-25 的 `Asia/Shanghai` 04:00 |
| 可用性 | 核心 API 99.5%；生成意图 30 秒内可用 99.0%；单 host 限制明确计入 |
| 延迟 | 核心读 P95 ≤500ms；核心写接受 P95 ≤750ms；生成结果 P95 ≤10s |
| AI | 保留 S-25：AI 8 秒内 ≥95%、模板降级 ≤5%、≤¥0.10/CoreActiveUserDay、cost known ≥99% |
| 告警 | SLO 使用 14.4×/6× multi-window burn rate；低流量必须叠加 synthetic 与绝对故障数 |
| 硬触发 | Safety/删除/owner/secret/raw-content/restore 等单个确认案例直接事件化，无 error budget |
| 成本 | `CostEntryV1` + `BudgetEnvelopeV1`；70% forecast、85% actual/forecast、100% hard limit |
| 保存 | ordinary logs 30 天、raw Trace 7 天、细粒度 metrics 35 天、T4 日聚合 13 个月；security logs 6 个月 |
| 观测故障 | telemetry 丢失单独告警；业务继续遵循 fail-closed/fallback，禁止打印 body 补偿 |

## 5. 信号架构与后端边界

### 5.1 数据流

```text
Node.js application
  ├─ structured JSON logs → stdout
  ├─ OpenTelemetry traces → OTLP
  └─ OpenTelemetry metrics → internal OpenMetrics endpoint

Application-host Collector / approved agent
  ├─ allowlist + redact + batch + memory limit
  ├─ logs → Loki-compatible backend
  ├─ traces → Tempo-compatible backend
  └─ self telemetry → Prometheus-compatible backend

Prometheus-compatible backend
  ├─ service/exporter metrics
  ├─ recording rules / SLI / budget
  └─ alerts → Alertmanager-compatible routing

Grafana-compatible read layer
  ├─ SLO and reliability dashboards
  ├─ queue / database / AI / cost dashboards
  └─ restricted operations dashboards
```

### 5.2 应用与 Collector

- 应用只发送到同主机/private network Collector 或暴露受保护 metrics endpoint；
- 应用镜像不包含第三方 observability API key；
- Collector 执行 attribute allowlist、敏感字段丢弃、tail sampling、batch、memory limit 和 export retry；
- Collector retry queue 是 telemetry buffer，不是业务队列；满时允许丢 telemetry，不能阻塞业务事务或改变结果；
- Collector 不读取业务数据库、Redis value、queue payload、对象内容或 provider body；
- Collector 自身必须暴露 dropped spans/logs/metrics、queue fill、export failure 和 config fingerprint；
- agent/Collector 配置进入 Release Manifest fingerprint 与 secret/capability scan；
- Collector 不获得 API/Worker 的数据库、provider、微信、对象或 Restricted secret。

### 5.3 参考后端与生产替换

LOCAL/CI/STAGING-like 的参考实现使用：

- Prometheus-compatible metrics 和 recording/alert rules；
- Loki-compatible structured log backend；
- Tempo-compatible Trace backend；
- Grafana-compatible dashboard；
- Alertmanager-compatible aggregation、silence、inhibition 和 routing。

生产可以使用经过批准的托管或自建等价后端，但必须：

- 接收同一 OTLP/OpenMetrics/JSON 合同；
- 通过字段、label、采样、TTL、RBAC、区域、subprocessor、跨境和删除验证；
- 支持数据导出与退出，不把 vendor-specific SDK 注入业务模块；
- 与 application host 不在同一单点故障域，否则不得声称能观测 host 全失效；
- 有独立黑盒探针和 telemetry heartbeat；
- 版本、镜像 digest 或 SaaS release/contract 进入受审 inventory。

## 6. Telemetry 平面与数据等级

| 平面 | 内容 | 数据等级 | 普通访问 | 最长期限 |
|---|---|---|---|---|
| `ORDINARY_RUNTIME` | API/Worker/queue/DB/Gateway 的脱敏运行信号 | T1/T4 | Engineering/Operations | logs 30d；Trace 7d；metrics 35d |
| `SECURITY` | 必需 IP、认证、越权、secret/攻击检测 | T2 | Security/Privacy restricted | 6 个自然月 |
| `GOVERNANCE` | DataTask SLA、restore deny、期限和删除检测结果 | T2/T4 | Privacy/Restricted operations | 证据按 PDM；匿名日聚合 13 个月 |
| `SAFETY_CONTROL` | Safety 组件、固定资源和 ordinary bypass detector | T2/T4 | Safety/Restricted operations | 证据按 Safety；匿名日聚合 13 个月 |
| `COST` | 非个人 usage、price、amount、预算和 completeness | T1/T4 | Engineering/Finance/AI owner | 细粒度 35d；T4 13 个月 |
| `PRODUCT_ANALYTICS` | S-24/S-25 T4 匿名指标 | T4 | Product Analytics | 13 个自然月 |

规则：

- 一条 telemetry 只能属于一个平面，不能复制到另一个平面延长期限或扩大访问；
- ordinary Dashboard 不显示 Safety 类别、DataTask scope 数量、IP、受限 actor 或 provider 删除细节；
- Product Analytics 不从日志/Trace反推用户漏斗、留存、阅读或帮助度；
- T2 signal 只用 opaque evidence ref 关联受限证据，不复制内容；
- ordinary telemetry 发现疑似个人内容时立即停止受影响 export、隔离该批次并进入 S-23；
- 正文缺失优先于为了“完整排障”扩大采集。

## 7. 统一资源属性与基数预算

### 7.1 允许的统一资源属性

```text
service.namespace = dailyenergy
service.name
service.version
deployment.environment.name
dailyenergy.runtime_profile
dailyenergy.release_id
dailyenergy.config_schema_version
dailyenergy.contract_bundle_version
cloud.region?                  // 只有已批准粗粒度 region
```

- `service.instance.id` 可存在于 Trace resource/structured metadata，但不得成为 Prometheus 或 Loki index label；
- `release_id` 只保留当前、上一回滚版本和 `OTHER`，历史高基数版本通过受限查询；
- hostname、container ID、pod ID、IP、process ID 不作为普通长期 index label；
- production 与 staging 数据源完全分离，Dashboard 不默认跨环境查询。

### 7.2 允许的低基数维度

| 维度 | 最大活动值 | 示例 |
|---|---:|---|
| `service` | 8 | api/admin/interactive/background/restricted/collector |
| `runtime_profile` | 8 | API/ADMIN/INTERACTIVE/BACKGROUND/RESTRICTED/MIGRATION/EVALUATION |
| `operation_code` | 64 | 封闭的 HTTP operation / job family / DB operation |
| `outcome_code` | 每操作 ≤12 | SUCCESS/EXPECTED_REJECT/RETRYABLE/TERMINAL/UNKNOWN |
| `http_method` | 6 | GET/POST/PATCH/DELETE/OPTIONS/OTHER |
| `status_class` | 6 | 2xx/3xx/4xx/5xx/CANCELLED |
| `queue_family` | 8 | INTERACTIVE/BACKGROUND/RESTRICTED 等 |
| `workload` | 4 | DAILY/WEEKLY/EVALUATION/OTHER |
| `generation_mode` | 4 | PRIMARY_AI/BACKUP_AI/CONTROLLED_TEMPLATE/NO_RESULT |
| `provider_code` | ≤4 | 受限运行视图中的批准 provider |
| `model_revision_bucket` | ≤8 | 当前批准 revision/OTHER |
| `reason_code` | 每子系统 ≤24 | 稳定封闭 reason |

### 7.3 永久禁止的 label / index

- AccountRef、StableSubjectId、openid、unionid、session/device/IP；
- request ID、trace ID、span ID、command/event/job/attempt/result/task/object refs；
- preferred name、mood、energy、sleep、matter、note、支持文本、Safety 原文/类别；
- Prompt、prepared input、provider request/response、完整模型错误；
- URL path 原值、query、User-Agent、Referer、object key、SQL、Prisma model row；
- timestamp、随机 ID、异常 message、stack、文件路径或任意自由字符串；
- 两个低基数值拼接成的高基数 token。

CI 必须计算 series/stream/cardinality budget。新增 label 必须提供 owner、目的、允许值、最大基数、期限、Dashboard/alert query 和 known-fail fixture。

## 8. 结构化日志合同

### 8.1 `OrdinaryLogV1`

```text
timestamp
severity
service
runtime_profile
environment
release_id
operation_code
outcome_code
reason_code?
duration_ms_bucket?
request_id?          // 单次关联；不建 index
trace_id?            // 已采样时关联；不建 index
event_family?
retry_ordinal?
contract_version?
message_code         // 封闭模板码，不是自由文本 message
```

- production 只输出单行 JSON；
- `message_code` 映射版本化 operator 文案，不把 exception message 原样写入；
- stack 只在脱敏、受限且有明确 error fingerprint 时保留；普通 4xx 不写 stack；
- SQL/Prisma 生产日志关闭 bind values、query body 和 row；
- HTTP access log 使用 route template/operation code，不记录原始 path/query/header/body；
- authorization、cookie、secret、certificate、DB URL、provider key 永不记录；
- 结构化 logger 失败时输出最小固定 fallback line，不序列化原对象；
- raw-content detector 在 CI、staging 和 production export 前后运行。

### 8.2 日志级别

| 级别 | 用途 | 禁止 |
|---|---|---|
| `ERROR` | 需要人工关注或进入 error budget 的 terminal/internal failure | expected validation/409 重试 |
| `WARN` | 降级、重试耗尽前、即将超阈值、配置兼容提醒 | 每请求重复噪声 |
| `INFO` | startup/shutdown、release、受控状态转换和稀疏关键事件 | 每个成功 DB query |
| `DEBUG` | LOCAL/DEV 合成调试 | PRODUCTION、真实内容、secret |

生产 log level 变化必须有 scope、approver、expiry；不得打开 body logging。

## 9. Trace 合同

### 9.1 必须 Trace 的边界

- inbound API request → guard → application command/query → PostgreSQL；
- TX-02 intent/outbox → relay → BullMQ → Interactive → Gateway → PublishGuard；
- outbox enqueue、consumer inbox/commit/ACK；
- notification claim → platform attempt → reconcile；
- DataTask step/checkpoint/provider/object cleanup；
- backup/restore synthetic validation；
- deployment candidate smoke 与 release observation。

### 9.2 Span 属性 allowlist

允许：

- resource attributes；
- `operation_code`、route template、HTTP method/status class；
- runtime profile、queue family、job type/version、retry ordinal；
- workload、generation role、provider/model approved code、outcome/reason；
- release/config/catalog/contract version；
- duration、usage units、cost micros、unknown flag；
- opaque ref 只在受限 Trace 中且不作为 searchable/index attribute。

禁止：

- 请求/响应 body、header、query、SQL bind values；
- 用户输入、结果正文、Prompt、provider body/raw error；
- account/session/device/IP、对象 key、Safety 原文/类别；
- seed、raw score、choice trace 和完整 failure chain。

### 9.3 采样

| 场景 | v1 采样 |
|---|---|
| STAGING/RECOVERY synthetic | 100% |
| PRODUCTION ERROR / SLO-slow | 100%，受每分钟上限保护 |
| PRODUCTION normal success | tail/head 组合 10%，允许在 1%～10% 受审范围内调节 |
| Safety/Restricted | 默认只保留最小受限 audit ref；不把内容带入 Trace |
| DEBUG 临时提升 | 明确 scope、expiry、approver；仍不能记录禁止字段 |

- sampling decision 与 rate 作为版本化 config；
- error storm 不能无限写满 backend；超过 cap 只保留计数、代表 trace 和 dropped count；
- sampling 不影响 metrics、hard detector 或业务执行；
- exemplar 只指向已采样无正文 Trace。

## 10. 指标类型与命名

- counter 以 `_total` 结尾；
- duration 使用 seconds，size 使用 bytes，cost 使用 integer micros；
- latency 使用可聚合 histogram，不用进程内 summary 作为跨实例 SLO 权威；
- state/current quantity 使用 gauge；
- timestamp 使用 Unix seconds；
- ratio 不在应用内预计算，使用 numerator/denominator recording rules；
- 每个 metric 有 owner、unit、type、labels、cardinality、source、SLO/alert/dashboard 和测试；
- metric contract breaking change 增加版本或并行新名称，桥接最多 14 天；
- unknown 不填 0，缺失 series 不自动解释为健康。

核心前缀：

```text
dailyenergy_http_*
dailyenergy_command_*
dailyenergy_outbox_*
dailyenergy_queue_*
dailyenergy_worker_*
dailyenergy_gateway_*
dailyenergy_data_task_*
dailyenergy_backup_*
dailyenergy_release_*
dailyenergy_telemetry_*
dailyenergy_cost_*
```

## 11. SLI 与 SLO 计算规则

### 11.1 共同规则

- 正式 SLO 使用滚动 28 天；
- `PROVISIONAL` 可运行观察，窗口完整且 telemetry completeness 通过才作 Release 决策；
- expected validation/auth/consent/onboarding/revision/idempotency conflict 不算服务错误；
- 5xx、deadline、internal cancel、dependency unavailable 和 contract failure 算 bad event；
- Safety/删除/维护明确拒绝若符合合同，不算 availability bad event，但单独监控其异常率；
- 客户端断开只有服务端已经完成可用事实时才算 good；unknown 单独计入 completeness；
- latency 只对成功且可用的事件计算；不能用快速失败改善 P95；
- synthetic 不与真实请求分母混算；二者并列显示；
- 低于最小流量时不依据单次比例 page，使用 synthetic、绝对 count 和硬触发；
- SLO 变更必须有版本、理由、回放结果和用户确认，不能为消除告警静默降低。

### 11.2 用户旅程 SLO

| ID | SLI | Good / Total | 目标 / 28d |
|---|---|---|---:|
| S33-SLO-01 | 核心 API 可用性 | 核心 operation 的 contract-success 或 expected reject / 全部 eligible request | ≥99.5% |
| S33-SLO-02 | 核心读取延迟 | Today/history/bootstrap 等成功读取 ≤0.5s / latency-known success | ≥95% |
| S33-SLO-03 | 核心写接受延迟 | checkin/light/feedback 等同步事实提交 ≤0.75s / latency-known success | ≥95% |
| S33-SLO-04 | 生成结果 30s 可用 | 合法 intent 在 30s 内 AVAILABLE（含 template）/ eligible intent | ≥99.0% |
| S33-SLO-05 | 生成端到端 P95 | intent commit → AVAILABLE；失败不进入 latency 分母但进入 SLO-04 | ≤10s |
| S33-SLO-06 | AI 8s 达标 | 继承 `S25-M20` 的 DAILY AI AVAILABLE latency bucket | ≥95% |
| S33-SLO-07 | 模板降级比例 | 继承 `S25-M21` | ≤5% |

`S33-SLO-04/05` 不把 guard cancel、窗口关闭、合法 existing result 或用户主动取消算服务失败；queue/worker/provider/template 导致的无结果、terminal failure 或超 30 秒算 bad。

### 11.3 运行目标与硬不变量

| ID | 目标 | 阈值 |
|---|---|---|
| S33-OBJ-01 | Interactive outbox → consumer commit | P99 ≤30s |
| S33-OBJ-02 | Background outbox → consumer commit | P99 ≤5min |
| S33-OBJ-03 | Interactive queue oldest eligible age | 正常 ≤5s；60s page threshold |
| S33-OBJ-04 | PostgreSQL pool saturation | active/max <80% sustained |
| S33-OBJ-05 | Redis/queue rebuild | Redis loss drill 后 15min 内恢复 intake，业务事实丢失 0 |
| S33-OBJ-06 | telemetry completeness | required service/resource/profile signals ≥99% |
| S33-OBJ-07 | AI cost completeness | 继承 `S25-M23`，KNOWN terminal DAILY ≥99% |
| S33-OBJ-08 | WAL archive gap | ≤15min；5min warning、10min page、15min breach |

以下没有 error budget，确认一次即失败：

- Safety ordinary-path bypass；
- owner/audience/authorization bypass；
- deletion guard/source invalidation/restore deny 失效；
- duplicate Daily publish 或历史结果被改写；
- secret、Prompt、用户正文、Safety 原文进入普通 telemetry；
- restore 后已删/过期数据可读；
- provider observed model/data profile/region 与 ACTIVE manifest 不一致；
- migration/role/environment/capability fingerprint 不匹配仍开始服务。

## 12. Error budget 与发布策略

### 12.1 预算

对可用性 SLO：

```text
allowed_bad_ratio = 1 - target
observed_bad_ratio = bad / eligible
burn_rate = observed_bad_ratio / allowed_bad_ratio
remaining_budget = 1 - consumed_bad / allowed_bad
```

- 99.5% SLO 的 28 天允许 bad 比例为 0.5%；
- 99.0% SLO 的 28 天允许 bad 比例为 1.0%；
- latency SLO 使用“超过目标 latency 的成功事件”为 bad；
- 分母和 good/bad contract 固定版本化；
- telemetry completeness 不足时 SLO 状态为 `BLOCKED`，不当作 100%。

### 12.2 Multi-window burn rate

| 动作 | 长窗口 | 短窗口 | Burn rate | 预算消耗含义 |
|---|---:|---:|---:|---:|
| Page | 1h | 5m | 14.4× | 约 1h 消耗 2% |
| Page | 6h | 30m | 6× | 约 6h 消耗 5% |
| Ticket | 24h | 2h | 3× | 持续快速消耗 |
| Ticket | 3d | 6h | 1× | 约 3d 消耗 10% |

长短窗口必须同时超过阈值；Alertmanager 做 inhibition，严重告警抑制同根因较低级告警。

### 12.3 Error budget policy

- 28 天 remaining <50% 且窗口过半：新增非修复性发布需要 Engineering owner 批准；
- remaining <25%：冻结非可靠性/安全/成本修复发布；
- budget exhausted：只允许修复、回滚、Safety/Privacy、恢复和必要合规变更；
- 连续两个窗口耗尽：触发容量/架构/依赖评审，不通过降低 SLO 解封；
- hard invariant、raw-content、删除或 secret 事件不看 remaining budget，立即阻断发布；
- 恢复后须完成 S-23 观察窗口，不能因告警恢复就立刻关闭事件。

## 13. 低流量 Alpha/Beta 告警

50～100 名种子用户阶段不能只依赖比例：

- 外部黑盒探针每分钟检查 DNS/TLS/reverse proxy/public readiness，不创建业务事实；
- internal synthetic 只在 STAGING/RECOVERY 完成有写入的核心旅程；
- production 不创建“测试真实用户”、不写 checkin/result/light，不污染 S-25；
- production 真实流量低于 `20 requests / 5m` 时，burn-rate page 需 synthetic failure 或绝对 failure corroboration；
- 核心 API `5xx ≥5/5m`、生成 terminal/no-result `≥3/10m`、outbox/queue oldest hard threshold 可直接 page；
- 任何硬不变量、secret/raw-content、delete/restore detector 命中不要求最小样本；
- 零流量时 telemetry heartbeat、readiness、WAL、backup、queue/outbox scanner 和 Collector export 仍必须可见；
- synthetic 成功不能掩盖真实请求失败，两组信号分别展示。

## 14. 告警分级、路由与去重

### 14.1 告警等级

| Alert severity | 人工动作 | Incident 映射 |
|---|---|---|
| `PAGE_CRITICAL` | 立即确认、containment、声明候选事件 | 通常 IR-SEV0/1 |
| `PAGE_HIGH` | 15 分钟内确认，按影响声明 | 通常 IR-SEV1 |
| `TICKET` | 下一工作日内 owner 处理 | IR-SEV2/3 或缺陷 |
| `INFO` | Dashboard/发布观察，不主动通知 | 无 |

alert severity 只是路由优先级，不能自动替代 S-23 的 Incident Commander 分级。

### 14.2 Alert 合同

每条 alert 必须包含：

```text
alert_id
severity
service/runtime_profile/environment
condition + current value + window
slo_id? / hard_gate_id?
release_id + config/catalog version
started_at
runbook_url
dashboard_url
owner_role
dedupe_key
incident_category_candidate
```

禁止在 alert、annotation、通知或聊天消息中放 request/ref、用户值、IP、正文、Prompt、provider body、secret 或 SQL。

### 14.3 Routing

- hard Safety/Privacy/Data Lifecycle → PAGE_CRITICAL + 对应 restricted owner；
- core API/generation/PG/outbox → Engineering primary on-call；
- AI provider/model/cost → AI owner + Engineering；
- backup/restore/DataTask → Restricted operations + Privacy/Security；
- warning/capacity/cost forecast → ticket owner；
- 相同 environment/service/cause family 归并为一个 canonical alert group；
- maintenance/release silence 必须 scope + expiry，不能 silence hard Gate、raw-content、secret、delete/restore；
- Production 前真实通道、primary/secondary、ack/escalation 和替补演练仍是 BLOCKED Gate。

## 15. API 与客户端边界指标

最低指标：

```text
dailyenergy_http_server_requests_total
dailyenergy_http_server_request_duration_seconds
dailyenergy_http_in_flight_requests
dailyenergy_http_response_contract_failures_total
dailyenergy_command_receipts_total
dailyenergy_command_conflicts_total
dailyenergy_guard_rejections_total
dailyenergy_rate_limit_decisions_total
dailyenergy_client_poll_outcomes_total
```

规则：

- route label 使用 OpenAPI operation code，不用 path；
- 4xx 按 expected/abuse/internal mapping 分开，不把所有 4xx 当服务故障；
- auth/WeChat external exchange 有独立 dependency SLI，不污染纯数据库 command latency；
- client app version 只保留最多 8 个 major.minor/OTHER；
- 小程序不植入通用 OpenTelemetry browser SDK，不自动收集页面、设备、网络、IP 或用户轨迹；
- 小程序只发送 S-24 已批准的显式事件与必要 request correlation，不承担服务端成功权威；
- public health 不泄露依赖详情、版本目录、host、用户数或 provider 状态。

## 16. Outbox、BullMQ 与 Worker 指标

最低指标：

```text
dailyenergy_outbox_events_total
dailyenergy_outbox_oldest_unpublished_age_seconds
dailyenergy_outbox_relay_batch_duration_seconds
dailyenergy_queue_jobs_total
dailyenergy_queue_oldest_eligible_age_seconds
dailyenergy_queue_active_jobs
dailyenergy_queue_retry_total
dailyenergy_queue_terminal_failures_total
dailyenergy_worker_handler_duration_seconds
dailyenergy_worker_inbox_duplicate_total
dailyenergy_worker_guard_rejection_total
dailyenergy_worker_profile_rejection_total
dailyenergy_worker_graceful_shutdown_seconds
```

- queue job 完成/失败不是业务成功；业务结果必须从 PostgreSQL fact/attempt/receipt 观测；
- queue payload 不进日志或 Trace；
- oldest age 使用 eligible/guard-current job，已取消/过期任务单独计数；
- Interactive 与 Background/Restricted 使用不同 queue family 和 SLO；
- terminal contract/config failure 立即停止 blind retry 并告警；
- Redis loss/rebuild 记录 epoch、数量和时长，不恢复旧 snapshot；
- outbox relay enqueue 后崩溃产生 duplicate 是预期恢复路径，业务 duplicate effect 必须为 0；
- Worker profile 收到不允许 handler 是 hard capability alert。

## 17. PostgreSQL、Redis 与主机指标

### 17.1 PostgreSQL

- availability、connection/pool used/max/wait；
- transaction duration、rollback、deadlock、lock wait；
- statement timeout、slow query fingerprint（不含 SQL/bind values）；
- rows scanned/returned 的粗桶、index health、table/index size；
- replication/WAL archive age、backup checkpoint、PITR readiness；
- migration head/checksum/grant drift；
- disk、CPU、memory、I/O 和 connection limit。

告警起点：

- DB unavailable/readiness fail：PAGE_HIGH；
- pool ≥80% 10m：TICKET；≥95% 5m 或 wait P95 >1s：PAGE_HIGH；
- deadlock/transaction invariant error 突增：PAGE_HIGH；
- WAL gap >5m：TICKET；>10m：PAGE_HIGH；>15m：IR-SEV1 candidate + Release Gate；
- schema/grant drift：PAGE_CRITICAL，停止新发布/不合格 profile。

### 17.2 Redis/BullMQ

- availability、command error/latency、memory、eviction、connection；
- BullMQ stalled/retry/age/concurrency；
- breaker/semaphore/budget-state read availability；
- cache hit/miss 仅按 view family，不能按用户/对象；
- Redis unavailable 不直接等于业务丢失，但 queue pause、template fail-closed 和 PG fallback 必须可见；
- eviction 或重启后从 PG rebuild 的 completeness 必须为 100%。

### 17.3 Application host

- CPU、memory、disk、inode、filesystem read-only/write pressure；
- container restart、OOM、health、clock skew、TLS expiry；
- reverse proxy request/error/latency/connection；
- Collector export queue/drops；
- 同 host 全失效只能由独立黑盒/后端发现。

## 18. AI Gateway 与成本指标

### 18.1 Gateway 指标

```text
dailyenergy_gateway_invocations_total
dailyenergy_gateway_attempts_total
dailyenergy_gateway_end_to_end_duration_seconds
dailyenergy_gateway_attempt_duration_seconds
dailyenergy_gateway_candidate_validation_total
dailyenergy_gateway_generation_mode_total
dailyenergy_gateway_breaker_state
dailyenergy_gateway_semaphore_wait_seconds
dailyenergy_gateway_usage_units_total
dailyenergy_gateway_cost_micros_total
dailyenergy_gateway_usage_unknown_total
dailyenergy_gateway_observed_model_mismatch_total
```

批准维度：

- workload、role（PRIMARY/BACKUP/TEMPLATE）；
- provider code、model revision bucket；
- route manifest version、outcome/reason；
- generation mode、environment。

禁止：

- invocation/attempt/result/account ref 作为 label；
- Prompt、输入/输出、token 内容、provider raw error；
- 从失败日志解析成本；
- UNKNOWN usage/cost 写 0。

### 18.2 AI 目标与 hard stop

- `S25-M20`：DAILY AI AVAILABLE 8 秒内达标率 ≥95%；
- `S25-M21`：CONTROLLED_TEMPLATE ≤5%；
- `S25-M22`：DAILY AI 日总成本 / CoreActiveUserDay ≤¥0.10；
- `S25-M23`：terminal DAILY usage KNOWN ≥99%；
- observed model/profile/region drift：provider route 立即 inactive，进入 IR-SEV1 candidate；
- price catalog 缺失/过期：provider call 0，template；
- budget state unreadable：provider call 0，template；
- monthly/daily hard limit 达到：新 provider call 0，existing result、Safety、删除和 deterministic facts 继续；
- cost anomaly 不能自动切换未评审 model/provider。

## 19. 成本目录与预算

### 19.1 `CostEntryV1`

```text
cost_date
environment
cost_category
service_or_workload
provider_code?
model_revision_bucket?
usage_quantity
usage_unit
unit_price_micros
currency
amount_micros
price_catalog_version
source_invoice_or_usage_ref
outcome = KNOWN | ESTIMATED | UNKNOWN
aggregation_revision
```

`CostEntryV1` 不含用户、request、attempt、内容、invoice secret 或付款信息。source ref 只对 Finance/Engineering 受限访问。

成本类别：

- `AI_PROVIDER`；
- `COMPUTE`；
- `POSTGRESQL`；
- `REDIS_QUEUE`；
- `OBJECT_CDN`；
- `OBSERVABILITY`；
- `CI_ARTIFACT`；
- `WECHAT_PLATFORM`；
- `OTHER_APPROVED`。

### 19.2 `BudgetEnvelopeV1`

```text
period
environment
currency = CNY
approved_total_micros
category_caps[]
ai_cost_per_core_active_user_day_cap_micros
forecast_model_version
owner_role
approved_by_role
soft_limit_ratio
high_limit_ratio
hard_limit_ratio
effective_at
expires_at
```

- Production 前必须有明确批准的月度 total/category cap；云厂商未选前绝对基础设施预算为 BLOCKED；
- AI Beta envelope 建议公式：

```text
planned_core_active_user_days × ¥0.10 × 1.20 reserve
```

- 70% forecast 或实际：TICKET，复核增长、usage completeness 和价格目录；
- 85% forecast/实际：PAGE_HIGH 给 AI/Engineering/Finance owner，冻结非必要付费 evaluation；
- 100%：AI provider hard stop；template 继续；基础设施不能自动关数据库、Safety、删除或备份；
- forecast 连续 3 天超批准 total：进入容量/成本评审；
- cost UNKNOWN >1% 或 price coverage <99%：成本 Dashboard `BLOCKED`，不宣称“低于预算”；
- vendor invoice 与 usage 日聚合允许最多 7 天 reconcile，但不能覆盖历史价格版本；
- 预算调整是受审 catalog 发布，不静默重写历史达标状态。

### 19.3 单位成本

必须至少显示：

- AI cost / CoreActiveUserDay；
- AI cost / AVAILABLE Daily result；
- AI cost / 1,000 Gateway invocations；
- infrastructure cost / 月；
- observability cost / total infrastructure cost；
- storage cost / retained GB-day；
- cost completeness 与 estimated/unknown 比例。

不得计算或展示单个用户、单个账号、单条 Safety、单条 note 或单个事项的成本。

## 20. DataTask、期限、备份与恢复指标

最低指标：

```text
dailyenergy_data_task_state_total
dailyenergy_data_task_oldest_age_seconds
dailyenergy_data_task_deadline_seconds
dailyenergy_deletion_guard_failures_total
dailyenergy_provider_deletion_request_age_seconds
dailyenergy_restore_deny_replay_total
dailyenergy_deleted_data_detector_total
dailyenergy_backup_last_success_timestamp_seconds
dailyenergy_wal_archive_gap_seconds
dailyenergy_backup_expiry_violations_total
dailyenergy_restore_drill_duration_seconds
dailyenergy_recovery_copy_destroy_age_seconds
```

告警：

- DataTask 使用 deadline 百分比而非用户/任务 label：50% TICKET、75% PAGE_HIGH、100% IR-SEV1 candidate；
- deletion guard 失效、restore-deny 缺失、deleted-data detector MATCH：PAGE_CRITICAL / IR-SEV0；
- provider deletion request 未在 24h 内发出：IR-SEV1 candidate；
- backup 36 天仍可恢复：IR-SEV1 candidate + Release Gate；
- 最近 base backup/restore drill 过期：Release Gate；
- RECOVERY 副本验证完成后超过 24h 未销毁：PAGE_CRITICAL；
- Restricted telemetry 只显示 scope/stage/outcome/count，不显示 task/user/source refs；
- telemetry 缺失不能当成 deletion 成功或 backup healthy。

## 21. Health、Readiness 与 Synthetic

| Endpoint/Probe | 目的 | 对外 |
|---|---|---|
| liveness | 进程 event loop/基本存活 | internal only |
| readiness | profile config、DB role/schema、必要依赖、catalog/capability | reverse proxy/internal |
| startup | migration/config/fingerprint 验证 | internal only |
| public black-box | DNS/TLS/reverse proxy/隐私安全最小响应 | 可公开但无详情 |
| STAGING journey | 合成账户完成核心流程与故障注入 | staging only |
| RECOVERY probe | owner/Safety/delete/restore/invariant 检测 | recovery restricted |

- liveness 不因外部 provider 暂停而 restart storm；
- readiness 不打印 hostname、DB/provider account、用户计数、版本目录或 secret；
- Background/Restricted 不 ready 不自动让用户 API not ready，但相应 lag/SLA 告警；
- external black-box 与 production telemetry backend 独立；
- full journey synthetic 不在 production 创建用户业务事实；
- clock skew >1s、certificate <30d、<14d、<7d 分级告警；
- health probe 本身有 availability 和 last-success heartbeat。

## 22. Dashboard 最小集合

### 22.1 Executive Reliability

- S33-SLO-01～07、error budget remaining、burn rate；
- synthetic 与真实信号并列；
- current/previous release、incident、maintenance；
- hard Gate 状态，不显示 Safety/DataTask 细节；
- S25 M20～M23 引用，不复制口径。

### 22.2 API / Core Journey

- request rate/error/latency、operation groups；
- auth/dependency、guard/expected reject；
- checkin → intent → available 的运行漏斗；
- today read、write accept、client poll；
- contract/serialization failures。

### 22.3 Async / Data

- outbox age、relay、queue age、retry、terminal；
- Worker profile/concurrency/handler；
- PG pool/lock/deadlock/timeout/WAL；
- Redis availability/eviction/rebuild；
- DataTask/backup/restore restricted summary。

### 22.4 AI / Cost

- primary/backup/template/no-result；
- latency、failure、breaker、semaphore；
- observed model/profile drift；
- input/output units、actual/estimated/unknown；
- daily/monthly budget、forecast、¥/CoreActiveUserDay；
- infrastructure categories 与 observability share。

### 22.5 Telemetry Health

- Collector/backend availability、export failure/drop；
- series/log stream cardinality；
- ingestion/query/storage cost；
- raw-content detector、TTL deletion；
- missing service/profile/release signals。

每个 Dashboard 必须显示时间窗口、环境、数据新鲜度、metric contract version、最后成功刷新和 `PROVISIONAL/BLOCKED`。

## 23. Runbook 与事件交接

每个 PAGE alert 必须有可执行 Runbook：

1. 说明用户/安全/数据影响；
2. 先验证 alert 与 telemetry health；
3. 提供不读取正文的 Dashboard/Trace 查询；
4. 给出 containment、maintenance、route disable、queue pause、rollback 候选；
5. 明确禁止动作；
6. 指向 Release Manifest、current/rollback release 和 config/catalog；
7. 说明何时声明 S-23 incident 及候选类别；
8. 列出恢复 Gate 与观察窗口；
9. 记录 owner role，不写个人联系方式；
10. 使用合成 fixture 验证，不复制生产数据。

Runbook 不能建议：

- 打开 body/SQL bind/provider raw logging；
- 直接改生产数据库；
- 清空 Redis/queue；
- 关闭 Safety/删除/owner/budget/retention Gate；
- 临时换未审核 provider/model；
- 将生产数据下载到个人设备。

## 24. Telemetry 自身可靠性

- 每个 service/profile 每分钟发送 heartbeat 或可抓取 self metric；
- Collector/backend export failure、queue fill 和 dropped telemetry 必须自监控；
- 独立黑盒验证 application host、metrics backend 和 alert delivery；
- 每日 alert delivery canary 使用无用户数据的固定 alert；
- Alertmanager silence/route/config 变更进入审计和 fingerprint；
- Dashboard query failure/无数据与 0 明确区分；
- telemetry outage 超 15 分钟：PAGE_HIGH；关键 hard detector 不可用：PAGE_CRITICAL/Release Gate；
- telemetry 恢复后不补写用户正文或扩大采样；
- ordinary backend 不保存本应进入 SECURITY/GOVERNANCE 的受限内容；
- 监控成本达到预算时先降 success trace 采样和查询保留，不关闭 hard detector、SLO metrics 或安全日志。

## 25. 保存、访问与删除

| 资产 | 默认期限 | 访问 |
|---|---:|---|
| ordinary structured logs | 30 天 | Engineering/Operations |
| sampled raw Trace | 7 天 | Engineering；受限 Trace 另走 restricted |
| detailed runtime metrics | 35 天 | Engineering/Operations |
| recording rules / SLO window | 至少 35 天 | Engineering/Product read |
| T4 daily runtime/cost aggregate | 13 个自然月 | 对应只读 owner |
| network security logs | 6 个自然月 | Security/Privacy restricted |
| alert notification payload | 30 天且无内容 | Engineering/Incident |
| Dashboard/alert/runbook version | 被 release 引用期间 | T4 non-personal |

- shorter PDM/incident/legal deadline 优先；
- ordinary log/Trace 若意外含个人内容，不等待 TTL，立即隔离/删除并按事件处理；
- account/day deletion 不反查和重写已合法匿名的 T4，但普通 Trace 中可解析的 account-scoped opaque ref 必须按 PDM 清理；
- backend export、backup、replication 和 support access 都服从同一期限；
- access 使用企业身份、最小 RBAC、MFA、审计和离职撤权；
- Dashboard 不允许 arbitrary raw query 给普通运营；
- telemetry export/download 默认禁用；批准导出不得含用户内容或 secret。

## 26. 发布与变更集成

Release Manifest 必须增加或引用：

- telemetry schema/semantic version；
- metric/log/span allowlist fingerprint；
- SLO/recording/alert rule version；
- Dashboard/Runbook bundle version；
- Collector/backend config fingerprint；
- sampling/retention/cardinality budget；
- Cost catalog/Budget envelope version；
- required alert delivery/synthetic/telemetry health evidence。

发布顺序：

1. 先发布兼容的 backend/Collector/recording rules；
2. 再发布新 consumer/Worker；
3. 再发布 API producer；
4. 验证 old/new telemetry bridge，最多 14 天；
5. observation window 通过后删除旧 rules；
6. contract/drop 先证明所有旧 series/log/span 不再产生。

发布硬 Gate：

- 必需 SLO/alert/runbook 缺失；
- telemetry schema/label cardinality 超预算；
- raw-content/secret detector 命中；
- alert delivery canary 失败；
- production backend/region/TTL/RBAC/跨境未核验；
- current error budget exhausted 且变更不是允许类型；
- cost envelope/price catalog/completeness 不可用；
- backup/WAL/deletion/restore detector 不合格。

## 27. 实施交接

| 任务 | S-33 直接输入 |
|---|---|
| E-003 | API metrics/log/trace、health/readiness、operation code 与错误预算 |
| E-006 | PG exporter、pool/transaction/lock/WAL/migration/grant 指标 |
| E-007 | outbox/BullMQ/Worker/Redis loss 指标与告警 |
| E-009 | LOCAL/CI/STAGING reference observability profile |
| E-010 | 48 场景、telemetry known-fail、synthetic 和 alert contract tests |
| E-011 | rule/dashboard/runbook lint、cardinality/secret/raw-content Gate |
| E-012 | production backend、独立黑盒、RBAC/region/TTL/egress 与 release wiring |
| E-013 | OTel/metrics/logging、Collector、backend、SLO、alerts、dashboards、cost 实现 |
| E-014 | clean install、alert delivery、outage、budget、restore 和事件演练证据 |
| C-015 | S-24/S-25 T4 与 S-33 runtime/cost 的隔离聚合 |
| AI-016 | Gateway usage/cost reconcile、budget state、anomaly 与 model drift |
| A-005 | 只读 T4 产品指标与 restricted operations Dashboard 边界 |

E-013 不是“接入一个日志 SaaS”即可完成。必须交付信号合同、采集失败行为、字段/label Gate、SLO recording rules、低流量策略、alert routing、Runbook、成本与期限证据。

## 28. 固定验证场景（48）

### 28.1 字段、隐私与基数（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S33-OBS-001 | request body 含 preferred name 被 logger 传入 | 字段 allowlist 丢弃，raw-content Gate 通过 |
| S33-OBS-002 | Prompt/provider raw response 进入 span event | export 拒绝并触发受限事件候选 |
| S33-OBS-003 | AccountRef 被添加为 metric label | CI cardinality/privacy Gate 失败 |
| S33-OBS-004 | trace_id 被设为 Loki index label | 配置 Gate 失败，只能作为非索引关联字段 |
| S33-OBS-005 | 原始 URL/query 被记录 | route template/operation code 替代，原值为 0 |
| S33-OBS-006 | exception message 含 SQL bind/secret | 固定 reason/message code；原异常不导出 |
| S33-OBS-007 | 新 label 未声明最大基数 | telemetry contract Gate 失败 |
| S33-OBS-008 | ordinary backend 收到 Safety/DataTask 受限细节 | 平面隔离失败，停止 export 并按 S-23 处理 |

### 28.2 SLO、低流量与告警（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S33-OBS-009 | expected 409 revision conflict | 不计 SLO availability bad，单独 conflict metric |
| S33-OBS-010 | 快速 5xx 大量出现 | latency SLO 不被快速失败改善；availability bad 增加 |
| S33-OBS-011 | 1h/5m 同时 >14.4× burn | PAGE alert，较低窗口被抑制 |
| S33-OBS-012 | 1h 高但最近 5m 已恢复 | 不 page；保留 ticket/观察证据 |
| S33-OBS-013 | 低流量单次 ephemeral 5xx | 不因比例单独 page；记录并等待 corroboration |
| S33-OBS-014 | 零真实流量且 host 全失效 | 独立 black-box/heartbeat 告警 |
| S33-OBS-015 | synthetic 成功但真实错误上升 | 两组分开，synthetic 不掩盖真实 burn |
| S33-OBS-016 | error budget exhausted 后普通功能发布 | Release Gate 拒绝，只允许批准的修复类变更 |

### 28.3 API、数据库与缓存（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S33-OBS-017 | 动态 UUID path 产生大量 series | OpenAPI operation code 聚合，series 不增长 |
| S33-OBS-018 | WeChat exchange 慢 | 独立 dependency SLI，不污染纯 DB command latency |
| S33-OBS-019 | PG pool 95% 且 wait P95>1s | PAGE_HIGH + DB runbook |
| S33-OBS-020 | slow query detector | 只记录 fingerprint/bucket，不记录 SQL/bind |
| S33-OBS-021 | Redis unavailable、PG 正常 | cache miss/PG fallback 可见，个人旧 cache 不返回 |
| S33-OBS-022 | breaker state 不可读 | provider calls=0、template 路径与告警可见 |
| S33-OBS-023 | schema/grant fingerprint drift | PAGE_CRITICAL，profile 不 ready |
| S33-OBS-024 | public health 被访问 | 只返回稳定状态，不泄露内部依赖或版本目录 |

### 28.4 Outbox、Queue 与 Worker（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S33-OBS-025 | enqueue 成功、outbox 标记前崩溃 | duplicate delivery 可见，业务 duplicate effect=0 |
| S33-OBS-026 | Interactive oldest eligible age >60s | PAGE_HIGH，包含 runbook/release，无 job ref |
| S33-OBS-027 | Background lag 高但 API 正常 | Background 告警，不让 API 自动 not ready |
| S33-OBS-028 | terminal contract failure 被无限重试 | retry storm detector 命中，原 business key 不变 |
| S33-OBS-029 | Worker 收到非 profile allowlist job | hard capability alert，handler 不执行 |
| S33-OBS-030 | Redis 全量丢失 | 从 PG 重建，15min 目标、业务事实丢失 0 |
| S33-OBS-031 | commit 后 ACK 前 crash | Inbox duplicate metric 增加，单领域效果 |
| S33-OBS-032 | queue payload 被 log 序列化 | log contract test 失败，不输出 payload |

### 28.5 AI 与成本（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S33-OBS-033 | usage UNKNOWN 被写为 0 | cost contract Gate 失败，Dashboard BLOCKED |
| S33-OBS-034 | observed model 与 manifest 不符 | route inactive、PAGE_CRITICAL/事件候选 |
| S33-OBS-035 | price catalog 过期 | provider calls=0，template，cost reason 可见 |
| S33-OBS-036 | template rate >5% 但结果可用 | SLO-04 可成功，S25-M21/AI 告警失败，互不抵消 |
| S33-OBS-037 | 月度 AI forecast 达 70% | TICKET，继续受审 route |
| S33-OBS-038 | 月度 AI budget 达 100% | 新 provider calls=0，template/Safety/delete 继续 |
| S33-OBS-039 | cost UNKNOWN >1% | 成本结论 BLOCKED，不显示“低于预算” |
| S33-OBS-040 | 想按单用户查看 AI 成本 | 查询/Schema 拒绝，只允许匿名 workload 聚合 |

### 28.6 部署、删除、备份与观测自身（8）

| ID | 场景 | 必须结果 |
|---|---|---|
| S33-OBS-041 | raw-content detector MATCH | PAGE_CRITICAL，停止 export，IR-SEV0 候选 |
| S33-OBS-042 | DataTask 到 75% deadline 未完成 | PAGE_HIGH；guard 保持，不显示 task/user ref |
| S33-OBS-043 | deletion guard/restore-deny detector 失败一次 | 无 error budget，立即 PAGE_CRITICAL |
| S33-OBS-044 | WAL gap 10min / 15min | 10min PAGE_HIGH；15min Release Gate + IR-SEV1 candidate |
| S33-OBS-045 | 36 天 backup 仍 AVAILABLE | IR-SEV1 candidate，禁止作为恢复源 |
| S33-OBS-046 | Collector/backend 丢 telemetry 15min | PAGE_HIGH；禁止改为 body logging |
| S33-OBS-047 | monitoring cost 达预算 | 先降 normal success trace/查询保留，hard signals 保持 |
| S33-OBS-048 | RC 完整观测演练 | signal、SLO、burn、alert、runbook、cost、TTL 与 delivery 证据全部可追踪 |

## 29. 验收标准

- OTLP/OpenMetrics/structured JSON 的 vendor-neutral 信号合同明确；
- reference backend 与 production backend 替换 Gate 明确；
- telemetry 平面、T0～T4、字段 allowlist、cardinality 和 index 规则完整；
- ordinary log、Trace、metrics 不含用户正文、Prompt、provider body、secret 或高基数标识；
- 7 个用户旅程 SLO、8 个运行目标和无 error budget 硬不变量完整；
- 28 天、good/bad、unknown、expected reject、synthetic 与低流量规则唯一；
- 14.4×/6× multi-window burn rate、error budget release policy 和告警抑制完整；
- API、outbox、BullMQ、Worker、PG、Redis、host、Gateway、DataTask、backup 的最低指标完整；
- S25-M20～M23 不被复制改写，provider/model 精确诊断只在受限运行视图；
- CostEntry、BudgetEnvelope、70/85/100%、UNKNOWN 和 Beta AI envelope 完整；
- Dashboard、Runbook、alert contract、routing、on-call Production Gate 明确；
- ordinary logs 30d、Trace 7d、metrics 35d、T4 13 个月、安全日志 6 个月对齐 PDM；
- telemetry 自身、独立 black-box、alert delivery canary 和 observability cost 可观测；
- 48 个 `S33-OBS-*` 场景完整且唯一；
- E-003/E-006～E-014、C-015、AI-016、A-005 的实施交接清楚；
- PR 只包含本文、S-32 接受记录和项目控制 Markdown，不创建 SDK、配置、Dashboard、告警、账号或生产资源；
- 本文已随 PR #38 获用户明确确认并记录为 Accepted；后续实现不得静默降低信号/平面、字段/基数、SLO、告警、成本、期限、运行 Gate 或 48 个固定场景。

## 30. 明确禁止

- 记录请求/响应 body、自由文本、Prompt、provider raw response、SQL bind 或 secret；
- 把 account/session/device/IP/ref/trace ID 作为 metric 或 log index label；
- 用日志/Trace 构造用户漏斗、D1/D3/D7、帮助度或关系画像；
- 启用 session replay、录屏、热力图、自动页面/设备采集；
- 把 telemetry、Dashboard、alert、queue UI 当业务事实或删除证明；
- 让应用直接持有 observability SaaS key；
- 因 backend 不可用改为打印完整对象；
- 用单次低流量错误比例制造无行动价值 page；
- 让 synthetic production probe 创建真实 checkin/result/light；
- 把 expected 4xx 全部算服务失败，或让快速失败改善 latency SLO；
- 以 0 代替 UNKNOWN usage/cost/latency/telemetry；
- 达到预算后关闭 Safety、删除、backup、security log 或确定性核心；
- 自动切换未评审 provider/model 省钱；
- 为调试关闭 TLS、权限、guard、breaker、retention 或 raw-content detector；
- 用 silence 屏蔽 hard Gate、secret、raw-content、delete/restore 告警；
- 在 application host 单点后端上声称能检测 host 全失效；
- 未核验厂商、区域、TTL、访问、跨境和退出就发送生产 telemetry；
- 在 S-33 PR 中创建监控服务、SDK、Compose、workflow、Dashboard、alert、secret、账号、联系人或云资源。

## 31. 参考标准

- OpenTelemetry 提供厂商中立的 Trace/Metrics/Logs 数据模型、OTLP 与 Collector；
- OpenTelemetry JavaScript 当前 Trace/Metrics 稳定，Logs API/SDK 仍在演进，因此 v1 日志保持成熟 JSON logger + Collector；
- Prometheus/OpenMetrics 用 counter、gauge、histogram 和低基数 labels 表达 SLI；
- Prometheus/Alertmanager 负责 recording/alert rules、聚合、抑制、silence 与通知；
- Loki labels 必须保持低基数，高基数关联使用结构化 metadata 或非索引字段；
- Google SRE multi-window multi-burn-rate 作为 14.4×/6× 起点，低流量按 synthetic、聚合和绝对故障数校准。

官方参考：

- https://opentelemetry.io/docs/what-is-opentelemetry/
- https://opentelemetry.io/docs/languages/js/
- https://opentelemetry.io/docs/collector/
- https://opentelemetry.io/docs/specs/otlp/
- https://prometheus.io/docs/practices/instrumentation/
- https://prometheus.io/docs/practices/naming/
- https://prometheus.io/docs/practices/histograms/
- https://prometheus.io/docs/practices/alerting/
- https://prometheus.io/docs/alerting/latest/overview/
- https://grafana.com/docs/loki/latest/get-started/labels/cardinality/
- https://sre.google/workbook/alerting-on-slos/

## 32. 审核记录

- 状态：Accepted；
- 接受日期：2026-07-27；
- 内容 PR：[PR #38](https://github.com/WeiHan1996/DailyEnergy/pull/38)；
- 基线：`main`（S-32 部署、配置与回滚已随 PR #37 合并并获用户确认）；
- 已确认范围：信号/后端、字段/基数/期限、SLO/error budget、低流量告警、API/Worker/数据/AI 指标、成本预算、Dashboard/Runbook/on-call 与 48 个场景；
- 下一任务：S-34 Phase 1～3 工程 Issues；监控实现和生产告警仍须等待 E-013/E-014。

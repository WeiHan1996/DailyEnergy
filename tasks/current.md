# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-33
- **当前任务名称**：可观测性和成本监控
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/observability-cost-monitoring`
- **上游 PR**：[S-32 PR #37](https://github.com/WeiHan1996/DailyEnergy/pull/37)
- **当前 PR**：待创建
- **交付文件**：`docs/technical/observability.md`

## 1. 当前目标

把 Accepted 的产品指标、AI Gateway、隐私、事件响应、系统架构、测试和部署合同转换为可实施的观测与成本控制规范，明确：

- structured JSON、OpenTelemetry/OTLP、Prometheus/OpenMetrics 与 Collector 边界；
- ordinary runtime、security、governance、Safety control、cost 和 product analytics 平面；
- 日志字段、span attributes、metric labels、cardinality、采样、期限和访问；
- 核心 API、生成、outbox/queue、PG/Redis、DataTask、backup 与 telemetry SLI/SLO；
- 28 天 error budget、multi-window burn rate、低流量 synthetic/绝对失败告警；
- Gateway token/cost、基础设施类别、预算 envelope、forecast 和 hard stop；
- Dashboard、Runbook、alert routing、on-call、release 与 incident 证据。

## 2. 必须交付

### 2.1 信号与数据边界

- vendor-neutral OTLP/OpenMetrics/JSON 合同；
- reference backend 与 production backend 替换 Gate；
- resource/log/span/metric allowlist 与 cardinality budget；
- ordinary/restricted 平面、raw-content/secret detector；
- trace sampling、telemetry health、retention 与 RBAC；
- 不建立用户级 analytics、RUM、session replay 或正文日志。

### 2.2 SLO、告警与恢复

- S33-SLO-01～07 和 S33-OBJ-01～08；
- 28 天 good/bad/unknown/expected reject 语义；
- 14.4×/6× multi-window burn rate 与 error budget release policy；
- 低流量 synthetic、绝对数量和 hard trigger；
- API、outbox、BullMQ、Worker、PG、Redis、host、DataTask、backup 指标；
- alert contract、severity、inhibition、silence、Runbook 和 S-23 交接。

### 2.3 AI 与成本

- S25-M20～M23 的运行实现边界，不复制改写产品口径；
- provider/model/route、breaker、usage、UNKNOWN 与 observed drift；
- `CostEntryV1`、`BudgetEnvelopeV1` 与成本分类；
- 70%/85%/100% 阈值、Beta AI envelope 与 fail-closed template；
- observability 自身成本、采样降级顺序和 hard signal 保留；
- 48 个唯一 `S33-OBS-*` 场景及 E-013/E-014 交接。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/analytics/event-tracking.md`；
3. `docs/analytics/metrics.md`；
4. `docs/ai/gateway.md`；
5. `docs/operations/privacy-data-map.md`；
6. `docs/operations/incident-response.md`；
7. `docs/technical/architecture.md`；
8. `docs/technical/repository-structure.md`；
9. `docs/technical/testing.md`；
10. `docs/technical/deployment.md`；
11. `docs/technical/observability.md`。

## 4. 已冻结边界

- S-25 是产品、留存、AI 运行与单核心活跃用户日成本的唯一指标口径；
- PostgreSQL 是业务事实；telemetry、Dashboard、alert 和 cost panel 不是；
- 不建立用户级 event stream、跨日 subject、device/session 轨迹或任意用户下钻；
- API/Admin/Worker profiles、outbox/inbox、Gateway、Safety、删除和恢复语义不变；
- ordinary trace 最长 30 天、security log 六个月、T4 匿名聚合 13 个月；
- backup 最长 35 天、WAL/RPO ≤15 分钟、restore 先重放删除/restore-deny；
- 单区域单活单 host Compose MVP，不声称 HA 或 24×7 已实现；
- 监控厂商、region、跨境、真实通知通道、值班人和绝对基础设施预算仍是 Production Gate。

## 5. 不做

- 不创建 OTel/Prometheus/Loki/Tempo/Grafana/Alertmanager 配置或服务；
- 不创建 SDK、logger、metrics endpoint、Collector、exporter、Dashboard、alert 或 Runbook 文件；
- 不购买/连接 SaaS，不创建账号、secret、通知群、电话、状态页或云资源；
- 不启用小程序自动 RUM、session replay、录屏、热力图或用户级 analytics；
- 不记录请求/响应 body、Prompt、provider raw output、SQL bind、Safety 原文或 secret；
- 不改 S-25、S-23、PDM、架构、部署、保存删除或事件分级；
- 不承诺公开 SLA、HA、多区域、自动扩缩或 24×7 人工响应；
- 不提前开始 E-013/E-014 或 S-34。

## 6. 验收标准

- `observability.md` 为 Draft，覆盖信号、平面、字段/基数、日志、Trace、Metrics、SLO、告警、成本、期限和实施交接；
- 7 个用户旅程 SLO、8 个运行目标和硬不变量完整；
- 48 个 `S33-OBS-*` 场景完整且唯一；
- 所有相对链接可解析；
- `deployment.md` 根据用户确认转为 Accepted，S-32 backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-33 In Review；
- PR 仅包含 6 个 Markdown 文件，无 SDK、配置、服务、Dashboard、alert、secret、账号或生产变更；
- 用户确认前 `observability.md` 保持 Draft，S-33 保持 In Review。

## 7. 最近交接

- [PR #37](https://github.com/WeiHan1996/DailyEnergy/pull/37) 已于 2026-07-26 合并，S-32 部署、配置与回滚已获用户明确确认；
- `deployment.md` 在本分支补记 Accepted/接受日期，不改变部署、迁移、回滚、备份或 48 个场景；
- S-33 Draft 采用 structured JSON + OpenTelemetry/OTLP + Prometheus/OpenMetrics 的 vendor-neutral 合同；
- reference backend 为 Prometheus/Loki/Tempo/Grafana/Alertmanager，生产后端仍须通过独立故障域、区域、TTL、RBAC 和跨境 Gate；
- 28 天 SLO、14.4×/6× burn rate、低流量 synthetic/绝对故障、hard invariant 和 48 个场景已冻结；
- AI 成本继承 ≤¥0.10/CoreActiveUserDay 与 ≥99% completeness，并使用 70%/85%/100% 预算状态；
- 当前动作：等待 Draft PR 创建并由用户审核；不自动接受、合并或开始 S-34。

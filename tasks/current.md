# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-22
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-21
- **当前任务名称**：隐私数据地图
- **任务状态**：Ready
- **优先级**：最高
- **代码工作**：不开始数据库、migration、NestJS、埋点、同意页面、供应商配置或生产实现；只允许 Draft 隐私数据地图
- **当前分支**：`agent/s20-accept-handoff`（本 PR 仅 S-20 Accepted 收尾；S-21 在合并后新分支开始）
- **关联 PR**：S-20 内容已由 [PR #24](https://github.com/WeiHan1996/DailyEnergy/pull/24) 合并；Accepted 收尾 PR 待创建
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)

## 1. 当前目标

在 S-20 被用户确认、PR #24 合并并完成本收尾 PR 后，创建 Draft：

- `docs/operations/privacy-data-map.md`

把 Accepted 产品、AI、领域、保存删除、数据库与 API 契约整理成一张可审计的数据地图，回答每项个人信息“从哪里来、为什么处理、到哪里去、谁能访问、保存多久、怎样删除”。

**本 PR 不开始写隐私数据地图正文**；只完成 S-20 Accepted 状态收尾与任务指针切换。

## 2. S-21 必须交付（合并本 PR 后的下一实现 PR）

- Draft `docs/operations/privacy-data-map.md`；
- 为每类数据分配稳定条目 ID，并标注数据主体、分类、敏感级别、是否自由文本/派生/运行证据；
- 映射收集入口和权威来源：页面、API DTO/View、领域对象、Prisma model/字段与生成/记忆/Safety 流程；
- 记录处理目的、必要性、处理依据、用途限制和明确禁止用途；
- 记录在线库、缓存、队列、对象存储、日志、备份、AI provider、微信平台及管理端等位置与流转；
- 记录访问角色、脱敏/加密、受托方或接收方、跨境状态及上线前待签约/核验项；
- 逐项对齐 ADR-0005 的保存期限、TTL、删除范围、在线清除、备份过期、恢复防复活与最小受限证据；
- 覆盖访问、更正、导出、删除、撤回同意和账户删除等用户权利入口；
- 明确 analytics 允许的最小候选属性与禁止采集内容，为 S-24 提供白名单上游，但不提前编写埋点字典；
- 给出正常、缺失、撤回、删除、受托方失败、备份恢复、Safety 与日志脱敏等可验证场景。

## 3. 上游必读（S-21 开始时）

见 [docs/INDEX.md](../docs/INDEX.md) 第 12 节 S-21 读取顺序。

## 4. 已接受且不得重开的边界

- 只处理实现明确产品目的所必需的数据；禁止未经授权抓取外部个人数据；
- 记忆必须真实、用途受限、可解释、可关闭、可删除；关闭 grant 后不得继续进入普通生成；
- 晚间 note 不进入 Weekly、普通 AI、memory、通知、分享或 analytics；
- Safety 原文、Prompt、provider raw body、seed、ciphertext、内部 epoch 不进入客户端或普通运营后台；
- API 只暴露封闭白名单 View；DTO 不等于 Prisma model；UUID 不是授权；
- 删除遵循 ADR-0005：先同步阻断使用，在线副本最长 72 小时，备份最长 35 天隔离过期，provider 最长 30 天，DAY guard 最长 45 天且不保留被删内容；
- 数据地图不得创造新字段、处理目的、接收方、保存期限或跨境安排；发现缺口时必须回报上游冲突。

## 5. 明确不做（本收尾 PR 与 S-21 Draft PR）

- 创建或修改数据库、Prisma、migration、API、NestJS、worker、缓存或生产代码；
- 编写 S-24 埋点事件字典、S-25 指标口径或完整运营 RBAC；
- 起草最终隐私政策、用户协议、同意页面文案或替代上线前法律意见；
- 配置真实微信、AI provider、云存储、日志平台、数据出境或生产账号；
- 为填表方便扩大采集、长期保存自由文本或重开 Accepted ADR；
- 自动 merge 任何 PR。

## 6. 验收标准（本收尾 PR）

- `docs/technical/api.md`、`docs/technical/error-codes.md` 与 `openapi/openapi.yaml` 为 Accepted，接受日期 2026-07-22；
- docs/INDEX、backlog、README 和技术目录中 S-20 Done / Accepted、S-21 Ready 一致；
- 同一时间只有 S-21 一个 Ready 任务；
- 本 PR 不创建 `privacy-data-map.md`，无生产代码、无真实数据、无 secret；
- 用户审核本收尾 PR 后再合并；合并前不开始 S-21 正文。

## 7. 最近一次交接

- 日期：2026-07-22；
- PR #24 已 squash 合并到 main，提交 `207de0e`；
- S-20 交付包含 API、错误码与 OpenAPI 3 契约；
- 64 个唯一 S20 场景（48 API + 16 error）；OpenAPI 62 paths / 65 operations / 136 schemas；
- Redocly recommended 已验证为 0 errors / 0 warnings；
- 本分支只做 S-20 Accepted 生命周期收尾和 S-21 Ready 指针切换；
- 无 NestJS、migration、数据库、worker 或生产代码；
- **下一步**：创建并审核本收尾 PR；合并后从新的 S-21 分支开始隐私数据地图正文。

## 8. 状态更新规则

本收尾 PR 合并前：

- 三份 S-20 契约在分支上为 Accepted；
- S-21 保持 Ready，不创建隐私数据地图正文。

用户合并本收尾 PR 后：

- main 上 S-20 正式 Accepted / Done；
- 新分支将 S-21 改为 In Progress，并创建 Draft `docs/operations/privacy-data-map.md`；
- 再开独立 Draft PR，仍不自动 merge。

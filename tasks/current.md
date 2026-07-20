# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-20
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-10
- **当前任务名称**：稳定种子与产品日期决策
- **任务状态**：In Progress
- **优先级**：最高
- **代码工作**：不开始正式业务代码；允许 ADR、算法伪代码和确定性测试向量
- **当前分支**：`agent/stable-seed-product-date`
- **关联 PR**：待创建
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)
- **完整 Backlog**：[tasks/backlog.md](./backlog.md)

## 1. 当前目标

创建 `docs/decisions/ADR-0002-deterministic-daily-result.md`，一次性确定 DailyEnergy 的权威产品日期策略、跨日有限续写、稳定种子、结果版本和幂等身份，使每日事实不会因设备时间、重试、并发、部署或模型变化而迁移、重抽或静默改写。

本任务只做决策与可复算测试向量，不实现日期服务、规则引擎、API、数据库、队列、缓存、前端或 AI 调用。

## 2. 必须交付

- 一份 Draft ADR-0002；
- 产品日期策略版本、IANA 时区和日边界；
- 服务端权威时钟、命令接受时刻与目标日期冻结规则；
- OPEN / CONTINUATION_ONLY / CLOSED 的确定性判定；
- COMMAND_COMMIT、VIEW_CONTINUATION、GENERATION_COMPLETION 的精确期限和允许操作；
- 七天窗口按产品日历日期计算的规则；
- 稳定用户主体、seed preimage、规范化字节编码和摘要算法；
- 具名随机命名空间和无偏选择规则，避免共享 PRNG 顺序漂移；
- result_version 清单、生成意图唯一性、并发与重试语义；
- 版本升级、历史冻结、删除后重建和策略失败边界；
- 日期边界、种子摘要、选择索引、并发和版本切换测试向量；
- 对 S-11、S-12、S-17～S-20、S-24、S-32 的下游约束。

## 3. 上游必读

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [ADR-0001 产品定位](../docs/decisions/ADR-0001-product-positioning.md)；
6. [产品状态机](../docs/product/state-machine.md)；
7. [业务规则](../docs/product/business-rules.md)；
8. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
9. [晚间反馈 Schema](../docs/ai/evening-feedback-schema.md)；
10. [七天总结 Schema](../docs/ai/weekly-summary-schema.md)；
11. [共享 Schema 包](../packages/shared-schemas/README.md)。

## 4. 已接受且不得重开的边界

- 产品日期由服务端权威策略解析，设备日期和客户端倒计时不能决定写入；
- 每个正式写事件必须携带目标 product_date 和日期策略版本；
- 服务端在边界前接受的命令继续归原日期，响应晚到不改变归属；
- 未被服务端接受的点击、草稿或离线请求不能跨日补交；
- 旧日事实禁止改写到新产品日期；
- 页面续写只授予边界前已合法打开的 DLY-003 / EVE-001；
- 签到新增和更正不属于续写操作；
- 同一用户和产品日期最多一份 AVAILABLE 每日结果；
- 已发布结果不可变，算法升级不重写历史；
- 七天窗口是包含锚点的七个连续产品日期，不是七个相遇日；
- DAY 删除后不得自动重建；无法同时满足删除与稳定身份时保持禁用；
- Safety、Deleting 和账户阻断优先于任何日期或续写资格。

## 5. 本任务必须推荐并决定

1. 首批中国大陆种子用户使用哪个 IANA 时区；
2. 产品日边界是自然零点、固定偏移还是带宽限的双日期规则；
3. VIEW_CONTINUATION 与 GENERATION_COMPLETION 各持续多久；
4. 续写资格如何绑定用户、会话、页面、原日期和策略版本；
5. 日期解析失败、时钟异常和 tzdata 变化时如何 fail closed；
6. 稳定 seed 是否包含用户、日期、结果版本、输入快照或实验；
7. 如何进行跨语言规范化编码、SHA 摘要和具名派生；
8. 如何从摘要做无偏有限集合选择；
9. result_version 与 seed / rule / algorithm / catalog / schema 版本如何关联；
10. 同日部署、并发、重试、签到更正和生成失败如何保持唯一；
11. 删除后显式重新开始是否允许，以及由哪个后续 ADR 解锁；
12. 哪些字段可进入日志、埋点和错误上下文。

## 6. 必须覆盖的测试向量

- 日边界前一秒、边界时刻和后一秒；
- UTC 与产品时区跨自然日、跨年和闰日；
- 设备时间错误、请求延迟和响应跨界；
- OPEN、合法续写、续写过期和历史页；
- 七日窗口首尾与连续日期；
- 同一 seed 输入多次得到相同摘要；
- 任一 seed 字段变化得到不同摘要；
- 相同命名空间稳定，不同命名空间隔离；
- 2、3、5、9 等集合大小的无偏索引边界；
- 同日并发生成只保留一个意图和一个 AVAILABLE 结果；
- 发布新 result_version 不改写既有当日和历史结果；
- DAY 删除不触发隐式生成。

## 7. 明确不做

- 五维分数、档位阈值和行动选择业务规则；
- PRNG 或哈希的生产代码；
- 数据库表、唯一索引、事务和迁移；
- API 路径、错误码、令牌格式和签名密钥；
- AI Gateway、Prompt、模型重试和缓存；
- 前端倒计时、跨日弹窗和页面组件；
- 通知调度实现与平台模板；
- 多国家、多时区账户切换；
- 依赖客户端时钟的任何写入授权。

## 8. 验收标准

- ADR 状态为 Draft，用户确认前不标记 Accepted；
- 每个时间点只解析出一个产品日期；
- OPEN / CONTINUATION_ONLY / CLOSED 对同一输入唯一；
- 命令接受与页面续写的边界不混用；
- 稳定 seed 字节级可复算且跨语言无歧义；
- 新增命名随机选择不会改变既有选择；
- result_version 和生成意图唯一性足以解释并发、重试和部署；
- 历史不改写、删除不复活、Safety 不被日期解除；
- 测试向量含确定输入与期望输出；
- 下游任务不需要重新猜测日期、种子或版本语义；
- docs/INDEX.md、tasks/current.md 和 backlog 同步；
- 通过独立 Draft PR 提交；
- 用户确认前不进入 S-11。

## 9. 完成后的下一任务

S-10 被接受后，下一任务为：

- 当前任务 ID：S-11；
- 当前任务名称：规则引擎规范；
- 主要交付：docs/ai/generation-engine.md、docs/ai/scoring-rules.md；
- 依据：已接受的可执行 Schema、ADR-0002 日期/种子/版本决策；
- 不开始生产服务实现。

## 10. 最近一次交接

- 日期：2026-07-20；
- PR #12 已 squash 合并到 main（`f4e36f3`）；
- S-09 共享 Schema 已验证为 Accepted；
- S-10 已在分支 `agent/stable-seed-product-date` 开始，状态为 In Progress；
- 当前没有正式产品业务代码；
- 当前没有阻塞项；
- 下一操作：起草 ADR-0002，加入可复算日期、种子和选择测试向量；
- 新会话恢复口令：**继续 DailyEnergy 当前任务**。

## 11. 状态更新规则

任务开始时：

- Ready → In Progress；
- 记录分支和 PR；
- 不改变任务范围。

任务受阻时：

- 状态改为 Blocked；
- 写明缺失决定、负责人和解锁条件；
- 不通过猜测继续。

任务完成待审核时：

- 状态改为 In Review；
- 填写 PR、交付物和验证；
- 下一任务仍不得开始。

用户确认并合并后：

- 状态改为 Done；
- ADR-0002 变为 Accepted；
- 更新 docs/INDEX.md；
- 从 Backlog 选择唯一下一任务；
- 将下一任务设为 Ready。

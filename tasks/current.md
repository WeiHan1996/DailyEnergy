# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-26
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-27
- **当前任务名称**：渠道归因规范
- **任务状态**：In Review
- **优先级**：最高
- **当前分支**：`agent/channel-attribution`
- **上游 PR**：[S-26 PR #31](https://github.com/WeiHan1996/DailyEnergy/pull/31)
- **当前 PR**：[Draft PR #32](https://github.com/WeiHan1996/DailyEnergy/pull/32)
- **交付文件**：`docs/analytics/channel-attribution.md`

## 1. 当前目标

把 Accepted 的事件、指标和实验边界转换为小红书/抖音到微信小程序的可审计归因规范，明确：

- 平台跳转能力不确定时的 fail-closed 承接与二维码 fallback；
- channel/campaign/creative/landing 低基数 registry；
- 素材 revision 共用、不可识别用户的签名 source token；
- first-valid-touch、参数丢失、冲突、转发和反作弊；
- 当前可用匿名质量信号与 Blocked 的渠道 Activation、D1/D3/D7、CAC；
- proposed Acquisition Mapping 的 PDM、30 天上限、删除、导出和实现 Gate。

## 2. 必须交付

### 2.1 平台与来源合同

- 小红书、抖音到微信小程序能力上线前执行 iOS/Android 真机矩阵；
- 直接入口不可依赖时保留中性 H5、二维码和手动搜索 fallback；
- registry code 不接收任意 UTM、平台内容 ID、创作者或用户标识；
- source token 对素材 revision 共享，不产生 click ID、设备或 session 轨迹；
- token 无效、过期、篡改或丢失时进入 UNATTRIBUTED，不阻断核心产品。

### 2.2 归因、隐私与指标

- first valid touch 只绑定当前 acquisition cycle，后续触达不覆盖、不留 assist history；
- 当前只允许承接 event count、token resolution 等 best-effort 质量指标；
- 渠道/素材 Activation、D1/D3/D7、帮助度与 CAC 在 Acquisition Mapping 前保持 Blocked；
- proposed mapping 最长 30 天，受账户/关系删除、导出和备份规则约束；
- T4 继续使用 k=10、最多两个维度、Wilson 95% 区间和 13 个月上限；
- 不与 Safety、Support、Research、实验或用户自由文本建立普通 join。

### 2.3 验证与下游

- 12 个渠道指标状态；
- 10 个固定 fixtures；
- 32 个唯一验证场景；
- 平台能力、registry/token、PDM、领域/API、删除、聚合、spend 与可观测性 Gate；
- S-28/S-29/S-31/S-33/C-015 完成前不启用生产归因能力。

## 3. 上游读取顺序

1. `AGENTS.md`、`README.md`、`ROADMAP.md`、`docs/INDEX.md`、本文；
2. `docs/product/vision.md`、`persona.md`、`mvp.md`、`business-rules.md`；
3. `docs/data/domain-model.md`；
4. `docs/technical/database.md`、`api.md`；
5. `docs/decisions/ADR-0005-data-retention-and-deletion.md`；
6. `docs/operations/privacy-data-map.md`；
7. `docs/analytics/event-tracking.md`；
8. `docs/analytics/metrics.md`；
9. `docs/analytics/experiments.md`；
10. `docs/analytics/channel-attribution.md`。

## 4. 已冻结边界

- XHS/DOUYIN 只表示低基数渠道，不保存平台账号、内容 ID 或创作者姓名；
- source token 不是身份、认证或逐点击标识；
- 平台曝光/点击口径与产品事实并列，不互相替代；
- UNATTRIBUTED 是合法状态，不能静默归入 DIRECT；
- 截图/转发仍是原素材传播，不能称平台直接投放转化；
- 渠道相关性不写成因果结论；
- 平台能力变化只能降级入口，不能扩大追踪；
- 当前没有生产 Acquisition Mapping、渠道留存、CAC 或第三方归因能力。

## 5. 不做

- 不创建 click ID、source cookie、设备图谱、平台用户匹配或逐用户触达历史；
- 不接广告/归因 SDK，不向平台导出产品用户或用户事件；
- 不用客户端缓存、日志、Safety、Support、通知或删除回执补造来源；
- 不发布未达到 k=10 的素材/渠道指标；
- 不把平台 clicks、landing event 或 token resolution 称为唯一用户转化；
- 不提前实现 S-28/S-29 的工程决策和架构。

## 6. 验收标准

- `channel-attribution.md` 为 Draft，包含平台/fallback、registry/token、first touch、指标、期限、删除与 Gate；
- 10 个 fixture 和 32 个场景 ID 唯一；
- 所有相对链接可解析；
- S-26 根据用户确认转为 Accepted，backlog 为 Done；
- README、INDEX、tasks/current 和 backlog 一致标记 S-27 In Review；
- PR 仅包含 6 个 Markdown 文件，无业务代码、Schema、API、数据库、SDK 或真实配置；
- 用户确认前 `channel-attribution.md` 保持 Draft，S-27 保持 In Review。

## 7. 最近交接

- [PR #31](https://github.com/WeiHan1996/DailyEnergy/pull/31) 已于 2026-07-26 合并，S-26 已获用户明确确认；
- `experiments.md` 在本分支补记 Accepted/接受日期，不改变实验合同内容；
- S-27 Draft 已冻结平台 fail-closed、低基数 registry、共享 token 与 first-valid-touch；
- 渠道 Activation、D1/D3/D7、CAC 在 Acquisition Mapping 的 PDM、30 天期限、删除和实现 Gate 完成前保持 Blocked；
- 已定义 12 个渠道指标状态、10 个 fixtures 和 32 个验证场景；
- 当前动作：等待用户审核 [Draft PR #32](https://github.com/WeiHan1996/DailyEnergy/pull/32)；不把 Draft 视为已启用生产能力。

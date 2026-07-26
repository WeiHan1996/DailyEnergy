# DailyEnergy 小红书与抖音渠道归因规范

- **文档状态**：Accepted
- **接受日期**：2026-07-26
- **所属任务**：S-27 — 渠道归因规范
- **最后更新**：2026-07-26
- **适用范围**：Phase 0B / 小红书、抖音种子内容到微信小程序承接、首次价值与 D1/D3/D7 的归因设计
- **上游权威**：[产品愿景](../product/vision.md)、[用户画像](../product/persona.md)、[第一阶段 MVP](../product/mvp.md)、[业务规则](../product/business-rules.md)、[领域模型](../data/domain-model.md)、[数据库规格](../technical/database.md)、[API 契约](../technical/api.md)、[隐私数据地图](../operations/privacy-data-map.md)、[数据保存与删除决策](../decisions/ADR-0005-data-retention-and-deletion.md)、[埋点事件字典](./event-tracking.md)、[指标唯一口径](./metrics.md)、[实验规范](./experiments.md)
- **下游任务**：S-29、S-31、S-33、C-001、C-002、C-015、B-001～B-011

## 1. 目的

本文规定 DailyEnergy 怎样把小红书、抖音的内容素材连接到承接页、首次开始、首次价值和后续留存，同时诚实处理平台阻断、参数丢失、截图转发、小样本和隐私边界。

核心验收句是：

> 渠道归因只能回答“一个已注册的低基数来源对一组匿名结果有多大关联”；它不能证明平台最终投递、不能恢复逐用户路径、不能把来源标签变成个人画像，也不能把相关性写成渠道造成留存的因果结论。

现有 Domain Model、Prisma 和 OpenAPI 没有权威渠道归因对象或字段。本文冻结逻辑合同与 Production Gates，但不把缺失能力伪装为已经实现。

## 2. v1 决策摘要

| # | 决策 | v1 唯一结论 |
|---:|---|---|
| 1 | 核心渠道 | `XHS`（小红书）、`DOUYIN`（抖音）；另有 `DIRECT`、`SHARE`、`OTHER`、`UNATTRIBUTED` |
| 2 | 归因对象 | 已注册的 channel / campaign / creative / landing revision，不接收任意 UTM |
| 3 | 来源令牌 | 同一素材 revision 共用的签名 token；绝不按点击、用户或设备唯一 |
| 4 | 当前可用 | 承接曝光/主操作事件比、合法 token 解析、同次同意入口的方向性聚合 |
| 5 | 当前 Blocked | 素材/渠道级 Activation、D1、D3、D7 与 CAC；需要受控个人来源映射 |
| 6 | 触达模型 | 首个合法来源用于 acquisition；后续触达不覆盖、不追加个人历史 |
| 7 | 窗口 | 来源候选只在当前启动处理；未来个人映射最多 30 天并绑定当前 acquisition cycle |
| 8 | 跨日留存 | 仅在 PDM/Schema/删除实现后由 T0 临时 join，最终只写 T4 匿名聚合 |
| 9 | 小样本 | 默认 k=10；最多两个批准维度；Wilson 95% 区间；Alpha 不做素材留存 |
| 10 | 平台数据 | 平台曝光/点击与产品事实分开；不能用平台 Dashboard 替代产品分母 |
| 11 | 直接跳转 | 小红书/抖音到微信小程序能力在上线前逐版本真机验证；失败时使用中性承接与二维码 fallback |
| 12 | 转发 | 截图/转发仍归原素材传播，不能称作付费或创作者直接转化 |
| 13 | 第三方 | 不接广告/归因 SDK，不发送 openid、IP、设备、session 或用户事件 |
| 14 | 保存 | T4 最长 13 个月；个人来源映射若未来获批最长 30 天且可删除/导出 |

## 3. 能回答与不能回答的问题

### 3.1 可以回答

在来源和样本 Gate 成立时：

- 每个渠道/活动/素材产生多少承接页 view 与主操作 event；
- 有多少服务端启动解析到合法、过期、篡改或未知来源码；
- 同一产品日期的 NewConsentOwner 是否来自合法低基数来源；
- 未来个人来源映射获批后，各渠道的 S-25 激活、D1/D3/D7 和帮助度表现；
- 哪个承接版本出现明显的参数丢失、跳转失败或“点击高、首次价值低”模式；
- 聚合花费与可评激活的方向性成本。

### 3.2 不能回答

- 某一个人来自哪篇笔记、哪个视频或哪个创作者；
- 用户在平台内看过、点赞、收藏、评论或停留了什么；
- 平台曝光是否被真实用户看到；
- 截图转发后是原受众、朋友还是其它渠道；
- 某渠道“导致”D7 更高；种子 Beta 只能描述关联并披露混杂；
- 未归因用户为什么进入、为什么流失或有什么情绪/关系特征；
- 用渠道解释 Safety、删除、支持或研究自由文本。

## 4. 平台能力与 fail-closed 策略

### 4.1 当前事实

DailyEnergy 目标载体是微信小程序，不是小红书或抖音小程序。平台允许的外链、二维码识别、剪贴板、浏览器唤起和微信跳转能力会随客户端版本、账号资质、内容形态与审核变化。

因此：

- 任何“可以一键直达微信小程序”的能力在验证前状态为 `UNVERIFIED`；
- 平台能力只能减少可用入口，不能放宽隐私或在客户端注入追踪；
- 抖音官方“小程序二维码传参”只证明其自身小程序能力，不证明可直达微信小程序；
- 小红书跨应用跳转若无当前官方合同与真机证据，不能作为唯一承接；
- 不通过自动读取剪贴板、设备指纹、系统广告 ID 或 URL history 补偿平台限制。

### 4.2 承接优先级

每个素材必须配置至少一种可回退路径：

1. 平台审核允许且真机验证通过的直接/网页承接；
2. 中性 H5 承接页，展示价值说明和微信小程序二维码；
3. 静态二维码或可保存图片；
4. 手动搜索小程序名称的无归因 fallback。

fallback 失败只降低归因完整率，不阻止用户直接使用核心产品。

### 4.3 上线前真机矩阵

每次平台/素材类型变更至少验证：

- iOS 与 Android；
- 小红书/抖音当前正式客户端与上一个主要版本；
- 笔记/视频正文、评论、私信、主页等实际使用入口；
- 已登录/未登录、微信已安装/未安装；
- 直接点、保存二维码后识别、系统相机扫描；
- 参数完整、被截断、被转义、过期、重复打开；
- 微信小程序冷启动、热启动和已登录账户；
- 平台审核文案、链接域名与隐私说明一致。

矩阵未通过时 registry 状态不能从 `STAGED` 变为 `ACTIVE`。

## 5. 低基数注册表

### 5.1 Channel Registry

| `channel_code` | 含义 | 注意 |
|---|---|---|
| `XHS` | 小红书内容入口 | 不含账号、创作者或笔记 ID |
| `DOUYIN` | 抖音内容入口 | 不含账号、创作者或视频 ID |
| `DIRECT` | 用户直接/搜索进入 | 不伪造 campaign |
| `SHARE` | DailyEnergy 内隐私安全分享入口 | 与外部平台素材分开 |
| `OTHER` | 已知但未单列的低量来源 | 不能携带原始 referrer |
| `UNATTRIBUTED` | 无合法来源 | 不是错误，也不自动归到 DIRECT |

### 5.2 Campaign Registry

`campaign_code` 表达一个明确验证命题，例如 `SEED_BETA_VALUE_V1`，不使用平台投放 ID、日期时间戳或人员姓名。

每季度：

- ACTIVE campaign 最多 8 个；
- code 最长 32 个 ASCII 字符，`UPPER_SNAKE_CASE`；
- 每项包含 owner、目标画像、承诺、开始/结束、状态、渠道集合和内容审核 ref；
- RETIRED 后不复用 code；
- 语义变化创建新 code/revision。

### 5.3 Creative Registry

`creative_code` 是内部低基数枚举，不是平台内容 ID。

- 每个 campaign 每渠道 ACTIVE creative 最多 12 个；
- 记录内容角度、形式、承诺版本和审核状态，不保存完整平台正文副本；
- 不用创作者姓名、账号、手机号或外部用户 ID；
- 删除/下架不改历史 code，只改变 registry 状态；
- 同一内容跨渠道必须使用不同 creative code，避免把平台差异混为素材差异。

### 5.4 Landing Registry

`landing_version` 最多 8 个 ACTIVE major/minor 版本，包含：

- 承接页面/小程序入口；
- 对用户可见的价值承诺；
- 支持的平台路径与 fallback；
- source token version；
- 隐私说明版本；
- 状态、有效期和回滚版本。

### 5.5 Registry Entry

```text
AttributionRegistryEntryV1 {
  channel_code
  campaign_code
  creative_code
  landing_version
  registry_revision
  status                 // DRAFT | STAGED | ACTIVE | PAUSED | RETIRED
  owner
  claim_review_ref
  privacy_review_ref
  platform_capability_evidence_ref
  valid_from
  valid_until
  fallback_code
  created_at
}
```

Registry 是无个人数据的系统配置；不能存用户点击、AccountRef、平台账号或精确访问日志。

## 6. 共享签名来源令牌

### 6.1 设计原则

`source_token` 对一个 registry revision 的所有用户相同。它只防止任意伪造代码，不用于识别点击或用户。

逻辑载荷：

```text
SourceTokenV1 {
  token_version
  registry_revision
  channel_code
  campaign_code
  creative_code
  landing_version
  coarse_expiry_date
}
```

服务端对规范化载荷签名；外部只携带紧凑 opaque token。禁止包含：

- 随机 click ID、用户 ID、openid/unionid；
- 设备、IP、session、广告 ID、手机号；
- 平台用户/内容 ID、创作者账号；
- 精确点击时间、地理位置；
- 签到值、事项、关系、Safety 或实验 assignment。

### 6.2 解析结果

- `VALID`：签名、registry ACTIVE、窗口和 landing 均合法；
- `EXPIRED`：签名合法但窗口结束；
- `INACTIVE`：registry PAUSED/RETIRED；
- `UNKNOWN_VERSION`：token/registry version 未注册；
- `TAMPERED`：签名失败；
- `ABSENT`：无 token；
- `PLATFORM_STRIPPED`：承接已知带 token，但下游没有收到；仅作聚合诊断，不能按用户证明。

除 `VALID` 外全部进入 `UNATTRIBUTED` 产品路径；不阻断登录、同意、签到或今日内容。

### 6.3 防滥用

- token 可公开，不具有认证或授权能力；
- token 泄露或批量访问只影响来源计数，不能访问用户数据；
- rate limit 与 bot 防护属于安全运行，不写 IP 到普通 analytics；
- 异常流量用聚合 reason code 标记，不删除不利数据后继续发布；
- token 轮换创建新 revision，不原地改变旧语义。

## 7. 归因模型

### 7.1 三层事实

| 层 | 当前状态 | 能力 |
|---|---|---|
| Landing Signal | 可设计 | best-effort view/click event count；不等于人 |
| Launch Source | 可设计 | 服务端解析共享 token；同次请求方向性来源 |
| Acquisition Mapping | Blocked | 将一个来源绑定到当前 acquisition cycle，支持 Activation/D1/D3/D7 |

### 7.2 First valid touch

v1 唯一 acquisition 规则：

- 当前 acquisition cycle 的首个 `VALID` source token 成为 first valid touch；
- 后续来源不覆盖，不保存 assist 列表；
- `ABSENT` 后未来第一次合法来源可以成为候选，直到首次价值完成或候选窗口关闭；
- 同一启动出现多个冲突 token 时 fail closed 为 `UNATTRIBUTED`；
- 来源不能跨账户、跨 relationship delete 或账户重建恢复；
- 截图/转发使用原 token，仍记为“原素材传播”，不称付费直接转化。

### 7.3 候选窗口

- T0 候选：只在当前启动/请求链内存中存在；请求结束立即释放；
- 未来 T1 Acquisition Mapping：从 first valid touch 到首次有效 LightFact，最长 24 小时；
- 为计算 D1/D3/D7，可保留绑定最多 30 个自然日；D7 成熟和允许迟到窗口结束后尽早清除；
- ACCOUNT 或 RELATIONSHIP_DATA 删除同步停止读取并进入 72 小时在线清理；
- 30 天仅是上限，不代表当前 PDM 已授权；PDM 变更未 Accepted 前不得生产持久化。

### 7.4 为什么不用 last touch

- 平台回流、朋友转发和重复扫码会轻易覆盖真实首次承诺；
- last touch 会奖励频繁追投和召回，不适合判断“哪种承诺带来首次价值”；
- DailyEnergy 不保存完整触达历史，因此无法诚实实现多触点模型；
- 后续触达只报告匿名事件量，不改变 acquisition source。

## 8. 当前能力与 Production Block

### 8.1 当前可实现为匿名聚合

- `channel_landing_view_count`：按 channel/campaign 或 channel/landing 的 best-effort event count；
- `channel_primary_action_count`：主操作 event count；
- `source_token_resolution_count`：按 channel 与 outcome；
- `source_token_valid_rate`：VALID / 全部解析尝试；
- 同一个接受必要同意请求中携带合法 token 时，可形成同日 NewConsentOwner 的 T0 聚合候选。

这些不能宣称唯一访客、完整 funnel 或跨日留存。

### 8.2 当前不可实现

以下全部 `BLOCKED`：

- channel/campaign/creative 级 S25-M05/M06；
- channel/campaign/creative 级 S25-M07/M08/M09；
- 渠道级帮助度、任务、关系研究或成本回收；
- first-touch 用户查看/导出/删除；
- 素材级 CAC、LTV、ROI 或自动预算优化。

原因：现有 Domain Model、Prisma、OpenAPI、PDM 与删除合同没有 Acquisition Mapping。

### 8.3 解锁条件

必须先接受并实现：

1. `PDM-ATTRIBUTION-001` 或等价正式数据资产：目的、依据、必要性、字段、位置、角色、期限、权利、删除和受托方；
2. Acquisition Mapping 领域对象、数据库唯一性、API/Schema 与白名单 View；
3. 绑定 current acquisition/relationship cycle，不复制 AccountRef 到 analytics；
4. account/relationship delete、同日重建、多端、token 冲突、备份恢复与迟到任务测试；
5. T0 source view 只在聚合时连接 mapping 与 EncounterLink，随后立即释放 owner/cycle；
6. T4 只保留 k-safe 匿名单元，最长 13 个月；
7. 用户隐私说明和访问/导出摘要包含“首次来源”这一处理；
8. S-29 架构、S-31 测试、S-33 完整性与 C-015 聚合器通过。

## 9. 渠道指标叠加层

本节不重定义 S-25 分子/分母，只规定何时允许增加渠道维度。

| ID | 名称 | 来源/公式 | 状态 |
|---|---|---|---|
| S27-C01 | 承接页 view event count | `landing_viewed` event count | AVAILABLE / best-effort |
| S27-C02 | 主操作 event count | `landing_primary_action_clicked` event count | AVAILABLE / best-effort |
| S27-C03 | 主操作事件比 | C02 / C01 | AVAILABLE / direction only |
| S27-C04 | 合法 token 解析率 | VALID / all token resolutions | AVAILABLE / quality |
| S27-C05 | 同日新同意来源数 | 同请求 T0 valid source + NewConsentOwner | PROPOSED；实现 Gate |
| S27-C06 | 渠道首次价值完成率 | S25-M06 + acquisition dimension | BLOCKED |
| S27-C07 | 渠道 D1 | S25-M07 + acquisition dimension | BLOCKED |
| S27-C08 | 渠道 D3 | S25-M08 + acquisition dimension | BLOCKED |
| S27-C09 | 渠道 D7 | S25-M09 + acquisition dimension | BLOCKED |
| S27-C10 | 每可评首次价值成本 | 聚合 campaign spend / C06 numerator | BLOCKED；spend contract 缺失 |
| S27-C11 | 未归因比例 | UNATTRIBUTED launches / accepted launches | PROPOSED / quality |
| S27-C12 | 参数丢失比例 | PLATFORM_STRIPPED / expected token landings | PROPOSED / best-effort |

所有比例沿用 S-25：显示 x/n、Wilson 95% 区间，n<10 抑制。C01～C04 是事件/解析质量，不冒充用户转化。

## 10. 维度与报告

### 10.1 批准维度

- `channel_code`；
- `campaign_code`；
- `creative_code`；
- `landing_version`；
- `cohort_product_date`；
- `app_version_bucket` 仅质量诊断。

每个 T4 单元除 metric/date/environment 外最多两个维度。常用报告：

- channel × cohort date；
- channel × campaign；
- channel × creative（仅 n≥10 且不再加 campaign/landing）；
- channel × landing version；
- channel × app version（只诊断参数/跳转质量）。

### 10.2 禁止维度与联接

- 用户、设备、session、IP、地区、手机号、平台账号/内容 ID；
- 创作者姓名、账号 handle、粉丝量的逐用户联接；
- expression style、签到值、事项、关系状态、帮助度与渠道的高维组合；
- Safety、DataTask、支持文本、问卷/访谈原文；
- provider、model、Prompt、精确延迟或成本 attempt；
- 渠道 × 实验 × 留存，除非 S-26 预注册、样本充足且维度上限仍成立；种子 Beta 默认禁止。

### 10.3 Alpha 与 Beta

- Alpha 10～20 人：只验证入口、token、承接、同意和数据来源，不发布渠道/素材留存百分比；
- Beta 50～100 人：先按 XHS/DOUYIN 两个渠道总体看样本和首次价值；素材级 D1/D3/D7 很可能因 k 不足保持 SUPPRESSED；
- 不为凑 k 合并语义不同的素材或改 attribution window；
- 不用总平均掩盖渠道差异，也不用稀疏切片制造差异。

## 11. 花费与平台报表

### 11.1 平台报表

平台曝光、点击、播放和互动：

- 保持平台原定义和报告时区；
- 以无个人数据的日/活动汇总导入或人工登记；
- 不导入用户列表、评论、私信、账号或设备；
- 不与产品用户逐人匹配；
- 与 C01/C02 并列展示，不能互相替代。

### 11.2 Spend Registry

若未来计算 C10，只允许 campaign/day/channel 的财务汇总：

```text
CampaignSpendV1 {
  channel_code
  campaign_code
  spend_date
  currency_code
  gross_spend
  source_type          // INVOICE | PLATFORM_AGGREGATE | MANUAL_VERIFIED
  revision
  verified_by
}
```

- 不含个人、投放受众包或广告设备 ID；
- 币种不静默换算；汇率版本另行登记；
- 免费自然内容 spend=0 不能被解释为无获客成本；制作和人力另列，不与媒体花费混装；
- 没有已核验 spend 和可评激活映射时 C10 为 UNAVAILABLE。

## 12. 删除、权利与期限

未来 Acquisition Mapping 获批后：

- 用户可在访问/导出摘要中看到粗粒度首次渠道/活动及有效期，不返回签名、外部平台 ref 或内部审核信息；
- ACCOUNT 删除删除 mapping；
- RELATIONSHIP_DATA 删除关闭旧 acquisition cycle 并删除 mapping；
- DAY 删除若删除 D0/首次价值事实，T4 前按当前有效事实重算；
- 新 relationship cycle 不继承旧渠道，除非发生新的合法来源触达；
- 在线映射最长 30 天，到期物理清理；备份仍服从 ADR-0005；
- T4 历史匿名聚合不反减单人，报告带固定历史说明；
- 删除回执、Safety 或支持数据不能恢复来源。

PDM 变更未 Accepted 前，上述是 proposed contract，不授权持久化。

## 13. 反作弊、混杂与 falsification

每次渠道报告必须检查：

- registry ACTIVE、token 签名、版本与 landing 一致；
- view/click 可能受爬虫、预览和重复打开影响，明确标 best-effort；
- 同一 token 被截图转发时仍是 original-material propagation；
- 平台参数丢失不会被归 DIRECT；
- INVALID/TAMPERED 不回显 token 内容，不阻断核心使用；
- 某渠道期间的故障、模型降级、版本、节假日和样本结构变化；
- 平台 report timezone 与产品日期不能直接逐行相减；
- 同一人多账户、多人共设备和跨端无法从匿名聚合消除；
- 总和与 channel/campaign/creative rollup 一致，UNKNOWN 不填 0；
- overlap/differencing 查询不能反推出一个人；
- 未归因比例异常上升先修入口或平台能力，不把剩余样本称高质量用户；
- 平台点击高、产品 token 低可能是跳转限制，不等同用户反悔。

## 14. 固定验收 Fixtures

| Fixture | 输入 | 预期 |
|---|---|---|
| S27-FX-01 | XHS 素材 token 合法且 registry ACTIVE | 解析 VALID，核心路径正常 |
| S27-FX-02 | token 签名被修改 | TAMPERED → UNATTRIBUTED，不阻断产品 |
| S27-FX-03 | token 合法但 campaign PAUSED | INACTIVE → UNATTRIBUTED |
| S27-FX-04 | 同一素材二维码被朋友转发 | 仍计 original-material propagation，不称原平台直接用户 |
| S27-FX-05 | 首次 DIRECT 后第二天扫描 DOUYIN | 不覆盖 first valid acquisition，不保存 assist history |
| S27-FX-06 | 每素材 D7 分母 9 | SUPPRESSED，不显示精确值 |
| S27-FX-07 | 无 Acquisition Mapping 请求渠道 D1 | BLOCKED，不用客户端 token 补造 |
| S27-FX-08 | RELATIONSHIP_DATA 删除后新 cycle | 旧 mapping 不恢复，新 cycle 默认 UNATTRIBUTED |
| S27-FX-09 | 平台 clicks=100、landing views=70 | 并列展示口径差异，不把 30 解释成用户流失 |
| S27-FX-10 | 同 revision 聚合重跑 | 覆盖同 key，不重复累加 |

## 15. 验证场景

| ID | 场景 | 预期 |
|---|---|---|
| S27-ATT-001 | 任意 UTM 原样进入数据库 | 拒绝；只能 registry code |
| S27-ATT-002 | 每次点击生成唯一 click ID | 拒绝；token 必须素材 revision 共用 |
| S27-ATT-003 | token 包含平台用户 ID | 拒绝并触发合同 Gate |
| S27-ATT-004 | 从 IP/设备推断跨平台用户 | 永久拒绝 |
| S27-ATT-005 | 平台移除 query 参数 | 进入 fallback/UNATTRIBUTED，不阻断核心使用 |
| S27-ATT-006 | 无微信时跳转失败 | 显示中性二维码/搜索 fallback，不采集安装状态画像 |
| S27-ATT-007 | 一个启动出现两个冲突 token | fail closed 为 UNATTRIBUTED |
| S27-ATT-008 | 过期 token 重复打开 | EXPIRED，不恢复旧 campaign |
| S27-ATT-009 | RETIRED creative code 被新素材复用 | 拒绝；创建新 code/revision |
| S27-ATT-010 | XHS 与 DOUYIN 复用一个 creative code | 拒绝；渠道差异必须显式 |
| S27-ATT-011 | 截图转发带来激活 | 归原素材传播，不能称平台直接投放转化 |
| S27-ATT-012 | 平台 Dashboard 点击当作 M02 分母 | 拒绝；平台与产品口径分开 |
| S27-ATT-013 | landing view 丢失但 click 存在 | C03 可异常，标 best-effort，不修成 100% |
| S27-ATT-014 | token VALID 但 consent 未接受 | 不创建个人 mapping，不进入产品成功分子 |
| S27-ATT-015 | 同次 consent 带合法 token | 只可形成 T0 聚合候选；实现 Gate 前不持久化 |
| S27-ATT-016 | 请求按素材看 D1 | Acquisition Mapping 未解锁时 BLOCKED |
| S27-ATT-017 | 用客户端 LocalStorage 保持 30 天来源 | 拒绝；这仍是个人来源处理且不可审计删除 |
| S27-ATT-018 | 用 session 保存 sticky attribution | 拒绝；当前 PDM/API 未授权 |
| S27-ATT-019 | PDM 已更新且 mapping 到期 30 天 | 物理删除，不继续作为长期画像 |
| S27-ATT-020 | ACCOUNT 删除 | mapping 同步禁用并按 SLA 清理 |
| S27-ATT-021 | RELATIONSHIP_DATA 删除 | 旧 cycle mapping 删除，新 cycle 不继承 |
| S27-ATT-022 | DAY 删除 D0 | T4 前重算 cohort，不保留幽灵激活 |
| S27-ATT-023 | T4 后单人删除 | 历史匿名单元不反减，带固定 notes code |
| S27-ATT-024 | 渠道 × 素材 × landing × D7 | 拒绝超过两维且重识别风险高 |
| S27-ATT-025 | 某素材 n=8 但内部报告 | 仍 SUPPRESSED，不因内部使用降低 k |
| S27-ATT-026 | 渠道与 Safety 类别联接 | 永久拒绝 |
| S27-ATT-027 | 渠道与研究原文联接 | 拒绝；独立研究合同也不能普通 join |
| S27-ATT-028 | 渠道 × 实验 × 留存未预注册 | 拒绝；种子 Beta 默认不做 |
| S27-ATT-029 | 媒体花费缺失填 0 | C10 UNAVAILABLE，不伪造免费 |
| S27-ATT-030 | 人民币和美元花费直接相加 | 拒绝；需要汇率版本 |
| S27-ATT-031 | 参数丢失突然上升 | 暂停渠道结论，执行真机矩阵和入口排障 |
| S27-ATT-032 | 渠道 D7 高但 G01～G04 失败 | 不得宣称渠道成功，先处理 Gate |

## 16. Production Gates 与下游交接

| Gate | Owner / 下游 | 解除条件 |
|---|---|---|
| 平台能力矩阵 | Growth + QA | XHS/DOUYIN 当前版本、入口、iOS/Android、fallback 和审核证据通过 |
| Registry 与 token | S-29、C-015 | 低基数、不可复用 revision、签名、状态、过期和篡改测试 |
| Landing signals | C-015 | S-24 best-effort 合同、无 SDK/个人标识、T4 聚合实现 |
| Acquisition Mapping 隐私 | Privacy/Legal + PDM change | 新数据资产、依据、告知、权利、30 天期限、删除和受托方 Accepted |
| 领域/数据库/API | S-29、E-006、C-001/C-002 | cycle 绑定、唯一性、白名单 View、多端与删除实现 |
| 渠道 D1/D3/D7 | C-015 | mapping + S-25 T0 临时 join、成熟窗口、fixture 与无持久 cohort |
| 小样本与隔离 | S-31、Privacy | k=10、两维、差分、无 Safety/Support/Research join |
| 完整性与告警 | S-33 | token 丢失、INVALID、UNKNOWN、rollup 和平台能力异常告警 |
| Spend 与成本 | Growth + Finance | 汇总 spend registry、币种/汇率、核验和 revision 实现 |
| Dashboard | A-005 | 只读 T4、状态/口径/Gate/样本展示，无用户下钻 |

上述 Gate 未完成前：

- 不发布渠道、活动或素材级 Activation、D1、D3、D7、帮助度或 CAC；
- 不创建用户级 source cookie、click ID、设备图谱或平台用户匹配；
- 不接第三方归因/广告 SDK 或导出产品用户给平台；
- 不用日志、支持、Safety、通知、删除回执或客户端缓存补造来源；
- 不把平台点击、token 解析或 landing event 称作用户留存。

## 17. 官方能力复核记录

截至 2026-07-26：

- 抖音开放平台《绑定普通二维码》与《生成 QRCode》说明的是抖音小程序二维码/路径传参能力；它们不构成抖音内容稳定直达微信小程序的合同；
- 小红书到微信小程序的可用入口、参数保留与审核规则未在本次找到可依赖的公开官方开发合同；
- 微信 URL Link/小程序码的实际账号资格、有效期、scene/query、外部唤起和审核限制必须在实现前按微信官方最新文档复核；
- 任何平台规则变化只允许把能力降级为承接页/二维码/搜索 fallback，不能新增追踪字段。

参考：

- [抖音开放平台：绑定普通二维码](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/open-capacity/basic-capacities/link-qrcode)
- [抖音开放平台：生成 QRCode](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/url-and-qrcode/qrcode/create-qrcode)

## 18. S-27 验收标准

- 平台能力、fallback 和真机矩阵的 fail-closed 规则完整；
- channel/campaign/creative/landing registry 低基数且不含平台/用户 ID；
- 共享 source token 不按点击、用户或设备唯一；
- first valid touch、冲突、转发、窗口、删除和新 cycle 语义明确；
- 当前可用匿名质量指标与 Blocked 的素材级 Activation/D1/D3/D7/CAC 明确分开；
- Acquisition Mapping 需要 PDM、领域、数据库、API、权利和删除变更，不伪装为已有能力；
- k=10、最多两个维度、Wilson 95% 区间与 T4 13 个月一致；
- 10 个固定 fixtures 和 32 个验证场景 ID 唯一；
- 与 MVP、领域模型、PDM、ADR-0005、事件字典、指标和实验合同无冲突；
- PR 只包含本文与项目控制状态更新，不包含代码、Schema、OpenAPI、Prisma、数据库、migration、SDK、生产配置或真实用户数据；
- 本文只有在用户确认后转为 Accepted。

## 19. 审核记录

- 状态：Accepted；
- 接受日期：2026-07-26；
- 内容 PR：[PR #32](https://github.com/WeiHan1996/DailyEnergy/pull/32)；
- 基线：`main`（S-26 已随 PR #31 合并并获用户确认）；
- 已确认范围：平台能力 fail-closed、registry、共享 token、first touch、30 天 proposed mapping、渠道指标状态、32 个验证场景和 Production Gates；
- 下一任务：S-28 Monorepo 与技术栈决策；渠道归因实现 Gate 仍未解除。

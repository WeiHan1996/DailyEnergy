# DailyEnergy 隐私数据地图

- **文档状态**：Draft
- **所属任务**：S-21 — 隐私数据地图
- **最后更新**：2026-07-23
- **范围**：Phase 0B 开发前详细规格

## 1. 目的与边界

本文将 Accepted 产品、AI、领域、数据库、API 和保存删除规则映射为可审计的数据流。

不新增采集，不改变 ADR、Schema、API 或数据库设计。

核心原则：

- 数据来源必须明确；
- 用途必须绑定；
- DTO/View 不等于数据库授权；
- 删除优先于派生、缓存、生成和分析；
- 未授权数据不得进入 AI、memory、analytics。

## 2. 数据资产登记

| ID | 数据主体 | 数据 | 分类 | 类型 | 敏感级别 | 权威来源 |
|---|---|---|---|---|---|---|
| PDM-ACCOUNT-001 | 用户 | 微信身份映射、账户引用 | 身份信息 | 权威事实 | 高 | UserAccount / ExternalIdentity |
| PDM-PROFILE-001 | 用户 | 称呼、表达风格 | 基本资料 | 用户提供 | 中 | UserProfile |
| PDM-CHECKIN-001 | 用户 | mood/energy/sleep | 状态记录 | 用户提供结构化数据 | 中 | MorningCheckin |
| PDM-INTERACTION-001 | 用户 | 点亮、任务、帮助度 | 行为记录 | 用户行为/派生 | 中 | DailyInteraction |
| PDM-MATTER-001 | 用户 | 重要事项标题、状态、授权 | 用户内容 | 自由文本 | 高 | ImportantMatter |
| PDM-EVENING-001 | 用户 | evening note | 用户内容 | 自由文本 | 高 | EveningFeedback |
| PDM-SAFETY-001 | 用户 | Safety 最小事件和状态 | 受限证据 | 运行证据 | 高 | SafetyState/SafetyEvent |
| PDM-GENERATION-001 | 用户 | 今日结果、版本、来源信息 | 派生内容 | 系统生成 | 中 | PublishedDailyResult |

## 3. API / View / Domain / Storage 映射

| 数据 | API/View | Domain | Prisma/存储 | 访问边界 |
|---|---|---|---|---|
| ACCOUNT | auth/session、bootstrap | Account | UserAccount、ExternalIdentity、SessionCredential | Auth 服务 |
| PROFILE | ProfileView | Profile | UserProfile、Revision | Profile 服务 |
| CHECKIN | CheckinView | Daily Checkin | MorningCheckin | Daily 服务 |
| MATTER | MatterView | Important Matter | ImportantMatter、MemoryPurposeGrant | Matter 服务 |
| SAFETY | SafetyView | Safety | SafetyState、SafetyEvent | Safety 受限角色 |
| GENERATION | TodayView | Published Result | PublishedDailyResult | 展示服务 |
| DATA RIGHTS | DataTaskView | Data Task | DataTask、DeletionGuard | Privacy 受限角色 |

## 4. 处理目的和禁止用途

| 数据 | 允许目的 | 禁止用途 |
|---|---|---|
| Profile | 称呼、表达风格 | 推断身份画像 |
| Checkin | 今日体验、趋势 | 医疗诊断、人格判断 |
| Matter | 用户主动记忆 | 自动建立长期画像 |
| Evening note | 用户反馈处理 | AI记忆、分析、分享 |
| Safety | 安全流程 | 用户画像、风险评分营销 |
| Generation | 展示历史 | 重新推断用户事实 |

## 5. AI Provider 数据边界

允许：

- 封闭结构化表达输入；
- 必要版本信息；
- 安全投影后的最小事实。

禁止：

- openid、手机号、设备标识；
- stable subject；
- raw score、seed、choice trace；
- evening note；
- 未授权事项；
- provider raw request/response。

Provider 激活条件：

- 存在 data_handling_profile；
- training 设置符合要求；
- retention、删除能力、区域和合同证据已确认。

## 6. 第三方与受托方核验

| 接收方 | 用途 | 必须确认 |
|---|---|---|
| 微信平台 | 登录、会话、平台能力 | 平台规则、字段范围、合同状态 |
| AI Provider | 受控表达生成 | 区域、训练策略、保留、删除能力 |
| 云存储/日志服务 | 技术运行 | 脱敏、访问控制、TTL |

跨境状态：

- MVP 不假设存在跨境；
- 上线前必须根据实际 Provider 和基础设施重新核验。

## 7. 保存与删除

继承 ADR-0005：

| 类别 | 保存 | 删除 |
|---|---|---|
| Account/Profile | 活跃期间及策略期限 | ACCOUNT |
| DAY 数据 | 产品记录期限 | DAY/ACCOUNT |
| Matter/Memory | 授权有效期间 | MATTER |
| Safety | 最小受限期限 | restricted |
| Provider | 最长30天 | provider |
| Backup | 最长35天隔离过期 | backup |

删除顺序：

1. 创建删除阻断；
2. 停止读取、生成、通知、分享；
3. 清理在线数据；
4. 跟踪 Provider/Backup 到期；
5. 防止恢复复活。

## 8. 用户权利

| 权利 | API |
|---|---|
| 查看 | 对应白名单 View |
| 更正 | profile/checkin/matter revision command |
| 导出 | data-rights/export |
| 删除 | DAY/MATTER/RELATIONSHIP/ACCOUNT |
| 撤回同意 | consent/withdraw |

## 9. Analytics 白名单边界

允许：

- 产品日期；
- 功能状态；
- 匿名聚合结果；
- 脱敏性能和稳定性指标。

禁止：

- 原始自由文本；
- evening note；
- Safety 原文；
- 事项内容组合画像；
- Prompt/provider 输入。

## 10. 验证场景

| 场景 | 预期 |
|---|---|
| 撤回 memory grant | 后续上下文不使用 source |
| 删除 DAY | 派生、缓存、队列不可复活 |
| Provider 删除失败 | 保持限制状态并持续追踪 |
| 备份恢复 | 应用 deletion ledger，拒绝旧数据恢复 |
| Safety 输入 | 不进入普通 AI/analytics |
| 日志审计 | 无原文、无敏感字段 |

## 11. 未决项

- 实际云厂商、微信合同、Provider、跨境状态上线前确认；
- 不在 S-21 输出最终隐私政策或法律意见；
- 不提前定义 S-24 埋点字典。
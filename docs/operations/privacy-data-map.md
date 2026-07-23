# DailyEnergy 隐私数据地图

- **文档状态**：Draft
- **所属任务**：S-21 — 隐私数据地图
- **最后更新**：2026-07-23
- **范围**：Phase 0B 开发前详细规格
- **目的**：将已接受的产品、AI、领域、数据库、API 与保存删除规则映射为可审计的数据流。

## 1. 原则

DailyEnergy 仅处理一分钟陪伴体验所必需的数据。数据地图不是新增采集清单，也不改变已接受 ADR、Schema、API 或数据库设计。

核心规则：

- 数据来源必须明确；
- 用途必须绑定；
- 客户端只接收白名单 View；
- 自由文本默认高约束处理；
- 删除优先于派生、缓存、生成和分析；
- 未明确授权的数据不进入 AI、memory、analytics。

## 2. 数据分类

| ID | 数据主体 | 数据 | 分类 | 敏感级别 | 类型 | 处理目的 |
|---|---|---|---|---|---|---|
| PDM-ACCOUNT-001 | 用户 | 微信身份映射、账户引用 | 身份信息 | 高 | 权威事实 | 建立账户与会话 |
| PDM-PROFILE-001 | 用户 | 称呼、表达风格 | 基本资料 | 中 | 用户提供 | 个性化表达 |
| PDM-DAILY-001 | 用户 | mood、energy、sleep 签到 | 使用状态 | 中 | 用户提供/结构化 | 今日反馈与趋势 |
| PDM-INTERACTION-001 | 用户 | 点亮、任务、帮助度 | 行为记录 | 中 | 派生/用户行为 | 连续体验 |
| PDM-MATTER-001 | 用户 | 重要事项标题与状态 | 用户内容 | 高 | 自由文本 | 用户主动记忆 |
| PDM-EVENING-001 | 用户 | evening note | 用户内容 | 高 | 自由文本 | 晚间反馈 |
| PDM-SAFETY-001 | 用户 | Safety 最小事件 | 受限证据 | 高 | 运行证据 | 安全流程 |
| PDM-GENERATION-001 | 用户 | 生成结果与版本信息 | 派生内容 | 中 | 系统生成 | 展示今日内容 |

## 3. 入口、来源和去向映射

| 数据 ID | 收集入口 | API/View | 权威来源 | 存储区域 | 主要访问者 |
|---|---|---|---|---|---|
| ACCOUNT-001 | 微信登录 | auth/session、bootstrap | UserAccount / ExternalIdentity | app_* | 会话服务 |
| PROFILE-001 | 首次认识、资料设置 | ProfileView | UserProfile Revision | app_* | 资料服务 |
| DAILY-001 | 晨间签到 | CheckinView | MorningCheckin | app_* | Daily 服务 |
| MATTER-001 | 事项管理 | MatterView | ImportantMatter | app_* | Matter 服务 |
| SAFETY-001 | 安全入口 | SafetyView | restricted_* | restricted_* | Safety 专用角色 |
| GENERATION-001 | 今日页面 | TodayView | PublishedDailyResult | app_* | 展示服务 |

## 4. AI 与第三方流转

### AI Provider

允许发送：

- 已批准结构化表达输入；
- 必要版本信息；
- 安全投影后的最小事实。

禁止发送：

- openid、手机号、stable subject；
- root seed、raw score；
- evening note；
- 未授权事项；
- provider raw body。

Provider 数据处理要求：

- 使用已审核 data_handling_profile；
- training 必须关闭；
- 服务端保留最长 30 天；
- 不满足条件不得 ACTIVE。

### 微信平台

仅用于身份、会话和平台能力，不作为业务画像来源。

## 5. 保存与删除

继承 ADR-0005：

| 数据 | 保存规则 | 删除范围 |
|---|---|---|
| 账户身份 | 活跃期间；24个月无主动使用触发 ACCOUNT 删除 | ACCOUNT |
| 日记录 | 账户活跃期间；用户可删除 | DAY / ACCOUNT |
| 事项与记忆依赖 | 授权有效期间 | MATTER |
| Safety 证据 | 最小受限期限 | restricted |
| Provider 数据 | 最长30天 | provider |
| 备份 | 最长35天隔离过期 | backup |

删除流程必须先阻断普通读取、生成、通知、分享和缓存，再执行物理清理。

## 6. 用户权利入口

| 权利 | 入口 |
|---|---|
| 查看 | 数据管理页、对应 View |
| 更正 | profile/checkin/matter revision 命令 |
| 导出 | data-rights/export |
| 删除 | DAY、MATTER、RELATIONSHIP_DATA、ACCOUNT 删除流程 |
| 撤回同意 | consent/withdraw |

## 7. Analytics 白名单边界

允许未来 S-24 使用：

- 产品日期；
- 功能使用状态；
- 匿名化聚合结果；
- 脱敏性能和稳定性指标。

禁止：

- 原始自由文本；
- evening note；
- Safety 原文；
- 称呼、事项内容组合画像；
- AI Prompt 或 provider 输入。

## 8. 验证场景

| 场景 | 预期 |
|---|---|
| 用户撤回记忆授权 | 后续生成不再使用对应 source |
| 删除 DAY | 派生结果、缓存、队列不可继续使用 |
| Provider 删除失败 | 保持受限，不恢复普通使用 |
| 备份恢复 | 先应用 deletion ledger，禁止旧数据复活 |
| Safety 输入 | 不进入普通 AI 和 analytics |
| 日志检查 | 无自由文本和敏感字段 |

## 9. 未决项

- 实际云厂商、对象存储、微信合同和跨境状态需上线前确认；
- 不在本阶段确定法律隐私政策文本；
- 不提前创建埋点字典。

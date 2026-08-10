# DailyEnergy 项目 Backlog

- **文档状态**：Active
- **最后更新**：2026-08-05
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：[E-012 开发环境部署](./current.md)（In Review：草稿 PR #121，公网 TLS 等待 ICP）
- **路线图**：[ROADMAP.md](../ROADMAP.md)

## 1. Backlog 规则

- 本文件保存有序候选任务，不表示所有任务已经承诺；
- 同一时间只有 tasks/current.md 中一个任务可以是 Ready 或 In Progress；
- 任务进入执行前必须确认依赖和上游文档；
- 每个任务应能在一个主要 PR 中验收；
- 发现任务过大时先拆分，再开始编码；
- 新需求先进入 Backlog，不自动插入当前任务；
- 安全、隐私、数据丢失和阻塞性缺陷可以提高优先级；
- 改变产品定位、技术栈或关键边界需要 ADR；
- 每个里程碑结束后重排后续任务；
- 具体时间估算在 S-34 拆分 Phase 1～3 工程 Issues 时补充。

状态：

- Done：已确认完成；
- In Progress：唯一当前任务正在执行；
- In Review：PR 等待审核；
- Ready：唯一下一任务；
- Planned：已排序但未开始；
- Blocked：缺少依赖或决定；
- Later：暂不承诺；
- Rejected：明确不做。

## 2. Phase 0A：产品基线

| ID    | 任务              | 状态 | 交付                    |
| ----- | ----------------- | ---- | ----------------------- |
| P-001 | 产品愿景与边界    | Done | docs/product/vision.md  |
| P-002 | 首批用户画像      | Done | docs/product/persona.md |
| P-003 | 连续 7 天用户旅程 | Done | docs/product/journey.md |
| P-004 | 第一阶段 MVP      | Done | docs/product/mvp.md     |
| P-005 | 数字朋友人格      | Done | docs/ai/personality.md  |
| P-006 | 产品定位决策      | Done | ADR-0001                |

## 3. Phase 0B：开发前详细规格

### 项目控制

| ID   | 任务                       | 状态 | 主要交付                                         | 依赖     |
| ---- | -------------------------- | ---- | ------------------------------------------------ | -------- |
| S-01 | 长期路线图和项目控制系统   | Done | ROADMAP、INDEX、AGENTS、tasks、README            | Phase 0A |
| S-02 | 信息架构与页面地图         | Done | information-architecture、screen-inventory       | S-01     |
| S-03 | 交互状态与页面规格         | Done | screen-specs、interaction-states、content-layout | S-02     |
| S-04 | 可点击原型与首次可用性测试 | Done | prototype、5～8 人测试计划与结果模板             | S-03     |

### 业务状态与内容契约

| ID   | 任务                           | 状态 | 主要交付                        | 依赖       |
| ---- | ------------------------------ | ---- | ------------------------------- | ---------- |
| S-05 | 产品状态机                     | Done | docs/product/state-machine.md   | S-03、S-04 |
| S-06 | 点亮、跨日、中断与通知业务规则 | Done | docs/product/business-rules.md  | S-05       |
| S-07 | 今日内容 Schema                | Done | docs/ai/daily-content-schema.md | S-05       |
| S-08 | 晚间反馈与七天总结 Schema      | Done | feedback、weekly-summary Schema | S-07       |
| S-09 | 共享 Schema 草案               | Done | packages/shared-schemas         | S-07、S-08 |

### 稳定生成与 AI

| ID   | 任务                   | 状态 | 主要交付                              | 依赖                 |
| ---- | ---------------------- | ---- | ------------------------------------- | -------------------- |
| S-10 | 稳定种子与产品日期决策 | Done | ADR-0002                              | S-05                 |
| S-11 | 规则引擎规范           | Done | generation-engine、scoring-rules      | S-07、S-10           |
| S-12 | AI Gateway 决策与规范  | Done | ADR-0003、gateway.md                  | S-07、S-11           |
| S-13 | Prompt 规范            | Done | prompt-spec.md                        | S-12、personality    |
| S-14 | 结构化记忆决策与规范   | Done | ADR-0004、memory.md                   | S-05、S-07、S-13     |
| S-15 | 内容安全规范           | Done | safety.md                             | personality、schemas |
| S-16 | AI 质量评价与回归测试  | Done | evaluation.md、evaluation-corpus.json | S-13、S-15           |

### 数据、接口与隐私

| ID   | 任务                   | 状态 | 主要交付                     | 依赖             |
| ---- | ---------------------- | ---- | ---------------------------- | ---------------- |
| S-17 | 领域模型               | Done | domain-model.md              | S-05～S-09、S-14 |
| S-18 | 数据保存和删除决策     | Done | ADR-0005                     | S-17             |
| S-19 | 数据库规格             | Done | database.md、Prisma 草案     | S-17、S-18       |
| S-20 | API 契约               | Done | api.md、error-codes、OpenAPI | S-09、S-19       |
| S-21 | 隐私数据地图           | Done | privacy-data-map.md          | S-17～S-20       |
| S-22 | 内容审核和用户支持流程 | Done | moderation、support          | S-15、S-21       |
| S-23 | 故障和安全事件响应     | Done | incident-response.md         | S-15、S-21       |

### 数据分析与实验

| ID   | 任务         | 状态 | 主要交付               | 依赖             |
| ---- | ------------ | ---- | ---------------------- | ---------------- |
| S-24 | 埋点事件字典 | Done | event-tracking.md      | S-02、S-05、S-20 |
| S-25 | 指标唯一口径 | Done | metrics.md             | S-24             |
| S-26 | 实验规范     | Done | experiments.md         | S-25             |
| S-27 | 渠道归因规范 | Done | channel-attribution.md | S-24、S-25、S-26 |

### 工程架构与执行拆分

| ID   | 任务                   | 状态 | 主要交付                                                   | 依赖                   |
| ---- | ---------------------- | ---- | ---------------------------------------------------------- | ---------------------- |
| S-28 | Monorepo 与技术栈决策  | Done | ADR-0006                                                   | 主要业务规格           |
| S-29 | 系统架构               | Done | architecture.md                                            | S-12、S-19、S-20、S-28 |
| S-30 | 仓库结构和模块边界     | Done | repository-structure.md                                    | S-29                   |
| S-31 | 测试策略               | Done | testing.md                                                 | S-09、S-16、S-20、S-29 |
| S-32 | 部署、配置和回滚       | Done | deployment.md                                              | S-29、S-31             |
| S-33 | 可观测性和成本监控     | Done | observability.md                                           | S-25、S-29、S-32       |
| S-34 | Phase 1～3 工程 Issues | Done | 3 个 GitHub Milestones、48 个 Issues                       | S-01～S-33             |
| S-35 | Phase 0B Gate 评审     | Done | [Phase 0B Gate 评审报告](../docs/reports/phase-0b-gate.md) | S-34                   |

S-35 已获用户确认，[Phase 0B Gate](../docs/reports/phase-0b-gate.md) 结论为 Accepted `GO`；Phase 0B 已结束。[E-001](https://github.com/WeiHan1996/DailyEnergy/issues/39)～[E-011](https://github.com/WeiHan1996/DailyEnergy/issues/48) 与 [E-015](https://github.com/WeiHan1996/DailyEnergy/issues/105) 已完成并进入 Done。E-011 已随 PR #119 squash 合并为 `266a7dc39b87aec23740d64656bf33081a3aa34b`，Issue #48 已关闭；E-012 是唯一当前任务，DEV 基础设施与 ADR-0007 同机例外已获授权，草稿 PR #121 已进入 In Review。

## 4. Phase 1：工程基础

| ID                                                            | 任务                                       | 状态        | 主要结果                                             |
| ------------------------------------------------------------- | ------------------------------------------ | ----------- | ---------------------------------------------------- |
| [E-001](https://github.com/WeiHan1996/DailyEnergy/issues/39)  | 初始化 TypeScript Monorepo                 | Done        | Workspace、包管理和统一脚本                          |
| [E-002](https://github.com/WeiHan1996/DailyEnergy/issues/41)  | 代码质量基线                               | Done        | TypeScript、ESLint、Prettier、提交规范               |
| [E-003](https://github.com/WeiHan1996/DailyEnergy/issues/40)  | NestJS API 骨架                            | Done        | 配置、错误、健康检查和日志                           |
| [E-004](https://github.com/WeiHan1996/DailyEnergy/issues/42)  | 微信小程序骨架                             | Done        | 原生小程序、TypeScript、路由和环境                   |
| [E-005](https://github.com/WeiHan1996/DailyEnergy/issues/43)  | Next.js 管理后台骨架                       | Done        | 登录外壳和基础布局                                   |
| [E-006](https://github.com/WeiHan1996/DailyEnergy/issues/44)  | PostgreSQL 与 Prisma                       | Done        | 初始 Schema、迁移和测试数据；PR #108 安全返工        |
| [E-007](https://github.com/WeiHan1996/DailyEnergy/issues/45)  | Redis 与 BullMQ                            | Done        | 缓存、队列和连接管理                                 |
| [E-008](https://github.com/WeiHan1996/DailyEnergy/issues/46)  | 统一 Zod Schema、OpenAPI 与生成 API Client | Done        | client-safe Schema、OpenAPI、生成客户端与 drift Gate |
| [E-009](https://github.com/WeiHan1996/DailyEnergy/issues/47)  | 本地 Docker Compose                        | Done        | 可重复本地环境                                       |
| [E-010](https://github.com/WeiHan1996/DailyEnergy/issues/49)  | 测试骨架                                   | Done        | 单元、集成、契约和端到端                             |
| [E-011](https://github.com/WeiHan1996/DailyEnergy/issues/48)  | CI                                         | Done        | 11/11 Gate、365 天 retention 与临时合并控制          |
| [E-012](https://github.com/WeiHan1996/DailyEnergy/issues/50)  | 开发环境部署                               | In Progress | PR #128；修复旧 release secret bind 容器复用         |
| [E-013](https://github.com/WeiHan1996/DailyEnergy/issues/51)  | 日志与监控基线                             | Planned     | 脱敏日志、指标和告警                                 |
| [E-014](https://github.com/WeiHan1996/DailyEnergy/issues/52)  | Phase 1 Gate                               | Planned     | 环境可重复、CI 通过、服务可访问                      |
| [E-015](https://github.com/WeiHan1996/DailyEnergy/issues/105) | Agent 上下文路由与分级验证入口             | Done        | P0/P1 上下文路由、任务 Profile 与安静验证            |

E-004 已随 PR #96 合并，E-008 已随 PR #97 squash 合并，E-005 已随 PR #98
合并，E-015 已随 PR #106 squash 合并。E-006 已随 PR #110/#111 完成，E-007 已随
PR #113 完成，状态 PR #114 已 squash 合并；E-009 已随 PR #115 squash 合并并完成
merged-main 验证。E-010 已随 PR #117 squash 合并并进入 Done；E-011 的 security 人工复核、
11/11 自动 Gate、365 天 retention 与 Accepted testing 22.2 临时补偿控制均已完成，PR #119
已 squash 合并为 `266a7dc39b87aec23740d64656bf33081a3aa34b`。E-012 Issue #50 的代码前置已
满足；腾讯云上海临时 DEV、SSH 部署身份、PostgreSQL 18/Redis 8 同机例外、不用 NAS，以及上海
私有 COS `dev/objects/` application object endpoint 已获用户授权。Accepted ADR-0007 记录了
disposable synthetic state、最小 CAM 权限、生命周期与迁移退出边界；专用 CAM 策略、root-only
凭证、内网 DNS/TLS 与 signed write/read/delete smoke 已通过。五角色 digest publication、source-free
deployment bundle、root-only 原子安装、18 阶段顺序发布、唯一 N-1 rollback 和 loopback TLS Runbook
已进入 main；PR #127 的 file secret materialization 已通过固定 Linux Gate、publication 与真实安装。首次真实
Compose 发布证明相同 service hash 会复用仍指向旧 release secret source 的容器；当前修复限定为所有服务
`up` 阶段强制重建，数据库 migration 尚未执行且没有 Accepted release state。域名 ICP、DNS/TLS 和
STAGING/PRODUCTION 独立状态服务仍为外部 Gate；E-013 与其它
任务继续 Planned。

## 5. Phase 2：确定性核心闭环

### 5.1 正式视觉设计前置

| ID                                                            | 任务                                  | 状态    | 主要结果                                   |
| ------------------------------------------------------------- | ------------------------------------- | ------- | ------------------------------------------ |
| [D-001](https://github.com/WeiHan1996/DailyEnergy/issues/99)  | 确定品牌与视觉方向                    | Planned | 三套方向板、最终方向和视觉反模式           |
| [D-002](https://github.com/WeiHan1996/DailyEnergy/issues/100) | 建立设计系统与 Design Tokens          | Planned | Figma Variables、组件库和代码 Token 交付   |
| [D-003](https://github.com/WeiHan1996/DailyEnergy/issues/101) | 完成核心流程高保真设计                | Planned | 核心流程八页及关键状态                     |
| [D-004](https://github.com/WeiHan1996/DailyEnergy/issues/102) | 完成高保真原型、验证与开发交付        | Planned | 核心原型回归、Frame ID、视觉 QA 和开发交付 |
| [D-005](https://github.com/WeiHan1996/DailyEnergy/issues/104) | 完成 Phase 2 剩余页面高保真与开发交付 | Planned | 晚间、趋势、数据权利页面与状态开发交付     |

依赖链为 `D-001 → D-002 → D-003 → D-004 → D-005`。D-001～D-005 只是纳入
Backlog，不自动变为 Ready 或开始设计。

- D-004 是 C-003、C-004、C-009 的直接前置；
- C-003：C-002、E-004、D-004；
- C-004：C-002、C-003、E-006、D-004；
- C-009：C-003、C-004、C-008、E-004、D-004；
- D-005 是 C-012、C-013、C-014 的直接前置；
- C-012：C-004、C-010、C-011、D-005；
- C-013：C-011、C-012、D-005；
- C-014：C-001、C-002、C-008、C-010、C-011、C-012、C-013、D-005。

### 5.2 确定性核心实现

| ID                                                           | 任务               | 状态    | 主要结果               |
| ------------------------------------------------------------ | ------------------ | ------- | ---------------------- |
| [C-001](https://github.com/WeiHan1996/DailyEnergy/issues/53) | 微信身份与会话     | Planned | 唯一用户和安全会话     |
| [C-002](https://github.com/WeiHan1996/DailyEnergy/issues/54) | 隐私同意与用户资料 | Planned | 最小授权和可修改资料   |
| [C-003](https://github.com/WeiHan1996/DailyEnergy/issues/55) | 首次认识           | Planned | 称呼和表达偏好         |
| [C-004](https://github.com/WeiHan1996/DailyEnergy/issues/56) | 每日签到           | Planned | 情绪、精力和睡眠       |
| [C-005](https://github.com/WeiHan1996/DailyEnergy/issues/57) | 稳定种子           | Planned | 用户、日期和版本驱动   |
| [C-006](https://github.com/WeiHan1996/DailyEnergy/issues/58) | 规则引擎           | Planned | 五维状态和行动候选     |
| [C-007](https://github.com/WeiHan1996/DailyEnergy/issues/59) | 本地模板内容       | Planned | 无 AI 完整今日结果     |
| [C-008](https://github.com/WeiHan1996/DailyEnergy/issues/62) | 今日结果幂等与缓存 | Planned | 并发唯一、重复读取     |
| [C-009](https://github.com/WeiHan1996/DailyEnergy/issues/60) | 今日内容页面       | Planned | 结构化展示和回看       |
| [C-010](https://github.com/WeiHan1996/DailyEnergy/issues/61) | 行动任务           | Planned | 一个主要行动和可选任务 |
| [C-011](https://github.com/WeiHan1996/DailyEnergy/issues/63) | 点亮与连续记录     | Planned | 幂等、不惩罚中断       |
| [C-012](https://github.com/WeiHan1996/DailyEnergy/issues/64) | 晚间反馈           | Planned | 真实状态和帮助度       |
| [C-013](https://github.com/WeiHan1996/DailyEnergy/issues/70) | 七天趋势           | Planned | 真实数据和缺失处理     |
| [C-014](https://github.com/WeiHan1996/DailyEnergy/issues/65) | 数据查看与删除     | Planned | 用户权利闭环           |
| [C-015](https://github.com/WeiHan1996/DailyEnergy/issues/68) | 核心埋点           | Planned | D1/D3/D7 可计算        |
| [C-016](https://github.com/WeiHan1996/DailyEnergy/issues/66) | 核心端到端测试     | Planned | 首次到七天全路径       |
| [C-017](https://github.com/WeiHan1996/DailyEnergy/issues/69) | Phase 2 Gate       | Planned | 不依赖 AI 完成核心闭环 |

## 6. Phase 3：AI 陪伴层

| ID                                                            | 任务               | 状态    | 主要结果              |
| ------------------------------------------------------------- | ------------------ | ------- | --------------------- |
| [AI-001](https://github.com/WeiHan1996/DailyEnergy/issues/67) | AI Gateway 基础    | Planned | 统一供应商调用        |
| [AI-002](https://github.com/WeiHan1996/DailyEnergy/issues/71) | 主模型与备用模型   | Planned | 超时、重试和熔断      |
| [AI-003](https://github.com/WeiHan1996/DailyEnergy/issues/72) | Prompt 版本管理    | Planned | 可追踪输入和输出      |
| [AI-004](https://github.com/WeiHan1996/DailyEnergy/issues/73) | 结构化输出校验     | Planned | Schema 失败不可展示   |
| [AI-005](https://github.com/WeiHan1996/DailyEnergy/issues/74) | 三种表达偏好       | Planned | 同一人格不同语气      |
| [AI-006](https://github.com/WeiHan1996/DailyEnergy/issues/75) | 本地模板降级       | Planned | 模型故障仍可完成      |
| [AI-007](https://github.com/WeiHan1996/DailyEnergy/issues/76) | 关系阶段           | Planned | 第 1、3、7 天连续性   |
| [AI-008](https://github.com/WeiHan1996/DailyEnergy/issues/77) | 重要事项           | Planned | 用户主动添加和删除    |
| [AI-009](https://github.com/WeiHan1996/DailyEnergy/issues/78) | 结构化记忆         | Planned | 来源、用途和有效期    |
| [AI-010](https://github.com/WeiHan1996/DailyEnergy/issues/79) | 第 3 天风格校准    | Planned | 反馈影响后续表达      |
| [AI-011](https://github.com/WeiHan1996/DailyEnergy/issues/84) | 七天 AI 总结       | Planned | 只引用真实数据        |
| [AI-012](https://github.com/WeiHan1996/DailyEnergy/issues/82) | 内容安全分类       | Planned | 专业边界与敏感内容    |
| [AI-013](https://github.com/WeiHan1996/DailyEnergy/issues/86) | 高风险固定响应     | Planned | 退出普通运势流程      |
| [AI-014](https://github.com/WeiHan1996/DailyEnergy/issues/81) | 自动人格评价       | Planned | 质量评分和回归        |
| [AI-015](https://github.com/WeiHan1996/DailyEnergy/issues/85) | 人工内容抽检       | Planned | 样本和问题分类        |
| [AI-016](https://github.com/WeiHan1996/DailyEnergy/issues/80) | 延迟、Token 和成本 | Planned | 达到 MVP 工程目标     |
| [AI-017](https://github.com/WeiHan1996/DailyEnergy/issues/83) | Phase 3 Gate       | Planned | AI 稳定、安全、可降级 |

## 7. Phase 4：内部 Alpha

| ID    | 任务                     | 状态    | 主要结果                                |
| ----- | ------------------------ | ------- | --------------------------------------- |
| A-001 | Alpha 真机视觉验收与修订 | Planned | 基于 D-005 基线完成真机一致性与回归修订 |
| A-002 | 弱网、加载和错误体验     | Planned | 异常流程可恢复                          |
| A-003 | 分享卡片                 | Planned | 默认保护隐私                            |
| A-004 | 用户自选提醒             | Planned | 克制召回                                |
| A-005 | 最小管理后台             | Planned | Prompt、模板和运行观察                  |
| A-006 | 用户反馈入口             | Planned | 问题分类与处理                          |
| A-007 | 数据删除演练             | Planned | 端到端验证                              |
| A-008 | 安全与故障演练           | Planned | 固定流程可执行                          |
| A-009 | 10～20 人 Alpha          | Planned | 至少一个完整七天窗口                    |
| A-010 | Alpha 报告               | Planned | 缺陷、留存和内容结论                    |
| A-011 | Phase 4 Gate             | Planned | 进入 Beta 或继续修复                    |

## 8. Phase 5：种子 Beta

| ID    | 任务            | 状态    | 主要结果               |
| ----- | --------------- | ------- | ---------------------- |
| B-001 | 小红书素材组    | Planned | 多种真实价值叙事       |
| B-002 | 抖音素材组      | Planned | 短视频流程展示         |
| B-003 | 渠道承接页      | Planned | 素材与产品一致         |
| B-004 | 种子用户筛选    | Planned | 50～100 名目标用户     |
| B-005 | 内测同意与支持  | Planned | 反馈和退出流程         |
| B-006 | 14 天 Beta 运行 | Planned | 完整数据窗口           |
| B-007 | 每周数据复盘    | Planned | 漏斗、渠道和内容       |
| B-008 | 用户访谈        | Planned | 首次和回访真实原因     |
| B-009 | 内容与安全抽检  | Planned | 风险和人格一致         |
| B-010 | Beta 决策报告   | Planned | 继续、调整或停止       |
| B-011 | Phase 5 Gate    | Planned | 进入留存迭代或重新验证 |

## 9. Phase 6：留存迭代候选

以下任务根据 Beta 证据选择，当前不全部承诺。

| ID    | 任务           | 状态  | 触发条件           |
| ----- | -------------- | ----- | ------------------ |
| R-001 | 首次流程减负   | Later | 首次完成低         |
| R-002 | 第二天期待优化 | Later | 首次完成高、D1 低  |
| R-003 | 内容重复控制   | Later | D3 尚可、D7 低     |
| R-004 | 行动建议优化   | Later | 帮助度或任务完成低 |
| R-005 | 记忆出现频率   | Later | 关系感低或引用不适 |
| R-006 | 中断回流       | Later | 回访用户流失       |
| R-007 | 七天总结优化   | Later | 趋势查看高、价值低 |
| R-008 | 周报和月报     | Later | 用户需要长期回望   |
| R-009 | 专属来信       | Later | 关系感有稳定信号   |
| R-010 | 职场阶段细分   | Later | 样本显示显著差异   |
| R-011 | 渠道定位调整   | Later | 点击高、留存低     |
| R-012 | 第二轮 Beta    | Later | 完成关键调整       |

## 10. Phase 7：增长与商业化候选

只有留存和关系价值成立后进入。

| ID    | 任务           | 状态  | 前置条件                 |
| ----- | -------------- | ----- | ------------------------ |
| G-001 | 自然分享增长   | Later | 分享动机真实且隐私安全   |
| G-002 | 内容矩阵       | Later | 渠道用户质量可持续       |
| G-003 | 主题和视觉权益 | Later | 不影响免费核心体验       |
| G-004 | 长期报告权益   | Later | 用户愿意长期回看         |
| G-005 | 专属来信权益   | Later | 关系感已验证             |
| G-006 | 会员方案实验   | Later | 价值和成本口径明确       |
| G-007 | 付费安全评审   | Later | 无恐惧和脆弱性利用       |
| G-008 | 单位经济模型   | Later | 获客、模型和服务成本可算 |
| G-009 | 商业化 Gate    | Later | 付费不伤害留存和信任     |

## 11. 明确拒绝的方向

| ID    | 方向                         | 状态     | 原因                 |
| ----- | ---------------------------- | -------- | -------------------- |
| X-001 | 无限 AI 聊天作为 MVP 主入口  | Rejected | 违背一分钟和稳定边界 |
| X-002 | 专业八字、星盘、塔罗排盘     | Rejected | 非当前定位和能力     |
| X-003 | 虚拟恋爱与排他性关系         | Rejected | 依赖和安全风险       |
| X-004 | 断签清零与补签付费           | Rejected | 制造焦虑             |
| X-005 | 付费改变好运和“化解”         | Rejected | 恐惧商业化           |
| X-006 | 社区和陌生人互动             | Rejected | 非核心验证           |
| X-007 | 自研模型                     | Rejected | 过早且无必要         |
| X-008 | 过早微服务化                 | Rejected | 增加复杂度           |
| X-009 | 未经授权抓取外部个人数据     | Rejected | 隐私和信任风险       |
| X-010 | 用运势给医疗、投资和法律结论 | Rejected | 专业越界             |

如果要重新考虑 Rejected 方向，必须有新证据并创建 ADR。

## 12. 新任务模板

新增 Backlog 项时至少写明：

- ID；
- 问题或目标；
- 所属阶段；
- 优先级；
- 依赖；
- 交付物；
- 验收标准；
- 不做事项；
- 风险；
- 是否需要 ADR；
- 是否包含外部状态变更。

没有这些信息的想法先记录为候选，不进入 Ready。

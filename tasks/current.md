# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-20
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-09
- **当前任务名称**：共享 Schema 草案
- **任务状态**：In Review
- **优先级**：最高
- **代码工作**：允许，但只限可执行共享 Schema、类型、示例与契约测试
- **当前分支**：`agent/shared-schemas`
- **关联 PR**：[#12](https://github.com/WeiHan1996/DailyEnergy/pull/12)
- **路线图**：[ROADMAP.md](../ROADMAP.md)
- **文档索引**：[docs/INDEX.md](../docs/INDEX.md)
- **完整 Backlog**：[tasks/backlog.md](./backlog.md)

## 1. 当前目标

把三份已接受的文档级契约转换为一个自包含、可运行、可测试的 TypeScript + Zod 共享包：

- [今日内容 Schema](../docs/ai/daily-content-schema.md)；
- [晚间反馈 Schema](../docs/ai/evening-feedback-schema.md)；
- [七天趋势与总结 Schema](../docs/ai/weekly-summary-schema.md)。

本任务建立运行时校验、推断类型、JSON Schema 导出和契约测试，使后续规则引擎、AI Gateway、数据库、API、微信小程序与管理后台不能各自发明字段。

本任务不是正式产品业务实现。不得创建页面、API 服务、数据库、规则算法、Prompt 或 AI 调用。

## 2. 必须交付

### packages/shared-schemas

至少包含：

- 独立 package.json；
- TypeScript 配置；
- src/common.ts：ID、日期、时间、版本、字符和纯文本约束；
- src/daily-content.ts：今日输入、规则事实、表达、发布结果和客户端视图；
- src/evening-feedback.ts：提交、patch、反馈记录和客户端视图；
- src/weekly-summary.ts：源快照、聚合事实、表达、发布结果和客户端视图；
- src/index.ts：稳定公共导出；
- JSON Schema 导出入口或注册表；
- 契约示例/fixtures；
- 正向与负向测试；
- README：边界、使用方式、版本和下游约束。

如果为了可维护性需要拆分更多文件，可以在 packages/shared-schemas 内进行，但不能建立未经决策的整个 Monorepo 骨架。

## 3. 上游必读文档

按顺序读取：

1. [AGENTS.md](../AGENTS.md)；
2. [README.md](../README.md)；
3. [ROADMAP.md](../ROADMAP.md)；
4. [docs/INDEX.md](../docs/INDEX.md)；
5. [产品状态机](../docs/product/state-machine.md)；
6. [业务规则](../docs/product/business-rules.md)；
7. [页面规格](../docs/design/screen-specs.md)；
8. [交互状态](../docs/design/interaction-states.md)；
9. [内容布局](../docs/design/content-layout.md)；
10. [人格手册](../docs/ai/personality.md)；
11. [今日内容 Schema](../docs/ai/daily-content-schema.md)；
12. [晚间反馈 Schema](../docs/ai/evening-feedback-schema.md)；
13. [七天趋势与总结 Schema](../docs/ai/weekly-summary-schema.md)。

## 4. 已接受且不得重开的决策

- TypeScript 与 Zod 是共享运行时契约的默认技术；
- 文档级契约仍是产品语义来源，可执行 Schema 不得缩小安全和隐私边界；
- 所有外部输入使用严格对象，未知字段默认拒绝；
- 已发布对象不接受 null、空字符串或占位值；
- 日期归属使用 product_date，时间戳不能替代；
- Unicode 展示字符按用户感知字符计数；
- 生成文本是单行简体中文纯文本，不执行 Markdown、HTML、URL 或代码；
- 规则事实、AI 表达、内部发布对象、客户端视图和行为状态是不同类型；
- AI 不能修改稳定 ID、分数、档位、排序、行动或聚合事实；
- 客户端内部对象必须显式白名单投影，不能通过黑名单裁剪；
- 晚间反馈、帮助度和任务是独立权威事实；
- 晚间 note 默认不进入 AI、周总结、日志和分析；
- 七天窗口恰好七个连续产品日期，缺失日期不压缩、不补齐；
- 每个状态指标 observed + unsure + missing 必须等于 7；
- 1～2 个观察不能产生方向，UNSURE 不进入有序计算；
- 更正或删除会失效依赖的周总结；
- 主模型、备用模型和模板必须通过同一表达 Schema；
- Safety/Schema 失败不能局部拼出普通内容。

## 5. 必须固化的可执行约束

### 通用

- 对象默认 strict；
- 枚举使用稳定 token，不接受显示文案；
- opaque ID 非空、有明确上限且不包含空白控制字符；
- product_date 必须是实际存在的 YYYY-MM-DD 日期；
- RFC 3339 时间可解析且必须带时区；
- semver 和版本 token 有边界；
- 展示字符使用 Intl.Segmenter 或语义等价实现；
- 禁止 null、空白字符串、换行、URL、HTML、Markdown 和文本 emoji 的字段明确实现；
- 错误路径足够精确，可以定位到数组项或字段。

### 今日内容

- 五维 ID 固定且恰好五项；
- canonical order、display order、focus 和唯一性校验；
- 内部分数为 0～100 整数，客户端视图不含 score；
- selected_action_id 必须引用候选；
- action/task/ritual ID 在 facts、expression 和 client view 中一致；
- 每个字段和核心/全文字符预算同时校验；
- PublishedDailyResult 与 ClientDailyContentView 使用不同 Schema；
- provenance、source dependencies 和 privacy fallbacks 不进入客户端。

### 晚间反馈

- SET/CLEAR note patch 使用判别联合；
- CLEAR 不允许 value，SET 必须 1～80 字；
- expected revisions 为非负整数；
- task patch 可选且引用既有任务；
- overall feeling 与 helpfulness 必需；
- record、revision 和 client view 分开；
- availability、write window 和主操作组合合法；
- 未知字段、null 和部分更新语义有负向测试。

### 七天趋势与总结

- source/client day slots 恰好七项、日期唯一、升序且连续；
- window_start/end 与首尾槽位一致；
- coverage、missing_dates 和真实记录天数互相一致；
- observed + unsure + missing = 7；
- direction 样本门槛和 mode/top kind 最小样本约束；
- 帮助度与任务计数等式；
- expression 每段 fact_refs 数量和正文 120～260 字；
- PublishedWeeklySummary 与客户端视图分开；
- daily score、娱乐五维和 raw notes 不属于周契约；
- source fingerprint、失效和修订字段类型清楚。

## 6. 包边界

本包可以：

- 依赖 Zod；
- 提供 TypeScript 推断类型；
- 导出运行时 parse/safeParse Schema；
- 导出 JSON Schema，供文档、API 或跨语言工具使用；
- 提供纯校验 helper 和测试 fixtures。

本包不得：

- 连接数据库、Redis、队列、网络、文件系统或模型；
- 计算每日分数、七天 direction 或内容选择；
- 生成 AI 文本；
- 包含用户真实数据或生产样本；
- 创建 NestJS DTO、Prisma 模型、微信页面或 Next.js 组件；
- 决定根 workspace、包管理器、CI、统一 ESLint 或 Monorepo 结构；
- 暴露服务端 secret、Prompt、内部规则实现或敏感日志。

根 package.json、pnpm workspace、统一构建与发布由 S-28 / Phase 1 工程任务决定。S-09 的包必须可以在自身目录独立安装与验证。

## 7. 公共 API 原则

- 公共 Schema 使用稳定、可搜索的 PascalCase 名称并以 Schema 结尾；
- 推断类型使用同名去掉 Schema；
- 只从 src/index.ts 暴露下游承诺 API；
- 内部 helper 不因测试方便全部导出；
- 枚举 Schema 和值数组可以共享，但显示中文不进入核心 token；
- 默认导出禁止，避免重命名不一致；
- JSON Schema 导出使用稳定 $id；
- package 版本从 0.x 开始，表示 Phase 0B 草案；
- 破坏性变化必须同步文档、fixtures 和 major/minor 策略。

## 8. JSON Schema 边界

Zod 运行时 Schema 是本任务的校验权威。JSON Schema 用于：

- API/文档工具读取字段；
- 跨语言生成或预校验；
- 固定 $id 和契约版本；
- 发现意外字段与基础格式问题。

跨字段 refinement、Unicode 字符、日期连续、fact_refs 和计数等式如果无法完整表达为 JSON Schema，必须：

1. 仍在 Zod 运行时强制；
2. 在 README 中列出；
3. 通过负向测试证明；
4. 不声称 JSON Schema 单独等价于完整业务校验。

## 9. 测试要求

至少包含：

- 三份 Accepted 文档中的完整正向 JSON 示例；
- 受控模板和个性化减少正向示例；
- 每个根 Schema 的最小合法样例；
- 未知字段、null、空字符串和非法枚举；
- 无效产品日期与无时区时间；
- 五维缺失、重复、错序和 focus 不一致；
- action/task/ritual 引用不一致；
- 单字段与总字符超限；
- note patch 互斥、revision 和原子提交输入；
- 七日数量、日期连续、coverage、missing_dates 和计数等式；
- direction 样本不足；
- mode/top helpful kind 门槛；
- AI 未批准 fact_refs；
- 客户端出现内部 score、provenance、source ID 或 raw notes；
- JSON Schema 导出结构与稳定 $id。

测试必须可以通过一个包内命令运行，并明确报告失败文件和字段路径。

## 10. 验收标准

- packages/shared-schemas 可以独立安装；
- TypeScript 严格编译通过；
- 包构建成功且无隐式 any；
- 所有运行时 Schema 可从公共入口导入；
- TypeScript 类型由 Schema 推断，不维护第二份手写接口；
- 三类契约的正向 fixtures 全部通过；
- 关键负向 fixtures 全部失败且错误路径合理；
- JSON Schema 可以生成且 $id 稳定；
- 包不依赖业务服务、数据库、网络或前端框架；
- 没有 secret、真实用户数据、模型输出或敏感日志；
- 文档映射、已知 JSON Schema 限制和使用示例清楚；
- npm audit 不存在 production high/critical；
- 格式、类型、测试和构建全部通过；
- docs/INDEX.md、tasks/current.md 和 backlog 同步；
- 通过独立 Draft PR 提交；
- 用户确认前不进入 S-10。

## 11. 完成后的下一任务

S-09 被接受后，下一任务为：

- 当前任务 ID：S-10；
- 当前任务名称：稳定种子与产品日期决策；
- 主要交付：ADR-0002；
- 依据：已接受状态机、业务规则与可执行共享 Schema；
- 不开始正式业务页面或服务实现。

## 12. 最近一次交接

- 日期：2026-07-20；
- PR #11 已 squash 合并到 main（`e438b5a`）；
- S-09 已在 `agent/shared-schemas` 完成实现，Draft PR 为 [#12](https://github.com/WeiHan1996/DailyEnergy/pull/12)，状态为 In Review；
- 新增自包含 `packages/shared-schemas`：19 个稳定 JSON Schema 导出、Zod 运行时 Schema、推断类型、Accepted fixtures 与契约测试；
- `npm run validate` 通过：Prettier、严格 TypeScript、34 个测试和构建全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；
- 仓库仍没有根 package.json 或 workspace 文件；没有开始正式前端、后端、数据库、API、规则引擎或 AI 调用；
- 当前没有阻塞项；
- 下一操作：用户审核 PR #12；确认前不进入 S-10；
- 新会话恢复口令：**继续 DailyEnergy 当前任务**。

## 13. 状态更新规则

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
- packages/shared-schemas 在索引中变为 Accepted；
- 更新 docs/INDEX.md；
- 从 Backlog 选择唯一下一任务；
- 将下一任务设为 Ready。


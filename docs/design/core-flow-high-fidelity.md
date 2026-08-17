# D-003 核心流程高保真设计

- **文档状态**：Draft
- **所属任务**：D-003 — 完成核心流程高保真设计（Issue #101）
- **设计方向**：A — Gentle Nature / 01B / DLY-003
- **上游设计系统**：D-002 Accepted
- **Figma 文件**：`T5HS32Ciz6LZh81KbqhFGo`
- **Figma 页面**：`D-003 / Core Flow High Fidelity`（Page ID `220:2`）
- **最后更新**：2026-08-17

## 1. 本轮交付范围

D-003 在不修改 Accepted 信息架构、业务行为、人格、安全、隐私和删除边界的前提下，为以下八个页面/状态建立高保真设计：

- `ENT-001` 承接与产品边界
- `ONB-001` 第一次认识
- `DLY-001` 今日签到
- `DLY-002` 今日生成
- `DLY-003` 今日内容
- `REC-002` 历史日详情
- `SYS-003` 维护与恢复
- `SAFE-001` 固定安全响应

设计继续使用 D-001 已接受的 Gentle Nature 视觉方向，以及 D-002 canonical semantic/component tokens。页面基准宽度为 420px，长内容使用自然滚动，不通过裁切隐藏核心内容。

## 2. Figma Frame ID 索引

| 页面 | 状态 | Frame ID |
| --- | --- | --- |
| ENT-001 | Normal | `220:3` |
| ENT-001 | Loading | `220:4` |
| ENT-001 | Offline | `220:5` |
| ENT-001 | Recoverable Error | `220:6` |
| ONB-001 | Normal | `220:7` |
| ONB-001 | Loading | `220:8` |
| ONB-001 | Recoverable Error | `220:9` |
| ONB-001 | Offline | `220:10` |
| DLY-001 | Normal | `220:11` |
| DLY-001 | Loading | `220:12` |
| DLY-001 | Recoverable Error | `220:13` |
| DLY-001 | Offline | `220:14` |
| DLY-001 | Disabled | `220:15` |
| DLY-002 | Loading | `220:16` |
| DLY-002 | Fallback | `220:17` |
| DLY-002 | Recoverable Error | `220:18` |
| DLY-002 | Offline | `220:19` |
| DLY-003 | Normal | `220:20` |
| DLY-003 | Loading | `220:21` |
| DLY-003 | Fallback | `220:22` |
| DLY-003 | Recoverable Error | `220:23` |
| DLY-003 | Offline | `220:24` |
| DLY-003 | Completed | `220:25` |
| DLY-003 | Safety | `220:26` |
| REC-002 | Normal | `220:27` |
| REC-002 | Loading | `220:28` |
| REC-002 | Empty | `220:29` |
| REC-002 | Recoverable Error | `220:30` |
| REC-002 | Offline | `220:31` |
| SYS-003 | Loading | `220:32` |
| SYS-003 | Recoverable Error | `220:33` |
| SYS-003 | Deleting | `220:34` |
| SAFE-001 | Safety | `220:35` |
| SAFE-001 | Loading | `220:36` |
| SAFE-001 | Recoverable Error | `220:37` |

正式状态矩阵共 **35 个 Frame**，命名统一采用 `<Page ID> / <State> / v1`。

## 3. 页面设计摘要

### ENT-001

Normal 状态使用“一分钟价值 + 三步收益 + 娱乐/专业边界 + 隐私入口”的单列结构。唯一突出主操作为“开始今天的一分钟”。Offline/Error/Loading 不改变产品承诺，也不制造恐惧感。

### ONB-001

称呼保持可选并明确“留空也可以”；表达偏好用同一事实的“温柔 / 轻松幽默 / 清醒直接”三种示例比较，不包装成角色选择。主操作为“继续看今天”。

### DLY-001

页面明确标记“这是你的真实记录”。情绪、精力、睡眠都支持“说不准”；已选择项同时使用 `✓`、边框和文本语义，不依赖颜色。情绪和精力各五档 + “说不准”，睡眠四档 + “说不准”。生成按钮是唯一突出主操作。

### DLY-002

Loading 不显示百分比，不使用“宇宙计算”等虚构阶段；明确“生成后保持不变”。Fallback 保持同一结果身份，仅减少个性化表达；Recoverable Error/Offline 都回到同一请求恢复语义，不提供“重新抽取”。

### DLY-003

Normal/Completed 使用 Gentle Nature 长页结构：日期与问候 → “娱乐与行动参考” → 整体能量 → 今日重点 → 核心提示 → 朋友表达 → 今日行动 → 点亮 → 五维 → 娱乐元素 → 次级入口。

当前视觉 QA 已完成长文案自动高度修正和长页完整滚动高度修正，避免行动卡或后半段内容被裁切。Completed 使用明确的“✓ 今天已点亮”不可重复状态。

Safety 状态完全替代普通旅程，不展示能量、行动、点亮、分享和普通导航。

### REC-002

通过“你的真实记录”和“娱乐与行动参考”两类显式标题/容器区分真实输入与娱乐性内容。历史内容注明按当日快照回看，不由新 Prompt 重生成。删除入口保持危险次操作，主操作为“返回记录”。

### SYS-003

仅使用非技术说明、影响范围、重试/支持路径；不展示供应商、堆栈、Prompt 或内部配置。Deleting 明确受影响页面不可进入且不允许重复发起。

### SAFE-001

采用独立 Safety semantic roles，普通品牌/娱乐叙事退出。当前只提供“现实帮助优先”的结构占位，具体主操作、当地资源、号码和可见安全文案必须由经专业评审且版本化的 `SafetyResponsePlan` 注入；D-003 不内置未经审核的地区危机资源。

## 4. Token / 组件映射

页面没有新增 raw hex/rgb/hsl 颜色；主要画布、表面、文本、品牌、边框、系统状态和 Safety 均绑定 D-002 Figma Variables，例如：

- `color/canvas`
- `color/surface-primary`
- `color/surface-secondary`
- `color/surface-raised`
- `color/text-primary`
- `color/text-secondary`
- `color/text-muted`
- `color/brand-primary`
- `color/brand-soft`
- `color/border-subtle`
- `color/info-*`
- `color/danger-*`
- `color/safety-*`

页面层命名按 D-002 组件合同对齐：`DE / Button / Primary`、`DE / SectionCard`、`DE / InlineNotice`、`DE / EnergySummary`、`DE / FriendMessage`、`DE / ActionCard`、`DE / StateSelector` 等。

### 4.1 上游组件实例差异（阻断 Accepted）

D-002 当前 Figma master components 是“组件目录/证据展示”形态：master 内包含 `03 · Primary`、`11 · DE / SectionCard` 等目录标注，且没有暴露可用于业务页文案/状态替换的 component properties。直接 instantiate 会把目录标注一起带入业务页面。

因此本 Draft 当前采用 **canonical D-002 Variables + D-002 component contract layer naming** 构造页面，而没有伪装成已经完成可消费 master instance 的直接复用。

这属于 D-003 发现的上游设计系统交付差异。在以下任一条件满足前，D-003 **不得标记 Accepted**：

1. D-002 Figma master 调整为可直接消费的业务组件/变体，并在 D-003 页面替换为实际 instances；或
2. 上游正式审核并明确接受当前“Token + component contract”映射为 D-002 的设计复用合同。

## 5. 固定合成内容

当前高保真使用固定虚构内容，不使用真实用户隐私或高风险经历：

- 日期：8 月 17 日 / 8 月 12 日历史日
- 今日能量：72 / 稳中有进
- 重点维度：行动 78
- 核心提示：今天不用排满，先守住最重要的一件事
- 今日行动：留出 20 分钟，只做第一步
- 历史签到：情绪平稳 / 精力一般 / 睡眠还可以
- Safety：仅使用“审核后注入”结构占位，不提供真实号码或地区资源

## 6. 已执行设计 QA

本轮已经实际在 Figma 中执行并修正：

- 35 个 Frame 的页面 × 状态矩阵完整性；
- Frame 命名与 Page ID 对齐；
- D-003 semantic color token 绑定；
- DLY-001 三类真实状态选择和非颜色选中提示；
- DLY-001 为情绪、精力补齐“说不准”；
- 主按钮 48px 基线；状态选择控件补最小约 44px 高度；
- 多行中文自动高度修复，消除 Safety 标题和长正文重叠；
- DLY-003/REC-002 长内容按实际内容增高，避免裁切；
- DLY-003 Normal 关键截图人工目检；
- ENT-001 Normal 关键截图人工目检；
- DLY-001 Normal 关键截图人工目检；
- REC-002 Normal 关键截图人工目检；
- SAFE-001 Safety 关键截图人工目检；
- Safety 页面无普通娱乐元素和普通导航；
- Loading 不使用虚假百分比；Fallback 不暗示重新抽取；Offline 不伪造写入成功。

## 7. 尚未完成 / 平台阻塞

2026-08-17 在补充以下设计 QA Frame 时，Figma MCP 返回 Starter plan tool-call limit。失败调用是原子的，没有产生半完成节点。

尚需在下一次可用 Figma MCP 会话中完成：

- `DLY-003` 五维区域严格改为“1 项展开 + 4 项摘要/可展开”视觉状态；当前 Frame 已按信息顺序展示五维，但仍需要最后一次渐进展开视觉收口；
- 375px 小屏 QA Frame；
- 125% 大字体 QA Frame；
- DLY-002 Reduced Motion 静态状态 QA Frame；
- 对上述 QA Frame 再次截图检查安全区和长内容；
- 组件 master/instance 差异处理与最终组件复用审计。

因此当前证据状态为：`DRAFT / FIGMA_IMPLEMENTED / QA_PARTIAL / FIGMA_RATE_LIMIT_BLOCKED`。

## 8. Acceptance Gate

D-003 从 Draft 进入 Accepted 前必须同时满足：

- [x] 八页全部正式适用状态 Frame 已建立；
- [x] 关键 Normal/System/Safety 页面已经高保真化；
- [x] D-002 semantic tokens 已用于页面视觉；
- [x] 真实记录 / 娱乐与行动参考 / 朋友表达 / 系统状态有结构和文字双重区分；
- [x] SAFE-001 替代普通旅程且不内置未经审核资源；
- [ ] 五维“1 展开 + 4 摘要”最终视觉收口；
- [ ] 375px 小屏证据；
- [ ] 125% 大字证据；
- [ ] Reduced Motion 证据；
- [ ] D-002 可消费 component instance 复用差异关闭或获上游明确批准；
- [ ] 项目负责人在 Figma 中完成最终人工评审。

未满足上述项目时，不得解除 D-004 的 D-003 前置，也不得把本文状态改为 Accepted。

# D-003 核心流程高保真设计

- **文档状态**：Accepted
- **所属任务**：D-003 — 完成核心流程高保真设计（Issue #101）
- **设计方向**：A — Gentle Nature / 01B / DLY-003
- **上游设计系统**：D-002 Accepted（本轮仅做生产可消费性 hardening，不改 Token 值、视觉方向或既有 Component ID）
- **Figma 文件**：`T5HS32Ciz6LZh81KbqhFGo`
- **Figma 页面**：`D-003 / Core Flow High Fidelity`（Page ID `220:2`）
- **Accepted 日期**：2026-08-18
- **最后更新**：2026-08-18

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

正式状态矩阵共 **35 个 Frame**，命名统一采用 `<Page ID> / <State> / v1`。生产组件 hardening 和 Instance 替换后，上述 35 个官方 Frame ID 全部保持不变。

### 2.1 QA Frame

| QA | Frame ID | 尺寸 |
| --- | --- | --- |
| DLY-003 Small | `248:2` | 375 × 1717 |
| ENT-001 Small | `248:43` | 375 × 919 |
| DLY-003 Large Text 125% | `248:64` | 420 × 1918 |
| DLY-002 Reduced Motion | `248:105` | 420 × 545 |

## 3. 页面设计摘要

### ENT-001

Normal 状态使用“一分钟价值 + 三步收益 + 娱乐/专业边界 + 隐私入口”的单列结构。唯一突出主操作为“开始今天的一分钟”。Offline/Error/Loading 不改变产品承诺，也不制造恐惧感。

### ONB-001

称呼保持可选并明确“留空也可以”；表达偏好用同一事实的“温柔 / 轻松幽默 / 清醒直接”三种示例比较，不包装成角色选择。主操作为“继续看今天”。

### DLY-001

页面明确标记“这是你的真实记录”。情绪、精力、睡眠都支持“说不准”；已选择项同时使用 `✓`、边框和文本语义，不依赖颜色。情绪和精力各五档 + “说不准”，睡眠四档 + “说不准”。17 个可见状态 Chip 已替换为 `DE / ChoiceChip` 实例，并保持 44px 最小高度。生成按钮是唯一突出主操作。

### DLY-002

Loading 不显示百分比，不使用“宇宙计算”等虚构阶段；明确“生成后保持不变”。Fallback 保持同一结果身份，仅减少个性化表达；Recoverable Error/Offline 都回到同一请求恢复语义，不提供“重新抽取”。Reduced Motion QA 使用稳定静态终态，不使用闪烁、循环进度或位移。

### DLY-003

Normal/Completed 使用 Gentle Nature 长页结构：日期与问候 → “娱乐与行动参考” → 整体能量 → 今日重点 → 核心提示 → 朋友表达 → 今日行动 → 点亮 → 五维 → 娱乐元素 → 次级入口。

五维已经严格收口为 **1 项默认展开 + 4 项摘要**：行动 78 默认展开；情绪、专注、关系、休息保留摘要和“查看详情”提示。Completed 使用明确的“✓ 今天已点亮”不可重复状态。

长文案自动高度、长页滚动高度、375px 小屏和 125% 大字体均已截图检查，不遮挡 CTA 或安全区。

Safety 状态完全替代普通旅程，不展示能量、行动、点亮、分享和普通导航。

### REC-002

通过“你的真实记录”和“娱乐与行动参考”两类显式标题/容器区分真实输入与娱乐性内容。历史内容注明按当日快照回看，不由新 Prompt 重生成。删除入口保持危险次操作，主操作为“返回记录”。

### SYS-003

仅使用非技术说明、影响范围、重试/支持路径；不展示供应商、堆栈、Prompt 或内部配置。Deleting 明确受影响页面不可进入且不允许重复发起。

### SAFE-001

采用独立 Safety semantic roles，普通品牌/娱乐叙事退出。具体主操作、当地资源、号码和可见安全文案必须由经专业评审且版本化的 `SafetyResponsePlan` 注入；D-003 不内置未经审核的地区危机资源。

`SAFE-001 / Safety / v1`（`220:35`）保留官方顶层 Frame ID，内部已收口为单一 `DE / SafetyScreen` 实例；SafetyScreen 自身由 D-002 的 InlineNotice、SectionCard 和 PrimaryButton 等生产组件组合，不引入普通导航、运势、任务、点亮或分享。

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

本轮未修改 `apps/miniapp/design-tokens.json` 的任何 Token 值，也未创建第二套组件系统。

### 4.1 D-002 Component production hardening（已解决）

D-003 初稿发现 D-002 master components 把目录/证据文字包含在组件本体中，并且没有业务页可编辑的 Component Properties。该差异已在原 17 个 D-002 Component Master 上**原地修复**：

- 保留既有 Component ID 和名称，不复制一套“Production Components”；
- `03 · Primary`、`11 · DE / SectionCard`、`SAFETY · 待专业安全评审` 等目录文字已移到 master 外的 documentation 层；
- AppHeader、Button、ChoiceChip、StateSelector、FriendMessage、EnergySummary、ActionCard、SectionCard、InlineNotice、LoadingSkeleton、OfflineState、RecoverableError、ConfirmSheet、SafetyScreen 已暴露适用的 Text/Boolean Component Properties；
- `DE / SectionCard` 增加 `BodyVisible`，支持紧凑摘要而无需页面私有 variant；
- `DE / ChoiceChip` 固定 44px 最小触控高度；Primary/Secondary/Text Button 保持 48px 控件高度；
- 旧矢量 master 的 31 个颜色 paint 已无损绑定到现有 Default Semantic Variables；
- 最终机器审计：17 个 master、**0 个内部目录标注泄漏、0 个未绑定 Solid Paint**；
- `DE / SafetyScreen` 为 420 × 920 全屏生产组件，并复用 D-002 子组件实例。

这属于 D-002 Accepted 资产的生产可消费性 hardening：**未改变 Token 值、视觉方向、逻辑组件清单或既有 Component ID**。

### 4.2 D-003 Instance audit

最终 D-003 Figma 审计得到 **118 个 D-002 Component Instance**：

| Component | Instance 数 |
| --- | ---: |
| PrimaryButton | 22 |
| SecondaryButton | 8 |
| ChoiceChip | 17 |
| FriendMessage | 5 |
| EnergySummary | 5 |
| ActionCard | 5 |
| SectionCard | 30 |
| InlineNotice | 19 |
| LoadingSkeleton | 6 |
| SafetyScreen | 1 |

原先与上述组件同名的 D-003 私有 Frame 数为 **0**；DLY-001 遗留 44px 私有 Chip 数为 **0**；D-003 页面中 D-002 目录标注泄漏数为 **0**。

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
- 17 个 D-002 master production hardening 和 Component Property 审计；
- 118 个 D-003 Component Instance 复用审计；
- DLY-001 三类真实状态选择、“说不准”和非颜色选中提示；
- 主按钮 48px、ChoiceChip 44px 触控基线；
- 多行中文自动高度修复，消除 Safety 标题和长正文重叠；
- DLY-003/REC-002 长内容按实际内容增高，避免裁切；
- DLY-003 五维“1 展开 + 4 摘要”渐进披露；
- 375px DLY-003 / ENT-001 小屏 QA；
- DLY-003 125% 大字体 QA；
- DLY-002 Reduced Motion 静态 QA；
- DLY-003 Normal、ENT-001 Normal、DLY-001 Normal、REC-002 Normal、SAFE-001 Safety 关键截图人工目检；
- D-002 Components 页面生产组件布局截图检查；
- Safety 页面无普通娱乐元素和普通导航；
- Loading 不使用虚假百分比；Fallback 不暗示重新抽取；Offline 不伪造写入成功；
- 最终机器审计确认 `35 / 35` 官方 Frame、`4 / 4` QA Frame、`0` catalog chrome leakage、`0` unresolved solid paint bindings。

## 7. 当前状态

2026-08-18 已解除此前所有技术/平台阻塞：

- Figma MCP 可正常编辑；
- 五维渐进披露已完成；
- 375px / 125% Large Text / Reduced Motion QA Frame 已完成并截图检查；
- D-002 master component 可消费性差异已通过原地 production hardening 关闭；
- D-003 已使用真实 D-002 Component Instance，不再依赖仅命名映射的页面私有组件结构。

项目负责人于 2026-08-18 明确确认 D-003，最终 Owner Gate 已通过。

当前证据状态为：`ACCEPTED / FIGMA_IMPLEMENTED / QA_COMPLETE`。

D-003 已满足 D-004 的设计前置条件；D-004 是否可开始还需同时满足其另一前置 `E-004`。

## 8. Acceptance Gate

D-003 从 Draft 进入 Accepted 所需条件均已满足：

- [x] 八页全部正式适用状态 Frame 已建立；
- [x] 关键 Normal/System/Safety 页面已经高保真化；
- [x] D-002 semantic tokens 已用于页面视觉；
- [x] 真实记录 / 娱乐与行动参考 / 朋友表达 / 系统状态有结构和文字双重区分；
- [x] SAFE-001 替代普通旅程且不内置未经审核资源；
- [x] 五维“1 展开 + 4 摘要”最终视觉收口；
- [x] 375px 小屏证据；
- [x] 125% 大字证据；
- [x] Reduced Motion 证据；
- [x] D-002 可消费 component instance 复用差异关闭；
- [x] D-002 master / D-003 instance / semantic binding 最终审计通过；
- [x] 项目负责人在 Figma / PR 中完成最终人工评审。

**结论：D-003 Accepted。** 后续 D-004 必须以本文、上述 Figma Frame ID 与 D-002 生产组件为设计基线，不得静默偏离。
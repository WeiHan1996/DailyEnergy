# D-004 高保真原型与开发交付

- **文档状态**：Draft / In Progress
- **所属任务**：D-004 — 完成高保真原型、验证与开发交付（Issue #102）
- **设计基线**：D-003 Accepted
- **设计系统基线**：D-002 Accepted + production hardening
- **Figma 文件**：`T5HS32Ciz6LZh81KbqhFGo`
- **Figma 页面**：`D-003 / Core Flow High Fidelity`（Page ID `220:2`）
- **工作分支**：`design/d-004-prototype-handoff`
- **最后更新**：2026-08-18

## 1. 目的与边界

本文把 D-003 已接受的高保真 Frame 转成开发可执行的原型/交付合同。D-004 **不复制一套页面、不改变 D-003 Frame ID，也不实现业务代码**；Prototype Reaction 直接连接 D-003 Accepted Frame，额外节点只用于原型 Hotspot 和删除确认 Overlay。

D-004 必须继续服从：

- `docs/design/core-flow-high-fidelity.md`
- `docs/design/prototype-validation.md`
- `docs/design/interaction-states.md`
- `docs/design/content-layout.md`
- `docs/technical/testing.md`
- `apps/miniapp/README.md`

如果本文与上述 Accepted 文档冲突，以上游为准；不得通过 Prototype 方便性改变幂等、删除、离线、Safety 或历史快照语义。

## 2. 原型起点与正式 Frame

首日主路径起始 Frame：

- `ENT-001 / Normal / v1` — `220:3`

D-003 正式 35 个 Frame ID 保持不变。D-004 第一轮 Prototype 写入后的机器审计仍为 **35 / 35**。

当前 MCP 环境不暴露 Page flow-start 写 API，因此 D-004 不伪造已设置的 Figma Flow Starting Point。最终交付前由 Figma UI 获取可分享 Prototype URL；在此之前，评审从 Frame `220:3` 进入 Present 即可演练主路径。

## 3. 首日主路径 Reaction Map

| 顺序 | 来源 | 交互节点 | 操作 | 目标 |
| ---: | --- | --- | --- | --- |
| 1 | ENT-001 Normal `220:3` | PrimaryButton `271:2` | 点击“开始今天的一分钟” | ONB-001 Normal `220:7` |
| 2 | ONB-001 Normal `220:7` | PrimaryButton `271:6` | 点击“继续看今天” | DLY-001 Normal `220:11` |
| 3 | DLY-001 Normal `220:11` | PrimaryButton `271:10` | 点击“生成今天” | DLY-002 Loading `220:16` |
| 4 | DLY-002 Loading `220:16` | Frame timeout | 1.2s 后进入同一结果 | DLY-003 Normal `220:20` |
| 4a | DLY-002 Loading `220:16` | SecondaryButton `271:52` | 点击“稍后来看” | DLY-003 Normal `220:20` |
| 5 | DLY-003 Normal `220:20` | PrimaryButton `271:18` | 点击“点亮今天” | DLY-003 Completed `220:25` |

### 3.1 动效合同

- 普通导航只使用 `DISSOLVE / EASE_OUT / 160ms`，对应 D-002 fast motion 基线；
- 不使用横向/纵向位移来表达成功、失败或状态层级；
- Reduced Motion 下实现必须使用静态状态/0ms，不因移除动画丢失信息；
- DLY-002 的 1.2s 只是**可点击原型演练时长**，不是生产 SLA，也不是伪造百分比或队列进度。

## 4. 历史日回看与删除

### 4.1 历史入口

DLY-003 的底部文字是一个合并 Text Node，无法对“历史记录”子字符串单独建立 Reaction。D-004 因此增加两个**仅原型 Hotspot**，不属于生产组件：

| 所在 Frame | Hotspot | Frame ID | 尺寸 | 目标 |
| --- | --- | --- | --- | --- |
| DLY-003 Normal `220:20` | `D-004 Hotspot / History` | `295:239` | 96 × 44 | REC-002 Normal `220:27` |
| DLY-003 Completed `220:25` | `D-004 Hotspot / History` | `295:241` | 96 × 44 | REC-002 Normal `220:27` |

Hotspot 为不可见点击层，只用于 Prototype；开发必须实现真实语义按钮/链接并保留约 44px 触控目标，不能复制透明层技巧到生产页面。

REC-002 Normal 的“返回记录”使用 `BACK`：

- PrimaryButton `271:26` → `BACK`

这样从 Normal/Completed 今日页进入历史日时，返回可恢复原来源，而不是硬编码第二份状态。

### 4.2 删除确认 Overlay

D-004 新增 Prototype-only Overlay：

- `D-004 / REC-002 / Delete Confirm / v1`
- Frame ID：`295:227`
- 尺寸：420 × 920
- 背景：D-002 `color/overlay` Semantic Variable
- 内容：`DE / ConfirmSheet` Instance `295:228`

可见文案：

- 标题：`删除这一天？`
- 说明：`删除后无法恢复，会影响趋势。`
- 主操作：`确认删除`
- 次操作：`取消`

点击层：

| Hotspot | ID | 尺寸 | Reaction |
| --- | --- | --- | --- |
| `D-004 Hotspot / Delete Day` | `295:243` | 190 × 44 | REC-002 Normal → Overlay `295:227` |
| `D-004 Hotspot / Confirm Delete` | `295:235` | 180 × 48 | Overlay → SYS-003 Deleting `220:34` |
| `D-004 Hotspot / Cancel Delete` | `295:237` | 90 × 48 | `CLOSE` Overlay |

删除处理中：

- `SYS-003 / Deleting / v1` `220:34`
- 原型 1.0s 后 → `REC-002 / Empty / v1` `220:29`
- 该 1.0s 同样只用于演练，不是生产处理时间承诺；
- Deleting 期间不得重复发起删除，也不得访问承诺删除的数据。

删除完成后的 Empty Frame 明确显示“删除后的日期保持缺失，不会补造内容”。当前 D-004 缩减原型没有 REC-001 列表高保真，因此 `REC-002 Empty` 的“返回记录”临时导航到 DLY-003 Completed `220:25`；开发实现 C 系列页面时必须按最终路由合同回真实记录入口，不能把该 Prototype 缩减路由当成产品 IA。

## 5. Recovery / Fallback Reaction Map

Recoverable Error 的重试始终恢复**同一意图**；Offline 恢复网络后同样重试当前意图，不创建第二份事实。

| 状态 | 控件 | Reaction |
| --- | --- | --- |
| ENT-001 Offline `220:5` | `271:46` 重试连接 | → ENT-001 Normal `220:3` |
| ENT-001 Recoverable Error `220:6` | `271:4` 重试 | → ENT-001 Normal `220:3` |
| ONB-001 Offline `220:10` | `271:48` | → ONB-001 Normal `220:7` |
| ONB-001 Recoverable Error `220:9` | `271:8` | → ONB-001 Normal `220:7` |
| DLY-001 Offline `220:14` | `271:50` | → DLY-001 Normal `220:11` |
| DLY-001 Recoverable Error `220:13` | `271:12` | → DLY-001 Normal `220:11` |
| DLY-002 Offline `220:19` | `271:54` | → DLY-002 Loading `220:16` |
| DLY-002 Recoverable Error `220:18` | `271:16` | → DLY-002 Loading `220:16` |
| DLY-002 Fallback `220:17` | Frame timeout 0.8s | → DLY-003 Fallback `220:22` |
| DLY-003 Offline `220:24` | `271:56` | → DLY-003 Normal `220:20` |
| DLY-003 Recoverable Error `220:23` | `271:20` | → DLY-003 Normal `220:20` |
| REC-002 Offline `220:31` | `271:58` | → REC-002 Normal `220:27` |
| REC-002 Recoverable Error `220:30` | `271:30` | → REC-002 Normal `220:27` |
| SYS-003 Recoverable Error `220:33` | `271:34` | → SYS-003 Loading `220:32` |

### 5.1 幂等约束

Prototype 的箭头只是用户可见状态关系，不授权实现“再次提交新命令”。开发必须保持 Accepted 规则：

- 第一次提交后进入 busy/Loading；
- 双击、重复点击、系统重试复用同一逻辑意图；
- 客户端超时先查询正式状态；
- 只有确认未创建时才允许同一意图重试；
- 已生成结果只读取同一结果，没有“再生成一份”。

## 6. Safety 原型合同

Safety 优先级高于普通今日旅程。

当前 Prototype：

- `DLY-003 / Safety / v1` `220:26` → 0.1s → `SAFE-001 / Safety / v1` `220:35`
- `SAFE-001 / Recoverable Error / v1` `220:37` 的重试 `271:38` → `SAFE-001 / Loading / v1` `220:36`
- `SAFE-001 / Loading / v1` `220:36` → 0.8s → `SAFE-001 / Safety / v1` `220:35`

规则：

- Safety Loading/Error 始终留在 Safety 信息架构；
- 读取资源失败不能闪回 DLY-003、运势、任务、点亮、分享或普通导航；
- Prototype 不内置未经审核的危机号码/地区资源；
- `SafetyResponsePlan` 才是生产资源和可见安全文案的版本化来源。

## 7. 组件与 Token 交付

D-004 不重新定义 D-002。页面实现必须优先复用 D-002 生产组件和 Semantic Variables。

核心组件合同：

- `DE / Button / Primary` — `190:696`
- `DE / Button / Secondary` — `190:690`
- `DE / ChoiceChip` — `190:691`
- `DE / FriendMessage` — `190:689`
- `DE / EnergySummary` — `190:692`
- `DE / ActionCard` — `190:688`
- `DE / SectionCard` — `190:687`
- `DE / InlineNotice` — `190:693`
- `DE / LoadingSkeleton` — `190:686`
- `DE / ConfirmSheet` — `190:683`
- `DE / SafetyScreen` — `190:682`

主要 Semantic roles：

- `color/canvas`
- `color/surface-primary`
- `color/surface-secondary`
- `color/surface-raised`
- `color/text-primary`
- `color/text-secondary`
- `color/text-muted`
- `color/brand-primary`
- `color/border-subtle`
- `color/info-*`
- `color/danger-*`
- `color/safety-*`
- `color/overlay`

D-003 最终审计已证明 17 个 Master 为 production-consumable，0 catalog-label leak、0 unresolved solid paint binding。D-004 不允许页面重新硬编码等价颜色。

## 8. 页面几何、触控与长内容

以 Figma Frame 为几何 source of truth，不从截图反推 CSS/WXSS。

核心 420px 设计 Frame 的主内容通常位于：

- 左边界 `x = 28`
- 内容宽度 `364`
- 左右视觉 gutter 各 28px

控件最低基线：

- 主/次按钮：48px 高；
- ChoiceChip：44px 高；
- Prototype Hotspot：全部 ≥44px；
- 长内容必须自然增高/滚动，不覆盖 CTA 或安全区。

QA 证据：

- `248:2` — DLY-003 / 375px
- `248:43` — ENT-001 / 375px
- `248:64` — DLY-003 / 125% Large Text
- `248:105` — DLY-002 / Reduced Motion

## 9. Visual QA / Screenshot Baseline

后续 C-003、C-004、C-009 页面 PR 必须提供实现截图并引用对应 Figma Frame ID。至少包含：

1. **Frame/viewport 对齐**：以相同逻辑宽度截取，不拉伸截图；
2. **结构**：标题、真实记录/娱乐内容/系统状态分区顺序一致；
3. **排版**：无裁切、重叠、错误强制单行；大字体可自然增高；
4. **组件**：使用现有实现组件/Token，不页面私造等价组件；
5. **状态**：Loading/Offline/Error/Fallback/Completed/Safety 的文案与主操作一致；
6. **非颜色提示**：选中/完成/错误至少保留文本、符号、边框或结构中的非颜色信号；
7. **触控**：关键操作约 44px 或以上；
8. **安全区**：长页底部 CTA/入口不被微信安全区遮挡；
9. **Reduced Motion**：无闪烁、脉冲、循环位移或信息损失；
10. **Safety**：不出现普通运势/任务/点亮/分享/普通返回。

D-004 当前不固定脆弱的“像素 diff 百分比阈值”；字体栅格、平台渲染和微信运行时尚未形成稳定基线前，任何 unexplained copy/geometry/state difference 都必须人工解释或修正，不能用宽松阈值吞掉。

## 10. 可访问性与输入顺序

开发验收必须覆盖：

- 视觉顺序与读屏顺序一致；
- 状态变化有文本语义，不只靠色彩/动画；
- 大字体下 CTA 仍可到达；
- 软键盘出现时 ONB-001 可选称呼输入和主要操作不被永久遮挡；
- 横向不产生业务页面滚动；
- Safety 的现实帮助操作优先于其他资源；
- 删除 Confirm 的确认/取消均有独立点击目标。

自动化不能替代最终系统读屏和微信真机/开发者工具人工 Gate。

## 11. 埋点触点（不定义事件名）

仓库当前没有检索到已 Accepted 的 analytics event-name 合同。D-004 因此**不发明事件名、字段或指标**，只固定需要被后续分析设计覆盖的交互触点：

- 页面进入：ENT-001、ONB-001、DLY-001、DLY-002、DLY-003、REC-002、SAFE-001；
- 首次流程主 CTA；
- DLY-001 正式提交意图；
- DLY-002 等待/稍后返回；
- DLY-003 点亮意图与 Completed 到达；
- Offline / Recoverable Error 重试；
- Fallback / reduced-personalization 可见；
- 历史日打开；
- 删除入口、确认、取消、Deleting、删除完成；
- Safety 进入、资源加载失败、资源重试、现实帮助主操作。

后续 analytics 合同必须明确隐私最小化、client-safe 字段和 source ID，再由实现任务接入；Prototype 不发送任何真实事件。

## 12. 测试与证据映射

D-004 原型回归遵循 S-04 和 `docs/technical/testing.md`：测试必须能回溯 Accepted source IDs，不能只写“截图看起来对”。

建议后续实现测试至少保留以下 D-004 source anchors：

- `D-004-FIRST-DAY`
- `D-004-IDEMPOTENT-RETRY`
- `D-004-OFFLINE-READONLY`
- `D-004-FALLBACK-SAME-RESULT`
- `D-004-HISTORY-SNAPSHOT`
- `D-004-DELETE-CONFIRM`
- `D-004-DELETING-GUARD`
- `D-004-SAFETY-OVERRIDE`
- `D-004-LARGE-TEXT`
- `D-004-REDUCED-MOTION`

这些是 D-004 交付文档的场景锚点，不替代 S-31 已定义的正式测试 ID/coverage registry。业务测试落地时必须映射回真正的 Accepted source IDs。

## 13. 第一轮 Figma Prototype QA

2026-08-18 已实际执行：

- 主路径 Reaction 写入；
- Offline / Recoverable Error 恢复 Reaction 写入；
- Fallback、Safety、Deleting timeout 路径写入；
- DLY-003 历史入口 Hotspot 写入；
- REC-002 删除入口 + Confirm Overlay + 确认/取消写入；
- 删除 Overlay 截图 QA，并修复标题换行重叠；
- 最终 Reaction 机器审计。

审计结果：

- D-003 正式 Frame：`35 / 35`
- 有 Reaction 的节点：`31`
- D-004 Prototype Hotspot：`5`
- Hotspot 最小高度检查：`PASS`（全部 ≥44px）
- Reaction destination 缺失：`0`
- Delete Confirm Overlay：`295:227` / 420 × 920
- Accepted Frame ID 改写：`0`

## 14. 尚未完成 / Acceptance Gate

D-004 当前为 Draft / In Progress，尚不能 Accepted。剩余工作包括：

- [x] D-003 Accepted / E-004 completed 前置确认；
- [x] 首日主路径原型 Reaction；
- [x] 历史日与删除确认原型；
- [x] Offline / Recoverable Error / Fallback / Safety / Deleting 第一轮演练路径；
- [x] 44px Hotspot 与 Reaction target 机器审计；
- [x] `developer-handoff.md` Draft；
- [ ] 对 Prototype 在 Figma Presentation 中执行脚本化点击回归；
- [ ] 补充跨日/返回/重进与重复点击演练记录；
- [ ] 对 375px / Large Text / Reduced Motion 做交付级复核；
- [ ] 固定可分享 Figma Prototype URL / start Frame 证据；
- [ ] 项目负责人最终评审 Prototype 与 developer handoff；
- [ ] 评审通过后改为 Accepted、合并 D-004 PR、解除 C-003 的 D-004 前置。

外部 5～8 人研究不在本轮自动执行范围；若决定招募，需另行获得研究、隐私、联系和补偿授权。
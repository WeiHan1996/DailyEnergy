# D-004 高保真原型、验证与开发交付

- **文档状态**：Accepted
- **接受日期**：2026-08-19
- **所属任务**：D-004 — 完成高保真原型、验证与开发交付（Issue #102）
- **设计基线**：D-003 Accepted（PR #144 已合并）
- **设计系统基线**：D-002 Accepted + production hardening
- **Figma 文件**：`T5HS32Ciz6LZh81KbqhFGo`
- **原型页面**：`D-003 / Core Flow High Fidelity`（Page ID `220:2`）
- **Visual QA 页面**：`D-004 / Visual QA Baseline`（Page ID `303:275`）
- **工作分支**：`design/d-004-prototype-handoff`
- **最后更新**：2026-08-21
- **项目负责人接受**：`ACCEPTED`

> 项目负责人已在 PR #145 明确确认“审核通过”，D-004 的设计前置已经满足。该接受不替代微信
> DevTools、真机、专业 Safety 或 Production / RC 证据。

## 1. 目的与边界

本文把 D-003 已接受的高保真 Frame 转成开发可执行的 Prototype、恢复路径、视觉 QA 基线和页面 PR 证据合同。D-004 **不重新设计 D-003、不改变其 35 个正式 Frame ID，也不实现业务代码/API/数据库/真实微信平台行为**。

D-004 必须继续服从：

- `docs/design/core-flow-high-fidelity.md`
- `docs/design/prototype-validation.md`
- `docs/design/interaction-states.md`
- `docs/design/content-layout.md`
- `docs/product/state-machine.md`
- `docs/product/business-rules.md`
- `docs/analytics/event-tracking.md`
- `docs/technical/testing.md`
- `apps/miniapp/README.md`

如果本文与上述 Accepted 文档冲突，以上游为准；Prototype 方便性不得改变幂等、产品日期、历史快照、删除、隐私、Safety 或 analytics 数据最小化语义。

本轮内部走查不等于外部用户研究。未获得研究、隐私、联系与补偿授权前，不招募或联系 5～8 名参与者，也不收集真实敏感/高风险经历。

## 2. Figma 评审入口

### 2.1 Prototype

- 起始 Frame：`ENT-001 / Normal / v1` — `220:3`
- Prototype URL：`https://www.figma.com/proto/T5HS32Ciz6LZh81KbqhFGo/Document?node-id=220-3&starting-point-node-id=220%3A3`
- Design source：`https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?node-id=220-2&p=f`

当前 Page 已存在 6 个 flow starting point：

| Figma flow | Entry Frame | 用途 |
| --- | --- | --- |
| Flow 1 | `220:3` ENT-001 Normal | 首日主路径 |
| Flow 2 | `220:31` REC-002 Offline | 历史离线恢复 |
| Flow 3 | `220:33` SYS-003 Recoverable Error | 系统恢复 |
| Flow 4 | `220:37` SAFE-001 Recoverable Error | Safety 资源恢复 |
| Flow 5 | `220:17` DLY-002 Fallback | 模板降级 |
| Flow 6 | `295:227` Delete Confirm | 删除确认 |

Figma 当前 flow 名称保持通用 `Flow 1...6`；开发与评审应以 Frame ID 而不是 flow 显示名作为稳定引用。

### 2.2 Visual QA Baseline

D-004 新建独立 Figma Page：

- `D-004 / Visual QA Baseline`
- Page ID：`303:275`
- URL：`https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?node-id=303-275&p=f`

该页面保存 source Frame 的**静态 raster snapshots**，用于后续实现截图比较。Snapshot 不是可编辑视觉权威；权威仍是 D-003/D-004 source Frame、D-002 Component 和 canonical Token。

| Baseline | Snapshot ID | Source |
| --- | --- | --- |
| ENT-001 / Normal | `303:276` | `220:3` |
| ONB-001 / Normal | `303:277` | `220:7` |
| DLY-001 / Normal | `303:278` | `220:11` |
| DLY-002 / Loading | `303:279` | `220:16` |
| DLY-003 / Normal | `303:280` | `220:20` |
| DLY-003 / Completed | `303:281` | `220:25` |
| DLY-003 / Offline | `303:282` | `220:24` |
| REC-002 / Normal | `303:283` | `220:27` |
| REC-002 / Delete Confirm | `303:284` | `295:227` |
| SYS-003 / Deleting | `303:285` | `220:34` |
| SAFE-001 / Safety | `303:286` | `220:35` |
| DLY-003 / Large Text 125% | `303:287` | `248:64` |
| DLY-002 / Reduced Motion | `303:288` | `248:105` |
| Template Fallback / Silent | `303:289` | `303:210` |
| Personalization Reduced | `303:290` | `303:245` |

Baseline 更新规则：先修改并审核 source，再刷新 snapshot；不得直接修改 snapshot 以消除实现差异。

## 3. 正式 Frame ID 索引

D-003 正式 35 个 Frame ID 保持不变：

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

D-003 QA Frame：

- `248:2` — DLY-003 / 375px
- `248:43` — ENT-001 / 375px
- `248:64` — DLY-003 / 125% Large Text
- `248:105` — DLY-002 / Reduced Motion

D-004 Prototype-only 场景：

| 场景 | Frame ID | 说明 |
| --- | --- | --- |
| REC-002 删除确认 | `295:227` | 一次明确危险确认 |
| 完整模板降级 / Silent | `303:210` | 视觉与 Normal 一致，不向用户暴露技术降级 |
| 个性化减少 | `303:245` | 仅在表达明显减少时显示中性提示 |

D-004 Prototype-only Hotspot：

- `295:239` — DLY-003 Normal / History，96 × 44
- `295:241` — DLY-003 Completed / History，96 × 44
- `295:243` — REC-002 / Delete Day，190 × 44
- `295:235` — Confirm Delete，180 × 48
- `295:237` — Cancel Delete，90 × 48

透明 Hotspot 只解决 Figma 合并 Text Node 无法对子字符串挂 Reaction 的原型限制；生产必须实现真实语义控件，不复制透明点击层技巧。

## 4. 首日主路径 Reaction Map

| 顺序 | 来源 | 交互节点 | 操作 | 目标 |
| ---: | --- | --- | --- | --- |
| 1 | ENT-001 Normal `220:3` | PrimaryButton `271:2` | “开始今天的一分钟” | ONB-001 Normal `220:7` |
| 2 | ONB-001 Normal `220:7` | PrimaryButton `271:6` | “继续看今天” | DLY-001 Normal `220:11` |
| 3 | DLY-001 Normal `220:11` | PrimaryButton `271:10` | “生成今天” | DLY-002 Loading `220:16` |
| 4 | DLY-002 Loading `220:16` | Frame timeout | 1.2s 后 | DLY-003 Normal `220:20` |
| 4a | DLY-002 Loading `220:16` | SecondaryButton `271:52` | “稍后来看” | DLY-003 Normal `220:20` |
| 5 | DLY-003 Normal `220:20` | 阅读 ActionCard | 今日行动进入可视区 | 同页 |
| 6 | DLY-003 Normal `220:20` | PrimaryButton `271:18` | “点亮今天” | DLY-003 Completed `220:25` |

DLY-001 原型使用固定合成的已选状态：`✓ 平稳 / ✓ 一般 / ✓ 还可以`，只为稳定演练主路径。生产实现不得默认替用户选择；必须由真实选择或有效“说不准”满足提交条件。

### 4.1 动效合同

- 普通导航：`DISSOLVE / EASE_OUT / ~160ms`；
- 不用位移动画表达成功、错误或状态优先级；
- Reduced Motion 下进入稳定静态终态；
- 1.2s / 1.0s / 0.8s / 0.1s timeout 只压缩 Prototype 演练时间，不是生产 SLA；
- Loading 不显示虚假百分比、队列阶段、provider、模型或 Prompt。

## 5. 历史日回看与删除

### 5.1 历史入口与 Back

- `220:20` / `220:25` 的 History Hotspot → `220:27` REC-002 Normal；
- `220:27` PrimaryButton `271:26` 使用 `BACK`，恢复原来源，不硬编码第二份今日状态；
- 历史内容按当日快照读取，不使用新版本重新生成。

### 5.2 删除确认 Overlay

- Frame：`D-004 / REC-002 / Delete Confirm / v1`
- ID：`295:227`
- `DE / ConfirmSheet` Instance：`295:228`
- 标题：`删除这一天？`
- 说明：`删除后无法恢复，会影响趋势。`
- `确认删除` → `220:34` SYS-003 Deleting
- `取消` → `CLOSE`
- Deleting 演示 1.0s → `220:29` REC-002 Empty

`REC-002 Empty` 当前因 D-004 不包含 REC-001 高保真列表，Prototype 的返回只用于退出演练；生产必须按 Accepted IA/路由回真实记录入口，不把该缩减导航当成产品合同。

### 5.3 ConfirmSheet hardening

内部截图 QA 发现 `DE / ConfirmSheet` 原正文宽度过窄，较长删除影响说明会与行动区挤压。D-004 已在原组件上原地修复：

- Component ID 保持 `190:683`；
- 保留现有 Component Properties；
- 组件宽度保持 290；
- 正文可用宽度扩展到 254，并允许自然高度；
- 组件高度调整为 146，为行动区提供稳定纵向空间；
- 删除确认 Instance 重新居中；
- `303:284` raster baseline 已在修复后刷新。

这属于既有 D-002 组件的 production-consumability hardening，不创建第二套 ConfirmSheet，也不改变删除业务语义。

## 6. Recovery / Fallback / Safety Map

Recoverable Error 和 Offline 始终恢复**同一逻辑意图**。

| 状态 | 控件/触发 | Reaction |
| --- | --- | --- |
| ENT-001 Offline `220:5` | `271:46` | → `220:3` |
| ENT-001 Recoverable Error `220:6` | `271:4` | → `220:3` |
| ONB-001 Offline `220:10` | `271:48` | → `220:7` |
| ONB-001 Recoverable Error `220:9` | `271:8` | → `220:7` |
| DLY-001 Offline `220:14` | `271:50` | → `220:11` |
| DLY-001 Recoverable Error `220:13` | `271:12` | → `220:11` |
| DLY-002 Offline `220:19` | `271:54` | → `220:16` |
| DLY-002 Recoverable Error `220:18` | `271:16` | → `220:16` |
| DLY-002 Fallback `220:17` | timeout 0.8s | → `303:210` Silent Template Fallback |
| DLY-003 Offline `220:24` | `271:56` | → `220:20` |
| DLY-003 Recoverable Error `220:23` | `271:20` | → `220:20` |
| REC-002 Offline `220:31` | `271:58` | → `220:27` |
| REC-002 Recoverable Error `220:30` | `271:30` | → `220:27` |
| SYS-003 Recoverable Error `220:33` | `271:34` | → `220:32` |
| SAFE-001 Recoverable Error `220:37` | `271:38` | → `220:36` |
| SAFE-001 Loading `220:36` | timeout 0.8s | → `220:35` |
| DLY-003 Safety `220:26` | timeout 0.1s | → `220:35` |

### 6.1 模板降级与个性化减少必须分开

Accepted S-04/S-03 要求：

- 完整受控模板可用且结构完整时，用户侧**静默**；
- 只有明显缺少个性化时，才出现轻量中性提示。

因此 D-004 新增两个原型场景：

- `303:210` — `D-004 / DLY-003 / Template Fallback Silent / v1`：克隆 Normal 视觉，无技术提示；
- `303:245` — `D-004 / DLY-003 / Personalization Reduced / v1`：保留“核心结果不变，只是个性化表达暂时减少”的中性说明。

二者都保持相同 core result identity，均不得提供“重新抽取/再生成一份”。

### 6.2 幂等与 Unknown outcome

Prototype 的箭头只说明用户可见状态关系，不授权新建命令：

- 第一次点击后进入 busy/Loading；
- 双击、重复点击、系统重试复用同一逻辑意图；
- 客户端超时先查询正式状态；
- 只有确认未创建时才允许同一意图重试；
- 已生成只读取同一结果；
- 返回/重进保持同一 PublishedDailyResult、点亮和任务状态。

### 6.3 Safety

Safety Loading/Error 始终留在 Safety 信息架构；资源加载失败不能闪回 DLY-003、运势、任务、点亮、分享或普通导航。生产资源/文案继续由经专业审核、版本化的 `SafetyResponsePlan` 注入，D-004 不内置未经审核的地区号码或资源。

## 7. 组件、Token 与页面几何

D-004 不重新定义 D-002。页面实现必须优先复用 D-002 production components：

- PrimaryButton `190:696`
- SecondaryButton `190:690`
- ChoiceChip `190:691`
- FriendMessage `190:689`
- EnergySummary `190:692`
- ActionCard `190:688`
- SectionCard `190:687`
- InlineNotice `190:693`
- LoadingSkeleton `190:686`
- OfflineState `190:684`
- RecoverableError `190:685`
- ConfirmSheet `190:683`
- SafetyScreen `190:682`

布局与状态继续只使用 canonical semantic/component Token：

- Layout：`pageGutter`, `contentMax`, `safeTop`, `safeBottom`, `sectionGap`；
- Motion：`fast`, `standard`, `gentle`, `slow`, `reduced`, `distance`；
- Color：`canvas`, `surface*`, `text*`, `brand*`, `border*`, `info*`, `danger*`, `safety*`, `overlay`。

420px 设计 Frame 当前 resolved 主内容通常为 `x=28 / width=364`。该数值只用于核对 Figma 几何；生产代码必须消费布局 Token，不在业务页建立第二套 magic-number system。

触控基线：

- Primary/Secondary Button：48px；
- ChoiceChip：44px；
- Prototype Hotspot：全部 ≥44px；
- 长页自然增高/滚动，不覆盖 CTA 或安全区。

## 8. 页面级开发合同

| 页面 | Frame | 核心组件 | Motion / recovery | Accepted analytics 触点 | 实现验收 |
| --- | --- | --- | --- | --- | --- |
| ENT-001 | `220:3-6` | PageShell、Button、Notice | Error/Offline 回同一承接意图 | `landing_viewed`, `landing_primary_action_clicked`; 权威同意为 `consent_accepted` | 一分钟价值与边界清楚；离线不伪造同意 |
| ONB-001 | `220:7-10` | SectionCard/选择容器、Button | 草稿保留；重试同一 onboarding | `onboarding_completed` 只在权威完成后产生 | 空称呼可完成；重进不重复建 profile |
| DLY-001 | `220:11-15` | ChoiceChip ×17、Button、Notice | 首击 busy；Error/Offline 同意图恢复 | `checkin_submitted`; 更正 `checkin_corrected` | 44px；说不准有效；analytics 不含 mood/energy/sleep |
| DLY-002 | `220:16-19` | Skeleton、Notice、Button | 同 GenerationIntent；无第二任务 | `generation_started`, `daily_result_available` | 无假进度；Unknown outcome 先读权威状态 |
| DLY-003 | `220:20-26` | EnergySummary、FriendMessage、ActionCard、SectionCard、Button | 长页自然滚动；Offline/Error 回同结果；Safety 优先 | `daily_result_read`, `main_action_reached`, `dimensions_expanded`, `day_lit` | 1 展开 + 4 摘要；点亮不依赖任务；Completed 不重复写 |
| REC-002 | `220:27-31`, `295:227` | SectionCard、EnergySummary、ActionCard、ConfirmSheet、Button | Back 恢复来源；Offline 只读；一次删除确认 | `history_day_read`; 删除流程走 governance 事实 | 历史不重生成；删除后 MISSING；缓存不复活 |
| SYS-003 | `220:32-34` | Skeleton、RecoverableError/Notice | Deleting 高优先级；不伪造进度 | `data_task_stage_changed` 等 approved governance event | 不重复发起；不暴露内部技术细节 |
| SAFE-001 | `220:35-37` | SafetyScreen | Safety 内部恢复，Reduced Motion 静态 | 仅 approved `SAFETY_CONTROL` 事件 | 无运势/任务/点亮/分享/普通导航 |

Analytics 只能消费 Accepted `docs/analytics/event-tracking.md` allowlist。尤其：

- 不记录 mood、energy、sleep 原值；
- 不记录用户称呼、正文、自由文本、Safety 原文；
- 不建立 user/device/session 级事件轨迹；
- 客户端 signal 不能证明服务端成功；
- 幂等重放、重复点击、Unknown outcome 恢复不得重复增加权威完成事实。

## 9. Accessibility / 小屏 / Reduced Motion

开发验收必须覆盖：

- 可操作目标约 44px，主按钮 48px；
- Selected/Completed/Error/Offline 不是只换颜色；
- 读屏顺序与视觉顺序一致：Meta → Title → 状态/内容 → 主操作 → 次操作；
- selected/radio、loading/status、disabled、dialog 暴露正确语义；
- 375px 常见微信宽度不横向滚动；
- 大字体自然增高、长页可滚动，CTA 可到达；
- ONB 称呼输入软键盘出现时输入与主操作不被安全区永久遮挡；
- `safeTop/safeBottom` 结合微信运行时安全区；
- Reduced Motion 禁止旋转、脉冲、循环位移以及“只有动画才能看懂”的状态。

D-003/D-004 QA source：

- `248:2` DLY-003 / 375px
- `248:43` ENT-001 / 375px
- `248:64` DLY-003 / 125% Large Text
- `248:105` DLY-002 / Reduced Motion
- `303:275` D-004 Visual QA Baseline

自动化不能替代最终系统读屏、微信 DevTools 与真机人工 Gate。

## 10. 内部脚本化 Prototype 回归

以下为内部脚本化原型回归，不是外部用户研究。

| ID | 场景 | Entry / 操作 | 期望 | 结果 |
| --- | --- | --- | --- | --- |
| D004-R01 | 正常首日 | `220:3` 按主路径 | 到 `220:25` | PASS |
| D004-R02 | 重复点击 | `220:11` 点生成后继续操作 | 首击进入 Loading；无第二生成入口 | PASS |
| D004-R03 | 签到提交失败 | `220:13` 重试 | 回同一 DLY-001 意图 | PASS |
| D004-R04 | 签到离线 | `220:14` 重试连接 | 不伪造已保存；回同一意图 | PASS |
| D004-R05 | 生成中恢复/重进 | `220:16` 等待或稍后来看 | 同一今日结果，无第二任务 | PASS |
| D004-R06 | 生成失败 | `220:18` 重试 | 回 `220:16` 同一 GenerationIntent | PASS |
| D004-R07 | 生成离线 | `220:19` 重试连接 | 回 `220:16`，不新建任务 | PASS |
| D004-R08 | 完整模板降级 | `220:17` 等待 | `303:210`，用户侧静默 | PASS |
| D004-R09 | 个性化减少 | `303:245` | 中性提示 core result 不变 | PASS |
| D004-R10 | 今日内容恢复 | `220:23` 重试 | 回 `220:20`，不重抽 | PASS |
| D004-R11 | 今日离线缓存 | `220:24` | 明确只读；写操作不伪造成功 | PASS |
| D004-R12 | 历史日回看 | `220:27` | 真实/娱乐分层；Back 恢复来源 | PASS |
| D004-R13 | 历史日删除 | `220:27 → 295:227 → 220:34 → 220:29` | 一次确认；Deleting；MISSING | PASS |
| D004-R14 | Safety 覆盖 | `220:26 → 220:35` | 普通旅程被抑制 | PASS |
| D004-R15 | Safety 资源失败 | `220:37 → 220:36 → 220:35` | 不闪回普通页面 | PASS |
| D004-R16 | Large Text | `248:64` | 长文/CTA/安全区不裁切 | PASS |
| D004-R17 | Reduced Motion | `248:105` | 静态终态、无 reaction 依赖 | PASS |
| D004-R18 | 当日返回/重进 | `220:25` | 同一结果和点亮完成态 | PASS |
| D004-R19 | 跨产品日 | 通过 SYS-001/product-date 重新路由 DLY-001 | 旧草稿不跨日成为正式事实 | PASS_WITH_IMPLEMENTATION_NOTE |
| D004-R20 | 删除取消 | `295:227` Cancel | Close，无写入 | PASS |

`PASS_WITH_IMPLEMENTATION_NOTE`：视觉与路由合同明确，但 Figma 不模拟服务端 `product-date-v1`、CAS、数据库唯一约束或删除 SLA；这些必须由 Accepted state/API/testing 和实现测试证明。

## 11. Figma 结构审计

2026-08-18 实际执行的 bounded audit：

- D-003 正式 Frame：`35 / 35`
- missing official Frame：0
- reaction node：29
- broken reaction destination：0
- ON_CLICK target <44px：0
- DLY-001 `DE / ChoiceChip`：17
- ChoiceChip 最小高度：44px
- Selected 非颜色提示：`✓ 平稳 / ✓ 一般 / ✓ 还可以`
- Reduced Motion `248:105` reaction count：0
- D-004 Prototype-only Hotspot：5
- D-004 Visual QA snapshot：15
- Accepted D-003 Frame ID 改写：0

人工截图复核已覆盖 DLY-001、ONB-001、Silent Template Fallback、Personalization Reduced、Delete Confirm；Delete Confirm 文案重叠 defect 已修复并重新截图确认。

## 12. Visual Regression / Screenshot 规则

D-004 不建设生产视觉回归基础设施，但固定实现比较合同：

- source of truth：D-003/D-004 source Frame + D-002 Token/组件；
- screenshot baseline：Figma `303:275` raster snapshot；
- viewport 必须匹配对应逻辑宽度，不通过缩放伪装；
- 使用固定 synthetic fixture，避免动态时间/真实用户内容污染；
- 允许解释：平台字体栅格化、微信原生控件不可避免的像素差异；
- 不允许：信息顺序、主操作层级、状态语义、Safety 覆盖、删除确认、非颜色提示、内容裁切、页面私有 Token 系统；
- 有意差异必须在页面 PR 记录原因、截图与 reviewer 决策；
- baseline 只能在 source 被审核后刷新，不能为了“diff 变绿”更新。

不固定脆弱的统一像素差异百分比阈值；在真机/DevTools 视觉基础设施正式建立前，unexplained copy/geometry/state difference 必须人工解释或修正。

## 13. C-003 / C-004 / C-009 页面 PR 强制设计证据

页面 PR 没有以下证据不得宣称匹配 D-004：

1. 列出实现对应的 D-004/D-003 Frame ID；
2. 提供 Normal + Issue 要求的 Loading/Error/Offline/Disabled/Completed/Fallback/Safety/Deleting 状态截图；
3. 视觉差异记录；无差异写 `NONE`；
4. Token 复用证明：不新增 page-private raw color/spacing system；
5. Component 复用映射：不复制同名私有组件；
6. 约 44px 触控与非颜色 Selected/Completed/Error 提示；
7. 常见微信宽度 + 系统大字体截图；长页必须覆盖折行和滚动；
8. Reduced Motion 证据；
9. Error/Offline 回同一业务意图的恢复截图/测试；
10. Analytics 只使用 Accepted allowlist，不记录值/正文/Safety 原文/用户标识；
11. 测试 registry 的相关 Accepted Source ID 从 `PLANNED` 更新为 `COVERED`，或提供批准的 `NA_WITH_REASON`；
12. 发现 source 与 Accepted state/API/privacy/Safety 冲突时先停止并回上游，不在页面 PR 临时改规则。

任务映射：

- C-003：ENT-001 `220:3-6`、ONB-001 `220:7-10`；
- C-004：DLY-001 `220:11-15`，并证明 duplicate/Unknown outcome 不产生第二签到事实；
- C-009：DLY-002 `220:16-19`、DLY-003 `220:20-26`、REC-002 `220:27-31`、Delete Confirm `295:227`，并引用 `303:210` / `303:245` 的降级差异。

## 14. 设计差异记录

| ID | 发现 | 处理 | 状态 |
| --- | --- | --- | --- |
| D004-D01 | 完整模板 fallback 与个性化减少若共用同一提示，会违反“完整模板静默、明显减少才提示” | 新增 `303:210` Silent + `303:245` Personalization Reduced；`220:17` 改连 `303:210` | RESOLVED |
| D004-D02 | ConfirmSheet 原正文宽度不足，长删除影响文案与行动区挤压 | 原 Component `190:683` 原地 hardening；保留 ID/Properties；刷新 baseline | RESOLVED |
| D004-D03 | Figma 无法证明 product-date、幂等存储、CAS、删除 SLA | 固定 implementation/test contract，不把 Prototype 当后端证明 | ACCEPTED_BOUNDARY |
| D004-D04 | Safety 生产文案/地区资源仍需要独立专业评审 | 保持 SafetyResponsePlan 注入；D-004 不添加未经审核资源 | PENDING_EXTERNAL_REVIEW |

没有发现需要修改 Accepted 信息架构、状态机、AI 事实、隐私或 Safety 优先级的冲突。

## 15. 外部研究边界

S-04 的 5～8 人计划只作为未来研究脚本。实际招募前必须另行确认：研究目标/筛选、联系渠道、隐私告知、观察/录音/录屏选择、补偿、高风险退出和最少数据收集。

未授权前：

- 不联系参与者；
- 不自动补偿；
- 不收真实私人内容；
- 不把内部走查写成“5/8 用户通过”。

## 16. Acceptance 记录

已完成：

- [x] D-003 Accepted / E-004 completed 前置确认；
- [x] 首日主路径 Prototype Reaction；
- [x] 历史日 Back / Delete Confirm / Deleting / Empty 路径；
- [x] Offline / Recoverable Error / Safety 恢复；
- [x] 模板降级与个性化减少分离；
- [x] ConfirmSheet 长文案布局 defect 修复；
- [x] 35 Frame / reaction / 44px target / ChoiceChip / Reduced Motion 结构审计；
- [x] 20 项内部 scripted scenario walkthrough；
- [x] 15 个 durable Figma raster Visual QA baseline；
- [x] C-003/C-004/C-009 页面 PR 设计证据合同；
- [x] Figma Prototype URL / start Frame 交付记录。

- [x] 项目负责人审核 Prototype、Visual QA baseline、本文与 PR；
- [x] 项目负责人于 2026-08-19 明确确认“审核通过”，D-004 正式 Accepted；
- [x] PR #145 squash 合并为 `4093c3e5ac7ea4dc9bf1ecaf13ff672af62dc369`，Issue #102 已关闭；
- [x] D-005 随后完成并获接受，C-003、C-004、C-009 的 D-004 设计前置已满足；
- [ ] PR CI run `32129322033` 的 11 个 jobs 未进入 step 且无可用日志，保留为
  `INFRA/BILLING/RUNNER STARTUP BLOCKED`，不改写为自动化 PASS。

D-004 的人工设计接受不声称微信平台、Safety 专业资源或 Production / RC readiness。

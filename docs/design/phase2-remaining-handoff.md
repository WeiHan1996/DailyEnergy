# D-005 Phase 2 剩余页面高保真与开发交付

- **文档状态**：Accepted
- **所属任务**：D-005 — 完成 Phase 2 剩余页面高保真与开发交付（Issue #104）
- **设计基线**：D-002 Accepted、D-003 Accepted、D-004 Accepted
- **Figma 文件**：`T5HS32Ciz6LZh81KbqhFGo`
- **Source Page**：`D-005 / Phase 2 Remaining High Fidelity`（Page ID `495:219`）
- **Responsive / Visual QA Page**：`D-005 / Responsive & Visual QA`（Page ID `507:2`）
- **最后更新**：2026-08-19
- **项目负责人接受**：2026-08-19，明确“审核通过”

> D-005 已由项目负责人完成设计评审并接受。本文成为 C-012、C-013、C-014 对应页面实现的正式视觉与开发交付基线；D-005 设计前置解除，但这些 C 系列任务仍必须满足各自其它依赖、Accepted 规格、Schema/API、隐私、Safety、幂等、删除和运行 Gate。

## 1. 目的与边界

D-005 补齐 Phase 2 后半段用户侧正式视觉：晚间真实反馈、最近七个连续产品日期趋势、历史日删除后的趋势失效 / 重建，以及隐私与数据权利、导出、关系数据删除与账户注销。

所有页面继续复用 D-002 semantic token 和正式组件，不创建第二套视觉系统。本文不实现 C-012、C-013、C-014 的业务页面代码、API、数据库、worker、真实微信平台行为或生产视觉回归基础设施。

权威上游继续包括：

- `docs/design/design-system.md`
- `docs/design/core-flow-high-fidelity.md`
- `docs/design/developer-handoff.md`
- `docs/design/screen-specs.md`
- `docs/design/interaction-states.md`
- `docs/design/content-layout.md`
- `docs/ai/evening-feedback-schema.md`
- `docs/ai/weekly-summary-schema.md`
- `docs/decisions/ADR-0005-data-retention-and-deletion.md`
- `docs/operations/privacy-data-map.md`

如本文与更高优先级 Accepted 源冲突，以上游为准。Figma 示例日期、统计、删除回执和 Prototype timeout 只用于设计评审，不构成生产事实或 SLA。

## 2. Figma 评审入口

### 2.1 Source

- Page：`D-005 / Phase 2 Remaining High Fidelity`
- Page ID：`495:219`
- URL：`https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?node-id=495-219&p=f`

### 2.2 Responsive / Visual QA

- Page：`D-005 / Responsive & Visual QA`
- Page ID：`507:2`
- URL：`https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?node-id=507-2&p=f`

Prototype 使用 Frame ID 作为稳定引用，不以 Figma 自动生成 flow 名称作为合同。

## 3. 正式 Frame ID 索引

D-005 Source Page 共 **29 个正式 Frame**。

### 3.1 EVE-001 — 晚间真实反馈

| 状态 | Frame ID |
| --- | --- |
| Normal | `495:220` |
| Loading | `495:221` |
| Recoverable Error | `495:222` |
| Offline | `495:223` |
| Completed | `495:224` |

Safety 不复制新页面，继续复用 D-003 Accepted `SAFE-001 / Safety / v1` — `220:35` 及固定安全响应合同。

### 3.2 REC-001 — 最近 7 个产品日期

| 状态 / 覆盖 | Frame ID |
| --- | --- |
| Empty | `495:225` |
| Points Only · 2 days | `495:226` |
| Partial · 4 days | `495:227` |
| Complete · 7 days | `495:228` |
| Loading | `495:229` |
| Recoverable Error | `495:230` |
| Offline | `495:231` |
| Fallback · Summary | `495:232` |
| Rebuilding · Source Invalidated | `495:233` |

### 3.3 REC-002 — 历史日删除影响扩展

| 状态 | Frame ID |
| --- | --- |
| Delete Confirm · Trend Impact | `495:234` |

历史详情的基础 Normal / Loading / Empty / Recoverable Error / Offline 继续复用 D-003 Accepted `220:27`～`220:31`。

### 3.4 SET-004 — 隐私与数据权利

| 状态 | Frame ID |
| --- | --- |
| Normal | `495:235` |
| Loading | `495:236` |
| Recoverable Error | `495:237` |
| Offline | `495:238` |
| Export Processing | `495:239` |
| Export Failed | `495:240` |
| Export Ready | `495:241` |
| Deleting · Rights Task Active | `495:242` |

### 3.5 SET-006 — 注销账户 / 高风险删除任务

| 状态 | Frame ID |
| --- | --- |
| Normal | `495:243` |
| Verification Loading | `495:244` |
| Disabled · Verify Required | `495:245` |
| Recoverable Error | `495:246` |
| Deleting | `495:247` |
| Completed | `495:248` |

`SET-006` 以 ACCOUNT scope 作为最大范围视觉样例。`RELATIONSHIP_DATA` 复用相同状态结构和 deletion guard / retry / completion 语义，但必须替换为关系数据范围文案，不能误称账户已注销。

## 4. 晚间反馈合同

EVE-001 属于“你的真实记录”，不是对娱乐性今日内容是否应验的评分。

Normal / Completed 覆盖：

- `overall_feeling` 真实主观状态，包括“说不准”；
- 建议帮助度中 `未使用` 与 `没帮助` 分离；
- 今日小任务状态独立，不完成不惩罚、不评价；
- 0～80 字可选短句；
- 短句明确不自动进入长期记忆或七天总结；
- Error 保留已填内容；Offline 不离线排队补交；
- Loading 不展示虚假百分比。

生产实现不得复制 Figma 中的预选示例，提交值必须来自用户真实选择或 Accepted Schema 允许的显式不确定值。

## 5. 七天趋势合同

REC-001 固定表示**最近 7 个连续产品日期**，不是最近 7 次有记录日期。缺失日保持空白，不向前补更早记录。

覆盖等级：

- 0 天：Empty；
- 1～2 天：Points Only，只显示离散观察，不下“变好 / 变差 / 稳定”等结论；
- 3～6 天：Partial，显式写“基于 N 天记录”；
- 7 天：Complete，显示完整七天回望。

每个指标仍必须满足 Accepted weekly summary 的最小可用观察数才能描述方向；`UNSURE` 不映射成伪数值参与斜率。

### 5.1 图表

D-005 Source 中共有 **16 张趋势图**：

- 16 / 16 都有可见文字 `Accessible chart summary`；
- 缺失日期断开折线，不跨缺失日连线；
- 日期和值以文字标签重复表达，不只依赖颜色、点位或斜率；
- Source 中有 30 个显式“缺失”标签；
- 娱乐性“整体能量 / 五维分数”不进入真实趋势。

### 5.2 删除 / 更正后的失效

`495:233` 固定：

1. 源记录删除或更正后，旧趋势总结立即失效；
2. 重新聚合完成前，只展示仍有效的原始记录点；
3. 不展示 ghost summary 或已删除日期引用；
4. 重建后按新样本数重新进入 Empty / Points Only / Partial / Complete。

`495:234` 删除确认正面展示删除不可恢复、该日成为缺失、相关趋势和总结重新计算；危险操作与取消使用明确独立按钮。

## 6. 数据权利、导出与删除合同

### 6.1 SET-004

Normal 正面展示：收集与用途、查看和管理、导出自己的数据、删除某一天、删除关系数据、注销账户和完整隐私说明。

Offline 时静态说明可读，但导出、删除和注销不做离线排队。

导出与删除是不同 DataTask：

- Export Processing：展示范围与处理中状态；
- Export Failed：保留同一导出意图并可恢复；
- Export Ready：说明文件已生成、交付方式和实际有效期，不误写成“数据已删除”；
- Deleting：deletion guard 生效后普通旅程被阻断，刷新或恢复服务不能重新展示已删除范围。

### 6.2 SET-006

最终注销前必须完成身份验证；未验证时最终危险操作 Disabled。

确认页说明：

- 会删除的产品数据范围；
- 可能限期隔离保留的备份 / 受托副本；
- 法律要求最小证据例外；
- deletion guard 先于在线清理生效；
- 在线权威库和活动副本按 Accepted ADR-0005 清理；
- 重复点击 / 重试不创建第二删除任务。

Recoverable Error 表示**已有删除任务的局部失败**：完成步骤不回退，普通产品访问继续 fail closed，重试只继续同一个 DataTask。

Completed 只声明在线普通产品数据清理完成，并如实展示备份 / 受托副本最迟到期日，不声称所有隔离介质瞬间逐字节永久擦除。

## 7. 异常状态动作规则

项目负责人评审期间对异常页做了全量视觉收口，Accepted 规则如下：

- Recoverable Error / Offline 状态卡只承担**标题 + 说明**；
- 不在状态卡底部放裸露的 `重试`、`重试读取`、`继续处理` 等文字动作；
- 真正恢复动作使用 D-002 正式 Button，触控目标至少 44px；
- 页面已有同名主动作时，删除状态卡中的重复动作；
- 9 / 9 D-005 状态卡无卡内 Action、无内容溢出；
- `REC-002 / Delete Confirm` 使用独立影响说明区和等宽危险 / 取消按钮。

该规则只规范 D-005 异常状态排版，不新增新的业务状态或 API 语义。

## 8. Prototype Map

同页关键路径：

| 场景 | 路径 |
| --- | --- |
| 晚间保存 | `495:220 → 495:224` |
| 晚间错误恢复 | `495:222 → 495:220` |
| 晚间离线恢复 | `495:223 → 495:220` |
| 趋势错误恢复 | `495:230 → 495:228` |
| 趋势离线重连 | `495:231 → 495:228` |
| 七天总结重试 | `495:232 → 495:228` |
| 源失效后刷新 | `495:233 → 495:227` |
| 隐私数据错误恢复 | `495:237 → 495:235` |
| 隐私数据离线重连 | `495:238 → 495:235` |
| 导出 | `495:235 → 495:239` |
| 导出失败重试 | `495:240 → 495:239` |
| 导出完成返回 | `495:241 → 495:235` |
| 注销验证 | `495:245 → 495:244 → 495:243` |
| 注销处理 | `495:243 → 495:247 → 495:248` |
| 注销处理失败恢复 | `495:246 → 495:247` |
| 历史日确认删除 | `495:234 → 495:233` |
| 历史日取消删除 | `495:234 → BACK` |

`495:244 → 495:243` 的 0.8s timeout 仅压缩 Prototype 演练时间，不是生产验证 SLA。

Figma Plugin API 的 `NAVIGATE` 只指向同 Page top-level Frame，因此 REC-001 点击某日的生产目标继续由文档固定到 D-003 Accepted `REC-002 / Normal / v1` — `220:27`，不复制第二权威页面。

## 9. D-002 Component / Token 复用与最终机器审计

主要复用：

- `DE / ChoiceChip`
- `DE / Button / Primary`
- `DE / Button / Secondary`
- `DE / Button / Text`
- `DE / SectionCard`
- `DE / InlineNotice`
- `DE / LoadingSkeleton`

页面图表和状态卡是 page-specific composition，不建立第二套全局组件库；颜色、文字、边框和 Surface 继续来自 D-002 semantic variables。

最终 Source audit（项目负责人评审修改后重新执行）：

- 正式 Frame：29 / 29；
- raw unbound solid paint：0；
- Prototype reaction node：24；
- broken reaction destination：0；
- reaction target <44px：0；
- 状态卡：9；
- 状态卡内 Action：0；
- 状态卡内容溢出：0；
- 趋势图：16；
- 带文字可访问摘要：16 / 16；
- 显式缺失标签：30。

## 10. Responsive / Accessibility / Motion QA

| QA | Frame ID | 结果 |
| --- | --- | --- |
| EVE-001 Small 375 | `507:3` | 375px，无横向滚动，选项 ≥44px |
| REC-001 Small 375 | `507:4` | 三图纵向单列，日期和值可读 |
| SET-006 Large Text 125% | `507:5` | 关键删除影响不裁切，主操作可达 |
| EVE-001 Keyboard Safe Area | `507:6` | 短句与保存动作可通过滚动保持可达 |
| Reduced Motion · Data Task | `507:7` | 静态状态即可理解，无 spinner / 位移 / 虚假百分比依赖 |

推荐语义阅读顺序：Meta → Page Title → Subtitle / scope → 状态提示 → 数据区 / 图表标题 → 图表文字摘要 → 日期 / 值 → 行动。生产使用原生语义控件和可访问名称，不依赖透明 hotspot。

## 11. Visual QA Snapshot

QA Page 保存 10 个 durable raster snapshot，可编辑权威仍是 Source Frame + D-002 Component / Token。

| Snapshot | Tile ID | Source |
| --- | --- | --- |
| EVE-001 Normal | `515:521` | `495:220` |
| REC-001 Points Only | `515:524` | `495:226` |
| REC-001 Complete | `515:527` | `495:228` |
| REC-001 Rebuilding | `515:530` | `495:233` |
| REC-002 Delete Confirm | `515:533` | `495:234` |
| SET-004 Normal | `515:536` | `495:235` |
| SET-004 Export Processing | `515:539` | `495:239` |
| SET-006 Normal | `515:542` | `495:243` |
| SET-006 Deleting | `515:545` | `495:247` |
| SET-006 Completed | `515:548` | `495:248` |

`REC-002 Delete Confirm` snapshot 已在项目负责人视觉修订后从最新 Source 刷新。其它异常状态没有对应 durable raster tile，不存在 Source 已改、baseline 仍旧的问题。

Snapshot 更新规则：先修改并审核 Source，再刷新 Snapshot；不得直接改 Snapshot 来消除实现差异。

## 12. 后续开发 PR 证据要求

C-012 / C-013 / C-014 对应页面 PR 至少提供：

1. 对应 D-005 Frame ID；
2. 375px / 正常宽度截图；
3. D-002 Component / semantic token 复用说明；
4. 与该 PR 相关的 Loading / Offline / Error / Disabled / Completed / Deleting / rebuild 证据；
5. 趋势页证明缺失日不连线、样本不足不下结论、图表有文字摘要；
6. 数据权利页证明 scope、processing、failed / retry、guard、completion wording；
7. 大字、44px 触控、键盘安全区、Reduced Motion 针对性证据；
8. 自动化 / 集成测试证明幂等、产品日期、删除 guard、恢复和数据权利任务等 Figma 无法证明的业务语义。

不得为了贴图在代码里硬编码 Figma 示例日期、示例统计、示例删除回执或 0.8s Prototype timeout。

## 13. 设计差异与独立 Gate

- D-005 不重新设计 D-003 / D-004 Accepted 核心页面；
- Safety 继续复用 Accepted SAFE-001 和 SafetyResponsePlan；
- SET-006 ACCOUNT 是最大范围视觉样例，RELATIONSHIP_DATA 使用同一状态结构但替换 scope-specific copy；
- 外部 5～8 人研究未执行；
- 真实微信 DevTools、真机、服务端删除 SLA、备份恢复证明和生产身份验证仍由各自后续工程 / 运行 Gate 证明；
- Production / RC 仍保持既有 `NO_GO`，D-005 Accepted 不改变该结论。

## 14. Acceptance

项目负责人于 **2026-08-19** 完成 Figma Source / QA 的逐页复核，要求并确认以下视觉修订：

- REC-002 删除确认弹层重新排版；
- 异常状态卡去除裸文本恢复动作；
- 恢复动作统一为正式按钮并补齐 Prototype；
- `507:2` 中 REC-002 raster baseline 与 Source 同步；
- 全 29 Frame 再次机器审计通过。

随后项目负责人明确回复 **“审核通过，继续下一步”**，因此：

- D-005 设计与 handoff：**Accepted**；
- Issue #104：可在 PR #146 合并后关闭；
- C-012 / C-013 / C-014 的 **D-005 设计前置解除**；
- 下一工程任务按 Phase 2 顺序进入 C-001；
- 本文不代表 C-012 / C-013 / C-014 的其它前置已满足，也不代表 Production / RC 放行。

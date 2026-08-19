# D-005 Phase 2 剩余页面高保真与开发交付

- **文档状态**：Draft / In Review
- **所属任务**：D-005 — 完成 Phase 2 剩余页面高保真与开发交付（Issue #104）
- **设计基线**：D-002 Accepted、D-003 Accepted、D-004 已由项目负责人接受并随 PR #145 合并
- **Figma 文件**：`T5HS32Ciz6LZh81KbqhFGo`
- **Source Page**：`D-005 / Phase 2 Remaining High Fidelity`（Page ID `495:219`）
- **Responsive / Visual QA Page**：`D-005 / Responsive & Visual QA`（Page ID `507:2`）
- **工作分支**：`agent/d-005-phase2-handoff`
- **最后更新**：2026-08-19
- **项目负责人接受**：`PENDING`

> 本文在项目负责人明确确认前保持 Draft。D-005 未 Accepted 前，C-012、C-013、C-014 继续保持依赖阻断；本任务不实现这些 C 系列页面、API、数据库、worker 或生产视觉回归代码。

## 1. 目的与边界

D-005 补齐 Phase 2 剩余用户侧正式视觉：晚间真实反馈、七天真实趋势、历史日删除后的趋势失效/重建，以及隐私与数据权利、导出、关系数据删除与账户注销。所有页面继续复用 D-002 的 semantic token 和正式组件，不创建第二套视觉系统。

本轮必须继续服从：

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

如本文与上述 Accepted 规范冲突，以上游为准。Figma 示例数据只用于设计评审，不构成新的业务事实、SLA、删除期限、模型判断或统计口径。

## 2. Figma 评审入口

### 2.1 Source

- Page：`D-005 / Phase 2 Remaining High Fidelity`
- Page ID：`495:219`
- Design URL：`https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?node-id=495-219&p=f`

### 2.2 Responsive / Visual QA

- Page：`D-005 / Responsive & Visual QA`
- Page ID：`507:2`
- Design URL：`https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?node-id=507-2&p=f`

### 2.3 Prototype 起点

同页可演练路径可从以下 Frame 开始：

- Evening：`495:220`
- Trends：`495:228`
- Privacy / Data Rights：`495:235`
- Account deletion：`495:245`
- Delete day impact：`495:234`

Prototype 评审使用 Frame ID 作为稳定引用，不以 Figma 自动生成的 flow 名称作为合同。

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

Safety 不复制新页面，继续复用 D-003 Accepted `SAFE-001 / Safety / v1` — `220:35` 及其固定安全响应合同。

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

历史详情的基础 Normal / Loading / Empty / Recoverable Error / Offline 继续复用 D-003 Accepted `220:27`～`220:31`，D-005 不复制这些正式页面。

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

`SET-006` 以 ACCOUNT scope 作为最大范围视觉样例。`RELATIONSHIP_DATA` 必须复用相同状态结构和删除 guard / retry / completion 语义，但标题、删除范围和完成回执必须替换成关系数据范围，不得错误声称账户已经注销。

## 4. 晚间反馈合同

EVE-001 明确属于“你的真实记录”，不是对今日娱乐内容是否应验的评分。

Normal / Completed 页面覆盖：

- `overall_feeling` 的真实主观状态，包括“说不准”；
- 建议帮助度，`未使用` 与 `没帮助` 视觉和语义分离；
- 今日小任务状态，与帮助度、整体感受相互独立；
- 0～80 字可选短句；
- 短句旁明确提示不会自动进入长期记忆或七天总结；
- “不完成任务也不会被评价”的中性反馈。

生产实现不得复制 Figma 中的预选示例；只有用户真实选择或 Accepted Schema 允许的显式不确定值才可提交。

保存是同一个幂等意图：Loading 不展示虚假百分比；Recoverable Error 保留已选内容；Offline 不排队补交；Completed 允许按上游业务规则在有效窗口内修改。

## 5. 七天趋势合同

REC-001 固定表示**最近 7 个连续产品日期**，不是“最近 7 次有记录的日期”。缺失日保持空白，不向前找更早记录补位。

### 5.1 覆盖等级

- 0 天：Empty；
- 1～2 天：Points Only，只显示离散观察，不使用“变好 / 变差 / 稳定”等趋势结论；
- 3～6 天：Partial，页面必须显式写“基于 N 天记录”；
- 7 天：Complete，才显示完整七天回望。

每个指标仍必须满足 Accepted weekly summary 的最小可用观察数才能描述方向；`UNSURE` 不得映射成伪数值参与斜率。

### 5.2 图表

D-005 Source 中共有 **16 张趋势图**，机器审计结果：

- 16 / 16 都有可见文字 `Accessible chart summary`；
- 缺失日期会断开折线，不跨缺失日连线；
- 日期和值以文字标签重复表达，不仅依赖颜色、点位或斜率；
- Source 中共出现 30 个显式“缺失”标签；
- 今日娱乐“整体能量 / 五维运势分数”不进入真实趋势图。

### 5.3 删除 / 更正后的失效

`495:233` 表示源记录删除或更正后：

1. 旧趋势总结立即视为失效；
2. 完成重新聚合前，只展示仍有效的原始记录点；
3. 不继续显示 ghost summary 或对已删除日期的引用；
4. 重建完成后按新的样本数重新落入 Empty / Points Only / Partial / Complete。

`495:234` 删除确认正面写出“这一天会变成缺失，七天趋势和总结会立即失效，并按剩余记录重算”，而不是把影响藏在二级说明里。

## 6. 数据权利、导出与删除合同

### 6.1 SET-004

Normal 正面展示：

- 收集与用途；
- 查看和管理；
- 导出自己的数据；
- 删除某一天；
- 删除关系数据；
- 注销账户；
- 完整隐私说明入口。

Offline 时静态说明可读，但导出、删除和注销操作禁用，不做离线排队。

导出与删除是两个不同的 DataTask 语义：

- Export Processing：展示数据范围与处理中状态；
- Export Failed：保留同一导出意图并可恢复；
- Export Ready：说明文件已生成、交付方式和实际有效期；不能误写成“数据已删除”；
- Deleting：删除 guard 已生效后普通旅程被阻断，刷新或服务恢复不能把旧缓存重新展示出来。

### 6.2 SET-006

最终注销前先完成身份验证；未验证时最终危险操作 Disabled。

确认页必须说明：

- 会删除的产品数据范围；
- 可能限期隔离保留的备份 / 受托副本；
- 法律要求的最小证据例外；
- deletion guard 先于在线清理生效；
- 在线权威库与活动副本按 Accepted ADR-0005 的处理窗口清理；
- 重复点击 / 重试不创建第二个删除任务。

Recoverable Error 表示**已有删除任务的局部失败**：已完成步骤不回退，普通产品访问继续 fail closed，重试只继续同一个 DataTask。

Completed 只声明在线普通产品数据已完成清理，并如实展示备份 / 受托副本的最迟到期日。不得声称所有隔离介质已经在同一瞬间逐字节永久擦除。

## 7. Prototype Map

同页 Prototype 已连接：

| 场景 | 路径 |
| --- | --- |
| 晚间保存 | `495:220 → 495:224` |
| 晚间错误恢复 | `495:222 → 495:220` |
| 晚间离线恢复 | `495:223 → 495:220` |
| 趋势错误恢复 | `495:230 → 495:228` |
| 源失效后刷新 | `495:233 → 495:227` |
| 导出 | `495:235 → 495:239` |
| 导出失败重试 | `495:240 → 495:239` |
| 导出完成返回 | `495:241 → 495:235` |
| 注销验证 | `495:245 → 495:244 → 495:243` |
| 注销处理 | `495:243 → 495:247 → 495:248` |
| 注销处理失败恢复 | `495:246 → 495:247` |
| 历史日确认删除 | `495:234 → 495:233` |
| 历史日取消删除 | `495:234 → BACK` |

`495:244 → 495:243` 使用 0.8s Prototype-only timeout 只是压缩演练时间，不是生产身份验证 SLA。

Figma Plugin API 的 `NAVIGATE` 只能指向同一 Page 的 top-level Frame，因此 D-005 的 REC-001 日记录点击没有复制一个新 REC-002 来绕过工具限制。生产目标继续是 D-003 Accepted `REC-002 / Normal / v1` — `220:27`。这属于 Prototype 工具限制，不是产品导航差异。

## 8. D-002 组件与 Token 复用审计

D-005 不创建新设计系统组件，主要复用：

- `DE / ChoiceChip`
- `DE / Button / Primary`
- `DE / Button / Secondary`
- `DE / Button / Text`
- `DE / SectionCard`
- `DE / InlineNotice`
- `DE / LoadingSkeleton`
- `DE / OfflineState`
- `DE / RecoverableError`
- `DE / ConfirmSheet`

最终 Source 机器审计：

- 正式 Frame：29 / 29；
- raw unbound solid paint：0；
- Prototype reaction node：20；
- reaction target <44px：0；
- 趋势图：16；
- 带文字可访问摘要：16 / 16；
- 缺失标签：30。

页面新增图表是 page-specific composition，不建立新的全局 Component；颜色、文字、边框、Surface 继续来自 D-002 semantic variables。

## 9. Responsive / Accessibility / Motion QA

正式 QA Frame：

| QA | Frame ID | 结果 |
| --- | --- | --- |
| EVE-001 Small 375 | `507:3` | 375px，无横向滚动，选项 ≥44px |
| REC-001 Small 375 | `507:4` | 三图纵向单列，日期和值仍可读 |
| SET-006 Large Text 125% | `507:5` | 关键删除影响不裁切，主操作 60px |
| EVE-001 Keyboard Safe Area | `507:6` | 可选短句与保存动作可通过滚动保持在键盘上方 |
| Reduced Motion · Data Task | `507:7` | 静态状态即可理解，无 spinner / 位移 / 虚假百分比 |

推荐语义阅读顺序：Meta → Page Title → Subtitle / scope → 状态提示 → 数据区 / 图表标题 → 图表文字摘要 → 日期/值 → 行动。Figma layer order按此组织；生产需用原生语义控件和可访问名称实现，不依赖视觉层级或透明 hotspot。

Reduced Motion 下不使用动画承担唯一信息；删除、导出、验证进度必须由标题、状态文字和步骤本身表达。

## 10. Visual QA Snapshot

QA Page 保存 10 个 durable raster snapshot，只作为后续实现截图比较基线；可编辑权威仍是 Source Frame + D-002 Component/Token。

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

Snapshot 更新规则：先修改并审核 Source，再刷新 Snapshot；不得直接改 Snapshot 来“消除”实现差异。

## 11. 开发交付要求

C-012 / C-013 / C-014 后续页面 PR 至少提供：

1. 对应 D-005 Frame ID；
2. 375px / 正常宽度截图；
3. 复用的 D-002 Component / semantic token 说明；
4. Normal 之外与本 PR 相关的 Loading / Offline / Error / Disabled / Completed / Deleting / rebuild 证据；
5. 趋势页必须证明缺失日不连线、样本不足不下结论、图表有文字可访问摘要；
6. 数据权利页必须证明 scope、processing、failed/retry、guard、completion wording；
7. 大字、44px 触控、键盘安全区、Reduced Motion 的针对性证据；
8. 自动化 / 集成测试证明幂等、产品日期、删除 guard、恢复、数据权利任务等 Figma 无法证明的业务语义。

不得为了贴图而在代码里硬编码 Figma 示例日期、示例统计、示例删除回执或 0.8s Prototype timeout。

## 12. 设计差异与未决边界

- D-005 没有重新设计 D-003 / D-004 Accepted 核心页面；
- 跨 Figma Page 的 Prototype 目标因 Plugin API 限制用文档固定到 `220:27`，不复制权威页面；
- Safety 继续复用 Accepted SAFE-001 和 SafetyResponsePlan，不在 D-005 编写第二套安全资源；
- SET-006 ACCOUNT 是最大范围视觉样例；RELATIONSHIP_DATA 使用同一状态结构但替换 scope-specific copy；
- 外部 5～8 人研究未获招募、隐私、联系与补偿授权，本任务不执行外部研究；
- 真实微信 DevTools、真机、服务端删除 SLA、备份恢复证明与生产身份验证仍由各自后续工程 / 运行 Gate 证明。

## 13. CI / 验证策略

项目负责人要求减少 CI、尽量只做一次 CI。本任务在创建 PR 前已完成 Figma 布局、截图、Prototype 和机器审计；仓库 connector 会话无法执行用户本机 `pnpm agent:prepare` / `pnpm validate`，因此按 AGENTS fallback 阅读权威源并固定设计证据。

计划：

1. PR 创建前完成全部文档和 Figma 收口；
2. 创建一个 Draft PR，触发本任务计划中的唯一一次 PR CI；
3. 不主动 rerun；如首次 CI 暴露真实 blocker，再判断是否需要最小修复；
4. 不为写回 PR 编号或非业务元数据追加提交。

## 14. Acceptance Gate

已完成：

- [x] EVE-001 高保真与状态矩阵
- [x] REC-001 0 / 2 / 4 / 7 天覆盖与 Loading / Error / Offline / Fallback / Rebuilding
- [x] REC-002 删除后趋势影响确认
- [x] SET-004 数据权利 / 导出 / 删除任务状态
- [x] SET-006 验证 / Disabled / 删除中 / 失败恢复 / 完成
- [x] D-002 Component / Token 复用
- [x] 16 / 16 图表可访问摘要与缺失日断线
- [x] 375px、125% 大字、键盘安全区、Reduced Motion QA
- [x] 10 个 Visual QA snapshot
- [x] Prototype 关键路径
- [x] 29 Frame / paint / target / chart 机器审计

待评审：

- [ ] Draft PR 唯一一次 CI
- [ ] 项目负责人审核 Figma Source、QA、本文和 PR
- [ ] 项目负责人明确接受后，才把本文改为 Accepted / D-005 Done
- [ ] D-005 Accepted 前不解除 C-012、C-013、C-014 前置

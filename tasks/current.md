# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-19
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：D-005 — 完成 Phase 2 剩余页面高保真与开发交付
- **任务状态**：In Review
- **任务 Profile**：`design`
- **任务分支**：`agent/d-005-phase2-handoff`
- **当前 Issue**：[D-005 Issue #104](https://github.com/WeiHan1996/DailyEnergy/issues/104)
- **当前 PR**：待创建 Draft PR；为遵守“一次 CI”约束，PR 创建前先完成全部 Figma / 文档 / connector QA
- **最近完成 PR**：[D-004 PR #145](https://github.com/WeiHan1996/DailyEnergy/pull/145)，merge `4093c3e5ac7ea4dc9bf1ecaf13ff672af62dc369`
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

D-005 已完成设计侧首轮交付并进入项目负责人评审：补齐晚间真实反馈、最近七个产品日期趋势、历史日删除后的趋势失效 / 重建，以及隐私与数据权利、导出、关系数据删除与账户注销的高保真、状态矩阵、Prototype、响应式 / 无障碍 QA 和开发证据合同。

D-005 只做正式视觉 / Prototype / design QA / developer handoff；不实现 C-012、C-013、C-014 业务页面、API、数据库、worker、真实微信平台行为或生产视觉回归基础设施。

## 2. 前置与依赖状态

- D-004 已于 2026-08-19 获项目负责人接受并随 PR #145 合并为 `4093c3e5ac7ea4dc9bf1ecaf13ff672af62dc369`；Issue #102 已关闭；
- D-002 Accepted Token / Component 继续是唯一设计系统来源；
- D-003 / D-004 Accepted 页面不在本任务重新设计；
- D-005 **尚未 Accepted**，因此 C-012、C-013、C-014 继续被依赖 Gate 阻断；
- Safety 继续复用 Accepted SAFE-001 与 SafetyResponsePlan，不复制第二套安全响应。

本 ChatGPT / Figma / GitHub connector 会话不能执行用户本机 checkout 的 `pnpm agent:prepare` / `pnpm validate`。已按 AGENTS fallback 实际读取 AGENTS、PROJECT_CONTEXT、D-005 Issue、Accepted design / schema / retention / privacy 权威源，并直接检查 GitHub / Figma 原始证据。

## 3. Figma Source

Figma file key：`T5HS32Ciz6LZh81KbqhFGo`

- Page：`D-005 / Phase 2 Remaining High Fidelity`
- Page ID：`495:219`
- 正式 Frame：29 / 29

### EVE-001

`495:220` Normal · `495:221` Loading · `495:222` Recoverable Error · `495:223` Offline · `495:224` Completed。

### REC-001 / REC-002

- `495:225` Empty
- `495:226` Points Only · 2 days
- `495:227` Partial · 4 days
- `495:228` Complete · 7 days
- `495:229` Loading
- `495:230` Recoverable Error
- `495:231` Offline
- `495:232` Fallback · Summary
- `495:233` Rebuilding · Source Invalidated
- `495:234` REC-002 Delete Confirm · Trend Impact

REC-002 基础 Normal / Loading / Empty / Error / Offline 继续复用 D-003 `220:27`～`220:31`。

### SET-004

`495:235` Normal · `495:236` Loading · `495:237` Error · `495:238` Offline · `495:239` Export Processing · `495:240` Export Failed · `495:241` Export Ready · `495:242` Deleting。

### SET-006

`495:243` Normal · `495:244` Verification Loading · `495:245` Disabled / Verify Required · `495:246` Recoverable Error · `495:247` Deleting · `495:248` Completed。

## 4. 关键业务视觉约束

### 晚间反馈

- 明确为真实记录，不验证“今日能量”是否应验；
- `未使用` 与 `没帮助` 分离；
- 任务状态独立，不完成不评价；
- 可选 0～80 字短句不自动进入长期记忆 / 七天总结；
- Error 保留已填内容；Offline 不排队补交。

### 趋势

- 最近 7 个连续产品日期，不压缩成最近 7 次有记录；
- 0 天 Empty、1～2 天只看点、3～6 天显式“基于 N 天”、7 天完整回望；
- 缺失日保持空白并断线；
- 删除 / 更正后旧 summary 立即失效，重建前不显示 ghost conclusion；
- 娱乐五维 / 今日整体能量不进入真实状态趋势。

### 数据权利 / 删除

- SET-004 正面展示数据范围、导出、删除某日、删除关系数据、注销账户；
- Export Processing / Failed / Ready 与 Delete DataTask 分离；
- deletion guard 成功创建后普通读取、写入、生成、通知、分享、缓存命中 fail closed；
- post-guard 失败继续阻断，retry 同一个 DataTask；
- Completed 只声明在线清理完成并如实展示备份 / 受托副本最迟到期，不声称所有隔离介质瞬间擦除。

## 5. Prototype

已连接同 Page 关键路径：

- Evening：`495:220 → 495:224`
- Trend recovery：`495:230 → 495:228`
- Source invalidated：`495:233 → 495:227`
- Export：`495:235 → 495:239`；failed retry `495:240 → 495:239`
- Account：`495:245 → 495:244 → 495:243 → 495:247 → 495:248`
- Delete day：`495:234 → 495:233`；cancel 使用 `BACK`

Figma Plugin API 不允许跨 Page `NAVIGATE`，所以 REC-001 点击某日的生产目标继续由文档固定到 D-003 Accepted `REC-002 Normal` `220:27`，不复制权威页面。

`495:244 → 495:243` 的 0.8s timeout 仅用于 Prototype 演练，不是生产验证 SLA。

## 6. Responsive / Accessibility / Visual QA

QA Page：`D-005 / Responsive & Visual QA` — `507:2`

- `507:3` — EVE-001 375px
- `507:4` — REC-001 375px
- `507:5` — SET-006 125% Large Text
- `507:6` — EVE-001 Keyboard Safe Area
- `507:7` — Reduced Motion / DataTask

结果：

- 375px 无横向滚动；
- 选项和 Prototype action target 均不小于 44px；
- 大字自然增高，不裁切删除范围；
- 键盘场景可通过滚动保持短句与保存动作可达；
- Reduced Motion 不依赖 spinner、位移或虚假百分比传达状态；
- 10 个 durable raster snapshot 已固定在 QA Page。

## 7. 机器审计

最终 Source audit：

- official Frame：29 / 29
- raw unbound solid paint：0
- reaction node：20
- reaction target <44px：0
- trend chart：16
- chart with accessible text summary：16 / 16
- explicit missing label：30

最终 QA audit：

- QA editable Frame：5
- durable raster snapshot：10
- raw unbound solid paint：0

## 8. 开发交付文档

Draft：`docs/design/phase2-remaining-handoff.md`

已记录 29 个正式 Frame ID、状态矩阵、趋势样本规则、删除 / 导出状态、Prototype Map、组件 / Token 审计、375px / Large Text / Keyboard / Reduced Motion、10 个 Visual QA snapshot、跨 Page Prototype 工具限制与 C-012/C-013/C-014 页面 PR 证据合同。

项目负责人接受前保持 Draft。

## 9. CI / GitHub Actions 使用约束

项目负责人明确要求：**减少 CI，尽量只做一次 CI**。

执行策略：

1. Figma、文档、状态与 connector QA 在 PR 创建前全部收口；
2. 创建 Draft PR 才触发本任务第一次、也是计划中的唯一一次 PR CI；
3. 不主动 rerun；只有唯一 CI 暴露真实 blocker 才诊断最小修复；
4. 不为写回 PR 编号、CI 结果或其它无业务价值元数据追加提交。

## 10. Acceptance Gate

已完成：

- [x] D-004 前置确认
- [x] EVE-001 正式高保真与状态矩阵
- [x] REC-001 0 / 2 / 4 / 7 天趋势覆盖和恢复状态
- [x] REC-002 删除后趋势影响确认
- [x] SET-004 导出 / 删除 / 数据权利状态
- [x] SET-006 身份验证 / Disabled / Deleting / failure recovery / Completed
- [x] D-002 Component / Token 复用
- [x] 29 Frame / paint / reaction target / chart 机器审计
- [x] 375px / 125% Large Text / Keyboard / Reduced Motion QA
- [x] 10 个 Visual QA snapshot
- [x] `phase2-remaining-handoff.md` Draft

待评审：

- [ ] 创建 Draft PR 并读取计划中的唯一一次 PR CI
- [ ] 项目负责人审核 Figma Source / QA / handoff / PR
- [ ] 项目负责人明确接受后把 D-005 标为 Done / Accepted
- [ ] D-005 Accepted 后才解除 C-012、C-013、C-014 设计前置

## 11. 精确下一动作

1. 复核 branch diff 仅包含 D-005 设计 / 文档 / 项目控制内容；
2. 创建一个 Draft PR，触发计划中的唯一一次 PR CI；
3. 不主动 rerun，读取首次结果；
4. 将 Figma + Draft PR 交项目负责人审核；
5. 用户明确接受前不把 D-005 标为 Done。

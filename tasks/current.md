# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-18
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：D-004 — 完成高保真原型、验证与开发交付
- **任务状态**：In Review
- **任务 Profile**：`design`
- **任务分支**：`design/d-004-prototype-handoff`
- **当前 Issue**：[D-004 Issue #102](https://github.com/WeiHan1996/DailyEnergy/issues/102)
- **当前 PR**：本分支下一动作创建 Draft PR；为遵守“一次 CI”约束，不在 PR 创建后为写回编号追加状态提交
- **最近完成 PR**：[D-003 PR #144](https://github.com/WeiHan1996/DailyEnergy/pull/144)，merge `db57fbc7aeb7b9ebceddcc69c6d2d90e41722f7f`
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

D-004 已完成设计侧交付，现进入项目负责人评审：把 D-003 已接受的核心高保真页面连接成可点击、可演练、可由 C-003/C-004/C-009 无歧义实现的首日体验与历史日回看，并固定异常恢复、无障碍、Visual QA 和页面 PR 设计证据合同。

D-004 只做 Prototype / design QA / developer handoff；不实现 C 系列业务页面、真实 API、数据库、微信平台行为或生产视觉回归基础设施。

## 2. 前置与依赖状态

- D-003 已于 2026-08-18 获项目负责人接受；PR #144 已合并，Issue #101 已关闭；
- E-004 已 Done；D-004 两个直接前置均满足；
- D-002 Accepted Token/Component 继续是唯一设计系统来源；
- D-004 **尚未 Accepted**，因此 C-003、C-004、C-009 继续被依赖 Gate 阻断；
- D-005 保持 Planned，不提前启动。

本 ChatGPT/Figma/GitHub connector 会话不能执行用户本机 checkout 的 `pnpm agent:prepare` / `agent:validate`。已按 AGENTS fallback 实际读取 AGENTS、PROJECT_CONTEXT、D-004 Issue、Accepted design/interaction/state/testing/analytics 源，并直接检查 GitHub/Figma 原始证据。为减少 Actions 消耗，本轮不另造远端验证；唯一一次 PR CI 作为当前分支最终自动化 Gate。

## 3. Figma 交付

Figma file key：`T5HS32Ciz6LZh81KbqhFGo`

### Prototype source

- Page：`D-003 / Core Flow High Fidelity`
- Page ID：`220:2`
- Start Frame：`220:3` — ENT-001 Normal
- D-003 正式 Frame：35 / 35，ID 全部保持不变

首日路径：

`220:3 ENT → 220:7 ONB → 220:11 DLY-001 → 220:16 DLY-002 → 220:20 DLY-003 → 220:25 Completed`

历史删除：

`220:20/220:25 → 220:27 REC-002 → 295:227 Confirm → 220:34 Deleting → 220:29 Empty`

Offline / Recoverable Error / Safety 恢复均已连接，并保持同一逻辑意图语义。

### D-004 Prototype-only 场景

- `295:227` — REC-002 Delete Confirm
- `303:210` — Template Fallback Silent
- `303:245` — Personalization Reduced

完整模板 fallback 与个性化减少已拆分：完整受控模板结构完整时用户侧静默；只有明显缺少个性化时才出现中性提示。两者均保持同一 core result identity。

### Visual QA Baseline

- Page：`D-004 / Visual QA Baseline`
- Page ID：`303:275`
- durable raster snapshot：15 个

覆盖 ENT、ONB、DLY-001、DLY-002 Loading、DLY-003 Normal/Completed/Offline、REC-002、删除确认、Deleting、Safety、Large Text、Reduced Motion、Silent Fallback、Personalization Reduced。

Snapshot 只用于视觉比较；可编辑权威仍是 source Frame + D-002 Component/Token。

## 4. 已发现并修复的设计缺陷

### D004-D01 — Fallback 语义混合

问题：完整模板 fallback 与个性化减少若共用同一“简洁版本”提示，会违反 Accepted “完整模板静默，明显减少才提示”。

处理：

- 新增 `303:210` Silent Template Fallback；
- 新增 `303:245` Personalization Reduced；
- `220:17` DLY-002 Fallback prototype 改连 `303:210`。

状态：RESOLVED。

### D004-D02 — ConfirmSheet 长文案挤压

问题：`DE / ConfirmSheet` 原 Body 宽度过窄，删除影响文案会和行动区挤压。

处理：在原 D-002 Component ID `190:683` 上 production hardening，不复制组件：

- Body 可用宽度扩到 254；
- Body 自然高度；
- Component 高度调整到 146；
- 保留 Component ID / Properties；
- 删除确认实例重新居中；
- Visual QA baseline `303:284` 已刷新。

状态：RESOLVED。

## 5. 内部 QA 结果

Figma bounded audit：

- official Frame：35 / 35
- missing official Frame：0
- reaction node：29
- broken reaction destination：0
- ON_CLICK target <44px：0
- ChoiceChip：17
- ChoiceChip min height：44px
- 非颜色 Selected 提示：`✓ 平稳 / ✓ 一般 / ✓ 还可以`
- Reduced Motion `248:105` reaction count：0
- Prototype-only Hotspot：5，全部 ≥44px
- Visual QA snapshot：15
- Accepted D-003 Frame ID 改写：0

内部 scripted walkthrough 已覆盖 20 个场景：首日、重复点击、签到/生成失败、Offline、同任务恢复、Silent Fallback、Personalization Reduced、今日内容恢复、历史回看、删除/取消、Deleting、Safety、Safety 资源失败、Large Text、Reduced Motion、当日重进和跨产品日 implementation note。

跨产品日的服务端 `product-date-v1`、CAS、数据库唯一约束和删除 SLA 不是 Figma 可证明事项，必须由后续实现/测试 Gate 证明。

## 6. 开发交付文档

Draft：`docs/design/developer-handoff.md`

已记录：

- Prototype URL / start Frame / flow entries；
- 35 个正式 Frame + D-004 场景 Frame/Hotspot 索引；
- 首日/历史删除 Reaction Map；
- Recovery / Fallback / Safety 行为；
- D-002 Component/Token/geometry 复用合同；
- Accepted analytics 触点和数据最小化边界；
- Accessibility / 375px / Large Text / Reduced Motion；
- 20 项内部脚本化回归；
- 15 个 Visual QA baseline；
- C-003/C-004/C-009 PR 强制 Frame/截图/Token/组件/恢复/测试证据；
- 设计差异记录和外部研究授权边界。

项目负责人接受前保持 Draft。

## 7. 项目状态一致性

本分支已经同步：

- [x] `README.md` — D-003 Done / D-004 In Review / D-005 Planned
- [x] `docs/INDEX.md` — D-003 Accepted、D-004 Draft 与当前读取顺序
- [x] `docs/design/README.md` — D-004 Prototype / baseline 导航
- [x] `tasks/backlog.md` — D-003 Done / D-004 In Review / D-005 Planned
- [x] `tasks/current.md` — 本交接

下游 C-003/C-004/C-009 仍保持 Planned；D-004 只有项目负责人明确接受后才会解除前置。

## 8. CI / GitHub Actions 使用约束

项目负责人于 2026-08-18 明确要求：**减少 CI，尽量只做一次 CI**。

仓库 `CI` workflow 在 `pull_request` 和 `push main` 触发；本轮执行策略：

1. 所有 Figma、文档、状态和 connector QA 已在无 PR 分支先收口；
2. 创建 Draft PR 才触发本任务第一次、也是计划中的唯一一次 PR CI；
3. 不主动 rerun；只有唯一 CI 暴露真实 blocker 才诊断是否需要最小修复；
4. 不为写回 PR 编号或 CI 结果追加无业务价值的提交，以免再触发 CI。

## 9. Acceptance Gate

已完成：

- [x] D-003 / E-004 前置确认
- [x] 首日主路径 Prototype
- [x] 历史回看 / Back / Delete Confirm / Deleting / Empty
- [x] Offline / Error / Safety 恢复
- [x] Silent Fallback / Personalization Reduced 分离
- [x] ConfirmSheet defect 修复
- [x] 44px / reaction / Frame / ChoiceChip / Reduced Motion 审计
- [x] 20 项内部 scripted walkthrough
- [x] 15 个 durable Figma Visual QA baseline
- [x] `developer-handoff.md` Draft
- [x] C-003/C-004/C-009 设计证据合同
- [x] README / INDEX / design README / backlog / current 状态同步

待评审：

- [ ] 创建 Draft PR 并完成唯一一次 PR CI
- [ ] 项目负责人审核 Figma Prototype、Visual QA baseline、developer handoff 和 PR
- [ ] 明确接受后把文档改为 Accepted、关闭 Issue #102
- [ ] D-004 Done 后让 D-005 成为唯一 Ready；不提前开始 D-005

## 10. 外部/平台未决边界

- 外部 5～8 人研究未获招募/隐私/联系/补偿授权，不执行；
- Safety 生产文案与地区资源继续需要独立专业评审；
- 微信 DevTools / 真机证据按现有平台 Gate 继续处理；
- Production PostgreSQL restore、on-call、Production identity/legal/region/cross-border 等未决项继续阻止 Production/RC readiness。

## 11. 精确下一动作

1. 复核 branch diff 仅包含 D-004 设计/文档/状态内容；
2. 创建一个 Draft PR，触发计划中的唯一一次 PR CI；
3. 不主动 rerun；读取该 CI 结果；
4. 将 Figma Prototype + Visual QA + Draft PR 交项目负责人审核；
5. 用户明确接受前不把 D-004 标为 Done，不启动 D-005。

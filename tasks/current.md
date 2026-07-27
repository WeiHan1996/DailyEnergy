# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-07-27
- **当前阶段**：Phase 0B — 开发前详细规格
- **当前任务 ID**：S-34
- **当前任务名称**：Phase 1～3 工程 Issues
- **任务状态**：Blocked
- **优先级**：最高
- **当前分支**：`agent/phase-1-3-engineering-issues`
- **上游 PR**：[S-33 PR #38](https://github.com/WeiHan1996/DailyEnergy/pull/38)
- **当前 PR**：[Draft PR #87](https://github.com/WeiHan1996/DailyEnergy/pull/87)
- **交付**：3 个 GitHub Milestones、48 个工程 Issues、依赖/估算与项目控制同步

## 1. 当前目标

把 S-01～S-33 的 Accepted 结论转换为可以按一个主要 PR 独立验收的 Phase 1～3 工程任务：

- Phase 1 工程基础：14 个 E Issues；
- Phase 2 确定性核心闭环：17 个 C Issues；
- Phase 3 AI 陪伴层：17 个 AI Issues；
- 每个 Issue 明确权威输入、范围、验收、测试、前置、非目标和理想工程日；
- 三阶段各有真实 GitHub Milestone，不用标签或 tracking issue 冒充；
- S-34 完成后由 S-35 做 Phase 0B Gate，尚不直接开始编码。

## 2. 已完成

- [PR #38](https://github.com/WeiHan1996/DailyEnergy/pull/38) 已于 2026-07-27 合并，S-33 已获用户明确确认；
- `docs/technical/observability.md` 已在本分支补记 Accepted，不改变信号、SLO、成本或 48 个场景；
- 已创建并回读 48 个 open Issues，ID 和标题唯一：
  - E-001～E-014（[E-001](https://github.com/WeiHan1996/DailyEnergy/issues/39)、[E-002](https://github.com/WeiHan1996/DailyEnergy/issues/41)、[E-003](https://github.com/WeiHan1996/DailyEnergy/issues/40)、[E-004](https://github.com/WeiHan1996/DailyEnergy/issues/42)、[E-005](https://github.com/WeiHan1996/DailyEnergy/issues/43)、[E-006](https://github.com/WeiHan1996/DailyEnergy/issues/44)、[E-007](https://github.com/WeiHan1996/DailyEnergy/issues/45)、[E-008](https://github.com/WeiHan1996/DailyEnergy/issues/46)、[E-009](https://github.com/WeiHan1996/DailyEnergy/issues/47)、[E-010](https://github.com/WeiHan1996/DailyEnergy/issues/49)、[E-011](https://github.com/WeiHan1996/DailyEnergy/issues/48)、[E-012](https://github.com/WeiHan1996/DailyEnergy/issues/50)、[E-013](https://github.com/WeiHan1996/DailyEnergy/issues/51)、[E-014](https://github.com/WeiHan1996/DailyEnergy/issues/52)）
  - C-001～C-017（[C-001](https://github.com/WeiHan1996/DailyEnergy/issues/53)、[C-002](https://github.com/WeiHan1996/DailyEnergy/issues/54)、[C-003](https://github.com/WeiHan1996/DailyEnergy/issues/55)、[C-004](https://github.com/WeiHan1996/DailyEnergy/issues/56)、[C-005](https://github.com/WeiHan1996/DailyEnergy/issues/57)、[C-006](https://github.com/WeiHan1996/DailyEnergy/issues/58)、[C-007](https://github.com/WeiHan1996/DailyEnergy/issues/59)、[C-008](https://github.com/WeiHan1996/DailyEnergy/issues/62)、[C-009](https://github.com/WeiHan1996/DailyEnergy/issues/60)、[C-010](https://github.com/WeiHan1996/DailyEnergy/issues/61)、[C-011](https://github.com/WeiHan1996/DailyEnergy/issues/63)、[C-012](https://github.com/WeiHan1996/DailyEnergy/issues/64)、[C-013](https://github.com/WeiHan1996/DailyEnergy/issues/70)、[C-014](https://github.com/WeiHan1996/DailyEnergy/issues/65)、[C-015](https://github.com/WeiHan1996/DailyEnergy/issues/68)、[C-016](https://github.com/WeiHan1996/DailyEnergy/issues/66)、[C-017](https://github.com/WeiHan1996/DailyEnergy/issues/69)）
  - AI-001～AI-017（[AI-001](https://github.com/WeiHan1996/DailyEnergy/issues/67)、[AI-002](https://github.com/WeiHan1996/DailyEnergy/issues/71)、[AI-003](https://github.com/WeiHan1996/DailyEnergy/issues/72)、[AI-004](https://github.com/WeiHan1996/DailyEnergy/issues/73)、[AI-005](https://github.com/WeiHan1996/DailyEnergy/issues/74)、[AI-006](https://github.com/WeiHan1996/DailyEnergy/issues/75)、[AI-007](https://github.com/WeiHan1996/DailyEnergy/issues/76)、[AI-008](https://github.com/WeiHan1996/DailyEnergy/issues/77)、[AI-009](https://github.com/WeiHan1996/DailyEnergy/issues/78)、[AI-010](https://github.com/WeiHan1996/DailyEnergy/issues/79)、[AI-011](https://github.com/WeiHan1996/DailyEnergy/issues/84)、[AI-012](https://github.com/WeiHan1996/DailyEnergy/issues/82)、[AI-013](https://github.com/WeiHan1996/DailyEnergy/issues/86)、[AI-014](https://github.com/WeiHan1996/DailyEnergy/issues/81)、[AI-015](https://github.com/WeiHan1996/DailyEnergy/issues/85)、[AI-016](https://github.com/WeiHan1996/DailyEnergy/issues/80)、[AI-017](https://github.com/WeiHan1996/DailyEnergy/issues/83)）
- 每项都包含权威输入、4 项左右范围、4 项验收、必须测试、依赖、非目标和 1.5～3 个理想工程日；
- 估算基线：Phase 1 为 35、Phase 2 为 43.5、Phase 3 为 44，总计 122.5 个 AI 辅助理想工程日；
- 估算不是发布日期，必须在 E-001～E-003 后按实际 cycle time 重新校准；
- 外部实现 Gate 已写入对应 Issue，E-012 等任务不会假装云厂商、域名、生产凭据或值班已经确定。

## 3. 当前阻塞

当前 GitHub 连接器可以创建/更新 Issue 并按编号绑定已有 Milestone，但不提供创建或列出 Milestone 的动作。仓库此前没有 Issue；本轮 48 个 Issue 回读后 `milestone=null`。

解除条件：仓库所有者在 GitHub 创建以下三个**空 Milestone**，然后提供各自 URL 或编号：

1. `Phase 1 — 工程基础`
2. `Phase 2 — 确定性核心闭环`
3. `Phase 3 — AI 陪伴层`

要求：

- 暂不设置 due date，避免在 E-001～E-003 校准前制造虚假日期精度；
- 不需要手工移动 48 个 Issue；
- 获得三个 Milestone 编号后，由连接器批量绑定 14 / 17 / 17 个 Issue；
- Milestone 描述、阶段目标与 Gate 在绑定后补齐；若 UI 创建时必须填写描述，可先留空。

## 4. 验收标准

- 三个真实 GitHub Milestone 存在，名称唯一且无虚假 due date；
- 48 个 Issue 全部 open、ID/标题唯一并绑定到正确 Milestone；
- 每个 Issue 均有权威输入、范围、验收、测试、前置、非目标和估算；
- 依赖图只引用这 48 个已定义 ID，不存在缺失或循环；
- Phase 1/2/3 Gate 分别为 E-014、C-017、AI-017；
- README、INDEX、current、backlog 与 GitHub 外部状态一致；
- PR 只包含 S-33 接受记录和项目控制 Markdown，不包含工程代码、配置、workflow、migration、云资源或生产变更；
- 用户确认前 S-34 不标 Done，S-35 不标 Ready。

## 5. 不做

- 不开始 E-001 或任何业务代码；
- 不创建假的 Milestone 标签、tracking issue 或 Projects board 代替 GitHub Milestone；
- 不设置 Alpha/Beta 发布日期或 Phase due date；
- 不创建云资源、域名、微信 AppID、provider key、监控账号、值班通道或生产 secret；
- 不改变 Accepted 产品、Schema、API、隐私、Safety、架构、测试、部署或可观测性合同。

## 6. 最近交接

- 当前动作：等待三个真实 Milestone 的 URL/编号；
- 收到后：批量绑定 48 个 Issue → 回读 14/17/17 数量 → 回填 Draft PR 指针 → 完成 S-34 审核交接；
- S-34 被用户确认并合并后：标记 S-34 Done，把 S-35 Phase 0B Gate 评审设为唯一 Ready；
- 不自动开始 E-001；只有 S-35 明确通过后才进入 Phase 1。

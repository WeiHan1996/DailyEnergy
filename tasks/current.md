# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-20
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-003 — 实现“第一次认识”流程
- **任务状态**：Ready
- **任务 Profile**：`code`（正式页面实现必须补充 D-004 原始 Frame 与人工视觉证据；变更路径可将有效 Profile 提升为 `hybrid` 或 `security`）
- **当前实现分支**：尚未创建；建议 `agent/c-003-onboarding`
- **当前状态收尾分支**：`agent/c-002-closeout`
- **当前 Issue**：[C-003 Issue #55](https://github.com/WeiHan1996/DailyEnergy/issues/55)
- **当前 PR**：无
- **最近完成任务**：C-002 已随 PR #152 squash 合并为 `56695b5f7e8e08fedd1cc0b19dc3bd380ecb1d41`，Issue #54 已关闭
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

打通承接边界说明到首次认识完成的最小流程，并支持中断草稿恢复。

C-003 范围：

- 实现 ENT-001 / ONB-001 页面与 C-002 资料、偏好 API 编排；
- 只询问可选称呼与封闭表达偏好，并允许明确跳过；最近状态由后续 DLY-001 / C-004 承接；
- 实现本地短期草稿、服务端完成事实、重复提交幂等与返回路由；
- 覆盖 loading、offline、error、permission、Safety 与跨日 UI 状态；
- 匹配 D-004 已接受 Frame，复用 D-002 语义 Token 与组件，并登记 Source ID 证据。

不实现长问卷、人格角色选择、AI 对话、每日签到、渠道投放或新的资料字段。

## 2. 前置与完成状态

- C-002 final head `07a14273100f82b12cd71195e7d3423c2fc15f24` 的 CI run `32375703841`
  同一 run 11/11 SUCCESS，exact-head verifier 通过；
- C-002 已使用 `--match-head-commit` squash 合并为 `56695b5f7e8e08fedd1cc0b19dc3bd380ecb1d41`，Issue #54 已关闭；
- C-002 merged-main CI run `32376084255` 在精确 merge SHA 上同一 run 11/11 SUCCESS；
- C-002 人工 threat-boundary review 与项目所有者产品/安全边界确认已完成；生产称呼 key
  接线随 Production `NO_GO` 延后，本次未授予 Production / RC 发布权限；
- E-016 已完成：仓库为 public、保持无 LICENSE，`main` 由无 bypass ruleset 强制 11 个 strict required checks；
- E-004 微信小程序骨架与 D-004 已接受高保真开发交付均完成；
- C-003 的直接前置 C-002、E-004、D-004 已满足，Issue #55 保持 Open；
- C-002 已提供封闭 consent/profile/preferences Schema、session-owner 服务端绑定、CAS/幂等、
  默认关闭偏好、平台权限分离与 AES-256-GCM 称呼保护，C-003 必须复用这些边界；
- Production / RC 继续 `NO_GO`，C-003 不包含生产微信凭据或发布授权。

## 3. 开始前必须恢复的权威来源

下一位 Agent 必须先运行：

```text
pnpm agent:prepare C-003 --remote --deep
```

并完整读取命令返回的 required sources，至少包括：

- `docs/product/journey.md`；
- `docs/product/state-machine.md`；
- `docs/design/screen-specs.md`；
- `docs/design/content-layout.md`；
- `docs/design/design-system.md`；
- `docs/design/developer-handoff.md`；
- `docs/design/screen-inventory.md` 与 `docs/design/interaction-states.md`；
- `docs/technical/api.md`、C-002 Schema / API client / 测试、Source fixtures 与附近小程序代码。

若 Accepted Frame、状态机、Schema、API、隐私或 Safety 边界冲突，先停止并回到上游处理，不自行猜测。

## 4. 必须保持的边界

- 未接受当前必要同意不能进入 ONB-001；离线页不能伪造同意或完成事实；
- 称呼为可选且可留空，表达偏好使用封闭枚举，不新增自由画像或强制资料；
- owner 只能来自服务端 session principal；重复、中断、多端提交不得创建第二份 profile 或完成事实；
- 本地草稿必须短期、最小、可清理；服务端权威状态决定恢复与跳过，不由客户端猜测；
- Safety、删除、撤回和权限状态优先；错误、重试与跨日恢复保持同一逻辑意图；
- 匹配 ENT-001 `220:3-6`、ONB-001 `220:7-10`，视觉差异必须在 PR 中说明并人工审核；
- C-003 完成后只路由到 DLY-001，不在本任务实现 C-004 每日签到。

## 5. 验收与证据

- 覆盖首次、跳过、中断、重复、离线、失败、跨日和多端 E2E 与页面状态；
- 证明中断恢复不重复创建 profile / onboarding completed，同日重进跳过已完成步骤；
- 提供 D-004 Frame ID、正常与异常状态实现截图、Token / 组件复用和可访问性证据；
- 本 Issue 覆盖的 Accepted Source ID 从 `PLANNED` 更新为 `COVERED`；无法覆盖时只允许有批准理由的 `NA_WITH_REASON`；
- 提交审核前运行有效 Profile 要求的 full Gate，并取得 PR exact head 的同一 run 11/11 平台 CI；
- 自动化不得冒充原始 Frame 对照、截图视觉 QA、真机 / DevTools 检查或用户决定。

## 6. 精确下一步

1. 审核并合并纯状态收尾 PR，使 `main` 正式记录 C-002 Done 与 C-003 Ready；
2. 从最新 `main` 创建 `agent/c-003-onboarding`；
3. 运行 `pnpm agent:prepare C-003 --remote --deep` 并完整读取全部 required sources；
4. 对照 D-004 Frame、C-002 可执行契约和现有小程序代码，校准 Requirement-to-Proof Matrix 与聚焦 PR 计划后再实现；
5. 不提前开始 C-004，也不取得或推断 Production / RC 发布权限。

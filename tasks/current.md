# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-20
- **当前阶段**：Phase 2 — 确定性核心闭环
- **当前任务**：C-002 — 实现必要同意、用户资料与表达偏好
- **任务状态**：In Review
- **任务 Profile**：`security`（任务基线为 `code`；因隐私字段保护、同意撤回、删除钩子与数据库权限边界提升）
- **当前实现分支**：`agent/c-002-consent-profile`
- **状态收尾**：PR #150 已 squash 合并为 `234f145a24285097cd261bd715e6d45c6022f953`
- **当前 Issue**：[C-002 Issue #54](https://github.com/WeiHan1996/DailyEnergy/issues/54)
- **当前 PR**：[Draft PR #152](https://github.com/WeiHan1996/DailyEnergy/pull/152)
- **最近完成任务**：C-001 已随 PR #147 squash 合并为 `505a926f8830591cf305346219c86280660cd196`，Issue #53 已关闭
- **Phase Gate 结论**：`CONDITIONAL_GO_FOR_PHASE_2 / PRODUCTION_NO_GO`

## 1. 当前目标

实现必要同意版本、最小用户资料和可修改表达偏好，并让撤回与删除语义可审计。

C-002 范围：

- consent / profile / preferences command 与 query；
- revision / CAS 和当前有效同意版本；
- 区分必要同意、可选资料及可选通知 / 记忆用途，默认最小化；
- 支持称呼、表达偏好和允许字段修改，禁止自由扩展画像；
- 更新用户可见说明、数据地图和 Source ID 实现证据；
- 注册撤回、导出与删除钩子及期限。

不收集通讯录、位置、设备指纹、自动外部数据或画像推断。

## 2. 前置与完成状态

- C-001 已完成：final PR head `0104b978dfd96e82e4de7ceb1e303c80e246ae61` 的 CI run
  `32353095120` 同一 run 11/11 SUCCESS，exact-head verifier 通过；
- C-001 已使用 `--match-head-commit` squash 合并为 `505a926f8830591cf305346219c86280660cd196`，Issue #53 已关闭；
- C-001 merged-main CI run `32353421328` 在精确 merge SHA 上同一 run 11/11 SUCCESS；
- 状态收尾 PR #150 的 final head run `32353924573` 与 merged-main run `32354195311` 均为 11/11 SUCCESS；
- E-016 已完成：仓库为 public、保持无 LICENSE，`main` 由无 bypass ruleset 强制 11 个 strict required checks；
- D-001～D-005 正式视觉前置均已 Accepted；
- C-002 的直接前置 C-001 已满足，Issue #54 保持 Open；
- C-002 已实现封闭 consent/profile/preferences Schema、session-owner 绑定 Nest 应用服务、PostgreSQL 事务适配器、当前必要同意版本解析、CAS/幂等/并发、默认关闭偏好和平台权限分离；
- 称呼使用 AES-256-GCM 版本化 codec；LOCAL/CI/DEV 使用合成开发 key，发布环境未注入批准 key 时 fail closed，Production / RC 继续 `NO_GO`；
- C-002 migration 已收紧 API 角色列权限和删除/不可变字段权限，历史 profile revision 到期不再阻断当前 Profile 后续修改；
- 生命周期登记已覆盖导出白名单、同意/偏好撤回效果、删除 scope、称呼 72 小时、结构 revision 30 天和替代同意回执 6 个月期限；
- Source registry 为 784 项：222 `COVERED`、562 `PLANNED`；S-17 新增 48 项，仅 `D17-I03`、`D17-I04` 由 C-002 覆盖；
- Production / RC 继续 `NO_GO`，本任务不包含生产微信凭据或发布授权。

## 3. 开始前必须恢复的权威来源

下一位 Agent 必须先运行：

```text
pnpm agent:prepare C-002 --remote --deep
```

并完整读取命令返回的 required sources，至少包括：

- `docs/product/state-machine.md`；
- `docs/operations/privacy-data-map.md`；
- `docs/technical/api.md`；
- `docs/decisions/ADR-0005-data-retention-and-deletion.md`；
- `docs/design/screen-inventory.md`；
- `docs/design/interaction-states.md`；
- `docs/technical/testing.md`；
- 相关 Schema、OpenAPI、Prisma、测试、fixtures 与附近代码。

若 Accepted 文档、Schema、API 或删除语义冲突，先停止并回到 ADR / 规范处理，不自行猜测。

## 4. 必须保持的边界

- 未接受当前必要同意不能进入普通旅程；拒绝不产生多余资料；
- 同 revision 并发修改只能一个成功；owner 只能来自服务端 session principal；
- 只允许明确 allowlist 字段，响应不得泄露内部字段或 provider 身份信息；
- 偏好修改只影响未来生成，不改写历史结果；
- 撤回、导出、删除钩子与期限遵循 Accepted ADR-0005 和隐私数据地图；
- 所有外部输入必须服务端验证，写入必须具备幂等、唯一性和可审核证据；
- 不降低 Safety、删除、事务、运行 profile、日志脱敏或 client-safe 边界。

## 5. 验收与证据

- Shared schemas 6 files / 41 tests、server adapters 10 files / 40 tests、API 15 files / 71 tests 均通过；C-002 HTTP E2E 4/4 通过；
- 真实 PostgreSQL C-002 invariant test 通过，覆盖当前同意版本、原子 onboarding、同 revision 并发、跨操作幂等冲突、revision 历史清理、撤回门控、owner 隔离和列权限；
- C-001 真实 PostgreSQL 身份回归通过；数据库全套 integration 83/83 通过；migration checksum、catalog fingerprint、Source registry 和 Phase Gate 均通过；
- 最终 changed Gate：`MANUAL_EVIDENCE_REQUIRED | automated=PASS | profile=security | mode=changed→full`；
- 最终 C-002 full Gate：`MANUAL_EVIDENCE_REQUIRED | automated=PASS | profile=security | mode=full→full`；
- 两个 Gate 均使用仓库精确 Node `24.18.0`；本机镜像不提供 audit endpoint，验证命令仅临时忽略用户级镜像并使用 npm 官方 endpoint，结果 critical/high 均为 0；
- Draft PR #152 的实现与 PR 交接 head `c3a2cff8dfbf5cedadfe1670ace957865e01127c` 对应 CI run `32364714547`，同一 run 11/11 SUCCESS；最终 head 状态以 PR required checks 为准；
- 待完成：security/privacy 人工 threat-boundary review、适用时的 production authorization；这些证据不得由自动化冒充 `PASS`。

## 6. 精确下一步

1. 完成 session-owner、称呼 key、数据库列权限、撤回竞态与删除传播的人工 threat-boundary review；
2. 明确确认发布环境称呼 key 文件接线仍随 Production `NO_GO` 延后，或在本 PR 内补充获批的生产 wiring；
3. 用户审核通过后再标记 ready、合并、关闭 Issue #54，并把 C-002 设为 Done、C-003 设为唯一 Ready；审核前不开始 C-003。

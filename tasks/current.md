# DailyEnergy 当前任务

- **文档状态**：Active
- **最后更新**：2026-08-02（PR #110 补充修复获授权合并）
- **当前阶段**：Phase 1 — 工程基础
- **当前任务**：E-006 — PostgreSQL 与 Prisma（PR #108 安全返工）
- **任务状态**：In Review
- **任务分支**：`agent/pr108-security-fixes`
- **当前 Issue**：基于 Issue #44 修复
- **当前 PR**：[Draft PR #110](https://github.com/WeiHan1996/DailyEnergy/pull/110)
- **基线提交**：`e9f02436ff36e9acaf1d34acb353c678453d985e`
- **Gate 结论**：`INFRA_BLOCKED`（full Gate 未启动；用户已明确接受该缺口并授权合并）

## 1. 当前目标

修复 PR #108（E-006 PostgreSQL 基线）及 PR #110 首轮实现复审确认的安全缺陷：

1. SQL-007 未在 TX-02 snapshot 提交边界阻止跨账户、日期或 revision 不一致；
2. SQL-013 可通过 visibility 状态切换、`resultId` 重绑定和 weekly current 指向绕过；
3. Safety/Deletion 角色需分离，且分别具备 TX-05/TX-09 outbox 写入能力；
4. factory 真实启动遇到 PostgreSQL native type，且未比较直接 column grant；
5. 旧环境缺少新增 group role 时，migration 没有稳定的 bootstrap-required preflight。
6. SQL-007 helper 的函数 ACL 必须允许真实运行角色完成 deferred trigger；
7. factory 必须拒绝 grant option、角色 ADMIN OPTION 与 replication 属性越权。

属于对 E-006 合并后发现的安全缺陷紧急修复，完成后回到 E-007。

修复范围仅限 PostgreSQL migration、DB factory、相关测试和证据清单，不涉及
业务逻辑或下游任务。

## 2. 状态变更影响

- PR #108 合并后的安全复审发现三个 P1 缺陷，全部在真实 PostgreSQL 18 上复现；
- 按 AGENTS.md §2 紧急缺陷规则，E-006 在合并后重新进入 In Progress；PR #110
  首轮实现及本地返工经补充复审发现 snapshot 历史 lineage、BLOCKED visibility
  删除/重绑定和 PostgreSQL 18 权限探针仍有遗漏，当前正在修复；
- 修复通过后立即回到 E-007，不扩大范围；
- E-006 相关的测试注册表 COVERED 声明需要校准补充。

## 3. 范围

- 新增一条 versioned migration，修复 SQL-007、SQL-013 触发器覆盖缺口；
- 拆分 `daily_energy_restricted` 为 `daily_energy_safety` 与 `daily_energy_deletion`
  两个角色，各自最小授权；
- 强化 `createClosedDatabaseFactory` 的 capability 探针：不只检查 profile 角色
  成员，还要断言无额外 DML、无额外角色成员；
- 补充对应负向 PostgreSQL 集成测试，并在真实 PG 18 上重新验证；
- 更新 evidence-manifest 的 COVERED 登记。

## 4. 不做

- 不改业务逻辑、不引入新功能、不碰 Redis/BullMQ 或 E-007 范围；
- 不连接或修改生产数据库，不使用真实账号、密钥或用户数据；
- 不创建新的 Accepted ADR 或修改已有 Accepted 规格；
- 不放宽 Accepted Schema、API、隐私、Safety、删除、幂等、事务、profile 或
  可观测性边界。

## 5. 验收与证据

- SQL-013 的 visibility 激活路径与 weekly current 切换路径均被拒绝；
- SQL-007 的跨主 checkin snapshot 路径被拒绝；
- safety 与 deletion 角色能力分离，factory 能检测直接越权 grant；
- 数据库集成、生命周期和事务测试在返工后全部通过；
- 真实 PostgreSQL 18 上验证通过；
- evidence-manifest 中 SQL-007、SQL-013 保持/更新为 `COVERED`；
- 运行安全 Gate。

## 6. 当前阻塞与决策

- **仓库/代码阻塞**：无；本轮实现、checksum、catalog fingerprint 与证据更新已完成；
- **环境授权**：用户已明确允许在沙箱外运行 E-006 full Gate；
- **迁移状态决定**：用户确认安全修复 migration 从未应用到任何共享环境，因此本轮可在
  首次应用前更新原 migration 和 checksum；应用时作为 split-role 协调安全切换，不支持回滚旧不安全运行时；
- **安全人工证据**：security profile 仍需人工 `threatBoundaryReview`；
  `productionAuthorizationWhenApplicable` 为 N/A（只使用本地合成 PostgreSQL 18，未访问生产）；
- **前置依赖**：PR #108 已合并为基线 `e9f0243`；
- **外部依赖**：本地 Docker 运行 PostgreSQL 18；
- **并行规则**：唯一当前审核任务是 E-006 安全返工；E-007 保持 Planned；
- **既有验证**：上一轮真实 PostgreSQL 18 与静态验证曾通过，但已被本轮 migration、factory
  和测试修改失效，不得复用为本轮 PASS；
- **提交前验证**：format、lint/architecture/contracts、typecheck、build、database static/evidence、
  server-adapters `8/8`、worker、miniapp、shared-schema 与 API-client 测试通过；根测试仅因沙箱禁止
  Admin Playwright 绑定 `127.0.0.1:3210` 中止；
- **完整 Gate**：两次申请沙箱外运行 `pnpm agent:validate --mode=full --task=E-006` 均在进程启动前
  被审批服务 `codex-auto-review` 404 阻断，真实 PostgreSQL 18 与完整端口测试未在本轮最终修改后重跑；
- **风险决定**：用户在获知上述缺口后明确授权提交、将 Draft PR #110 转 Ready 并合并；不得把该决定
  记录为 automated PASS，`threatBoundaryReview` 仍未完成；
- **下一动作**：提交、推送、更新并合并 PR #110；合并后核对 main，将 E-006 设为 Done 并提升 E-007；
- **下一任务**：修复合并后回到 E-007。

## 7. 最近交接

- E-006 已随 [PR #108](https://github.com/WeiHan1996/DailyEnergy/pull/108)
  squash 合并，merge commit 为
  `e9f02436ff36e9acaf1d34acb353c678453d985e`，Issue #44 已关闭；
- 用户于 2026-07-31 要求对已合并的 PR #108 再次复审，复审发现三条 P1 安全缺陷；
- 用户要求立即修复；按 AGENTS.md §2 紧急缺陷规则中断 E-007 并创建本任务；
- 修复分支 `agent/pr108-security-fixes` 基于 `e9f0243`。
- PR #110 首轮实现复审发现真实 factory 启动、TX-02 snapshot、visibility rebind、
  column grant、Safety outbox 和 N-1 role provisioning 缺口；必要方向保留并重做，
  无证据的完成声明已撤回；
- 本轮返工在临时 PostgreSQL 18 上通过 78/78，未访问生产环境；新增证据覆盖 helper
  EXECUTE ACL、错误 revision、grant option、membership ADMIN OPTION 与 replication
  fail-closed；
- 2026-08-02 的 format/lint/typecheck/build、server-adapters 与 database static/evidence
  均通过；完整 Gate 的沙箱外执行被审批服务 404 阻断，解锁条件见“下一动作”。
- 用户确认本 migration 从未应用到共享环境，并授权调整、完整 Gate、提交、推送和更新
  Draft PR #110；随后在获知 full Gate 因审批服务 404 未启动后，明确授权直接提交、转 Ready 并合并，
  同时保留未完成自动 Gate 与人工 threat-boundary 复核的风险记录。

# DailyEnergy Phase 2 确定性核心 Gate

- **文档状态**：Draft
- **所属任务**：C-017 — 执行 Phase 2 确定性核心 Gate
- **评审日期**：2026-09-07
- **接受日期**：待项目所有者确认
- **评审基线**：`main@57529035071348e322d77c0e9b99237973da45a7`
- **机器合同**：[C-017 Phase Gate contract](../../tests/phase-gate/c017-contract.json)
- **人工证据**：[C-017 manual evidence](../../tests/manual-rc/c017-evidence.json)
- **最终建议**：`RECOMMEND_GO_FOR_PHASE_3_DEVELOPMENT_PENDING_OWNER_REVIEW`
- **Production / Release Candidate**：`NO_GO`

## 1. 结论

```text
Phase 3 development: RECOMMEND_GO_FOR_PHASE_3_DEVELOPMENT_PENDING_OWNER_REVIEW
Production / Release Candidate: NO_GO
Alpha / real-user admission: NO_GO
Owner decision: PENDING_REVIEW
Threat boundary review: AGENT_PREPARED_OWNER_PENDING
Production authorization: NOT_GRANTED
```

当前证据支持进入 Phase 3 **开发**，因为 ROADMAP 的九项 Phase 2 退出门槛均有 Accepted
设计证据或可重复自动证明，确定性核心不依赖真实 AI provider 即可完成。该结论在项目所有者
审核前只是建议，不是 Accepted `GO`；C-017 合并前 AI-001 继续 Planned。

本 Gate 不批准 Production、RC、Alpha、真实用户、真实 provider、真实对象存储、公开服务或
招募。C-015 的 Production bundle、处理主体/位置/受托方/跨境、最终用户说明与合格法律审核
继续 Blocked。任何开发结论都不能抵消这些阻塞项。

## 2. 判定边界

本 Gate 负责：

- 按 ROADMAP 逐项验证 Phase 2 退出门槛；
- 绑定 C-016 final head、同 run CI、merge 与 merged-main 收据；
- 复核真实 PostgreSQL 18、Redis 8、BullMQ 5 与 Nest HTTP 的组合 E2E；
- 给出合成性能、可靠性和数据质量基线；
- 证明 Source-ID registry 没有 silent omission，并如实保留 PLANNED；
- 形成 Phase 3 development 的 go/fix/no-go 建议。

本 Gate 不负责：

- 把 Phase 3 的 Gateway、模型、Prompt、记忆或 Safety 专业证据提前标为完成；
- 把本地 synthetic 性能当作 Production SLO；
- 把 DevTools 或既有真机 no-replay 当作完整 named RC 设备矩阵；
- 选择或调用真实 AI provider；
- 改变隐私、数据保存、技术栈或产品定位；
- 自动接受报告、合并 PR 或启动 AI-001。

## 3. Phase 2 退出门槛

| ID            | ROADMAP 要求                                        | 结果 | 主要证据                                                                          |
| ------------- | --------------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| C017-EXIT-001 | 视觉方向、Design Tokens、核心与剩余页面交付已获确认 | PASS | Accepted D-001～D-005；design-system、core-flow、phase2-remaining handoff         |
| C017-EXIT-002 | 新用户可独立完成第一次点亮                          | PASS | C-016 real HTTP first-entry → consent → onboarding → check-in → result → light    |
| C017-EXIT-003 | 同一天重复打开结果一致                              | PASS | 第二 session 读取相同 result/interaction；历史冻结与唯一键                        |
| C017-EXIT-004 | 并发请求不产生重复结果                              | PASS | 双设备并发 check-in/generation/light；真实 PG unique/CAS/TX                       |
| C017-EXIT-005 | 晨间状态、今日能量和晚间反馈严格分离                | PASS | 独立权威表、Schema 与 weekly source projection                                    |
| C017-EXIT-006 | 中断和跨日期行为正确                                | PASS | 04:00/continuation fixtures；worker drain/rebuild；unknown outcome                |
| C017-EXIT-007 | 七天测试数据生成正确趋势                            | PASS | 七个连续 ProductDate、七个唯一结果/点亮、七日 weekly facts 与 summary             |
| C017-EXIT-008 | 删除主要数据后不再出现                              | PASS | 同步 DAY guard、Restricted Worker 清理、Redis rebuild、weekly 7→6 与一个 MISSING  |
| C017-EXIT-009 | 核心闭环端到端测试通过                              | PASS | PostgreSQL 18 + Redis 8 + BullMQ 5 + 三 Worker profile；provider calls=0；retry=0 |

这些 PASS 只说明退出门槛有相应强制证据层；它们不是 Production 或完整 MVP/Alpha 的通过声明。

## 4. 审计基线

| 项目                  | 收据                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| C-016 final PR head   | PR #183 `6636360a94b90c06072c073b9e030113da82e027`                                                     |
| C-016 exact-head CI   | run `34002759447`，11/11 SUCCESS                                                                       |
| C-016 squash merge    | `299e3e8082aae38063aaec7332749a407b7c4f54`                                                             |
| C-016 merged-main CI  | run `34007506687`，11/11 SUCCESS                                                                       |
| C-016 状态收尾 main   | `57529035071348e322d77c0e9b99237973da45a7`，run `34008347462`，11/11 SUCCESS                           |
| Source registry       | `562/1004 COVERED`、`442 PLANNED`、`0 NA_WITH_REASON`、`0 UNMAPPED`                                    |
| Mini Program DevTools | Stable `v2.01.2510290` / 基础库 `3.7.12`，11 个注册页面/路由 PASS；Service Port 已恢复关闭             |
| DEV_LITE              | Accepted synthetic-only 主机生命周期、回滚与 soak；`REAL_USER_DATA_PROHIBITED / PRODUCTION_INELIGIBLE` |

Phase 2 Milestone 的远端 Issue 状态已回读：D-001～D-005、C-001～C-014 和 C-016 均 Closed；
C-015 与 C-017 为仅有的 Open 项。C-015 的实现和 owner threat review 已合并，但其 Production、
Privacy 与 Legal 外部证据按批准的 development-only 例外继续 Blocked；C-017 不能借阶段 Gate
反向关闭它。

PR #183 首次 exact-head CI run `34001276671` 的 api-e2e 失败被保留，没有用重跑改写。根因是测试只
等待 outbox PUBLISHED，没有等待 Background Inbox/周投影事务结算；修复使用 PostgreSQL 可观察条件
要求 `FAILED/PENDING/TERMINAL=0` 且每个已发布事件存在完成 Inbox receipt，不增加 sleep、retry 或
timeout。后续 implementation head、final receipt head 和 merged-main 均 11/11。

## 5. 性能基线

环境：本地 synthetic Nest HTTP + PostgreSQL 18 + Redis 8 + BullMQ 5；固定 Node `24.18.0`；
三次全新容器；retry=0。P95 使用最近秩算法。

| 指标                   | Accepted 目标 | 每 run 样本 | 三次 P95      | 最坏 run | 结论 |
| ---------------------- | ------------- | ----------- | ------------- | -------- | ---- |
| 已缓存 Today HTTP      | ≤1000ms       | 7           | 31/19/42ms    | 42ms     | PASS |
| 正常受控模板生成端到端 | ≤8000ms       | 6           | 114/118/119ms | 119ms    | PASS |

正常生成 P95 明确排除每 run 一个故障恢复日；该日专门证明 Worker drain/rebuild，不属于正常延迟分布。
这些数字是可重放的开发基线，不证明公网、真实微信、真实 provider、Production 数据库或 2C2G
DEV_LITE 常驻全 profile 的 SLO。

## 6. 可靠性与故障

- 三次 clean core E2E 全部通过，retry=0，provider calls=0；
- 双设备竞争只产生一份签到、生成意图、结果和点亮事实；
- Interactive Worker 停止时返回 `GENERATION_PENDING`，重启/rebuild 后恢复原 intent；
- Redis `FLUSHALL` 后从 PostgreSQL 重建 eligible facts，不从 cache/job/log 反推事实；
- outbox/inbox 结算屏障阻止产品日期推进时的后台事务竞态；
- DAY guard 在 Worker 运行前同步阻断 stale cache；删除完成和 Redis 重建后不复活；
- Safety high-risk 整命令停止普通保存，普通 provider/template calls=0，跨日仍覆盖；
- blocking maintenance、Admin audience 和不存在的 Admin Safety-clear route 均 fail closed。

未在本 Gate 重新执行 Production PITR、真实告警、真实 provider late callback、完整 named RC
设备矩阵或 incident 观察窗口；这些属于第 9 节阻塞项。

## 7. 数据质量与指标

| 项目                         | 当前状态                | 判定边界                                                          |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------- |
| S25 G01 Analytics 合同       | PASS                    | 58-event allowlist、未知字段/第三维/raw event 拒绝                |
| S25 G02 敏感内容             | PASS                    | raw-content detector；普通 analytics 无正文/Prompt/Safety 原文    |
| S25 G03 k 与隔离             | PASS                    | k=10、最多两维、四平面物理隔离、无 Safety/Governance→Product join |
| S25 G04 删除与期限           | PASS                    | deletion-aware source、13 个月 T4 TTL、恢复不复活                 |
| S25 10 个固定 metric fixture | 10/10 PASS              | D1/D3/D7、帮助度、任务、模板、成本、抑制与 revision replacement   |
| D1/D3/D7 合成 fixture        | 7/20、4/20、3/20        | 35%/20%/15%；只证明计算，不是用户留存结论                         |
| Q01/Q02                      | `UNAVAILABLE`           | 无 Accepted 研究输入 Schema；不得从行为/帮助度猜测                |
| 客户端 signal                | BEST_EFFORT / NO_REPLAY | 不证明业务成功或唯一用户转化                                      |

任一 G01～G04 后续失败必须把相关数据/报告改为 BLOCKED；产品、性能或留存数值不能抵消硬 Gate。

## 8. Source-ID 覆盖

当前 registry 共 1004 个 ID：562 COVERED、442 PLANNED、0 NA_WITH_REASON、0 UNMAPPED。

442 个 PLANNED 不等于 Phase 2 PASS，也不被本 Gate 批量升级。它们主要属于 Phase 3 Gateway/AI
corpus、后续架构/API/隐私能力和 RC/Production 强制证据层；每项都有 owner 和 reason。Phase 3
development 可以实现这些具名缺口，但 Production/RC 不能使用 `PLANNED` 作为证据。

本 Gate 不把 `S31-TEST-048`（完整 RC Gate）、PITR、真实 provider、完整设备矩阵或专业/人工
Safety 证据伪装为 C-017 已覆盖。后续业务 Issue 只能在达到规定强制层级后逐项转为 COVERED。

## 9. Production / RC 阻塞项

| ID            | 状态                      | 阻塞项                                                                            |
| ------------- | ------------------------- | --------------------------------------------------------------------------------- |
| C017-PROD-001 | EXTERNAL_EVIDENCE_PENDING | 最终处理主体、用户说明、受托方/位置/跨境矩阵与合格 PRC Legal review               |
| C017-PROD-002 | BLOCKED                   | Production origin/image manifest、独立 stateful、HA、PITR/restore/deletion replay |
| C017-PROD-003 | EXTERNAL_EVIDENCE_PENDING | 真实 AI/对象/监控 provider profile、区域、合同、training/retention/deletion       |
| C017-PROD-004 | MANUAL_EVIDENCE_PENDING   | 真实告警/on-call、incident、删除/恢复与观察窗口                                   |
| C017-PROD-005 | MANUAL_EVIDENCE_PENDING   | named RC iOS/Android、无障碍、弱网和发布矩阵                                      |

所有阻塞项固定 `pass_claim=PROHIBITED`。DEV_LITE 继续 synthetic-only，不能处理真实用户、生产身份、
production secret 或成为 Production application host。

## 10. Validation

- `pnpm test:core:e2e:stability`：三次 clean containers 全部 PASS，retry=0；缓存 Today
  P95=`31/19/42ms`，正常受控模板生成 P95=`114/118/119ms`；
- `pnpm phase-gate:validate`：E-014 历史 Gate 保持通过；当前总计 12 个测试，其中 C-017
  正向、负向和 owner 接受状态转换 `7/7` PASS；
- `pnpm agent:validate --mode=changed --task=C-017`：固定 Node `24.18.0`，
  changed→full，`automated=PASS / MANUAL_EVIDENCE_REQUIRED`，171650ms；
- `pnpm agent:validate --mode=task --task=C-017`：自动部分 PASS，最终状态
  `MANUAL_EVIDENCE_REQUIRED`，83508ms；
- required manual evidence：`threatBoundaryReview`、`productionAuthorizationWhenApplicable`；
  前者等待 owner，后者不适用于本 development Gate且固定 `NOT_GRANTED / NO_GO`；
- full Gate 产生的 Prisma 非语义生成副作用已恢复，不进入变更。

自动部分 PASS 不能改变本报告 Draft 状态；final PR head 仍须在固定 Ubuntu CI 同一 run 11/11。

## 11. Threat Boundary Review

待项目所有者复核以下结论：

1. 本 Gate 只允许 Phase 3 development，不授予 Alpha/真实用户/RC/Production；
2. C-015 blockers、S25 G01～G04 和 DEV_LITE production-ineligible 边界均未降低；
3. 442 PLANNED 保持显式 non-PASS，不因“进入其实现阶段”而提前覆盖；
4. 性能基线只用于 synthetic development，不能外推 Production SLO；
5. AI-001～AI-016 必须逐项遵守 Gateway、事实绑定、Safety、记忆、成本与真实 provider 授权；
6. final PR head 仍须同一 CI run 11/11、exact-head verifier 和 owner merge approval。

项目所有者明确接受前，`owner_decision=PENDING_REVIEW`、
`threat_boundary_review=AGENT_PREPARED_OWNER_PENDING`，本报告保持 Draft。

## 12. 接受后的状态迁移

只有项目所有者接受建议且 final PR head 通过完整 Gate 后：

1. 本报告转为 Accepted，记录接受日期；
2. C-017 可标 Done，并经 exact-head verifier 合并；
3. ROADMAP 当前阶段才可改为 Phase 3；
4. AI-001 才可成为唯一 Ready，但不得在 C-017 收尾中启动；
5. C-015 保持 Blocked，Production/RC 保持 `NO_GO`。

若 owner 拒绝、任一退出门槛/硬 Gate 失败、性能预算超限、registry 出现 UNMAPPED/silent PLANNED，
结论必须改为 `FIX_REQUIRED` 或 `NO_GO`，明确 owner 和解锁条件，不得靠聊天承诺绕过。

## 13. 当前需要的决定

项目所有者需要确认一件事：是否接受
`GO_FOR_PHASE_3_DEVELOPMENT / PRODUCTION_AND_RC_NO_GO` 的分层结论及第 11 节 threat boundary。

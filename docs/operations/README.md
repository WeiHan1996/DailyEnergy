# Operations

运营规范目录。

已实现的工程运行手册：

- [开发环境部署 Runbook](./development-deployment-runbook.md)：DEV publication、安装、发布、reconciliation、回滚、secret 轮换和恢复；
- [可观测性 Runbook 集](./observability-runbooks/README.md)：E-013 的 SLO burn、异步队列、数据库、AI/成本、telemetry health 和数据生命周期处置入口。

可观测性 Runbook 当前只适用于 LOCAL、CI、DEV 和 STAGING-like 参考环境。Production
后端、region、RBAC、TTL、on-call 身份和通知通道保持 `BLOCKED`；alert 只产生 S-23
incident candidate，不自动决定事件级别。

计划文档：

- `notification.md`：订阅消息时机、频率和退订；
- `content-calendar.md`：节气、节日和惊喜内容；
- `support.md`：反馈、投诉和高风险用户支持；
- `moderation-ops.md`：内容安全人工处置流程。

运营不得通过恐惧、断签焦虑或虚假预测推动活跃和付费。

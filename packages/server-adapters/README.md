# Server Adapters

服务端基础设施 adapter 包。数据库连接与 Redis/BullMQ 队列通过
profile-specific exports 暴露，client 和 server-core 不能直接导入具体 SDK。

`./api` 当前还导出 C-001～C-012 已实现的 PostgreSQL stores。Daily interaction
store 在同一事务处理点亮 command receipt、LightFact、aggregate revision 与
DayLit outbox；普通 API 通过白名单函数读取历史/Safety/删除守卫，不直接读取
受限表。`worker-background` 默认注册 DayLit handler，以 InboxReceipt、源有效性、
关系 cycle unique slot 与 deletion cutoff 维护去重 EncounterLink。

E-007 队列基线包括：

- Redis 8 major attestation、BullMQ 5 versioned queue 和最多 5 次 bounded retry；
- Interactive、Background、Restricted 静态 handler/DB role/egress manifest；
- PostgreSQL outbox relay、session advisory claim 和 enqueue crash hook；
- 与领域写共事务的 InboxReceipt、terminal receipt 和 commit-before-ACK hook；
- 从 published/unconsumed outbox、due intent 和 active DataTask 重建空 Redis；
- 独立 profile graceful drain 和不含正文/高基数 ref 的低基数 telemetry event。

`worker-interactive`、`worker-background` 和 `worker-restricted` 是生产入口；
`testing` 只供测试使用。除 C-008 Interactive generation 与 C-011 DayLit 关系
handler 外，Weekly、通知和删除 handler 仍由后续任务交付。

C-012 新增 ordinary EveningStore 与 `api-restricted` Evening Safety store：前者
原子提交 feedback/helpfulness/task、密文 note、revision 与无正文 outbox；后者只用
`daily_energy_safety` role 提交最小 decision/event/plan/state。分类器通过封闭 port
注入，INDETERMINATE 自由文本 fail closed，不在 adapter 内实现关键词分类。

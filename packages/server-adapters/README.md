# Server Adapters

服务端基础设施 adapter 包。数据库连接与 Redis/BullMQ 队列通过
profile-specific exports 暴露，client 和 server-core 不能直接导入具体 SDK。

`./api` 当前还导出 C-001～C-004 的 PostgreSQL Auth、Consent/Profile 和
Checkin stores。Checkin store 在同一事务处理 command receipt、owner/date
唯一性和 revision CAS；普通 API 只执行返回稳定守卫码的受审函数，不能直接
读取 Safety/删除受限表，也不能更新或删除签到 revision 历史。

E-007 队列基线包括：

- Redis 8 major attestation、BullMQ 5 versioned queue 和最多 5 次 bounded retry；
- Interactive、Background、Restricted 静态 handler/DB role/egress manifest；
- PostgreSQL outbox relay、session advisory claim 和 enqueue crash hook；
- 与领域写共事务的 InboxReceipt、terminal receipt 和 commit-before-ACK hook；
- 从 published/unconsumed outbox、due intent 和 active DataTask 重建空 Redis；
- 独立 profile graceful drain 和不含正文/高基数 ref 的低基数 telemetry event。

`worker-interactive`、`worker-background` 和 `worker-restricted` 是生产入口；
`testing` 只供测试使用。E-007 不注册具体 Daily、Weekly、通知或删除 handler。

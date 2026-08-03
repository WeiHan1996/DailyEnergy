# Worker

单一 Worker artifact 的显式入口目录。Interactive、Background、Restricted 与
Migration 使用同一构建产物，但各自只导入对应的 server-adapters subpath。

E-007 为三个常驻 profile 组合 PostgreSQL role attestation、静态 queue capability、
BullMQ runtime 和幂等 drain。启动失败会释放已连接的数据库；drain 先停止 intake，
等待 in-flight job，再关闭 Redis 与 PostgreSQL。具体业务 handler 属于后续任务，
不会在本基线中提前注册。

## Compose runtime

E-009 为三个 profile 增加独立进程入口，并在启动时严格核对 profile、capability
fingerprint、数据库角色与 egress allowlist。数据库 credential 只能从
`/run/secrets/` 文件读取；heartbeat 只写入 `/run/dailyenergy/`，依赖失败时删除
heartbeat 并输出稳定原因码，不记录 secret 或正文。

- Interactive：`daily_energy_interactive`，并发 2；
- Background：`daily_energy_background`，并发 1，周期执行 outbox relay；
- Restricted：`daily_energy_deletion`，并发 1，不继承普通 Worker capability。

每个周期执行有界 Redis rebuild。`RESTORE_VERIFIED` 启动模式会重复执行 rebuild，直到
PostgreSQL eligible backlog 清零；遇到不支持的任务或 20 轮后仍有 backlog 时 fail
closed。SIGTERM/SIGINT 停止 intake、清除 heartbeat、drain runtime，并输出 `DRAINED`。

三类 Worker 不发布宿主端口，且只连接各自需要的 internal 网络：

```bash
pnpm run compose:up -- --mode=test
pnpm run compose:smoke -- --mode=test
pnpm run compose:clean -- --mode=test
```

完整拓扑、fault matrix 与安全边界见
[`docker/README.md`](../../docker/README.md)。

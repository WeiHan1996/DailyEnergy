# Worker

单一 Worker artifact 的显式入口目录。Interactive、Background、Restricted 与
Migration 使用同一构建产物，但各自只导入对应的 server-adapters subpath。

E-007 为三个常驻 profile 组合 PostgreSQL role attestation、静态 queue capability、
BullMQ runtime 和幂等 drain。启动失败会释放已连接的数据库；drain 先停止 intake，
等待 in-flight job，再关闭 Redis 与 PostgreSQL。具体业务 handler 属于后续任务，
不会在本基线中提前注册。

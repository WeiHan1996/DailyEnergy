# DailyEnergy Compose

E-009 提供一套 common Compose 拓扑和三个显式环境 overlay：

- `local`：持久 PostgreSQL/Redis volume，API `127.0.0.1:3300`，Admin
  `127.0.0.1:3301`；
- `test`：一次性 tmpfs 数据，API `127.0.0.1:13300`，Admin
  `127.0.0.1:13301`；
- `staging-like`：使用 STAGING runtime Schema 和持久 volume，API
  `127.0.0.1:23300`，Admin `127.0.0.1:23301`。

三种环境共用 API、Admin、Interactive/Background/Restricted Worker、PostgreSQL
18、Redis 8、one-shot Migration、合成依赖 stub 和受限 host ingress。PostgreSQL、
Redis 与 Worker 不发布宿主端口；应用端口只经无 secret ingress 绑定 loopback。

E-017 另提供 `docker/compose.dev-lite.yaml` 作为发布控制器专用的第四个 overlay。它只
用于 2C2G、synthetic-only、`production_eligible=false` 的 DEV_LITE 主机，不由
`compose:up` 本地入口直接选择。稳态 core 为 PostgreSQL、Redis、dependency stub、API
和 loopback TLS proxy，总 memory limit 为 704 MiB；Admin、三个 Worker 与 one-shot job
由发布控制器按互斥 profile 分阶段启动。local object smoke 使用 `network_mode:none`，
没有 secret、volume 或 host port，不能作为 OSS/COS 或 Production object 证据。

## 前置条件

- Node.js 24 与 pnpm 11.17.0；
- Docker daemon 和支持 `--wait`、profiles、secrets 的 Docker Compose；
- 本机为 Docker 构建保留足够空间。

首次准备会构建四个本地固定镜像。Node、PostgreSQL 和 Redis 基础镜像均固定 digest，
应用镜像以当前 Git/source diff fingerprint 标记。

## 常用命令

```bash
# 启动本地环境；缺少 artifact 时自动 prepare
pnpm run compose:up -- --mode=local

# 验证 host 端点、外网/metadata 拒绝和 profile 网络隔离
pnpm run compose:smoke -- --mode=local

# 停止并删除容器、volume、network 与合成 secret artifact
pnpm run compose:clean -- --mode=local
```

将 `local` 替换成 `test` 或 `staging-like` 可运行对应 overlay。只查看规范化配置：

```bash
pnpm run compose:config -- --mode=test
```

## 故障矩阵

fault variant 只使用 `test` 合成环境，并在 loopback 发布 stub/proxy 控制端点。完整
smoke 会依次验证 PostgreSQL、Redis、provider、network、clock 与 telemetry 故障及
恢复：

```bash
pnpm run compose:up -- --mode=test --fault
pnpm run compose:smoke -- --mode=test --fault
pnpm run compose:clean -- --mode=test --fault
```

需要单独控制合成故障时，可使用：

```bash
pnpm run compose:fault -- --mode=test --fault provider failure
pnpm run compose:fault -- --mode=test --fault provider pass
```

## 验证

```bash
pnpm run compose:evidence
pnpm run compose:validate
pnpm run deployment:test
```

`compose:validate` 会从空 test/test-fault 项目执行真实冷启动、health、egress、fault、
shutdown 和清理。`deployment:test` 静态验证 DEV_LITE 的资源预算、profile 互斥、受保护
端口与 local object 隔离。测试与 fault 数据均为合成数据。

## 安全边界

- `.artifacts/compose/<variant>/secrets` 由工具生成、权限受限且被 Git 忽略；
- 不把 `.env`、真实账号、生产 secret 或真实用户数据放入 Compose；
- 运行时使用 secret file，不在环境变量或日志中保存 credential 值；
- 所有服务只读 root filesystem、非 root、drop all capabilities，且有资源和重启上限；
- profile 数据网络与外部 stub 网络均为 `internal`；只有无 secret ingress 连接受限
  host bridge；
- `clean` 只删除对应 `dailyenergy-e009-<variant>` 项目和本地合成 artifact；
- 该拓扑不是生产、高可用、备份、PITR、TLS 或真实 provider 配置。

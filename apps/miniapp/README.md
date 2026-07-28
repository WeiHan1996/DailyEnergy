# DailyEnergy Miniapp

E-004 提供微信原生小程序 TypeScript 运行骨架。当前只有 `SYS-001`
启动路由占位和 `SYS-003` 维护/恢复占位，不包含首次认识、签到、今日内容、
点亮、反馈或趋势业务。

## 目录边界

- `src/app`：公开构建配置校验和应用上下文；
- `src/pages`：启动与恢复占位页面；
- `src/components`：后续页面共享组件；
- `src/features`：后续按业务能力组织的纯客户端逻辑；
- `src/platform`：微信 login、storage、network、share、subscription
  adapter 与可替换 port；
- `src/services`：E-008 交付 API Client 后的调用编排入口；
- `src/generated`：只放带 `@generated` 与来源指纹的生成物，不手改。

小程序是 `client-safe` runtime：不得导入 Node、Nest、Prisma、Redis、
BullMQ、Prompt、provider SDK、服务端 package、Admin client 或 secret。
本地 storage 只可保存短期 view/ref/草稿，不能成为 ProductDate、Safety、
owner 或删除事实。

## 本地构建

```text
pnpm --filter @daily-energy/app-miniapp build
```

构建会：

1. 校验封闭的公开构建配置；
2. 用 TypeScript strict 编译到 `dist/`；
3. 复制 WXML、WXSS、JSON 和 WXS 资产；
4. 生成带环境标识与 SHA-256 来源指纹的公开配置；
5. 扫描最终小程序包中的禁止依赖和 secret 标识。

默认配置来自 `public-build.config.json`：

- environment：`LOCAL`
- API origin：`http://127.0.0.1:3000`

构建环境可用 `DAILYENERGY_MINIAPP_ENVIRONMENT` 和
`DAILYENERGY_MINIAPP_API_ORIGIN` 覆盖。环境是封闭枚举；非本地 origin
必须使用 HTTPS，不能包含凭据、路径、查询或片段。它们都是公开客户端配置，
不能承载 AppSecret、session key、provider key 或数据库地址。

## 微信开发者工具

1. 先运行 miniapp build；
2. 在微信开发者工具中导入本目录；
3. `project.config.json` 会从 `dist/` 加载基础库 `3.7.12` 的原生小程序；
4. 如需本机偏好，复制 `project.private.config.example.json` 为
   `project.private.config.json`。私有文件已被 Git 忽略。

公开项目配置使用 `touristappid`，不包含真实 AppID/AppSecret。真实账号、
业务域名、真机矩阵和 production Gate 不属于 E-004。

## 测试证据边界

- `pnpm test`：10 项 Vitest 纯逻辑/adapter 单测、14 组公开配置
  build/runtime parity、10 组 DevTools 结果分类、9 条 bundle 静态规则
  known-fail 与 1 个 known-pass；
- `pnpm build`：TypeScript 产物与 client-only bundle Gate；
- `pnpm test:devtools`：需要
  `WECHAT_DEVTOOLS_CLI_PATH`，通过 `miniprogram-automator` 验证启动和恢复页。

只有 CLI 缺失、automation endpoint 不可连接或启动握手超时等明确基础设施
错误会返回 `INFRA_BLOCKED`（exit 2）。启动成功后的页面脚本、模块加载、
生命周期、selector/data 或断言错误返回普通 `FAIL`（exit 1），并保留脱敏
稳定类别。不能把 Node/Vitest 结果标成微信平台 conformance；真机冒烟继续
保留为 RC 人工证据。

## E-004 Source-ID 证据

正式全项目 registry 属于 E-010；本表只记录 E-004 实际触达的 Accepted
场景，不声称覆盖尚未实现的业务旅程。

| Source ID                                                                      | 证据等级                    | E-004 证据                                                                                                                 |
| ------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `S28-STACK-007`、`S28-STACK-008`                                               | `MACHINE_ENFORCED`          | workspace/client Gate 与最终 bundle scanner 拒绝 `node:*`、Prisma 等 server-only import                                    |
| `S30-REPO-017`、`S30-REPO-018`、`S30-REPO-023`                                 | `MACHINE_ENFORCED`          | 12 类 architecture Gate、client subpath allowlist、secret/content 与最终产物扫描                                           |
| `S31-TEST-013`                                                                 | `MACHINE_ENFORCED`          | 9 条 bundle 静态规则各有 known-fail、1 个 known-pass 和真实 `dist/` 扫描                                                   |
| `S32-DEPLOY-002`、`S32-DEPLOY-005`                                             | `MACHINE_ENFORCED`          | 封闭环境枚举、origin 校验、私有配置忽略和客户端 secret identifier Gate                                                     |
| `S31-TEST-016`                                                                 | `PARTIAL / MANUAL_EVIDENCE` | DevTools automator runner 已建立；2026-07-28 本机重试返回 `MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT`，不能标记微信 conformance PASS |
| `S30-REPO-019`、`S30-REPO-022`、`S31-TEST-010`、`S31-TEST-012`、`S31-TEST-015` | `DEFERRED`                  | shared-schemas/client、public/Admin api-client、codegen 与 drift 仍由 E-008 交付；E-004 未复制或伪造生成客户端             |
| 真机 iOS/Android、04:00、弱网与权限矩阵                                        | `DEFERRED`                  | 保留给 E-010/E-011 和 RC 真机证据，不用 Vitest 或 Node 冒充                                                                |

DevTools 解锁条件：本机 IDE automation endpoint 能被
`miniprogram-automator` 完成启动握手后，重新运行 `pnpm test:devtools` 并
保存基础库、DevTools 版本和合成页面结果；在此之前平台层状态保持
`INFRA_BLOCKED`。

# DailyEnergy Admin

E-005 的 Next.js 16 / React 19 App Router 管理后台骨架。

当前只交付 ADM-001 登录外壳、基础页面框架、Loading / Empty /
Recoverable Error / Disabled 状态，以及 Admin API、会话和浏览器 bundle
的安全边界。真实企业 SSO、业务 Dashboard、用户查询和生产部署不在本任务内。

## 单向边界

```text
apps/admin
  → @daily-energy/api-client/admin
  → /v1/admin
```

- 浏览器与 Server Component 都不能直连 PostgreSQL、Redis、provider 或对象存储；
- Admin API origin 只从服务端 `ADMIN_API_ORIGIN` 读取，不使用
  `NEXT_PUBLIC_*`；
- Admin session 只允许 HttpOnly、Secure、SameSite=Strict、`__Host-` cookie；
- E-005 不写登录 cookie，也不实现真实 SSO；
- production 只有在显式启用、可信身份配置完整且真实身份 adapter 已注册时才
  能 ready。E-005 未注册该 adapter，所以默认 fail closed。

## 本地外壳

```bash
pnpm --filter @daily-energy/app-admin dev
```

默认只显示登录/禁用外壳。Playwright 使用受控 test profile 开启 `/shell`
预览，不创建可用于 production 的测试登录。

服务端配置边界：

- `ADMIN_RUNTIME_PROFILE`：`development | test | production`；
- `ADMIN_PRODUCTION_ENABLED`：production 显式开关；
- `ADMIN_API_ORIGIN`：独立 Admin API origin；
- `ADMIN_TRUSTED_IDENTITY_ISSUER`；
- `ADMIN_TRUSTED_IDENTITY_AUDIENCE`；
- `ADMIN_IDENTITY_CLIENT_SECRET_FILE`；
- `ADMIN_SESSION_COOKIE_NAME`；
- `ADMIN_SESSION_SECRET_FILE`；
- `ADMIN_SHELL_PREVIEW`：只允许 development 或受 Playwright 约束的 test
  profile。

secret 配置只接受受控文件路径，不接受明文；任何值都不得进入浏览器 bundle。

## 验证

```bash
pnpm --filter @daily-energy/app-admin typecheck
pnpm --filter @daily-energy/app-admin test
pnpm --filter @daily-energy/app-admin build
pnpm run admin:bundle:fixtures
pnpm run validate
```

`build` 会在 Next build 后扫描真实 `.next/static` 浏览器产物。负向 fixture
分别证明 server-only package、secret identifier、secret value、restricted
field 和合成用户正文能被稳定 rule ID 拒绝。

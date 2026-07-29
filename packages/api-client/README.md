# API Client

DailyEnergy 的平台无关 HTTP transport client。HTTP path、method、parameter、
status 和 envelope 来自 `openapi/openapi.yaml`；业务值和跨字段规则仍由
`@daily-energy/shared-schemas` 的 Zod Schema 负责。

## 入口

- `@daily-energy/api-client/miniapp`：只包含公开 `/v1` operation、类型、transport
  client 和显式 mapper；
- `@daily-energy/api-client/admin`：只包含 `/v1/admin` operation 和独立 transport
  client；
- `@daily-energy/api-client/testing`：只包含可替换 transport stub；
- 不提供 root export 或 wildcard export。

```ts
import {
  createMiniappApiClient,
  mapEveningSaveRequestToSubmission,
} from "@daily-energy/api-client/miniapp";

const client = createMiniappApiClient(transport);
const submission = mapEveningSaveRequestToSubmission(request);
```

生成类型不是领域模型。`mapEveningSaveRequestToSubmission` 明确处理 Accepted
OpenAPI transport 与 Zod domain submission 的形状差异，并在边界再次执行 Zod
校验。Prisma row、Nest DTO、provider payload 或数据库对象不能直接成为 response。

## 生成与验证

```bash
pnpm codegen
pnpm codegen:check
pnpm contract:check
pnpm contract:fixtures
pnpm --filter @daily-energy/api-client typecheck
pnpm --filter @daily-energy/api-client test
```

包测试会分别以无 Node types 的 client-safe TypeScript 配置编译 miniapp、Admin 和
testing 三个入口，再执行 Vitest。

`src/generated/miniapp.ts`、`src/generated/admin.ts` 和
`openapi/openapi.generated.json` 都是提交的确定性产物，包含 generator/version、
source fingerprint 和 do-not-edit 证明。相同输入必须得到逐字节相同输出，删除、
手改或旧指纹都会由 Gate 拒绝。

客户端源码和生成结果不得导入 Admin（miniapp 入口）、Node/Nest/Prisma/Redis/
BullMQ/provider/Prompt 依赖，也不得出现内部 DB/event/job/provider/restricted
字段。包不实现真实网络 adapter 或业务 handler；调用方注入 transport。

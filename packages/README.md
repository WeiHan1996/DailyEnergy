# Shared Packages

本目录存放多个应用共同依赖、可独立测试的包。

- `shared-schemas/`：Zod Schema、枚举和契约。
- `api-client/`：公开/Admin transport client。
- `server-core/`：服务端领域与 application contract。
- `server-adapters/`：服务端基础设施 adapter。
- `prompt-library/`：可版本化 Prompt。
- `eslint-config/`：统一工程规范。
- `typescript-config/`：统一 TypeScript 配置。

共享包不得依赖具体应用。

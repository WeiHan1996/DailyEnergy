# Shared Packages

本目录存放多个应用共同依赖、可独立测试的包。

- `shared-types/`：跨端 TypeScript 类型。
- `shared-schemas/`：Zod Schema、枚举和契约。
- `prompt-library/`：可版本化 Prompt。
- `eslint-config/`：统一工程规范。

共享包不得依赖具体应用。

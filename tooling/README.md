# Tooling

仓库级确定性检查与开发工具目录，不包含业务规则、生产入口或真实数据。

- `check-workspace.mjs`：验证 workspace 集合、lockfile、版本与基础边界；
- `check-config.mjs`：对 11 个 workspace 执行 TypeScript `--showConfig`，验证最终
  resolved protected options 与确定性 typecheck script；
- `typecheck-workspace.mjs`：用 workspace 自身 tsconfig 执行 `tsc --noEmit`；
  每次解析 TypeScript `--showConfig.files` 并与 workspace 内实际 `.ts`、`.tsx`、
  `.mts`、`.cts` 源码比较；全部或部分源码未进入 resolved project 时都以
  `TYPECHECK_SOURCE_EXCLUDED` 失败，`TS18003` 仅在实际零 TypeScript 源码时通过；
- `test-config.mjs`：证明共享中间配置关闭 `strict` 会被 resolved config Gate 拒绝；
- `test-typecheck.mjs`：分别临时注入非 shared-schemas workspace 合成 `TS2322`
  和被 `include` 全部/部分漏掉的 TypeScript 源码，证明 root `pnpm typecheck`
  三种情况都必须失败并在结束时清理；
- `check-boundaries.mjs`：执行 12 类 runtime zone、exports、client、capability、
  provider、restricted、Prisma、generated 与 secret/content 静态 Gate；
- `test-boundaries.mjs`：运行 20 个 known-fail fixtures，要求每一类 Gate 命中
  稳定 rule ID；同时让隔离 known-pass project 经过全部 12 类 Gate 且严格零诊断；
- `lib/boundary-engine.mjs`：生产仓库与 fixture 共用的边界规则引擎；相对 import
  的规范化目标路径进入不同 workspace 时，独立于目标文件类型/扫描结果统一以
  `BOUNDARY_MODULE_CROSS_WORKSPACE_RELATIVE` 拒绝；跨 workspace 只能使用 package
  exports/public contract。
- `generate-contracts.mjs`：从 Zod、OpenAPI source 和 Accepted error catalog
  确定性生成 20 份 JSON Schema、OpenAPI bundle 以及 miniapp/Admin TypeScript
  client；`--write` 写入，`--check` 逐字节检查已提交产物；
- `check-contracts.mjs`：检查 OpenAPI parse/operation/error/envelope/status、
  Public/Admin audience、Zod projection、显式 mapper、package exports、API error
  catalog 和 client-safe 字段/依赖；
- `test-contracts.mjs`：运行正常 corpus、重复生成，并让 15 条稳定 rule ID
  分别命中最小 known-fail mutation，包括生成文件删除、手改和来源指纹漂移；
- `compile-api-client-entrypoints.mjs`：用独立 client-safe TypeScript project
  编译 miniapp、Admin 与 testing 三个入口；
- `lib/contract-codegen.mjs` 与 `lib/contract-gate.mjs`：生成和 Gate 的共享纯逻辑，
  不读取环境密钥，不写时间戳、本机路径、用户名或真实内容。

合同工作流：

```bash
pnpm codegen
pnpm codegen:check
pnpm contract:check
pnpm contract:fixtures
```

Zod 不能被 JSON Schema 等价表达的 refinement（例如真实日历日期、Unicode
grapheme 和跨对象等式）仍由 runtime Zod 强制；生成 JSON Schema 只承担可表示的
跨语言预校验和文档投影。

`dependency-cruiser` 同时检查当前可解析的 JS/ESM 图。18.1.0 尚未支持 TypeScript
7 compiler API，因此 TypeScript import、source cycle 与 zone/capability 判断由
项目边界引擎负责；不得把 dependency-cruiser 的兼容警告误写成 TS 图已完整覆盖。

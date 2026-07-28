# Tooling

仓库级确定性检查与开发工具目录，不包含业务规则、生产入口或真实数据。

- `check-workspace.mjs`：验证 workspace 集合、lockfile、版本与基础边界；
- `check-config.mjs`：对 11 个 workspace 执行 TypeScript `--showConfig`，验证最终
  resolved protected options 与确定性 typecheck script；
- `typecheck-workspace.mjs`：用 workspace 自身 tsconfig 执行 `tsc --noEmit`；
  当前无源码的预留 workspace 只在 TypeScript 明确返回 `TS18003` 且配置仍可解析时
  扫描确认 workspace 内确实不存在 TypeScript 源码后通过；存在 `.ts`、`.tsx`、
  `.mts` 或 `.cts` 但 resolved project 零输入时以 `TYPECHECK_SOURCE_EXCLUDED` 失败；
- `test-config.mjs`：证明共享中间配置关闭 `strict` 会被 resolved config Gate 拒绝；
- `test-typecheck.mjs`：分别临时注入非 shared-schemas workspace 合成 `TS2322`
  和被 `include` 漏掉的 TypeScript 源码，证明 root `pnpm typecheck` 两种情况都必须
  失败并在结束时清理；
- `check-boundaries.mjs`：执行 12 类 runtime zone、exports、client、capability、
  provider、restricted、Prisma、generated 与 secret/content 静态 Gate；
- `test-boundaries.mjs`：运行 19 个 known-fail fixtures，要求每一类 Gate 命中
  稳定 rule ID；同时让隔离 known-pass project 经过全部 12 类 Gate 且严格零诊断；
- `lib/boundary-engine.mjs`：生产仓库与 fixture 共用的边界规则引擎；相对 import
  解析到不同 workspace 时统一以 `BOUNDARY_MODULE_CROSS_WORKSPACE_RELATIVE` 拒绝，
  跨 workspace 只能使用 package exports/public contract。

`dependency-cruiser` 同时检查当前可解析的 JS/ESM 图。18.1.0 尚未支持 TypeScript
7 compiler API，因此 TypeScript import、source cycle 与 zone/capability 判断由
项目边界引擎负责；不得把 dependency-cruiser 的兼容警告误写成 TS 图已完整覆盖。

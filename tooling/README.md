# Tooling

仓库级确定性检查与开发工具目录，不包含业务规则、生产入口或真实数据。

- `check-workspace.mjs`：验证 workspace 集合、lockfile、版本与基础边界；
- `check-config.mjs`：验证 11 个 workspace 的 TypeScript 继承与不可关闭 strict；
- `check-boundaries.mjs`：执行 12 类 runtime zone、exports、client、capability、
  provider、restricted、Prisma、generated 与 secret/content 静态 Gate；
- `test-boundaries.mjs`：运行 `tests/architecture/boundary-cases.json` 中的 15 个
  known-fail fixtures，要求每一类 Gate 命中稳定 rule ID；
- `lib/boundary-engine.mjs`：生产仓库与 fixture 共用的边界规则引擎。

`dependency-cruiser` 同时检查当前可解析的 JS/ESM 图。18.1.0 尚未支持 TypeScript
7 compiler API，因此 TypeScript import、source cycle 与 zone/capability 判断由
项目边界引擎负责；不得把 dependency-cruiser 的兼容警告误写成 TS 图已完整覆盖。

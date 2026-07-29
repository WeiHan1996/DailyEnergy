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
- `check-admin-bundle.mjs`：扫描真实 `.next/static`，并对配置为 `*_SECRET_FILE`
  的项读取文件实际内容作为 canary；只输出稳定诊断，不输出 secret 或用户正文；
- `run-admin-playwright.mjs`：在临时权限受限文件中创建合成 Admin secret，运行
  production shell Playwright 响应扫描，并构建/启动独立真实 Next known-fail
  fixture，验证初始 HTML、RSC 和浏览器网络响应中的 secret/restricted field/
  用户正文都会被 Gate 拒绝；测试结束删除临时文件和 fixture build；
- `lib/admin-bundle-check.mjs` 与 `lib/admin-secret-canaries.mjs`：静态 bundle、
  HTML/RSC/网络响应和 fixture 共用的纯扫描规则与 secret-file canary 读取边界。
- `agent-prepare.mjs`：默认只读、本地且快速地合并任务/变更主题来源，报告来源
  触发路径、有效 Profile、proof matrix、依赖、Git 变更范围和建议验证模式；只有
  显式 `--remote` / `--deep` 才扩大 Issue/PR/main 与环境检查；
- `agent-validate.mjs`：统一执行 `changed` / `task` / `full` 分级 Gate；未知、高风险
  或 tooling/config 变化同时提升 mode 与有效 Profile，Git 作用域失败时 fail
  closed，dry-run/零变更不会伪装成 PASS；成功只输出摘要，失败输出脱敏的根因
  邻域和尾部；E-010 提供 Source-ID dependency map 前，生产代码、测试和配置也
  一律升级 full；
- `check-agent-workflow.mjs`：验证权威路由、Profile、命令、D 系列依赖、统一入口与
  非权威摘要声明；
- `test-agent-workflow.mjs`、`lib/agent-workflow.mjs` 与
  `lib/git-change-scope.mjs`：运行状态来源冲突、依赖阻断、topic source 合并、
  Profile 组合、Git 作用域、变更升级与输出脱敏的版本化
  known-pass/known-fail fixtures。

Agent 工作流：

```bash
pnpm agent:prepare E-015
pnpm agent:validate --mode=changed
pnpm agent:validate --mode=task --task=E-015
pnpm agent:validate --mode=full --profile=code
```

设计、混合、研究或安全 Profile 中，自动化无法替代的原始证据、授权或用户决定会
以明确的 pending 状态返回，不会被仓库检查伪装成 `PASS`。validation receipt、
有效输入集哈希和持久化日志 artifact 仍属于后续 P2。

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

# Tests

项目级测试与质量基线目录。

计划覆盖：

- 每日能量稳定种子与规则引擎；
- 幂等、连续点亮和跨日边界；
- AI Schema 校验、重试与模板降级；
- API 集成测试；
- 小程序关键用户旅程；
- 内容安全与高风险响应；
- 数据迁移和隐私删除流程。

测试重点不是只验证“能运行”，还要验证稳定、自然、安全和可恢复。

E-002 的版本化质量 fixtures 包括：

- `architecture/boundary-cases.json`：20 个最小 known-fail case 覆盖 S-30
  的 12 类静态 Gate，包括生产源码通过 `devDependencies` 跨 runtime zone，以及
  client-safe 通过 TS/JS 或 JSON/资源相对路径穿越到 server-core workspace；
- `architecture/known-pass-project.json`：隔离正向 project，全部 12 类 Gate
  的 diagnostics 必须严格为 0；
- `config/shared-intermediate-strict-off`：共享中间 tsconfig 关闭 `strict` 时，
  resolved config Gate 必须失败；
- `typecheck/fixtures/non-shared-workspace-error.ts`：root typecheck 的非
  shared-schemas workspace `TS2322` must-fail；
- `typecheck/fixtures/excluded-workspace-source.ts`：workspace 已有 TypeScript
  源码但 `tsconfig.include` 全部或部分未覆盖时，root typecheck must-fail；
- `eslint/fixtures/nest-controller.ts`：NestJS 风格 class/method decorators
  必须能由 ESLint 正向解析。

正式 Source-ID registry、测试 metadata、runner 分层和完整 E2E/resilience
骨架仍属于 E-010。

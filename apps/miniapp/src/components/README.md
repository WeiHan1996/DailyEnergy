# Components

D-002 的微信原生共享组件放在这里。15 个代码目录对应
`apps/miniapp/component-library.json` 中的 17 个逻辑组件合同，其中
Primary、Secondary 和 Text Button 共用 `action-button`。

约束：

- 组件只消费 `src/generated/design-tokens.wxss` 暴露的 semantic/component Token；
- 不在组件 WXSS 中写 raw 色值或尺寸；
- Selected、Error、Completed、Offline、Loading、Disabled 和 Safety 不只靠颜色表达；
- 可操作控件提供读屏名称，最小触控目标约 44px；
- Loading 阻止重复操作，Reduced Motion 直接进入稳定终态；
- Safety 组件不复用普通品牌娱乐、分数、任务、点亮或分享层。

新增或修改组件时，先更新 canonical `component-library.json`，再运行：

```text
node tooling/test-miniapp-design-system.mjs
node tooling/check-miniapp-design-system.mjs
pnpm --filter @daily-energy/app-miniapp build
```

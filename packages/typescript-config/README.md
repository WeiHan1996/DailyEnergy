# TypeScript Config

DailyEnergy 的共享 TypeScript 7 strict 配置包。

公开配置：

- `./base.json`：所有 TypeScript workspace 的 strict 与安全默认值；
- `./node.json`：Node 24、NodeNext、ESM；
- `./next.json`：Next/React 的 Bundler/JSX 配置，不授予服务端 capability；
- `./miniapp.json`：微信小程序兼容目标，显式排除 Node types；
- `./tooling.json`：Node 工具脚本的 `allowJs`/`checkJs`；
- `./config.json`：ESLint、Prettier 等配置文件。

workspace 可以补充 `rootDir`、`outDir`、`include` 与平台需要的选项，但
`tooling/check-config.mjs` 会拒绝关闭 strict 子项或用 `paths` 跨越 package
exports。

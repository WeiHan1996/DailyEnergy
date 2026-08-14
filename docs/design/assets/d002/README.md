# D-002 Design System 评审资产

本目录是 D-002 的仓库评审面和 Figma 导入交付，不是业务页面实现。

- **当前任务状态**：`In Review`
- **证据状态**：`USER_ACCEPTANCE_PENDING / MANUAL_EVIDENCE_REQUIRED`
- **Figma 最终命名版本**：`2387487276296532390`

## 1. 文件边界

| 路径                                                     | 来源                  | 用途                                            |
| -------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| `index.html`、`styles.css`、`script.js`                  | 手工评审资产          | Token、组件、状态和响应式检查                   |
| `design-tokens.css`                                      | 自动生成              | 与小程序相同的 Semantic/Component CSS variables |
| `figma-variable-manifest.json`                           | 自动生成              | Canonical 三层 collection/mode 清单             |
| `figma-import/primitive/Value.json`                      | 自动生成              | `DE / Primitive` 导入                           |
| `figma-import/semantic-default/Default.json`             | 自动生成              | Starter 下 `DE / Semantic / Default` 导入       |
| `figma-import/semantic-high-contrast/High Contrast.json` | 自动生成              | Starter 下 `DE / Semantic / High Contrast` 导入 |
| `figma-import/component/Value.json`                      | 自动生成              | `DE / Component` 导入                           |
| `evidence/`                                              | 浏览器/Figma 原始证据 | 截图、测量、ID 与人工状态索引                   |

自动生成文件带 `@generated`/description 和同一 SHA-256 来源指纹。只修改
`apps/miniapp/design-tokens.json`，再运行 `pnpm design-tokens:write`；不要直接修改生成文件。

## 2. 本地评审

可直接打开 `index.html`，或从仓库根目录启动静态服务：

```text
python3 -m http.server 4173 --directory docs/design/assets/d002
```

评审控制提供：

- Default / High Contrast；
- 标准 / 1.25x 大字；
- 标准 / 减少动态；
- 320 / 390 / 736 内容预览宽度。

页面使用合成内容，不包含真实用户资料。核心示例保持“行动是主角，分数只是辅助信息”，标准字号在
常见手机一屏内完整呈现，大字允许自然增高和滚动。

SafetyScreen 示例只显示“待专业安全评审”的五项结构占位，用于检查现实帮助优先、无娱乐装饰和操作
层级。生产组件的全部可见文案与读屏名称默认值为空；D-002 不提供可上线的危机文案、号码或资源。

## 3. Figma 导入顺序

1. 导入 `primitive/Value.json`；
2. 导入 `semantic-default/Default.json`；
3. 导入 `semantic-high-contrast/High Contrast.json`；
4. 导入 `component/Value.json`；
5. 核验数量、代表 alias、Text/Effect Styles 和组件实例；
6. 记录 Figma version、Frame/component IDs 和截图。

Figma Starter 不能在同一 Semantic collection 中保留仓库定义的两个 modes，因此物理集合拆为 Default
和 High Contrast。这个平台映射不得反向改变 canonical manifest。

跨 collection alias 的导入文件同时携带已解析的 DTCG `$value` 与
`com.figma.aliasData`。前者保证 Figma 可以创建变量，后者把创建后的值重新连接到目标 collection；
不得改回仅包含花括号引用的 `$value`，否则跨文件引用无法在导入时解析。

## 4. 素材与许可

评审页只使用 HTML、CSS、文字和基础几何形状。系统字体通过设备回退使用；未引入第三方照片、插画、
图标库、字体文件或 Apple 专有资产。所有示例内容为合成资料。

## 5. 证据边界

仓库和现有证据可证明生成确定性、漂移、命名、对比度、响应式、触控尺寸、减少动态和大部分静态状态结构。
它们不能替代 Figma 原始 Variables/Styles/Components、微信 DevTools/真机、专业 Safety 评审或项目所有者
接受。专业 Safety 文案与资源当前明确为待评审；最新 Components、States 与本地 Safety 三张刷新证据
均已归档，项目所有者接受前保持 `MANUAL_EVIDENCE_REQUIRED`。

# D-002 Evidence Index

- **最后更新**：2026-08-14
- **当前状态**：`USER_ACCEPTANCE_PENDING / MANUAL_EVIDENCE_REQUIRED`
- **来源指纹**：`sha256:dcb100ea11fe0d534496af852983bc32d31f2d0a56ca20c4d01a2af79154d8d0`

## 1. 本地视觉证据

| 文件                           | 预期证明                           | 状态  |
| ------------------------------ | ---------------------------------- | ----- |
| `default-390-standard.png`     | Default、390px、标准字号的一屏层级 | READY |
| `default-320-standard.png`     | 320px 最窄内容、无裁切和重叠       | READY |
| `default-390-large-text.png`   | 1.25x 大字自然换行和增高           | READY |
| `high-contrast-components.png` | High Contrast 组件与非颜色状态     | READY |
| `reduced-motion.png`           | 减少动态稳定终态                   | READY |
| `safety-screen.png`            | 最新 Safety 结构占位与现实帮助优先 | READY |
| `review-mobile-320.png`        | 评审页本身在 320px 视口无横向溢出  | READY |

截图必须由当前仓库本地评审页产生，不使用占位图、外部网页或 D-001 历史截图代替。

2026-08-14 已归档并目视核验 7 张当前本地截图。项目所有者从当前评审页手动提供的
`safety-screen.png` 为 `1710 x 542` RGBA PNG，SHA-256 为
`016063e506d3d86bb3d08493cff02ab9eee219324c61e396a21dfbeee82ebc3c`；完整显示五项待评审占位，未见
裁切或重叠。其余固定截图格式、尺寸、非空内容和彼此不同的 SHA-256 已核对。该证据只证明本地评审面，
不替代 Figma、微信 DevTools 或真机证据。

Browser use URL policy 拒绝 Agent 读取 `file://` 内容，因此本截图由项目所有者手动提供；Agent 已完成
原文件逐字节归档、格式与像素检查及目视验收，未通过其它浏览器或底层命令绕过策略。

## 2. 浏览器测量

标准字号 Phone Preview：

| 选择宽度 | 实际内容宽度 | 内容高度 | 结果                       |
| -------: | -----------: | -------: | -------------------------- |
|      320 |        320px | 约 623px | 无裁切、无重叠、无页面溢出 |
|      390 |        390px | 约 623px | 无裁切、无重叠、无页面溢出 |
|      736 |        736px | 约 553px | 无裁切、无重叠、无页面溢出 |

1.25x 大字 Phone Preview：

| 选择宽度 | 内容高度 | 结果                   |
| -------: | -------: | ---------------------- |
|      320 | 约 748px | 自然增高；无裁切或重叠 |
|      390 | 约 708px | 自然增高；无裁切或重叠 |
|      736 | 约 620px | 自然增高；无裁切或重叠 |

评审页实际浏览器视口 `320x720`、`390x844`、`736x1024` 的 document scroll width 均等于 viewport
client width。评审控制条内部允许自身横向滚动，不把页面撑宽。

High Contrast + 1.25x + Reduced Motion 联合检查：

- 主行动字号 `30px`；
- Skeleton animation duration `0s`；
- 预览 transition duration `0s`；
- 生产组件示例没有小于 `44x44px` 的按钮；
- 未发现 `overflow: hidden/clip` 导致的文字裁切。

## 3. 对比度证据

`pnpm design-tokens:test` 对两种模式运行 24 组正文对比和 6 组非文字对比。代表结果：

| 组合                         | Default | High Contrast |  门槛 |
| ---------------------------- | ------: | ------------: | ----: |
| `textPrimary / canvas`       | 13.55:1 |       18.05:1 | 4.5:1 |
| `textMuted / canvas`         |  5.61:1 |        9.52:1 | 4.5:1 |
| `textInverse / brandPrimary` |  5.91:1 |        9.58:1 | 4.5:1 |
| `dangerText / dangerSurface` |  8.81:1 |        9.99:1 | 4.5:1 |
| `textInverse / safetyAction` |  7.26:1 |       10.22:1 | 4.5:1 |
| `focus / canvas`             |  6.37:1 |        8.35:1 |   3:1 |

状态边框不作为唯一状态信号；Info/Warning/Danger 同时提供文字与形状，Selected/Error/Completed 也使用
`已选`、`!`、`✓` 等可读等价物。

## 4. Figma 原始证据

| 文件                           | 预期证明                                                    | 状态  |
| ------------------------------ | ----------------------------------------------------------- | ----- |
| `figma-variables.jpg`          | 四个 collection 为 `33 / 86 / 70 / 70`，Component alias     | READY |
| `figma-semantic-alias.jpg`     | Default 70 个变量及 `color/canvas -> color/paper/50` alias  | READY |
| `figma-foundations-frame.jpg`  | Foundations `1200 x 900`、Token 层级、Typography 与 Effects | READY |
| `figma-components-frame.jpg`   | 17 个逻辑组件合同的完整一屏画布                             | READY |
| `figma-states-frame.jpg`       | 状态、HC、大字、Offline/Error、Reduced Motion 与 Safety     | READY |
| `figma-styles.jpg`             | 6 个 Text Styles 与 2 个 Effect Styles 的本地列表           | READY |
| `figma-text-style-usage.jpg`   | `DE/Text/Meta` 已绑定真实文本节点                           | READY |
| `figma-effect-style-usage.jpg` | `DE/Effect/Raised` 已绑定真实效果节点                       | READY |
| `figma-component-instance.jpg` | `Instance / SafetyScreen` 与 `From this file` 复用关系      | READY |
| `figma-named-version.jpg`      | 最终命名版本、来源指纹短码和版本描述                        | READY |

| 证据                         | 当前状态 | 要求                                                     |
| ---------------------------- | -------- | -------------------------------------------------------- |
| Variables collections/counts | READY    | Primitive 86、Default 70、High Contrast 70、Component 33 |
| Representative aliases       | READY    | Semantic -> Primitive、Component -> Primitive            |
| Text/Effect Styles           | READY    | 8 个本地 Style path、真实绑定节点 ID 和截图              |
| Foundations Frame            | READY    | root `174:309`、content `186:315` 与截图                 |
| Components Frame             | READY    | root `174:310`；当前 `1200 x 900` 全帧截图已归档         |
| States Frame                 | READY    | root `174:311`；当前 `1200 x 900` 全帧截图已归档         |
| Figma named version          | READY    | `2387487276296532390`，标题含来源指纹短码 `dcb100ea`     |
| Token/component reuse        | READY    | Variable alias、Style 绑定和 component instance 可见核验 |

Figma file key 为 `T5HS32Ciz6LZh81KbqhFGo`，D-002 page node 为 `83:2`，最终命名版本为
`D-002 Design System / dcb100ea / safety boundary final`。2026-08-14 已从当前 Figma 文件归档并目视
核验 10 张 Figma JPEG 截图，扩展名与二进制格式一致；其中 Components `174:310` 与 States `174:311`
两张刷新证据均为 `1456 x 731`、画布完整且使用“待专业安全评审”占位。被替代的旧全帧截图保留在仓库外，
不再作为当前证据。

### 4.1 Frame 与版本 ID

| 对象                       | Figma ID              |
| -------------------------- | --------------------- |
| D-002 page                 | `83:2`                |
| Foundations root / content | `174:309` / `186:315` |
| Components root / content  | `174:310` / `186:512` |
| States root / content      | `174:311` / `186:620` |
| 最终命名版本               | `2387487276296532390` |
| SafetyScreen instance      | `191:698`             |

### 4.2 Text/Effect Style 使用 ID

Figma 当前 UI 以本地 Style path 作为可见稳定标识，不显示 REST API style key。为避免伪造不可核验的
标识，本索引记录 UI path 和实际绑定该 Style 的画布 node ID：

| Style path           | 使用节点 ID |
| -------------------- | ----------- |
| `DE/Text/Meta`       | `186:354`   |
| `DE/Text/Label`      | `186:355`   |
| `DE/Text/Body`       | `186:356`   |
| `DE/Text/Section`    | `186:357`   |
| `DE/Text/Action`     | `186:358`   |
| `DE/Text/Page Title` | `186:359`   |
| `DE/Effect/Raised`   | `186:393`   |
| `DE/Effect/Sheet`    | `186:396`   |

### 4.3 Component ID

| Component                 | Figma ID  |
| ------------------------- | --------- |
| `DE / PageShell`          | `177:314` |
| `DE / AppHeader`          | `190:697` |
| `DE / Button / Primary`   | `190:696` |
| `DE / Button / Secondary` | `190:690` |
| `DE / Button / Text`      | `190:695` |
| `DE / ChoiceChip`         | `190:691` |
| `DE / StateSelector`      | `190:694` |
| `DE / FriendMessage`      | `190:689` |
| `DE / EnergySummary`      | `190:692` |
| `DE / ActionCard`         | `190:688` |
| `DE / SectionCard`        | `190:687` |
| `DE / InlineNotice`       | `190:693` |
| `DE / LoadingSkeleton`    | `190:686` |
| `DE / OfflineState`       | `190:684` |
| `DE / RecoverableError`   | `190:685` |
| `DE / ConfirmSheet`       | `190:683` |
| `DE / SafetyScreen`       | `190:682` |

`Instance / SafetyScreen`（`191:698`）来自 `DE / SafetyScreen`（`190:682`），右侧属性面板显示
`From this file`。主组件与 instance 使用同一套五项待评审结构占位；PageShell 保留原有 Variable 绑定，
组件导入没有创建第二个 PageShell。

## 5. 人工与平台证据

| 证据                      | 状态                                          |
| ------------------------- | --------------------------------------------- |
| 本地浏览器视觉/交互检查   | READY；7 张当前 PNG 均已归档并目视核验        |
| Figma 原始画布检查        | READY；10 张当前 JPEG 均已归档并目视核验      |
| 微信 DevTools conformance | `INFRA_BLOCKED`，沿用 E-004 明确诊断          |
| iOS/Android 真机          | `MANUAL_EVIDENCE_PENDING`                     |
| 专业 Safety 内容评审      | `MANUAL_EVIDENCE_PENDING`；不得由组件占位冒充 |
| 项目所有者接受 D-002      | PENDING                                       |

因此 Figma 原始证据已收敛，但项目所有者接受、微信 DevTools 和真机证据仍不能由仓库自动化替代；D-002
最终状态保持 `MANUAL_EVIDENCE_REQUIRED`，不得写成自动化 PASS 或 Accepted。

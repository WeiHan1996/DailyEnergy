# DailyEnergy Design System 与 Design Tokens

- **文档状态**：Accepted
- **接受日期**：2026-08-15
- **所属任务**：D-002 — 建立设计系统与 Design Tokens
- **最后更新**：2026-08-15
- **任务 Issue**：[D-002 #100](https://github.com/WeiHan1996/DailyEnergy/issues/100)
- **唯一视觉方向**：[A — 温柔自然 / 01B / Gentle Nature / DLY-003](./visual-direction.md)
- **仓库评审入口**：[D-002 Design System](./assets/d002/index.html)
- **Figma 文件**：[DailyEnergy / D-001 Visual Direction](https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?node-id=83-2&p=f)
- **Figma 最终命名版本**：[D-002 Design System / dcb100ea / safety boundary final](https://www.figma.com/design/T5HS32Ciz6LZh81KbqhFGo/DailyEnergy---D-001-Visual-Direction?version-id=2387487276296532390&node-id=191-698&p=f)
- **代码 Token 来源**：[apps/miniapp/design-tokens.json](../../apps/miniapp/design-tokens.json)
- **组件合同来源**：[apps/miniapp/component-library.json](../../apps/miniapp/component-library.json)
- **来源指纹**：`sha256:dcb100ea11fe0d534496af852983bc32d31f2d0a56ca20c4d01a2af79154d8d0`
- **证据状态**：`USER_ACCEPTED / PLATFORM_EVIDENCE_PENDING`

## 1. 目标

D-002 把 D-001 已接受的 A — 温柔自然方向转换为一套可复用、可审查、可由微信原生小程序安全消费的
Design Tokens 和基础组件。系统保持“清晰自然、排版克制、内容清晰”，不吸收其它视觉路线元素。

本系统首先服务每天约一分钟的移动端体验：主要行动和清楚文字是页面主角，分数只提供快速背景；层级
通过内容顺序、分组、颜色和留白建立，不靠无限放大数字或压缩正文。

## 2. 范围与非目标

本任务包含：

- Color、Typography、Spacing、Radius、Border、Shadow、Opacity、Motion、Icon、Safe area 和页面宽度；
- primitive、semantic、component 三层 Token；
- Default 与 High Contrast 两种语义模式；
- 17 个逻辑组件合同及其适用状态；
- 微信小程序 WXSS/TypeScript 生成物、Figma 导入文件、漂移 Gate 和 bundle Gate；
- 大字、触控目标、非颜色状态、减少动态、离线、错误与 Safety 的本地评审证据。

本任务不包含：

- DLY-001～DLY-003 等具体业务页面或真实 API；
- Dark Mode、管理后台视觉重做、聊天、商城、社区或专业排盘；
- 真实安全资源与专业安全文案评审；
- D-003 高保真页面设计。

## 3. 权威与生成方向

```text
Accepted D-001 + Accepted 页面/状态/布局规格
  -> apps/miniapp/design-tokens.json               canonical Token source
  -> tooling/lib/design-token-codegen.mjs          deterministic generator
     -> apps/miniapp/src/generated/*.wxss|*.ts     client-safe runtime
     -> docs/design/assets/d002/design-tokens.css  local review
     -> docs/design/assets/d002/figma-*.json       Figma import/evidence

apps/miniapp/component-library.json                canonical component contract
  -> apps/miniapp/src/components/*                 native miniapp components
  -> tooling/lib/miniapp-design-system-gate.mjs    contract and boundary Gate
```

规则：

- `design-tokens.json` 是 Token 唯一可编辑来源；生成文件带 `@generated` 和来源指纹，不手改；
- 页面和组件只消费 semantic/component Token，primitive 只存在于 foundations；
- 同一输入必须逐字节生成同一结果；缺失或手改产物由 drift Gate 拒绝；
- 生成物不得包含时间戳、本机路径、secret、Node-only import 或第二套业务约束；
- Figma 名称、仓库路径和组件名以本文及两个 canonical JSON 合同为映射依据。

## 4. Token 模型

### 4.1 数量与集合

| 层级                     | Canonical 数量 | Figma 导入数量 | 用途                                                |
| ------------------------ | -------------: | -------------: | --------------------------------------------------- |
| Primitive                |             86 |             86 | 原始颜色、尺寸、字体、形状、动效和图标值            |
| Semantic / Default       | 31 + 39 shared |             70 | Default 页面语义                                    |
| Semantic / High Contrast | 31 + 39 shared |             70 | High Contrast 页面语义                              |
| Component                |             33 |             33 | 按钮、卡片、通知、Header、Sheet、Skeleton 与 Safety |
| Canonical 合计           |            220 |     不相加去重 | 单一仓库来源中的唯一 Token 数                       |

Canonical Figma 模型是一套 `DE / Semantic` collection、两个 modes。Figma Starter 导入限制下，物理集合
拆为 `DE / Semantic / Default` 与 `DE / Semantic / High Contrast`；仓库 manifest 仍保留一套 Semantic
collection 的两个逻辑 modes，避免产生第二套权威。

这里的 foundations 指 canonical Token 来源及其生成的 Primitive/Semantic Variables，不等同于只允许
Primitive collection 保存直接值。Primitive 必须是直接值且不可 alias；shared semantic 与 component
必须引用受控上游 Token。当前 24 个经对比度验证的模式专属 semantic color slot（Default overlay 与
High Contrast 的专属颜色）允许在 canonical source 中保存直接色值，因为它们只定义对应 mode，不作为
业务可引用的 primitive palette。该例外由生成器精确 allowlist；新增直接值必须同时修改 Draft 规范与负向
fixture。页面、组件和非颜色 semantic 仍不得保存 raw 值，生成产物中的解析后值不构成第二套可编辑来源。

### 4.2 Primitive foundations

| 类别        | 基线                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Color       | 暖纸、叶绿、墨色，以及仅用于系统状态的蓝、黄、红                     |
| Font size   | `12 / 14 / 16 / 18 / 20 / 24 / 28 / 36 / 44px`                       |
| Font weight | `400 / 500 / 600 / 700`                                              |
| Line height | `1.25 / 1.35 / 1.65 / 1.75`                                          |
| Spacing     | `0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px`                |
| Radius      | `0 / 8 / 12 / 20 / pill`                                             |
| Border      | `0 / 1 / 2px`                                                        |
| Motion      | `0 / 160 / 200 / 240 / 1200ms`，位移 `6px`                           |
| Icon        | `16 / 20 / 24px`，线宽 `1.75`                                        |
| Layout      | 触控目标 `44px`、控件高度 `48px`、内容最大宽度 `600px`、页面 `100vh` |

### 4.3 Semantic roles

| 角色组         | 主要 Token                                                 | 使用约束                               |
| -------------- | ---------------------------------------------------------- | -------------------------------------- |
| Canvas/Surface | `canvas`、`surfacePrimary/Secondary/Raised/Disabled`       | 页面与容器层级，不用卡片堆叠制造层级   |
| Text           | `textPrimary/Secondary/Muted/Inverse`                      | 正文不使用低对比超细字                 |
| Brand          | `brandPrimary/Strong/Soft`                                 | 温柔自然线索；不承担警告或 Safety 含义 |
| Border/Focus   | `borderSubtle/Default/Strong`、`focus`                     | Focus 必须可见；状态不只靠边框颜色     |
| System         | `info*`、`warning*`、`danger*`                             | 同时使用文字、形状或图标               |
| Safety         | `safetyCanvas/Text/Action/Border`                          | 完全退出普通娱乐和品牌叙事层           |
| Layout         | `pageGutter`、`contentMax`、`safeTop/Bottom`、`sectionGap` | 结合微信安全区环境值                   |
| Motion         | `fast/standard/gentle/slow/reduced/distance`               | 减少动态时全部进入稳定终态             |

Default 核心色为暖纸 `#F8F6EF`、叶绿 `#2F6F5D`、墨绿 `#1B2C25`。High Contrast 使用白色
Canvas、深墨文本和更深叶绿，但不改变角色名称、内容顺序或状态语义。

### 4.4 Typography hierarchy

| 语义       | 标准字号 | 作用                         |
| ---------- | -------: | ---------------------------- |
| Meta       |     12px | 日期、辅助信息和娱乐标签     |
| Label      |     14px | 字段与行动标签               |
| Body       |     16px | 主要解释正文                 |
| Body Large |     18px | 重点短句和状态标题           |
| Section    |     20px | 区块标题                     |
| Action     |     24px | 今日重点与主要行动           |
| Page Title |     28px | 页面标题                     |
| Score      |     28px | 快速背景信息，不高于行动层级 |

本地评审页提供真实 Token 覆盖的 1.25x 大字视图。该视图用于证明换行、自然增高和无裁切，不建立一套
独立生产 Token；小程序仍遵循平台字体设置和自然滚动。

## 5. 组件合同

17 个逻辑合同落在 15 个微信原生组件目录中；三种按钮共用 `action-button` 实现，避免复制状态逻辑。

|   # | Figma/合同名              | Figma component ID | 代码目录            | 适用变体与状态                                                     |
| --: | ------------------------- | ------------------ | ------------------- | ------------------------------------------------------------------ |
|  01 | `DE / PageShell`          | `177:314`          | `page-shell`        | Default、High Contrast、Reduced Motion；Normal                     |
|  02 | `DE / AppHeader`          | `190:697`          | `app-header`        | Root、Back、Actions；Normal、Disabled                              |
|  03 | `DE / Button / Primary`   | `190:696`          | `action-button`     | Primary；Normal、Loading、Disabled                                 |
|  04 | `DE / Button / Secondary` | `190:690`          | `action-button`     | Secondary；Normal、Loading、Disabled                               |
|  05 | `DE / Button / Text`      | `190:695`          | `action-button`     | Text；Normal、Loading、Disabled                                    |
|  06 | `DE / ChoiceChip`         | `190:691`          | `choice-chip`       | Single、Compact；Normal、Selected、Disabled                        |
|  07 | `DE / StateSelector`      | `190:694`          | `state-selector`    | Default、With Description；Normal、Selected、Error、Disabled       |
|  08 | `DE / FriendMessage`      | `190:689`          | `friend-message`    | Default、Compact；Normal、Fallback                                 |
|  09 | `DE / EnergySummary`      | `190:692`          | `energy-summary`    | Default、Compact；Normal、Loading、Offline                         |
|  10 | `DE / ActionCard`         | `190:688`          | `action-card`       | Default、With Reason；Normal、Completed、Disabled                  |
|  11 | `DE / SectionCard`        | `190:687`          | `section-card`      | Default、Subtle、Raised；Normal、Loading、Disabled                 |
|  12 | `DE / InlineNotice`       | `190:693`          | `inline-notice`     | Info、Success、Warning、Error；Normal、With Action                 |
|  13 | `DE / LoadingSkeleton`    | `190:686`          | `loading-skeleton`  | Text、Card；Loading、Reduced Motion                                |
|  14 | `DE / OfflineState`       | `190:684`          | `offline-state`     | Inline、Page；Offline、Retrying                                    |
|  15 | `DE / RecoverableError`   | `190:685`          | `recoverable-error` | Inline、Page；Recoverable Error、Retrying                          |
|  16 | `DE / ConfirmSheet`       | `190:683`          | `confirm-sheet`     | Standard、Danger；Normal、Loading、Disabled                        |
|  17 | `DE / SafetyScreen`       | `190:682`          | `safety-screen`     | General、Resources Unavailable；Safety、Loading、Recoverable Error |

组件共同要求：

- 正常、选中、完成、错误、离线、禁用和 Safety 由文字或结构与颜色共同表达；
- 交互控件最小触控目标约 44px，主按钮高度 48px；
- 可操作组件提供读屏名称；radio/selected、loading、dialog 和 status 暴露对应语义；
- Loading 锁定重复操作；Reduced Motion 停止旋转、脉冲和位移；
- Offline/Recoverable Error 保留已读内容和明确恢复动作；
- SafetyScreen 不显示分数、幸运元素、点亮、任务、分享或普通导航；生产组件只提供现实帮助优先的
  结构合同，所有可见文案、按钮文本、状态说明与读屏名称默认均为空，必须由后续经专业评审、版本化的
  `SafetyResponsePlan` 注入。D-002 不内置未经评审的危机文案、号码或资源。

## 6. 页面消费规则

- 页面 WXSS 不得出现新的 raw hex/rgb/hsl 色值；
- 既有页面迁移后，受控布局尺寸使用 semantic/component Token；
- 业务页面不得引用 `--de-primitive-*` 或 canonical JSON primitive 路径；
- 页面只组合组件，不在页面复制按钮、Chip、错误、Sheet 或 Safety 状态样式；
- 固定像素只允许平台要求、1px hairline 或经 Gate allowlist 的局部实现细节；
- 图标必须有可读名称或与可见文字共同出现，装饰图标对读屏隐藏。

## 7. 无障碍与状态证据

自动化已固定：

- Default/High Contrast 共 24 组正文颜色对比均不低于 `4.5:1`；
- 两种模式共 6 组 focus/brand/Safety 非文字边界均不低于 `3:1`；
- 44px 触控目标、1.25x 大字自然换行、减少动态 `0ms`、ARIA/非颜色状态信号；
- 320、390、736 评审宽度和 320/390/736 实际浏览器视口无页面横向溢出；
- Safety、Offline、Recoverable Error、Loading、Disabled 与 Completed 的组件状态可见。

详细截图、测量与剩余人工证据见 [D-002 evidence index](./assets/d002/evidence/README.md)。浏览器和仓库检查
不能替代微信 DevTools、真机、Figma 原始节点或项目所有者接受。

## 8. Figma 映射与证据状态

### 8.1 Frames 与版本

| 画布        | 根 Frame ID | 内容 Frame/Group ID | 尺寸         |
| ----------- | ----------- | ------------------- | ------------ |
| Foundations | `174:309`   | `186:315`           | `1200 x 900` |
| Components  | `174:310`   | `186:512`           | `1200 x 900` |
| States      | `174:311`   | `186:620`           | `1200 x 900` |

最终命名版本为 `D-002 Design System / dcb100ea / safety boundary final`，version ID
`2387487276296532390`。版本描述记录 SafetyScreen 使用仅供评审的占位文案、真实 instance 继承主组件，
且未内置未经评审的危机文案或资源；220 个 canonical Token、8 个已绑定本地 Style、17 个逻辑组件和
三个证据 Frame 保持不变。

### 8.2 Styles 与真实使用节点

Figma 当前界面以本地 Style path 作为可见稳定标识，不暴露 REST API style key；因此不臆造一个不可核验
的 key。下表同时记录界面可见 path 和已绑定该 Style 的真实节点 ID，截图中可见 Style 列表与绑定关系。

| 本地 Style path      | 真实使用节点 ID | 用途                  |
| -------------------- | --------------- | --------------------- |
| `DE/Text/Meta`       | `186:354`       | 12px 辅助信息         |
| `DE/Text/Label`      | `186:355`       | 14px 标签             |
| `DE/Text/Body`       | `186:356`       | 16px 正文             |
| `DE/Text/Section`    | `186:357`       | 20px 区块标题         |
| `DE/Text/Action`     | `186:358`       | 24px 主要行动         |
| `DE/Text/Page Title` | `186:359`       | 28px 页面标题         |
| `DE/Effect/Raised`   | `186:393`       | Raised surface shadow |
| `DE/Effect/Sheet`    | `186:396`       | Sheet shadow          |

组件复用证据为 `Instance / SafetyScreen`（instance ID `191:698`），来源主组件
`DE / SafetyScreen`（component ID `190:682`）；Figma 右侧面板显示 `From this file`。

| 证据字段                     | 当前状态               | 当前证据或解锁条件                                          |
| ---------------------------- | ---------------------- | ----------------------------------------------------------- |
| `designSourceEvidence`       | READY                  | Variables、Styles、Components、Frames 与截图均已归档        |
| `figmaFile`                  | READY                  | file key `T5HS32Ciz6LZh81KbqhFGo`                           |
| `figmaPage`                  | READY                  | `D-002 / Design System`，page node `83:2`                   |
| `figmaVersion`               | READY                  | final version `2387487276296532390`                         |
| `frameIds`                   | READY                  | 三个根 Frame、三个内容 Frame 和 17 个 component ID 已核验   |
| `stateScreenshots`           | READY                  | Figma Components/States 与本地 Safety 刷新证据均已归档      |
| `tokenAndComponentReuse`     | READY                  | alias、8 个 Style 使用节点和 instance `191:698` 均可见核验  |
| `visualAndInteractionReview` | READY                  | 项目所有者已审核 PR #142、Figma 与归档证据                  |
| `userAcceptance`             | READY                  | 2026-08-15 明确接受 D-002                                   |
| `threatBoundaryReview`       | READY                  | SafetyScreen 仅提供注入结构；普通娱乐流、日志与资源边界不变 |
| `productionAuthorization`    | NOT_APPLICABLE / NO_GO | 本任务不授权 Production，既有 Production/RC Gate 保持       |

项目所有者人工审核与接受已经完成，本文因此进入 Accepted。微信 DevTools、iOS/Android 真机与专业 Safety
文案/资源评审仍是独立下游证据，不得将本文的接受写成自动化 PASS、专业 Safety 放行或 Production 授权。

## 9. 本地命令

```text
pnpm design-tokens:test
pnpm design-tokens:check
node tooling/test-miniapp-design-system.mjs
node tooling/check-miniapp-design-system.mjs
pnpm --filter @daily-energy/app-miniapp build
pnpm agent:validate --mode=full --task=D-002
```

完整 Gate 的 macOS `flock` 环境阻断必须按原诊断保留，不能改写为 PASS。微信 DevTools 和真机证据仍按
Accepted testing policy 保持独立证据层。

## 10. 审核记录

- **项目所有者结论**：接受 D-002；
- **确认日期**：2026-08-15；
- **审核入口**：[PR #142](https://github.com/WeiHan1996/DailyEnergy/pull/142)、Figma 最终命名版本与本地证据索引；
- **接受范围**：A — 温柔自然的唯一方向、行动高于分数的层级、Default/High Contrast、大字与关键状态、
  17 个基础组件及其作为 D-003 唯一基础组件集的交付；
- **保留边界**：SafetyScreen 仍不包含可上线危机文案或资源；微信 DevTools、真机、专业 Safety 与
  Production/RC 证据未因本次接受而解除。

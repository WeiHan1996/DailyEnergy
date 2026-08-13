# D-001 视觉与状态证据

- **状态**：Accepted direction evidence
- **所属任务**：D-001 — 确定品牌与视觉方向
- **最后更新**：2026-08-13

## 1. 证据清单

| 文件                                                         | 证明范围                                   | 结果与边界                                            |
| ------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------- |
| [a-figma-authoritative.png](./a-figma-authoritative.png)     | A 权威 Figma 代表页                        | 原始 `840 x 1840` 按 2 倍比例缩放；未裁切 `420 x 920` |
| [a-local-synced.png](./a-local-synced.png)                   | 仓库评审页同步后的 A 代表页                | `420 x 920`；向权威截图同步，不替代 Figma 原稿        |
| [figma-overview.png](./figma-overview.png)                   | Figma 十三个 Frame 的画布总览              | 五案同结构并列，含五路状态和决策矩阵；保留选择过程    |
| [d-hierarchy-figma.jpg](./d-hierarchy-figma.jpg)             | Figma D 代表页首轮层级修订                 | Frame `12:66`；分数降级，重点/解释/行动提升           |
| [d-hierarchy-360.jpg](./d-hierarchy-360.jpg)                 | D 修订版 360px 完整手机画面                | 无横向溢出；行动与解释完整，按钮未被遮挡              |
| [d-one-screen-360.png](./d-one-screen-360.png)               | D 一屏版 360 x 844 浏览器证据              | 312 x 734 手机稿完整可见；内容靠浓缩和分组建立层级    |
| [d-one-screen-figma.png](./d-one-screen-figma.png)           | Figma D 一屏版导出预览                     | 版本 `2387112673004022103`、Frame `12:66`；完整一屏   |
| [viewport-360.png](./viewport-360.png)                       | 360px 小屏                                 | 页面无横向溢出；D/E 代表页宽度 312px                  |
| [viewport-736.png](./viewport-736.png)                       | 736px 对话/平板宽度                        | 页面无横向溢出；D/E 代表页宽度 400px                  |
| [viewport-320.jpg](./viewport-320.jpg)                       | 原三路线 320px 历史证据                    | 保留历史；新增五路线以 360px/736px 证据为准           |
| [viewport-390.jpg](./viewport-390.jpg)                       | 原三路线 390px 历史证据                    | 保留历史；新增五路线以 360px/736px 证据为准           |
| [large-text-browser-zoom.jpg](./large-text-browser-zoom.jpg) | 浏览器放大后的大字阅读                     | 标题与正文换行后仍保持层级；不是微信真机系统字号证据  |
| [non-color-states.jpg](./non-color-states.jpg)               | 低状态、Offline、Recoverable Error、Safety | 所有状态同时使用文字、结构位置和说明，不只依赖颜色    |

## 2. 减少动态

当前评审页没有持续动画、自动播放、闪烁或循环装饰。样式表包含
`@media (prefers-reduced-motion: reduce)`，在减少动态偏好下关闭平滑滚动；Figma 方向稿为静态
评审 Frame。路线动效时长仅是 D-001 候选规则，实际实现与微信真机验证属于 D-002 及后续任务。

## 3. 证据边界

- 截图使用固定虚构演示内容，不含真实用户信息；
- A 权威截图对应 `01B / Gentle Nature / DLY-003`、Frame `1:119` 和版本 `2386995845583123461`，
  是 D-002 的唯一视觉方向输入；
- Figma 接受记录版本 `2387205319197099564` 已将唯一方向、理由、`None / 不吸收其它路线元素`、
  `Accepted` 和日期写入 `00 / Read me`（Frame `12:164`）与 `07 / Decision Matrix`（Frame `12:239`），
  并从固定版本逐一完成可见核验；
- 本地同步稿使用相同的 `420 x 920` 画板、固定内容、系统无衬线层级、暖纸/绿色色板、右上自然弧线、
  圆角能量/行动区和胶囊主按钮；人工并排核对未引入其它路线元素；
- 项目所有者选择 A 的理由是“清晰自然，排版克制，内容清晰”，并明确不吸收其它路线元素；
- D 一屏版保持分数、事实、信息顺序、主要行动和点亮规则不变，只作为历史过程证据；
- 截图证明本轮浏览器与 Figma 可见结果，不代替读屏、色觉或 iOS/Android 微信真机测试；
- 项目所有者已于 2026-08-13 接受 A — 温柔自然为唯一主方向，Figma 决策文字已同步；D-001 远程
  PR 仍待更新与合并。自动检查不能替代这项人工接受、Figma 可见核验或宣称视觉 PASS。

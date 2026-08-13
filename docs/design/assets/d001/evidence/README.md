# D-001 视觉与状态证据

- **状态**：Ready for Review
- **所属任务**：D-001 — 确定品牌与视觉方向
- **最后更新**：2026-08-13

## 1. 证据清单

| 文件                                                         | 证明范围                                   | 结果与边界                                             |
| ------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------ |
| [figma-overview.png](./figma-overview.png)                   | Figma 十三个 Frame 的画布总览              | 五案同结构并列，含五路状态和决策矩阵；不能替代用户选择 |
| [viewport-360.png](./viewport-360.png)                       | 360px 小屏                                 | 页面无横向溢出；D/E 代表页宽度 312px                   |
| [viewport-736.png](./viewport-736.png)                       | 736px 对话/平板宽度                        | 页面无横向溢出；D/E 代表页宽度 400px                   |
| [viewport-320.jpg](./viewport-320.jpg)                       | 原三路线 320px 历史证据                    | 保留历史；新增五路线以 360px/736px 证据为准            |
| [viewport-390.jpg](./viewport-390.jpg)                       | 原三路线 390px 历史证据                    | 保留历史；新增五路线以 360px/736px 证据为准            |
| [large-text-browser-zoom.jpg](./large-text-browser-zoom.jpg) | 浏览器放大后的大字阅读                     | 标题与正文换行后仍保持层级；不是微信真机系统字号证据   |
| [non-color-states.jpg](./non-color-states.jpg)               | 低状态、Offline、Recoverable Error、Safety | 所有状态同时使用文字、结构位置和说明，不只依赖颜色     |

## 2. 减少动态

当前评审页没有持续动画、自动播放、闪烁或循环装饰。样式表包含
`@media (prefers-reduced-motion: reduce)`，在减少动态偏好下关闭平滑滚动；Figma 方向稿为静态
评审 Frame。路线动效时长仅是 D-001 候选规则，实际实现与微信真机验证属于 D-002 及后续任务。

## 3. 证据边界

- 截图使用固定虚构演示内容，不含真实用户信息；
- 截图证明本轮浏览器与 Figma 可见结果，不代替读屏、色觉或 iOS/Android 微信真机测试；
- D-001 在项目所有者选择并接受唯一主方向前仍为 `MANUAL_EVIDENCE_REQUIRED`。

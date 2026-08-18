# Design

体验、交互与正式视觉设计目录。

已接受的页面与交互基线：

- [information-architecture.md](./information-architecture.md)
- [screen-inventory.md](./screen-inventory.md)
- [screen-specs.md](./screen-specs.md)
- [interaction-states.md](./interaction-states.md)
- [content-layout.md](./content-layout.md)
- [prototype-validation.md](./prototype-validation.md)

正式视觉交付：

- [D-001 视觉方向](./visual-direction.md) — Accepted
- [D-002 Design System](./design-system.md) — Accepted
- [D-002 评审资产与 Figma 导入说明](./assets/d002/README.md)
- [D-002 证据索引](./assets/d002/evidence/README.md)
- [D-003 核心流程高保真](./core-flow-high-fidelity.md) — Accepted
- [D-004 Prototype / QA / Developer Handoff](./developer-handoff.md) — Draft / In Progress

正式视觉工作流已进入 Phase 2。D-001、D-002、D-003 均已由项目负责人接受并合并；D-004 现在是唯一 In Progress 设计任务：

| Issue                                                              | 状态        | 文档                                             | 主要结果                                           |
| ------------------------------------------------------------------ | ----------- | ------------------------------------------------ | -------------------------------------------------- |
| [D-001 #99](https://github.com/WeiHan1996/DailyEnergy/issues/99)   | Done        | [visual-direction.md](./visual-direction.md)     | A — 温柔自然；PR #140 已合并                       |
| [D-002 #100](https://github.com/WeiHan1996/DailyEnergy/issues/100) | Done        | [design-system.md](./design-system.md)           | Design Tokens / Components；PR #142 已合并         |
| [D-003 #101](https://github.com/WeiHan1996/DailyEnergy/issues/101) | Done        | [core-flow-high-fidelity.md](./core-flow-high-fidelity.md) | 核心 35 Frame + QA；PR #144 已合并                 |
| [D-004 #102](https://github.com/WeiHan1996/DailyEnergy/issues/102) | In Progress | [developer-handoff.md](./developer-handoff.md)   | 可点击原型、异常恢复、Visual QA、开发证据合同       |
| [D-005 #104](https://github.com/WeiHan1996/DailyEnergy/issues/104) | Planned     | `phase2-remaining-handoff.md`                    | 晚间、趋势与数据权利页面高保真及开发交付           |

D-004 当前 Figma：

- Prototype source：`D-003 / Core Flow High Fidelity`（Page `220:2`），起点 `220:3`；
- D-003 正式 35 Frame ID 保持不变；
- D-004 Prototype-only：Delete Confirm `295:227`、Silent Fallback `303:210`、Personalization Reduced `303:245`；
- Visual QA raster baseline：`D-004 / Visual QA Baseline`（Page `303:275`），15 个 snapshot。

依赖顺序保持 `D-001 → D-002 → D-003 → D-004 → D-005`。

- D-004 被项目负责人明确接受前，C-003、C-004、C-009 不得开始正式页面实现；
- D-005 被接受前，C-012、C-013、C-014 不得开始对应页面实现；
- `developer-handoff.md` 当前仍是 Draft，Prototype/Visual QA 完成不自动等于 Accepted；
- 外部 5～8 人研究、Safety 专业资源、微信平台/真机与 Production/RC Gate 继续遵守各自独立授权和证据边界。

设计目标是温暖、克制、有呼吸感，而不是堆叠玄学符号。

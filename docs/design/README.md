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
- [D-004 Prototype / QA / Developer Handoff](./developer-handoff.md) — Accepted；PR #145 merged
- [D-005 Phase 2 剩余页面高保真 / Handoff](./phase2-remaining-handoff.md) — Accepted；项目负责人 2026-08-19 审核通过

D 系列正式视觉前置已全部完成：

| Issue | 状态 | 文档 | 主要结果 |
| --- | --- | --- | --- |
| [D-001 #99](https://github.com/WeiHan1996/DailyEnergy/issues/99) | Done | [visual-direction.md](./visual-direction.md) | A — 温柔自然；PR #140 |
| [D-002 #100](https://github.com/WeiHan1996/DailyEnergy/issues/100) | Done | [design-system.md](./design-system.md) | Design Tokens / Components；PR #142 |
| [D-003 #101](https://github.com/WeiHan1996/DailyEnergy/issues/101) | Done | [core-flow-high-fidelity.md](./core-flow-high-fidelity.md) | 核心 35 Frame + QA；PR #144 |
| [D-004 #102](https://github.com/WeiHan1996/DailyEnergy/issues/102) | Done | [developer-handoff.md](./developer-handoff.md) | Prototype、异常恢复、Visual QA、开发证据合同；PR #145 |
| [D-005 #104](https://github.com/WeiHan1996/DailyEnergy/issues/104) | Done / Accepted | [phase2-remaining-handoff.md](./phase2-remaining-handoff.md) | 晚间、趋势、删除 / 导出、数据权利与注销高保真及开发交付；PR #146 |

D-005 Figma：

- Source：`D-005 / Phase 2 Remaining High Fidelity`（Page `495:219`），29 个正式 Frame；
- QA：`D-005 / Responsive & Visual QA`（Page `507:2`），5 个 editable QA Frame + 10 个 raster snapshot；
- 375px：EVE `507:3`、REC `507:4`；
- 125% Large Text：SET-006 `507:5`；
- Keyboard Safe Area：`507:6`；
- Reduced Motion / DataTask：`507:7`。

最终 D-005 机器审计：29 / 29 正式 Frame、24 个 Prototype reaction node、0 broken destination、0 小于 44px 的 reaction target、9 / 9 异常状态卡无卡内裸动作且无溢出、16 / 16 趋势图带可见文字摘要、raw unbound solid paint 为 0。

D-005 Accepted 后，C-012、C-013、C-014 的 **D-005 设计前置**已解除；这些任务仍必须满足各自其它工程依赖。Phase 2 下一工程任务按顺序进入 C-001。

Safety 继续复用 Accepted SAFE-001 与既有安全响应合同；外部研究、微信平台 / 真机与 Production / RC Gate 继续遵守各自独立授权和证据边界。

设计目标保持温暖、克制、有呼吸感，并明确区分“娱乐与行动参考”和“你的真实记录”。

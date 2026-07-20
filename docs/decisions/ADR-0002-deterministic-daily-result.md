# ADR-0002：稳定产品日期、种子与每日结果身份

- **状态**：Draft
- **日期**：2026-07-20
- **所属任务**：S-10 — 稳定种子与产品日期决策
- **决策范围**：权威产品日期、跨日资格、稳定种子、具名选择、结果版本、生成意图、历史冻结与删除边界
- **决策所有者**：DailyEnergy 项目
- **相关文档**：[ADR-0001 产品定位](./ADR-0001-product-positioning.md)、[产品状态机](../product/state-machine.md)、[业务规则](../product/business-rules.md)、[今日内容 Schema](../ai/daily-content-schema.md)、[晚间反馈 Schema](../ai/evening-feedback-schema.md)、[七天总结 Schema](../ai/weekly-summary-schema.md)、[共享 Schema 包](../../packages/shared-schemas/README.md)
- **测试向量**：[ADR-0002 确定性测试向量](./adr-0002-test-vectors.json)
- **下游任务**：S-11 规则引擎、S-12 AI Gateway、S-17～S-20 数据与接口、S-24 埋点、S-32 部署与时钟、Phase 1 工程实现

## 1. 背景

DailyEnergy 已接受以下不变量：同一用户同一产品日期最多一份可用每日结果；结果不能因刷新、重试、付费或模型变化而重抽；晚到响应不能把旧日事实写到新日；七天窗口必须保留连续产品日期和真实缺失。

这些不变量仍缺少几个字节级和时间点级决定：

- 中国大陆首批种子用户使用哪个权威时区；
- “一天”在什么时刻切换，午夜后的使用属于哪一天；
- 页面已经打开、命令已经接受和生成正在执行时，跨界后的权限分别是什么；
- 稳定种子由哪些字段组成，怎样在不同语言中得到相同字节；
- 增加一个随机选择是否会意外改变所有既有结果；
- result_version、规则、算法、候选目录和 Schema 怎样冻结成一份清单；
- 并发、失败、部署、签到更正和删除如何避免第二份结果或幽灵复活。

如果这些问题由前端、后端、规则引擎和 AI Gateway 各自回答，会产生同一时刻两个产品日期、重试换结果、部署后历史漂移和删除后隐式重建。S-10 必须在实现前把它们固化为一个可复算决定。

## 2. 决策摘要

|   # | 主题           | 决定                                                                       |
| --: | -------------- | -------------------------------------------------------------------------- |
|   1 | P0 产品时区    | 固定使用 IANA `Asia/Shanghai`，不读取设备时区决定业务归属                  |
|   2 | 产品日边界     | 本地民用时间 04:00:00；产品日 D 是 `[D 04:00, D+1 04:00)`                  |
|   3 | 当前产品日期   | 由服务端权威时钟和 `product-date-v1` 唯一解析，客户端只能展示              |
|   4 | 日期冻结       | 命令被服务端持久接受时冻结 target_product_date 与策略版本；重试复用        |
|   5 | 页面续写       | 边界前已合法打开的 DLY-003 / EVE-001，可在边界后 30 分钟内执行有限旧日写入 |
|   6 | 生成完成       | 边界前已创建的生成意图，可在边界后 15 分钟内完成；超出后取消，不迁移       |
|   7 | 命令提交       | 边界前已接受的命令继续原日期；其处理 SLA 不由页面续写窗口重判              |
|   8 | 七天窗口       | 按产品日历日期从锚点向前取六日，不用 24 小时毫秒差或最近七个相遇日         |
|   9 | 稳定主体       | 使用内部不可变、高熵 `stable_subject_id`；禁止微信 openid、手机号和渠道 ID |
|  10 | 根种子         | 六个 ASCII 字段做 32 位大端长度前缀编码，再用 SHA-256 得到 32 字节摘要     |
|  11 | 随机选择       | 每个决定使用版本化具名 namespace 独立派生，不使用共享顺序 PRNG 流          |
|  12 | 有限集合选择   | 取派生摘要前 64 位大端无符号整数，使用 rejection sampling 消除取模偏差     |
|  13 | result_version | 指向不可变生成清单；生成意图创建时选择并冻结，不由客户端拼装               |
|  14 | 唯一性         | 概念上以用户 + 产品日期唯一生成意图和唯一 AVAILABLE 结果；并发读取胜者     |
|  15 | 历史           | 已发布对象不可变；规则、Prompt、模型、tzdb 或版本升级不重写历史            |
|  16 | 删除           | DAY 删除不自动重建；S-18 接受最小删除回执前，同日显式重新开始保持禁用      |

## 3. 目标与非目标

### 3.1 目标

本 ADR 必须保证：

1. 任一可信时间点只解析出一个当前产品日期；
2. target_product_date 不因响应延迟、设备时钟或重试变化；
3. OPEN、CONTINUATION_ONLY 和 CLOSED 对同一输入有唯一结果；
4. 同一根种子和 namespace 在所有合规实现中产生相同选择；
5. 新增一个具名选择不会移动旧选择的随机流；
6. 同日并发、重试、降级和部署只产生一个可用结果；
7. 历史内容不重算，删除内容不被缓存、种子或重试复活；
8. 下游可以直接建立日期服务、规则引擎、数据库唯一性和契约测试。

### 3.2 非目标

本 ADR 不决定：

- 五维分数、档位阈值、候选排序和行动业务规则；
- AI 模型、Prompt、超时、重试次数和表达缓存；
- 数据库产品、表名、索引语法和事务实现；
- API 路径、HTTP 状态、错误码和 continuation token 格式；
- 多国家、多时区账户或旅行时切换时区；
- 用户可选“日开始时间”；
- 通知平台模板和实际调度器；
- 同日删除后重新开始所需的最小保留是否合法。

## 4. 产品日期策略

### 4.1 `product-date-v1` 清单

| 字段                            | v1 值                | 说明                                             |
| ------------------------------- | -------------------- | ------------------------------------------------ |
| `policy_version`                | `product-date-v1`    | 任何语义变化必须创建新版本                       |
| `timezone_id`                   | `Asia/Shanghai`      | IANA 标识，不使用 `UTC+8` 固定字符串替代存储语义 |
| `boundary_local_time`           | `04:00:00`           | 本地民用时间，左闭右开                           |
| `calendar`                      | `ISO-8601-Gregorian` | product_date 使用 `YYYY-MM-DD` 民用日期          |
| `view_continuation_minutes`     | `30`                 | 只作用于边界前已打开的合格页面                   |
| `generation_completion_minutes` | `15`                 | 只作用于边界前已创建的生成意图                   |
| `weekly_window_days`            | `7`                  | 包含锚点的七个连续产品日期                       |

选择 `Asia/Shanghai` 是因为 P0 只面向中国大陆首批种子用户。IANA tzdb 会随民用时间规则变化而更新，因此服务保存 IANA ID、策略版本和已经解析出的 product_date，不把 `+08:00` 当作永久业务规则。

选择 04:00 而不是 00:00，是为了让午夜后短暂回看、晚间反馈和未结束的阅读仍属于刚结束的生活日，同时避免在高频使用时段制造双日期。04:00 不是“宽限后才换日”：当前产品日期在该时刻精确切换，旧页面写入资格是独立的 continuation 判定。

### 4.2 唯一解析公式

给定权威时刻 `now`：

1. 使用策略版本对应的 tzdb 将 `now` 转为 `Asia/Shanghai` 本地民用时间；
2. 取本地日期 `local_date` 和本地时间 `local_time`；
3. 如果 `local_time >= 04:00:00`，则 `product_date = local_date`；
4. 否则 `product_date = local_date - 1 calendar day`；
5. 返回 product_date、policy_version、resolved_at、当前产品日绝对起止时刻和所用 tzdb release。

产品日 D 的绝对区间由 IANA 规则解析本地 `[D 04:00:00, D+1 04:00:00)`。日历加减必须按民用日期完成，禁止写成 `timestamp ± 86_400_000` 的通用实现。P0 当前时区没有未来 DST 切换，但接口仍按 IANA 民用时间设计，避免后续复用错误。

### 4.3 权威时钟与“已接受”

- 客户端时间、设备时区、请求头日期、前端倒计时和缓存时间都不是写入依据；
- `accepted_at` 来自受监控的服务端权威时钟；具体同步和漂移告警由 S-32 决定；
- 命令只有在服务端完成身份、幂等、target_product_date、策略版本和最小命令信封的持久接受后，才算 accepted；
- 按钮点击、请求离开设备、代理收到包和客户端本地排队都不算 accepted；
- 接受后冻结 target_product_date、policy_version 和幂等意图；响应何时到达不改变归属；
- 同一 idempotency intent 与相同规范化载荷重试，读取原 accepted envelope；不同载荷复用同一意图必须拒绝；
- 边界前未成功接受的旧日命令，边界后不能靠新意图补交到旧日。

### 4.4 每周窗口

给定 `window_end_date = D`：

- `window_start_date = D - 6 calendar days`；
- day slots 依次为 D-6、D-5、…、D；
- 每项都使用同一 product_date policy family；
- 缺失日期保留，不压缩成最近七条记录；
- 关系的第七个相遇日只负责打开入口，不改变窗口；
- 历史导航按 product_date 锚点移动，不以 UTC 小时数滑动。

### 4.5 tzdb 更新与失败

- 每次解析保存 product_date 和 policy_version；历史事实不因 tzdb 更新重新归日；
- 解析审计保存部署所用 tzdb release，但客户端无需接收；
- 如果 tzdb 更新可能改变未来边界，必须先评估并发布新的 product_date policy version；
- 新策略只作用于尚未接受的新命令，不改写既有 intent、结果或事实；
- 服务无法获得可信时钟、时区规则或唯一解析结果时，读缓存可以标记日期未知，但所有新写入、生成意图和 continuation 授权 fail closed；
- 恢复后重新解析当前日期，不把失败期间的客户端草稿自动补交。

## 5. 跨日资格

### 5.1 三类资格不能混用

| 资格                    | 创建条件                                    | 边界后行为                             | 期限                              |
| ----------------------- | ------------------------------------------- | -------------------------------------- | --------------------------------- |
| `COMMAND_COMMIT`        | 边界前服务端已持久接受命令                  | 继续原 target_product_date，不重新解析 | 受正常事务/任务 SLA；不是页面宽限 |
| `VIEW_CONTINUATION`     | OPEN 期间服务端确认已打开 DLY-003 / EVE-001 | 仅有限旧日操作                         | 边界后 30 分钟，左闭右开          |
| `GENERATION_COMPLETION` | 边界前已创建并冻结生成意图                  | 可完成原日期结果                       | 边界后 15 分钟，左闭右开          |

`COMMAND_COMMIT` 证明命令已经属于原日期；`VIEW_CONTINUATION` 只是允许用户在旧页面再发一个受限命令；`GENERATION_COMPLETION` 只允许内部生成意图完成。三者不能互相授予。

### 5.2 写入窗口判定

对目标日期 T、当前权威日期 C、操作 O 和可选 continuation grant G：

1. Safety ACTIVE、账户阻断、DELETING、目标 DAY 已删除或源结果失效时，先拒绝；
2. 如果 T = C 且操作满足普通业务守卫，返回 OPEN；
3. 否则，仅当 T 是刚结束的前一产品日期、G 有效、当前绝对时间在 `[boundary, boundary + 30m)`、页面和操作均匹配时，返回 CONTINUATION_ONLY；
4. 其他情况返回 CLOSED。

同一绝对时刻可以对新日期返回 OPEN、对带有效 grant 的旧日期返回 CONTINUATION_ONLY。这不是两个“当前日期”：当前 product_date 仍只有一个，窗口结果取决于明确 target_product_date。

### 5.3 VIEW_CONTINUATION grant

grant 必须由服务端创建或以不可伪造方式验证，至少绑定：

- 逻辑用户与会话；
- 页面类型 `DLY-003` 或 `EVE-001`；
- 原 product_date；
- product_date policy version；
- 页面在 OPEN 时合法打开的事实；
- 对应 result / feedback 读取版本；
- boundary_at 与 expires_at；
- 一次会话范围的唯一引用；
- 主动失效状态。

精确令牌、签名或服务端记录格式由 S-20 决定。登出、切换用户、用户点击“去今天”、Safety 覆盖、Deleting、DAY 删除和权限撤销会提前失效。通知深链、历史页、缓存页和边界后新打开的旧页不能获得 grant。

### 5.4 续写操作 allowlist

| 操作                       | OPEN       | CONTINUATION_ONLY                             | CLOSED        |
| -------------------------- | ---------- | --------------------------------------------- | ------------- |
| 新增或更正签到             | 允许       | 禁止                                          | 禁止          |
| 创建新生成意图             | 允许       | 禁止                                          | 禁止          |
| 已接受生成意图完成         | 允许       | 使用 GENERATION_COMPLETION，不使用 view grant | 禁止          |
| 点亮                       | 允许       | 仅边界前已打开 DLY-003                        | 禁止          |
| 任务状态                   | 允许       | 仅同一 DLY-003 和既有 task_id                 | 禁止          |
| 帮助度                     | 允许       | 仅同一 DLY-003 和既有 result_id               | 禁止          |
| 晚间反馈保存/修改          | 允许       | 仅边界前已打开 EVE-001                        | 禁止/历史只读 |
| 新建重要事项或关系节点操作 | 按各自规则 | 禁止                                          | 禁止          |

VIEW_CONTINUATION 到 `boundary + 30m` 精确关闭；GENERATION_COMPLETION 到 `boundary + 15m` 精确关闭。等于 expires_at 时已经过期。

### 5.5 跨界页面行为

- 页面不在 04:00 突然替换正文；继续显示明确原日期；
- 边界发生后提示“日期已变化”，并提供“去今天”；
- 有效续写时只开放 allowlist 操作；
- 用户选择“去今天”立即使旧页 grant 失效；
- 续写关闭后旧页转只读，不把未提交选择复制到新日；
- Offline 不延长期限，也不排队等待恢复后补交；
- 返回响应必须包含权威 target_product_date 和最新窗口，客户端不能猜测成功归属。

## 6. 稳定主体与根种子

### 6.1 稳定主体

`stable_subject_id` 是账户域内部不可变、高熵、ASCII 标识：

- 在同一逻辑账户生命周期内稳定；
- 不直接使用微信 openid、unionid、手机号、设备 ID、广告 ID 或渠道 ID；
- 账户合并时只能由账户域给出唯一 canonical subject，生成服务不能自行选择；
- 账户彻底删除后不得为了保持种子而单独保留可反查身份；
- 不向客户端、AI、分析平台、普通日志或分享内容暴露。

测试使用 `user_example`，不代表生产 ID 格式。生产格式由 S-17 固化，但必须是规范 ASCII，不能有大小写、Unicode 归一化或空白歧义。

### 6.2 `seed-v1` 输入

字段顺序固定为：

1. `dailyenergy`；
2. `daily-result`；
3. `seed-v1`；
4. stable_subject_id；
5. product_date；
6. result_version。

所有字段必须先通过各自 ASCII allowlist。根种子明确不包含：

- 签到值、profile revision 或 input snapshot fingerprint；
- 设备、时区、locale、渠道和实验曝光；
- 当前时间、请求 ID、重试次数和服务器实例；
- Prompt、模型、供应商、模板路径和降级次数；
- 晚间反馈、任务、帮助度和关系计数；
- secret、访问令牌和用户原始身份。

真实输入仍由冻结的 GenerationInputSnapshot 决定规则事实。根种子只稳定确定同一日的离散选择；签到更正不重写已发布结果。会改变规则或候选集合的实验必须使用新的 result_version 清单，而不是偷偷加入临时 seed 字段。

### 6.3 规范字节编码

定义 `LP32(bytes) = U32_BE(byte_length) || bytes`。

- 字符串使用 RFC 3629 UTF-8，无 BOM；
- v1 输入限定 ASCII，所以禁止实现自行做 Unicode NFC/NFD、大小写转换或 trim；
- 长度是字节数，不是字符数；
- `U32_BE` 是四字节大端无符号整数；
- 根 material 是六个字段的 LP32 按固定顺序直接连接；
- 禁止用 JSON、分隔符字符串、平台默认编码或对象键顺序替代。

伪代码：

```text
material = concat(
  LP32(UTF8("dailyenergy")),
  LP32(UTF8("daily-result")),
  LP32(UTF8("seed-v1")),
  LP32(UTF8(stable_subject_id)),
  LP32(UTF8(product_date)),
  LP32(UTF8(result_version))
)

root_seed = SHA256(material)  // 32 raw bytes
```

SHA-256 采用 NIST Secure Hash Standard 定义。这里的摘要用于确定性和域隔离，不是密码、MAC、签名或授权令牌。任何权限判断都禁止依赖 seed 不可猜测性。

### 6.4 根种子向量

| stable_subject_id | product_date | result_version | SHA-256（lowercase hex）                                           |
| ----------------- | ------------ | -------------- | ------------------------------------------------------------------ |
| `user_example`    | `2026-07-20` | `daily-v1`     | `a7ae24e6611d1081a173f6aa75b81aaa26554555b64049c5751fc3996fc5f782` |
| `user_example`    | `2026-07-21` | `daily-v1`     | `2ad68bdbee828883dcf43aa1b7ed38d1aacf959a98c7627a3365bfd5399355ed` |
| `user_example`    | `2026-07-20` | `daily-v2`     | `b836858920f8ba6678304d7518d12bced7f5d1abfec77f15adfdaae33457d713` |
| `user_other`      | `2026-07-20` | `daily-v1`     | `7b2f5b9521aaaaabdcf0fd3ebc4d898bfc0ad20967d8ec2ca368016f69e902fa` |

第一条完整 material hex 在 JSON fixture 中保存，供非 TypeScript 实现逐字节对照。任一字段变化必须得到不同摘要；这不是“雪崩效果”产品承诺，而是固定测试事实。

## 7. 具名派生与无偏选择

### 7.1 不使用共享 PRNG 流

如果按顺序从一个 PRNG 取“重点维度、行动、颜色、数字、模板”，在中间新增一个选择会让后续所有结果变化。v1 改用具名 namespace：每个决定独立从 root_seed 派生。

初始保留 namespace：

- `focus.tie.v1`；
- `action.tie.v1`；
- `ritual.color.v1`；
- `ritual.number.v1`；
- `template.variant.v1`。

S-11 可以增加 namespace，但必须：ASCII、小写、含语义和版本、全局登记。修改某个决定的候选语义或 canonical order 时，升级该 namespace 或 result_version；禁止复用旧 namespace 表达新语义。

### 7.2 派生摘要

对 namespace N 和 counter C：

```text
choice_material = concat(
  LP32(UTF8("dailyenergy-choice")),
  LP32(UTF8("choice-v1")),
  LP32(root_seed),
  LP32(UTF8(namespace)),
  U32_BE(counter)
)

choice_digest = SHA256(choice_material)
X = U64_BE(choice_digest[0..7])
```

`LP32(root_seed)` 的长度恒为 32。counter 从 0 开始，只在 rejection sampling 拒绝当前 X 时递增。不得把重试次数、模型尝试或业务循环次数传入 counter。

### 7.3 候选 canonical order

在选择前，规则引擎必须给出稳定候选数组：

- 数组只包含已通过规则和安全守卫的候选；
- 使用稳定 token 的字节序或 S-11 明确的固定顺序；
- 禁止依赖数据库无 ORDER BY 返回、对象键顺序、本地化中文、Map 插入偶然顺序或分数浮点误差；
- 候选数组语义变化必须由规则/目录/result version 覆盖；
- n = 1 时直接选择 index 0，仍可以记录 namespace，但无需哈希重试。

### 7.4 rejection sampling

对候选数 `n`，要求 `1 <= n <= 2^32`：

```text
SPACE = 2^64
LIMIT = SPACE - (SPACE mod n)

for counter from 0:
  X = first_u64_be(derive(root_seed, namespace, counter))
  if X < LIMIT:
    return X mod n
```

禁止直接 `X % n` 后忽略尾部不均匀区间。counter 是四字节无符号数；理论上耗尽时必须失败，不回退到有偏选择。

### 7.5 选择向量

使用根种子 `a7ae...f782`：

| namespace           |   n | counter |                    X |                LIMIT | index |
| ------------------- | --: | ------: | -------------------: | -------------------: | ----: |
| `binary.example.v1` |   2 |       0 |  4490640655815320221 | 18446744073709551616 |     1 |
| `action.tie.v1`     |   3 |       0 | 17596297401232238969 | 18446744073709551615 |     2 |
| `ritual.color.v1`   |   5 |       0 |  3045197983584053772 | 18446744073709551615 |     2 |
| `ritual.number.v1`  |   9 |       0 |  2505080880651100949 | 18446744073709551609 |     8 |

完整 choice digest、LIMIT 边界和 first rejected 值在 JSON fixture 中。所有实现必须按无符号大端 64 位运算；JavaScript 实现禁止用会丢失整数精度的 Number，必须使用 BigInt 或等价无损类型。

## 8. result_version 与生成清单

### 8.1 result_version 是不可变清单 ID

`result_version`（例如 `daily-v1`）不是客户端计算的 semver 拼接，也不是部署时间。它指向服务端不可变 GenerationManifest，至少冻结：

- product_date_policy_version；
- seed_policy_version 与 choice_policy_version；
- shared schema major / contract version；
- input snapshot version；
- rule_version；
- algorithm_version；
- action / ritual / content catalog versions；
- expression contract / template compatibility version；
- Safety contract floor；
- 影响规则事实或候选集合的实验 variant version。

Prompt、provider、model 和实际 generation_mode 继续写入 PublishedDailyResult provenance，但不要求 AI 文本可字节重放。稳定承诺是：规则事实、身份、允许输入和已发布快照不变；AI/模板首次完整通过后原子发布，后续重试不能替换。

Manifest 不允许原地编辑。任何参与字段变化必须创建新 result_version。客户端只接收稳定 token 和已发布结果，不接收整个内部清单。

### 8.2 版本选择时刻

- 服务端接受该用户该产品日期的第一个生成意图时，从当前发布通道选择一个 manifest；
- 选择结果与 generation_intent 一起冻结；
- 同日部署新 manifest 后，已有 intent 继续旧 version；
- 尚无 intent 的其他用户可以获得新 version；
- 同一用户同一 product_date 不能因为新 version 再创建第二个 intent 或第二份 AVAILABLE 结果；
- 历史读取始终使用记录内版本，不根据“当前最新版本”重算。

### 8.3 概念唯一性

数据库语法由 S-19 决定，但领域层必须等价保证：

1. 每用户每 product_date 最多一个有效 GenerationIntent；
2. 每用户每 product_date 最多一个 AVAILABLE PublishedDailyResult；
3. intent 冻结 generation_intent_id、product_date、policy_version、result_version、input_snapshot_ref/fingerprint 和 root_seed；
4. 任何 idempotency key 重试先读取 intent；
5. 两个并发创建者只有一个成功，失败者读取胜者；
6. 多个生成尝试只有一个能把 intent 原子转换为 AVAILABLE；
7. 失败或超时尝试不能留下局部 PublishedDailyResult；
8. result_id 是服务端不透明稳定引用，不从公开 seed 直接生成。

### 8.4 签到更正、失败与降级

- 首次 intent 使用接受时冻结的 GenerationInputSnapshot；
- 签到后来更正只更新真实签到修订，不重写当日 PublishedDailyResult；
- 重试使用同一 snapshot、manifest 和 root_seed；
- PRIMARY_AI、BACKUP_AI 和 CONTROLLED_TEMPLATE 读取同一 RuleFacts；
- 第一份完整通过 Schema 与 Safety 的候选原子发布；输掉竞态的候选丢弃；
- 已经展示的结果不因主模型恢复而替换；
- 跨界后超出 GENERATION_COMPLETION 的 intent 进入可解释的 CANCELLED/FAILED 状态，不迁移到新日，也不换 seed；精确错误枚举由 S-20 决定。

## 9. 删除与重建

### 9.1 DAY 删除

DAY 删除开始后：

- Safety / Deleting 优先使读写和 continuation 失效；
- 当日 input snapshot、结果、交互事实、反馈、缓存、派生总结引用和生成候选按 S-18 范围删除或失效；
- 未完成 intent 不再发布；
- seed、缓存、重试、队列和旧页面不得触发自动重建；
- 同日关系计数最多恢复为一个相遇日，绝不能因重建增加第二天。

### 9.2 P0 暂不开放同日重新开始

稳定重建需要知道原 result_version，并可能需要最小 generation guard；彻底 DAY 删除又可能要求不保留能证明当日使用的记录。该冲突必须由 S-18 / ADR-0005 明确保存范围、目的、期限和用户说明。

因此在 ADR-0005 Accepted 前：

- DAY 删除成功后，同一 product_date 不自动也不显式重新生成；
- 当前日重新进入按无事实状态展示，但提交入口保持受限说明；
- 不通过当前新 manifest 猜测重建；
- 不保留隐藏 seed material 作为绕过删除的后门。

如果未来允许显式重新开始，必须复用 canonical subject、原 product_date 和删除前冻结的 result_version，且有合法最小 guard；无法证明时继续禁用。

## 10. 日期与种子测试向量

### 10.1 日期边界

`Asia/Shanghai` 04:00 对应测试时段的 UTC 前一日 20:00：

| now UTC                | 本地时间                    | 期望 product_date |
| ---------------------- | --------------------------- | ----------------- |
| `2026-07-19T19:59:59Z` | `2026-07-20T03:59:59+08:00` | `2026-07-19`      |
| `2026-07-19T20:00:00Z` | `2026-07-20T04:00:00+08:00` | `2026-07-20`      |
| `2026-07-19T20:00:01Z` | `2026-07-20T04:00:01+08:00` | `2026-07-20`      |
| `2026-12-31T19:59:59Z` | `2027-01-01T03:59:59+08:00` | `2026-12-31`      |
| `2026-12-31T20:00:00Z` | `2027-01-01T04:00:00+08:00` | `2027-01-01`      |
| `2028-02-29T19:59:59Z` | `2028-03-01T03:59:59+08:00` | `2028-02-29`      |
| `2028-02-29T20:00:00Z` | `2028-03-01T04:00:00+08:00` | `2028-03-01`      |

### 10.2 窗口与跨界

- 锚点 `2026-07-20` 的七天窗口是 `2026-07-14` 至 `2026-07-20`；
- 闰年锚点 `2028-03-01` 的窗口是 `2028-02-24` 至 `2028-03-01`；
- 结束产品日 `2026-07-20` 的边界为 `2026-07-20T20:00:00Z`；
- 有效 view grant 在 `2026-07-20T20:29:59Z` 仍可续写，在 `20:30:00Z` 已 CLOSED；
- 原 intent 在 `20:14:59Z` 仍可完成，在 `20:15:00Z` 已过生成完成期；
- `19:59:59Z` 已接受的命令即使 `20:00:10Z` 返回，仍写 `2026-07-20`；
- `20:00:00Z` 后才点击且未被接受的旧日命令，不获得 COMMAND_COMMIT；
- 合法 grant 也不能在 continuation 中新增或更正签到。

### 10.3 可执行 fixture

`adr-0002-test-vectors.json` 是规范测试向量，包含：

- 日期、跨年、闰日、周窗口和 continuation；
- 四个根 seed 摘要；
- 四个具名 choice digest、X、LIMIT 和 index；
- n = 2 / 3 / 5 / 9 的接受与拒绝边界。

fixture 不是生产 Schema，不含真实用户数据。S-11 和不同语言实现必须用独立代码复算，而不是把 expected digest 硬编码为实现结果。

## 11. 隐私、安全与可观测性

### 11.1 数据最小化

- root material、root_seed 和 choice digest 不进入客户端、AI、通用分析、通知或分享；
- 普通日志不记录 stable_subject_id、root material 或完整 seed digest；
- 可记录 policy_version、result_version、target/current product_date、window state、reason code、intent/result 不透明引用和时延；
- 调试需要种子信息时使用受限、短期、脱敏工具，不复制真实用户标识；
- continuation grant 不进入埋点属性和 URL；
- 渠道、年龄、性别、设备和广告标签不参与 seed。

### 11.2 安全边界

- SHA-256 seed 不是凭证，不签署请求，不加密内容，不证明用户身份；
- continuation 必须由服务端状态或不可伪造令牌证明，不能从 seed 派生；
- 客户端修改 product_date、policy_version、accepted_at 或 expires_at 无效；
- Safety ACTIVE、Deleting、账户失效和 DAY 删除覆盖 OPEN 与 continuation；
- 日期解析失败时 fail closed，不用设备时间“临时兜底”；
- 任何哈希、时区和版本输入验证失败都不得降级成随机数或当前日期。

### 11.3 监控

后续可观测性至少区分：

- product date resolve 成功/失败和 policy version；
- 客户端日期与权威日期不一致计数，但不信任客户端；
- OPEN / CONTINUATION_ONLY / CLOSED 判定与受控 reason code；
- generation intent 去重、并发胜者、超时和跨界取消；
- manifest / seed policy 不兼容；
- 历史对象被错误重算的零容忍告警；
- 删除后队列、缓存或页面尝试复活的阻断事件。

指标不携带 note、Prompt、模型原文、stable subject 或 seed。

## 12. 备选方案

### 12.1 自然零点换日，再给旧页面“日期宽限”

优势是符合日历直觉。问题是午夜是晚间反馈和休息前使用的合理时段；如果 resolver 也延迟换日，就会出现同一时刻因入口不同得到两个当前日期。若 resolver 零点换日而页面另有资格，本质仍需要本 ADR 的双层模型。

**结论**：不选择零点作为 P0 边界；选择单一 04:00 resolver + 独立 continuation。

### 12.2 使用设备时区或让用户旅行时自动切换

优势是表面贴合当地时间。问题是设备时区可错、可改、可被伪造，旅行会缩短或重复产品日，并使同一命令在多端归属不同。

**结论**：P0 固定账户产品策略 `Asia/Shanghai`。多时区是新 ADR，不偷偷自动切换。

### 12.3 创建结果时保存一个数据库随机 seed

优势是实现简单。问题是并发创建、删除重建、环境迁移和测试复算需要额外保存与协调；随机 seed 丢失后无法恢复稳定选择。

**结论**：不选择。根 seed 从稳定主体、日期和 manifest 确定性派生；仍禁止公开。

### 12.4 一个 PRNG 流按固定顺序消费

优势是常见且快速。问题是任何中间新增、条件分支或候选数量变化都会移动后续结果，难以局部版本化。

**结论**：不选择。使用具名派生和独立 rejection sampling。

### 12.5 把签到、profile、实验和模型版本全部加入 seed

优势是所有输入变化都会得到新摘要。问题是签到更正、模型切换和实验会让同日选择漂移，并混淆真实输入与娱乐选择；还增加隐私和日志风险。

**结论**：不选择。真实输入进入冻结 snapshot，生成语义变化进入 result_version。

### 12.6 用 HMAC 和轮换 secret 作为根种子

优势是外部更难推测。问题是 secret 轮换、灾备和多环境会改变结果，且 seed 不承担安全授权。高熵内部主体已经降低公开枚举价值。

**结论**：v1 使用标准 SHA-256。若未来出现明确威胁，需要新 seed policy 和迁移 ADR；不能静默换算法。

## 13. 正面影响

- 午夜后体验不会被强行拆成新日；
- 页面、命令和生成三种跨界语义可以独立测试；
- 多端、重试和并发不会因时间重新归日；
- 规则引擎可以跨语言复算稳定选择；
- 新增具名选择不会扰动旧随机流；
- manifest 升级只影响新 intent，不修改历史；
- AI 供应商切换不改变规则事实；
- 七天窗口、删除和缓存拥有明确失效键；
- 日志不需要暴露原始身份或 seed。

## 14. 负面影响与成本

- 04:00 前不能开始“新的一天”，需要清楚日期文案；
- 服务端必须维护权威日期 resolver 和健康状态；
- continuation grant 增加会话、失效和测试复杂度；
- 跨语言实现必须正确处理大端字节、BigInt 和 rejection sampling；
- result manifest 需要不可变配置和发布纪律；
- AI 表达不是字节级可重放，只能依靠原子发布与 provenance；
- 同日 DAY 删除后暂时不能重新开始；
- 多时区扩展必须另做决策。

这些成本被接受，因为它们直接保护同日稳定、历史不改写、删除不复活和用户信任。

## 15. 下游约束

### 15.1 S-11 规则引擎

- 实现 seed-v1、choice-v1 和 fixture；
- 登记每个具名 namespace 与候选 canonical order；
- 分数计算不得使用随机浮点；
- tie-break、action、ritual 和模板选择分别派生；
- 输出 provenance 的 rule / algorithm / catalog versions；
- 不重新决定日期、唯一性或历史策略。

### 15.2 S-12 AI Gateway

- 接收冻结 RuleFacts、snapshot 与 result manifest；
- 重试和模型切换不改变 root seed、事实或 action；
- 只有一份完整通过 Schema 与 Safety 的表达可以发布；
- 模型恢复不替换已展示结果；
- 跨界完成服从 GENERATION_COMPLETION。

### 15.3 S-17～S-20 数据与接口

- 领域对象保存 target product_date、policy version、accepted_at 和 intent；
- 建立等价的用户 + product_date 唯一性；
- continuation grant 服务端权威、可失效、不可由客户端扩期；
- 幂等冲突先读权威 intent；
- 历史读使用已存日期和版本，不重跑 resolver；
- DAY 删除阻断队列、缓存、重试和旧 grant；
- 错误码区分日期变化、窗口关闭、grant 失效、intent 已存在和结果已发布。

### 15.4 S-24 与 S-32

- 埋点只记录受控版本、窗口和 reason code，不记录 seed / grant /原始用户标识；
- 部署维护可信服务器时钟和 tzdb 更新流程；
- 监控边界附近漂移、resolver fail closed 和版本不兼容；
- tzdb 语义变化先发布策略版本，不直接重算历史。

### 15.5 前端

- 显示服务端 product_date，不自行 `new Date()` 决定写入目标；
- 页面跨界不替换正在读的旧内容；
- 只根据服务端 window / grant 状态开放操作；
- 续写关闭后转只读并丢弃不合法草稿；
- “去今天”显式请求新日期并关闭旧 grant；
- Offline 不倒计时延长、不后台补交。

## 16. 验收场景

### 16.1 边界前后

03:59:59 本地解析为前一日；04:00:00 精确解析为本地日期。客户端慢一秒或快十分钟不改变服务端结果。

### 16.2 命令响应跨界

命令在 03:59:59 被服务端持久接受，04:00:10 返回：仍写原 product_date。仅在设备点击但服务端未接受的请求不算提交。

### 16.3 旧页面有限续写

DLY-003 在边界前合法打开，04:29:59 可以点亮原日；04:30:00 同一操作 CLOSED。签到在整个 continuation 内都禁止。

### 16.4 生成跨界

原 intent 在 04:14:59 可以原子发布原日结果；04:15:00 尚未完成则取消。不得创建新日期 intent 或迁移候选文本。

### 16.5 设备时间错误

设备显示不同日期或用户手动改时区：服务端 product_date、accepted_at 和窗口不变。客户端只更新展示。

### 16.6 并发生成

两个服务实例同时创建同用户同日 intent：唯一性只接受一个；另一个读取相同 snapshot、manifest、seed 和 intent。多个表达候选只有一个完整结果发布。

### 16.7 同日版本发布

用户 A 已有 `daily-v1` intent，部署 `daily-v2` 后仍读取 v1；尚无 intent 的用户 B 可以使用 v2。A 不出现第二份结果。

### 16.8 签到更正

结果发布后更正签到：真实签到 revision 更新；PublishedDailyResult、root seed 和行动不变；七天真实趋势将来使用更正值。

### 16.9 DAY 删除

删除使结果、grant、缓存、队列和周总结引用失效；重进不自动生成。S-18 未接受前，不能同日显式重新开始。

### 16.10 日期服务失败

无法获得可信时间或 tzdb：可以显示标记日期未知的只读缓存；禁止新签到、生成、点亮、反馈和 continuation 授权。恢复后不补交失败期间草稿。

## 17. 复审触发条件

以下情况需要新 ADR 或明确取代本 ADR：

- 服务中国大陆以外核心人群或允许账户切换产品时区；
- 用户研究证明 04:00 边界系统性不符合使用习惯；
- IANA 规则变化影响未来边界；
- seed 输入、摘要算法、选择派生或整数映射改变；
- result_version manifest 职责改变；
- 需要公开可验证随机性或安全不可预测性；
- S-18 决定允许 DAY 删除后同日重新开始；
- 出现历史结果漂移、重复 AVAILABLE 或删除后复活事故；
- 规则引擎需要跨语言实现且 fixture 暴露歧义。

参数调整不能原地修改 v1。新的策略必须有新 version、fixture、迁移边界和历史不改写说明。

## 18. 参考标准

- [NIST FIPS 180-4 Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)：SHA-256 定义来源；
- [IANA Time Zone Database](https://data.iana.org/time-zones/tz-link.html)：IANA 时区标识和民用时间规则来源；
- [RFC 3629 / STD 63](https://www.rfc-editor.org/rfc/rfc3629)：UTF-8 字节编码来源。

外部标准只定义哈希、时区数据和 UTF-8。本 ADR 的 04:00 边界、长度前缀、字段顺序、namespace、rejection sampling、manifest 和窗口语义是 DailyEnergy 自身版本化协议。

## 19. 完成与审核清单

- [x] 单一 IANA 时区和 04:00 产品日边界明确；
- [x] 当前日期与旧页 continuation 分离；
- [x] COMMAND_COMMIT、VIEW_CONTINUATION、GENERATION_COMPLETION 期限明确；
- [x] OPEN / CONTINUATION_ONLY / CLOSED 和 allowlist 明确；
- [x] 服务端接受、幂等和 target date 冻结明确；
- [x] 七天民用日历窗口明确；
- [x] stable subject 与禁止身份字段明确；
- [x] seed-v1 字节编码、SHA-256 和根向量明确；
- [x] choice-v1、namespace、无偏选择和边界向量明确；
- [x] result manifest、并发、重试、降级和历史冻结明确；
- [x] DAY 删除和暂不重建明确；
- [x] 隐私、安全、日志和失败关闭明确；
- [x] S-11、S-12、S-17～S-20、S-24、S-32 与前端约束明确；
- [x] 可执行 JSON fixture 不含真实用户数据；
- [ ] 用户确认本 ADR；

用户确认前，本 ADR 保持 Draft，S-11 不得开始。

## 20. 决策摘要

> DailyEnergy P0 以 `Asia/Shanghai` 04:00 为唯一产品日边界。命令在服务端接受时冻结日期；旧页面只有 30 分钟有限续写，旧生成意图只有 15 分钟完成期，任何事实都不迁移到新日。
>
> 每日离散选择由内部稳定主体、产品日期和不可变 result manifest 通过 seed-v1 与具名 choice-v1 确定。并发只保留一个意图和一个可用结果；升级不改历史，删除不自动复活。

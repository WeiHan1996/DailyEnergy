# DailyEnergy 评分与规则选择规范

- **文档状态**：Accepted
- **接受日期**：2026-07-22
- **所属任务**：S-11 — 规则引擎规范
- **最后更新**：2026-07-22
- **适用范围**：每日五维评分、重点维度、行动、任务、仪式、展示顺序，以及七天真实记录的确定性聚合与事实选择
- **上游规范**：[今日内容 Schema](./daily-content-schema.md)、[七天趋势与总结 Schema](./weekly-summary-schema.md)、[共享 Schema](../../packages/shared-schemas/README.md)、[ADR-0002](../decisions/ADR-0002-deterministic-daily-result.md)
- **配套规范**：[生成引擎](./generation-engine.md)、[S-11 测试向量](./s11-test-vectors.json)
- **下游任务**：S-12、S-13、S-16～S-20、C-006、C-007、C-013

## 1. 文档目的

本文把已接受的输入、输出和确定性协议固化为可以跨语言复算的整数规则。对同一合法 `GenerationInputSnapshot`、同一根种子和同一不可变 manifest，所有合规实现必须产生逐字段相同的 `RuleFacts` 与受控表达计划；对同一 `WeeklySourceSnapshot` 和聚合版本，必须产生相同的 `WeeklyAggregateFacts` 与 `WeeklyExpressionPlan`。

这些分数是内部行动编排信号，不是预测、诊断、能力评价、财务判断或关系结论。客户端禁止接收原始分数，任何 LOW 都只表示今天应降低负担或增加确认。

## 2. 规范版本

本规范 的规则闭包使用以下稳定 token：

| 责任                | 版本                    |
| ------------------- | ----------------------- |
| 每日规则            | `daily-rules-v1`        |
| 每日整数算法        | `daily-score-v1`        |
| 行动目录            | `action-catalog-v1`     |
| 可选任务目录        | `task-catalog-v1`       |
| 仪式目录            | `ritual-catalog-v1`     |
| 受控语义 token 目录 | `content-catalog-v1`    |
| namespace registry  | `namespace-registry-v1` |
| 每日表达计划        | `daily-expression-v1`   |
| 每日模板兼容集      | `daily-template-v1`     |
| 七天聚合            | `weekly-aggregate-v1`   |
| 七天表达计划        | `weekly-expression-v1`  |

任何权重、阈值、舍入、ordinal、stable ID 含义、目录顺序、候选资格、事实优先级或模板资格变化，都必须创建新版本并由新的 `result_version` 或周总结版本闭包引用。禁止原地编辑 v1。

`content-catalog-v1` 冻结本文出现的 expression-style、label、basis、target、constraint、ritual value 与 template semantic token 的含义，不包含 Prompt 或完整本地化文案。

## 3. 每日输入信号

### 3.1 Ordinal 映射

签到枚举使用以下固定整数：

| 字段   | -2         | -1    | 0        | 1      | 2       | 不确定标记 |
| ------ | ---------- | ----- | -------- | ------ | ------- | ---------- |
| mood   | `VERY_LOW` | `LOW` | `STEADY` | `GOOD` | `LIGHT` | `UNSURE`   |
| energy | `EMPTY`    | `LOW` | `STEADY` | `HIGH` | `FULL`  | `UNSURE`   |
| sleep  | `POOR`     | `LOW` | `OKAY`   | `GOOD` | 不适用  | `UNSURE`   |

`UNSURE` 在算术中使用 0，同时保留独立 uncertainty bit。它不等于“状态稳定”，也不允许在表达中被解释为一般、正常或还不错。

### 3.2 输入资格

- `checkin.mood`、`checkin.energy`、`checkin.sleep` 都是必需字段；缺少任一字段即失败。
- `UNKNOWN` 不是合法 token；禁止把未知字符串、空值或缺失值映射为 `UNSURE`。
- 禁止 trim、大小写修复、近似枚举、自由文本分类或默认填补。
- `profile`、`relationship`、`permitted_context`、`product`、revision、ref 和 preferred name 对 v1 分数、重点、行动、任务及仪式的贡献恒为零。
- 表达偏好和允许上下文只能影响后续受控表达；不得进入 score、candidate eligibility 或任何 choice material。
- 当前签到以首次 generation intent 接受时冻结的 revision 为准；后续更正不重算已发布结果。

### 3.3 表达偏好

`content-catalog-v1` 冻结以下 allowlist 和语义；顺序只用于 registry 与测试，不参与随机选择：

| canonical token | 稳定含义                                               | 产品来源 |
| --------------- | ------------------------------------------------------ | -------- |
| `BALANCED`      | 人格基线参数；用户跳过选择时的系统默认，不宣称用户偏好 | 系统默认 |
| `GENTLE`        | 提高温暖度、减少幽默和生硬直接，但建议仍清楚           | 温柔     |
| `LIGHT_HUMOR`   | 在安全上限内允许生活化轻幽默，不拿低状态开玩笑         | 轻松幽默 |
| `CLEAR_DIRECT`  | 更短、更直接、减少安慰修饰，但不命令、归因或羞辱       | 清醒直接 |

规则层精确复制 token 到 `requested_expression_style`。它不改变 score、focus、care/support、action、task、ritual 或 template eligibility；`effective_expression_constraints` 是更高优先级的上限，care、uncertainty 与 Safety 可以压低风格，风格不能放宽上限。

共享 Schema 当前只把 `expression_style` 校验为通用 `VersionToken`，因此引擎必须补充 allowlist 校验。大小写变化、别名、自定义 token 或未来 token 都以 `SNAPSHOT_FIELD_INVALID` fail closed。未来扩展必须升级 `content-catalog` 与 result manifest，禁止把未知值静默映射为 `BALANCED`。

## 4. 五维定义与整数算法

### 4.1 稳定维度

canonical order 固定为：

```text
pace, action, connection, resources, recovery
```

| ID           | 安全语义                   | 禁止推断             |
| ------------ | -------------------------- | -------------------- |
| `pace`       | 今天适合采用的节奏余量     | 运气、命运、工作能力 |
| `action`     | 推进一个低后果步骤的余量   | 成败、绩效、必然结果 |
| `connection` | 低压力沟通和确认的余量     | 他人想法、关系走向   |
| `resources`  | 整理时间、物品和安排的余量 | 财富、收入、投资回报 |
| `recovery`   | 留白、暂停和恢复的余量     | 身体状况、疾病或疗效 |

五个维度都使用同一单调语义：分数越高，只表示该类轻量行动的余量越大；分数越低，只表示应降低负担。

### 4.2 权重表

权重按 `[mood, energy, sleep]` 排列：

| 维度         | mood | energy | sleep |
| ------------ | ---: | -----: | ----: |
| `pace`       |    7 |     10 |     6 |
| `action`     |    6 |     13 |     7 |
| `connection` |    9 |      4 |     3 |
| `resources`  |    4 |      8 |     5 |
| `recovery`   |    3 |      5 |     8 |

### 4.3 计算

对维度 `d`：

```text
raw_d = 50
      + weight[d].mood   * mood_ordinal
      + weight[d].energy * energy_ordinal
      + weight[d].sleep  * sleep_ordinal

score_d = min(100, max(0, raw_d))
```

所有操作都是有符号整数。v1 没有浮点数、随机 offset、日期加成、用户画像加成或隐藏实验系数，因此 clamp 前后都不需要舍入。

当前合法 `daily-v1` 签到组合的单维最高 raw score 为 95，因此上界 100 是算法契约边界而非当前输入可达值；配套向量用 synthetic raw=101 验证上界 clamp，不能据此伪造一个合法签到案例。

每个真实输入从较低 ordinal 上升一个等级时，五个分数都不得下降。测试必须枚举所有相邻等级验证这一单调性。

## 5. 档位与整体结果

### 5.1 档位

| score   | band     | `label_token`    |
| ------- | -------- | ---------------- |
| 0～39   | `LOW`    | `TAKE_IT_GENTLY` |
| 40～69  | `STEADY` | `KEEP_IT_STEADY` |
| 70～100 | `HIGH`   | `ROOM_TO_MOVE`   |

`RuleFacts` 的每个 dimension 与 overall 都必须满足 score、band、label 三者一致。共享 Schema 只校验 label 与 band；规则引擎还必须校验 score 与 band。

### 5.2 整体分数

```text
sum = pace + action + connection + resources + recovery
overall_score = floor((sum + 2) / 5)
```

加 2 后整除 5 是 v1 的最近整数规则。整体档位使用相同阈值。整体只用于选择中性表达强度，不覆盖任何单维 care 决定。

## 6. 不确定输入模式

### 6.1 全部 `UNSURE`

当三个字段均为 `UNSURE`：

1. 五维仍按 ordinal 0 计算，结果均为 50；
2. `focus_dimension_id` 固定为 `pace`，不把 seeded tie 解释为用户状态；
3. 省略 supporting 与 care；
4. 行动候选固定为 `prioritize-one`、`pause-and-recover`、`reflect-briefly`；
5. 所有候选必须为 `VERY_LIGHT`；
6. explanation basis 只记录三个明确的 `UNSURE` 信号，不生成 dimension assertion；
7. 表达只能承认信息不确定并给出低断言选择，禁止声称状态稳定。

仪式资格不因 `UNSURE` 减少，见第 12 节。

### 6.2 部分 `UNSURE`

部分 `UNSURE` 在算术中取 0，但 explanation basis 必须保留对应 uncertainty code。表达只能引用已知字段作状态陈述；不得从未知字段补充原因或结论。

## 7. Focus、care 与 supporting

### 7.1 严重真实状态的 care points

以下 token 先进入 care 模式：`mood=VERY_LOW`、`energy=EMPTY`、`sleep=POOR`。每个命中的 token 累加：

| 严重信号        | pace | action | connection | resources | recovery |
| --------------- | ---: | -----: | ---------: | --------: | -------: |
| mood `VERY_LOW` |    1 |      0 |          3 |         0 |        2 |
| energy `EMPTY`  |    2 |      1 |          0 |         1 |        3 |
| sleep `POOR`    |    2 |      1 |          0 |         1 |        3 |

取得分最高的维度集合；集合多于一个时按 canonical dimension order 组成候选，并使用 `focus.tie.v1`。这一步优先于普通 LOW 与最高分规则。

### 7.2 普通 focus

按以下首个匹配规则选择：

1. 全部 `UNSURE`：固定 `pace`；
2. 命中严重真实状态：使用 care points；
3. 否则存在 LOW 维度：取 score 最低的 LOW 维度；
4. 否则：取 score 最高的维度；
5. 第 3、4 步若完全同分，使用 `focus.tie.v1`。

只比较整数完全相等，不使用 epsilon。

### 7.3 Care

除全部 `UNSURE` 外，满足以下任一条件时：

```text
care_dimension_id = focus_dimension_id
```

- 命中严重真实状态；
- focus 的 band 为 LOW。

其余情况省略。care 是表达约束，不是医疗或危机分类；S-15 Safety 仍可在更高优先级阻断普通结果。

### 7.4 Supporting

除全部 `UNSURE` 外，从 focus 之外所有 HIGH 维度中取 score 最高者。完全同分时按 canonical order 组成候选并使用 `support.tie.v1`；没有 HIGH 候选则省略。

## 8. Explanation basis

`explanation_basis` 使用以下固定顺序，最多 5 项：

1. `checkin.mood.<token>.v1`，type=`CHECKIN_SIGNAL`；
2. `checkin.energy.<token>.v1`，type=`CHECKIN_SIGNAL`；
3. `checkin.sleep.<token>.v1`，type=`CHECKIN_SIGNAL`；
4. 非全部 `UNSURE` 时，`dimension.<focus>.<band>.v1`，type=`DIMENSION_SIGNAL`；
5. supporting 存在时，`dimension.<support>.<band>.v1`，type=`DIMENSION_SIGNAL`。

token 在 code 中转成小写并把下划线转成连字符，例如 `VERY_LOW` 对应 `very-low`。所有行动候选的 `basis_refs` 是这份有序 code 列表的子集，v1 使用完整列表。

虽然共享 Schema 预留 `PROFILE_SIGNAL`、`RELATIONSHIP_SIGNAL` 与 `CONTEXT_SIGNAL`，`daily-rules-v1` 禁止生成这三类 basis。未来启用必须升级输入、规则和 result manifest。

## 9. 行动目录

### 9.1 Canonical order

| rank | action_id                        | kind                   | target_scope         | effort       | 分钟 | constraint_token        |
| ---: | -------------------------------- | ---------------------- | -------------------- | ------------ | ---: | ----------------------- |
|    1 | `action.prioritize-one.v1`       | `PRIORITIZE_ONE`       | `ONE_PRIORITY`       | `VERY_LIGHT` |   10 | `ONE_PRIORITY`          |
|    2 | `action.prepare-one-step.v1`     | `PREPARE_ONE_STEP`     | `ONE_NEXT_STEP`      | `LIGHT`      |   15 | `STOP_AFTER_FIRST_STEP` |
|    3 | `action.communicate-clearly.v1`  | `COMMUNICATE_CLEARLY`  | `ONE_CONVERSATION`   | `LIGHT`      |   10 | `ONE_CLEAR_POINT`       |
|    4 | `action.reduce-switching.v1`     | `REDUCE_SWITCHING`     | `ONE_FOCUS_BLOCK`    | `VERY_LIGHT` |   10 | `NO_MULTITASKING`       |
|    5 | `action.organize-small-scope.v1` | `ORGANIZE_SMALL_SCOPE` | `ONE_SMALL_SCOPE`    | `VERY_LIGHT` |   10 | `STOP_AT_TIMEBOX`       |
|    6 | `action.pause-and-recover.v1`    | `PAUSE_AND_RECOVER`    | `ONE_SHORT_PAUSE`    | `VERY_LIGHT` |   10 | `NO_PERFORMANCE_GOAL`   |
|    7 | `action.reflect-briefly.v1`      | `REFLECT_BRIEFLY`      | `ONE_SENTENCE`       | `VERY_LIGHT` |    5 | `ONE_SENTENCE_ONLY`     |
|    8 | `action.seek-real-support.v1`    | `SEEK_REAL_SUPPORT`    | `ONE_TRUSTED_PERSON` | `VERY_LIGHT` |   10 | `ASK_ONE_SMALL_THING`   |

rank 是唯一的稳定全序。实现必须按 rank 排序，不依赖目录存储顺序或本地化标题。

### 9.2 Focus/band 候选表

表内顺序只便于阅读；最终必须按全局 rank 排序。

| focus      | LOW                          | STEADY                        | HIGH                          |
| ---------- | ---------------------------- | ----------------------------- | ----------------------------- |
| pace       | prioritize, reduce, pause    | prioritize, prepare, reduce   | prepare, prioritize, organize |
| action     | prioritize, reduce, pause    | prepare, prioritize, organize | prepare, prioritize, organize |
| connection | reflect, seek-support        | communicate, reflect, prepare | communicate, prepare, reflect |
| resources  | prioritize, reduce, organize | organize, prioritize, prepare | organize, prioritize, prepare |
| recovery   | pause                        | pause, reflect, reduce        | pause, reflect, reduce        |

表中的短名必须解析到第 9.1 节唯一 stable ID。

### 9.3 过滤与选择

候选构造顺序固定：

1. 全部 `UNSURE` 时使用第 6.1 节固定候选，否则读取 focus/band 表；
2. `seek-real-support` 只有 mood=`VERY_LOW` 或 energy=`EMPTY` 时合格；
3. 命中任一严重真实状态时过滤掉所有非 `VERY_LIGHT` 候选；
4. 校验 stable ID 唯一并按全局 rank 排序；
5. 数量必须为 1～3；
6. n=1 直接选择 index 0；n>1 使用 `action.tie.v1`。

过滤后为空是 `MANDATORY_CANDIDATE_EMPTY` terminal contract failure。禁止让 AI 发明行动、跳过主要行动或改用未登记默认值。

所有目录行动都必须保持低后果：禁止消费、借贷、交易、医疗处理、高强度运动、冲突升级、辞职或关系结论。`resources` 只允许整理和复核，`connection` 只允许低压力确认或联系可信对象。

## 10. 可选任务目录

当前严格 `RuleFactsSchema` 要求每份结果都有 `optional_task_plan`。它是主行动的可选微步骤，不是第二个主要行动；不完成不影响点亮，不产生次日惩罚。

| selected action | task_id                             | kind                   | effort       | 分钟 |
| --------------- | ----------------------------------- | ---------------------- | ------------ | ---: |
| prioritize      | `task.write-one-priority.v1`        | `PRIORITIZE_ONE`       | `VERY_LIGHT` |    5 |
| prepare         | `task.name-first-step.v1`           | `PREPARE_ONE_STEP`     | `VERY_LIGHT` |    5 |
| communicate     | `task.write-one-clear-point.v1`     | `COMMUNICATE_CLEARLY`  | `VERY_LIGHT` |    5 |
| reduce          | `task.close-one-distraction.v1`     | `REDUCE_SWITCHING`     | `VERY_LIGHT` |    5 |
| organize        | `task.put-away-one-item.v1`         | `ORGANIZE_SMALL_SCOPE` | `VERY_LIGHT` |    5 |
| pause           | `task.take-one-short-pause.v1`      | `PAUSE_AND_RECOVER`    | `VERY_LIGHT` |    5 |
| reflect         | `task.note-one-word.v1`             | `REFLECT_BRIEFLY`      | `VERY_LIGHT` |    5 |
| seek-support    | `task.choose-one-trusted-person.v1` | `SEEK_REAL_SUPPORT`    | `VERY_LIGHT` |    5 |

任务是一对一映射，不运行独立 choice。task kind 必须等于 selected action kind，努力不得高于主行动，task ID 必须不同于 action ID。

## 11. Display order

先把 focus 放在首位，再读取 selected action 的 affinity order，移除其中的 focus 后依次追加。结果必须恰好覆盖五维一次。

| action       | affinity order                                |
| ------------ | --------------------------------------------- |
| prioritize   | resources, action, pace, recovery, connection |
| prepare      | action, resources, pace, recovery, connection |
| communicate  | connection, pace, resources, action, recovery |
| reduce       | pace, resources, action, recovery, connection |
| organize     | resources, pace, action, recovery, connection |
| pause        | recovery, pace, action, resources, connection |
| reflect      | recovery, connection, pace, action, resources |
| seek-support | connection, recovery, action, pace, resources |

展示顺序不使用额外随机选择。

## 12. 仪式元素

仪式只作娱乐展示，不表达因果、吉凶或奖励。资格完全独立于签到值、分数、档位、focus、care、supporting 和 `UNSURE`。

### 12.1 元素集合

用新登记的 `ritual.set.v1` 在以下 canonical order 中选择：

```text
NONE, COLOR_ONLY, NUMBER_ONLY, COLOR_AND_NUMBER
```

对应输出 0、1、1、2 个 `ritual_facts`。普通结果的每种输入都具有相同集合资格；Safety 固定分支不是普通结果，不运行本规则。

### 12.2 Color

需要颜色时，用 `ritual.color.v1` 在以下顺序选择：

| ritual_id                    | value        |
| ---------------------------- | ------------ |
| `ritual.color.mist-blue.v1`  | `MIST_BLUE`  |
| `ritual.color.warm-beige.v1` | `WARM_BEIGE` |
| `ritual.color.sage-green.v1` | `SAGE_GREEN` |
| `ritual.color.soft-lilac.v1` | `SOFT_LILAC` |
| `ritual.color.cloud-gray.v1` | `CLOUD_GRAY` |

### 12.3 Number

需要数字时，用 `ritual.number.v1` 在整数 `[1,2,3,4,5,6,7,8,9]` 中选择。ID 为 `ritual.number.<value>.v1`。同时有两类时固定按 COLOR、NUMBER 输出。

## 13. 模板 variant

受控表达计划的候选按以下固定顺序构造：

1. `template.focus-first.v1`：始终合格；
2. `template.care-then-step.v1`：care 存在时合格；
3. `template.support-then-focus.v1`：supporting 存在且 care 不存在时合格。

n=1 直接选择；n>1 使用 `template.variant.v1`。care 存在时禁止任何以 supporting 开头的 variant，真实低状态必须先被接住。variant 只决定语义槽位次序，不进入严格 `RuleFacts` 或 `ExpressionPayload`，也不允许改变事实、行动、任务或仪式。实际发布路径继续按 Schema 在 provenance 记录 prompt 或 template version。

表达断言模式只描述签到信息完整度：全部 `UNSURE` 为 `LOW_ASSERTION`，部分 `UNSURE` 为 `PARTIAL_ASSERTION`，没有 `UNSURE` 为 `STANDARD`。该 token 不能改写 RuleFacts。`LOW_ASSERTION` 必须说明信息不确定，即使内部 overall band 为 STEADY 也禁止声称“你的状态稳定”；`PARTIAL_ASSERTION` 只能陈述明确回答的字段，必须列出禁止断言的字段。care 是独立且更高优先级的低压力表达约束。

## 14. RuleFacts 组装不变量

组装顺序固定：overall、canonical dimensions、focus、可选 supporting、可选 care、display order、explanation basis、canonical action candidates、selected action、task、rituals。

规则引擎必须补充共享 Schema 尚未覆盖的检查：

- 每个 score 与 band 阈值一致；
- supporting 存在时必须与 focus 不同；care 存在时必须等于 focus；因此 supporting 与 care 同时存在时也必须不同；
- 每个 candidate 精确匹配冻结目录，`basis_refs` 属于 explanation basis；
- selected action 属于候选；task 精确匹配 selected action；
- display order 精确服从第 11 节；
- ritual 精确匹配 set 与目录；
- `RuleFacts` 不新增版本、seed、fingerprint、关系、任务状态、晚间反馈、Prompt 或模型字段。

版本和调试 trace 属于外部 manifest / server-only derivation record，不得塞进严格对象。

## 15. 七天真实记录聚合

每日娱乐分数和 AI 文本禁止进入本节。周聚合只读取冻结的 `WeeklySourceSnapshot`。

### 15.1 Source day 归一化

只接受 `contract=weekly-source-snapshot`、`schema_version=1.0.0` 且已通过窗口绑定校验的 source。输出根字段固定为 `contract=weekly-aggregate-facts`、`schema_version=1.0.0`、`aggregate_version=weekly-aggregate-v1`；`window_id`、`window_start_date`、`window_end_date` 与 `source_fingerprint` 必须从同一份 accepted source 逐字段原样复制。聚合器不得重算、替换或规范化 `source_fingerprint`，也不得从 day slots 另造窗口 ID 或日期；任一绑定不一致都 terminal failure。

按七个 source day 的既有升序逐槽投影，不重新排序也不压缩缺失日：

- 有 checkin 或 evening 时 aggregate `state=RECORDED`；没有二者时为 `MISSING`。source 的 `PARTIAL` 只表示字段不全，投影后仍为 RECORDED。
- `morning` 精确复制 checkin 的 mood/energy/sleep；`evening` 精确复制 overall feeling；源不存在时省略对应对象。
- `is_lit = source.light?.is_lit ?? false`。
- `helpfulness = source.helpfulness?.rating ?? UNRATED`；只有 HELPFUL 才复制 `helpful_action_kind`，其它状态必须省略。
- 有 source task 时复制 `task_status`，没有时省略。
- ref 与 revision 只用于 source fingerprint/审计，不进入 aggregate day slot 或客户端。

source `MISSING` 却含 checkin/evening、非 MISSING 却两者皆无、HELPFUL 缺 action kind 等情况先由严格 Schema 拒绝。coverage、light、feedback、helpfulness 与 task 计数只能从上述七个归一化 day slots 计算。

### 15.2 Ordinal 与顺序

| metric            | ordinal order                                                    |
| ----------------- | ---------------------------------------------------------------- |
| `MORNING_MOOD`    | VERY_LOW=0, LOW=1, STEADY=2, GOOD=3, LIGHT=4                     |
| `MORNING_ENERGY`  | EMPTY=0, LOW=1, STEADY=2, HIGH=3, FULL=4                         |
| `MORNING_SLEEP`   | POOR=0, LOW=1, OKAY=2, GOOD=3                                    |
| `EVENING_OVERALL` | VERY_HEAVY=0, SOMEWHAT_HEAVY=1, STEADY=2, PRETTY_GOOD=3, LIGHT=4 |

`UNSURE` 增加 `unsure_count`，缺失增加 `missing_count`；二者都不产生 ordinal、不填补、不前向携带。`state_metrics` 固定按上表顺序输出，distribution 按各枚举顺序输出完整零值键。`direction_basis_count = observed_count`，v1 始终省略 `summary_token`。

### 15.3 Direction

取移除 missing 与 `UNSURE` 后、仍保持产品日期先后的整数数组 `v[0..n-1]`：

```text
if n < 3:
  return INSUFFICIENT_DATA

k = floor(n / 2)
early_sum = sum(v[0 .. k-1])
late_sum = sum(v[n-k .. n-1])
edge_delta = late_sum - early_sum

rank_score = 0
for every i < j:
  rank_score += sign(v[j] - v[i])

rank_threshold = max(2, n - 2)

if edge_delta >= k and rank_score >= rank_threshold:
  return HIGHER_LATE
if edge_delta <= -k and rank_score <= -rank_threshold:
  return LOWER_LATE

up_count = count adjacent increases
down_count = count adjacent decreases
value_range = max(v) - min(v)
total_variation = sum(abs(v[i+1] - v[i]))

if up_count > 0 and down_count > 0
   and (value_range >= 2 or total_variation >= 3):
  return VARIABLE

return SIMILAR
```

奇数长度只在 `edge_delta` 忽略中间项；所有观察仍进入 rank 与 variability。强方向优先于 VARIABLE。算法只使用整数。

### 15.4 Mode

仅当以下条件全部满足时同时输出 `mode_value` 与 `mode_count`：

1. `observed_count >= 2`；
2. 最高频次数至少 2；
3. 最高频值唯一。

否则两字段都省略。

### 15.5 Coverage、helpfulness 与 task

- 真实状态日 0、1～2、3～6、7 分别对应 EMPTY、POINTS_ONLY、PARTIAL、COMPLETE。
- `top_helpful_action_kind` 只有 HELPFUL 总数至少 2 且唯一最高 action kind 存在时输出。
- `helpful_action_kind_counts` 只序列化正数键，键顺序使用共享 `ActionKind` order。
- task、feedback、lit 与 coverage 计数直接取冻结 day slots，不从缺失、文本或每日规则结果推断。

### 15.6 Approved fact catalog

完整 registry order 固定为：

```text
fact.coverage.level
fact.coverage.real_days
fact.coverage.missing_days
fact.coverage.checkin_days
fact.coverage.disclosure
fact.light.count
fact.feedback.count
fact.mood.direction
fact.mood.observed_count
fact.mood.mode
fact.energy.direction
fact.energy.observed_count
fact.energy.mode
fact.sleep.direction
fact.sleep.observed_count
fact.sleep.mode
fact.evening.direction
fact.evening.observed_count
fact.evening.mode
fact.helpfulness.rated_count
fact.helpfulness.helpful_count
fact.helpfulness.top_action_kind
fact.task.offered_count
fact.task.completed_count
plan.notice_energy_timing
plan.notice_mood_shifts
plan.notice_sleep_and_energy
plan.notice_helpful_actions
plan.keep_one_small_note
plan.continue_without_pressure
```

过滤规则：

- 前 7 项始终存在；
- 四个 observed count 始终存在；
- direction 仅在非 `INSUFFICIENT_DATA` 时存在；
- mode 精确随 eligible mode 存在；
- rated/helpful count 与 task offered/completed 始终存在；
- top action 精确随 eligible top kind 存在；
- 第 15.7 节 first-match 选中的 plan fact 存在；`plan.continue_without_pressure` 始终存在；
- 最终按 registry order 去重输出，最多 32 项。

`coverage.disclosure` 只解析为真实天数、缺失数和升序缺失日期；mode 解析为 token 与 count；top action 解析为 kind、该 kind count 与 HELPFUL 总数。任何 fact ID 都不得解析到 note、源 ref/revision、每日分数或 AI 文本。

### 15.7 WeeklyExpressionPlan

仅 PARTIAL / COMPLETE 构造计划；EMPTY / POINTS_ONLY 不构造。

PARTIAL / COMPLETE 的 `real_state_day_count` 必然至少为 3，因此 headline 固定为 `fact.coverage.real_days`。禁止用 count 是否大于零重新解释“合格”。

每个 metric 至多产生一个 observation candidate：优先 direction，其次 eligible mode。Morning 候选先按 salience 排序：LOWER/HIGHER/VARIABLE、SIMILAR、mode-only；同层按 ENERGY、MOOD、SLEEP。

选择顺序：

1. 第一个 morning candidate；
2. evening candidate；
3. 用剩余 morning candidates 补到 2 项；
4. 若一项都没有，固定使用 `fact.light.count`，即使计数为 0 也合格。

每个选中的 metric fact 同时把对应 observed-count companion 加入 `approved_fact_ids`，但 companion 不进入 `observation_fact_ids`。

`helpful_pattern_fact_id` 精确随 top helpful kind 存在，并固定为 `fact.helpfulness.top_action_kind`。

Next observation 使用 first-match：

1. energy 为 LOWER/HIGHER/VARIABLE → `NOTICE_ENERGY_TIMING`；
2. mood 为 LOWER/HIGHER/VARIABLE → `NOTICE_MOOD_SHIFTS`；
3. sleep 为 LOWER/HIGHER/VARIABLE 且 energy observed>=3 → `NOTICE_SLEEP_AND_ENERGY`；
4. 存在 top helpful kind → `NOTICE_HELPFUL_ACTIONS`；
5. evening feedback days < real-state days → `KEEP_ONE_SMALL_NOTE`；
6. 否则 → `CONTINUE_WITHOUT_PRESSURE`。

各值对应同名的第 15.6 节 `plan.*` fact ID。

计划的 `approved_fact_ids` 是以下集合按全局 registry order 序列化：

```text
coverage.level, coverage.real_days, coverage.missing_days,
coverage.disclosure, light.count, feedback.count,
+ headline
+ observation facts
+ matching observed-count companions
+ optional helpful pattern
+ next plan fact
```

去重后必须为 3～12 项。固定字段：

```text
coverage_fact_id = fact.coverage.level
source_disclosure_fact_id = fact.coverage.disclosure
coverage_level = aggregate.coverage.coverage_level
```

编排器必须补充校验：计划所有 ID 属于当前 aggregate catalog，且 plan 的 coverage 与 aggregate 相同。`WeeklyExpressionPlan` 本身不承载 source fingerprint 或 aggregate version；编排器在包装最终周总结时必须另行校验 summary 的 source fingerprint 等于 aggregate、冻结闭包要求的 aggregate version 与当前 aggregate 相同。共享 Schema 尚未跨对象强制这些关系。

## 16. 失败与验收

### 16.1 Fail closed

以下情况不得产生普通 `RuleFacts` 或让 AI 猜测：

- 输入缺失、非法枚举、未知字段或日期绑定不一致；
- manifest、规则、目录或 namespace registry 缺失/不兼容；
- 候选重复 ID、rank 非全序（`CATALOG_ORDER_INVALID`）、mandatory 候选为空；
- choice n 超界或 counter 耗尽；
- score/band、action/task、ritual、display order 或引用不变量失败；
- 周窗口、计数、方向、catalog 或 plan 交叉关系失败。

### 16.2 必须通过的测试

配套 JSON 固化以下向量：

- 180 种合法 mood × energy × sleep 组合全部终止且 action candidates 为 1～3；
- 全部最好、全部最弱、全部 `UNSURE`、严重与高信号冲突；
- 可达 score 0、synthetic 上界 clamp 100、band 39/40/69/70、整体舍入；
- 五维全并列、部分并列、care、supporting、单/多候选与模板 1/2 候选；
- 四种 ritual set，且同一 seed 改签到不改变仪式；
- 同一输入重复运行逐字段相同；同一 manifest 内额外计算一个已登记但本次未消费的 namespace 不改变已有选择；
- 非签到字段变化不改变分数或候选；
- 周输入与 aggregate 根字段逐字段绑定、七日 source→day-slot 归一化、direction、mode、UNSURE/missing、事实优先级、0～7 天 coverage，以及 source→aggregate→plan 端到端投影；
- RuleFacts 通过当前共享 Zod Schema，客户端投影不含 score 或 server-only trace。

测试向量是规范样例，不是允许硬编码 expected output 的实现捷径。

## 17. 待下游完成

本文不实现 TypeScript 包、数据库、API、AI Gateway、Prompt、完整模板文案、Safety 分类或指纹字节协议。S-16 应把本文件和 JSON fixture 转成跨语言 golden corpus、属性测试和分布校准；任何校准改变 v1 语义都必须升级版本，不能修改历史结果。

## 18. 接受记录

- 用户于 2026-07-22 确认 S-11；
- 整数评分、候选目录、具名选择、模板资格和周聚合 v1 语义正式生效；
- 配套 `s11-test-vectors.json` 作为 Accepted 跨语言 golden fixture；
- 任何权重、阈值、目录顺序或事实优先级变化必须创建新版本，不得原地修改 v1。

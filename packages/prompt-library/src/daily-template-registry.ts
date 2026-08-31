import { createHash } from "node:crypto";

import type {
  ActionKind,
  Band,
  Effort,
  ExpressionStyle,
  StableDimensionId,
} from "@daily-energy/shared-schemas";

export const DAILY_TEMPLATE_VERSION = "daily-template-v1";
export const DAILY_TEMPLATE_RENDERER_VERSION =
  "controlled-daily-template-renderer-v1";

export interface DailyTemplateActionCopyV1 {
  readonly actionId: string;
  readonly constraintLabel: string;
  readonly constraintToken: string;
  readonly coreTip: string;
  readonly effort: Effort;
  readonly instruction: string;
  readonly kind: ActionKind;
  readonly rationale: string;
  readonly targetScope: string;
  readonly taskId: string;
  readonly taskInstruction: string;
  readonly timeboxMinutes: number;
}

export interface DailyTemplateStyleCopyV1 {
  readonly careSuffix: string;
  readonly closing: string;
  readonly explanationTail: string;
  readonly greeting: string;
  readonly knownSuffix: string;
  readonly lowAssertion: string;
  readonly partialSuffix: string;
}

export interface DailyTemplateRegistryV1 {
  readonly authorityPaths: readonly string[];
  readonly checkinPhrases: Readonly<Record<string, string>>;
  readonly colorLabels: Readonly<Record<string, string>>;
  readonly contract: "controlled-daily-template-registry-v1";
  readonly dimensionGuidance: Readonly<
    Record<StableDimensionId, Readonly<Record<Band, string>>>
  >;
  readonly focusGuidance: Readonly<Record<StableDimensionId, string>>;
  readonly actionCopyById: Readonly<Record<string, DailyTemplateActionCopyV1>>;
  readonly overallSummary: Readonly<Record<Band, string>>;
  readonly careOverallSummary: string;
  readonly rendererVersion: typeof DAILY_TEMPLATE_RENDERER_VERSION;
  readonly styles: Readonly<Record<ExpressionStyle, DailyTemplateStyleCopyV1>>;
  readonly templateVersion: typeof DAILY_TEMPLATE_VERSION;
}

const DAILY_TEMPLATE_REGISTRY_SOURCE_V1: DailyTemplateRegistryV1 = {
  contract: "controlled-daily-template-registry-v1",
  templateVersion: DAILY_TEMPLATE_VERSION,
  rendererVersion: DAILY_TEMPLATE_RENDERER_VERSION,
  authorityPaths: [
    "docs/ai/daily-content-schema.md",
    "docs/ai/personality.md",
    "docs/ai/prompt-spec.md",
    "docs/ai/safety.md",
  ],
  checkinPhrases: {
    "checkin.mood.very-low.v1": "今天的心情很低",
    "checkin.mood.low.v1": "今天的心情偏低",
    "checkin.mood.steady.v1": "今天的心情比较平稳",
    "checkin.mood.good.v1": "今天的心情不错",
    "checkin.mood.light.v1": "今天的心情比较轻快",
    "checkin.energy.empty.v1": "今天的精力几乎见底",
    "checkin.energy.low.v1": "今天的精力偏低",
    "checkin.energy.steady.v1": "今天的精力比较平稳",
    "checkin.energy.high.v1": "今天的精力比较充足",
    "checkin.energy.full.v1": "今天的精力很充足",
    "checkin.sleep.poor.v1": "昨晚的休息很不够",
    "checkin.sleep.low.v1": "昨晚的休息不算充足",
    "checkin.sleep.okay.v1": "昨晚的休息还可以",
    "checkin.sleep.good.v1": "昨晚的休息不错",
  },
  overallSummary: {
    LOW: "今天适合放轻负担，把动作缩小一点。",
    STEADY: "今天适合稳住节奏，再推进一小步。",
    HIGH: "今天有一点推进余量，先用在一件事上。",
  },
  careOverallSummary: "今天有方向，但不需要勉强自己推进。",
  dimensionGuidance: {
    pace: {
      LOW: "节奏方面可以先放慢一点，减少来回切换。",
      STEADY: "节奏方面适合保持稳定，不必临时加速。",
      HIGH: "节奏方面有些余量，可以适度推进一步。",
    },
    action: {
      LOW: "行动方面先缩到第一步，不要求一次完成。",
      STEADY: "行动方面按一个清楚步骤稳稳推进。",
      HIGH: "行动方面可以开始一件已经选好的事。",
    },
    connection: {
      LOW: "沟通方面先降低压力，确认一个重点即可。",
      STEADY: "沟通方面适合清楚表达，再确认一次。",
      HIGH: "沟通方面有些余量，可以主动确认一次。",
    },
    resources: {
      LOW: "安排方面先收紧时间和注意力的范围。",
      STEADY: "安排方面保持有限范围，先排清顺序。",
      HIGH: "安排方面可以整理一个明确的小范围。",
    },
    recovery: {
      LOW: "恢复方面优先停顿一下，减少额外负担。",
      STEADY: "恢复方面保留基本留白，不把日程排满。",
      HIGH: "恢复方面仍要留出停顿，不用尽全部余量。",
    },
  },
  focusGuidance: {
    pace: "今日节奏先围绕减少切换来安排",
    action: "行动推进先围绕缩小第一步来安排",
    connection: "沟通连接先围绕确认一个重点来安排",
    resources: "资源安排先围绕收紧范围来安排",
    recovery: "恢复留白先围绕降低负担来安排",
  },
  styles: {
    BALANCED: {
      greeting: "你好，我们先用一分钟看看今天。",
      lowAssertion:
        "今天的信息还不算完整，我们先从做得到的一小步开始，不替你给状态下结论。",
      partialSuffix: "先按已知信息安排，不补全没说的部分。",
      knownSuffix: "今天就以这项真实状态为起点，把行动控制在做得到的范围。",
      careSuffix: "先照顾这份真实状态，把负担放轻，不需要证明今天能做很多。",
      explanationTail:
        "主要行动只保留一件低负担的小事，先完成明确的第一步，再决定是否继续；余量不够时停下来也可以。",
      closing: "今天先完成这一小步就够了。",
    },
    GENTLE: {
      greeting: "你好，我们慢一点看看今天。",
      lowAssertion:
        "今天的信息还不算完整，先不用急着说明白。我们只选一小步，按做得到的节奏开始。",
      partialSuffix: "先轻轻照顾已知的部分，其余不用急着补全。",
      knownSuffix: "我们先照顾这份真实感受，再把行动放进做得到的范围。",
      careSuffix: "先照顾这份真实状态，把负担放轻一点，慢下来也没有关系。",
      explanationTail:
        "主要行动仍只保留一件低负担的小事。先完成做得到的第一步，走到那里再决定是否继续，停下来也没关系。",
      closing: "今天做到这一小步就已经够了。",
    },
    LIGHT_HUMOR: {
      greeting: "你好，先给今天留一分钟。",
      lowAssertion:
        "今天的信息还不算完整，我们先从做得到的一小步开始，不替你给状态下结论。",
      partialSuffix: "先按已知信息安排，只给一件小事留位置。",
      knownSuffix: "今天先把节奏放清楚，只给一件低负担的小事留位置。",
      careSuffix: "先照顾这份真实状态，把负担放轻，不拿低状态开玩笑。",
      explanationTail:
        "主要行动只留一件低负担的小事，别让待办同时开太多后台。先完成第一步，再决定是否继续。",
      closing: "先完成这一小步，剩下的稍后再说。",
    },
    CLEAR_DIRECT: {
      greeting: "你好，先看今天最重要的一步。",
      lowAssertion:
        "今天的信息有限，不补全没说的部分。先选一小步，按做得到的范围开始。",
      partialSuffix: "只使用已知信息，其余状态不作判断。",
      knownSuffix: "按这项真实状态安排今天，只推进一个清楚的小动作。",
      careSuffix: "先按这项真实状态降低负担，只保留一个低压力动作。",
      explanationTail:
        "主要行动只有一件低负担的小事。完成第一步，再决定是否继续；余量不足就停。",
      closing: "今天只完成这一小步就够了。",
    },
  },
  actionCopyById: {
    "action.prioritize-one.v1": {
      actionId: "action.prioritize-one.v1",
      kind: "PRIORITIZE_ONE",
      targetScope: "ONE_PRIORITY",
      effort: "VERY_LIGHT",
      timeboxMinutes: 10,
      constraintToken: "ONE_PRIORITY",
      constraintLabel: "一次只做一件",
      instruction: "选一件最重要的事，用10分钟只推进这一件。",
      rationale: "减少并行目标，更容易看清真实余量。",
      coreTip: "把注意力放回一个优先项，今天只推进这一件，不再增加第二个目标。",
      taskId: "task.write-one-priority.v1",
      taskInstruction: "写下今天最重要的一件事，写完即可。",
    },
    "action.prepare-one-step.v1": {
      actionId: "action.prepare-one-step.v1",
      kind: "PREPARE_ONE_STEP",
      targetScope: "ONE_NEXT_STEP",
      effort: "LIGHT",
      timeboxMinutes: 15,
      constraintToken: "STOP_AFTER_FIRST_STEP",
      constraintLabel: "先做第一步",
      instruction: "为一件事完成最小准备，用15分钟只做第一步。",
      rationale: "先完成准备，可以降低真正开始时的阻力。",
      coreTip: "把今天的重点缩到一个最小准备，先做第一步，再决定是否继续。",
      taskId: "task.name-first-step.v1",
      taskInstruction: "把第一步写成一句话，写清楚即可。",
    },
    "action.communicate-clearly.v1": {
      actionId: "action.communicate-clearly.v1",
      kind: "COMMUNICATE_CLEARLY",
      targetScope: "ONE_CONVERSATION",
      effort: "LIGHT",
      timeboxMinutes: 10,
      constraintToken: "ONE_CLEAR_POINT",
      constraintLabel: "只说一个重点",
      instruction: "围绕一次沟通，用10分钟写清或确认一个重点。",
      rationale: "先确认重点，可以减少来回猜测和额外压力。",
      coreTip: "把今天的沟通重点缩到一句清楚的话，先确认，再决定后续表达。",
      taskId: "task.write-one-clear-point.v1",
      taskInstruction: "写下这次沟通最想确认的一个重点。",
    },
    "action.reduce-switching.v1": {
      actionId: "action.reduce-switching.v1",
      kind: "REDUCE_SWITCHING",
      targetScope: "ONE_FOCUS_BLOCK",
      effort: "VERY_LIGHT",
      timeboxMinutes: 10,
      constraintToken: "NO_MULTITASKING",
      constraintLabel: "暂不同时处理",
      instruction: "关闭一个当前干扰，用10分钟只处理眼前这一件事。",
      rationale: "减少切换，可以把有限注意力留给当前一步。",
      coreTip: "先关掉一个当前干扰，把注意力留给眼前这一件事，不同时开新任务。",
      taskId: "task.close-one-distraction.v1",
      taskInstruction: "关闭一个当前干扰，完成后就停。",
    },
    "action.organize-small-scope.v1": {
      actionId: "action.organize-small-scope.v1",
      kind: "ORGANIZE_SMALL_SCOPE",
      targetScope: "ONE_SMALL_SCOPE",
      effort: "VERY_LIGHT",
      timeboxMinutes: 10,
      constraintToken: "STOP_AT_TIMEBOX",
      constraintLabel: "到时间就停",
      instruction: "整理一个眼前的小范围，用10分钟收好就停。",
      rationale: "限定范围，可以避免整理变成新的大任务。",
      coreTip: "只整理一个看得见的小范围，到时间就停，不把它扩成整套计划。",
      taskId: "task.put-away-one-item.v1",
      taskInstruction: "收好一个眼前物件，收好即可。",
    },
    "action.pause-and-recover.v1": {
      actionId: "action.pause-and-recover.v1",
      kind: "PAUSE_AND_RECOVER",
      targetScope: "ONE_SHORT_PAUSE",
      effort: "VERY_LIGHT",
      timeboxMinutes: 10,
      constraintToken: "NO_PERFORMANCE_GOAL",
      constraintLabel: "不设表现目标",
      instruction: "留出10分钟短暂停顿，不给这段时间设表现目标。",
      rationale: "停顿本身就是目的，不需要换来更多产出。",
      coreTip: "先留一段不承担表现目标的停顿，把恢复放在额外安排之前。",
      taskId: "task.take-one-short-pause.v1",
      taskInstruction: "给自己一次短暂停顿，不安排表现目标。",
    },
    "action.reflect-briefly.v1": {
      actionId: "action.reflect-briefly.v1",
      kind: "REFLECT_BRIEFLY",
      targetScope: "ONE_SENTENCE",
      effort: "VERY_LIGHT",
      timeboxMinutes: 5,
      constraintToken: "ONE_SENTENCE_ONLY",
      constraintLabel: "只写一句",
      instruction: "写下一个词或一句真实感受，5分钟内写完就停。",
      rationale: "简短记录可以保留真实感受，不急着解释原因。",
      coreTip: "把今天的重点缩到一个真实词语或一句话，只记录，不急着解释。",
      taskId: "task.note-one-word.v1",
      taskInstruction: "记下一个描述此刻的词，写完即可。",
    },
    "action.seek-real-support.v1": {
      actionId: "action.seek-real-support.v1",
      kind: "SEEK_REAL_SUPPORT",
      targetScope: "ONE_TRUSTED_PERSON",
      effort: "VERY_LIGHT",
      timeboxMinutes: 10,
      constraintToken: "ASK_ONE_SMALL_THING",
      constraintLabel: "只提一个小请求",
      instruction: "选一位现实中可信任的人，用10分钟准备一个小请求。",
      rationale: "把请求缩小一点，更容易获得现实中的一般支持。",
      coreTip: "先选一位现实中可信任的人，只准备一个具体而低压力的小请求。",
      taskId: "task.choose-one-trusted-person.v1",
      taskInstruction: "选出一位现实中可信任的人，先记下名字。",
    },
  },
  colorLabels: {
    MIST_BLUE: "雾蓝",
    WARM_BEIGE: "暖米色",
    SAGE_GREEN: "鼠尾草绿",
    SOFT_LILAC: "柔丁香紫",
    CLOUD_GRAY: "云灰",
  },
};

const EXPECTED_DAILY_TEMPLATE_REGISTRY_FINGERPRINT_V1 =
  "61ca366d804f43f50ab261cb7a2de43dfe2c6b881808423c82b2ceabbae9c113";

export const DAILY_TEMPLATE_REGISTRY_FINGERPRINT_V1 = fingerprintRegistry(
  DAILY_TEMPLATE_REGISTRY_SOURCE_V1,
);

if (
  DAILY_TEMPLATE_REGISTRY_FINGERPRINT_V1 !==
  EXPECTED_DAILY_TEMPLATE_REGISTRY_FINGERPRINT_V1
) {
  throw new Error("DAILY_TEMPLATE_REGISTRY_FINGERPRINT_MISMATCH");
}

export const DAILY_TEMPLATE_REGISTRY_V1 = deepFreeze(
  DAILY_TEMPLATE_REGISTRY_SOURCE_V1,
);

function fingerprintRegistry(value: DailyTemplateRegistryV1): string {
  return createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }
  return value;
}

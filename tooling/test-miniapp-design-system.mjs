import assert from "node:assert/strict";

import {
  MINIAPP_DESIGN_SYSTEM_RULE_IDS,
  runMiniappDesignSystemGate,
} from "./lib/miniapp-design-system-gate.mjs";

const componentNames = [
  "PageShell",
  "AppHeader",
  "PrimaryButton",
  "SecondaryButton",
  "TextButton",
  "ChoiceChip",
  "StateSelector",
  "FriendMessage",
  "EnergySummary",
  "ActionCard",
  "SectionCard",
  "InlineNotice",
  "LoadingSkeleton",
  "OfflineState",
  "RecoverableError",
  "ConfirmSheet",
  "SafetyScreen",
];
const specialPaths = {
  ChoiceChip: "choice-chip",
  ConfirmSheet: "confirm-sheet",
  InlineNotice: "inline-notice",
  LoadingSkeleton: "loading-skeleton",
  OfflineState: "offline-state",
  RecoverableError: "recoverable-error",
  SafetyScreen: "safety-screen",
  StateSelector: "state-selector",
};
const signalContent = {
  "choice-chip": "aria-checked 已选 ✓",
  "confirm-sheet": "aria-modal 此操作可能无法撤销",
  "inline-notice": 'aria-live aria-role="status"',
  "loading-skeleton": "aria-busy prefers-reduced-motion",
  "offline-state": "离线内容 上次同步",
  "recoverable-error": "aria-live 已经保存的内容仍然保留",
  "state-selector": "aria-checked 已选 aria-live",
};
const safetyTypescript = `Component({
  properties: {
    accessibleLabel: { type: String, value: "" },
    actionLoadingLabel: { type: String, value: "" },
    emergencyActionAccessibleLabel: { type: String, value: "" },
    emergencyActionLabel: { type: String, value: "" },
    eyebrow: { type: String, value: "" },
    immediateLabel: { type: String, value: "" },
    message: { type: String, value: "" },
    resources: { type: Array, value: [] },
    resourcesLoading: { type: Boolean, value: false },
    resourcesLoadingLabel: { type: String, value: "" },
    resourcesTitle: { type: String, value: "" },
    resourcesUnavailable: { type: Boolean, value: false },
    resourcesUnavailableLabel: { type: String, value: "" },
    title: { type: String, value: "" },
    trustedPersonAccessibleLabel: { type: String, value: "" },
    trustedPersonLabel: { type: String, value: "" },
  },
  methods: {
    handleEmergency() { this.triggerEvent("emergency"); },
    handleTrustedPerson() { this.triggerEvent("trustedperson"); },
  },
});`;
const safetyWxml = `<view aria-label="{{accessibleLabel}}" aria-role="main">
  <view>{{eyebrow}}</view><view>{{title}}</view><view>{{message}}</view>
  <view><text aria-hidden="true">!</text><text>{{immediateLabel}}</text></view>
  <de-action-button accessible-label="{{emergencyActionAccessibleLabel}}" label="{{emergencyActionLabel}}" loading-label="{{actionLoadingLabel}}" bind:press="handleEmergency"></de-action-button>
  <de-action-button accessible-label="{{trustedPersonAccessibleLabel}}" label="{{trustedPersonLabel}}" loading-label="{{actionLoadingLabel}}" bind:press="handleTrustedPerson"></de-action-button>
  <view aria-live="polite"><view>{{resourcesTitle}}</view>
    <view wx:if="{{resourcesLoading}}">{{resourcesLoadingLabel}}</view>
    <view wx:elif="{{resourcesUnavailable}}">{{resourcesUnavailableLabel}}</view>
    <view wx:else><view wx:for="{{resources}}" wx:key="*this">{{item}}</view></view>
  </view>
</view>`;
const components = componentNames.map((name) => ({
  figmaName: `DE / ${name}`,
  name,
  path:
    specialPaths[name] ??
    name
      .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
      .replace(/Button$/u, "-button")
      .toLowerCase(),
  states: ["Normal"],
  variants: ["Default"],
}));
const files = components.flatMap((component) =>
  ["index.json", "index.ts", "index.wxml", "index.wxss"].map((fileName) => ({
    content:
      component.path === "safety-screen" && fileName === "index.ts"
        ? safetyTypescript
        : component.path === "safety-screen" && fileName === "index.wxml"
          ? safetyWxml
          : fileName === "index.wxml"
            ? (signalContent[component.path] ?? "")
            : "",
    path: `apps/miniapp/src/components/${component.path}/${fileName}`,
  })),
);
files.push({ content: "", path: "apps/miniapp/src/pages/launch/index.wxss" });
const validInput = {
  componentLibrary: { components, schemaVersion: 1 },
  files,
};

assert.deepEqual(runMiniappDesignSystemGate(validInput), []);
assert.deepEqual(
  MINIAPP_DESIGN_SYSTEM_RULE_IDS,
  [...MINIAPP_DESIGN_SYSTEM_RULE_IDS].sort(),
);

const cases = [
  {
    expected: "MINIAPP_DESIGN_COMPONENT_MANIFEST",
    mutate: (input) => ({
      ...input,
      componentLibrary: { components: [], schemaVersion: 1 },
    }),
  },
  {
    expected: "MINIAPP_DESIGN_COMPONENT_FILE_MISSING",
    mutate: (input) => ({ ...input, files: input.files.slice(1) }),
  },
  {
    expected: "MINIAPP_DESIGN_COMPONENT_DUPLICATE",
    mutate: (input) => {
      const clone = structuredClone(input);
      clone.componentLibrary.components[1].name =
        clone.componentLibrary.components[0].name;
      return clone;
    },
  },
  {
    expected: "MINIAPP_DESIGN_RAW_COLOR",
    mutate: (input) => ({
      ...input,
      files: [
        ...input.files,
        { content: "color: #ffffff;", path: "apps/miniapp/src/app.wxss" },
      ],
    }),
  },
  {
    expected: "MINIAPP_DESIGN_RAW_DIMENSION",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path === "apps/miniapp/src/pages/launch/index.wxss"
          ? { ...file, content: "padding: 20px;" }
          : file,
      ),
    }),
  },
  {
    expected: "MINIAPP_DESIGN_ACCESSIBILITY_SIGNAL",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path.includes("/choice-chip/") ? { ...file, content: "" } : file,
      ),
    }),
  },
  {
    expected: "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path.endsWith("/safety-screen/index.ts")
          ? {
              ...file,
              content: file.content.replace(
                'emergencyActionLabel: { type: String, value: "" }',
                'emergencyActionLabel: { type: String, value: "Call now" }',
              ),
            }
          : file,
      ),
    }),
  },
  {
    expected: "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path.endsWith("/safety-screen/index.wxml")
          ? {
              ...file,
              content: file.content.replace("{{title}}", "Safety copy"),
            }
          : file,
      ),
    }),
  },
  {
    expected: "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path.endsWith("/safety-screen/index.wxml")
          ? {
              ...file,
              content: file.content.replace('bind:press="handleEmergency"', ""),
            }
          : file,
      ),
    }),
  },
  {
    expected: "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path.endsWith("/safety-screen/index.wxml")
          ? {
              ...file,
              content: file.content.replace(
                'aria-label="{{accessibleLabel}}"',
                'aria-label=""',
              ),
            }
          : file,
      ),
    }),
  },
  {
    expected: "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path.endsWith("/safety-screen/index.wxml")
          ? {
              ...file,
              content: file.content.replace('wx:for="{{resources}}"', ""),
            }
          : file,
      ),
    }),
  },
  {
    expected: "MINIAPP_DESIGN_SAFETY_COPY_BOUNDARY",
    mutate: (input) => ({
      ...input,
      files: input.files.map((file) =>
        file.path.endsWith("/safety-screen/index.ts")
          ? {
              ...file,
              content: file.content.replace(
                "resourcesLoading: { type: Boolean, value: false },",
                "",
              ),
            }
          : file,
      ),
    }),
  },
];

for (const testCase of cases) {
  const diagnostics = runMiniappDesignSystemGate(testCase.mutate(validInput));
  assert.ok(
    diagnostics.some(({ ruleId }) => ruleId === testCase.expected),
    `expected ${testCase.expected}`,
  );
}

console.log(
  `Miniapp design-system fixtures passed ${cases.length} known-fail cases and one known-pass library.`,
);

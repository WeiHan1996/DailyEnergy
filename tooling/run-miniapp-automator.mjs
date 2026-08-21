import { access } from "node:fs/promises";
import { resolve } from "node:path";

import automator from "miniprogram-automator";

import {
  classifyMiniappDevtoolsError,
  formatMiniappDevtoolsResult,
} from "./lib/miniapp-devtools-result.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const projectPath = resolve(repositoryRoot, "apps/miniapp");
const cliPath = process.env.WECHAT_DEVTOOLS_CLI_PATH;
const launchTimeoutMs = 25_000;
const smokeCases = Object.freeze([
  {
    expectedPath: "pages/recovery/index",
    expectedScreenId: "SYS-003",
    label: "SYS-001 startup route",
    url: "/pages/launch/index?recovery=1",
  },
  {
    expectedPath: "pages/recovery/index",
    expectedScreenId: "SYS-003",
    label: "SYS-003",
    url: "/pages/recovery/index",
  },
  {
    expectedPath: "pages/landing/index",
    expectedScreenId: "ENT-001",
    label: "ENT-001",
    url: "/pages/landing/index",
  },
  {
    expectedPath: "pages/onboarding/index",
    expectedScreenId: "ONB-001",
    label: "ONB-001",
    url: "/pages/onboarding/index",
  },
  {
    expectedPath: "pages/checkin-handoff/index",
    expectedScreenId: "DLY-001",
    label: "DLY-001 handoff",
    url: "/pages/checkin-handoff/index",
  },
  {
    expectedPath: "pages/safety/index",
    expectedScreenId: "SAFE-001",
    label: "SAFE-001",
    url: "/pages/safety/index",
  },
]);

async function withTimeout(promise, reasonCode) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(reasonCode));
        }, launchTimeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function report(error, phase) {
  const result = classifyMiniappDevtoolsError(error, phase);
  console.error(formatMiniappDevtoolsResult(result));
  process.exitCode = result.exitCode;
}

async function main() {
  if (cliPath === undefined || cliPath.trim().length === 0) {
    report(new Error("MINIAPP_DEVTOOLS_CLI_PATH_MISSING"), "cli");
    return;
  }

  try {
    await access(cliPath);
  } catch {
    report(new Error("MINIAPP_DEVTOOLS_CLI_UNAVAILABLE"), "cli");
    return;
  }

  try {
    await access(resolve(projectPath, "dist/app.js"));
  } catch {
    report(new Error("MINIAPP_DEVTOOLS_BUILD_OUTPUT_MISSING"), "preflight");
    return;
  }

  let miniProgram;
  try {
    miniProgram = await withTimeout(
      automator.launch({
        cliPath,
        projectPath,
        timeout: 15_000,
        trustProject: true,
      }),
      "MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT",
    );
  } catch (error) {
    report(error, "launch");
    return;
  }

  let smokeError;
  try {
    for (const smokeCase of smokeCases) {
      const page = await miniProgram.reLaunch(smokeCase.url);
      if (page === undefined || page.path !== smokeCase.expectedPath) {
        throw new Error("MINIAPP_DEVTOOLS_ROUTE_MISMATCH");
      }
      const data = await page.data();
      if (data.screenId !== smokeCase.expectedScreenId) {
        throw new Error("MINIAPP_DEVTOOLS_SCREEN_MISMATCH");
      }
    }
  } catch (error) {
    smokeError = error;
  }

  let closeError;
  try {
    await miniProgram.close();
  } catch (error) {
    closeError = error;
  }

  if (smokeError !== undefined) {
    report(smokeError, "smoke");
    return;
  }
  if (closeError !== undefined) {
    report(closeError, "close");
    return;
  }

  console.log(
    `Miniapp DevTools smoke passed ${smokeCases.length} C-003 page and route cases.`,
  );
}

await main();

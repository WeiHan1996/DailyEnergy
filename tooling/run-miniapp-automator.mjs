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
    const launchPage = await miniProgram.reLaunch("/pages/launch/index");
    await launchPage.waitFor(300);
    const launchData = await launchPage.data();
    if (launchData.screenId !== "SYS-001") {
      throw new Error("MINIAPP_DEVTOOLS_LAUNCH_SCREEN_MISMATCH");
    }

    const recoveryPage = await miniProgram.reLaunch("/pages/recovery/index");
    await recoveryPage.waitFor(300);
    const recoveryData = await recoveryPage.data();
    if (recoveryData.screenId !== "SYS-003") {
      throw new Error("MINIAPP_DEVTOOLS_RECOVERY_SCREEN_MISMATCH");
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

  console.log("Miniapp DevTools smoke passed for SYS-001 and SYS-003.");
}

await main();

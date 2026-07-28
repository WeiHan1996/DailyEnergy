import { access } from "node:fs/promises";
import { resolve } from "node:path";

import automator from "miniprogram-automator";

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

if (cliPath === undefined || cliPath.trim().length === 0) {
  console.error(
    "MINIAPP_DEVTOOLS_INFRA_BLOCKED: WECHAT_DEVTOOLS_CLI_PATH is required.",
  );
  process.exitCode = 2;
} else {
  try {
    await access(cliPath);
    await access(resolve(projectPath, "dist/app.js"));
    const miniProgram = await withTimeout(
      automator.launch({
        cliPath,
        projectPath,
        timeout: 15_000,
        trustProject: true,
      }),
      "MINIAPP_DEVTOOLS_LAUNCH_TIMEOUT",
    );
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
    } finally {
      await miniProgram.close();
    }
    console.log("Miniapp DevTools smoke passed for SYS-001 and SYS-003.");
  } catch (error) {
    const reasonCode =
      error instanceof Error &&
      /^MINIAPP_DEVTOOLS_[A-Z_]+$/u.test(error.message)
        ? error.message
        : "MINIAPP_DEVTOOLS_INFRA_BLOCKED";
    console.error(reasonCode);
    process.exitCode = 2;
  }
}

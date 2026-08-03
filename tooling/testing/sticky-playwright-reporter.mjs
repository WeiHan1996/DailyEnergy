import { classifyRetryAttempts } from "./policy-gates.mjs";

export default class StickyPlaywrightReporter {
  #attemptsByTest = new Map();

  onTestEnd(test, result) {
    const attempts = this.#attemptsByTest.get(test.id) ?? [];
    attempts.push({
      attempt: result.retry,
      status: result.status === "passed" ? "PASS" : "FAIL",
    });
    this.#attemptsByTest.set(test.id, attempts);
  }

  onEnd() {
    const flakyTestIds = [...this.#attemptsByTest]
      .filter(
        ([, attempts]) => classifyRetryAttempts(attempts) === "FLAKY_FAIL",
      )
      .map(([testId]) => testId)
      .sort((left, right) => left.localeCompare(right));

    if (flakyTestIds.length === 0) {
      return undefined;
    }

    console.error(`PLAYWRIGHT_FLAKY_FAIL:${flakyTestIds.join(",")}`);
    return { status: "failed" };
  }

  printsToStdio() {
    return false;
  }
}

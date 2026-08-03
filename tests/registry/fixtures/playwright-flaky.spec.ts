import { expect, test } from "@playwright/test";

test("synthetic retry remains a sticky failure", ({ request }, testInfo) => {
  expect(request).toBeDefined();
  expect(testInfo.retry).toBe(1);
});

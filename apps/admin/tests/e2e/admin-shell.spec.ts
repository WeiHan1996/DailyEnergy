import { expect, test } from "@playwright/test";

test.describe("E-005 Admin shell", () => {
  test("[ADM-001] renders the fail-closed login shell", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByTestId("login-shell")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "进入管理后台" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "使用企业身份继续" }),
    ).toBeDisabled();
    await expect(page.getByTestId("identity-status")).toContainText(
      "真实身份登录尚未实现",
    );
  });

  test("[S31-TEST-014] renders the base layout and empty state", async ({
    page,
  }) => {
    await page.goto("/shell?state=empty");

    await expect(page.getByTestId("admin-shell")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "后台主导航" }),
    ).toBeVisible();
    await expect(page.getByTestId("state-empty")).toContainText("暂无运行数据");
    await expect(page.getByTestId("runtime-label")).toContainText(
      "受控外壳预览",
    );
  });

  test("[ADM-001] exposes loading and disabled states", async ({ page }) => {
    await page.goto("/shell?state=loading");
    await expect(page.getByTestId("state-loading")).toContainText(
      "正在读取运行状态",
    );

    await page.goto("/shell?state=disabled");
    await expect(page.getByTestId("state-disabled")).toContainText(
      "当前不可用",
    );
  });

  test("[ADM-001] recovers from a retryable shell error", async ({ page }) => {
    await page.goto("/shell?state=error");

    await expect(page.getByTestId("state-error")).toContainText("暂时无法读取");
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByTestId("state-empty")).toContainText("连接已恢复");
  });

  test("[S32-DEPLOY-029] sends the minimum security headers", async ({
    page,
  }) => {
    const response = await page.goto("/login");
    expect(response).not.toBeNull();
    const headers = response?.headers() ?? {};

    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["content-security-policy"]).toContain("connect-src 'self'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
  });
});

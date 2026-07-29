import { describe, expect, it } from "vitest";

import { contentSecurityPolicyForEnvironment } from "../../next.config";

describe("Admin Content Security Policy", () => {
  it("allows the React development debugger to evaluate source", () => {
    expect(contentSecurityPolicyForEnvironment("development")).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });

  it("does not allow unsafe-eval in production", () => {
    expect(contentSecurityPolicyForEnvironment("production")).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(contentSecurityPolicyForEnvironment("production")).not.toContain(
      "'unsafe-eval'",
    );
  });
});

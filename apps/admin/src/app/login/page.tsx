import type { Metadata } from "next";

import { getAdminServerRuntime } from "../../server/admin-runtime.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "后台登录",
};

const disabledMessages = {
  ADMIN_API_ORIGIN_INVALID: "Admin API origin 尚未安全配置。",
  PREVIEW_DISABLED: "本地外壳预览未开启。",
  PRODUCTION_DISABLED: "Production 管理后台保持关闭。",
  RUNTIME_PROFILE_INVALID: "运行 profile 无法识别，后台已关闭。",
  TEST_PROFILE_NOT_AUTHORIZED: "Test profile 只能由 Playwright 启动。",
  TRUSTED_IDENTITY_ADAPTER_UNAVAILABLE:
    "可信企业身份适配尚未实现，Production 不会开放。",
  TRUSTED_IDENTITY_NOT_CONFIGURED: "可信企业身份与会话配置尚未完成。",
} as const;

export default function LoginPage() {
  const runtime = getAdminServerRuntime();
  const statusMessage =
    runtime.availability.status === "ready"
      ? "外壳预览已就绪；真实身份登录尚未实现。"
      : disabledMessages[runtime.availability.reason];

  return (
    <main className="login-page" id="main-content">
      <div className="login-layout">
        <section className="login-intro">
          <p className="eyebrow">ADM-001 · CONTROLLED ACCESS</p>
          <h1>安静地看清系统状态。</h1>
          <p>
            这是 DailyEnergy
            的最小管理后台外壳。它只面向受授权的运营与安全角色，
            不提供任意用户全文浏览，也不绕过 Admin API 的权限与审计边界。
          </p>
          <ul className="boundary-list">
            <li>独立 Admin origin 与 session audience</li>
            <li>默认脱敏，不展示用户正文</li>
            <li>未配置可信身份时 fail closed</li>
          </ul>
        </section>
        <section
          aria-labelledby="login-title"
          className="login-card"
          data-testid="login-shell"
        >
          <div className="login-card__header">
            <div>
              <p className="eyebrow">企业身份</p>
              <h2 id="login-title">进入管理后台</h2>
            </div>
            <span className="security-badge">受控入口</span>
          </div>
          <div className="identity-panel">
            <strong>当前状态</strong>
            <span data-testid="identity-status">{statusMessage}</span>
          </div>
          <form className="login-form">
            <label className="field">
              <span>企业身份</span>
              <input
                autoComplete="username"
                disabled
                placeholder="由企业身份服务提供"
                type="text"
              />
            </label>
            <label className="field">
              <span>二次验证</span>
              <input
                autoComplete="one-time-code"
                disabled
                inputMode="numeric"
                placeholder="由可信身份流程提供"
                type="text"
              />
            </label>
            <button className="button" disabled type="submit">
              使用企业身份继续
            </button>
          </form>
          <p className="login-help">
            E-005 不提供共享默认账号或测试登录。需要访问时，请联系授权管理员完成
            企业身份配置。
          </p>
        </section>
      </div>
    </main>
  );
}

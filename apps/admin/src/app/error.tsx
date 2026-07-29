"use client";

import { StatePanel } from "../components/state-panel";

export default function GlobalError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <main className="login-page" id="main-content">
      <StatePanel
        action={
          <button
            className="button button--primary"
            onClick={reset}
            type="button"
          >
            重试
          </button>
        }
        description="外壳加载没有完成。重试不会提交业务命令。"
        eyebrow="Recoverable Error"
        kind="error"
        title="暂时无法打开后台"
      />
    </main>
  );
}

"use client";

import { AdminShell } from "../../components/admin-shell";
import { StatePanel } from "../../components/state-panel";

export default function ShellError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <AdminShell runtimeLabel="可恢复错误">
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
        description="读取未完成。重试会沿用原查询，不会绕过权限或创建业务写入。"
        eyebrow="Recoverable Error"
        kind="error"
        title="暂时无法读取"
      />
    </AdminShell>
  );
}

import type { Metadata } from "next";

import { AdminShell } from "../../components/admin-shell";
import { RecoverableErrorState } from "../../components/recoverable-error-state";
import { StatePanel } from "../../components/state-panel";
import { getAdminServerRuntime } from "../../server/admin-runtime.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "后台骨架",
};

type ShellState = "disabled" | "empty" | "error" | "loading";

function shellState(value: string | string[] | undefined): ShellState {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ["disabled", "empty", "error", "loading"].includes(candidate ?? "")
    ? (candidate as ShellState)
    : "empty";
}

function ShellStateView({ state }: { readonly state: ShellState }) {
  if (state === "loading") {
    return (
      <StatePanel
        description="正在通过受控 Admin API 边界准备聚合状态。"
        eyebrow="Loading"
        kind="loading"
        title="正在读取运行状态"
      />
    );
  }
  if (state === "error") {
    return <RecoverableErrorState />;
  }
  if (state === "disabled") {
    return (
      <StatePanel
        description="此能力尚未满足可信身份、权限或审计前置条件。"
        eyebrow="Disabled"
        kind="disabled"
        title="当前不可用"
      />
    );
  }
  return (
    <StatePanel
      description="Admin API 尚未接入业务聚合数据；这里不会生成模拟 Dashboard。"
      eyebrow="Empty"
      kind="empty"
      title="暂无运行数据"
    />
  );
}

export default async function ShellPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly state?: string | string[];
  }>;
}) {
  const runtime = getAdminServerRuntime();
  const parameters = await searchParams;

  if (runtime.availability.status !== "ready") {
    return (
      <AdminShell runtimeLabel="Fail closed">
        <StatePanel
          description="可信企业身份或 Production Gate 尚未满足，后台不会进入业务界面。"
          eyebrow="Disabled"
          kind="disabled"
          title="管理后台未启用"
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell runtimeLabel="受控外壳预览">
      <ShellStateView state={shellState(parameters.state)} />
    </AdminShell>
  );
}

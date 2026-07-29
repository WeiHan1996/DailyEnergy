import { AdminShell } from "../../components/admin-shell";
import { StatePanel } from "../../components/state-panel";

export default function ShellLoading() {
  return (
    <AdminShell runtimeLabel="正在确认">
      <StatePanel
        description="正在确认运行 profile 与 Admin API 边界。"
        eyebrow="Loading"
        kind="loading"
        title="正在准备后台外壳"
      />
    </AdminShell>
  );
}

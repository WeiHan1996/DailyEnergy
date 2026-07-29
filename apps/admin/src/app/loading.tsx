import { StatePanel } from "../components/state-panel";

export default function Loading() {
  return (
    <main className="login-page" id="main-content">
      <StatePanel
        description="正在确认管理后台运行边界。"
        eyebrow="Loading"
        kind="loading"
        title="正在准备"
      />
    </main>
  );
}

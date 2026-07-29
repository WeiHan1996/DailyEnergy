import { StatePanel } from "../components/state-panel";

export default function NotFound() {
  return (
    <main className="login-page" id="main-content">
      <StatePanel
        action={
          <a className="button button--primary" href="/login">
            返回登录
          </a>
        }
        description="这个后台入口不存在，或尚未在当前骨架中开放。"
        eyebrow="Empty"
        kind="empty"
        title="没有这个页面"
      />
    </main>
  );
}

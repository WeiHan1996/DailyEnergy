import type { ReactNode } from "react";

interface AdminShellProperties {
  readonly children: ReactNode;
  readonly runtimeLabel: string;
}

const navigation = ["运行概览", "生成记录", "安全事件", "数据请求"] as const;

export function AdminShell({ children, runtimeLabel }: AdminShellProperties) {
  return (
    <div className="admin-shell" data-testid="admin-shell">
      <aside className="admin-sidebar">
        <a className="brand" href="/login">
          <span aria-hidden="true" className="brand__mark">
            DE
          </span>
          <span>
            <strong>DailyEnergy</strong>
            <small>管理后台</small>
          </span>
        </a>
        <nav aria-label="后台主导航" className="admin-nav">
          {navigation.map((item, index) => (
            <span
              aria-current={index === 0 ? "page" : undefined}
              aria-disabled="true"
              className="admin-nav__item"
              data-active={index === 0 ? "true" : "false"}
              key={item}
            >
              <span aria-hidden="true" className="admin-nav__dot" />
              {item}
            </span>
          ))}
        </nav>
        <div className="admin-sidebar__boundary">
          <span className="status-dot" />
          <span>
            <strong>只读外壳</strong>
            <small>无数据库或 provider 连接</small>
          </span>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">ADM-002 SHELL</p>
            <h1>运行概览</h1>
          </div>
          <div className="runtime-chip" data-testid="runtime-label">
            {runtimeLabel}
          </div>
        </header>
        <main className="admin-content" id="main-content">
          <div className="scope-note">
            <strong>骨架边界</strong>
            <span>本页不展示业务 Dashboard，也不读取用户正文。</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

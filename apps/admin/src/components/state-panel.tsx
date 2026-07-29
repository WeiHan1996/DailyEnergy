import type { ReactNode } from "react";

type StateKind = "disabled" | "empty" | "error" | "loading";

interface StatePanelProperties {
  readonly action?: ReactNode;
  readonly description: string;
  readonly eyebrow: string;
  readonly kind: StateKind;
  readonly title: string;
}

export function StatePanel({
  action,
  description,
  eyebrow,
  kind,
  title,
}: StatePanelProperties) {
  return (
    <section
      aria-busy={kind === "loading"}
      aria-live="polite"
      className="state-panel"
      data-state={kind}
      data-testid={`state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <div aria-hidden="true" className="state-panel__mark">
        {kind === "loading" ? <span className="spinner" /> : null}
        {kind === "empty" ? "○" : null}
        {kind === "error" ? "!" : null}
        {kind === "disabled" ? "—" : null}
      </div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="state-panel__description">{description}</p>
        {action === undefined ? null : (
          <div className="state-panel__action">{action}</div>
        )}
      </div>
    </section>
  );
}

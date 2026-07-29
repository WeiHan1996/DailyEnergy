import { createElement } from "react";

export const dynamic = "force-dynamic";

export default function SyntheticLeakPage() {
  return createElement(
    "main",
    null,
    createElement("h1", null, "Synthetic response leak"),
    createElement(
      "p",
      null,
      globalThis.process.env.ADMIN_RESPONSE_SECRET_CANARY,
    ),
    createElement(
      "p",
      null,
      globalThis.process.env.ADMIN_RESPONSE_USER_BODY_CANARY,
    ),
  );
}

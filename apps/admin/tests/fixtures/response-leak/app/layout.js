import { createElement } from "react";

export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return createElement(
    "html",
    { lang: "zh-CN" },
    createElement("body", null, children),
  );
}

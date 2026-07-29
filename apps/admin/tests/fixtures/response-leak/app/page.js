import { createElement } from "react";

import { LeakNavigation } from "./leak-navigation";

export const dynamic = "force-dynamic";

export default function FixtureHomePage() {
  return createElement(
    "main",
    null,
    createElement("h1", null, "Browser response known-fail fixture"),
    createElement(LeakNavigation),
  );
}

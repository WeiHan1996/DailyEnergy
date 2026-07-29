import { createElement } from "react";
import Link from "next/link";

export function LeakNavigation() {
  return createElement(
    Link,
    {
      href: "/leak",
      prefetch: false,
    },
    "Open synthetic leak",
  );
}

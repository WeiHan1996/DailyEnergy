import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  description: "DailyEnergy 受控管理后台外壳",
  robots: {
    follow: false,
    index: false,
  },
  title: {
    default: "DailyEnergy Admin",
    template: "%s · DailyEnergy Admin",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        {children}
      </body>
    </html>
  );
}

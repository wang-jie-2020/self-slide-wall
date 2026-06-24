import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "观众提问墙",
  description: "用于现场活动的最小观众提问墙纵向切片"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

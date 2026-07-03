import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "VR Radar Lite",
  description: "XR/VR/AR 标题收集和选题筛选工具"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <h1 className="brand">VR Radar Lite</h1>
            <div className="brand-sub">XR 标题池与选题雷达</div>
            <Nav />
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}

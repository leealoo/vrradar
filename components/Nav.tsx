"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "今日更新" },
  { href: "/all", label: "全部标题" },
  { href: "/favorites", label: "收藏夹" },
  { href: "/feeds", label: "信息源管理" },
  { href: "/keywords", label: "关键词管理" },
  { href: "/settings", label: "设置" },
  { href: "/export", label: "Markdown 导出" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BriefcaseBusiness, ChartNoAxesCombined, LayoutDashboard, Map, Newspaper, Radio, Scale, Users, UsersRound } from "lucide-react";
import report from "@/data/report.json";
import sources from "@/data/sources.json";

const links = [
  { href: "/", label: "情报总览", icon: LayoutDashboard },
  { href: "/briefings", label: "双周简报", icon: Newspaper },
  { href: "/macro", label: "国家宏观总览", icon: ChartNoAxesCombined },
  { href: "/profile", label: "国家画像", icon: Map },
  { href: "/customers", label: "客户洞察", icon: UsersRound },
  { href: "/competitors", label: "友商洞察", icon: BriefcaseBusiness },
  { href: "/compliance", label: "合规与营商", icon: Scale },
  { href: "/people", label: "政府人员", icon: Users },
  { href: "/sources", label: "社媒信源", icon: Radio },
  { href: "/archive", label: "历史归档", icon: Archive }
];

function Navigation() {
  const pathname = usePathname();
  return <nav className="nav-list" aria-label="主导航">{links.map(({ href, label, icon: Icon }) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return <Link key={href} href={href} className={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon size={16} aria-hidden="true"/><span>{label}</span>
    </Link>;
  })}</nav>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const verified = sources.filter(source => source.status === "正常" || source.status === "已核验").length;
  return <div className="shell">
    <header className="topbar">
      <div className="topbar-main">
        <Link href="/" className="brand" aria-label="返回情报总览">
          <div className="brand-mark"><Radio size={20} aria-hidden="true"/>黎凡特 ICT 情报中心</div>
          <div className="brand-sub">Iraq · Jordan · Lebanon · 双周决策情报驾驶舱</div>
        </Link>
        <div className="report-meta">
          <div className="page-title">伊拉克代表处 ICT 双周简报</div>
          <div className="top-meta">李辉 00621351 · MSSD AI团队</div>
        </div>
        <div className="top-actions"><span className="chip">{report.issue.replace("-", "—")}</span><span className="chip">更新于 {report.generated}</span></div>
      </div>
      <div className="topbar-nav">
        <Navigation/>
        <div className="source-status"><span className="online"/>{verified}/{sources.length} 个信源已核验</div>
      </div>
    </header>
    <main className="main"><div className="content">{children}</div></main>
  </div>;
}

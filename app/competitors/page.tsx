import type { Metadata } from "next";
import { CompetitorInsights } from "@/components/competitor-insights";

export const metadata: Metadata = {
  title: "友商洞察 | 黎凡特 ICT 情报中心",
  description: "ZTE、爱立信、诺基亚、戴尔、IBM、VMware 在伊拉克、约旦、黎巴嫩的公开动态与主营业务"
};

export default function CompetitorsPage() {
  return <CompetitorInsights/>;
}

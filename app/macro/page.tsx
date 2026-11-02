import type { Metadata } from "next";
import { MacroDashboard } from "@/components/macro-dashboard";

export const metadata: Metadata = { title: "国家宏观总览 | 黎凡特 ICT 情报中心", description: "伊拉克、约旦、黎巴嫩宏观、能源、航运、资本市场与运营商数据" };

export default function MacroPage() {
  return <MacroDashboard/>;
}

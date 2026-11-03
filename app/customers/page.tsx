import type { Metadata } from "next";
import { CustomerInsights } from "@/components/customer-insights";

export const metadata: Metadata = {
  title: "客户洞察 | 黎凡特 ICT 情报中心",
  description: "伊拉克、约旦、黎巴嫩 17 类客户的主营组织、预算战略、近期动态、经营观察与价值建议"
};

export default function CustomersPage() {
  return <CustomerInsights/>;
}

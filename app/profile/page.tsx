import type { Metadata } from "next";
import { CountryProfile } from "@/components/country-profile";

export const metadata: Metadata = {
  title: "国家画像 | 黎凡特 ICT 情报中心",
  description: "伊拉克、约旦、黎巴嫩官方国家指标、ICT 市场、数字战略与本土政府双重核验"
};

export default function ProfilePage() {
  return <CountryProfile/>;
}

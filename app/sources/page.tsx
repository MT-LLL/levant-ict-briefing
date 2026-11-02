import { Radio, ExternalLink, CheckCircle2, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import sources from "@/data/sources.json";

export default function SourcesPage() {
  const verified = sources.filter(source => source.status === "正常" || source.status === "已核验").length;
  const telegramSources = sources.filter(source => source.platform === "Telegram");
  const healthyTelegram = telegramSources.filter(source => source.status === "正常" && source.collectionDate).length;
  const latestCollection = telegramSources.map(source => source.collectionDate).filter(Boolean).sort().at(-1);
  const t1 = sources.filter(source => source.tier === "T1").length;
  const platformNames = [...new Set(sources.map(source => source.platform))];

  return <>
    <div className="hero">
      <div><div className="eyebrow">Source Operations</div><h1>政府与监管社媒信源</h1><p>Telegram 自动采集；X / Facebook / LinkedIn 展示已核验官方链接</p></div>
      <Badge tone="green"><CheckCircle2 size={11}/> {verified}/{sources.length} 已核验</Badge>
    </div>
    <div className="grid kpi-grid">
      <Card className="card-pad"><div className="kpi-label">官方信源</div><div className="kpi-value">{sources.length}</div><div className="kpi-note">三国政府与 ICT 相关机构</div></Card>
      <Card className="card-pad"><div className="kpi-label">平台覆盖</div><div className="kpi-value">{platformNames.length}</div><div className="kpi-note">{platformNames.join(" · ")}</div></Card>
      <Card className="card-pad"><div className="kpi-label">T1 核心源</div><div className="kpi-value">{t1}</div><div className="kpi-note">通信、监管、投资与政府首脑</div></Card>
      <Card className="card-pad"><div className="kpi-label">Telegram 自动采集</div><div className="kpi-value">{healthyTelegram}/{telegramSources.length}</div><div className="kpi-note">最近核验：{latestCollection || "待首轮采集"}</div></Card>
    </div>
    <Card className="table-card"><div className="table-wrap"><table className="data-table">
      <thead><tr><th>状态</th><th>国家</th><th>类型</th><th>机构 / 人员</th><th>平台账号</th><th>层级</th><th>接入 / 近14天</th></tr></thead>
      <tbody>{sources.map(source => <tr key={source.id}>
        <td><Badge tone={source.status === "采集异常" ? "red" : "green"}><ShieldCheck size={10}/> {source.status}</Badge></td>
        <td>{source.country}</td><td>{source.category}</td>
        <td><strong>{source.name}</strong><div className="section-sub" style={{ marginTop: 3 }}>{source.owner}</div></td>
        <td><a className="social-link" href={source.url} target="_blank" rel="noreferrer"><Radio size={10}/>{source.platform} · @{source.handle}<ExternalLink size={9}/></a><div className="section-sub" style={{ marginTop: 4 }}>{source.verifiedBy}</div></td>
        <td><Badge tone={source.tier === "T1" ? "red" : "default"}>{source.tier}</Badge></td>
        <td>{source.collectionMode === "auto"
          ? (typeof source.posts14d === "number" ? `${source.posts14d} 条 · ${source.collectionDate}` : "待首轮采集")
          : "仅官方链接展示"}</td>
      </tr>)}</tbody>
    </table></div></Card>
  </>;
}

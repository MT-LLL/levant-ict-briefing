"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, Building2, CheckCircle2, CircleDollarSign, Database, ExternalLink, Flag, Globe2, Landmark, Network, ShieldCheck, Ship, Users, UsersRound, Wifi, type LucideIcon } from "lucide-react";
import data from "@/data/country-profiles.json";

type CountryCode = "IRQ" | "JOR" | "LBN";
type View = "ALL" | CountryCode;
type Value = { value: number; year: number; flag?: string };
type Metric = { id: string; group: string; label: string; unit: string; format: string; digits: number; source: string; note: string; values: Partial<Record<CountryCode, Value>> };
type Source = { publisher: string; name: string; url: string; asOf: string };
type Check = { indicator: string; international: string; internationalPeriod: string; local: string; localPeriod: string; status: string; note: string; internationalSource: string; localSource: string };
type Strategy = { title: string; type: string; description: string; highlights: string[]; source: string };

const codes: CountryCode[] = ["IRQ", "JOR", "LBN"];
const metrics = data.metrics as Metric[];
const sources = data.sources as Record<string, Source>;
const checks = data.crossChecks as Record<CountryCode, Check[]>;
const strategies = data.strategies as Record<CountryCode, Strategy[]>;
const groupIcons: Record<string, LucideIcon> = { core: Landmark, ict: Wifi, society: UsersRound, logistics: Ship, fiscal: CircleDollarSign };
const summaryIds = ["population", "gdp", "growth", "internet", "mobile", "reserves"];
const statusClass = (status: string) => status === "双源近似" ? "approximate" : status === "本土补充" ? "supplement" : status.includes("待") ? "pending" : "different";

function getMetric(id: string) {
  return metrics.find(metric => metric.id === id)!;
}

function formatValue(metric: Metric, value?: Value) {
  if (!value) return "—";
  let number = value.value;
  if (metric.format === "millions") number /= 1_000_000;
  if (metric.format === "bnUSD") number /= 1_000_000_000;
  if (metric.format === "land") number /= 10_000;
  return number.toLocaleString("zh-CN", { minimumFractionDigits: metric.digits, maximumFractionDigits: metric.digits });
}

function Period({ value }: { value?: Value }) {
  if (!value) return <span className="profile-period">无公开记录</span>;
  return <span className="profile-period">{value.year}{value.flag && <b title="IMF 估计值">{value.flag}</b>}</span>;
}

function SourceLink({ sourceKey, compact = false }: { sourceKey: string; compact?: boolean }) {
  const source = sources[sourceKey];
  if (!source) return null;
  return <a className={`profile-source ${compact ? "compact" : ""}`} href={source.url} target="_blank" rel="noreferrer" title={`${source.name} · ${source.asOf}`}>
    {compact ? source.publisher : <><strong>{source.publisher}</strong><span>{source.name}</span></>}<ExternalLink size={11}/>
  </a>;
}

function CountryValue({ metric, code }: { metric: Metric; code: CountryCode }) {
  const value = metric.values[code];
  return <div className="profile-matrix-value"><strong>{formatValue(metric, value)}</strong><Period value={value}/></div>;
}

function Matrix({ group }: { group: string }) {
  const rows = metrics.filter(metric => metric.group === group);
  return <div className="profile-table-wrap"><table className="profile-table profile-matrix">
    <thead><tr><th>指标与官方来源</th>{codes.map(code => <th key={code}><span>{data.countries[code].flag}</span>{data.countries[code].name}</th>)}</tr></thead>
    <tbody>{rows.map(metric => <tr key={metric.id}>
      <td><strong>{metric.label}</strong><small>{metric.unit}</small><SourceLink sourceKey={metric.source} compact/>{metric.note && <em>{metric.note}</em>}</td>
      {codes.map(code => <td key={code}><CountryValue metric={metric} code={code}/></td>)}
    </tr>)}</tbody>
  </table></div>;
}

function SingleCountryTable({ group, code }: { group: string; code: CountryCode }) {
  const rows = metrics.filter(metric => metric.group === group);
  return <div className="profile-table-wrap"><table className="profile-table profile-single-table">
    <thead><tr><th>指标</th><th>最新官方值</th><th>披露期</th><th>国际官方来源</th></tr></thead>
    <tbody>{rows.map(metric => {
      const value = metric.values[code];
      return <tr key={metric.id}><td><strong>{metric.label}</strong><small>{metric.unit}</small>{metric.note && <em>{metric.note}</em>}</td><td className="profile-single-value">{formatValue(metric, value)}</td><td><Period value={value}/></td><td><SourceLink sourceKey={metric.source} compact/></td></tr>;
    })}</tbody>
  </table></div>;
}

function GroupSection({ group, view }: { group: typeof data.groups[number]; view: View }) {
  const Icon = groupIcons[group.id] || Database;
  return <section className="profile-section" id={`profile-${group.id}`}>
    <div className="profile-section-head"><div className="profile-section-title"><span><Icon size={17}/></span><div><h2>{group.name}</h2><p>{group.description}</p></div></div><span className="profile-row-count">{metrics.filter(metric => metric.group === group.id).length} 项指标</span></div>
    {view === "ALL" ? <Matrix group={group.id}/> : <SingleCountryTable group={group.id} code={view}/>} 
  </section>;
}

function CountryCards({ choose }: { choose: (code: CountryCode) => void }) {
  return <div className="profile-country-cards">{codes.map(code => {
    const country = data.countries[code];
    const population = getMetric("population").values[code];
    const gdp = getMetric("gdp").values[code];
    const internet = getMetric("internet").values[code];
    const growth = getMetric("growth").values[code];
    return <button key={code} className="profile-country-card" style={{ "--profile-country": country.color } as React.CSSProperties} onClick={() => choose(code)}>
      <div className="profile-country-card-head"><span className="profile-flag">{country.flag}</span><div><h2>{country.name}</h2><p>{code === "IRQ" ? "Iraq" : code === "JOR" ? "Jordan" : "Lebanon"}</p></div><span className="profile-enter">单国画像<ArrowRight size={14}/></span></div>
      <div className="profile-country-main"><span>2025 年名义 GDP</span><strong>{formatValue(getMetric("gdp"), gdp)}<small>十亿美元</small></strong><Period value={gdp}/></div>
      <div className="profile-country-mini"><div><span>人口</span><strong>{formatValue(getMetric("population"), population)} 百万</strong></div><div><span>实际增长</span><strong>{formatValue(getMetric("growth"), growth)}%</strong></div><div><span>互联网使用率</span><strong>{formatValue(getMetric("internet"), internet)}%</strong></div></div>
    </button>;
  })}</div>;
}

function SummaryCards({ code }: { code: CountryCode }) {
  const icons: Record<string, LucideIcon> = { population: Users, gdp: Landmark, growth: Globe2, internet: Network, mobile: Wifi, reserves: ShieldCheck };
  return <div className="profile-summary-grid">{summaryIds.map(id => {
    const metric = getMetric(id), value = metric.values[code], Icon = icons[id];
    return <div className="profile-summary-card" key={id}><div className="profile-summary-label"><span>{metric.label}</span><Icon size={16}/></div><div className="profile-summary-value">{formatValue(metric, value)}<small>{value ? metric.unit : ""}</small></div><div className="profile-summary-foot"><Period value={value}/><SourceLink sourceKey={metric.source} compact/></div></div>;
  })}</div>;
}

function CrossChecks({ code }: { code: CountryCode }) {
  return <section className="profile-section profile-check-section" id="profile-verification">
    <div className="profile-section-head"><div className="profile-section-title"><span><BookOpenCheck size={17}/></span><div><h2>本土政府交叉校验</h2><p>国际值与本土值并列展示，核验结论仅针对当前披露口径</p></div></div><span className="profile-row-count">{checks[code].length} 项记录</span></div>
    <div className="profile-table-wrap"><table className="profile-table profile-check-table"><thead><tr><th>指标</th><th>国际官方值／披露期</th><th>本土官方值／披露期</th><th>核验状态</th><th>口径说明</th></tr></thead><tbody>{checks[code].map(check => <tr key={check.indicator}>
      <td><strong>{check.indicator}</strong></td><td><b>{check.international}</b><small>{check.internationalPeriod}</small><SourceLink sourceKey={check.internationalSource} compact/></td><td><b>{check.local}</b><small>{check.localPeriod}</small><SourceLink sourceKey={check.localSource} compact/></td><td><span className={`profile-check-status status-${statusClass(check.status)}`}>{check.status}</span></td><td><p>{check.note}</p></td></tr>)}</tbody></table></div>
  </section>;
}

function StrategyCards({ code }: { code: CountryCode }) {
  return <section className="profile-section profile-strategy-section"><div className="profile-section-head"><div className="profile-section-title"><span><Flag size={17}/></span><div><h2>国家愿景与数字化战略</h2><p>只引用政府、主管部门或与其共同发布的正式文本</p></div></div></div>
    <div className="profile-strategy-grid">{strategies[code].map((strategy, index) => <article className="profile-strategy-card" key={strategy.title}><div className="profile-strategy-index">0{index + 1}</div><span className="profile-strategy-type">{strategy.type}</span><h3>{strategy.title}</h3><p>{strategy.description}</p><ul>{strategy.highlights.map(item => <li key={item}><CheckCircle2 size={13}/>{item}</li>)}</ul><SourceLink sourceKey={strategy.source}/></article>)}</div>
  </section>;
}

function VerificationOverview({ choose }: { choose: (code: CountryCode) => void }) {
  return <section className="profile-section"><div className="profile-section-head"><div className="profile-section-title"><span><ShieldCheck size={17}/></span><div><h2>双重核验状态</h2><p>进入单国画像可查看国际值、本土值、披露期与完整口径说明</p></div></div></div>
    <div className="profile-verification-grid">{codes.map(code => <button key={code} onClick={() => choose(code)} className="profile-verification-card"><div><span>{data.countries[code].flag}</span><strong>{data.countries[code].name}</strong></div><p>{code === "IRQ" ? "人口与城镇化取得双源近似；ICT 与央行数据保留口径差异。" : code === "JOR" ? "统计局与 TRC 披露较新；年中／年末及人均／总量分别标识。" : "CAS 与 TRA 近期同口径公开序列有限；未核验字段不填值。"}</p><span>{checks[code].length} 项本土核验记录<ArrowRight size={13}/></span></button>)}</div>
  </section>;
}

export function CountryProfile() {
  const [view, setView] = useState<View>("ALL");
  const choose = (code: CountryCode) => { setView(code); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const sourceKeys = useMemo(() => {
    if (view === "ALL") return ["imf", "wb", "iraqCensus", "iraqCmc", "jordanVision", "jordanTrc", "lebanonCas", "lebanonOmsar"];
    const keys = new Set<string>(metrics.map(metric => metric.source));
    checks[view].forEach(check => { keys.add(check.internationalSource); keys.add(check.localSource); });
    strategies[view].forEach(strategy => keys.add(strategy.source));
    return Array.from(keys).filter(key => key.startsWith(view === "IRQ" ? "iraq" : view === "JOR" ? "jordan" : "lebanon") || ["imf", "wb"].includes(key));
  }, [view]);

  return <div className="profile-page">
    <div className="profile-heading"><div><div className="eyebrow">Country Profiles · Dual-source Verification</div><h1><span/>国家画像</h1><p>伊拉克、约旦、黎巴嫩核心指标、ICT 市场、基础设施与国家数字战略</p></div><div className="profile-updated"><Database size={15}/><span>数据核验至<strong>{data.meta.updated}</strong></span></div></div>
    <div className="profile-method"><ShieldCheck size={19}/><div><strong>国际官方数据 × 本土政府披露</strong><p>{data.meta.note} IMF 的 <b>E</b> 表示估计值；“—”表示官方数据集中无公开记录。</p></div></div>
    <div className="profile-tabs" role="tablist" aria-label="国家画像切换">{(["ALL", ...codes] as View[]).map(code => <button key={code} role="tab" aria-selected={view === code} className={view === code ? "active" : ""} onClick={() => setView(code)}>{code === "ALL" ? <><Globe2 size={15}/>三国总览</> : <><span>{data.countries[code].flag}</span>{data.countries[code].name}</>}</button>)}</div>

    {view === "ALL" ? <>
      <CountryCards choose={choose}/>
      {data.groups.map(group => <GroupSection key={group.id} group={group} view={view}/>)}
      <VerificationOverview choose={choose}/>
      <section className="profile-section"><div className="profile-section-head"><div className="profile-section-title"><span><Flag size={17}/></span><div><h2>国家愿景与数字化战略</h2><p>选择国家查看完整战略重点与官方原文</p></div></div></div><div className="profile-strategy-overview">{codes.map(code => <button key={code} onClick={() => choose(code)}><span>{data.countries[code].flag}</span><div><small>{data.countries[code].name}</small><strong>{strategies[code][0].title}</strong><p>{strategies[code][0].description}</p></div><ArrowRight size={16}/></button>)}</div></section>
    </> : <>
      <div className="profile-single-heading"><div><span>{data.countries[view].flag}</span><div><h2>{data.countries[view].name}国家画像</h2><p>最新可得国际官方数据 · 本土政府交叉核验 · 战略原文回溯</p></div></div><button onClick={() => setView("ALL")}><Globe2 size={14}/>返回三国总览</button></div>
      <SummaryCards code={view}/>
      {data.groups.map(group => <GroupSection key={group.id} group={group} view={view}/>)}
      <CrossChecks code={view}/><StrategyCards code={view}/>
    </>}

    <section className="profile-source-section"><div className="profile-section-head"><div className="profile-section-title"><span><Building2 size={17}/></span><div><h2>官方来源入口</h2><p>每项数值均可在上方表格或此处回溯原始发布机构</p></div></div></div><div className="profile-source-grid">{sourceKeys.map(key => <SourceLink key={key} sourceKey={key}/>)}</div></section>
    <div className="profile-footer-note"><Database size={14}/><span>本页不使用估算值冒充官方数据，不插值填补缺失项。人口估计、普查、订阅总量、每百人订阅及不同储备定义均分别保留。</span></div>
  </div>;
}

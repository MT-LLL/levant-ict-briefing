"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, ChevronDown, CircleAlert, Database, ExternalLink, Globe2, Handshake, History, Search, ShieldCheck, X } from "lucide-react";
import data from "@/data/competitors.json";

type CountryCode = "IRQ" | "JOR" | "LBN";
type CountryFilter = "ALL" | CountryCode;
type RecordType = "official" | "partner" | "history";
type Source = { publisher: string; name: string; url: string };
type Vendor = {
  id: string; name: string; english: string; monogram: string; category: string; color: string; summary: string;
  business: { name: string; detail: string }[]; strategy: string[]; businessSources: Source[];
};
type EventRecord = {
  id: string; vendor: string; country: CountryCode; date: string; sortDate: string; recordType: RecordType; evidence: string;
  partner: string; title: string; summary: string; details: string[]; products: string[]; sources: Source[];
};

const vendors = data.vendors as Vendor[];
const records = data.events as EventRecord[];
const countryCodes: CountryCode[] = ["IRQ", "JOR", "LBN"];
const typeLabels: Record<RecordType, string> = { official: "官方披露", partner: "渠道线索", history: "历史案例" };
const typeIcons = { official: BadgeCheck, partner: Handshake, history: History };

function recordClass(type: RecordType) {
  return type === "official" ? "official" : type === "partner" ? "partner" : "history";
}

function SourceLinks({ sources, business = false }: { sources: Source[]; business?: boolean }) {
  return <div className={`competitor-source-links ${business ? "business" : ""}`}>{sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
    <span><strong>{source.publisher}</strong>{source.name}</span><ExternalLink size={13}/>
  </a>)}</div>;
}

function CountryStatus({ vendor, code, choose }: { vendor: string; code: CountryCode; choose?: (code: CountryCode) => void }) {
  const rows = records.filter(record => record.vendor === vendor && record.country === code);
  const current = rows.some(row => row.recordType === "official" && row.sortDate >= "2023-01-01" && !row.date.includes("未标注"));
  const partner = rows.some(row => row.recordType === "partner");
  const undated = rows.some(row => row.date.includes("未标注") && row.recordType === "official");
  const status = current ? "近期官方动态" : undated ? "客户官方案例" : partner ? "渠道公开线索" : rows.length ? "仅历史案例" : "本轮无公开记录";
  const statusKey = current ? "current" : undated ? "undated" : partner ? "channel" : rows.length ? "historic" : "none";
  const content = <><div><span>{data.countries[code].flag}</span><strong>{data.countries[code].name}</strong></div><span className={`coverage-status ${statusKey}`}>{status}</span><p>{rows.length ? `${rows.length} 条收录记录` : "不代表厂商在当地没有业务"}</p>{choose && <ArrowRight size={13}/>}</>;
  return choose ? <button className="competitor-coverage-card" onClick={() => choose(code)}>{content}</button> : <div className="competitor-coverage-card">{content}</div>;
}

function EventCard({ record, expanded, toggle }: { record: EventRecord; expanded: boolean; toggle: () => void }) {
  const vendor = vendors.find(item => item.id === record.vendor)!;
  const country = data.countries[record.country];
  const TypeIcon = typeIcons[record.recordType];
  return <article className={`competitor-event ${expanded ? "expanded" : ""}`}>
    <button className="competitor-event-head" onClick={toggle} aria-expanded={expanded} aria-controls={`detail-${record.id}`}>
      <span className="competitor-event-marker" style={{ "--vendor-color": vendor.color } as React.CSSProperties}><TypeIcon size={15}/></span>
      <span className="competitor-event-main">
        <span className="competitor-event-meta"><b>{country.flag} {country.name}</b><i>{vendor.name}</i><time>{record.date}</time><em className={recordClass(record.recordType)}>{typeLabels[record.recordType]}</em></span>
        <strong>{record.title}</strong>
        <span className="competitor-event-summary">{record.summary}</span>
        <span className="competitor-event-partner"><Building2 size={12}/>{record.partner}</span>
      </span>
      <ChevronDown className="competitor-chevron" size={18}/>
    </button>
    {expanded && <div className="competitor-event-detail" id={`detail-${record.id}`}>
      <div><h4>研判要点</h4><ul>{record.details.map(detail => <li key={detail}>{detail}</li>)}</ul></div>
      <div><h4>产品／能力</h4><div className="competitor-product-tags">{record.products.map(product => <span key={product}>{product}</span>)}</div><p className="competitor-evidence-note"><ShieldCheck size={13}/>证据：{record.evidence}</p></div>
      <SourceLinks sources={record.sources}/>
    </div>}
  </article>;
}

export function CompetitorInsights() {
  const [vendor, setVendor] = useState("ALL");
  const [country, setCountry] = useState<CountryFilter>("ALL");
  const [recordType, setRecordType] = useState<"ALL" | RecordType>("ALL");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter(record => {
      const item = vendors.find(entry => entry.id === record.vendor)!;
      const haystack = [item.name, item.english, record.partner, record.title, record.summary, ...record.products].join(" ").toLowerCase();
      return (vendor === "ALL" || record.vendor === vendor) && (country === "ALL" || record.country === country) && (recordType === "ALL" || record.recordType === recordType) && (!needle || haystack.includes(needle));
    }).sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [vendor, country, recordType, query]);

  const selected = vendors.find(item => item.id === vendor);
  const officialRecent = records.filter(record => record.recordType === "official" && record.sortDate >= "2023-01-01" && !record.date.includes("未标注")).length;
  const chooseVendor = (id: string) => { setVendor(id); setExpanded(new Set()); };
  const reset = () => { setVendor("ALL"); setCountry("ALL"); setRecordType("ALL"); setQuery(""); setExpanded(new Set()); };
  const toggle = (id: string) => setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <div className="competitor-page">
    <div className="competitor-heading"><div><div className="eyebrow">Vendor Intelligence · Evidence Ledger</div><h1><BriefcaseBusiness size={26}/>友商洞察</h1><p>重点厂商在伊拉克、约旦、黎巴嫩的公开动态、客户生态、主营业务与战略方向</p></div><div className="competitor-updated"><Database size={15}/><span>公开资料核验至<strong>{data.meta.updated}</strong></span></div></div>
    <div className="competitor-method"><ShieldCheck size={19}/><div><strong>项目、历史与渠道证据分层</strong><p>{data.meta.note}“本轮无公开记录”仅描述本次检索结果。</p></div></div>
    <div className="competitor-kpis"><div><span>重点厂商</span><strong>{vendors.length}</strong><small>覆盖网络、IT、云与 AI</small></div><div><span>公开记录</span><strong>{records.length}</strong><small>逐条回溯原始来源</small></div><div><span>2023 年以来官方记录</span><strong>{officialRecent}</strong><small>不含渠道自述及未标日期案例</small></div><div><span>覆盖国家</span><strong>3</strong><small>伊拉克 · 约旦 · 黎巴嫩</small></div></div>

    <div className="competitor-workspace">
      <aside className="competitor-filters">
        <div className="competitor-filter-title"><span>筛选工作台</span><button onClick={reset} title="重置筛选"><X size={14}/>重置</button></div>
        <label className="competitor-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索客户、产品或动态" aria-label="搜索友商动态"/>{query && <button onClick={() => setQuery("")} aria-label="清空搜索"><X size={13}/></button>}</label>
        <div className="competitor-filter-group"><h3>国家</h3><div className="competitor-country-filter">{(["ALL", ...countryCodes] as CountryFilter[]).map(code => <button key={code} className={country === code ? "active" : ""} onClick={() => setCountry(code)}>{code === "ALL" ? "三国" : data.countries[code].name}</button>)}</div></div>
        <div className="competitor-filter-group"><h3>记录类型</h3><div className="competitor-type-filter">{(["ALL", "official", "partner", "history"] as const).map(type => <button key={type} className={recordType === type ? "active" : ""} onClick={() => setRecordType(type)}>{type === "ALL" ? "全部记录" : typeLabels[type]}</button>)}</div></div>
        <div className="competitor-filter-group vendor-group"><h3>厂商档案</h3><button className={`competitor-vendor-filter ${vendor === "ALL" ? "active" : ""}`} onClick={() => chooseVendor("ALL")}><span className="vendor-filter-mark all"><Globe2 size={15}/></span><span><strong>全部厂商</strong><small>竞争版图与动态</small></span><b>{records.length}</b></button>{vendors.map(item => <button key={item.id} className={`competitor-vendor-filter ${vendor === item.id ? "active" : ""}`} onClick={() => chooseVendor(item.id)}><span className="vendor-filter-mark" style={{ background: item.color }}>{item.monogram}</span><span><strong>{item.name}</strong><small>{item.category}</small></span><b>{records.filter(record => record.vendor === item.id).length}</b></button>)}</div>
        <div className="competitor-filter-legend"><span><i className="official"/>官方披露</span><span><i className="partner"/>渠道线索</span><span><i className="history"/>历史案例</span></div>
      </aside>

      <div className="competitor-content">
        {!selected && <section className="competitor-landscape"><div className="competitor-section-title"><div><h2>厂商竞争版图</h2><p>选择厂商查看主营业务、三国覆盖和完整证据链</p></div><span>6 家重点厂商</span></div><div className="competitor-vendor-grid">{vendors.map(item => {
          const rows = records.filter(record => record.vendor === item.id);
          const latest = [...rows].sort((a, b) => b.sortDate.localeCompare(a.sortDate))[0];
          return <button key={item.id} className="competitor-vendor-card" onClick={() => chooseVendor(item.id)} style={{ "--vendor-color": item.color } as React.CSSProperties}><div className="competitor-vendor-card-head"><span>{item.monogram}</span><div><h3>{item.name}</h3><p>{item.english}</p></div><ArrowRight size={16}/></div><span className="competitor-vendor-category">{item.category}</span><p className="competitor-vendor-summary">{item.summary}</p><div className="competitor-card-countries">{countryCodes.map(code => <span key={code} className={rows.some(row => row.country === code) ? "covered" : ""}>{data.countries[code].flag} {data.countries[code].name}</span>)}</div><div className="competitor-vendor-card-foot"><span>{rows.length} 条公开记录</span><span>{latest ? `最近：${latest.date}` : "仅全球业务画像"}</span></div></button>;
        })}</div></section>}

        {selected && <section className="competitor-profile" style={{ "--vendor-color": selected.color } as React.CSSProperties}>
          <div className="competitor-profile-head"><div className="competitor-profile-mark">{selected.monogram}</div><div><span>{selected.category}</span><h2>{selected.name}</h2><p>{selected.english}</p></div><button onClick={() => chooseVendor("ALL")}>返回厂商版图<ArrowRight size={14}/></button></div>
          <p className="competitor-profile-summary">{selected.summary}</p>
          <div className="competitor-strategy-tags">{selected.strategy.map(item => <span key={item}>{item}</span>)}</div>
          <div className="competitor-business-grid">{selected.business.map((item, index) => <div key={item.name}><span>0{index + 1}</span><h3>{item.name}</h3><p>{item.detail}</p></div>)}</div>
          <SourceLinks sources={selected.businessSources} business/>
          <div className="competitor-coverage"><h3>三国公开覆盖状态</h3><div>{countryCodes.map(code => <CountryStatus key={code} vendor={selected.id} code={code} choose={setCountry}/>)}</div></div>
        </section>}

        <section className="competitor-records"><div className="competitor-section-title"><div><h2>{selected ? `${selected.name}公开动态` : "三国厂商动态"}</h2><p>{country === "ALL" ? "伊拉克、约旦、黎巴嫩" : data.countries[country].name} · {recordType === "ALL" ? "全部记录类型" : typeLabels[recordType]}</p></div><span>{filtered.length} 条结果</span></div>
          <div className="competitor-event-list">{filtered.map(record => <EventCard key={record.id} record={record} expanded={expanded.has(record.id)} toggle={() => toggle(record.id)}/>)}</div>
          {!filtered.length && <div className="competitor-empty"><CircleAlert size={24}/><h3>当前条件下没有已收录记录</h3><p>这不代表厂商在当地没有业务；可放宽国家或记录类型筛选，或查看其他厂商。</p><button onClick={reset}>清除全部筛选</button></div>}
        </section>
      </div>
    </div>
    <div className="competitor-footer"><CalendarDays size={14}/><span>披露日期优先采用原始页面日期；未标日期的客户或渠道页面明确标识，不按检索日期冒充发布时间。</span></div>
  </div>;
}

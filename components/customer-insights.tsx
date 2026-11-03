"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarDays, ChevronDown, CircleDollarSign, Database, ExternalLink, Landmark, Lightbulb, Search, ShieldCheck, Target, TrendingUp, UsersRound, X } from "lucide-react";
import data from "@/data/customers.json";

type CountryCode = "IRQ" | "JOR" | "LBN";
type CountryFilter = "ALL" | CountryCode;
type Source = { publisher: string; name: string; url: string; date: string };
type Dynamic = { date: string; country: CountryCode; title: string; detail: string; sources: string[] };
type Category = {
  id: string; name: string; summary: string; customers: string[]; foundation: string; budget: string;
  strategy: string; operation: string; value: string[]; sources: string[]; dynamics: Dynamic[];
};

const categories = data.categories as Category[];
const sources = data.sources as Record<string, Source>;
const countryCodes: CountryCode[] = ["IRQ", "JOR", "LBN"];

function SourceLinks({ ids }: { ids: string[] }) {
  return <div className="customer-source-links">{ids.map(id => {
    const source = sources[id];
    return <a key={id} href={source.url} target="_blank" rel="noreferrer">
      <span><strong>{source.publisher}</strong>{source.name}<small>{source.date}</small></span><ExternalLink size={13}/>
    </a>;
  })}</div>;
}

function DetailSection({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return <section className="customer-detail-section"><h3><Icon size={16}/>{title}</h3>{children}</section>;
}

export function CustomerInsights() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<CountryFilter>("ALL");
  const [category, setCategory] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories.filter(item => {
      if (category !== "ALL" && item.id !== category) return false;
      if (!needle) return true;
      const haystack = [item.name, item.summary, ...item.customers, item.foundation, item.budget, item.strategy, item.operation, ...item.value, ...item.dynamics.flatMap(event => [event.title, event.detail])].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, category]);

  const dynamicCount = categories.reduce((sum, item) => sum + item.dynamics.length, 0);
  const dynamicsFor = (item: Category) => item.dynamics.filter(event => country === "ALL" || event.country === country);
  const reset = () => { setQuery(""); setCountry("ALL"); setCategory("ALL"); setExpanded(null); };
  const chooseCategory = (id: string) => { setCategory(id); setExpanded(null); };

  return <div className="customer-page">
    <div className="customer-heading"><div><div className="eyebrow">Customer Intelligence · Sector Ledger</div><h1><UsersRound size={26}/>客户洞察</h1><p>按客户行业梳理伊拉克、约旦、黎巴嫩的主营组织、预算战略、近期动态、经营观察与价值建议</p></div><div className="customer-updated"><Database size={15}/><span>公开资料核验至<strong>{data.meta.updated}</strong></span></div></div>
    <div className="customer-method"><ShieldCheck size={19}/><p>{data.meta.note}</p></div>
    <div className="customer-kpis"><div><span>客户分类</span><strong>{categories.length}</strong><small>覆盖图片中的行业体系</small></div><div><span>覆盖国家</span><strong>3</strong><small>伊拉克 · 约旦 · 黎巴嫩</small></div><div><span>公开动态</span><strong>{dynamicCount}</strong><small>逐条标注国家与披露日期</small></div><div><span>核验来源</span><strong>{Object.keys(sources).length}</strong><small>官方及可信机构资料</small></div></div>

    <div className="customer-controls">
      <label className="customer-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索客户、战略、动态或产品场景" aria-label="搜索客户洞察"/>{query && <button onClick={() => setQuery("")} aria-label="清空搜索"><X size={14}/></button>}</label>
      <div className="customer-country-filter" aria-label="国家筛选">{(["ALL", ...countryCodes] as CountryFilter[]).map(code => <button key={code} className={country === code ? "active" : ""} onClick={() => setCountry(code)}>{code === "ALL" ? "三国" : `${data.countries[code].flag} ${data.countries[code].name}`}</button>)}</div>
      <div className="customer-category-filter" aria-label="客户分类筛选"><button className={category === "ALL" ? "active" : ""} onClick={() => chooseCategory("ALL")}>全部 <span>{categories.length}</span></button>{categories.map(item => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => chooseCategory(item.id)}>{item.name}<span>{dynamicsFor(item).length}</span></button>)}</div>
    </div>

    <div className="customer-ledger">
      <div className="customer-ledger-title"><div><h2>客户分类情报矩阵</h2><p>点击一行展开预算、战略、动态、经营与建议的完整证据链</p></div><span>{visible.length} 类结果</span></div>
      <div className="customer-table-head"><span>分类</span><span>基础</span><span>预算／战略</span><span>最新动态</span><span>经营</span><span>价值</span><span/></div>
      <div className="customer-table-body">{visible.map(item => {
        const events = dynamicsFor(item);
        const latest = events[0];
        const open = expanded === item.id;
        return <article key={item.id} className={`customer-record ${open ? "expanded" : ""}`}>
          <button className="customer-row" onClick={() => setExpanded(open ? null : item.id)} aria-expanded={open} aria-controls={`customer-${item.id}`}>
            <span className="customer-category-cell" data-label="分类"><strong>{item.name}</strong><small>{item.summary}</small></span>
            <span className="customer-cell" data-label="基础"><b>主营／组织</b>{item.foundation}</span>
            <span className="customer-cell" data-label="预算／战略"><b>预算／战略</b>{item.strategy}</span>
            <span className="customer-cell customer-latest" data-label="最新动态"><b>{latest ? latest.date : "披露边界"}</b>{latest ? latest.title : "该国本轮未检索到分类近期动态"}</span>
            <span className="customer-cell" data-label="经营"><b>运营／市场</b>{item.operation}</span>
            <span className="customer-cell" data-label="价值"><b>洞察／建议</b>{item.value[0]}</span>
            <ChevronDown className="customer-chevron" size={18}/>
          </button>
          {open && <div className="customer-detail" id={`customer-${item.id}`}>
            <div className="customer-account-list"><h3><Building2 size={16}/>客户对象</h3><ul>{item.customers.map(customer => <li key={customer}>{customer}</li>)}</ul></div>
            <div className="customer-detail-grid">
              <DetailSection icon={Landmark} title="基础｜主营与组织"><p>{item.foundation}</p></DetailSection>
              <DetailSection icon={CircleDollarSign} title="预算｜公开披露边界"><p>{item.budget}</p></DetailSection>
              <DetailSection icon={Target} title="战略｜投资与政策方向"><p>{item.strategy}</p></DetailSection>
              <DetailSection icon={TrendingUp} title="经营｜运营与市场观察"><p>{item.operation}</p></DetailSection>
            </div>
            <DetailSection icon={CalendarDays} title={`动态｜${country === "ALL" ? "三国" : data.countries[country].name}公开记录`}>
              {events.length ? <div className="customer-dynamic-list">{events.map(event => <div key={`${event.date}-${event.title}`}><div className="customer-dynamic-meta"><span>{data.countries[event.country].flag} {data.countries[event.country].name}</span><time>{event.date}</time></div><h4>{event.title}</h4><p>{event.detail}</p><SourceLinks ids={event.sources}/></div>)}</div> : <div className="customer-inline-empty">本轮未检索到该国的分类近期动态，不代表当地没有相关业务或项目。</div>}
            </DetailSection>
            <DetailSection icon={Lightbulb} title="价值｜我方研判与建议"><ul className="customer-value-list">{item.value.map(value => <li key={value}>{value}</li>)}</ul></DetailSection>
            <div className="customer-general-sources"><h3>分类基础来源</h3><SourceLinks ids={item.sources}/></div>
          </div>}
        </article>;
      })}</div>
      {!visible.length && <div className="customer-empty"><Search size={24}/><h3>未找到匹配的客户分类</h3><p>可更换关键词或清除分类筛选。</p><button onClick={reset}>清除全部筛选</button></div>}
    </div>
    <div className="customer-footer"><CalendarDays size={14}/><span>预算、规划投资与项目融资严格区分；未公开字段明确留白，建议内容不作为客户官方立场。</span></div>
  </div>;
}

"use client";

import { useMemo, useState } from "react";
import { Activity, BarChart3, BookOpen, ChevronDown, CircleDollarSign, Container, Database, ExternalLink, Fuel, Globe2, Landmark, LineChart as LineIcon, Search, Ship, TrendingUp, X, type LucideIcon } from "lucide-react";
import data from "@/data/macro.json";
import { MacroBarChart, MacroLineChart } from "@/components/macro-charts";

type Source = { publisher: string; name: string; url: string; asOf: string };
type WBRow = { country: string; year: number; value: number };
type Module = { id: string; title: string; description: string; category: string; status: "已接入" | "部分数据" | "口径说明"; icon: LucideIcon };

const imf = data.imf as Record<string, Record<string, Record<string, number>>>;
const wb = data.worldBank as Record<string, WBRow[]>;
const sources = data.sources as Record<string, Source>;
const countryCodes = ["IRQ", "JOR", "LBN"];
const colors = { IRQ: data.countries.IRQ.color, JOR: data.countries.JOR.color, LBN: data.countries.LBN.color };
const modules: Module[] = [
  { id: "overview", title: "国家宏观总览（7）", description: "经济规模、增长、物价、债务、外部账户、就业与人口的最新可比快照。", category: "宏观经济", status: "已接入", icon: Globe2 },
  { id: "oecd-snapshot", title: "OECD 基准数据（2023 快照）", description: "三国并非 OECD 成员国；以 2023 年 IMF／世界银行数据作替代参考。", category: "宏观经济", status: "口径说明", icon: Database },
  { id: "gdp-path", title: "OECD 基线：实际 GDP 增速路径", description: "以 IMF WEO 基线替代 OECD 路径，明确区分历史、估计和预测年份。", category: "宏观经济", status: "已接入", icon: TrendingUp },
  { id: "structural", title: "国家固定及结构性指标", description: "国土、人口、城镇化、移动与固定宽带、航空客运等结构性指标。", category: "国家结构", status: "已接入", icon: Landmark },
  { id: "hormuz", title: "霍尔木兹海峡通航趋势", description: "展示 EIA 可公开获取的油流量基准；不等同于周度船舶 AIS 过境量。", category: "能源与航运", status: "部分数据", icon: Ship },
  { id: "gulf", title: "波斯湾态势与运价指数", description: "海峡通行暴露、绕行能力与高频运价数据的公开可用性说明。", category: "能源与航运", status: "部分数据", icon: Activity },
  { id: "prices", title: "国际油价与天然气价格", description: "布伦特原油与 Henry Hub 天然气月度均价，截至 2026 年 10 月。", category: "能源与航运", status: "已接入", icon: Fuel },
  { id: "production", title: "各国油气产销量", description: "伊拉克生产、出口和炼油能力；其他国家不填造非同口径产量。", category: "能源与财政", status: "部分数据", icon: Fuel },
  { id: "fiscal", title: "油气与非油财政收入", description: "伊拉克中央政府油气与非油收入，列示本币规模及 GDP 占比。", category: "能源与财政", status: "部分数据", icon: CircleDollarSign },
  { id: "swf", title: "各国主权财富基金", description: "仅列可比的公开 AUM；三国首版均不以石油收入或央行储备冒充基金规模。", category: "资本市场", status: "口径说明", icon: Landmark },
  { id: "stocks", title: "各国股票市场", description: "上市公司市值与数量的年度序列，并链接三国官方交易所。", category: "资本市场", status: "部分数据", icon: BarChart3 },
  { id: "operators-annual", title: "运营商年度经营指标", description: "Zain 伊拉克、Zain 约旦与 Orange 约旦 2025 年本国运营实体披露。", category: "ICT 运营商", status: "部分数据", icon: BarChart3 },
  { id: "operators-quarterly", title: "运营商季度财务", description: "Zain 伊拉克与约旦 2026 Q2／H1 财务和运营数据。", category: "ICT 运营商", status: "部分数据", icon: LineIcon },
  { id: "ports", title: "港口吞吐量—周度趋势", description: "公开同口径周度序列暂缺，首版以世界银行年度集装箱吞吐量替代。", category: "能源与航运", status: "部分数据", icon: Container },
  { id: "methodology", title: "数据口径说明", description: "历史值、估计值、预测值、币种、缺失值和运营实体边界的统一说明。", category: "说明与来源", status: "口径说明", icon: BookOpen },
  { id: "sources", title: "宏观数据信息来源", description: "集中列出数据集、发布机构、数据截点与原始链接，便于逐项回溯。", category: "说明与来源", status: "已接入", icon: Database }
];

const fmt = (value: number | null | undefined, digits = 1) => value === null || value === undefined ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const macroValue = (indicator: string, country: string, year: number) => imf[indicator]?.[country]?.[String(year)] ?? null;
const wbValue = (indicator: string, country: string, year?: number) => {
  const rows = (wb[indicator] || []).filter(row => row.country === country && (!year || row.year === year));
  return rows.sort((a, b) => b.year - a.year)[0] || null;
};
const wbRows = (indicator: string) => (wb[indicator] || []).slice().sort((a, b) => a.year - b.year);

function DataTable({ headers, rows, caption }: { headers: string[]; rows: (string | number | null)[][]; caption?: string }) {
  return <div className="macro-table-wrap"><table className="macro-table">{caption && <caption>{caption}</caption>}<thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell ?? "—"}</td>)}</tr>)}</tbody></table></div>;
}

function SourceLinks({ keys }: { keys: string[] }) {
  return <div className="macro-source-links"><span>数据来源</span><div>{keys.map(key => {
    const source = sources[key];
    if (!source) return null;
    return <a key={key} href={source.url} target="_blank" rel="noreferrer">{source.publisher}<ExternalLink size={11}/><small>{source.asOf}</small></a>;
  })}</div></div>;
}

function Note({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "amber" }) {
  return <div className={`macro-note ${tone}`}>{children}</div>;
}

function DetailContent({ id }: { id: string }) {
  if (id === "overview" || id === "oecd-snapshot") {
    const year = id === "overview" ? 2025 : 2023;
    const definitions = [
      ["nominal", "名义 GDP", "十亿美元", 1], ["growth", "实际 GDP 增速", "%", 1], ["inflation", "CPI 通胀", "%", 1],
      ["debt", "政府总债务／GDP", "%", 1], ["currentAccount", "经常账户／GDP", "%", 1], ["unemployment", "失业率", "%", 1]
    ] as const;
    const rows = definitions.map(([key, label, unit, digits]) => [label + `（${unit}）`, ...countryCodes.map(code => fmt(macroValue(key, code, year), digits))]);
    rows.push(["人口（百万人）", ...countryCodes.map(code => { const row = wbValue("population", code, year); return row ? fmt(row.value / 1e6, 2) : "—"; })]);
    return <>
      {id === "oecd-snapshot" && <Note tone="amber">伊拉克、约旦、黎巴嫩均非 OECD 成员国，OECD Data Explorer 未提供适用的三国基准序列。本模块保留原栏目名称，但表格使用 IMF WEO 与世界银行 2023 年数据，不将其称为 OECD 数据。</Note>}
      {id === "overview" && <Note>宏观指标为 2025 年 IMF WEO 估计值；人口为世界银行 2025 年数据。伊拉克失业率缺失，不以其他年份回填。</Note>}
      <DataTable headers={["指标", "伊拉克", "约旦", "黎巴嫩"]} rows={rows} caption={`${year} 年七项宏观参考指标`}/>
      <SourceLinks keys={id === "overview" ? ["imf", "wb"] : ["oecd", "imf", "wb"]}/>
    </>;
  }
  if (id === "gdp-path") {
    const labels = Array.from({ length: 7 }, (_, i) => String(2023 + i));
    return <>
      <Note>2023—2024 为历史值，2025 为估计值，2026 年起为 IMF WEO 预测。黎巴嫩 2026 年后没有本次 WEO 序列，保留为空值。</Note>
      <MacroLineChart labels={labels} unit="%" forecastFrom="2026" series={countryCodes.map(code => ({ name: data.countries[code as keyof typeof data.countries].name, color: colors[code as keyof typeof colors], values: labels.map(year => macroValue("growth", code, Number(year))) }))}/>
      <DataTable headers={["年份", "数据属性", "伊拉克", "约旦", "黎巴嫩"]} rows={labels.map(year => [year, Number(year) <= 2024 ? "历史" : Number(year) === 2025 ? "估计" : "预测", ...countryCodes.map(code => fmt(macroValue("growth", code, Number(year)), 1))])}/>
      <SourceLinks keys={["imf", "oecd"]}/>
    </>;
  }
  if (id === "structural") {
    const rows = countryCodes.map(code => {
      const land = wbValue("land", code), urban = wbValue("urban", code), mobile = wbValue("mobile", code), broadband = wbValue("broadband", code), air = wbValue("air", code), population = wbValue("population", code);
      return [data.countries[code as keyof typeof data.countries].name, land ? `${fmt(land.value, 0)}（${land.year}）` : "—", population ? fmt(population.value / 1e6, 2) : "—", urban ? `${fmt(urban.value, 1)}（${urban.year}）` : "—", mobile ? `${fmt(mobile.value, 1)}（${mobile.year}）` : "—", broadband ? `${fmt(broadband.value, 1)}（${broadband.year}）` : "—", air ? `${fmt(air.value / 1e6, 2)}（${air.year}）` : "—"];
    });
    const labels = Array.from({ length: 7 }, (_, i) => String(2019 + i));
    return <>
      <DataTable headers={["国家", "国土面积（km²）", "人口（百万）", "城镇化率（%）", "移动订阅／百人", "固定宽带／百人", "航空客运（百万）"]} rows={rows}/>
      <h3 className="macro-subtitle">人口规模变化</h3><MacroLineChart labels={labels} unit="百万人" series={countryCodes.map(code => ({ name: data.countries[code as keyof typeof data.countries].name, color: colors[code as keyof typeof colors], values: labels.map(year => { const row = wbValue("population", code, Number(year)); return row ? row.value / 1e6 : null; }) }))}/>
      <Note>不同指标的最新年份不同，表内逐项标注。移动订阅数可能包含多卡用户，不能直接理解为独立用户数。</Note><SourceLinks keys={["wb"]}/>
    </>;
  }
  if (id === "hormuz") {
    return <>
      <Note tone="amber">本模块采用油流量而非船舶艘次：EIA 的公开基准可回溯，但不能替代周度 AIS 通航统计。2025 上半年值来自 EIA 2026 年更新的海峡专题。</Note>
      <MacroBarChart items={data.hormuz.map(row => ({ label: row.period, value: row.oilFlow, note: row.basis }))} unit="百万桶/日" color="#b7791f"/>
      <DataTable headers={["时期", "原油、凝析油及成品油流量", "统计口径"]} rows={data.hormuz.map(row => [row.period, `${fmt(row.oilFlow, 1)} 百万桶/日`, row.basis])}/>
      <SourceLinks keys={["eia", "eia2025"]}/>
    </>;
  }
  if (id === "gulf") {
    return <>
      <DataTable headers={["关键暴露／替代能力", "数值", "单位"]} rows={data.gulfInfrastructure.map(row => [row.item, row.value, row.unit])}/>
      <h3 className="macro-subtitle">高频数据接入状态</h3><DataTable headers={["数据项", "首版状态", "处理方式"]} rows={[["波斯湾周度船舶态势", "未接入", "可后续接入 IMF PortWatch；不以零散新闻推算周度值"], ["油轮／集装箱运价指数", "未接入", "Baltic Exchange 完整历史序列需授权，仅保留官方入口"], ["海峡油流量与绕行能力", "已接入", "采用 EIA 公开基准"]]}/>
      <SourceLinks keys={["eia2025", "portwatch", "baltic"]}/>
    </>;
  }
  if (id === "prices") {
    const chartRows = data.energyPrices.slice(-25);
    return <>
      <Note>两种品种单位不同，图中仅比较各自价格轨迹，不计算价差。月度值由每日现货价格算术平均。</Note>
      <MacroLineChart labels={chartRows.map(row => row.date)} series={[{ name: "布伦特原油（美元/桶）", color: "#b7791f", values: chartRows.map(row => row.brent) }, { name: "Henry Hub 天然气（美元/百万英热单位）", color: "#2563eb", values: chartRows.map(row => row.henryHub) }]}/>
      <DataTable headers={["月份", "布伦特（美元/桶）", "Henry Hub（美元/百万英热单位）"]} rows={data.energyPrices.slice(-6).reverse().map(row => [row.date, fmt(row.brent, 2), fmt(row.henryHub, 2)])}/>
      <SourceLinks keys={["fredBrent", "fredGas"]}/>
    </>;
  }
  if (id === "production") {
    return <>
      <h3 className="macro-subtitle">伊拉克油气生产与出口（2024）</h3><MacroBarChart items={data.iraqEnergy.map(row => ({ label: row.metric, value: row.value }))} unit="百万桶/日" color="#b7791f"/>
      <DataTable headers={["国家", "原油／天然气产销量", "可核验参考指标"]} rows={countryCodes.map(code => {
        const oil = wbValue("oilRent", code), gas = wbValue("gasRent", code);
        const reference = oil || gas ? `石油租金 ${oil ? fmt(oil.value, 2) : "—"}%、天然气租金 ${gas ? fmt(gas.value, 2) : "—"}（占 GDP，2021）` : "—";
        return [data.countries[code as keyof typeof data.countries].name, code === "IRQ" ? "产量 3.86；出口 3.40 百万桶/日（2024）" : "未获取同口径公开序列", reference];
      })}/>
      <Note tone="amber">资源租金占 GDP 是经济结构指标，不等于油气产量、销量或财政收入。约旦、黎巴嫩不以零值代替未披露的产销量。</Note><SourceLinks keys={["imfIraq", "wb"]}/>
    </>;
  }
  if (id === "fiscal") {
    return <>
      <Note>伊拉克中央政府口径；2024 为 IMF 估计值。单位为万亿伊拉克第纳尔，GDP 占比采用同一报告口径。</Note>
      <DataTable headers={["年份", "总收入", "油气收入", "非油收入", "总收入／GDP", "油气／GDP", "非油／GDP"]} rows={data.iraqFiscal.map(row => [row.year, fmt(row.revenue, 1), fmt(row.oil, 1), fmt(row.nonOil, 1), `${fmt(row.revenuePct, 1)}%`, `${fmt(row.oilPct, 1)}%`, `${fmt(row.nonOilPct, 1)}%`])}/>
      <MacroBarChart items={data.iraqFiscal.flatMap(row => [{ label: `${row.year} 油气收入`, value: row.oil }, { label: `${row.year} 非油收入`, value: row.nonOil }])} unit="万亿 IQD" color="#0b5c78"/>
      <Note tone="amber">约旦、黎巴嫩首版未获取与伊拉克完全同口径的油气／非油财政拆分，因此不合并排序。</Note><SourceLinks keys={["imfIraq"]}/>
    </>;
  }
  if (id === "swf") {
    return <>
      <Note tone="amber">首版未找到三国可按同一披露口径比较的主权财富基金 AUM 公开序列。央行外汇储备、石油出口收入和财政结余均不等同于主权财富基金资产。</Note>
      <DataTable headers={["国家", "可比 AUM", "本页处理", "官方核验入口"]} rows={[["伊拉克", "—", "不将 Development Fund for Iraq 或央行储备折算为 SWF AUM", "伊拉克中央银行"], ["约旦", "—", "不填造基金规模", "约旦中央银行"], ["黎巴嫩", "—", "不填造基金规模", "黎巴嫩中央银行"]]}/>
      <SourceLinks keys={["cbi", "cbj", "bdl"]}/>
    </>;
  }
  if (id === "stocks") {
    const years = Array.from({ length: 7 }, (_, i) => 2019 + i);
    const latestRows = countryCodes.map(code => {
      const cap = wbValue("marketCap", code), listed = wbValue("listed", code);
      return [data.countries[code as keyof typeof data.countries].name, cap ? `${fmt(cap.value / 1e9, 2)}（${cap.year}）` : "—", listed ? `${fmt(listed.value, 0)}（${listed.year}）` : "—", code === "IRQ" ? "Iraq Stock Exchange" : code === "JOR" ? "Amman Stock Exchange" : "Beirut Stock Exchange"];
    });
    return <>
      <MacroLineChart labels={years.map(String)} unit="十亿美元" series={countryCodes.map(code => ({ name: data.countries[code as keyof typeof data.countries].name, color: colors[code as keyof typeof colors], values: years.map(year => { const row = wbValue("marketCap", code, year); return row ? row.value / 1e9 : null; }) }))}/>
      <DataTable headers={["国家", "上市公司市值（十亿美元）", "上市公司数量", "官方交易所"]} rows={latestRows}/>
      <Note>年度指标来自世界银行，最新年份因国家而异；伊拉克在该数据集中无对应记录。年度市值不代表当前交易日点位。</Note><SourceLinks keys={["wb", "isx", "ase", "bse"]}/>
    </>;
  }
  if (id === "operators-annual") {
    return <>
      <DataTable headers={["国家", "运营实体", "年份", "收入", "EBITDA", "净利润", "客户数", "资本开支"]} rows={data.operatorsAnnual.map(row => [data.countries[row.country as keyof typeof data.countries].name, row.operator, row.year, row.revenue, row.ebitda, row.netIncome, row.customers, row.capex])}/>
      <Note>各行保留披露币种，美元与约旦第纳尔不直接汇总。Zain 数据为本国运营实体，不是 Zain 集团合并数；Orange 客户数包含全业务。</Note><SourceLinks keys={["zainAnnual", "orangeAnnual", "asiacell"]}/>
    </>;
  }
  if (id === "operators-quarterly") {
    return <>
      <DataTable headers={["国家", "运营实体", "期间", "收入", "EBITDA", "净利润", "客户数", "补充披露"]} rows={data.operatorsQuarterly.map(row => [data.countries[row.country as keyof typeof data.countries].name, row.operator, row.period, row.revenue, row.ebitda, row.netIncome, row.customers, row.note])}/>
      <Note tone="amber">Q2 为单季度，H1 为上半年累计，不可直接横向相加。首版仅纳入已核验的 Zain 本国运营实体披露，Orange 约旦及其他运营商季度值留空。</Note><SourceLinks keys={["zainQuarter"]}/>
    </>;
  }
  if (id === "ports") {
    const years = Array.from({ length: 6 }, (_, i) => 2019 + i);
    return <>
      <Note tone="amber">世界银行当前提供的是年度集装箱吞吐量，不是周度趋势。黎巴嫩 2023 年及伊拉克 2020—2024 年为空值，不做插值。</Note>
      <MacroLineChart labels={years.map(String)} unit="百万 TEU" series={countryCodes.map(code => ({ name: data.countries[code as keyof typeof data.countries].name, color: colors[code as keyof typeof colors], values: years.map(year => { const row = wbValue("port", code, year); return row ? row.value / 1e6 : null; }) }))}/>
      <DataTable headers={["国家", "年份", "集装箱吞吐量（TEU）"]} rows={wbRows("port").slice().reverse().map(row => [data.countries[row.country as keyof typeof data.countries].name, row.year, fmt(row.value, 0)])}/>
      <SourceLinks keys={["wb", "portwatch"]}/>
    </>;
  }
  if (id === "methodology") {
    return <>
      <DataTable headers={["口径", "本页处理规则"]} rows={[["历史／估计／预测", "WEO 2023—2024 标为历史，2025 标为估计，2026 年及以后标为预测；图表预测段使用虚线。"], ["缺失值", "统一显示“—”；不以前值填充、不插值，也不把零值当作缺失值。"], ["频率", "年度、月度、季度与半年数据分别标识；周度数据不可用时明确采用年度替代。"], ["币种与单位", "运营商披露保留原币种；宏观金额按十亿美元、万亿 IQD 等单位分别展示。"], ["实体边界", "集团合并数据不与本国运营实体混用；政府机构、运营公司和交易所分别核验。"], ["OECD 栏目", "三国非 OECD 成员国，相关模块只作栏目映射，实际数值来自 IMF 或世界银行。"], ["来源回溯", "每个模块底部列出发布机构、数据截点和原始链接；授权数据只列入口，不复制序列。"]]}/>
      <SourceLinks keys={["imf", "wb", "fredBrent"]}/>
    </>;
  }
  if (id === "sources") {
    const rows = Object.values(sources).map(source => [source.publisher, source.name, source.asOf, source.url]);
    return <>
      <DataTable headers={["发布机构", "数据集／披露文件", "数据截点", "原始链接"]} rows={rows.map(row => [...row.slice(0, 3), "打开来源 ↗"])}/>
      <div className="macro-source-directory">{Object.entries(sources).map(([key, source]) => <a key={key} href={source.url} target="_blank" rel="noreferrer"><strong>{source.publisher}</strong><span>{source.name}</span><small>{source.asOf}<ExternalLink size={11}/></small></a>)}</div>
    </>;
  }
  return null;
}

export function MacroDashboard() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>("overview");
  const filtered = useMemo(() => modules.filter(module => `${module.title}${module.description}${module.category}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const active = modules.find(module => module.id === selected);
  const choose = (id: string) => {
    if (selected === id) { setSelected(null); return; }
    setSelected(id);
    window.setTimeout(() => document.getElementById("macro-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  return <div className="macro-page">
    <div className="macro-heading"><div><div className="eyebrow">Country Macro Intelligence</div><h1><span/>国家宏观总览</h1><p>伊拉克、约旦、黎巴嫩宏观、能源、航运、资本市场与运营商数据</p></div><div className="macro-updated"><Database size={15}/><span>数据核验至<strong>{data.meta.updated}</strong></span></div></div>
    <div className="macro-search"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索宏观模块、指标或分类…" aria-label="搜索宏观模块"/>{query && <button onClick={() => setQuery("")} aria-label="清空搜索"><X size={16}/></button>}<span>{filtered.length} / 16</span></div>
    <div className="macro-board-head"><strong>本页模块</strong><span>点击卡片展开图表、数据表及来源</span></div>
    {filtered.length ? <div className="macro-module-grid">{filtered.map(module => {
      const Icon = module.icon, open = selected === module.id;
      return <button key={module.id} className={`macro-module ${open ? "open" : ""} ${module.id === "sources" ? "source-module" : ""}`} onClick={() => choose(module.id)} aria-expanded={open} aria-controls="macro-detail">
        <div className="macro-module-top"><span className="macro-module-icon"><Icon size={16}/></span><span className={`macro-status ${module.status === "已接入" ? "ok" : module.status === "部分数据" ? "partial" : "note"}`}>{module.status}</span></div>
        <h2>{module.title}</h2><p>{module.description}</p><div className="macro-module-foot"><span>{module.category}</span><span>{open ? "收起" : "展开详情"}<ChevronDown size={13}/></span></div>
      </button>;
    })}</div> : <div className="macro-no-result">未找到匹配模块，请更换关键词。<button onClick={() => setQuery("")}>清空搜索</button></div>}
    {active && <section id="macro-detail" className="macro-detail" aria-live="polite"><div className="macro-detail-head"><div><span className="macro-detail-category">{active.category}</span><h2>{active.title}</h2><p>{active.description}</p></div><button onClick={() => setSelected(null)} aria-label="收起详情"><X size={18}/></button></div><div className="macro-detail-body"><DetailContent id={active.id}/></div></section>}
  </div>;
}

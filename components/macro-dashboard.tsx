"use client";

import { useMemo, useState } from "react";
import { Activity, BarChart3, BookOpen, ChevronDown, CircleDollarSign, Container, Database, ExternalLink, Fuel, Globe2, Landmark, LineChart as LineIcon, Search, Ship, TrendingUp, X, type LucideIcon } from "lucide-react";
import data from "@/data/macro.json";
import { MacroBarChart, MacroLineChart } from "@/components/macro-charts";
import { HormuzMonitor } from "@/components/hormuz-monitor";
import { PortsMonitor } from "@/components/ports-monitor";

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
  { id: "historical-snapshot", title: "IMF WEO 与世界银行：2024 历史基准", description: "三国七项指标采用 2024 年同年的历史值；阿盟联合报告作区域背景交叉参考。", category: "宏观经济", status: "已接入", icon: Database },
  { id: "gdp-path", title: "IMF WEO：实际 GDP 增速（2024—2028）", description: "展示五年实际 GDP 增速，明确区分历史值、估计值和预测值。", category: "宏观经济", status: "已接入", icon: TrendingUp },
  { id: "structural", title: "国家固定及结构性指标", description: "国土、人口、城镇化、移动与固定宽带、航空客运等结构性指标。", category: "国家结构", status: "已接入", icon: Landmark },
  { id: "hormuz", title: "霍尔木兹海峡通行监测", description: "IMF PortWatch 周度趋势叠加 AIS 实时状态，支持自动与手动检测最新读数。", category: "能源与航运", status: "已接入", icon: Ship },
  { id: "gulf", title: "波斯湾态势与运价指数", description: "海峡通行暴露、绕行能力与高频运价数据的公开可用性说明。", category: "能源与航运", status: "部分数据", icon: Activity },
  { id: "prices", title: "国际油价与天然气价格", description: "布伦特原油与 Henry Hub 天然气月度均价，截至 2026 年 10 月。", category: "能源与航运", status: "已接入", icon: Fuel },
  { id: "production", title: "各国油气产销量", description: "伊拉克生产、出口和炼油能力；其他国家不填造非同口径产量。", category: "能源与财政", status: "部分数据", icon: Fuel },
  { id: "fiscal", title: "油气与非油财政收入", description: "伊拉克中央政府油气与非油收入，列示本币规模及 GDP 占比。", category: "能源与财政", status: "部分数据", icon: CircleDollarSign },
  { id: "swf", title: "各国主权财富基金", description: "仅列可比的公开 AUM；三国首版均不以石油收入或央行储备冒充基金规模。", category: "资本市场", status: "口径说明", icon: Landmark },
  { id: "stocks", title: "各国股票市场", description: "上市公司市值与数量的年度序列，并链接三国官方交易所。", category: "资本市场", status: "部分数据", icon: BarChart3 },
  { id: "operators-annual", title: "运营商年度经营指标", description: "八家运营实体完整列示 2024—2026；2026 年按可比 H1 增速外推或明确不预测。", category: "ICT 运营商", status: "部分数据", icon: BarChart3 },
  { id: "operators-quarterly", title: "运营商季度财务", description: "汇总已核验的 2024—2026 Q2／H1 实际披露，保留原币种与可比基期。", category: "ICT 运营商", status: "部分数据", icon: LineIcon },
  { id: "ports", title: "港口吞吐量—周度趋势", description: "九港 AIS 周度到港活动、周环比与周同比；年度 TEU 分口径展示。", category: "能源与航运", status: "已接入", icon: Container },
  { id: "methodology", title: "数据口径说明", description: "历史值、估计值、预测值、币种、缺失值和运营实体边界的统一说明。", category: "说明与来源", status: "口径说明", icon: BookOpen },
  { id: "sources", title: "宏观数据信息来源", description: "集中列出数据集、发布机构、数据截点与原始链接，便于逐项回溯。", category: "说明与来源", status: "已接入", icon: Database }
];

const fmt = (value: number | null | undefined, digits = 1) => value === null || value === undefined ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const macroValue = (indicator: string, country: string, year: number) => imf[indicator]?.[country]?.[String(year)] ?? null;
const wbValue = (indicator: string, country: string, year?: number) => {
  const rows = (wb[indicator] || []).filter(row => row.country === country && (!year || row.year === year));
  return rows.sort((a, b) => b.year - a.year)[0] || null;
};

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
  if (id === "overview" || id === "historical-snapshot") {
    const year = id === "overview" ? 2026 : 2024;
    const populationYear = id === "overview" ? 2025 : year;
    const definitions = [
      ["nominal", "名义 GDP", "十亿美元", 1], ["growth", "实际 GDP 增速", "%", 1], ["inflation", "CPI 通胀", "%", 1],
      ["debt", "政府总债务／GDP", "%", 1], ["currentAccount", "经常账户／GDP", "%", 1], ["unemployment", "失业率", "%", 1]
    ] as const;
    const rows = definitions.map(([key, label, unit, digits]) => [label + `（${unit}）`, ...countryCodes.map(code => fmt(macroValue(key, code, year), digits))]);
    rows.push(["人口（百万人）", ...countryCodes.map(code => { const row = wbValue("population", code, populationYear); return row ? fmt(row.value / 1e6, 2) : "—"; })]);
    return <>
      {id === "historical-snapshot" && <Note>表内七项指标均为 2024 年历史值。阿盟总秘书处、阿拉伯货币基金组织等联合报告仅作 2024 年区域背景交叉参考，不与 IMF 国别序列混合计算。</Note>}
      {id === "overview" && <Note>宏观指标为 2026 年 IMF WEO 预测值；人口采用世界银行最新可比的 2025 年数据。黎巴嫩部分指标及伊拉克失业率没有 2026 年序列，统一保留为空值。</Note>}
      <DataTable headers={["指标", "伊拉克", "约旦", "黎巴嫩"]} rows={rows} caption={id === "overview" ? "2026 年宏观预测快照（人口为 2025 年）" : "2024 年七项宏观历史基准"}/>
      <SourceLinks keys={id === "overview" ? ["imf", "wb"] : ["imf", "wb", "jointArab"]}/>
    </>;
  }
  if (id === "gdp-path") {
    const labels = Array.from({ length: 5 }, (_, i) => String(2024 + i));
    return <>
      <Note>2024 为历史值，2025 为估计值，2026—2028 为 IMF WEO 预测。黎巴嫩 2026—2028 年没有本次 WEO 序列，保留为空值。</Note>
      <MacroLineChart labels={labels} unit="%" forecastFrom="2026" series={countryCodes.map(code => ({ name: data.countries[code as keyof typeof data.countries].name, color: colors[code as keyof typeof colors], values: labels.map(year => macroValue("growth", code, Number(year))) }))}/>
      <DataTable headers={["年份", "数据属性", "伊拉克", "约旦", "黎巴嫩"]} rows={labels.map(year => [year, Number(year) <= 2024 ? "历史" : Number(year) === 2025 ? "估计" : "预测", ...countryCodes.map(code => fmt(macroValue("growth", code, Number(year)), 1))])}/>
      <SourceLinks keys={["imf"]}/>
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
    return <HormuzMonitor/>;
  }
  if (id === "gulf") {
    return <>
      <DataTable headers={["关键暴露／替代能力", "数值", "单位"]} rows={data.gulfInfrastructure.map(row => [row.item, row.value, row.unit])}/>
      <h3 className="macro-subtitle">高频数据接入状态</h3><DataTable headers={["数据项", "当前状态", "处理方式"]} rows={[["波斯湾周度船舶态势", "已接入", "霍尔木兹模块展示 IMF PortWatch 日度序列、周度均值与 AIS 实时监测"], ["油轮／集装箱运价指数", "未接入", "Baltic Exchange 完整历史序列需授权，仅保留官方入口"], ["海峡油流量与绕行能力", "已接入", "采用 EIA 公开基准"]]}/>
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
      <Note>八家运营商均列出 2024、2025、2026 三年。2024—2025 为实际披露；2026 全年为预测。预测采用“2025 全年实际值 × 2026 H1 实际值 ÷ 2025 H1 实际值”，逐指标外推，公式与基数保留在末列。缺少可靠同口径基数时不预测。</Note>
      <DataTable headers={["国家", "运营实体", "年份", "数据属性", "收入", "收入同比", "EBITDA", "净利润", "客户数", "资本开支", "预测逻辑／未披露原因"]} rows={data.operatorsAnnual.map(row => [data.countries[row.country as keyof typeof data.countries].name, row.operator, row.year, row.dataType, row.revenue, row.revenueYoY, row.ebitda, row.netIncome, row.customers, row.capex, row.forecastLogic])}/>
      <Note tone="amber">各行保留披露币种，不跨币种汇总。Asiacell 年度值为 IQD，H1 增速取自 Ooredoo 对 Asiacell 的 QAR 口径可比披露；2025 EBITDA 采用年度专项业绩页的 9,290 亿 IQD，而非汇总页中与增速不一致的 8,600 亿。Orange 2025 资本开支及 EBITDA 未经同口径核实，保留“—”。Zain 数据为本国运营实体，不是集团合并数；Orange 客户数包含全业务。</Note>
      <SourceLinks keys={["zainAnnual", "zainAnnual2024", "orangeAnnual", "orangeAnnual2024", "asiacell", "zainQuarter", "asiacellQuarter", "orangeQuarter"]}/>
    </>;
  }
  if (id === "operators-quarterly") {
    return <>
      <DataTable headers={["国家", "运营实体", "期间", "数据属性", "收入", "EBITDA", "净利润", "客户数", "补充披露"]} rows={data.operatorsQuarterly.map(row => [data.countries[row.country as keyof typeof data.countries].name, row.operator, row.period, row.dataType, row.revenue, row.ebitda, row.netIncome, row.customers, row.note])}/>
      <Note tone="amber">Q2 为单季度，H1 为上半年累计，不可相加；所有记录均为实际值，不是季度预测。仅列已核验披露，未公开期间不以零值或估算补齐。Asiacell 的 QAR 半年度数据不能与其 IQD 年度值直接相加；Orange 2024 H1、Zain 2024 H1 及其他私营运营商未获同口径可比值。</Note>
      <SourceLinks keys={["zainQuarter", "asiacellQuarter", "asiacellQuarter2024", "orangeQuarter"]}/>
    </>;
  }
  if (id === "ports") {
    return <>
      <PortsMonitor/>
      <SourceLinks keys={["portwatchDaily", "portwatchMethod", "wb"]}/>
    </>;
  }
  if (id === "methodology") {
    return <>
      <DataTable headers={["口径", "本页处理规则"]} rows={[["历史／估计／预测", "WEO 2024 标为历史，2025 标为估计，2026—2028 标为预测；图表预测段使用虚线。"], ["缺失值", "统一显示“—”；不以前值填充、不插值，也不把零值当作缺失值。"], ["频率", "年度、月度、季度、半年与周度数据分别标识；Q2 与 H1 不相加，AIS 周度活动与年度 TEU 不混算。"], ["运营商 2026 预测", "有可比基期时按“2025 全年实际值 × 2026 H1 实际值 ÷ 2025 H1 实际值”逐指标外推；客户数与资本开支不机械年化，缺基数时不预测。"], ["港口周度同比", "日度数据聚合为周一至周日；同比比较 52 周前（364 天前）的同星期窗口，当前不完整周不计算正式环比或同比。"], ["币种与单位", "运营商披露保留原币种；宏观金额按十亿美元、万亿 IQD 等单位分别展示。"], ["实体边界", "集团合并数据不与本国运营实体混用；政府机构、运营公司和交易所分别核验。"], ["信源命名", "模块标题直接使用实际数据集或发布机构名称；区域联合报告只作交叉参考，不与国别预测序列混用。"], ["来源回溯", "每个模块底部列出发布机构、数据截点和原始链接；授权数据只列入口，不复制序列。"]]}/>
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

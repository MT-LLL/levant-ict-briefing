"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import snapshot from "@/data/ports-weekly.json";
import macroData from "@/data/macro.json";
import { MacroLineChart } from "@/components/macro-charts";

type Country = "IRQ" | "JOR" | "LBN";
type Metric = "portcalls" | "container" | "tanker" | "imports" | "exports";
type Week = { weekStart: string; weekEnd: string; days: number; complete: boolean; portcalls: number; container: number; tanker: number; imports: number; exports: number };
type Port = { id: string; country: Country; nameEn: string; name: string; locode: string; latestDailyDate: string; weeks: Week[] };
type DailyRow = { date: string | number; portcalls: number; portcalls_container: number; portcalls_tanker: number; import: number; export: number };
type WBRow = { country: Country; year: number; value: number };

const initial = snapshot as unknown as { meta: { latestDailyDate: string; extractedAt: string }; ports: Port[] };
const endpoint = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Ports_Data/FeatureServer/0/query";
const countryNames: Record<Country, string> = { IRQ: "伊拉克", JOR: "约旦", LBN: "黎巴嫩" };
const countryColors: Record<Country, string> = { IRQ: macroData.countries.IRQ.color, JOR: macroData.countries.JOR.color, LBN: macroData.countries.LBN.color };
const portColors: Record<string, string> = { port20: "#185a86", port2479: "#b7791f", port1341: "#3d7a66", port19: "#185a86", port2187: "#7d6a9c", port132: "#185a86", port2186: "#b7791f", port1173: "#3d7a66", port1274: "#bd3341" };
const metrics: Record<Metric, { label: string; short: string; unit: string }> = {
  portcalls: { label: "总到港船舶", short: "总到港", unit: "艘/周" },
  container: { label: "集装箱船到港", short: "集装箱船", unit: "艘/周" },
  tanker: { label: "油轮到港", short: "油轮", unit: "艘/周" },
  imports: { label: "估算进口货量", short: "进口", unit: "公吨/周" },
  exports: { label: "估算出口货量", short: "出口", unit: "公吨/周" }
};
const iso = (value: string | number) => new Date(value).toISOString().slice(0, 10);
const plusDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date.toISOString());
};
const monday = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return iso(date.toISOString());
};
const fmt = (value: number | null | undefined, digits = 0) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (current: number, previous: number | undefined) => previous === undefined ? "—" : previous === 0 ? current === 0 ? "0.0%" : "—" : `${(current / previous - 1) * 100 >= 0 ? "+" : ""}${((current / previous - 1) * 100).toFixed(1)}%`;
const latestComplete = (port: Port) => port.weeks.filter(week => week.complete).at(-1);
const weekByStart = (port: Port, weekStart: string) => port.weeks.find(week => week.weekStart === weekStart);

function aggregateDaily(rows: DailyRow[]) {
  const grouped = new Map<string, { dates: Set<string>; portcalls: number; container: number; tanker: number; imports: number; exports: number }>();
  for (const row of rows) {
    const date = iso(row.date), weekStart = monday(date);
    if (!grouped.has(weekStart)) grouped.set(weekStart, { dates: new Set(), portcalls: 0, container: 0, tanker: 0, imports: 0, exports: 0 });
    const week = grouped.get(weekStart)!;
    week.dates.add(date);
    week.portcalls += Number(row.portcalls || 0);
    week.container += Number(row.portcalls_container || 0);
    week.tanker += Number(row.portcalls_tanker || 0);
    week.imports += Number(row.import || 0);
    week.exports += Number(row.export || 0);
  }
  return grouped;
}

async function fetchRecent(port: Port): Promise<Port> {
  const start = plusDays(port.latestDailyDate, -13) < "2024-01-01" ? "2024-01-01" : plusDays(port.latestDailyDate, -13);
  const params = new URLSearchParams({
    f: "json",
    where: `portid='${port.id}' AND date >= DATE '${start}'`,
    outFields: "date,portcalls,portcalls_container,portcalls_tanker,import,export",
    orderByFields: "date ASC",
    resultRecordCount: "1000",
    returnGeometry: "false"
  });
  let rows: DailyRow[] | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${endpoint}?${params}`, { signal: AbortSignal.timeout(45000) });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error?.message || `HTTP ${response.status}`);
      rows = (body.features || []).map((feature: { attributes: DailyRow }) => feature.attributes) as DailyRow[];
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 700));
    }
  }
  if (rows === undefined) throw lastError instanceof Error ? lastError : new Error("PortWatch request failed");
  if (!rows.length) return port;
  const latestDailyDate = [port.latestDailyDate, ...rows.map(row => iso(row.date))].sort().at(-1)!;
  const grouped = aggregateDaily(rows);
  const merged = new Map(port.weeks.map(week => [week.weekStart, week]));
  for (const [weekStart, week] of grouped) {
    if (weekStart === monday(start) && week.dates.size < 7 && merged.has(weekStart)) continue;
    merged.set(weekStart, {
      weekStart,
      weekEnd: plusDays(weekStart, 6),
      days: week.dates.size,
      complete: plusDays(weekStart, 6) <= latestDailyDate && week.dates.size === 7,
    portcalls: week.portcalls,
    container: week.container,
    tanker: week.tanker,
    imports: Math.round(week.imports),
      exports: Math.round(week.exports)
    });
  }
  return { ...port, latestDailyDate, weeks: [...merged.values()].map(week => ({ ...week, complete: week.weekEnd <= latestDailyDate && week.days === 7 })).sort((a, b) => a.weekStart.localeCompare(b.weekStart)) };
}

export function PortsMonitor() {
  const [country, setCountry] = useState<Country | "ALL">("IRQ");
  const [portId, setPortId] = useState("ALL");
  const [metric, setMetric] = useState<Metric>("portcalls");
  const [ports, setPorts] = useState<Port[]>(initial.ports);
  const [status, setStatus] = useState<"snapshot" | "loading" | "online" | "error">("snapshot");
  const [message, setMessage] = useState(`本地快照提取于 ${initial.meta.extractedAt.slice(0, 10)}；可检查官方接口是否有更新。`);
  const portsRef = useRef(ports), autoStarted = useRef(false);
  portsRef.current = ports;

  const refresh = useCallback(async () => {
    setStatus("loading");
    setMessage("正在逐港检查 IMF PortWatch 最新日度数据…");
    try {
      const next = await Promise.all(portsRef.current.map(fetchRecent));
      portsRef.current = next;
      setPorts(next);
      const latest = next.map(port => port.latestDailyDate).sort().at(-1)!;
      setStatus("online");
      setMessage(`已核对官方接口；当前最新数据日为 ${latest}。官方发布可能滞后，未将快照日期伪装为实时日期。`);
    } catch {
      setStatus("error");
      setMessage("官方接口暂时不可用，页面继续使用已注明日期的本地周度快照。");
    }
  }, []);

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    const age = (Date.now() - new Date(`${initial.meta.latestDailyDate}T00:00:00Z`).getTime()) / 86400000;
    if (age > 6) void refresh();
  }, [refresh]);

  const countryPorts = useMemo(() => ports.filter(port => country === "ALL" || port.country === country), [ports, country]);
  const visiblePorts = useMemo(() => portId === "ALL" ? countryPorts : countryPorts.filter(port => port.id === portId), [countryPorts, portId]);
  const chartLabels = useMemo(() => [...new Set(visiblePorts.flatMap(port => port.weeks.filter(week => week.complete).slice(-52).map(week => week.weekStart)))].sort().slice(-52), [visiblePorts]);
  const latestRows = useMemo(() => ports.map(port => ({ port, week: latestComplete(port) })).filter((row): row is { port: Port; week: Week } => Boolean(row.week)), [ports]);
  const latestDailyDate = ports.map(port => port.latestDailyDate).sort().at(-1)!;
  const latestWeekStart = latestRows.map(row => row.week.weekStart).sort().at(-1)!;
  const latestCalls = latestRows.filter(row => row.week.weekStart === latestWeekStart).reduce((sum, row) => sum + row.week.portcalls, 0);
  const partialWeeks = visiblePorts.map(port => ({ port, week: port.weeks.at(-1) })).filter(row => row.week && !row.week.complete);
  const recentRows = visiblePorts.flatMap(port => port.weeks.filter(week => week.complete).slice(-6).map(week => ({ port, week }))).sort((a, b) => b.week.weekStart.localeCompare(a.week.weekStart) || a.port.nameEn.localeCompare(b.port.nameEn));

  const wbRows = macroData.worldBank.port as WBRow[];
  const annualYears = Array.from({ length: 6 }, (_, index) => 2019 + index);
  const annualValue = (code: Country, year: number) => wbRows.find(row => row.country === code && row.year === year)?.value;

  return <div className="ports-monitor">
    <div className="macro-note amber">周度部分是 IMF PortWatch 的实验性 AIS 到港活动及估算货量，不是集装箱吞吐量，也不是港务局或海关统计。年度 TEU 另按世界银行口径展示，两类数据不混算。</div>
    <div className="ports-controls">
      <label>国家<select value={country} onChange={event => { setCountry(event.target.value as Country | "ALL"); setPortId("ALL"); }}><option value="ALL">全部国家</option><option value="IRQ">伊拉克</option><option value="JOR">约旦</option><option value="LBN">黎巴嫩</option></select></label>
      <label>港口<select value={portId} onChange={event => setPortId(event.target.value)}><option value="ALL">全部港口</option>{countryPorts.map(port => <option key={port.id} value={port.id}>{port.name} · {port.nameEn}</option>)}</select></label>
      <label>周度指标<select value={metric} onChange={event => setMetric(event.target.value as Metric)}>{Object.entries(metrics).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
      <button type="button" onClick={() => void refresh()} disabled={status === "loading"}><RefreshCw size={14} className={status === "loading" ? "ports-spin" : ""}/>{status === "loading" ? "检查中" : "检查最新数据"}</button>
    </div>
    <div className={`ports-refresh-status status-${status}`} role="status">{message}</div>
    <div className="ports-kpis">
      <div><span>覆盖港口</span><strong>9 个</strong><small>伊拉克 3／约旦 1／黎巴嫩 5</small></div>
      <div><span>官方最新数据日</span><strong>{latestDailyDate}</strong><small>逐日聚合为周一至周日</small></div>
      <div><span>最近完整周</span><strong>{latestWeekStart}</strong><small>至 {plusDays(latestWeekStart, 6)}</small></div>
      <div><span>该周总到港</span><strong>{fmt(latestCalls)} 艘</strong><small>同周有数据港口合计</small></div>
    </div>
    <h3 className="macro-subtitle">{metrics[metric].label}：最近 52 个完整周</h3>
    <MacroLineChart labels={chartLabels} unit={metrics[metric].unit} series={visiblePorts.map(port => ({ name: `${port.name} ${port.nameEn}`, color: portColors[port.id], values: chartLabels.map(label => { const week = weekByStart(port, label); return week?.complete ? week[metric] : null; }) }))}/>
    {partialWeeks.length > 0 && <div className="ports-partial">当前周为“周至今／不完整”：{partialWeeks.map(({ port, week }) => `${port.name} 截至 ${port.latestDailyDate}，总到港 ${fmt(week!.portcalls)} 艘`).join("；")}。不与完整周直接计算环比或同比。</div>}
    <h3 className="macro-subtitle">九港最近完整周：船次、货量与同比</h3>
    <div className="macro-table-wrap"><table className="macro-table"><thead><tr><th>国家／港口（官方英文名）</th><th>最近完整周</th><th>总到港</th><th>周环比</th><th>周同比</th><th>集装箱船</th><th>油轮</th><th>估算进口（公吨）</th><th>估算出口（公吨）</th></tr></thead><tbody>{latestRows.map(({ port, week }) => <tr key={port.id}><td>{countryNames[port.country]}｜{port.name}<small className="ports-cell-sub">{port.nameEn} · LOCODE {port.locode}</small></td><td>{week.weekStart}<small className="ports-cell-sub">至 {week.weekEnd}</small></td><td>{fmt(week.portcalls)}</td><td>{pct(week.portcalls, weekByStart(port, plusDays(week.weekStart, -7))?.portcalls)}</td><td>{pct(week.portcalls, weekByStart(port, plusDays(week.weekStart, -364))?.portcalls)}</td><td>{fmt(week.container)}</td><td>{fmt(week.tanker)}</td><td>{fmt(week.imports)}</td><td>{fmt(week.exports)}</td></tr>)}</tbody></table></div>
    <details className="ports-weekly-details"><summary>展开近周明细（每港最近 6 个完整周）</summary><div className="macro-table-wrap"><table className="macro-table"><thead><tr><th>港口</th><th>周（周一至周日）</th><th>记录天数</th><th>总到港</th><th>周环比</th><th>周同比</th><th>集装箱船</th><th>油轮</th><th>进口公吨</th><th>出口公吨</th></tr></thead><tbody>{recentRows.map(({ port, week }) => <tr key={`${port.id}-${week.weekStart}`}><td>{port.name}</td><td>{week.weekStart} 至 {week.weekEnd}</td><td>{week.days}/7</td><td>{fmt(week.portcalls)}</td><td>{pct(week.portcalls, weekByStart(port, plusDays(week.weekStart, -7))?.portcalls)}</td><td>{pct(week.portcalls, weekByStart(port, plusDays(week.weekStart, -364))?.portcalls)}</td><td>{fmt(week.container)}</td><td>{fmt(week.tanker)}</td><td>{fmt(week.imports)}</td><td>{fmt(week.exports)}</td></tr>)}</tbody></table></div></details>
    <h3 className="macro-subtitle">世界银行：年度集装箱吞吐量与同比</h3>
    <MacroLineChart labels={annualYears.map(String)} unit="百万 TEU" series={(Object.keys(countryNames) as Country[]).map(code => ({ name: countryNames[code], color: countryColors[code], values: annualYears.map(year => { const value = annualValue(code, year); return value === undefined ? null : value / 1e6; }) }))}/>
    <div className="macro-table-wrap"><table className="macro-table"><thead><tr><th>国家</th><th>年份</th><th>集装箱吞吐量（TEU）</th><th>年度同比</th></tr></thead><tbody>{wbRows.slice().sort((a, b) => b.year - a.year || a.country.localeCompare(b.country)).map(row => { const previous = annualValue(row.country, row.year - 1); return <tr key={`${row.country}-${row.year}`}><td>{countryNames[row.country]}</td><td>{row.year}</td><td>{fmt(row.value)}</td><td>{previous === undefined ? "—" : pct(row.value, previous)}</td></tr>; })}</tbody></table></div>
    <div className="macro-note amber ports-annual-note">年度 TEU 缺失值不插值；只有相邻两年均有实际值时才计算同比。周度 AIS 货量单位为公吨，不能换算或替代 TEU。</div>
  </div>;
}

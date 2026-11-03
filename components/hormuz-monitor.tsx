"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownLeft, CheckCircle2, ExternalLink, RefreshCw, Ship, Waves } from "lucide-react";
import fallback from "@/data/hormuz-monitor.json";

type Daily = { date: string; total: number; tanker: number; cargo: number };
type LiveData = {
  generatedAt: number; level: string; label: string; pct: number; avg7d: number; baselineDaily: number; baselineTankers: number;
  feedHealth: string; feedAgeSec: number; coverage24h: number; vesselsVisible: number;
  last24h: { total: number; tankers: number; in: number; out: number; since: number; until: number };
  last7d: { total: number; tankers: number; cargo: number; in: number; out: number };
  portwatch: { latestDate: string; latest: number; latestTankers: number; last7Avg: number; preCrisis: number };
  waitingGulf: number; waitingOman: number; aisSilent: number | null; areasGeneratedAt: number | null;
};
type Snapshot = { meta: { snapshotAt: string; portwatchAsOf: string }; daily: Daily[]; live: LiveData };
type Week = { key: string; label: string; total: number; tanker: number; days: number; complete: boolean };
type Connection = "connecting" | "live" | "partial" | "fallback";

const initial = fallback as Snapshot;
const nf = (value: number | null, digits = 0) => value === null || value === undefined ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const timeLabel = (value: number | null) => value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(value)) + " UTC" : "—";
const levelLabel = (level: string) => ({ open: "开放", restricted: "受限", closed: "关闭", unknown: "数据不足" } as Record<string, string>)[level] || "未知";

function weeklyRows(daily: Daily[]) {
  const weeks = new Map<string, Daily[]>();
  daily.filter(row => row.date >= "2026-01-05").forEach(row => {
    const date = new Date(`${row.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const key = date.toISOString().slice(0, 10);
    weeks.set(key, [...(weeks.get(key) || []), row]);
  });
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]): Week => ({
    key, label: key.slice(5).replace("-", "/"), days: rows.length, complete: rows.length === 7,
    total: rows.reduce((sum, row) => sum + row.total, 0) / rows.length,
    tanker: rows.reduce((sum, row) => sum + row.tanker, 0) / rows.length
  }));
}

function TrendChart({ weeks, baseline }: { weeks: Week[]; baseline: number }) {
  const width = 960, height = 330, left = 58, right = 25, top = 30, bottom = 52;
  const plotW = width - left - right, plotH = height - top - bottom;
  const peak = Math.max(baseline, ...weeks.flatMap(week => [week.total, week.tanker]));
  const max = Math.max(30, Math.ceil(peak * 1.12 / 30) * 30);
  const x = (index: number) => left + (weeks.length === 1 ? plotW / 2 : index * plotW / (weeks.length - 1));
  const y = (value: number) => top + (max - value) * plotH / max;
  const ticks = Array.from({ length: 5 }, (_, index) => max - index * max / 4);
  const skip = Math.max(1, Math.ceil(weeks.length / 10));
  const lines = [
    { key: "total" as const, name: "过境船舶总数", color: "#172b3a" },
    { key: "tanker" as const, name: "其中油轮", color: "#c42b50" }
  ];
  if (!weeks.length) return <div className="macro-empty">暂无周度通行数据</div>;
  return <div className="hormuz-trend-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="2026 年霍尔木兹海峡周度通行趋势，包含船舶总数与油轮">
      <text x={left} y={16} className="hormuz-chart-unit">艘／日</text>
      {ticks.map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="hormuz-grid"/><text x={left - 10} y={y(tick) + 4} textAnchor="end" className="hormuz-axis">{nf(tick)}</text></g>)}
      <line x1={left} x2={width - right} y1={y(baseline)} y2={y(baseline)} className="hormuz-baseline"/>
      <text x={width - right - 4} y={y(baseline) - 7} textAnchor="end" className="hormuz-baseline-label">危机前日均 {nf(baseline, 1)}</text>
      {weeks.map((week, index) => {
        const show = index % skip === 0 || index === weeks.length - 1;
        return show ? <text key={week.key} x={x(index)} y={height - 19} textAnchor="middle" className="hormuz-axis">{week.label}</text> : null;
      })}
      {lines.map(line => <g key={line.key}>
        {weeks.slice(0, -1).map((week, index) => {
          const next = weeks[index + 1], partial = !week.complete || !next.complete;
          return <line key={week.key} x1={x(index)} x2={x(index + 1)} y1={y(week[line.key])} y2={y(next[line.key])} stroke={line.color} strokeWidth="2.7" strokeDasharray={partial ? "7 5" : undefined}/>;
        })}
        {weeks.map((week, index) => <circle key={week.key} cx={x(index)} cy={y(week[line.key])} r="4" fill={week.complete ? line.color : "#fff"} stroke={line.color} strokeWidth="2"/>)}
      </g>)}
    </svg>
    <div className="hormuz-trend-legend">{lines.map(line => <span key={line.key}><i style={{ background: line.color }}/>{line.name}</span>)}</div>
  </div>;
}

function MiniBars({ title, unit, items, icon: Icon }: { title: string; unit: string; items: { label: string; value: number; color: string }[]; icon: typeof Ship }) {
  const max = Math.max(...items.map(item => item.value), 1);
  return <section className="hormuz-mini-panel"><div className="hormuz-mini-title"><div><Icon size={16}/><h3>{title}</h3></div><span>{unit}</span></div><div className="hormuz-mini-bars">{items.map(item => <div key={item.label}><div><span>{item.label}</span><strong>{nf(item.value)}</strong></div><div className="hormuz-mini-track"><span style={{ width: `${Math.max(item.value ? 4 : 0, item.value / max * 100)}%`, background: item.color }}/></div></div>)}</div></section>;
}

function mapLive(status: any, areas: any | null): LiveData {
  return {
    generatedAt: status.generatedAt, level: status.status.level, label: status.status.label, pct: status.status.pct,
    avg7d: status.avg7d, baselineDaily: status.baseline.daily, baselineTankers: status.baseline.tankers,
    feedHealth: status.feed.health, feedAgeSec: status.feed.ageSec, coverage24h: status.feed.coverage24h, vesselsVisible: status.feed.vessels,
    last24h: status.last24h, last7d: status.last7d, portwatch: status.portwatch,
    waitingGulf: status.fleet.waitingGulf, waitingOman: status.fleet.waitingOman,
    aisSilent: areas ? areas.aisSilent.length : null, areasGeneratedAt: areas ? areas.generatedAt : null
  };
}

export function HormuzMonitor() {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.allSettled([
      fetch("https://hormuz.now/status.json", { cache: "no-store" }).then(response => { if (!response.ok) throw new Error("status"); return response.json(); }),
      fetch("https://straits.live/api/v1/transits?history=1&limit=365", { cache: "no-store" }).then(response => { if (!response.ok) throw new Error("history"); return response.json(); }),
      fetch("https://hormuz.now/api/areas", { cache: "no-store" }).then(response => { if (!response.ok) throw new Error("areas"); return response.json(); })
    ]);
    const [status, history, areas] = results;
    const areaValue = areas.status === "fulfilled" ? areas.value : null;
    setSnapshot(previous => ({
      meta: { snapshotAt: new Date().toISOString(), portwatchAsOf: history.status === "fulfilled" ? history.value.asOf : previous.meta.portwatchAsOf },
      daily: history.status === "fulfilled" ? history.value.history.map((row: any) => ({ date: row.date, total: row.nTotal, tanker: row.nTanker, cargo: row.nCargo })).sort((a: Daily, b: Daily) => a.date.localeCompare(b.date)) : previous.daily,
      live: status.status === "fulfilled" ? mapLive(status.value, areaValue) : areaValue ? { ...previous.live, waitingGulf: areaValue.fleet.waitingGulf, waitingOman: areaValue.fleet.waitingOman, aisSilent: areaValue.aisSilent.length, areasGeneratedAt: areaValue.generatedAt } : previous.live
    }));
    const fulfilled = results.filter(result => result.status === "fulfilled").length;
    setConnection(fulfilled === 3 ? "live" : fulfilled ? "partial" : "fallback");
    setLastChecked(Date.now());
    setRefreshing(false);
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 300000); return () => window.clearInterval(timer); }, [refresh]);

  const live = snapshot.live;
  const weeks = useMemo(() => weeklyRows(snapshot.daily), [snapshot.daily]);
  const latestDaily = snapshot.daily[snapshot.daily.length - 1];
  const connectionText = { connecting: "正在检测", live: "实时源已连接", partial: "部分实时源可用", fallback: "显示快照回退" }[connection];
  const rows = [
    ["AIS 最近 24 小时过境", `${nf(live.last24h.total)} 艘`, timeLabel(live.generatedAt)],
    ["其中油轮", `${nf(live.last24h.tankers)} 艘`, "AIS 可视商船"],
    ["AIS 最近 7 日过境", `${nf(live.last7d.total)} 艘`, `日均 ${nf(live.avg7d, 1)} 艘／日`],
    ["IMF 最新日正式过境", `${nf(live.portwatch.latest)} 艘`, live.portwatch.latestDate],
    ["IMF 最新日油轮", `${nf(live.portwatch.latestTankers)} 艘`, live.portwatch.latestDate],
    ["IMF 最新 7 日日均", `${nf(live.portwatch.last7Avg, 1)} 艘／日`, `截至 ${live.portwatch.latestDate}`],
    ["危机前日均基准", `${nf(live.baselineDaily, 1)} 艘／日`, `其中油轮 ${nf(live.baselineTankers, 1)} 艘／日`],
    ["海峡两侧低速商船", `海湾侧 ${nf(live.waitingGulf)} · 阿曼湾侧 ${nf(live.waitingOman)}`, "不等同于待通航队列"],
    ["AIS 静默 6 小时以上", live.aisSilent === null ? "—" : `${nf(live.aisSilent)} 艘`, "可能为关机、干扰或超出接收范围"],
    ["AIS 数据健康", live.feedHealth === "live" ? "正常" : "延迟／异常", `覆盖率 ${nf(live.coverage24h * 100, 0)}% · 可见船舶 ${nf(live.vesselsVisible)} 艘`]
  ];

  return <div className="hormuz-monitor">
    <div className={`hormuz-live-banner ${live.level}`}>
      <div className="hormuz-live-icon"><Waves size={24}/></div>
      <div className="hormuz-live-copy"><span>AIS 实时通行监测</span><div><strong>{levelLabel(live.level)}</strong><em>{connectionText}</em></div><p>近 7 日 AIS 可视商船日均 <b>{nf(live.avg7d, 1)}</b> 艘，约为危机前基准的 <b>{nf(live.pct, 1)}%</b>。</p><small>监测时间 {timeLabel(live.generatedAt)}</small></div>
      <button onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spinning" : ""}/>{refreshing ? "检测中…" : "立即检测"}</button>
    </div>
    {connection === "fallback" && <div className="hormuz-warning"><AlertTriangle size={15}/>实时接口暂不可用，当前显示最近一次成功快照，不将其标记为实时值。</div>}
    {connection === "partial" && <div className="hormuz-warning"><AlertTriangle size={15}/>部分指标未能更新；对应位置保留最近成功值或显示缺失。</div>}

    <section className="hormuz-panel">
      <div className="hormuz-panel-heading"><div><span>IMF PORTWATCH · WEEKLY TREND</span><h3>霍尔木兹海峡周度通行趋势</h3></div><strong>数据日 {latestDaily?.date || "—"}</strong></div>
      <p className="hormuz-method">按周对日度过境量取算术均值，每周需 7 个日度值方标为完整；虚线与空心点表示覆盖不足 7 天。AIS 数据会有延迟、干扰或关机造成的漏计。</p>
      <TrendChart weeks={weeks} baseline={live.baselineDaily}/>
      <div className="hormuz-baseline-note"><span/>危机前基线：2025-02-28 至 2026-02-27 日均值；当前为 {nf(live.baselineDaily, 1)} 艘／日</div>
      <details className="hormuz-weekly-details"><summary>查看最近 8 周数值</summary><div className="macro-table-wrap"><table className="macro-table"><thead><tr><th>周起始日</th><th>覆盖天数</th><th>船舶总数（艘／日）</th><th>油轮（艘／日）</th></tr></thead><tbody>{weeks.slice(-8).reverse().map(week => <tr key={week.key}><td>{week.key}</td><td>{week.days}／7{week.complete ? "" : "（不完整）"}</td><td>{nf(week.total, 1)}</td><td>{nf(week.tanker, 1)}</td></tr>)}</tbody></table></div></details>
    </section>

    <div className="hormuz-section-label"><Activity size={15}/><span>区域通行态势</span><small>实时 AIS · 最近 7 日</small></div>
    <div className="hormuz-mini-grid">
      <MiniBars title="通行方向" unit="艘／7 日" icon={ArrowDownLeft} items={[{ label: "驶入海湾", value: live.last7d.in, color: "#185a86" }, { label: "驶出海湾", value: live.last7d.out, color: "#6d8fa4" }]}/>
      <MiniBars title="船舶构成" unit="艘／7 日" icon={Ship} items={[{ label: "油轮", value: live.last7d.tankers, color: "#c42b50" }, { label: "货船", value: live.last7d.cargo, color: "#172b3a" }]}/>
    </div>
    <p className="hormuz-mini-note">实时口径为 AIS 可视、长度通常不低于 80 米的商船，按每个方向去重；其计数线、AIS 来源与 IMF PortWatch 不同，两套数据不可相加。</p>

    <section className="hormuz-panel hormuz-current">
      <div className="hormuz-panel-heading"><div><span>CURRENT READINGS</span><h3>当前态势与最新读数</h3></div><strong>{lastChecked ? `检测于 ${timeLabel(lastChecked)}` : "正在检测"}</strong></div>
      <div className="hormuz-status-table">{rows.map(([label, value, note]) => <div className="hormuz-status-row" key={label}><span>{label}<small>{note}</small></span><strong>{value}</strong></div>)}</div>
    </section>
    <div className="hormuz-sources"><span><CheckCircle2 size={14}/>来源与口径</span><a href="https://portwatch.imf.org/pages/chokepoint6" target="_blank" rel="noreferrer">IMF PortWatch<ExternalLink size={11}/></a><a href="https://hormuz.now/methodology" target="_blank" rel="noreferrer">AIS 实时方法与限制<ExternalLink size={11}/></a><a href="https://straits.live/api" target="_blank" rel="noreferrer">PortWatch 镜像接口<ExternalLink size={11}/></a><small>每 5 分钟自动检测；AIS 仅作态势监测，不作为航行安全指令。</small></div>
  </div>;
}

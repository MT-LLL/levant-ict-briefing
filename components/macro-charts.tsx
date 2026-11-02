"use client";

import { useId } from "react";

type LineSeries = { name: string; color: string; values: (number | null)[] };

export function MacroLineChart({ labels, series, unit = "", forecastFrom }: { labels: string[]; series: LineSeries[]; unit?: string; forecastFrom?: string }) {
  const id = useId().replace(/:/g, "");
  const all = series.flatMap(item => item.values).filter((value): value is number => value !== null && Number.isFinite(value));
  if (!all.length) return <div className="macro-empty">暂无可绘制数据</div>;
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const padding = (max - min) * 0.12;
  min -= padding; max += padding;
  if (min > 0 && min < (max - min) * 0.3) min = 0;
  const width = 760, height = 280, left = 58, right = 20, top = 24, bottom = 46;
  const plotW = width - left - right, plotH = height - top - bottom;
  const x = (index: number) => left + (labels.length === 1 ? plotW / 2 : index * plotW / (labels.length - 1));
  const y = (value: number) => top + (max - value) * plotH / (max - min);
  const ticks = Array.from({ length: 5 }, (_, i) => max - i * (max - min) / 4);
  const format = (value: number) => Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
  const pathFor = (values: (number | null)[], start = 0, end = labels.length - 1) => {
    let path = "", open = false;
    values.forEach((value, index) => {
      if (index < start || index > end) return;
      if (value === null || !Number.isFinite(value)) { open = false; return; }
      path += `${open ? " L" : " M"}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
      open = true;
    });
    return path;
  };
  const forecastIndex = forecastFrom ? labels.indexOf(forecastFrom) : -1;
  return <div className="macro-chart-wrap">
    <svg className="macro-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map(item => item.name).join("、") + "趋势图"}>
      <defs><clipPath id={`clip-${id}`}><rect x={left} y={top} width={plotW} height={plotH}/></clipPath></defs>
      {ticks.map((tick, index) => <g key={index}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="macro-grid-line"/><text x={left - 9} y={y(tick) + 4} textAnchor="end" className="macro-axis-label">{format(tick)}</text></g>)}
      {labels.map((label, index) => {
        const skip = labels.length > 12 ? Math.ceil(labels.length / 8) : labels.length > 7 ? 2 : 1;
        if (index % skip !== 0 && index !== labels.length - 1) return null;
        return <text key={label + index} x={x(index)} y={height - 17} textAnchor="middle" className="macro-axis-label">{label}</text>;
      })}
      {forecastIndex >= 0 && <g><line x1={x(forecastIndex)} x2={x(forecastIndex)} y1={top} y2={top + plotH} className="macro-forecast-line"/><text x={x(forecastIndex) + 6} y={top + 13} className="macro-forecast-label">预测区间</text></g>}
      <g clipPath={`url(#clip-${id})`}>{series.map(item => <g key={item.name}>
        <path d={pathFor(item.values, 0, forecastIndex >= 0 ? forecastIndex : labels.length - 1)} fill="none" stroke={item.color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>
        {forecastIndex >= 0 && <path d={pathFor(item.values, forecastIndex)} fill="none" stroke={item.color} strokeWidth="2.6" strokeDasharray="7 5" strokeLinejoin="round" strokeLinecap="round"/>}
        {item.values.map((value, index) => value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r={labels.length > 20 ? 2.2 : 3.7} fill="#fff" stroke={item.color} strokeWidth="2"/>) }
      </g>)}</g>
      {unit && <text x={left} y={14} className="macro-unit-label">{unit}</text>}
    </svg>
    <div className="macro-legend">{series.map(item => <span key={item.name}><i style={{ background: item.color }}/>{item.name}</span>)}</div>
  </div>;
}

export function MacroBarChart({ items, unit = "", color = "#2563eb" }: { items: { label: string; value: number; note?: string }[]; unit?: string; color?: string }) {
  const max = Math.max(...items.map(item => Math.abs(item.value)), 1);
  return <div className="macro-bars">{items.map(item => <div className="macro-bar-row" key={item.label}>
    <div className="macro-bar-meta"><span>{item.label}</span><strong>{item.value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}{unit && <small> {unit}</small>}</strong></div>
    <div className="macro-bar-track"><span style={{ width: `${Math.max(3, Math.abs(item.value) / max * 100)}%`, background: color }}/></div>
    {item.note && <div className="macro-bar-note">{item.note}</div>}
  </div>)}</div>;
}

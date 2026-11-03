import { writeFile } from "node:fs/promises";

const endpoint = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Ports_Data/FeatureServer/0/query";
const output = new URL("../data/ports-weekly.json", import.meta.url);
const ports = [
  { id: "port20", country: "IRQ", nameEn: "Al Basrah", name: "巴士拉港", locode: "IQ BSR" },
  { id: "port2479", country: "IRQ", nameEn: "Basrah Oil Terminal", name: "巴士拉油码头", locode: "—" },
  { id: "port1341", country: "IRQ", nameEn: "Umm Qasr", name: "乌姆盖斯尔港", locode: "IQ UQR" },
  { id: "port19", country: "JOR", nameEn: "Aqaba", name: "亚喀巴港", locode: "JO AQB" },
  { id: "port2187", country: "LBN", nameEn: "Aamchit", name: "阿姆希特港", locode: "—" },
  { id: "port132", country: "LBN", nameEn: "Beirut", name: "贝鲁特港", locode: "LB BEY" },
  { id: "port2186", country: "LBN", nameEn: "Chekka", name: "舍卡港", locode: "LB CHK" },
  { id: "port1173", country: "LBN", nameEn: "Sayda", name: "赛达港", locode: "LB SAY" },
  { id: "port1274", country: "LBN", nameEn: "Tripoli", name: "的黎波里港", locode: "LB KYE" }
];
const fields = ["portcalls", "portcalls_container", "portcalls_tanker", "import", "export"];
const iso = value => new Date(value).toISOString().slice(0, 10);
const monday = value => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return iso(date);
};
const plusDays = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};

async function query(params, attempts = 4) {
  const url = `${endpoint}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error?.message || `HTTP ${response.status}`);
      return body;
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
}

async function fetchPort(port) {
  const daily = new Map();
  let offset = 0;
  while (true) {
    const body = await query({
      f: "json",
      where: `portid='${port.id}' AND date >= DATE '2024-01-01'`,
      outFields: "date,portid,portname,country,ISO3,portcalls,portcalls_container,portcalls_tanker,import,export",
      orderByFields: "date ASC",
      resultRecordCount: "1000",
      resultOffset: String(offset),
      returnGeometry: "false"
    });
    const features = body.features || [];
    for (const feature of features) {
      const row = feature.attributes;
      daily.set(iso(row.date), row);
    }
    console.log(`${port.id}: ${daily.size} daily rows`);
    if (!body.exceededTransferLimit || !features.length) break;
    offset += features.length;
  }
  if (!daily.size) throw new Error(`${port.id}: no daily data returned`);
  const rows = [...daily.values()].sort((a, b) => iso(a.date).localeCompare(iso(b.date)));
  const latestDailyDate = iso(rows.at(-1).date);
  const grouped = new Map();
  for (const row of rows) {
    const date = iso(row.date);
    const weekStart = monday(date);
    if (!grouped.has(weekStart)) grouped.set(weekStart, { dates: new Set(), portcalls: 0, container: 0, tanker: 0, imports: 0, exports: 0 });
    const week = grouped.get(weekStart);
    week.dates.add(date);
    for (const field of fields) {
      const key = field === "portcalls_container" ? "container" : field === "portcalls_tanker" ? "tanker" : field === "import" ? "imports" : field === "export" ? "exports" : field;
      week[key] += Number(row[field] || 0);
    }
  }
  const weeks = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, week]) => ({
    weekStart,
    weekEnd: plusDays(weekStart, 6),
    days: week.dates.size,
    complete: plusDays(weekStart, 6) <= latestDailyDate && week.dates.size === 7,
    portcalls: week.portcalls,
    container: week.container,
    tanker: week.tanker,
    imports: Math.round(week.imports),
    exports: Math.round(week.exports)
  }));
  return { ...port, latestDailyDate, weeks };
}

const results = [];
for (const port of ports) results.push(await fetchPort(port));
const payload = {
  meta: {
    publisher: "国际货币基金组织（IMF）PortWatch",
    extractedAt: new Date().toISOString(),
    latestDailyDate: results.map(port => port.latestDailyDate).sort().at(-1),
    startDate: "2024-01-01",
    weekDefinition: "周一至周日；周度值为官方日度值求和",
    yoyDefinition: "与 52 周前（364 天前）的同星期窗口比较，仅比较完整周",
    units: { portcalls: "艘/周", container: "艘/周", tanker: "艘/周", imports: "公吨/周", exports: "公吨/周" },
    caveat: "实验性 AIS 模型估算；不是港务局或海关统计，不是 TEU。数据可能延迟发布或修订。"
  },
  ports: results
};
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${results.length} ports; latest ${payload.meta.latestDailyDate}`);

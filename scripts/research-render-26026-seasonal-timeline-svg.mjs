import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const input = process.env.TIMELINE_JSON ?? "tmp/rebound-26026-full-seasonal-timeline.json";
const curveOverviewOutput = process.env.CURVE_OVERVIEW_SVG ?? "tmp/rebound-26026-seasonal-drift-curve-overview.svg";
const curveDetailOutput = process.env.CURVE_DETAIL_SVG ?? "tmp/rebound-26026-seasonal-drift-curve-detail.svg";
const orbitOutput = process.env.ORBIT_SVG ?? "tmp/rebound-26026-seasonal-orbit-overview.svg";

const data = JSON.parse(readFileSync(input, "utf8"));
if (data.researchOnly !== true || data.sampling?.crossingCount !== 360) {
  throw new Error("expected accepted 360-point research timeline");
}

function esc(value) {
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function write(path, body) {
  mkdirSync(dirname(path), { recursive:true });
  writeFileSync(path, body);
}

function renderCurve({ overview }) {
  const width = 1500;
  const height = 760;
  const margin = { left:110, right:50, top:80, bottom:115 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const points = data.curve;
  const values = points.map(p => p.gregorianCycleDriftDays);
  const lo = overview
    ? Math.floor(Math.min(...values) - 0.5)
    : Math.floor(Math.min(...values) - 0.5);
  const hi = overview
    ? 0
    : Math.ceil(Math.max(...values) + 0.5);
  const y = value => margin.top + (hi - value) / (hi - lo) * plotH;
  const x = index => margin.left + index / (points.length - 1) * plotW;
  const path = points.map((p,i) =>
    `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.gregorianCycleDriftDays).toFixed(2)}`
  ).join(" ");

  const yTicks = [];
  const tickStep = overview ? 3 : 1;
  for (let v = Math.ceil(lo / tickStep) * tickStep; v <= Math.floor(hi); v += tickStep) {
    yTicks.push(v);
  }

  const termMarks = data.terms.map(term => {
    const index = points.findIndex(p => p.longitudeDegrees === term.longitudeDegrees);
    return { ...term, index };
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  <style>
    text{font-family:system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;fill:#111}
    .muted{fill:#666}.grid{stroke:#ddd;stroke-width:1}.axis{stroke:#333;stroke-width:1.5}
  </style>
  <text x="${margin.left}" y="38" font-size="28" font-weight="700">2026 → 26026 全年節氣相位漂移${overview ? "｜距離 0 天總覽" : "｜季節內細節"}</text>
  <text x="${margin.left}" y="66" font-size="16" class="muted">Δt = T26026(λ) − [T2026(λ) + 24,000 Gregorian years] · TT · 1° sampling${overview ? " · 0 天 = 完全回到 Gregorian 相位" : " · 縮放顯示約 4 天的季節內起伏"}</text>
  ${yTicks.map(v => `
    <line class="grid" x1="${margin.left}" x2="${width-margin.right}" y1="${y(v)}" y2="${y(v)}"/>
    <text x="${margin.left-15}" y="${y(v)+5}" font-size="14" text-anchor="end">${v} d</text>`).join("")}
  <line class="axis" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${height-margin.bottom}"/>
  <line class="axis" x1="${margin.left}" x2="${width-margin.right}" y1="${height-margin.bottom}" y2="${height-margin.bottom}"/>
  <path d="${path}" fill="none" stroke="#111" stroke-width="3"/>
  ${termMarks.map((term,i) => {
    const px=x(term.index), py=y(term.gregorianCycleDriftDays);
    const labelY = height - margin.bottom + 26 + (i%2)*23;
    return `
      <circle cx="${px}" cy="${py}" r="4.5" fill="#fff" stroke="#111" stroke-width="2"/>
      <line x1="${px}" x2="${px}" y1="${height-margin.bottom}" y2="${height-margin.bottom+8}" stroke="#555"/>
      <text x="${px}" y="${labelY}" font-size="11" text-anchor="middle" transform="rotate(-38 ${px} ${labelY})">${esc(term.name)}</text>`;
  }).join("")}
  <text x="${margin.left + plotW/2}" y="${height-20}" font-size="15" text-anchor="middle" class="muted">太陽黃經／24 節氣（時間順序由冬至 270° 開始）</text>
  <text x="28" y="${margin.top+plotH/2}" font-size="15" text-anchor="middle" class="muted" transform="rotate(-90 28 ${margin.top+plotH/2})">Gregorian 相位漂移（天；負值 = 提前）</text>
  <text x="${width-margin.right}" y="42" font-size="15" text-anchor="end">range ${data.summary.minDriftDays.toFixed(2)} … ${data.summary.maxDriftDays.toFixed(2)} d</text>
  </svg>`;
}

function renderOrbit() {
  const size = 1400;
  const cx = 700;
  const cy = 700;
  const orbitR = 365;
  const calendarR = 450;
  const labelR = 555;
  const daysToDegrees = 360 / 365.2425;

  function xy(radius, degrees) {
    const rad = degrees * Math.PI / 180;
    return [cx + radius * Math.cos(rad), cy - radius * Math.sin(rad)];
  }

  function arcPath(radius, startDeg, endDeg) {
    const [sx,sy] = xy(radius,startDeg);
    const [ex,ey] = xy(radius,endDeg);
    let delta = endDeg - startDeg;
    while (delta <= -360) delta += 360;
    while (delta > 360) delta -= 360;
    const large = Math.abs(delta) > 180 ? 1 : 0;
    const sweep = delta >= 0 ? 0 : 1;
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${radius} ${radius} 0 ${large} ${sweep} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }

  const terms = data.terms;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#222"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#fff"/>
  <style>
    text{font-family:system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;fill:#111}
    .muted{fill:#666}
  </style>
  <text x="70" y="62" font-size="28" font-weight="700">+24,000 年節氣漂移｜太陽系俯視概念圖</text>
  <text x="70" y="92" font-size="15" class="muted">內圈 = 同一太陽黃經的位置；外圈弧線 = 相同季節位置對應的 Gregorian 日期提前量（不是軌道半徑變形）</text>

  <circle cx="${cx}" cy="${cy}" r="52" fill="#111"/>
  <text x="${cx}" y="${cy+6}" fill="#fff" font-size="18" text-anchor="middle" style="fill:#fff">太陽</text>
  <circle cx="${cx}" cy="${cy}" r="${orbitR}" fill="none" stroke="#999" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${calendarR}" fill="none" stroke="#ddd" stroke-width="1.5" stroke-dasharray="5 7"/>
  <text x="${cx}" y="${cy-orbitR-18}" font-size="14" text-anchor="middle" class="muted">季節／太陽黃經圈</text>
  <text x="${cx}" y="${cy-calendarR-18}" font-size="14" text-anchor="middle" class="muted">Gregorian calendar phase ring</text>

  ${terms.map(term => {
    const longitude = term.longitudeDegrees;
    const [ox,oy] = xy(orbitR, longitude);
    const [cx0,cy0] = xy(calendarR, longitude);
    const calendarShiftDeg = term.gregorianCycleDriftDays * daysToDegrees;
    const shifted = longitude + calendarShiftDeg;
    const [lx,ly] = xy(labelR, longitude);
    const anchor = lx < cx - 20 ? "end" : lx > cx + 20 ? "start" : "middle";
    return `
      <line x1="${cx}" y1="${cy}" x2="${ox}" y2="${oy}" stroke="#eee" stroke-width="1"/>
      <circle cx="${ox}" cy="${oy}" r="5" fill="#111"/>
      <circle cx="${cx0}" cy="${cy0}" r="3.5" fill="#fff" stroke="#777" stroke-width="1.5"/>
      <path d="${arcPath(calendarR, longitude, shifted)}" fill="none" stroke="#222" stroke-width="3" marker-end="url(#arrow)"/>
      <text x="${lx}" y="${ly-5}" font-size="14" text-anchor="${anchor}" font-weight="650">${esc(term.name)}</text>
      <text x="${lx}" y="${ly+14}" font-size="12" text-anchor="${anchor}" class="muted">${term.gregorianCycleDriftDays.toFixed(1)} d</text>`;
  }).join("")}

  <g transform="translate(70 1240)">
    <line x1="0" y1="0" x2="56" y2="0" stroke="#222" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="72" y="5" font-size="14">箭頭方向／長度：Gregorian 日期相位漂移（負值沿「提前」方向）</text>
    <text x="0" y="35" font-size="14" class="muted">重要：這張圖不把 10–14 天誤畫成地球軌道本身位移；空間位置仍由太陽黃經定義。</text>
  </g>
  </svg>`;
}

write(curveOverviewOutput, renderCurve({ overview:true }));
write(curveDetailOutput, renderCurve({ overview:false }));
write(orbitOutput, renderOrbit());

console.log(JSON.stringify({
  curveOverviewOutput,
  curveDetailOutput,
  orbitOutput,
  curvePoints:data.curve.length,
  namedTerms:data.terms.length,
  driftRangeDays:[data.summary.minDriftDays,data.summary.maxDriftDays]
}, null, 2));

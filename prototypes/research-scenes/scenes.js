// Research scenes — stage B static frames on the REAL home instrument.
// The wheel is index.html in a same-origin iframe (?instant=…); this script
// only adds research marks inside its SVG, using the home's own classes and
// materials. Values come from repo modules.
// ?f=open0|open1|gap|closure|sun|jie   &capture=1 hides the frame picker.
import { recurrenceState } from "../../src/recurrence/gregorian-cycle.js";
import { CURSOR_ANGLE, FAN, RADII, WHEEL_CENTER } from "../../src/wheel/ring-model.js";
import { annularSectorPath, arcPath, pointAt } from "../../src/wheel/polar-geometry.js";
import { solarLongitudeAtInstant } from "../../src/wheel/atlas-display-model.js";
import { solarTerms } from "../../src/data.js";
import {
  SEASONAL_DRIFT_26026_RESEARCH as DRIFT,
  indexForLongitude
} from "../../src/research/seasonal-drift-26026-research-data.js";

const NS = "http://www.w3.org/2000/svg";
const BASE_DATE = Object.freeze({ year: 2026, month: 9, day: 13 });
const instantFor = year => `${String(year).padStart(4, "0")}-09-13T15:00:00+08:00`;
const mod = (v, n) => ((v % n) + n) % n;
const signed = (v, n) => { const m = mod(v, n); return m > n / 2 ? m - n : m; };
const fmt = n => n.toLocaleString("en-US");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FRAMES = {
  open0: { label: "0.1 起點（＝首頁）", year: 2026 },
  open1: { label: "0.1 光落在針下一欄", year: 2026 },
  gap: { label: "1.2 還差 20 年", year: 2026 + 1980, delta: 1980, greg: true },
  // The home calendar stops at 9999. At +24,000 the year and day rings sit at
  // phase 0 by construction, so the 2026 instant draws the same year/day state;
  // month, hour and the sun's band are veiled here and revisited in 02.
  closure: { label: "1.5 24,000 年", year: 2026, delta: 24000, greg: true },
  sun: { label: "2.1 太陽呢？", year: 2026, delta: 24000, greg: true },
  jie: { label: "2.2 十二節提早", jie: 315 }
};

// The 2026 instant at which the apparent Sun reaches longitude lambda (UTC+8 ISO).
function instantAtLongitude2026(lambda) {
  const start = Date.UTC(2026, 0, 1) + mod(lambda - 280, 360) / 360 * 365.2422 * 864e5 - 6 * 864e5;
  let lo = start, hi = start + 12 * 864e5;
  const ahead = ms => signed(solarLongitudeAtInstant(ms) - lambda, 360) >= 0;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (ahead(mid)) hi = mid; else lo = mid; }
  const local = new Date(Math.round(hi / 1000) * 1000 + 8 * 3600e3).toISOString().slice(0, 19);
  return local + "+08:00";
}
const frameInstant = f => (f.jie !== undefined ? instantAtLongitude2026(f.jie) : instantFor(f.year));

const STYLE = `
  .kinetic-topbar .site-nav a { pointer-events: none; }
  .atlas-intro, .instrument-toolbar, #classification-overlay-legend, .timeline-dock,
  .state-strip, #atlas-drag-hint, #ganzhi-inspector { display: none !important; }
  html:not([data-rs-frame="open0"]) :is(.instrument-readout, #mobile-time-dock) { display: none !important; }
  html:not([data-rs-frame="open0"]):not([data-rs-frame="open1"]) .ring-legend { display: none !important; }
  html[data-rs-panned] .kinetic-topbar { visibility: hidden; }
  html[data-rs-greg] #month-track > * { display: none; }
  html:is([data-rs-frame="gap"], [data-rs-frame="closure"]) :is(#hour-track, #solar-track, #zodiac-track) :is(.active-cycle-label, .active-annual-label),
  html[data-rs-frame="sun"] :is(#hour-track, #zodiac-track) .active-cycle-label,
  html[data-rs-frame="jie"] :is(#year-track, #month-track, #day-track, #hour-track, #zodiac-track) :is(.active-cycle-label, .active-annual-label) { opacity: .28; }
  .rs-sun-mark { stroke: #f0dcae; }
  .rs-shift { fill: none; stroke: rgba(233, 207, 149, .7); stroke-linecap: round; }
  .rs-shift-value { font-family: "Noto Sans TC", sans-serif; fill: rgba(240, 226, 196, .8); }
  .rs-band-name { font-family: var(--lq-serif); fill: rgba(240, 226, 196, .75); letter-spacing: .14em; }
  .rs-veil { fill: #090c11; opacity: .58; }
  .rs-name { font-family: var(--lq-serif); font-weight: 500; fill: rgba(232, 226, 210, .86); letter-spacing: .12em; }
  .rs-note { font-family: "Noto Sans TC", sans-serif; fill: rgba(206, 212, 216, .5); letter-spacing: .04em; }
  .rs-leader { stroke: rgba(206, 212, 216, .26); fill: none; }
  .rs-ring-name { font-family: var(--lq-serif); fill: rgba(206, 212, 216, .5); letter-spacing: .14em; }
  .rs-greg-label { font-family: var(--lq-serif); font-weight: 500; fill: rgba(204, 212, 222, .5); }
  .rs-echo { stroke: rgba(214, 224, 236, .78); }
  .rs-echo-label { font-family: "Noto Sans TC", sans-serif; fill: rgba(214, 224, 236, .78); letter-spacing: .04em; }
  .rs-gap { fill: none; stroke: #c8664f; stroke-linecap: round; }
  .rs-gap-label { font-family: "Noto Sans TC", sans-serif; font-weight: 500; fill: #d9806a; }
  .rs-back { font-family: "Noto Sans TC", sans-serif; fill: rgba(240, 226, 196, .72); letter-spacing: .06em; }
`;

function svgEl(doc, parent, name, attrs = {}, text) {
  const node = doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

async function loadWheel(frame) {
  const iframe = document.getElementById("rs-wheel");
  const url = `../../index.html?instant=${encodeURIComponent(frameInstant(FRAMES[frame]))}`;
  await new Promise(resolve => { iframe.onload = resolve; iframe.src = url; });
  const doc = iframe.contentDocument;
  doc.documentElement.dataset.rsFrame = frame;
  if (FRAMES[frame].greg) doc.documentElement.dataset.rsGreg = "on";
  if (frame === "gap" || frame === "jie") doc.documentElement.dataset.rsPanned = "on";
  const style = doc.createElement("style");
  style.textContent = STYLE;
  doc.head.append(style);
  for (let i = 0; i < 60; i++) {
    const label = doc.querySelector("#year-track .active-cycle-label");
    const instrument = doc.getElementById("kinetic-instrument");
    if (label?.textContent && instrument?.dataset.materialPrototype === "roughness") break;
    await sleep(100);
  }
  await doc.fonts.ready;
  await sleep(300);
  return { iframe, doc, svg: doc.getElementById("kinetic-wheel") };
}

const unitsPerPx = svg => 1 / (svg.getScreenCTM()?.a || 1);

function overlay(doc, svg) {
  const g = svgEl(doc, svg, "g", { id: "rs-overlay", "aria-hidden": "true" });
  const cursor = svg.querySelector("#cursor-layer");
  if (cursor?.parentNode === svg) svg.insertBefore(g, cursor);
  return g;
}

function veil(doc, g, r0, r1, keep = null) {
  const c = WHEEL_CENTER;
  if (!keep) {
    svgEl(doc, g, "path", { class: "rs-veil", d: annularSectorPath(c, r0, r1, FAN.start, FAN.end) });
    return;
  }
  svgEl(doc, g, "path", { class: "rs-veil", d: annularSectorPath(c, r0, r1, FAN.start, keep[0]) });
  svgEl(doc, g, "path", { class: "rs-veil", d: annularSectorPath(c, r0, r1, keep[1], FAN.end) });
}

// Angular extent (wheel degrees) and right edge (wheel x) of what is lit under
// the needle: the active cells and their labels, measured from the live DOM.
function litColumn(svg, scope = svg) {
  const inv = svg.getScreenCTM().inverse();
  const toWheel = (x, y) => new DOMPoint(x, y).matrixTransform(inv);
  let lo = CURSOR_ANGLE, hi = CURSOR_ANGLE, right = WHEEL_CENTER.x;
  const nodes = [...scope.querySelectorAll(".active-cycle-label, .active-annual-label")];
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    if (!r.width) continue;
    for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]) {
      const p = toWheel(x, y);
      const a = Math.atan2(p.y - WHEEL_CENTER.y, p.x - WHEEL_CENTER.x) * 180 / Math.PI;
      lo = Math.min(lo, a); hi = Math.max(hi, a);
      if (node.matches(".active-cycle-label, .active-annual-label")) right = Math.max(right, p.x);
    }
  }
  return { keep: [Math.min(lo - .6, CURSOR_ANGLE - 3.1), Math.max(hi + .6, CURSOR_ANGLE + 3.1)], right };
}

function tangentText(doc, g, r, a, text, attrs) {
  const p = pointAt(WHEEL_CENTER, r, a);
  return svgEl(doc, g, "text", {
    x: p.x, y: p.y, "text-anchor": "middle", "dominant-baseline": "central",
    transform: `rotate(${a + 90} ${p.x} ${p.y})`, ...attrs
  }, text);
}

// 0.1b: light falls on the column under the needle; nothing is boxed.
function lightTheColumn(doc, svg, mobile) {
  const u = unitsPerPx(svg);
  const g = overlay(doc, svg);
  const lit = litColumn(svg);
  const bands = [
    ["#year-track", RADII.monthOuter, RADII.yearOuter],
    ["#month-track", RADII.solarOuter, RADII.monthOuter],
    ["#zodiac-track", RADII.solarTermOuter, RADII.solarOuter],
    ["#solar-track", RADII.dayOuter, RADII.solarTermOuter],
    ["#day-track", RADII.hourOuter, RADII.dayOuter],
    ["#hour-track", RADII.inner, RADII.hourOuter]
  ];
  for (const [sel, r0, r1] of bands) {
    const scope = svg.querySelector(sel);
    const own = scope ? litColumn(svg, scope) : lit;
    const k = own.keep[1] - own.keep[0] > 1 ? own.keep : lit.keep;
    veil(doc, g, r0, r1, k);
  }
  const rows = [
    ["年柱", "看立春換年 · 60 年一輪", RADII.monthOuter, RADII.yearOuter],
    ["月柱", "看「節」換月 · 一年 12 個月", RADII.solarOuter, RADII.monthOuter],
    ["節", "白露：月柱在這裡換", RADII.dayOuter, RADII.solarTermOuter],
    ["日柱", "每天走一格 · 60 天一輪", RADII.hourOuter, RADII.dayOuter],
    ["時柱", "每 2 小時走一格 · 一天 12 格", RADII.inner, RADII.hourOuter]
  ];
  for (const [name, note, r0, r1] of rows) {
    const p = pointAt(WHEEL_CENTER, (r0 + r1) / 2, CURSOR_ANGLE);
    const x0 = lit.right + 10 * u, x1 = lit.right + (mobile ? 30 : 40) * u;
    svgEl(doc, g, "line", { class: "rs-leader", x1: x0, y1: p.y, x2: x1 - 8 * u, y2: p.y, "stroke-width": .8 * u });
    svgEl(doc, g, "text", { class: "rs-name", x: x1, y: p.y + (mobile ? 5 : -2) * u, "font-size": (mobile ? 14 : 16) * u }, name);
    if (!mobile) svgEl(doc, g, "text", { class: "rs-note", x: x1, y: p.y + 18 * u, "font-size": 13 * u }, note);
  }
}

// 1.2: the month ring's lacquer carries the Gregorian 400-year cycle.
function gregorianGap(doc, svg, mobile, delta, focus = "calendar") {
  const u = unitsPerPx(svg);
  const state = recurrenceState(BASE_DATE, delta);
  const g = overlay(doc, svg);
  const c = WHEEL_CENTER;
  const r0 = RADII.solarOuter, r1 = RADII.monthOuter;
  const at = state.phases.gregorian;
  const angleOf = v => CURSOR_ANGLE + signed(v - at, 400) * .9;

  // focus: the sun's band and the hour ring wait for chapters 02 / 03
  veil(doc, g, RADII.inner, RADII.hourOuter);
  if (focus === "calendar") veil(doc, g, RADII.dayOuter, RADII.solarOuter);
  else {
    veil(doc, g, RADII.solarTermOuter, RADII.yearOuter);
    veil(doc, g, RADII.hourOuter, RADII.dayOuter);
  }

  for (let v = 0; v < 400; v += 5) {
    const a = angleOf(v);
    if (a < FAN.start || a > FAN.end) continue;
    const major = v % 50 === 0, ten = v % 10 === 0;
    const len = major ? 26 : ten ? 14 : 8;
    const p0 = pointAt(c, r0, a), p1 = pointAt(c, r0 + len, a);
    svgEl(doc, g, "line", { class: `ring-tick${major ? " major" : ""}`, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
    if (major && v !== 0) tangentText(doc, g, (r0 + r1) / 2 + 8, a, `${v}`, { class: "rs-greg-label", "font-size": (mobile ? 11 : 13) * u });
  }

  // Ring names take the place of the resting 干支 labels they would cover.
  const nameAngle = mobile ? -117 : -123;
  for (const [name, a0, a1] of [["年序 · 60 年", RADII.monthOuter, RADII.yearOuter], ["公曆 · 400 年", r0, r1], ["日序 · 60 日", RADII.hourOuter, RADII.dayOuter]]) {
    const label = tangentText(doc, g, (a0 + a1) / 2, nameAngle, name, { class: "rs-ring-name", "font-size": (mobile ? 11 : 12) * u });
    const box = label.getBoundingClientRect();
    for (const other of svg.querySelectorAll(".cycle-label:not(.active-cycle-label)")) {
      const r = other.getBoundingClientRect();
      if (r.width && r.left < box.right + 6 && r.right > box.left - 6 && r.top < box.bottom + 4 && r.bottom > box.top - 4) other.style.visibility = "hidden";
    }
  }

  const zero = angleOf(0);
  const off = signed(at, 400);
  if (off !== 0) {
    const e0 = pointAt(c, r0 + 4, zero), e1 = pointAt(c, r1 - 4, zero);
    svgEl(doc, g, "line", { class: "rs-echo", x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": 1.6 * u });
    tangentText(doc, g, (r0 + r1) / 2 + 8, zero + (mobile ? -1.2 : 2.6), "2026 的起點", { class: "rs-echo-label", "font-size": (mobile ? 11 : 12) * u, "text-anchor": mobile ? "end" : "start" });
  }

  if (off === 0) {
    // 2.1: the home band already carries its own engraved name (太陽); only light changes
    if (focus === "sun") return { state };
    for (const [ra, rb] of [[RADII.monthOuter, RADII.yearOuter], [r0, r1], [RADII.hourOuter, RADII.dayOuter]]) {
      const p = pointAt(c, (ra + rb) / 2, CURSOR_ANGLE);
      svgEl(doc, g, "text", { class: "rs-back", x: p.x - 46 * u, y: p.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": (mobile ? 11 : 13) * u }, "回到起點");
    }
    return { state };
  }
  const gapR = r1 - 10;
  svgEl(doc, g, "path", { class: "rs-gap", "stroke-width": 3 * u, d: arcPath(c, gapR, Math.min(zero, CURSOR_ANGLE), Math.max(zero, CURSOR_ANGLE)) });
  const ga = (zero + CURSOR_ANGLE) / 2;
  tangentText(doc, g, gapR - 20 * u, ga, `還差 ${Math.abs(off)} 年`, { class: "rs-gap-label", "font-size": (mobile ? 15 : 18) * u });

  for (const [ra, rb] of [[RADII.monthOuter, RADII.yearOuter], [RADII.hourOuter, RADII.dayOuter]]) {
    const p = pointAt(c, (ra + rb) / 2, CURSOR_ANGLE);
    svgEl(doc, g, "text", { class: "rs-back", x: p.x - 46 * u, y: p.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": (mobile ? 11 : 13) * u }, "回到起點");
  }
  return { state };
}

// Push in: give the home page a larger viewport so its own camera draws the
// wheel bigger (sharp vectors and material), then put the needle back on top.
function pushIn(iframe, doc, scale, needleX, shrink = 1) {
  iframe.style.width = `${innerWidth * scale / shrink}px`;
  iframe.style.height = `${innerHeight * scale / shrink}px`;
  iframe.style.transformOrigin = "0 0";
  iframe.style.transform = shrink === 1 ? "" : `scale(${shrink})`;
  return new Promise(resolve => setTimeout(() => {
    const r = doc.querySelector(".cursor-cap")?.getBoundingClientRect();
    if (r) {
      iframe.style.left = `${needleX - (r.left + r.width / 2) * shrink}px`;
      iframe.style.top = `${84 - r.top * shrink}px`;
    }
    resolve();
  }, 1200));
}

// 2.2: the twelve Jie on the sun's own band. Silver = where the 2026 Sun meets
// each Jie; warm = where the 26026 Sun already is at that same calendar moment.
// Arc length uses the mean solar rate (about 0.986 degrees a day).
function jieShift(doc, svg, mobile, sunLongitude) {
  const u = unitsPerPx(svg);
  const g = overlay(doc, svg);
  const c = WHEEL_CENTER;
  veil(doc, g, RADII.inner, RADII.dayOuter);
  veil(doc, g, RADII.solarTermOuter, RADII.yearOuter);
  const r0 = RADII.dayOuter, r1 = RADII.solarTermOuter;
  const angleOf = lambda => CURSOR_ANGLE + signed(lambda - sunLongitude, 360);
  const rate = 360 / 365.2422;
  const values = [];
  for (const term of solarTerms.filter(t => t.kind === "jie")) {
    const days = -DRIFT.driftDays[indexForLongitude(term.longitude)];
    values.push(days);
    const a0 = angleOf(term.longitude), a1 = a0 + days * rate;
    if (a1 < FAN.start - 2 || a0 > FAN.end + 2) continue;
    const lead = Math.abs(a0 - CURSOR_ANGLE) < .5;
    const e0 = pointAt(c, r0 + 3, a0), e1 = pointAt(c, r1 - 3, a0);
    svgEl(doc, g, "line", { class: "rs-echo", x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": 1.4 * u });
    const s0 = pointAt(c, r0 + 3, a1), s1 = pointAt(c, r1 - 3, a1);
    svgEl(doc, g, "line", { class: "rs-sun-mark", x1: s0.x, y1: s0.y, x2: s1.x, y2: s1.y, "stroke-width": 1.8 * u });
    const arcR = r1 + 9;
    svgEl(doc, g, "path", { class: lead ? "rs-gap" : "rs-shift", "stroke-width": (lead ? 3 : 2) * u, d: arcPath(c, arcR, a0, a1) });
    const mid = (a0 + a1) / 2;
    if (lead) tangentText(doc, g, arcR + 22 * u, mid, "提早 " + days.toFixed(1) + " 天", { class: "rs-gap-label", "font-size": (mobile ? 15 : 18) * u });
    else tangentText(doc, g, arcR + 16 * u, mid, days.toFixed(1) + " 天", { class: "rs-shift-value", "font-size": (mobile ? 11 : 12) * u });
  }
  const p = pointAt(c, r0 - 18 * u, CURSOR_ANGLE);
  svgEl(doc, g, "text", { class: "rs-echo-label", x: p.x + (mobile ? 8 : -8) * u, y: p.y, "text-anchor": mobile ? "start" : "end", "dominant-baseline": "central", "font-size": (mobile ? 11 : 12) * u }, "2026 立春");
  return { min: Math.min(...values), max: Math.max(...values) };
}

function panWide(iframe, doc, width, needleX) {
  iframe.style.width = `${width}px`;
  return new Promise(resolve => setTimeout(() => {
    const r = doc.querySelector(".cursor-cap")?.getBoundingClientRect();
    if (r) iframe.style.left = `${needleX - (r.left + r.width / 2)}px`;
    resolve();
  }, 1200));
}

async function render() {
  const params = new URLSearchParams(location.search);
  const frame = FRAMES[params.get("f")] ? params.get("f") : "open0";
  document.body.classList.toggle("capture", params.has("capture"));
  const mobile = innerWidth < 700;
  const copy = { kicker: "", title: "", body: "" };
  const { iframe, doc, svg } = await loadWheel(frame);

  if (frame === "open1") {
    lightTheColumn(doc, svg, mobile);
    copy.kicker = "序 · 2026 年 9 月 13 日 下午 3 點";
    copy.title = "一個時刻，四組干支。";
    copy.body = mobile ? "四圈什麼時候會一起回到同一組干支？" : "四個圈各轉各的；要問的是，它們什麼時候會一起回到同一組干支？";
  } else if (frame === "gap") {
    document.querySelector(".rs-topbar").hidden = false;
    // Mobile: the home camera's horizontal reach is set by aspect ratio, so a
    // wider (compact-camera) viewport is panned: needle at the left, gap in view.
    if (mobile) await panWide(iframe, doc, 680, 46);
    else await pushIn(iframe, doc, 1.12, innerWidth / 2);
    const { state } = gregorianGap(doc, svg, mobile, FRAMES.gap.delta);
    copy.kicker = `01 · 曆法上的週期 · +${fmt(state.deltaYears)} 年`;
    copy.title = "年柱、日柱回來了，公曆還差 20 年。";
    copy.body = "公曆 400 年一輪；它的起點要再轉 20 年才回到針下。";
  } else if (frame === "closure") {
    const { state } = gregorianGap(doc, svg, mobile, FRAMES.closure.delta);
    copy.kicker = "01 · 曆法上的週期 · +" + fmt(state.deltaYears) + " 年 · " + state.targetDate.year + " 年 9 月 13 日";
    copy.title = fmt(state.deltaYears) + " 年，三圈一起回到起點。";
    copy.body = "這是曆法上的候選。公曆只代表季節；真正的太陽呢？";
  } else if (frame === "sun") {
    gregorianGap(doc, svg, mobile, FRAMES.sun.delta, "sun");
    copy.kicker = "02 · 天文上的節氣";
    copy.title = "公曆對上了，但公曆不是太陽。";
    copy.body = "黃銅帶是太陽真正走到的位置。節氣跟著太陽走，不跟著公曆走。";
  } else if (frame === "jie") {
    document.querySelector(".rs-topbar").hidden = false;
    if (mobile) await panWide(iframe, doc, 680, 46);
    const r = jieShift(doc, svg, mobile, FRAMES.jie.jie);
    copy.kicker = "02 · 天文上的節氣 · 2026 對 " + DRIFT.targetYear;
    copy.title = "十二個節全部提早 " + r.min.toFixed(1) + "–" + r.max.toFixed(1) + " 天。";
    copy.body = "銀線是 2026 年太陽到節的位置；同一個公曆時刻，24,000 年後的太陽已經先走到金線。";
  }

  document.getElementById("rs-kicker").textContent = copy.kicker;
  document.getElementById("rs-title").textContent = copy.title;
  document.getElementById("rs-body").textContent = copy.body;

  const nav = document.querySelector(".rs-frames");
  nav.replaceChildren(...Object.entries(FRAMES).map(([id, f]) => {
    const a = document.createElement("a");
    a.href = `?f=${id}`; a.textContent = f.label;
    if (id === frame) a.setAttribute("aria-current", "true");
    return a;
  }));
  document.documentElement.dataset.ready = "true";
}

render();

// Research scenes — stage C: scroll-driven prologue + chapter 01 on the REAL
// home instrument (index.html in a same-origin iframe).
//
// Every frame is a pure function of scroll progress: render(sceneIndex, p).
// Ring poses are derived from Δ years through recurrenceState(); Δ advances in
// whole cycle steps (60 / 400 / 1,200 years) so rings never spin fast enough to
// strobe. Between steps a ring turns the shortest way to its next pose.
//
// Prototype limits: the WebGL micro-surface of the home rings does not follow
// manual SVG rotation (it is a faint texture); production should drive the
// renderer's own pose API instead.
import { recurrenceState } from "../../src/recurrence/gregorian-cycle.js";
import { cycleItem } from "../../src/sexagenary-data.js";
import { CURSOR_ANGLE, FAN, RADII, WHEEL_CENTER } from "../../src/wheel/ring-model.js";
import { annularSectorPath, arcPath, pointAt } from "../../src/wheel/polar-geometry.js";
import { solarTerms } from "../../src/data.js";
import { SEASONAL_DRIFT_26026_RESEARCH as DRIFT, indexForLongitude } from "../../src/research/seasonal-drift-26026-research-data.js";
import { liChunDriftAccumulation } from "../../src/research/li-chun-drift-accumulation.js";
import { futureDeltaTOneSigmaSeconds } from "../../src/astronomy/deep-time-earth-rotation.js";
import { solarLongitudeAtInstant } from "../../src/wheel/atlas-display-model.js";
import { solarTermShapeResiduals } from "../../src/recurrence/berger-orbit.js";
import { resolveBirthPillars } from "../../src/calendar/tyme-adapter.js";

const NS = "http://www.w3.org/2000/svg";
const BASE_DATE = Object.freeze({ year: 2026, month: 9, day: 13 });
const BASE_INSTANT = "2026-09-13T15:00:00+08:00";
const mod = (v, n) => ((v % n) + n) % n;
const signed = (v, n) => { const m = mod(v, n); return m > n / 2 ? m - n : m; };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = WHEEL_CENTER;

const BAND = {
  year: [RADII.monthOuter, RADII.yearOuter],
  greg: [RADII.solarOuter, RADII.monthOuter],
  zodiac: [RADII.solarTermOuter, RADII.solarOuter],
  solar: [RADII.dayOuter, RADII.solarTermOuter],
  day: [RADII.hourOuter, RADII.dayOuter],
  hour: [RADII.inner, RADII.hourOuter]
};
const BANDS = Object.keys(BAND);
const VEIL = .58;

const STYLE = `
  .kinetic-topbar .site-nav a { pointer-events: none; }
  .atlas-intro, .instrument-toolbar, #classification-overlay-legend, .timeline-dock,
  .state-strip, #atlas-drag-hint, #ganzhi-inspector { display: none !important; }
  :is(.instrument-readout, #mobile-time-dock, .ring-legend) { transition: opacity .45s ease; }
  html[data-rs-chrome="off"] :is(.instrument-readout, #mobile-time-dock, .ring-legend) { opacity: 0 !important; visibility: hidden !important; transition: opacity .45s ease, visibility 0s linear .45s; }
  html[data-rs-topbar="off"] .kinetic-topbar { visibility: hidden; }
  html[data-rs-greg] #month-track > * { opacity: var(--rs-month, 0); }
  html[data-rs-manual] #kinetic-wheel :is(#year-track, #day-track) text[data-offscreen] { display: inline !important; }
  html[data-rs-manual] :is(#year-track, #day-track) .active-cycle-label { display: none; }
  html[data-rs-manual] :is(#year-track, #day-track) .cycle-label.is-active-shadowed { visibility: visible; }
  html[data-rs-manual] :is(#year-track, #day-track) .cycle-sector.is-active { fill: transparent !important; }
  html[data-rs-split] #day-track :is(.cycle-label, .active-cycle-label) { opacity: var(--rs-day-labels, 1); }
  .rs-name-clear { visibility: hidden !important; }
  #kinetic-wheel .cycle-label.rs-lit {
    font-size: 20px !important; font-weight: 600 !important; fill: #f1e8d4 !important; letter-spacing: .1em;
    paint-order: stroke; stroke: rgba(7, 9, 13, .45); stroke-width: 3px; stroke-linejoin: round;
    opacity: var(--rs-read, 1);
  }
  .rs-veil { fill: #090c11; }
  .rs-lit-cell { fill: rgba(150, 164, 182, .15); }
  .rs-name { font-family: var(--lq-serif); font-weight: 500; fill: rgba(232, 226, 210, .86); letter-spacing: .12em; }
  .rs-note { font-family: "Noto Sans TC", sans-serif; fill: rgba(206, 212, 216, .5); letter-spacing: .04em; }
  .rs-leader { stroke: rgba(206, 212, 216, .26); fill: none; }
  .rs-ring-name { font-family: var(--lq-serif); fill: rgba(206, 212, 216, .5); letter-spacing: .14em; }
  .rs-greg-label { font-family: var(--lq-serif); font-weight: 500; fill: rgba(204, 212, 222, .5); }
  .rs-echo { stroke: rgba(214, 224, 236, .78); }
  .rs-trail { stroke: rgba(214, 224, 236, .5); }
  .rs-echo-label { font-family: "Noto Sans TC", sans-serif; fill: rgba(214, 224, 236, .78); letter-spacing: .04em; }
  .rs-gap { fill: none; stroke: #c8664f; stroke-linecap: round; }
  .rs-gap-label { font-family: "Noto Sans TC", sans-serif; font-weight: 500; fill: #d9806a; }
  .rs-back { font-family: "Noto Sans TC", sans-serif; fill: rgba(240, 226, 196, .72); letter-spacing: .06em; }
  .rs-split { font-family: var(--lq-serif); font-weight: 500; fill: rgba(204, 212, 222, .34) !important; }
  .rs-split.hit { fill: #f1e8d4 !important; font-weight: 600; }
  html[data-rs-band] :is(#solar-track, #zodiac-track) text[data-offscreen] { display: inline !important; }
  html[data-rs-band] :is(#solar-track, #zodiac-track) :is(.active-cycle-label, .active-annual-label) { display: none; }
  html[data-rs-band] :is(#solar-track, #zodiac-track) text:not(.active-cycle-label):not(.active-annual-label) { visibility: visible !important; }
  .rs-sun-mark { stroke: #ffe3a3; }
  #rs-overlay .rs-echo.on-band { stroke: rgba(190, 210, 236, .82); }
  .rs-shift { fill: none; stroke: rgba(233, 207, 149, .7); stroke-linecap: round; }
  .rs-shift-value { font-family: "Noto Sans TC", sans-serif; fill: rgba(240, 226, 196, .8); }
  .rs-sun-label { font-family: "Noto Sans TC", sans-serif; fill: rgba(240, 220, 174, .9); letter-spacing: .04em; }
  .rs-haze { fill: rgba(214, 224, 236, .1); }
  .rs-haze-edge { stroke: rgba(214, 224, 236, .55); stroke-dasharray: 3 4; }
  .rs-haze-label { font-family: "Noto Sans TC", sans-serif; fill: rgba(222, 230, 240, .82); letter-spacing: .04em; }
  .rs-trail-tag { font-family: "Noto Sans TC", sans-serif; fill: rgba(214, 224, 236, .62); letter-spacing: .02em; }
  .rs-row-name { font-family: "Noto Sans TC", sans-serif; fill: rgba(206, 212, 216, .56); letter-spacing: .06em; }
`;

// ---------------------------------------------------------------- scenes
// Each scene: length in viewport heights, and a pure state(p, ctx).
const SCENES = [];
const scene = (id, length, state) => SCENES.push({ id, length, state });

const veils = (lit, amount = VEIL) => Object.fromEntries(BANDS.map(b => [b, lit.includes(b) ? 0 : amount]));
const mixVeils = (a, b, t) => Object.fromEntries(BANDS.map(k => [k, lerp(a[k], b[k], t)]));
const NONE = veils(BANDS, 0);
const CAL = veils(["year", "greg", "day"]);
const YD = veils(["year", "day"]);

function pose(delta) {
  const s = recurrenceState(BASE_DATE, delta);
  return {
    delta,
    year: -mod(s.phases.yearSequence, 60) * 6,
    day: -mod(s.phases.day, 60) * 6,
    greg: -mod(s.phases.gregorian, 400) * .9,
    state: s
  };
}
const mixPose = (a, b, t) => ({
  delta: t < .5 ? a.delta : b.delta,
  year: a.year + signed(b.year - a.year, 360) * t,
  day: a.day + signed(b.day - a.day, 360) * t,
  greg: a.greg + signed(b.greg - a.greg, 360) * t,
  state: t < .5 ? a.state : b.state
});

// A stepped scene: rewind from `from`, step through deltas, hold.
function stepper(deltas, from, p) {
  const rewind = clamp(p / .08), run = clamp((p - .08) / .84);
  if (p < .08) return { pose: mixPose(from, pose(deltas[0]), ease(rewind)), k: 0, done: [] };
  const n = deltas.length - 1;
  const x = run * n, k = Math.min(n - 1, Math.floor(x)), t = x - k;
  const move = ease(clamp(t / .55));
  const a = pose(deltas[k]), b = pose(deltas[k + 1]);
  const current = run >= 1 ? b : mixPose(a, b, move);
  const doneCount = run >= 1 ? n + 1 : k + 1 + (move >= 1 ? 1 : 0);
  return { pose: current, k, done: deltas.slice(0, doneCount).map(pose) };
}

const NAME_ANGLE = () => (ctx.mobile ? -117 : -123);
const range = (n, step) => Array.from({ length: n + 1 }, (_, i) => i * step);
const P0 = pose(0);

// The next time the same four pillars appear at all (any date): only a 丙午 year
// can match, and only in its 酉 month (Sep–Oct), so scanning those days is enough.
const NEXT_SAME = (() => {
  const at = (year, month, day) => JSON.stringify(resolveBirthPillars({ year, month, day, hour: 15 }).pillars);
  const key = at(BASE_DATE.year, BASE_DATE.month, BASE_DATE.day);
  for (let k = 1; k <= 12; k++) {
    const year = BASE_DATE.year + 60 * k;
    for (const [month, days] of [[9, 30], [10, 31]]) for (let day = 1; day <= days; day++)
      if (at(year, month, day) === key) return { year, month, day, after: 60 * k };
  }
  return null;
})();

scene("open0", .7, () => ({
  chrome: false, topbar: true, veil: NONE,
  copy: { kicker: "研究 · 2026 年 9 月 13 日 下午 3 點", title: "同一組八字，多久會再出現一次？", body: "從這一刻開始找。" }
}));
// Three different returns: the same bazi on any date (180 yrs); the same date
// and time with the same bazi (1,980 yrs, chapter 一); the whole calendar,
// every day and every leap year, back in step (24,000 yrs): the period this
// page looks for.
scene("open1", 2.6, p => ({
  chrome: false, topbar: true, column: ease(clamp(p / .2)), veil: NONE,
  copy: p < .36
    ? { kicker: "序 · 2026 年 9 月 13 日 下午 3 點", title: "針下這一欄，就是八字。", body: "年、月、日、時四組干支，各轉各的圈，週期都不一樣。" }
    : p < .7
      ? { kicker: "序 · 再出現", title: `同一組八字，${NEXT_SAME.after} 年後就會再出現。`, body: `下一次是 ${NEXT_SAME.year} 年 ${NEXT_SAME.month} 月 ${NEXT_SAME.day} 日下午 3 點，日期不一樣。之後每隔 60 或 180 年再出現一次，沒有固定間隔。` }
      : { kicker: "序 · 要找什麼", title: "要找的：整套曆法回到原點。", body: "不只這一天：往後每一天的八字、哪幾年閏年，都和從 2026 年起排的一模一樣。這才是週期。" }
}));
scene("split", 2, p => ({
  chrome: false, topbar: true, column: 1 - ease(clamp(p / .25)),
  veil: mixVeils(NONE, veils(["day"]), ease(clamp(p / .25))),
  split: ease(clamp((p - .15) / .35)), hits: ease(clamp((p - .55) / .3)),
  copy: { kicker: "序 · 日柱 庚寅", title: "天干 10 個、地支 12 個，60 格才重複一次。", body: "日柱就這樣 60 天一輪；年柱同理，60 年一輪。" }
}));
scene("merge", .9, p => ({
  chrome: false, topbar: true, veil: mixVeils(veils(["day"]), YD, ease(clamp(p / .6))),
  split: 1 - ease(clamp(p / .4)),
  copy: { kicker: "序 · 日柱 庚寅", title: "天干 10 個、地支 12 個，60 格才重複一次。", body: "日柱就這樣 60 天一輪；年柱同理，60 年一輪。" }
}));

// 2026 dates of the Jie (the Sun reaching each longitude), for labels.
let jieDates = null;
function jieDate2026(lambda) {
  jieDates ??= {};
  if (jieDates[lambda]) return jieDates[lambda];
  const start = Date.UTC(2026, 0, 1) + mod(lambda - 280, 360) / 360 * 365.2422 * 864e5 - 6 * 864e5;
  let lo = start, hi = start + 12 * 864e5;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (signed(solarLongitudeAtInstant(mid) - lambda, 360) >= 0) hi = mid; else lo = mid; }
  const d = new Date(hi + 8 * 3600e3);
  return (jieDates[lambda] = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
}

// Before the Gregorian ring replaces the month ring: why it may stand in for the Sun.
const SUN_LIT = { year: VEIL, greg: 0, solar: 0, zodiac: .3, day: VEIL, hour: VEIL };
scene("sun", 2.6, p => {
  const step = p < .45 ? 0 : p < .72 ? 1 : 2;
  const into = ease(clamp(p / .12)), dates = ease(clamp((p - .47) / .12)), swap = ease(clamp((p - .74) / .2));
  const marks = JIE.map(t => ({ lambda: t.longitude, cls: "rs-echo", w: 1.4, o: dates, label: `${t.name} ${jieDate2026(t.longitude)}` }));
  const copies = [
    { kicker: "序 · 月柱", title: "月柱不數格子，它跟著太陽換。", body: "黃銅帶是太陽一年走的一圈。二十四節氣裡有十二個「節」；太陽每過一個節，月柱換一格：白露到寒露之間是酉月。" },
    { kicker: "序 · 月柱", title: "公曆也跟著太陽，所以先用公曆來找。", body: "節每年幾乎落在同一天：白露約 9/7，寒露約 10/8。月圈先換成公曆，它 400 年一輪。" }
  ];
  return {
    chrome: false, topbar: true, wide: true, pan: 0,
    veil: step < 2 ? mixVeils(YD, SUN_LIT, into) : mixVeils(SUN_LIT, CAL, swap),
    greg: swap,
    band: step < 2 || swap < .5 ? {
      view: sun0(),
      window: { from: jieByName["白露"].longitude, to: jieByName["寒露"].longitude, o: into * (1 - swap), label: "酉月：白露到寒露" },
      marks: marks.map(mk => ({ ...mk, o: mk.o * (1 - swap) }))
    } : null,
    copy: copies[Math.min(step, 1)]
  };
});
const C11 = range(33, 60);
scene("c11", 3, p => {
  const st = stepper(C11, P0, p);
  return {
    manual: true, wide: true, veil: CAL, greg: 1, pose: st.pose, marks: true,
    ledger: { title: "每步 60 年", poses: st.done, n: C11.length, o: ease(clamp(p / .06)) },
    back: p > .93 ? ["year", "day"] : [],
    copy: { kicker: `一 曆法 · +${fmt(st.pose.delta)} 年`, title: "每 60 年，年柱回到丙午；日柱要等第 33 次。", body: "1,980 年後，年柱和日柱第一次一起回到起點。" }
  };
});
scene("c12", 1.4, p => ({
  manual: true, wide: true, veil: CAL, greg: 1, pose: pose(1980), marks: true, back: ["year", "day"],
  ledger: { title: "每步 60 年", poses: C11.map(pose), n: C11.length, flag: "greg" },
  push: ease(clamp(p / .5)), gap: ease(clamp((p - .3) / .4)),
  copy: { kicker: "一 曆法 · +1,980 年", title: "但公曆還差 20 年。", body: "這一天已經對上：同一天、同一刻、同一組八字，1,980 年後就有。但閏年的排法 400 年一輪，還沒回來：往後有些日子的日柱會差一天。" }
}));
scene("c13", 3, p => {
  const st = stepper(range(20, 60), pose(1980), p);
  return {
    manual: true, wide: true, veil: mixVeils(CAL, veils(["greg", "year"]), ease(clamp(p / .1))), greg: 1, pose: st.pose, marks: true,
    trail: { ring: "greg", poses: st.done }, back: p > .93 ? ["year", "greg"] : [],
    ledger: { title: "每步 60 年", poses: st.done, n: 21 },
    copy: { kicker: `一 曆法 · 第 ${Math.round(st.pose.delta / 60)} 次 · +${fmt(st.pose.delta)} 年`, title: "每跳 60 年，公曆的起點往前挪一段。", body: "跳到第 20 次（1,200 年），公曆和年柱一起回來。" }
  };
});
scene("c14", 3, p => {
  const st = stepper(range(20, 400), pose(1200), p);
  return {
    manual: true, wide: true, veil: mixVeils(veils(["greg", "year"]), veils(["greg", "day"]), ease(clamp(p / .1))), greg: 1, pose: st.pose, marks: true,
    trail: { ring: "day", poses: st.done }, back: p > .93 ? ["greg", "day"] : [],
    ledger: { title: "每步 400 年", poses: st.done, n: 21 },
    copy: { kicker: `一 曆法 · 第 ${Math.round(st.pose.delta / 400)} 個 400 年 · +${fmt(st.pose.delta)} 年`, title: "400 年有 146,097 天，日柱每次差 3 格。", body: "要 20 個 400 年（8,000 年），日柱才回到庚寅。" }
  };
});
scene("c15", 3.2, p => {
  const st = stepper(range(20, 1200), pose(8000), p);
  const end = p > .93;
  return {
    manual: true, wide: true, veil: mixVeils(veils(["greg", "day"]), CAL, ease(clamp(p / .1))), greg: 1, pose: st.pose, marks: true,
    trail: { ring: "day", poses: st.done }, back: end ? ["year", "greg", "day"] : [],
    ledger: { title: "每步 1,200 年", poses: st.done, n: 21 },
    copy: end
      ? { kicker: "一 曆法 · +24,000 年", title: "24,000 年，三圈一起回到起點。", body: "這是曆法上的候選。公曆只代表季節；真正的太陽呢？" }
      : { kicker: `一 曆法 · 第 ${Math.round(st.pose.delta / 1200)} 次 · +${fmt(st.pose.delta)} 年`, title: "年柱和公曆每 1,200 年對上，再等日柱。", body: "1,200 和 8,000 的最小公倍數：24,000 年。" }
  };
});

// ---------------------------------------------------------------- chapter 02
// The brass band carries solar longitude. The needle is always "now": the Sun
// at the moment in question. Silver = where the 2026 Sun was (echo); warm =
// where the later Sun is at the same Gregorian moment. Band views are given as
// the longitude under the needle; the band turns the shortest way between them.
const RATE = 360 / 365.2422; // mean solar motion, degrees a day
const earlyDays = lambda => -DRIFT.driftDays[indexForLongitude(lambda)];
const JIE = solarTerms.filter(t => t.kind === "jie");
const jieByName = Object.fromEntries(JIE.map(t => [t.name, t]));
const LI_CHUN = liChunDriftAccumulation();
const PERI = { from: DRIFT.baseEllipse.perihelionSolarLongitudeDegrees, to: DRIFT.targetEllipse.perihelionSolarLongitudeDegrees };
const ECC = { from: DRIFT.baseEllipse.eccentricity, to: DRIFT.targetEllipse.eccentricity };
const RANGE = { min: Math.min(...JIE.map(t => earlyDays(t.longitude))), max: Math.max(...JIE.map(t => earlyDays(t.longitude))) };
const SUN_VEIL = { year: VEIL, greg: .45, day: VEIL, hour: VEIL, solar: 0, zodiac: 0 };
const mixAngle = (a, b, t) => a + signed(b - a, 360) * t;

// Walk a list of values like stepper(): rewind, step, hold. Angles by default.
function bandWalk(views, from, p, mix = mixAngle) {
  if (p < .08) return { view: mix(from, views[0], ease(clamp(p / .08))), k: 0, done: 1, settled: false };
  const run = clamp((p - .08) / .84), n = views.length - 1;
  const x = run * n, k = Math.min(n - 1, Math.floor(x)), move = ease(clamp((x - k) / .55));
  if (run >= 1) return { view: views[n], k: n, done: n + 1, settled: true };
  return { view: mix(views[k], views[k + 1], move), k: move >= 1 ? k + 1 : k, done: k + 1 + (move >= 1 ? 1 : 0), settled: move >= 1 || (x - k) < .001 };
}

const P24 = pose(24000);
const sun0 = () => ctx.sun0; // longitude under the needle at the base instant (read from the home)

scene("c21", 2, p => {
  const s0 = sun0(), early = earlyDays(s0), move = ease(clamp((p - .4) / .35));
  const silver = clamp((p - .25) / .12);
  return {
    manual: true, wide: true, pan: ease(clamp(p / .3)), greg: 1, pose: P24, veil: mixVeils(CAL, SUN_VEIL, ease(clamp(p / .3))),
    orbit: { o: ease(clamp((p - .25) / .15)), morph: 1 },
    back: p < .08 ? ["year", "greg", "day"] : [],
    band: {
      view: s0 + early * RATE * move,
      marks: [{ lambda: s0, cls: "rs-echo", o: silver, label: "2026 的太陽", w: 1.6 }],
      arcs: move > .02 ? [{ from: s0, to: s0 + early * RATE * move, cls: "rs-gap", w: 3, label: move > .9 ? `多走了 ${early.toFixed(1)} 天` : null, big: true }] : []
    },
    copy: p < .4
      ? { kicker: "二 太陽 · +24,000 年", title: "公曆對上了。太陽呢？", body: "黃銅帶是太陽真正走到的位置；節跟著太陽走，不跟著公曆走。" }
      : { kicker: "二 太陽 · +24,000 年", title: "同一個公曆時刻，太陽已經走過頭。", body: `24,000 年後的 9 月 13 日下午 3 點，太陽多走了 ${early.toFixed(1)} 天的路。` }
  };
});

const C22_STOPS = ["白露", "寒露", "立冬", "大雪", "小寒", "立春"].map(n => jieByName[n]);
scene("c22", 3.6, p => {
  const s0 = sun0();
  const views = C22_STOPS.map(t => t.longitude + earlyDays(t.longitude) * RATE);
  const w = bandWalk(views, s0 + earlyDays(s0) * RATE, p);
  const focus = C22_STOPS[Math.min(w.k, C22_STOPS.length - 1)];
  const show = ease(clamp(p / .1));
  const marks = [{ lambda: s0, cls: "rs-echo", o: 1 - show, w: 1.6 }], arcs = [];
  for (const t of JIE) {
    const d = earlyDays(t.longitude), lead = t === focus && p > .08;
    marks.push({ lambda: t.longitude, cls: "rs-echo", o: show, w: 1.4 });
    marks.push({ lambda: t.longitude + d * RATE, cls: "rs-sun-mark", o: show, w: 1.8 });
    arcs.push({ from: t.longitude, to: t.longitude + d * RATE, cls: lead ? "rs-gap" : "rs-shift", w: lead ? 3 : 2, o: show, label: lead ? `${t.name}提早 ${d.toFixed(1)} 天` : `${d.toFixed(1)} 天`, big: lead });
  }
  return {
    manual: true, wide: true, pan: 1, greg: 1, pose: P24, veil: SUN_VEIL,
    orbit: { o: 1, morph: 1 },
    band: { view: w.view, marks, arcs },
    copy: { kicker: `二 太陽 · ${focus.name}`, title: `十二個節全部提早 ${RANGE.min.toFixed(1)}–${RANGE.max.toFixed(1)} 天。`, body: "銀線：2026 年太陽到節的位置。金線：同一個公曆時刻，24,000 年後的太陽。" }
  };
});

scene("c23", 3, p => {
  const L = 315, rows = LI_CHUN; // Δ 0, 1,980, 8,000, 24,000 — only source-backed years
  const views = rows.map(r => L - r.driftDays * RATE);
  const w = bandWalk(views, S26(), p);
  const cur = rows[Math.min(w.k, rows.length - 1)];
  const marks = [{ lambda: L, cls: "rs-echo", w: 1.6, label: "2026 立春", tier: 0 }], arcs = [];
  rows.slice(1, w.done).forEach((r, i, list) => {
    const last = i === list.length - 1 && r === cur;
    const e = -r.driftDays;
    marks.push({ lambda: L - r.driftDays * RATE, cls: last ? "rs-sun-mark" : "rs-trail", w: last ? 1.8 : 1.2, warm: last, tier: i + 1,
      label: `+${fmt(r.deltaYears)} 年 · ${e >= 0 ? "早" : "晚"} ${Math.abs(e).toFixed(1)} 天` });
  });
  if (cur.deltaYears) {
    const e = -cur.driftDays;
    arcs.push({ from: L, to: w.view, cls: "rs-gap", w: 3, big: true, label: w.settled ? `${e >= 0 ? "早" : "晚"} ${Math.abs(e).toFixed(1)} 天` : null });
  }
  const word = cur.deltaYears ? `${-cur.driftDays >= 0 ? "提早" : "晚"} ${Math.abs(cur.driftDays).toFixed(1)} 天` : "基準";
  return {
    manual: true, wide: true, pan: 1, greg: 0, pose: P24, veil: mixVeils(YM_VEIL, SUN_VEIL, ease(clamp(p / .08))),
    orbit: { o: 1, morph: 1 },
    band: { view: w.view, marks, arcs },
    copy: { kicker: `二 太陽 · 立春 · +${fmt(cur.deltaYears)} 年 · ${word}`, title: "立春的偏差，是一路累積出來的。", body: "曆法的三個候選年：1,980 年晚半天，8,000 年早 1.8 天，24,000 年早 10.9 天。" }
  };
});

scene("c24", 2.6, p => {
  const start = 315 + earlyDays(315) * RATE;
  const rewind = ease(clamp(p / .15)), move = ease(clamp((p - .4) / .4));
  const view = p < .4 ? mixAngle(start, PERI.from, rewind) : mixAngle(PERI.from, PERI.to, move);
  const o = clamp((p - .12) / .12);
  const marks = [{ lambda: PERI.from, cls: "rs-echo", o, w: 1.8, label: "2026 近日點" }];
  if (move > .97) marks.push({ lambda: PERI.to, cls: "rs-sun-mark", w: 2, label: "26026 近日點", warm: true });
  const arcs = move > .02 ? [{ from: PERI.from, to: view, cls: "rs-shift", w: 2 }] : [];
  return {
    manual: true, wide: true, pan: 1, greg: 0, pose: P24, veil: SUN_VEIL,
    // the signature view: the orbit inset grows and its shape turns from 2026 into 26026
    orbit: { o: 1, big: ease(clamp((p - .12) / .2)), morph: p < .4 ? 1 - rewind : move, peri: true },
    band: { view, marks, arcs },
    copy: p < .4
      ? { kicker: "二 太陽 · 原因", title: "每個節提早多少不一樣，原因在地球軌道。", body: "近日點是太陽走得最快的地方。2026 年，它在小寒附近。" }
      : { kicker: "二 太陽 · 原因", title: "24,000 年後，近日點轉到清明附近。", body: `軌道也幾乎變圓（偏心率 ${ECC.from.toFixed(3)} → ${ECC.to.toFixed(3)}），太陽一年裡快慢的分布全變了。` }
  };
});

// ---------------------------------------------------------------- chapter 03
// 3.1 the Sun settles the year and month pillars; 3.2 the day and hour pillars
// need the Earth's rotation (ΔT), whose ±1σ is drawn as a haze on those rings;
// 3.3 the four pillars return under the needle, as in the prologue.
const S26 = () => sun0() + earlyDays(sun0()) * RATE; // the 26026 Sun at the same Gregorian moment
const MONTH_WINDOW = [jieByName["白露"].longitude, jieByName["寒露"].longitude];
const sigmaHours = delta => futureDeltaTOneSigmaSeconds(2026 + 255 / 365 + delta) / 3600;
const SIGMA = [0, 1980, 8000, 24000].map(d => ({ delta: d, hours: d ? sigmaHours(d) : 0 }));
const YM_VEIL = { year: 0, greg: 0, solar: 0, zodiac: .3, day: VEIL, hour: VEIL };
const DH_VEIL = { year: VEIL, greg: VEIL, solar: VEIL, zodiac: VEIL, day: .22, hour: .22 };
const DEG_PER_HOUR = { day: 6 / 24, hour: 6 / 2 };
const sigmaText = h => (h >= 48 ? `±${(h / 24).toFixed(1)} 天` : `±${h.toFixed(1)} 小時`);

scene("c31", 2.4, p => {
  const turn = ease(clamp(p / .3)), lit = ease(clamp((p - .3) / .2));
  const view = mixAngle(315 + earlyDays(315) * RATE, S26(), turn);
  return {
    manual: true, wide: true, pan: 1, pose: P24,
    orbit: { o: 1, morph: 1 },
    greg: 1 - ease(clamp((p - .15) / .2)),
    veil: mixVeils(SUN_VEIL, YM_VEIL, ease(clamp((p - .1) / .3))),
    band: {
      view,
      window: lit > .01 ? { from: MONTH_WINDOW[0], to: MONTH_WINDOW[1], o: lit, label: "酉月：白露到寒露" } : null,
      marks: [{ lambda: sun0(), cls: "rs-echo", o: lit, w: 1.6, label: "2026 的太陽" }]
    },
    copy: p < .55
      ? { kicker: "二 太陽 · 年柱和月柱", title: "節都提早了，年柱、月柱還對嗎？", body: "看太陽：這一刻，太陽仍在白露和寒露之間。" }
      : { kicker: "二 太陽 · 年柱和月柱", title: "對：仍是丙午年、丁酉月。", body: "立春早就過了，寒露還沒到。節提早十幾天，還不足以換柱。" }
  };
});

scene("c32", 3, p => {
  const w = bandWalk(SIGMA.map(s => s.hours), 0, p, lerp);
  const f = ease(clamp(p / .08)); // the extension's marks and ladder leave
  const cur = SIGMA[Math.min(w.k, SIGMA.length - 1)];
  const lines = {
    0: "地球自轉在變慢；慢多少只能估計，越往後越不準。",
    1980: "+1,980 年：誤差約 ±1.7 小時，時柱可能差一格。",
    8000: "+8,000 年：約 ±21 小時，時柱大半圈都有可能。",
    24000: "+24,000 年：約 ±7 天，日柱可能差七格，時柱整圈都有可能。"
  };
  return {
    manual: true, wide: true, pan: lerp(1, 0, f), pose: P24, greg: 0,
    ...(f < .98 ? extState(EXT_BEST.k - 1, 1 - f) : {}),
    ladder: f < .98 ? { upto: EXT.length - 1, focus: EXT_BEST.k - 1, o: 1 - f } : undefined,
    veil: mixVeils(EXT_VEIL, DH_VEIL, f),
    haze: { hours: w.view, label: w.settled && cur.delta ? sigmaText(cur.hours) : null },
    copy: { kicker: `三 地球自轉 · 誤差範圍 · +${fmt(cur.delta)} 年`, title: "日柱、時柱，要看地球轉到哪裡。", body: lines[cur.delta] }
  };
});

const END_NOTES = {
  "年柱": "看立春 · 可以判定",
  "月柱": "看節 · 可以判定",
  "節": "太陽的位置 · 算得出來",
  "日柱": "要知道地球自轉 · 未定",
  "時柱": "要知道地球自轉 · 未定"
};
// ---------------------------------------------------------------- extension: toward a million years
// Berger (1978) orbit, 41 calendar candidates (every 24,000 years). The twelve
// Jie of 2026 and of the candidate are aligned at the vernal equinox, so only
// their SHAPE differs; that residual (hours) is drawn on the brass band,
// magnified ×EXT_MAG, and the orbit inset takes the candidate's ellipse.
const EXT_MAG = 4;
const EXT = Array.from({ length: 41 }, (_, i) => {
  const delta = 24000 * (i + 1), r = solarTermShapeResiduals(2026, 2026 + delta);
  return { k: i + 1, delta, maxAbs: r.maxAbsHours, hours: Object.fromEntries(r.terms.map(t => [t.longitude, t.residualHours])), e: r.targetParameters.eccentricity, peri: r.targetParameters.perihelionLongitudeDegrees };
});
const EXT_BEST = EXT.reduce((a, b) => (b.maxAbs < a.maxAbs ? b : a));
const EXT_VEIL = { year: VEIL, greg: VEIL, solar: 0, zodiac: .3, day: VEIL, hour: VEIL };
const hoursToDeg = h => h / 24 * RATE * EXT_MAG;

// band + orbit for a (possibly in-between) candidate index; in-between values
// are only the animation between two candidates, never shown as data.
function extState(kf, o = 1) {
  const a = EXT[Math.floor(kf)], b = EXT[Math.min(EXT.length - 1, Math.ceil(kf))], t = kf - Math.floor(kf);
  const marks = [], arcs = [];
  for (const j of JIE) {
    const h = lerp(a.hours[j.longitude], b.hours[j.longitude], t);
    marks.push({ lambda: j.longitude, cls: "rs-echo", w: 1.4, o });
    marks.push({ lambda: j.longitude + hoursToDeg(h), cls: "rs-sun-mark", w: 1.8, o });
    arcs.push({ from: j.longitude, to: j.longitude + hoursToDeg(h), cls: "rs-shift", w: 2, o, label: t < .02 || t > .98 ? `${h > 0 ? "+" : "−"}${Math.abs(h).toFixed(1)} 小時` : null });
  }
  return {
    band: { view: sun0(), marks, arcs },
    orbit: { o, morph: 1, peri: true, target: { e: lerp(a.e, b.e, t), peri: mixAngle(a.peri, b.peri, t), name: `+${fmt((t < .5 ? a : b).delta)} 年` } }
  };
}

scene("x1", 1.6, p => {
  const o = ease(clamp(p / .2)), ext = extState(0, o);
  return {
    manual: true, pose: P24, greg: 0, wide: true, pan: 1, veil: mixVeils(SUN_VEIL, EXT_VEIL, o),
    band: { ...ext.band, view: mixAngle(PERI.to, sun0(), o) },
    orbit: { ...ext.orbit, o: 1, big: 1 - o },
    ladder: { upto: 0, o },
    copy: { kicker: "二 太陽 · 往後找", title: "往後找：哪一次，太陽最像 2026？", body: "近日點會繞一圈轉回來。曆法每 24,000 年對上一次，往後再比 41 次（近 100 萬年）。" }
  };
});

scene("x2", 6, p => {
  const w = bandWalk(EXT.map((_, i) => i), 0, p, lerp);
  const cur = EXT[Math.round(w.view)];
  return {
    manual: true, pose: P24, greg: 0, wide: true, pan: 1, veil: EXT_VEIL,
    ...extState(w.view),
    ladder: { upto: w.view },
    copy: { kicker: `二 太陽 · 第 ${cur.k} 次 · +${fmt(cur.delta)} 年 · 最大差 ${cur.maxAbs.toFixed(1)} 小時`, title: "先讓兩年的春分對齊，再看其他節差多少。", body: `金線越貼近銀線，那一年的節越像 2026。線上的差放大 ×${EXT_MAG}。` }
  };
});

scene("x3", 2.4, p => {
  const from = EXT.length - 1, to = EXT_BEST.k - 1;
  const kf = lerp(from, to, ease(clamp(p / .35)));
  return {
    manual: true, pose: P24, greg: 0, wide: true, pan: 1, veil: EXT_VEIL,
    ...extState(p < .35 ? kf : to),
    ladder: { upto: EXT.length - 1, focus: to },
    copy: p < .6
      ? { kicker: `二 太陽 · 第 ${EXT_BEST.k} 次 · +${fmt(EXT_BEST.delta)} 年`, title: `最接近的是 +${fmt(EXT_BEST.delta)} 年：最大差 ${EXT_BEST.maxAbs.toFixed(1)} 小時。`, body: `軌道也接近 2026：偏心率 ${EXT_BEST.e.toFixed(4)}（2026 是 0.0167），近日點 ${EXT_BEST.peri.toFixed(0)}°（2026 是 283°）。` }
      : { kicker: "二 太陽 · 往後找", title: "最像，也不等於節真的回來。", body: "這裡先讓春分對齊了，整年一起提早或延後的部分沒有算；而且就算太陽回來，日柱、時柱還要看地球自轉。" }
  };
});

// The end answers the opening question. The four pillars return under the
// needle: year and month sharp, day and hour under the ±1σ haze of 三.
scene("end", 2, p => {
  const f = ease(clamp(p / .35));
  return {
    chrome: false, topbar: true, veil: mixVeils(DH_VEIL, NONE, f),
    haze: { hours: SIGMA[3].hours, label: null },
    end: p > .5,
    copy: { kicker: "結論", title: "整套曆法回到原點：曆法上 24,000 年，實際算不出。", body: `年柱、月柱看太陽，回得來；日柱、時柱看地球自轉，24,000 年後已差約 ±7 天。（只看這一天，1,980 年；只看八字，${NEXT_SAME.after} 年。）` }
  };
});

// reading order: 序 → 一 曆法 → 二 太陽 (…往後找) → 三 地球自轉 → 結論
const ORDER = ["open0", "open1", "split", "merge", "sun", "c11", "c12", "c13", "c14", "c15",
  "c21", "c22", "c31", "c23", "c24", "x1", "x2", "x3", "c32", "end"];
SCENES.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
console.assert(SCENES.every(x => ORDER.includes(x.id)) && SCENES.length === ORDER.length, "scene order");

// ---------------------------------------------------------------- iframe
// Any write into the embedded home's SVG, even of the same value, makes the
// browser repaint the whole instrument. Frames come at scroll rate, so every
// write below goes through these and is skipped when nothing changed.
function setAttr(node, name, value) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}
function setStyle(node, name, value) {
  if (!node) return;
  if (value === null) { if (node.style.getPropertyValue(name) !== "") node.style.removeProperty(name); }
  else if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}
// Plates in this page (ledger, ladder, orbit) are rebuilt off-document each
// frame and swapped in only when the drawing actually changed.
function commitSvg(host, built) {
  const markup = built ? built.innerHTML : "";
  if (host.__markup === markup) return;
  host.__markup = markup;
  if (built) host.replaceChildren(...built.childNodes); else host.replaceChildren();
}
function setData(node, key, value) {
  if (value === null) { if (key in node.dataset) delete node.dataset[key]; }
  else if (node.dataset[key] !== value) node.dataset[key] = value;
}
const ctx = { vw: innerWidth, iframe: null, doc: null, svg: null, g: null, gregGroup: null, u: 1, mobile: innerWidth < 700, base: {}, keep: {}, capX: 0, capY: 0, wide: false };

function svgEl(parent, name, attrs = {}, text) {
  const node = ctx.doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}
function tangentText(parent, r, a, text, attrs) {
  const p = pointAt(C, r, a);
  return svgEl(parent, "text", { x: p.x, y: p.y, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(${a + 90} ${p.x} ${p.y})`, ...attrs }, text);
}

// Turn the embedded home instrument to an instant with its own ring dial
// (each ring the shortest way; reduced motion jumps). Resolves when settled.
async function dialHome(instantMs, source) {
  const instrument = ctx.doc.getElementById("kinetic-instrument");
  const View = ctx.doc.defaultView;
  instrument.dispatchEvent(new View.CustomEvent("atlas:set-selected-instant", { detail: { instantMs, source, animate: true } }));
  for (let i = 0; i < 80 && instrument.dataset.dial === "running"; i++) await sleep(50);
}

// Listening from the first moment (even while the home page is still loading):
// a reader who touches, scrolls or presses a key does not wait for the opening.
const openingSkip = (() => {
  const inputs = ["touchstart", "wheel", "keydown", "pointerdown"];
  let resolve;
  const self = { done: false, promise: new Promise(r => { resolve = r; }) };
  const on = () => { self.done = true; resolve(); self.stop(); };
  self.stop = () => { for (const type of inputs) removeEventListener(type, on); };
  for (const type of inputs) addEventListener(type, on, { passive: true });
  return self;
})();

async function boot() {
  const iframe = ctx.iframe = document.getElementById("rs-wheel");
  // Opening: the page first shows the home instrument at the reader's "now"
  // (as if they had just pressed 研究 there), then dials to the research instant.
  // ?at=… (review captures) and ?open=off start directly at the research instant.
  const params = new URLSearchParams(location.search);
  const opening = !params.has("at") && params.get("open") !== "off";
  ctx.opening = opening;
  await new Promise(resolve => { iframe.onload = resolve; iframe.src = opening ? "../../index.html" : `../../index.html?instant=${encodeURIComponent(BASE_INSTANT)}`; });
  const doc = ctx.doc = iframe.contentDocument;
  const style = doc.createElement("style");
  style.textContent = STYLE;
  doc.head.append(style);
  // this page's own top bar replaces the embedded one from the first frame
  doc.documentElement.dataset.rsTopbar = "off";
  for (let i = 0; i < 60; i++) {
    const label = doc.querySelector("#year-track .active-cycle-label");
    if (label?.textContent && doc.getElementById("kinetic-instrument")?.dataset.materialPrototype === "roughness") break;
    await sleep(100);
  }
  await doc.fonts.ready;
  await sleep(300);
  ctx.svg = doc.getElementById("kinetic-wheel");
  if (opening) {
    // 1) still the home view at "now"; 2) the home readout fades and the 研究
    // tab takes the underline (we are leaving); 3) the dial turns to the research
    // instant; 4) the room's light closes in and the title arrives (we are in).
    // The reader may not wait: any touch, wheel or key cuts the opening short
    // (the dial jumps to the research instant) so the page answers at once.
    const kicker = document.getElementById("rs-kicker");
    const skipNow = openingSkip.promise;
    let skipped = openingSkip.done;
    skipNow.then(() => { skipped = true; });
    const wait = ms => Promise.race([sleep(ms), skipNow]);
    await wait(650);
    doc.documentElement.dataset.rsChrome = "off";
    document.body.dataset.rsEntering = "true";
    await goWide(true);
    if (!skipped) kicker.textContent = "研究 · 撥到 2026 年 9 月 13 日 下午 3 點";
    await wait(350);
    if (!skipped) await Promise.race([dialHome(Date.parse(BASE_INSTANT), "research-open"), skipNow]);
    if (skipped) {
      const instrument = doc.getElementById("kinetic-instrument");
      instrument.dispatchEvent(new doc.defaultView.CustomEvent("atlas:set-selected-instant", { detail: { instantMs: Date.parse(BASE_INSTANT), source: "research-open-skip" } }));
      await sleep(60);
    } else await sleep(150);
    openingSkip.stop();
    kicker.textContent = "";
  } else {
    doc.documentElement.dataset.rsChrome = "off";
    document.body.dataset.rsEntering = "true";
    await goWide(false);
  }
  document.body.dataset.rsEntered = "true";
  calibrate();
  ctx.g = svgEl(ctx.svg, "g", { id: "rs-overlay", "aria-hidden": "true" });
  const cursor = ctx.svg.querySelector("#cursor-layer");
  if (cursor?.parentNode === ctx.svg) ctx.svg.insertBefore(ctx.g, cursor);
  buildGreg();
}

// Read the home pose at the base instant: rotation and the cell under the needle.
function calibrate() {
  const svg = ctx.svg;
  ctx.u = 1 / (svg.getScreenCTM()?.a || 1);
  for (const id of ["year", "day"]) {
    const group = svg.querySelector(`#${id}-track`);
    const active = group.querySelector(".active-cycle-label");
    ctx.base[id] = { rotation: Number(group.dataset.renderedRotation), index: Number(active.dataset.cycleIndex) };
  }
  // lit column extents per band, measured from the home's own read-heads
  const inv = svg.getScreenCTM().inverse();
  const extent = scope => {
    let lo = CURSOR_ANGLE - 3.1, hi = CURSOR_ANGLE + 3.1, right = C.x;
    for (const node of scope.querySelectorAll(".active-cycle-label, .active-annual-label")) {
      const r = node.getBoundingClientRect();
      if (!r.width) continue;
      for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]) {
        const q = new DOMPoint(x, y).matrixTransform(inv);
        const a = Math.atan2(q.y - C.y, q.x - C.x) * 180 / Math.PI;
        lo = Math.min(lo, a - .6); hi = Math.max(hi, a + .6); right = Math.max(right, q.x);
      }
    }
    return { lo, hi, right };
  };
  const tracks = { year: "#year-track", greg: "#month-track", zodiac: "#zodiac-track", solar: "#solar-track", day: "#day-track", hour: "#hour-track" };
  for (const b of BANDS) ctx.keep[b] = extent(svg.querySelector(tracks[b]) ?? svg);
  ctx.columnRight = Math.max(...BANDS.map(b => ctx.keep[b].right));
  // brass band: screen angle = longitude + rotation
  ctx.base.solar = { rotation: Number(svg.querySelector("#solar-track").dataset.renderedRotation) };
  ctx.sun0 = mod(CURSOR_ANGLE - ctx.base.solar.rotation, 360);
  // day ring top on screen (phones place the ledger by it) and the frame width
  const ctm = svg.getScreenCTM();
  ctx.dayTop = ctm.d * (C.y - RADII.dayOuter) + ctm.f;
  ctx.frameW = ctx.iframe.offsetWidth;
  const cap = ctx.doc.querySelector(".cursor-cap")?.getBoundingClientRect();
  if (cap) { ctx.capX = cap.left + cap.width / 2; ctx.capY = cap.top + cap.height / 2; }
}

function buildGreg() {
  const u = ctx.u, [r0, r1] = BAND.greg;
  const g = ctx.gregGroup = svgEl(ctx.svg, "g", { id: "rs-greg", "aria-hidden": "true" });
  ctx.svg.insertBefore(g, ctx.g);
  for (let v = 0; v < 400; v += 5) {
    const a = CURSOR_ANGLE + v * .9;
    const major = v % 50 === 0, ten = v % 10 === 0;
    const p0 = pointAt(C, r0, a), p1 = pointAt(C, r0 + (major ? 26 : ten ? 14 : 8), a);
    svgEl(g, "line", { class: `ring-tick${major ? " major" : ""}`, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
    if (major && v) tangentText(g, (r0 + r1) / 2 + 8, a, `${v}`, { class: "rs-greg-label", "font-size": 13 * u });
  }
}

// ---------------------------------------------------------------- render
let lastCopyWords = "", copySwapTimer = 0;
let lastCopyKey = "", lastSceneIndex = -1;

// Phones lay the home out 680px wide ONCE, while entering the research room
// (under a short dim), and keep it for the whole page. Switching mid-scroll
// made the home re-lay-out its instrument (~0.7 s): a visible jump.
async function goWide(dim) {
  if (!ctx.mobile || ctx.wide) return;
  if (dim) { document.body.dataset.rsJumping = "true"; await sleep(220); }
  ctx.wide = true;
  ctx.iframe.style.width = "680px";
  await sleep(700);
  calibrate();
  sceneInsets.clear();
  ctx.iframe.style.transform = `translateX(${innerWidth / 2 - ctx.capX}px)`;
  if (dim) delete document.body.dataset.rsJumping;
}
function setWide(on) {
  if (!ctx.mobile || ctx.wide === on) return;
  ctx.wide = on;
  ctx.iframe.style.width = on ? "680px" : "100%";
  // the home re-lays out its camera; re-measure, then redraw
  setTimeout(() => { calibrate(); sceneInsets.clear(); frame(true); }, 700);
}

// phones: where the needle sits on screen for a camera pan (-1 left … +1 right)
function needleX(pan) {
  const frameW = ctx.frameW ?? ctx.iframe.offsetWidth;
  const lo = Math.max(46, ctx.vw - (frameW - ctx.capX)), hi = Math.min(ctx.vw - 46, ctx.capX);
  return pan < 0 ? lerp(ctx.vw / 2, lo, -pan) : lerp(ctx.vw / 2, hi, pan);
}
// Phones: the caption keeps clear of a needle near the edge by leaving that side
// free. The room it leaves is fixed per scene (the farthest the needle goes in
// it) and set with the words, so the text never re-wraps mid-scene.
const sceneInsets = new Map();
function sceneInset(sc) {
  if (!ctx.mobile) return null;
  if (sceneInsets.has(sc.id)) return sceneInsets.get(sc.id);
  let pan = 0;
  for (const p of [.02, .5, .999]) { const st = sc.state(p); const v = st.pan ?? -(st.push ?? 0); if (Math.abs(v) > Math.abs(pan)) pan = v; }
  const box = 16, gap = 22, x = needleX(pan);
  const inset = Math.abs(pan) < .5 ? null : pan < 0 ? { side: "left", px: Math.round(Math.max(0, x + gap - box)) } : { side: "right", px: Math.round(Math.max(0, ctx.vw - x + gap - box)) };
  sceneInsets.set(sc.id, inset);
  return inset;
}

function applyCamera(st) {
  const { iframe } = ctx;
  if (ctx.mobile) {
    // pan: -1 needle at the left edge … +1 needle at the right edge
    const pan = st.pan ?? -(st.push ?? 0);
    // the needle goes toward the edge only as far as the embedded home still
    // covers the whole screen: past that its side would show (a hard cut)
    const needleTarget = needleX(pan);
    const tx = ctx.wide ? needleTarget - ctx.capX : 0;
    setStyle(iframe, "transform", `translateX(${tx}px)`);

  } else {
    const s = 1 + .14 * (st.push ?? 0);
    setStyle(iframe, "transform-origin", `${ctx.capX}px ${ctx.capY}px`);
    setStyle(iframe, "transform", `scale(${s})`);
  }
}

function setRingPose(p, veil = {}) {
  const svg = ctx.svg;
  for (const id of ["year", "day"]) {
    const base = ctx.base[id];
    const rotation = base.rotation + p[id];
    const group = svg.querySelector(`#${id}-track`);
    if (!skip("rings")) setAttr(group, "transform", `rotate(${rotation} ${C.x} ${C.y})`);
    if (!skip("read")) setStyle(group, "--rs-read", String(1 - (veil[id] ?? 0) * 1.15));
    if (skip("labels")) continue;
    // the cell under the needle reads bright, like the home read-head
    const coord = mod(CURSOR_ANGLE - rotation, 360);
    const index = Math.floor(coord / 6) % 60;
    for (const node of group.querySelectorAll(".cycle-label.rs-lit")) if (Number(node.dataset.cycleIndex) !== index) node.classList.remove("rs-lit");
    group.querySelector(`.cycle-label[data-cycle-index="${index}"]`)?.classList.add("rs-lit");
    // ring names sit at a fixed angle; the resting labels passing under them step aside
    for (const node of group.querySelectorAll(".cycle-label[data-cycle-index]")) {
      const a = rotation + Number(node.dataset.cycleIndex) * 6 + 3;
      node.classList.toggle("rs-name-clear", Math.abs(signed(a - NAME_ANGLE(), 360)) < 8.5);
    }
  }
  if (!skip("rings")) setAttr(ctx.gregGroup, "transform", `rotate(${p.greg} ${C.x} ${C.y})`);
}

function resetRingPose() {
  for (const id of ["year", "day"]) {
    const group = ctx.svg.querySelector(`#${id}-track`);
    group.setAttribute("transform", `rotate(${ctx.base[id].rotation} ${C.x} ${C.y})`);
    group.querySelectorAll(".rs-lit, .rs-name-clear").forEach(n => n.classList.remove("rs-lit", "rs-name-clear"));
  }
}

function drawVeils(g, st) {
  for (const b of BANDS) {
    const [r0, r1] = BAND[b];
    const full = st.veil[b] ?? 0, column = (st.column ?? 0) * VEIL;
    if (full > .001) svgEl(g, "path", { class: "rs-veil", opacity: full, d: annularSectorPath(C, r0, r1, FAN.start, FAN.end) });
    if (column > .001) {
      const k = ctx.keep[b];
      svgEl(g, "path", { class: "rs-veil", opacity: column, d: annularSectorPath(C, r0, r1, FAN.start, k.lo) });
      svgEl(g, "path", { class: "rs-veil", opacity: column, d: annularSectorPath(C, r0, r1, k.hi, FAN.end) });
    }
  }
}

function drawColumnNames(g, t, notes = null) {
  if (t < .02) return;
  const u = ctx.u, m = ctx.mobile;
  const rows = [
    ["年柱", "看立春換年 · 60 年一輪", BAND.year],
    ["月柱", "看「節」換月 · 一年 12 個月", [RADII.solarOuter, RADII.monthOuter]],
    ["節", "白露：月柱在這裡換", BAND.solar],
    ["日柱", "每天走一格 · 60 天一輪", BAND.day],
    ["時柱", "每 2 小時走一格 · 一天 12 格", BAND.hour]
  ];
  const layer = svgEl(g, "g", { opacity: t });
  for (const [name, defaultNote, [r0, r1]] of rows) {
    const note = notes?.[name] ?? defaultNote;
    const p = pointAt(C, (r0 + r1) / 2, CURSOR_ANGLE);
    const x0 = ctx.columnRight + 10 * u, x1 = ctx.columnRight + (m ? 30 : 40) * u;
    svgEl(layer, "line", { class: "rs-leader", x1: x0, y1: p.y, x2: x1 - 8 * u, y2: p.y, "stroke-width": .8 * u });
    svgEl(layer, "text", { class: "rs-name", x: x1, y: p.y + (m ? 5 : -2) * u, "font-size": (m ? 14 : 16) * u }, name);
    if (!m) svgEl(layer, "text", { class: "rs-note", x: x1, y: p.y + 18 * u, "font-size": 13 * u }, note);
    else if (notes?.[name]) svgEl(layer, "text", { class: "rs-note", x: x1, y: p.y + 22 * u, "font-size": 11 * u }, note.split(" · ").pop());
  }
}

// 0.2: the day ring's two-glyph names come apart into a stem row and a branch row.
function drawSplit(parent, split, hits) {
  let g = parent;
  const u = ctx.u, [r0, r1] = BAND.day;
  // crossfade: at split≈0 the two glyphs sit exactly where the home label is
  const show = clamp(split * 8);
  setStyle(ctx.doc.documentElement, "--rs-day-labels", String(1 - show));
  if (show <= 0) return;
  g = svgEl(g, "g", { opacity: show });
  const base = ctx.base.day, rotation = base.rotation;
  const mid = (r0 + r1) / 2, dr = (r1 - r0) * .24;
  const size = 15 * u;
  const target = cycleItem(base.index);
  for (let k = -16; k <= 16; k++) {
    const index = mod(base.index + k, 60);
    const a = rotation + index * 6 + 3;
    if (a < FAN.start || a > FAN.end) continue;
    if (split > .6 && Math.abs(a - (ctx.mobile ? -112 : -122)) < 9) continue;
    const item = cycleItem(index);
    const half = (size * .55) / mid * 180 / Math.PI * (1 - split);
    const stemHit = item.stemIndex === target.stemIndex, branchHit = item.branchIndex === target.branchIndex;
    const sa = tangentText(g, mid + dr * split, a - half, item.stem.name, { class: `rs-split${stemHit && hits > .5 ? " hit" : ""}`, "font-size": size });
    const ba = tangentText(g, mid - dr * split, a + half, item.branch.name, { class: `rs-split${branchHit && hits > .5 ? " hit" : ""}`, "font-size": size });
    if (stemHit) sa.setAttribute("opacity", String(lerp(1, 1, hits)));
    if (branchHit) ba.setAttribute("opacity", "1");
  }
  if (split > .6) {
    const na = ctx.mobile ? -112 : -122;
    const o = clamp((split - .6) / .3);
    tangentText(g, mid + dr, na, "天干 · 10", { class: "rs-row-name", "font-size": 12 * u, opacity: o });
    tangentText(g, mid - dr, na, "地支 · 12", { class: "rs-row-name", "font-size": 12 * u, opacity: o });
  }
}

// The 2026 start of each ring, carried by the ring (silver), and past positions (trail).
function startAngle(ring, p) {
  return CURSOR_ANGLE + signed(p[ring], 360);
}
function drawMark(g, ring, a, cls, width) {
  const [r0, r1] = BAND[ring];
  if (a < FAN.start || a > FAN.end) return;
  const e0 = pointAt(C, r0 + 3, a), e1 = pointAt(C, r1 - 3, a);
  svgEl(g, "line", { class: cls, x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": width * ctx.u });
}

function drawChapter01(g, st) {
  const u = ctx.u, m = ctx.mobile;
  if (st.trail) for (const p of st.trail.poses) {
    const a = startAngle(st.trail.ring, p);
    drawMark(g, st.trail.ring, a, "rs-trail", 1.2);
    if (Math.abs(a - CURSOR_ANGLE) > 2.5 && a > FAN.start && a < FAN.end) {
      const [r0, r1] = BAND[st.trail.ring];
      tangentText(g, r1 - 11 * u, a + (m ? 1.6 : 1.1), `+${fmt(p.delta)}`, { class: "rs-trail-tag", "font-size": (m ? 10 : 11) * u, "text-anchor": "start" });
    }
  }
  if (st.marks) for (const ring of ["year", "greg", "day"]) {
    if ((st.veil[ring] ?? 0) > .3) continue;
    drawMark(g, ring, startAngle(ring, st.pose), "rs-echo", 1.6);
  }
  // ring names
  const na = NAME_ANGLE();
  for (const [ring, name] of [["year", "年序 · 60 年"], ["greg", (st.greg ?? 0) > .5 ? "公曆 · 400 年" : null], ["day", "日序 · 60 日"]]) {
    if (!name) continue;
    if ((st.veil[ring] ?? 0) > .3) continue;
    const [r0, r1] = BAND[ring];
    tangentText(g, (r0 + r1) / 2, na, name, { class: "rs-ring-name", "font-size": (m ? 11 : 12) * u });
  }
  // "回到起點" sits left of the needle; on a phone with the needle at the left
  // edge it would be cut off (the ledger says it already)
  const backRoom = !(ctx.mobile && (st.push ?? 0) > .5);
  for (const ring of backRoom ? st.back ?? [] : []) {
    const [r0, r1] = BAND[ring];
    const p = pointAt(C, (r0 + r1) / 2, CURSOR_ANGLE);
    svgEl(g, "text", { class: "rs-back", x: p.x - 46 * u, y: p.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": (m ? 11 : 13) * u }, "回到起點");
  }
  if (st.gap > .01) {
    const [r0, r1] = BAND.greg;
    const zero = startAngle("greg", st.pose);
    const end = lerp(CURSOR_ANGLE, zero, st.gap);
    svgEl(g, "path", { class: "rs-gap", "stroke-width": 3 * u, d: arcPath(C, r1 - 10, Math.min(end, CURSOR_ANGLE), Math.max(end, CURSOR_ANGLE)) });
    if (st.gap > .9) {
      const off = Math.abs(signed(st.pose.state.phases.gregorian, 400));
      tangentText(g, r1 - 30 * u, (zero + CURSOR_ANGLE) / 2, `還差 ${off} 年`, { class: "rs-gap-label", "font-size": (m ? 15 : 18) * u });
      tangentText(g, (r0 + r1) / 2 + 8, zero + (m ? -1.2 : 2.6), "2026 的起點", { class: "rs-echo-label", "font-size": (m ? 11 : 12) * u, "text-anchor": m ? "end" : "start" });
    }
  }
}

function setBand(band) {
  const root = ctx.doc.documentElement;
  const groups = ["#solar-track", "#zodiac-track"].map(s => ctx.svg.querySelector(s));
  if (!band) {
    if (!root.dataset.rsBand) return;
    delete root.dataset.rsBand;
    for (const g of groups) g.setAttribute("transform", `rotate(${ctx.base.solar.rotation} ${C.x} ${C.y})`);
    return;
  }
  setData(root, "rsBand", "on");
  const rotation = CURSOR_ANGLE - band.view;
  if (!skip("rings")) for (const g of groups) setAttr(g, "transform", `rotate(${rotation} ${C.x} ${C.y})`);
}

// Marks and arcs on the brass band, in longitude; drawn in screen space.
function drawBand(g, band) {
  const u = ctx.u, m = ctx.mobile;
  const r0 = RADII.dayOuter, r1 = RADII.solarTermOuter, arcR = r1 + 9;
  const angleOf = lambda => CURSOR_ANGLE + signed(lambda - band.view, 360);
  const inFan = a => a > FAN.start - 2 && a < FAN.end + 2;
  if (band.window) {
    const w = band.window, a0 = angleOf(w.from), a1 = a0 + signed(w.to - w.from, 360);
    const layer = svgEl(g, "g", { opacity: w.o });
    for (const [x, y] of [[FAN.start, a0], [a1, FAN.end]]) if (y > x) svgEl(layer, "path", { class: "rs-veil", opacity: .5, d: annularSectorPath(C, r0, RADII.solarOuter, x, y) });
    svgEl(layer, "path", { class: "rs-shift", "stroke-width": 1.6 * u, d: arcPath(C, arcR, a0, a1) });
    for (const a of [a0, a1]) { const e0 = pointAt(C, arcR - 6, a), e1 = pointAt(C, arcR + 6, a); svgEl(layer, "line", { class: "rs-shift", x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": 1.6 * u }); }
    if (w.label) tangentText(layer, arcR + 16 * u, (a0 + a1) / 2, w.label, { class: "rs-shift-value", "font-size": (m ? 12 : 13) * u });
  }
  for (const arc of band.arcs ?? []) {
    if ((arc.o ?? 1) < .01) continue;
    const a0 = angleOf(arc.from), a1 = a0 + signed(arc.to - arc.from, 360);
    if (!inFan(a0) && !inFan(a1)) continue;
    const layer = svgEl(g, "g", { opacity: arc.o ?? 1 });
    svgEl(layer, "path", { class: arc.cls, "stroke-width": arc.w * u, d: arcPath(C, arcR, Math.min(a0, a1), Math.max(a0, a1)) });
    if (arc.label) tangentText(layer, arcR + (arc.big ? 22 : 16) * u, (a0 + a1) / 2, arc.label, { class: arc.big ? "rs-gap-label" : "rs-shift-value", "font-size": (arc.big ? (m ? 15 : 18) : (m ? 11 : 12)) * u });
  }
  const stacked = (band.marks ?? []).filter(mk => mk.tier !== undefined).sort((a, b) => signed(a.lambda - b.lambda, 360));
  stacked.forEach((mk, i) => { mk.row = i; });
  for (const mk of band.marks ?? []) {
    if ((mk.o ?? 1) < .01) continue;
    const a = angleOf(mk.lambda);
    if (!inFan(a)) continue;
    const layer = svgEl(g, "g", { opacity: mk.o ?? 1 });
    const e0 = pointAt(C, r0 + 3, a), e1 = pointAt(C, r1 - 3, a);
    svgEl(layer, "line", { class: `${mk.cls} on-band`, x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": mk.w * u });
    if (mk.label) {
      // labels sit just inside the band, on the side away from the needle
      const side = a <= CURSOR_ANGLE + .01 ? -1 : 1;
      const depth = (16 + 22 * (mk.row ?? 0)) * u;
      const p = pointAt(C, r0 - depth, a);
      if (mk.row) { const l0 = pointAt(C, r0 - 2, a), l1 = pointAt(C, r0 - depth + 6 * u, a); svgEl(layer, "line", { class: "rs-leader", x1: l0.x, y1: l0.y, x2: l1.x, y2: l1.y, "stroke-width": .8 * u }); }
      svgEl(layer, "text", { class: mk.warm ? "rs-sun-label" : "rs-echo-label", x: p.x + side * 4 * u, y: p.y, "text-anchor": side < 0 ? "end" : "start", "dominant-baseline": "central", "font-size": (m ? 11 : 12) * u }, mk.label);
    }
  }
}

// 3.2: ±1σ of the Earth's rotation, drawn as a haze on the day and hour rings.
function drawHaze(g, haze) {
  const u = ctx.u, m = ctx.mobile, dim = new Map();
  for (const ring of ["day", "hour"]) {
    const [r0, r1] = BAND[ring];
    const span = haze.hours * DEG_PER_HOUR[ring];
    const full = span >= 180;
    const lo = full ? FAN.start : Math.max(FAN.start, CURSOR_ANGLE - span), hi = full ? FAN.end : Math.min(FAN.end, CURSOR_ANGLE + span);
    // the read-head fades as the haze covers more than its own cell
    const read = 1 - .72 * clamp((span - 1.5) / 6);
    const label = ring === "day" ? (ctx.svg.querySelector("#day-track .cycle-label.rs-lit") ?? ctx.svg.querySelector("#day-track .active-cycle-label")) : ctx.svg.querySelector("#hour-track .active-cycle-label");
    if (label) dim.set(label, String(read));
    if (span < .05) continue;
    svgEl(g, "path", { class: "rs-haze", d: annularSectorPath(C, r0 + 2, r1 - 2, lo, hi) });
    if (!full) for (const a of [CURSOR_ANGLE - span, CURSOR_ANGLE + span]) {
      if (a < FAN.start || a > FAN.end) continue;
      const e0 = pointAt(C, r0 + 4, a), e1 = pointAt(C, r1 - 4, a);
      svgEl(g, "line", { class: "rs-haze-edge", x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": 1.2 * u });
    }
    if (haze.label) {
      const text = full ? "整圈都有可能" : ring === "day" ? haze.label : `±${(span / 6).toFixed(1)} 格`;
      const a = full ? CURSOR_ANGLE + (m ? 6 : 16) : Math.min(Math.max(CURSOR_ANGLE + span + (m ? -1.2 : 2), CURSOR_ANGLE + (m ? 5 : 6)), CURSOR_ANGLE + (m ? 8 : 40));
      tangentText(g, (r0 + r1) / 2, a, text, { class: "rs-haze-label", "font-size": (m ? 12 : 14) * u, "text-anchor": full || span > 6 ? "middle" : "start" });
    }
  }
  return dim;
}

// read-heads under the haze fade; every other one keeps (or gets back) its own opacity
function hazeLabels(dim) {
  for (const sel of ["#day-track .cycle-label", "#day-track .active-cycle-label", "#hour-track .active-cycle-label"])
    ctx.svg.querySelectorAll(sel).forEach(n => setStyle(n, "opacity", dim.get(n) ?? null));
}

// The orbit seen from above, tied to the brass band: the gold line from the
// Earth to the Sun is the needle; silver/warm marks on the band become Earth
// positions on the 2026 / 26026 orbit. Eccentricity is exaggerated (stated).
const ORBIT_EXAGGERATION = 8;
const orbitAngle = lambda => (180 - lambda) * Math.PI / 180; // λ=270 (冬至) up, counter-clockwise
function orbitPoint(lambda, e, peri, R = 100) {
  const ex = Math.min(.6, e * ORBIT_EXAGGERATION);
  const r = R * (1 - ex * ex) / (1 + ex * Math.cos((lambda - peri) * Math.PI / 180));
  const a = orbitAngle(lambda);
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}
function orbitPath(e, peri, R = 100) {
  let d = "";
  for (let l = 0; l <= 360; l += 3) { const q = orbitPoint(l, e, peri, R); d += `${l ? "L" : "M"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`; }
  return d + "Z";
}
function drawOrbit(st) {
  const host = document.getElementById("rs-orbit"), svg = document.createElementNS(NS, "svg");
  const o = st.orbit?.o ?? 0;
  setStyle(host, "opacity", String(o));
  if (o < .01 || !st.band) { commitSvg(host, null); return; }
  setStyle(host, "--rs-orbit-big", String(st.orbit.big ?? 0));
  const el = (parent, name, attrs = {}, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    parent.append(n); return n;
  };
  const m = st.orbit.morph ?? 1, target = st.orbit.target;
  const e = target ? target.e : lerp(ECC.from, ECC.to, m), peri = target ? target.peri : mixAngle(PERI.from, PERI.to, m);
  // ×8 makes an ellipse reach R·(1+e·8) from the Sun: scale both orbits so the
  // farther one stays inside the jie ticks (r 112) instead of crossing them
  const ex = x => Math.min(.6, x * ORBIT_EXAGGERATION);
  const R = 104 / (1 + Math.max(ex(ECC.from), ex(e)));
  const g = el(svg, "g");
  // jie spokes + names
  for (const t of JIE) {
    const a = orbitAngle(t.longitude), c = Math.cos(a), s = Math.sin(a);
    el(g, "line", { class: "ob-tick", x1: 112 * c, y1: 112 * s, x2: 119 * c, y2: 119 * s });
    el(g, "text", { class: "ob-jie", x: 131 * c, y: 131 * s + 4 }, t.name);
  }
  el(g, "path", { class: "ob-orbit-old", d: orbitPath(ECC.from, PERI.from, R) });
  el(g, "path", { class: "ob-orbit", d: orbitPath(e, peri, R) });
  // band windows and arcs, at the rim
  const rimArc = (l0, l1, r) => {
    const a0 = orbitAngle(l0), a1 = orbitAngle(l1), sweep = signed(l1 - l0, 360) > 0 ? 0 : 1;
    const large = Math.abs(signed(l1 - l0, 360)) > 180 ? 1 : 0;
    return `M${r * Math.cos(a0)} ${r * Math.sin(a0)}A${r} ${r} 0 ${large} ${sweep} ${r * Math.cos(a1)} ${r * Math.sin(a1)}`;
  };
  const b = st.band;
  if (b.window) el(g, "path", { class: "ob-window", opacity: b.window.o, d: rimArc(b.window.from, b.window.to, 112) });
  for (const arc of b.arcs ?? []) if ((arc.o ?? 1) > .01 && Math.abs(signed(arc.to - arc.from, 360)) > .2)
    el(g, "path", { class: arc.cls === "rs-gap" ? "ob-gap" : "ob-shift", opacity: arc.o ?? 1, d: rimArc(arc.from, arc.to, 112) });
  // sun, needle line, earth
  el(g, "circle", { class: "ob-sun", r: 7 });
  const earth = orbitPoint(b.view, e, peri, R);
  // marks: silver on the 2026 orbit, warm on the current one
  for (const mk of b.marks ?? []) {
    if ((mk.o ?? 1) < .01) continue;
    const warm = mk.cls === "rs-sun-mark";
    const q = warm ? orbitPoint(mk.lambda, e, peri, R) : orbitPoint(mk.lambda, ECC.from, PERI.from, R);
    el(g, "circle", { class: warm ? "ob-dot-warm" : mk.cls === "rs-trail" ? "ob-dot-trail" : "ob-dot", opacity: mk.o ?? 1, cx: q.x, cy: q.y, r: warm ? 3.2 : 2.8 });
  }
  el(g, "line", { class: "ob-needle", x1: earth.x, y1: earth.y, x2: 0, y2: 0 });
  el(g, "circle", { class: "ob-earth", cx: earth.x, cy: earth.y, r: 4.2 });
  if (st.orbit.peri) {
    const p0 = orbitPoint(PERI.from, ECC.from, PERI.from, R), p1 = orbitPoint(peri, e, peri, R);
    el(g, "line", { class: "ob-peri-old", x1: 0, y1: 0, x2: p0.x * 1.12, y2: p0.y * 1.12 });
    el(g, "line", { class: "ob-peri", x1: 0, y1: 0, x2: p1.x * 1.12, y2: p1.y * 1.12 });
    const name = target ? `近日點 ${target.name}` : `近日點 ${2026 + Math.round(24000 * m)}`;
    if (m > .05 && Math.abs(signed(peri - PERI.from, 360)) < 30) {
      // the two perihelia nearly coincide (e.g. +792,000): one label each side
      const oldLeft = p0.x <= p1.x;
      // inside the orbit, where the jie names are not
      el(g, "text", { class: "ob-peri-label old", "text-anchor": oldLeft ? "end" : "start", x: p0.x * .82 + (oldLeft ? -5 : 5), y: p0.y * .82 + 4 }, "近日點 2026");
      el(g, "text", { class: "ob-peri-label", "text-anchor": oldLeft ? "start" : "end", x: p1.x * .82 + (oldLeft ? 5 : -5), y: p1.y * .82 + 4 }, name);
    } else {
      el(g, "text", { class: "ob-peri-label old", x: p0.x * 1.12 + 4, y: p0.y * 1.12 - 6 }, "近日點 2026");
      if (m > .05) el(g, "text", { class: "ob-peri-label", x: p1.x * 1.12 + 4, y: p1.y * 1.12 + 12 }, name);
    }
  }
  el(svg, "text", { class: "ob-caption", x: 0, y: 150 }, `俯視：地球繞太陽 · 偏心率放大 ×${ORBIT_EXAGGERATION}`);
  commitSvg(host, svg);
}

// 01: the step ledger. One row per ring; each step leaves a bar whose height is
// how far that ring's start is from the needle (signed, as a share of its cycle).
// A dot on the baseline = back at the start.
const LEDGER_ROWS = [["year", "年序", "yearSequence", 60, "年"], ["greg", "公曆", "gregorian", 400, "年"], ["day", "日序", "day", 60, "天"]];
function drawLadder(svg, Ld) {
  const el = (name, attrs = {}, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    svg.append(n); return n;
  };
  const x0 = 8, x1 = 318, dx = (x1 - x0) / (EXT.length - 1), base = 112, top = 30, clip = 160;
  const y = h => base - Math.min(h, clip) / clip * (base - top);
  el("text", { class: "lg-head", x: 0, y: 12 }, "41 個候選 · 柱高＝最大差（小時）");
  el("line", { class: "lg-base", x1: x0 - 4, y1: base, x2: x1 + 4, y2: base });
  el("line", { class: "lg-ref", x1: x0 - 4, y1: y(24), x2: x1 + 4, y2: y(24) });
  el("text", { class: "lg-ref-label", x: x1 + 4, y: y(24) - 3 }, "24 小時");
  const upto = Ld.upto ?? 0, cur = Math.round(upto);
  EXT.forEach((c, i) => {
    if (i > upto + .001) return;
    const x = x0 + i * dx, best = c === EXT_BEST && upto >= i, on = Ld.focus !== undefined ? i === Ld.focus : i === cur;
    el("line", { class: `lg-rung${on ? " cur" : ""}${best ? " best" : ""}`, x1: x, y1: base, x2: x, y2: y(c.maxAbs) });
    if (c.maxAbs > clip) el("line", { class: "lg-rung cap", x1: x - 2, y1: top - 2, x2: x + 2, y2: top - 2 });
    if (best) {
      el("circle", { class: "lg-best-dot", cx: x, cy: y(c.maxAbs) - 6, r: 3 });
      el("text", { class: "lg-tick best", x, y: y(c.maxAbs) - 13 }, `${c.maxAbs.toFixed(1)} 小時`);
    }
  });
  for (const i of [0, EXT_BEST.k - 1, EXT.length - 1]) {
    if (i > upto + .001) continue;
    el("text", { class: i === EXT_BEST.k - 1 ? "lg-tick best" : "lg-tick", x: x0 + i * dx, y: base + 14 }, `${fmt(EXT[i].delta / 1000)}k`);
  }
}

function drawLedger(st) {
  const host = document.getElementById("rs-ledger"), svg = document.createElementNS(NS, "svg");
  setData(document.body, "rsLadder", st.ladder ? "" : null);
  if (st.ladder) {
    setStyle(host, "opacity", String(st.ladder.o ?? 1));
    if (ctx.mobile) setStyle(host, "top", `${Math.round(ctx.dayTop + 6)}px`); // below the band, over the veiled day ring
    drawLadder(svg, st.ladder);
    commitSvg(host, svg);
    return;
  }
  const L = st.ledger, o = L ? (L.o ?? 1) : 0;
  setStyle(host, "opacity", String(o));
  if (!L || o < .01) { commitSvg(host, null); return; }
  if (ctx.mobile) {
    // sit just above the day ring, over the (veiled) brass band
    ctx.ledgerH ??= host.getBoundingClientRect().height;
    setStyle(host, "top", `${Math.round(ctx.dayTop - ctx.ledgerH - 4)}px`);
  }
  const el = (name, attrs = {}, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    svg.append(n); return n;
  };
  const x0 = 46, x1 = 262, dx = (x1 - x0) / Math.max(1, L.n - 1);
  const k = L.poses.length - 1;
  el("text", { class: "lg-head", x: 0, y: 12 }, `${L.title} · 第 ${Math.max(0, k)} 步 · +${fmt(L.poses[k]?.delta ?? 0)} 年`);
  LEDGER_ROWS.forEach(([ring, name, key, n, unit], row) => {
    const y = 46 + row * 38;
    const dim = clamp(1 - (st.veil[ring] ?? 0) * 1.3, .28, 1);
    const g = document.createElementNS(NS, "g");
    g.setAttribute("opacity", dim); svg.append(g);
    const add = (tag, attrs, text) => { const nd = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) nd.setAttribute(a, v); if (text !== undefined) nd.textContent = text; g.append(nd); };
    add("text", { class: "lg-name", x: 0, y: y + 4 }, name);
    add("line", { class: "lg-base", x1: x0 - 4, y1: y, x2: x1 + 4, y2: y });
    L.poses.forEach((ps, i) => {
      const off = signed(ps.state.phases[key], n), x = x0 + i * dx, cur = i === k;
      if (off === 0) add("circle", { class: cur ? "lg-zero cur" : "lg-zero", cx: x, cy: y, r: cur ? 3.6 : 2.6 });
      else add("line", { class: cur ? "lg-bar cur" : "lg-bar", x1: x, y1: y, x2: x, y2: y - off / (n / 2) * 15 });
    });
    const off = k >= 0 ? signed(L.poses[k].state.phases[key], n) : 0;
    const flag = L.flag === ring && off !== 0;
    add("text", { class: off === 0 ? "lg-val zero" : flag ? "lg-val gap" : "lg-val", x: 320, y: y + 4 }, off === 0 ? "回到起點" : `差 ${Math.abs(off)} ${unit}`);
  });
  commitSvg(host, svg);
}

function setCopy(copy, force, layout = { scene: "", panned: false, inset: null }) {
  const look = `${layout.scene}|${layout.panned ? "p" : ""}|${layout.inset ? layout.inset.side + layout.inset.px : ""}`;
  const key = copy ? `${copy.kicker}|${copy.title}|${copy.body}|${look}` : `|${look}`;
  if (key === lastCopyKey && !force) return;
  // the words fade out and back when the title, the body or the layout changes
  // (a body that changes in place would move the title: the caption grows upward);
  // a kicker-only change (a running count) is written at once
  const words = copy ? `${copy.title}|${copy.body}|${look}` : `|${look}`;
  const swap = words !== lastCopyWords;
  lastCopyKey = key; lastCopyWords = words;
  const box = document.querySelector(".rs-copy"), kicker = document.getElementById("rs-kicker");
  const write = () => {
    // lines break only after punctuation or at spaces (keep-all), never one
    // stray character on its own line
    const breaks = t => (t ?? "").replace(/([，；：。、？）])(?!$)/g, "$1" + String.fromCharCode(0x200b));
    kicker.textContent = copy?.kicker ?? "";
    document.getElementById("rs-title").textContent = breaks(copy?.title);
    document.getElementById("rs-body").textContent = breaks(copy?.body);
    if (layout.scene) box.dataset.scene = layout.scene; else delete box.dataset.scene;
    box.toggleAttribute("data-panned", layout.panned);
    box.style.paddingLeft = layout.inset?.side === "left" ? `${layout.inset.px}px` : "";
    box.style.paddingRight = layout.inset?.side === "right" ? `${layout.inset.px}px` : "";
    box.classList.remove("swapping");
  };
  clearTimeout(copySwapTimer);
  if (swap && !force) { box.classList.add("swapping"); copySwapTimer = setTimeout(write, 180); } else write();
}

function locate() {
  let u = scrollY / VH();
  for (let i = 0; i < SCENES.length; i++) {
    if (u < SCENES[i].length || i === SCENES.length - 1) return { index: i, p: clamp(u / SCENES[i].length) };
    u -= SCENES[i].length;
  }
  return { index: 0, p: 0 };
}

// ?perf: time every frame (window.__perf) to find what a phone cannot keep up with
// __perf.skip (set from the console or a harness) switches single costs off:
// overlay · labels (lit / name-clear classes) · read (--rs-read) · rings (all ring transforms)
const PERF = new URLSearchParams(location.search).has("perf") ? (window.__perf = { frames: [], skip: {} }) : null;
const skip = what => !!PERF?.skip[what];
function frame(force = false) {
  if (!PERF) return drawFrame(force);
  const t = performance.now();
  drawFrame(force);
  PERF.frames.push({ at: t, ms: performance.now() - t, scene: document.body.dataset.rsScene });
}
function drawFrame(force) {
  if (!ctx.g) return;
  // layout values are read here, before this frame writes anything: a read after
  // a write forces the browser to lay the page out again (measured: the costliest
  // line of a frame on a phone-speed CPU)
  const sy = scrollY;
  const { index, p } = locate();
  const sc = SCENES[index];
  const st = sc.state(p);
  const root = ctx.doc.documentElement;
  setData(root, "rsChrome", st.chrome ? "on" : "off");
  setData(root, "rsGreg", st.greg ? "on" : null);
  setStyle(root, "--rs-month", String(st.greg ? clamp(1 - st.greg * 1.6) : 1));
  if (st.split !== undefined) setData(root, "rsSplit", "on"); else { setData(root, "rsSplit", null); setStyle(root, "--rs-day-labels", null); }
  const topbarParent = !!(st.wide && ctx.mobile) || (st.push ?? 0) > 0;
  // the page's own top bar (with working links) always replaces the embedded one
  setData(root, "rsTopbar", "off");
  document.querySelector(".rs-topbar").classList.toggle("over", topbarParent);
  setWide(ctx.mobile || !!st.wide); // phones stay wide (see goWide)
  if (st.manual) { setData(root, "rsManual", "on"); setRingPose(st.pose, st.veil); }
  else if (root.dataset.rsManual) { setData(root, "rsManual", null); resetRingPose(); }
  setBand(st.band);
  setStyle(ctx.gregGroup, "opacity", String(st.greg ?? 0));
  setStyle(ctx.gregGroup, "display", st.greg ? null : "none");
  applyCamera(st);

  const g = ctx.doc.createElementNS(NS, "g");
  drawVeils(g, st);
  if (st.column) drawColumnNames(g, st.column, st.columnNotes);
  if (st.split !== undefined) drawSplit(g, st.split, st.hits ?? 0);
  if (st.manual) drawChapter01(g, st);
  if (st.band) drawBand(g, st.band);
  drawOrbit(st);
  drawLedger(st);
  hazeLabels(st.haze ? drawHaze(g, st.haze) : new Map());
  const markup = g.innerHTML;
  if (markup !== ctx.overlayMarkup && !skip("overlay")) { ctx.overlayMarkup = markup; ctx.g.replaceChildren(...g.childNodes); }
  // the caption's own layout (position, size, alignment) changes together with its
  // words, at the swap, never under words that are still fading out
  setCopy(st.copy, force, { scene: sc.id === "open0" || sc.id === "end" ? sc.id : "", panned: topbarParent, inset: sceneInset(sc) });
  document.querySelector(".rs-actions").hidden = !st.end;
  document.querySelector(".rs-hint").classList.toggle("gone", sy > 24);
  document.body.dataset.rsScene = sc.id;

  if (index !== lastSceneIndex || force) {
    lastSceneIndex = index;
    document.querySelectorAll(".rs-progress i").forEach((n, i) => n.classList.toggle("on", i === index));
  }
}

// ---------------------------------------------------------------- feel
// Free scroll; when the reader stops near a stop, settle onto it. Keyboard
// moves one key stop at a time and SCRUBS there (the rotation plays), it never
// cuts. ?feel=free turns settling and key stepping off. Reduced motion = cuts.
//
// A stop is a p where the picture is settled and the text is fully readable.
// Stepped scenes (one ring step per hold) settle onto any step; the keyboard
// only stops at a few of them.
const STEPPED = { c11: 33, c13: 20, c14: 20, c15: 20, c22: 5, c23: 3, c32: 3, x2: 40 };
const holdP = (n, j) => (j === 0 ? .08 : j >= n ? .97 : .08 + .84 * (j - .2) / n);
const KEY_STOPS = {
  open0: [0], open1: [.22, .55, .9], split: [.93], merge: [.85], sun: [.3, .64, .97],
  c11: [0, 1, 2, 33], c12: [.9], c13: [1, 2, 20], c14: [1, 2, 20], c15: [1, 2, 20],
  c21: [.3, .9], c22: [0, 1, 2, 3, 4, 5], c23: [0, 1, 2, 3], c24: [.32, .9],
  c31: [.5, .9], c32: [0, 1, 2, 3],
  x1: [.6], x2: [1, 2, 32, 40], x3: [.5, .9], end: [.75]
};
const sceneStart = i => SCENES.slice(0, i).reduce((s, x) => s + x.length, 0);
function stopList(all) {
  const out = [];
  SCENES.forEach((sc, i) => {
    const n = STEPPED[sc.id], u0 = sceneStart(i);
    const ps = n === undefined ? KEY_STOPS[sc.id] ?? [] : (all ? Array.from({ length: n + 1 }, (_, j) => j) : KEY_STOPS[sc.id] ?? []).map(j => holdP(n, j));
    for (const p of ps) out.push((u0 + p * sc.length) * VH());
  });
  return out.sort((a, b) => a - b);
}

let feelGlide = to => scrollTo(0, to);
function installFeel() {
  const params = new URLSearchParams(location.search);
  if (params.get("feel") === "free") return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let anim = null, touching = false, idle = 0;
  const cancel = () => { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } };
  // A motor, not a tween: the scroll position has velocity.
  // - start: an S-curve (two smoothing stages), no jolt;
  // - cruise: a steady speed, so stepped scenes tick at an even rhythm;
  // - brake: follows the braking curve exactly (never overshoots, never rocks
  //   back), and the last stretch decays exponentially for a soft landing.
  // A new target while moving keeps the current velocity: repeated key
  // presses chain into one continuous motion instead of restarting.
  const MOTORS = {
    // vmax: viewport heights/s · brake: vh/s² · tau: start smoothing (s) · land: final decay (s)
    key: { vmax: .75, brake: 1.1, tau: .15, land: .28 },
    settle: { vmax: 1.1, brake: 2.6, tau: .08, land: .18 }
  };
  function glide(to, kind) {
    if (reduce.matches) { cancel(); scrollTo(0, to); return; }
    const m = MOTORS[kind], H = VH();
    if (anim) { anim.target = to; anim.m = m; return; }
    anim = { x: scrollY, v: 0, w: 0, target: to, m, last: performance.now() };
    const step = now => {
      const a = anim; if (!a) return;
      // time-based: a slow frame rate makes the motion choppier, never slower
      const dt = Math.min(.25, (now - a.last) / 1000); a.last = now;
      const d = a.target - a.x, dist = Math.abs(d) / H;
      // long jumps (Home/End) may cruise faster, so they still take a few seconds
      const vmax = Math.max(a.m.vmax, dist / 5);
      const want = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * a.m.brake * dist), dist / a.m.land) * H;
      const k = 1 - Math.exp(-dt / a.m.tau);
      if (Math.abs(want) > Math.abs(a.v) && Math.sign(want) === Math.sign(a.v || want)) { a.w += (want - a.w) * k; a.v += (a.w - a.v) * k; }
      else { a.v = want; a.w = want; } // braking (or reversing) follows the curve directly
      a.x += a.v * dt;
      if (Math.abs(a.target - a.x) < .5) { scrollTo(0, a.target); restY = a.target; anim = null; return; }
      scrollTo(0, a.x);
      a.raf = requestAnimationFrame(step);
    };
    anim.raf = requestAnimationFrame(step);
  }
  feelGlide = to => glide(to, "key");
  // far jumps (Home/End across many scenes) do not scrub the whole page:
  // a brief dim, the jump, and the light comes back.
  function fadeJump(to) {
    cancel();
    if (reduce.matches) { scrollTo(0, to); return; }
    document.body.dataset.rsJumping = "true";
    setTimeout(() => { scrollTo(0, to); requestAnimationFrame(() => requestAnimationFrame(() => delete document.body.dataset.rsJumping)); }, 210);
  }
  // settle, biased hard to the direction the reader was going: any stop ahead
  // within a viewport wins (even a small nudge carries on to the next stop);
  // a stop behind pulls back only when the reader is all but on it.
  // Direction = net movement since the last rest, so a trackpad's tiny bounce
  // at the end of a flick, or our own glides, never flip it.
  const AHEAD = 1, BEHIND = .1; // viewport heights
  let restY = scrollY;
  function settle() {
    if (touching || anim) return;
    const y = scrollY, H = VH(), stops = stopList(true);
    if (stops.some(s => Math.abs(s - y) < 2)) { restY = y; return; }
    const dir = y - restY < 0 ? -1 : 1;
    const ahead = dir > 0 ? stops.find(s => s > y) : [...stops].reverse().find(s => s < y);
    const behind = dir > 0 ? [...stops].reverse().find(s => s < y) : stops.find(s => s > y);
    const to = ahead !== undefined && Math.abs(ahead - y) <= H * AHEAD ? ahead
      : behind !== undefined && Math.abs(behind - y) <= H * BEHIND ? behind : null;
    if (to !== null) glide(to, "settle"); else restY = y;
  }
  addEventListener("scroll", () => {
    if (anim) return;
    clearTimeout(idle); idle = setTimeout(settle, 160);
  }, { passive: true });
  // one key stop forward / back (Home, End: the ends). A step asked for while a
  // glide is running continues from its target, so presses and taps chain.
  function stepTo(dir) {
    const stops = stopList(false), y = anim ? anim.target ?? scrollY : scrollY;
    let to;
    if (dir === "home") to = stops[0];
    else if (dir === "end") to = stops[stops.length - 1];
    else if (dir > 0) to = stops.find(s => s > y + 2) ?? stops[stops.length - 1];
    else to = [...stops].reverse().find(s => s < y - 2) ?? stops[0];
    // near: scrub there with the motor (the rotation plays); far: dim and jump
    if (Math.abs(to - scrollY) > VH() * 6) fadeJump(to);
    else glide(to, "key");
  }
  // the reader's own input always wins over a glide in progress; a touch only
  // once it turns out to be a drag (a tap on a running glide chains instead)
  for (const type of ["wheel", "pointerdown"]) addEventListener(type, e => { if (e.pointerType !== "touch") cancel(); }, { passive: true });
  // tap: the right three quarters = next stop, the left quarter = back one.
  // Only a clean tap counts (moved < 10px, held < 0.3 s), and never on a link or button.
  const TAP_MOVE = 10, TAP_MS = 300, BACK_ZONE = .25;
  let tap = null;
  addEventListener("touchstart", e => {
    touching = true;
    const t = e.touches[0];
    tap = e.touches.length === 1 && !e.target.closest?.("a, button") ? { x: t.clientX, y: t.clientY, at: e.timeStamp } : null;
    if (!tap) cancel();
  }, { passive: true });
  addEventListener("touchmove", e => {
    const t = e.touches[0];
    if (tap && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > TAP_MOVE) { tap = null; cancel(); }
    else if (!tap) cancel();
  }, { passive: true });
  // (event timestamps: a busy frame must not turn a quick tap into a long press)
  addEventListener("touchend", e => {
    touching = false;
    if (tap && e.timeStamp - tap.at < TAP_MS) { stepTo(tap.x < innerWidth * BACK_ZONE ? -1 : 1); tap = null; return; }
    if (tap) cancel(); // a long press: just stop where we are
    tap = null;
    clearTimeout(idle); idle = setTimeout(settle, 220);
  }, { passive: true });
  addEventListener("keydown", e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
    const prev = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (!next && !prev && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    stepTo(e.key === "Home" ? "home" : e.key === "End" ? "end" : next ? 1 : -1);
  });
}

// One "screen" of scroll, in px. Phones grow and shrink innerHeight while the
// address bar slides in and out; measuring scenes in it made the picture jump
// mid-drag. The large viewport (lvh) stays put; it only changes with rotation.
let vhPx = 0;
function VH() {
  if (!vhPx) {
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;top:0;left:0;width:1px;visibility:hidden;height:${CSS.supports("height", "100lvh") ? "100lvh" : "100vh"}`;
    document.body.append(probe);
    vhPx = probe.offsetHeight || innerHeight;
    probe.remove();
  }
  return vhPx;
}
let lastWidth = innerWidth;
addEventListener("resize", () => {
  ctx.vw = innerWidth;
  if (innerWidth === lastWidth) return; // address bar only: nothing to redo
  lastWidth = innerWidth; vhPx = 0;
  const total = SCENES.reduce((s, x) => s + x.length, 0);
  document.getElementById("rs-scroll").style.height = `${(total + 1) * VH()}px`;
});

async function main() {
  const total = SCENES.reduce((s, x) => s + x.length, 0);
  document.getElementById("rs-scroll").style.height = `${(total + 1) * VH()}px`;
  document.querySelector(".rs-progress").replaceChildren(...SCENES.map(() => document.createElement("i")));
  await boot();
  // ?at=<scene>:<p> jumps there (for review captures)
  const at = new URLSearchParams(location.search).get("at");
  if (at) {
    const [id, p] = at.split(":");
    let u = 0;
    for (const s of SCENES) { if (s.id === id) { u += s.length * Number(p || 0); break; } u += s.length; }
    scrollTo(0, u * VH());
  }
  let queued = false;
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; frame(); }); } }, { passive: true });
  frame(true);
  installFeel();
  document.getElementById("rs-back-now").addEventListener("click", async () => {
    document.body.dataset.rsLeaving = "true";
    await dialHome(Date.now(), "research-back-now");
    await sleep(200);
    location.href = "../../";
  });
  // the end scene and the opening show the same instrument pose (and phones
  // never change layout), so going back to the start is a plain jump
  document.getElementById("rs-again").addEventListener("click", () => scrollTo(0, 0));
  // the opening hint appears once the instrument has settled, at the very top only
  setTimeout(() => document.querySelector(".rs-hint").hidden = false, ctx.opening ? 1400 : 0);
  if (at && ctx.mobile && SCENES[locate().index].state(0).wide) await sleep(900);
  document.documentElement.dataset.ready = "true";
}

main();

// review hook: jump to a scene position and wait until the frame (and any wide relayout) settles
window.__jump = async (id, p) => {
  let u = 0;
  for (const s of SCENES) { if (s.id === id) { u += s.length * p; break; } u += s.length; }
  scrollTo(0, Math.round(u * VH()));
  await sleep(120);
  frame(true);
  if (ctx.mobile) await sleep(900);
  frame(true);
};

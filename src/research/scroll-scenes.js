// Research view: the scenes of the scroll narrative, as pure data.
//
// Every scene has a length (in screen heights of scroll) and a state(p) that
// turns its progress p ∈ [0, 1] into what the instrument shows: ring poses,
// veils, marks, plates and the caption. Nothing here touches the DOM, so the
// story, its stops and its numbers can be tested on their own.
//
// Stage 1 of the production build: the opening, 序 and 一 曆法 (see
// docs/research-scenes-plan.md §9). 二 太陽, 三 地球自轉 and the conclusion follow.
import { recurrenceState } from "../recurrence/gregorian-cycle.js";
import { solarTerms } from "../data.js";
import { solarLongitudeAtInstant } from "../wheel/atlas-display-model.js";
import { resolveBirthPillars } from "../calendar/tyme-adapter.js";
import { SEASONAL_DRIFT_26026_RESEARCH as DRIFT, indexForLongitude } from "./seasonal-drift-26026-research-data.js";
import { liChunDriftAccumulation } from "./li-chun-drift-accumulation.js";
import { futureDeltaTOneSigmaSeconds } from "../astronomy/deep-time-earth-rotation.js";
import { solarTermShapeResiduals } from "../recurrence/berger-orbit.js";

export const BASE_DATE = Object.freeze({ year: 2026, month: 9, day: 13, hour: 15 });
export const BASE_INSTANT = "2026-09-13T15:00:00+08:00";
export const BASE_MS = Date.parse(BASE_INSTANT);

export const VEIL = .58;
export const BANDS = Object.freeze(["year", "greg", "zodiac", "solar", "day", "hour"]);

export const mod = (v, n) => ((v % n) + n) % n;
export const signed = (v, n) => { const m = mod(v, n); return m > n / 2 ? m - n : m; };
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// thousands separators without Intl (this runs inside scroll frames)
export const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const veils = (lit, amount = VEIL) => Object.fromEntries(BANDS.map(b => [b, lit.includes(b) ? 0 : amount]));
export const mixVeils = (a, b, t) => Object.fromEntries(BANDS.map(k => [k, lerp(a[k], b[k], t)]));
export const NONE = veils(BANDS, 0);
export const CAL = veils(["year", "greg", "day"]);
const YD = veils(["year", "day"]);

// Ring offsets (degrees, relative to the base pose) after deltaYears.
// year / day: the sexagenary rings; greg: the 400-year Gregorian ring that
// stands in for the month ring in 一 曆法.
export function pose(delta) {
  const s = recurrenceState(BASE_DATE, delta);
  return {
    delta,
    year: -mod(s.phases.yearSequence, 60) * 6,
    day: -mod(s.phases.day, 60) * 6,
    greg: -mod(s.phases.gregorian, 400) * .9,
    state: s
  };
}
export const mixPose = (a, b, t) => ({
  delta: t < .5 ? a.delta : b.delta,
  year: a.year + signed(b.year - a.year, 360) * t,
  day: a.day + signed(b.day - a.day, 360) * t,
  greg: a.greg + signed(b.greg - a.greg, 360) * t,
  state: t < .5 ? a.state : b.state
});
const range = (n, step) => Array.from({ length: n + 1 }, (_, i) => i * step);
const P0 = pose(0);

// A stepped scene: rewind from `from` (8 %), step through deltas (84 %), hold.
// Between steps the rings turn the shortest way to the next pose.
export function stepper(deltas, from, p) {
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

// ---------------------------------------------------------------- facts
// The next time the same four pillars appear at all (any date): only a 丙午 year
// can match, and only in its 酉 month (Sep–Oct), so those days are enough.
let nextSame;
export function nextSameBazi() {
  if (nextSame !== undefined) return nextSame;
  const at = (year, month, day) => JSON.stringify(resolveBirthPillars({ year, month, day, hour: BASE_DATE.hour }).pillars);
  const key = at(BASE_DATE.year, BASE_DATE.month, BASE_DATE.day);
  nextSame = null;
  for (let k = 1; k <= 12 && !nextSame; k++) {
    const year = BASE_DATE.year + 60 * k;
    for (const [month, days] of [[9, 30], [10, 31]]) for (let day = 1; day <= days && !nextSame; day++)
      if (at(year, month, day) === key) nextSame = { year, month, day, after: 60 * k };
  }
  return nextSame;
}

export const JIE = solarTerms.filter(t => t.kind === "jie");
export const jieByName = Object.fromEntries(JIE.map(t => [t.name, t]));
// the solar longitude under the needle at the base instant
export const SUN0 = mod(solarLongitudeAtInstant(BASE_MS), 360);

// 2026 dates of the Jie (the Sun reaching each longitude), for labels.
const jieDates = {};
export function jieDate2026(lambda) {
  if (jieDates[lambda]) return jieDates[lambda];
  const start = Date.UTC(2026, 0, 1) + mod(lambda - 280, 360) / 360 * 365.2422 * 864e5 - 6 * 864e5;
  let lo = start, hi = start + 12 * 864e5;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (signed(solarLongitudeAtInstant(mid) - lambda, 360) >= 0) hi = mid; else lo = mid; }
  const d = new Date(hi + 8 * 3600e3);
  return (jieDates[lambda] = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
}

// ---------------------------------------------------------------- scenes
// state fields: chrome · wide (phones: the wide camera) · pan (-1 … 1, phones)
// · push (zoom toward the gap) · veil {band: 0…1} · column (0…1) · columnNotes
// · split · hits · greg (0…1: the Gregorian ring replaces the month ring)
// · manual + pose (ring offsets) · marks · trail · back · gap · band · ledger
// · end · copy {kicker, title, body}
export const SCENES = [];
const scene = (id, length, state) => SCENES.push(Object.freeze({ id, length, state }));

scene("open0", .7, () => ({
  veil: NONE,
  copy: { kicker: "研究 · 2026 年 9 月 13 日 下午 3 點", title: "同一組八字，多久會再出現一次？", body: "從這一刻開始找。" }
}));
// Three different returns: the same bazi on any date (180 yrs); the same date
// and time with the same bazi (1,980 yrs, 一 曆法); the whole calendar, every
// day and every leap year, back in step (24,000 yrs): the period looked for.
scene("open1", 2.6, p => {
  const next = nextSameBazi();
  return {
    column: ease(clamp(p / .2)), veil: NONE,
    copy: p < .36
      ? { kicker: "序 · 2026 年 9 月 13 日 下午 3 點", title: "針下這一欄，就是八字。", body: "年、月、日、時四組干支，各轉各的圈，週期都不一樣。" }
      : p < .7
        ? { kicker: "序 · 再出現", title: `同一組八字，${next.after} 年後就會再出現。`, body: `下一次是 ${next.year} 年 ${next.month} 月 ${next.day} 日下午 3 點，日期不一樣。之後每隔 60 或 180 年再出現一次，沒有固定間隔。` }
        : { kicker: "序 · 要找什麼", title: "要找的：整套曆法回到原點。", body: "不只這一天：往後每一天的八字、哪幾年閏年，都和從 2026 年起排的一模一樣。這才是週期。" }
  };
});
const SPLIT_COPY = { kicker: "序 · 日柱 庚寅", title: "天干 10 個、地支 12 個，60 格才重複一次。", body: "日柱就這樣 60 天一輪；年柱同理，60 年一輪。" };
scene("split", 2, p => ({
  column: 1 - ease(clamp(p / .25)),
  veil: mixVeils(NONE, veils(["day"]), ease(clamp(p / .25))),
  split: ease(clamp((p - .15) / .35)), hits: ease(clamp((p - .55) / .3)),
  copy: SPLIT_COPY
}));
scene("merge", .9, p => ({
  veil: mixVeils(veils(["day"]), YD, ease(clamp(p / .6))),
  split: 1 - ease(clamp(p / .4)),
  copy: SPLIT_COPY
}));
// Before the Gregorian ring replaces the month ring: why it may stand in for the Sun.
const SUN_LIT = { year: VEIL, greg: 0, solar: 0, zodiac: .3, day: VEIL, hour: VEIL };
scene("sun", 2.6, p => {
  const step = p < .45 ? 0 : 1;
  const into = ease(clamp(p / .12)), dates = ease(clamp((p - .47) / .12)), swap = ease(clamp((p - .74) / .2));
  const marks = JIE.map(t => ({ lambda: t.longitude, cls: "research-echo", w: 1.4, label: `${t.name} ${jieDate2026(t.longitude)}` }));
  return {
    wide: true, pan: 0,
    veil: swap <= 0 ? mixVeils(YD, SUN_LIT, into) : mixVeils(SUN_LIT, CAL, swap),
    greg: swap,
    band: swap < .5 ? {
      view: SUN0,
      window: { from: jieByName["白露"].longitude, to: jieByName["寒露"].longitude, o: into * (1 - swap), label: "酉月：白露到寒露" },
      marks, marksOpacity: dates * (1 - swap)
    } : null,
    copy: [
      { kicker: "序 · 月柱", title: "月柱不數格子，它跟著太陽換。", body: "黃銅帶是太陽一年走的一圈。二十四節氣裡有十二個「節」；太陽每過一個節，月柱換一格：白露到寒露之間是酉月。" },
      { kicker: "序 · 月柱", title: "公曆也跟著太陽，所以先用公曆來找。", body: "節每年幾乎落在同一天：白露約 9/7，寒露約 10/8。月圈先換成公曆，它 400 年一輪。" }
    ][step]
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
// ---------------------------------------------------------------- Sun, rotation, and conclusion
const RATE = 360 / 365.2422; // mean solar motion, degrees a day
const earlyDays = lambda => -DRIFT.driftDays[indexForLongitude(lambda)];
const LI_CHUN = liChunDriftAccumulation();
export const PERI = { from: DRIFT.baseEllipse.perihelionSolarLongitudeDegrees, to: DRIFT.targetEllipse.perihelionSolarLongitudeDegrees };
export const ECC = { from: DRIFT.baseEllipse.eccentricity, to: DRIFT.targetEllipse.eccentricity };
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
const SUN_26026 = SUN0 + earlyDays(SUN0) * RATE; // the 26026 Sun at the same Gregorian moment
const LI_CHUN_VIEWS = LI_CHUN.map(r => 315 - r.driftDays * RATE);
const MONTH_WINDOW = [jieByName["白露"].longitude, jieByName["寒露"].longitude];
const sigmaHours = delta => futureDeltaTOneSigmaSeconds(2026 + 255 / 365 + delta) / 3600;
const SIGMA = [0, 1980, 8000, 24000].map(d => ({ delta: d, hours: d ? sigmaHours(d) : 0 }));
const YM_VEIL = { year: 0, greg: 0, solar: 0, zodiac: .3, day: VEIL, hour: VEIL };
const DH_VEIL = { year: VEIL, greg: VEIL, solar: VEIL, zodiac: VEIL, day: .22, hour: .22 };
export const DEG_PER_HOUR = { day: 6 / 24, hour: 6 / 2 };
const sigmaText = h => (h >= 48 ? `±${(h / 24).toFixed(1)} 天` : `±${h.toFixed(1)} 小時`);
const SIGMA_HOURS = SIGMA.map(s => s.hours);

scene("c21", 2, p => {
  const s0 = SUN0, early = earlyDays(s0), move = ease(clamp((p - .4) / .35));
  const silver = clamp((p - .25) / .12);
  return {
    manual: true, wide: true, pan: ease(clamp(p / .3)), greg: 1, pose: P24, veil: mixVeils(CAL, SUN_VEIL, ease(clamp(p / .3))),
    orbit: { o: ease(clamp((p - .25) / .15)), morph: 1, legend: true },
    back: p < .08 ? ["year", "greg", "day"] : [],
    band: {
      view: s0 + early * RATE * move,
      marks: [{ lambda: s0, cls: "research-echo", o: silver, label: "2026 的太陽", w: 1.6 }],
      arcs: move > .02 ? [{ from: s0, to: s0 + early * RATE * move, cls: "research-gap", w: 3, label: move > .9 ? `多走了 ${early.toFixed(1)} 天` : null, big: true }] : []
    },
    copy: p < .4
      ? { kicker: "二 太陽 · +24,000 年", title: "公曆對上了。太陽呢？", body: "黃銅帶是太陽真正走到的位置；節跟著太陽走，不跟著公曆走。" }
      : { kicker: "二 太陽 · +24,000 年", title: "同一個公曆時刻，太陽已經走過頭。", body: `24,000 年後的 9 月 13 日下午 3 點，太陽多走了 ${early.toFixed(1)} 天的路。` }
  };
});

const C22_STOPS = ["白露", "寒露", "立冬", "大雪", "小寒", "立春"].map(n => jieByName[n]);
const C22_VIEWS = C22_STOPS.map(t => t.longitude + earlyDays(t.longitude) * RATE);
// how far either side of its stop a term stays called out: half the way to the
// nearest neighbouring stop, so one call-out fades as the next one grows
const C22_REACH = C22_VIEWS.map((v, j) => .5 * Math.min(...[C22_VIEWS[j - 1], C22_VIEWS[j + 1]].filter(x => x !== undefined).map(x => Math.abs(signed(x - v, 360)))));
scene("c22", 3.6, p => {
  const s0 = SUN0;
  const w = bandWalk(C22_VIEWS, SUN_26026, p);
  const focus = C22_STOPS[Math.min(w.k, C22_STOPS.length - 1)];
  const show = ease(clamp(p / .1));
  const marks = [{ lambda: s0, cls: "research-echo", o: 1 - show, w: 1.6 }], arcs = [];
  // the term under the needle is called out (red, larger, named); the call-out
  // grows as the ring turns onto it and fades as it leaves, never pops
  const gate = clamp((p - .03) / .05);
  const leadOf = t => {
    const j = C22_STOPS.indexOf(t);
    if (j < 0) return 0;
    return Math.round(ease(clamp(1 - Math.abs(signed(w.view - C22_VIEWS[j], 360)) / C22_REACH[j])) * gate * 50) / 50;
  };
  for (const t of JIE) {
    const d = earlyDays(t.longitude), lead = leadOf(t);
    marks.push({ lambda: t.longitude, cls: "research-echo", o: show, w: 1.4 });
    marks.push({ lambda: t.longitude + d * RATE, cls: "research-sun-mark", o: show, w: 1.8 });
    arcs.push({ from: t.longitude, to: t.longitude + d * RATE, cls: "research-shift", w: 2 + lead, o: show, label: lead > 0 ? `${t.name}提早 ${d.toFixed(1)} 天` : `${d.toFixed(1)} 天`, lead });
  }
  return {
    manual: true, wide: true, pan: 1, greg: 1, pose: P24, veil: SUN_VEIL,
    orbit: { o: 1, morph: 1, legend: true },
    band: { view: w.view, marks, arcs },
    copy: { kicker: `二 太陽 · ${focus.name}`, title: `十二個節全部提早 ${RANGE.min.toFixed(1)}–${RANGE.max.toFixed(1)} 天。`, body: "銀線：2026 年太陽到節的位置。金線：同一個公曆時刻，24,000 年後的太陽。" }
  };
});


scene("c31", 2.4, p => {
  const turn = ease(clamp(p / .3)), lit = ease(clamp((p - .3) / .2));
  const view = mixAngle(315 + earlyDays(315) * RATE, SUN_26026, turn);
  return {
    manual: true, wide: true, pan: 1, pose: P24,
    orbit: { o: 1, morph: 1, legend: true },
    greg: 1 - ease(clamp((p - .15) / .2)),
    veil: mixVeils(SUN_VEIL, YM_VEIL, ease(clamp((p - .1) / .3))),
    band: {
      view,
      window: lit > .01 ? { from: MONTH_WINDOW[0], to: MONTH_WINDOW[1], o: lit, label: "酉月：白露到寒露" } : null,
      marks: [{ lambda: SUN0, cls: "research-echo", o: lit, w: 1.6, label: "2026 的太陽" }]
    },
    copy: p < .55
      ? { kicker: "二 太陽 · 年柱和月柱", title: "節都提早了，年柱、月柱還對嗎？", body: "看太陽：這一刻，太陽仍在白露和寒露之間。" }
      : { kicker: "二 太陽 · 年柱和月柱", title: "對：仍是丙午年、丁酉月。", body: "立春早就過了，寒露還沒到。節提早十幾天，還不足以換柱。" }
  };
});


scene("c23", 3, p => {
  const L = 315, rows = LI_CHUN; // Δ 0, 1,980, 8,000, 24,000 — only source-backed years
  const w = bandWalk(LI_CHUN_VIEWS, SUN_26026, p);
  const cur = rows[Math.min(w.k, rows.length - 1)];
  const marks = [{ lambda: L, cls: "research-echo", w: 1.6, label: "2026 立春", tier: 0 }], arcs = [];
  rows.slice(1, w.done).forEach((r, i, list) => {
    const last = i === list.length - 1 && r === cur;
    const e = -r.driftDays;
    marks.push({ lambda: L - r.driftDays * RATE, cls: last ? "research-sun-mark" : "research-trail", w: last ? 1.8 : 1.2, warm: last, tier: i + 1,
      label: `+${fmt(r.deltaYears)} 年 · ${e >= 0 ? "早" : "晚"} ${Math.abs(e).toFixed(1)} 天` });
  });
  if (cur.deltaYears) {
    const e = -cur.driftDays;
    arcs.push({ from: L, to: w.view, cls: "research-gap", w: 3, big: true, label: w.settled ? `${e >= 0 ? "早" : "晚"} ${Math.abs(e).toFixed(1)} 天` : null });
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
  const marks = [{ lambda: PERI.from, cls: "research-echo", o, w: 1.8, label: "2026 近日點" }];
  if (move > .97) marks.push({ lambda: PERI.to, cls: "research-sun-mark", w: 2, label: "26026 近日點", warm: true });
  const arcs = move > .02 ? [{ from: PERI.from, to: view, cls: "research-shift", w: 2 }] : [];
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

// ---------------------------------------------------------------- extension: toward a million years
// Berger (1978) orbit, 41 calendar candidates (every 24,000 years). The twelve
// Jie of 2026 and of the candidate are aligned at the vernal equinox, so only
// their SHAPE differs; that residual (hours) is drawn on the brass band,
// magnified ×EXT_MAG, and the orbit inset takes the candidate's ellipse.
const EXT_MAG = 4;
export const EXT = Array.from({ length: 41 }, (_, i) => {
  const delta = 24000 * (i + 1), r = solarTermShapeResiduals(2026, 2026 + delta);
  return { k: i + 1, delta, maxAbs: r.maxAbsHours, hours: Object.fromEntries(r.terms.map(t => [t.longitude, t.residualHours])), e: r.targetParameters.eccentricity, peri: r.targetParameters.perihelionLongitudeDegrees };
});
export const EXT_BEST = EXT.reduce((a, b) => (b.maxAbs < a.maxAbs ? b : a));
const EXT_INDICES = EXT.map((_, i) => i);
const EXT_VEIL = { year: VEIL, greg: VEIL, solar: 0, zodiac: .3, day: VEIL, hour: VEIL };
const hoursToDeg = h => h / 24 * RATE * EXT_MAG;

// band + orbit for a (possibly in-between) candidate index; in-between values
// are only the animation between two candidates, never shown as data.
function extState(kf, o = 1) {
  const a = EXT[Math.floor(kf)], b = EXT[Math.min(EXT.length - 1, Math.ceil(kf))], t = kf - Math.floor(kf);
  const marks = [], arcs = [];
  for (const j of JIE) {
    const h = lerp(a.hours[j.longitude], b.hours[j.longitude], t);
    marks.push({ lambda: j.longitude, cls: "research-echo", w: 1.4, o });
    marks.push({ lambda: j.longitude + hoursToDeg(h), cls: "research-sun-mark", w: 1.8, o });
    arcs.push({ from: j.longitude, to: j.longitude + hoursToDeg(h), cls: "research-shift", w: 2, o, label: t < .02 || t > .98 ? `${h > 0 ? "+" : "−"}${Math.abs(h).toFixed(1)} 小時` : null });
  }
  return {
    band: { view: SUN0, marks, arcs },
    orbit: { o, morph: 1, peri: true, target: { e: lerp(a.e, b.e, t), peri: mixAngle(a.peri, b.peri, t), name: `+${fmt((t < .5 ? a : b).delta)} 年` } }
  };
}

scene("x1", 1.6, p => {
  const o = ease(clamp(p / .2)), ext = extState(0, o);
  return {
    manual: true, pose: P24, greg: 0, wide: true, pan: 1, veil: mixVeils(SUN_VEIL, EXT_VEIL, o),
    band: { ...ext.band, view: mixAngle(PERI.to, SUN0, o) },
    orbit: { ...ext.orbit, o: 1, big: 1 - o },
    ladder: { upto: 0, o },
    copy: { kicker: "二 太陽 · 往後找", title: "往後找：哪一次，太陽最像 2026？", body: "近日點會繞一圈轉回來。曆法每 24,000 年對上一次，往後再比 41 次（近 100 萬年）。" }
  };
});

scene("x2", 6, p => {
  const w = bandWalk(EXT_INDICES, 0, p, lerp);
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
      ? { kicker: `二 太陽 · 第 ${EXT_BEST.k} 次 · +${fmt(EXT_BEST.delta)} 年`, title: `41 次裡最接近的是 +${fmt(EXT_BEST.delta)} 年，最大差 ${EXT_BEST.maxAbs.toFixed(1)} 小時。`, body: `軌道也接近 2026：偏心率 ${EXT_BEST.e.toFixed(4)}（2026 是 0.0167），近日點 ${EXT_BEST.peri.toFixed(0)}°（2026 是 283°）。` }
      : { kicker: "二 太陽 · 往後找", title: "最像，也不等於節真的回來。", body: "這裡先讓春分對齊了，整年一起提早或延後的部分沒有算；而且就算太陽回來，日柱、時柱還要看地球自轉。" }
  };
});

scene("c32", 3, p => {
  const w = bandWalk(SIGMA_HOURS, 0, p, lerp);
  const f = ease(clamp(p / .08)); // the extension's marks and ladder leave
  const cur = SIGMA[Math.min(w.k, SIGMA.length - 1)];
  const lines = {
    0: "地球自轉在變慢；慢多少只能估計，越往後越不準。",
    1980: "+1,980 年：誤差約 ±1.7 小時，時柱可能差一格。",
    8000: "+8,000 年：約 ±21 小時，整段誤差範圍已超過一天。",
    24000: "+24,000 年：約 ±7 天，日柱可能差約七格，時柱整圈都有可能。"
  };
  return {
    manual: true, wide: true, pan: lerp(1, 0, f), pose: P24, greg: 0,
    ...(f < .98 ? extState(EXT_BEST.k - 1, 1 - f) : {}),
    ladder: f < .98 ? { upto: EXT.length - 1, focus: EXT_BEST.k - 1, o: 1 - f } : undefined,
    veil: mixVeils(EXT_VEIL, DH_VEIL, f),
    haze: { hours: w.view, label: w.settled && cur.delta ? sigmaText(cur.hours) : null },
    copy: { kicker: `三 地球自轉 · ±1σ · +${fmt(cur.delta)} 年`, title: "日柱、時柱，要看地球轉到哪裡。", body: lines[cur.delta] }
  };
});


// The end answers the opening question. The four pillars return under the
// needle: year and month sharp, day and hour under the ±1σ haze of 三.
const END_NOTES = {
  年柱: "看立春 · 可以判定",
  月柱: "看節 · 可以判定",
  節: "太陽的位置 · 算得出來",
  日柱: "要知道地球自轉 · 未定",
  時柱: "要知道地球自轉 · 未定"
};
scene("end", 2, p => {
  const f = ease(clamp(p / .35));
  return {
    veil: mixVeils(DH_VEIL, NONE, f),
    column: f,
    columnNotes: END_NOTES,
    haze: { hours: SIGMA[3].hours, label: null },
    end: p > .5,
    copy: { kicker: "結論", title: "整套曆法回到原點：曆法上 24,000 年，實際算不出。", body: `年柱、月柱仍對得上；地球自轉的誤差約 ±7 天，日柱、時柱未定。（同一天同一刻，1,980 年；任何日期的同一組八字，${nextSameBazi().after} 年。）` }
  };
});

Object.freeze(SCENES);

// ---------------------------------------------------------------- stops
// A stop is a p where the picture is settled and the words fully readable.
// Stepped scenes settle onto any of their holds; the keyboard (and a tap) only
// stops at a few of them.
export const STEPPED = Object.freeze({ c11: 33, c13: 20, c14: 20, c15: 20, c22: 5, c23: 3, x2: 40, c32: 3 });
export const KEY_STOPS = Object.freeze({
  open0: [0], open1: [.22, .55, .9], split: [.93], merge: [.85], sun: [.3, .64, .97],
  c11: [0, 1, 2, 33], c12: [.9], c13: [1, 2, 20], c14: [1, 2, 20], c15: [1, 2, 20],
  c21: [.3, .9], c22: [0, 1, 2, 3, 4, 5], c31: [.5, .9], c23: [0, 1, 2, 3], c24: [.32, .9],
  x1: [.6], x2: [1, 2, 32, 40], x3: [.5, .9], c32: [0, 1, 2, 3], end: [.75]
});
export const holdP = (n, j) => (j === 0 ? .08 : j >= n ? .97 : .08 + .84 * (j - .2) / n);
export const totalLength = () => SCENES.reduce((s, x) => s + x.length, 0);
export const sceneStart = i => SCENES.slice(0, i).reduce((s, x) => s + x.length, 0);

// Stops in scroll units (screen heights), ascending. all: every hold of the
// stepped scenes (for settling); otherwise only the key stops.
export function stopUnits(all) {
  const out = [];
  SCENES.forEach((sc, i) => {
    const n = STEPPED[sc.id], u0 = sceneStart(i);
    const ps = n === undefined ? KEY_STOPS[sc.id] ?? [] : (all ? range(n, 1) : KEY_STOPS[sc.id] ?? []).map(j => holdP(n, j));
    for (const p of ps) out.push(u0 + p * sc.length);
  });
  return out.sort((a, b) => a - b);
}

// Scroll position (screen heights) → scene index and its progress.
export function locate(u) {
  let start = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const end = start + SCENES[i].length;
    // (a scene's own start belongs to it, despite float rounding of the sums)
    if (u < end - 1e-9 || i === SCENES.length - 1) return { index: i, p: clamp((u - start) / SCENES[i].length) };
    start = end;
  }
  return { index: 0, p: 0 };
}
export const unitsAt = (id, p) => {
  const i = SCENES.findIndex(s => s.id === id);
  return i < 0 ? 0 : sceneStart(i) + SCENES[i].length * p;
};

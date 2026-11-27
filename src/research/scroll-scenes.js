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
  const marks = JIE.map(t => ({ lambda: t.longitude, cls: "rs-echo", w: 1.4, o: dates * (1 - swap), label: `${t.name} ${jieDate2026(t.longitude)}` }));
  return {
    wide: true, pan: 0,
    veil: swap <= 0 ? mixVeils(YD, SUN_LIT, into) : mixVeils(SUN_LIT, CAL, swap),
    greg: swap,
    band: swap < .5 ? {
      view: SUN0,
      window: { from: jieByName["白露"].longitude, to: jieByName["寒露"].longitude, o: into * (1 - swap), label: "酉月：白露到寒露" },
      marks
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
// Stage 1 ends here; 二 太陽 onward is still in the prototype.
scene("end", 1.6, p => {
  const f = ease(clamp(p / .45));
  return {
    veil: mixVeils(CAL, NONE, f), greg: 1 - f,
    end: p > .5,
    copy: { kicker: "第一段到這裡", title: "二 太陽、三 地球自轉，製作中。", body: "曆法上，24,000 年三圈一起回到起點；接下來要用真正的太陽檢查它。" }
  };
});
Object.freeze(SCENES);

// ---------------------------------------------------------------- stops
// A stop is a p where the picture is settled and the words fully readable.
// Stepped scenes settle onto any of their holds; the keyboard (and a tap) only
// stops at a few of them.
export const STEPPED = Object.freeze({ c11: 33, c13: 20, c14: 20, c15: 20 });
export const KEY_STOPS = Object.freeze({
  open0: [0], open1: [.22, .55, .9], split: [.93], merge: [.85], sun: [.3, .64, .97],
  c11: [0, 1, 2, 33], c12: [.9], c13: [1, 2, 20], c14: [1, 2, 20], c15: [1, 2, 20], end: [.75]
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

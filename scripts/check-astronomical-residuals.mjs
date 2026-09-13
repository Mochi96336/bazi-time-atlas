import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dumpDom(path) {
  const browser = findBrowser();
  const url = new URL(path, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=2300",
    "--dump-dom",
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

function instrumentTag(dom) {
  return dom.match(/<section[^>]*id="recurrence-instrument"[^>]*>/)?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function expectFloat(tag, name, expected, tolerance, label) {
  const value = Number(attr(tag, name));
  if (!Number.isFinite(value) || Math.abs(value - expected) > tolerance) {
    throw new Error(`${label}: expected ${name}≈${expected}, got ${attr(tag, name)}`);
  }
}

function expect(path, checks, label) {
  const { url, dom } = dumpDom(path);
  const tag = instrumentTag(dom);
  for (const [name, expected] of Object.entries(checks.exact ?? {})) {
    const actual = attr(tag, name);
    if (actual !== String(expected)) {
      throw new Error(`${label}: expected ${name}=${expected}, got ${actual}: ${url}`);
    }
  }
  for (const check of checks.float ?? []) {
    expectFloat(tag, check.name, check.expected, check.tolerance, label);
  }
  return { url, dom, tag };
}

function exposure(tag) {
  return {
    hours:Number(attr(tag, "data-month-boundary-exposure-hours")),
    percent:Number(attr(tag, "data-month-boundary-exposure-percent")),
    largest:Number(attr(tag, "data-month-boundary-largest-window-hours")),
    overlap:Number(attr(tag, "data-month-boundary-overlap-hours")),
    windows:Number(attr(tag, "data-month-boundary-window-count")),
    merged:Number(attr(tag, "data-month-boundary-merged-window-count")),
    monthOnlyHours:Number(attr(tag, "data-month-only-exposure-hours")),
    monthOnlyPercent:Number(attr(tag, "data-month-only-exposure-percent")),
    yearMonthHours:Number(attr(tag, "data-year-month-exposure-hours")),
    yearMonthPercent:Number(attr(tag, "data-year-month-exposure-percent"))
  };
}

function assertPillarDecomposition(result, label) {
  const values = exposure(result.tag);
  if (Math.abs(values.monthOnlyHours + values.yearMonthHours - values.hours) > 0.001) {
    throw new Error(`${label}: pillar exposure does not sum to union: ${JSON.stringify(values)}: ${result.url}`);
  }
  if (Math.abs(values.monthOnlyPercent + values.yearMonthPercent - values.percent) > 0.001) {
    throw new Error(`${label}: pillar percent does not sum to union: ${JSON.stringify(values)}: ${result.url}`);
  }
  if ((result.dom.match(/data-pillar-impact="month-only"/g) ?? []).length !== 11) {
    throw new Error(`${label}: expected 11 month-only jie cells: ${result.url}`);
  }
  if ((result.dom.match(/data-pillar-impact="year\+month"/g) ?? []).length !== 1) {
    throw new Error(`${label}: expected one year+month Li Chun cell: ${result.url}`);
  }
  if (!result.dom.includes("丑→寅 · 年＋月")) {
    throw new Error(`${label}: Li Chun month transition / pillar label missing: ${result.url}`);
  }
  return values;
}

function assertBoundaryIsolatedGanzhi(result, label) {
  if (attr(result.tag, "data-year-sequence-aligned") !== "true") {
    throw new Error(`${label}: expected closed 60-year sequence: ${result.url}`);
  }
  if (attr(result.tag, "data-full-pillar-attribution") !== "boundary-isolated") {
    throw new Error(`${label}: expected boundary-isolated full-pillar attribution: ${result.url}`);
  }
  if ((result.dom.match(/data-pure-boundary-attribution="true"/g) ?? []).length !== 12) {
    throw new Error(`${label}: expected 12 pure boundary-attribution cells: ${result.url}`);
  }
  if (!result.dom.includes("年序已閉合：下方完整干支固定為「左＝基準、右＝目標」")) {
    throw new Error(`${label}: exact attribution explanation missing: ${result.url}`);
  }
}

const zero = expect(
  "recurrence.html?date=2026-09-13&delta=0",
  {
    exact: {
      "data-astronomy-model": "berger-1978",
      "data-astronomy-validity": "within-range",
      "data-astronomy-shape-closed": "true",
      "data-astronomy-term-count": "12",
      "data-month-boundary-exposure-validity": "within-range",
      "data-month-boundary-window-count": "12",
      "data-month-boundary-closed": "true",
      "data-year-sequence-aligned": "true",
      "data-full-pillar-attribution": "boundary-isolated",
      "data-year-boundary-li-chun-before-branch": "丑",
      "data-year-boundary-li-chun-after-branch": "寅",
      "data-year-boundary-li-chun-base-year-pillar": "aligned",
      "data-year-boundary-li-chun-target-year-pillar": "aligned"
    },
    float: [
      { name: "data-astronomy-max-residual-hours", expected: 0, tolerance: 1e-9 },
      { name: "data-month-boundary-exposure-hours", expected: 0, tolerance: 1e-9 },
      { name: "data-month-only-exposure-hours", expected: 0, tolerance: 1e-9 },
      { name: "data-year-month-exposure-hours", expected: 0, tolerance: 1e-9 }
    ]
  },
  "zero-year astronomical identity"
);
if ((zero.dom.match(/data-astro-term=/g) ?? []).length !== 12) {
  throw new Error(`zero-year astronomical identity: expected 12 SVG residual whiskers: ${zero.url}`);
}
if ((zero.dom.match(/class="month-boundary-window /g) ?? []).length !== 12) {
  throw new Error(`zero-year month-boundary exposure: expected 12 window cells: ${zero.url}`);
}
assertPillarDecomposition(zero, "zero-year astronomical identity");
assertBoundaryIsolatedGanzhi(zero, "zero-year astronomical identity");
console.log(`[astronomy-residual] PASS zero identity + canonical pillar transitions: ${zero.url}`);

const nonAligned = expect(
  "recurrence.html?date=2026-09-13&delta=400",
  {
    exact: {
      "data-gregorian-closed": "true",
      "data-year-closed": "false",
      "data-year-sequence-aligned": "false",
      "data-full-pillar-attribution": "mixed-with-year-sequence-offset"
    }
  },
  "400-year Gregorian-only recurrence"
);
if ((nonAligned.dom.match(/data-pure-boundary-attribution="false"/g) ?? []).length !== 12) {
  throw new Error(`400-year state should reject pure Ganzhi boundary attribution: ${nonAligned.url}`);
}
if (!nonAligned.dom.includes("年序未閉合：月支窗口仍有效")) {
  throw new Error(`400-year mixed-attribution explanation missing: ${nonAligned.url}`);
}
console.log(`[astronomy-residual] PASS 400-year mixed Ganzhi attribution guard: ${nonAligned.url}`);

const local = expect(
  "recurrence.html?date=2026-09-13&delta=1980",
  {
    exact: {
      "data-year-closed": "true",
      "data-day-closed": "true",
      "data-global-closed": "false",
      "data-astronomy-shape-closed": "false",
      "data-month-boundary-closed": "false",
      "data-year-sequence-aligned": "true",
      "data-full-pillar-attribution": "boundary-isolated"
    },
    float: [
      { name: "data-astronomy-max-residual-hours", expected: 41.355249, tolerance: 0.0001 },
      { name: "data-astronomy-min-residual-hours", expected: -11.325575, tolerance: 0.0001 },
      { name: "data-astronomy-max-signed-residual-hours", expected: 41.355249, tolerance: 0.0001 }
    ]
  },
  "1980-year local discrete recurrence with astronomy residual"
);
if (!/41\.36 h/.test(local.dom)) {
  throw new Error(`1980-year astronomy residual headline missing: ${local.url}`);
}
assertPillarDecomposition(local, "1980-year local recurrence");
assertBoundaryIsolatedGanzhi(local, "1980-year local recurrence");
console.log(`[astronomy-residual] PASS local non-closure + full-pillar classification: ${local.url}`);

const global = expect(
  "recurrence.html?date=2026-09-13&delta=24000",
  {
    exact: {
      "data-global-closed": "true",
      "data-gregorian-closed": "true",
      "data-year-closed": "true",
      "data-day-closed": "true",
      "data-astronomy-shape-closed": "false",
      "data-astronomy-target-year": "26026",
      "data-month-boundary-exposure-validity": "within-range",
      "data-month-boundary-window-count": "12",
      "data-month-boundary-merged-window-count": "12",
      "data-month-boundary-closed": "false",
      "data-year-sequence-aligned": "true",
      "data-full-pillar-attribution": "boundary-isolated",
      "data-year-boundary-li-chun-before-branch": "丑",
      "data-year-boundary-li-chun-after-branch": "寅",
      "data-year-boundary-li-chun-base-month-branch": "寅",
      "data-year-boundary-li-chun-target-month-branch": "丑",
      "data-year-boundary-li-chun-base-year-pillar": "丁未",
      "data-year-boundary-li-chun-target-year-pillar": "丙午",
      "data-year-boundary-li-chun-base-month-pillar": "壬寅",
      "data-year-boundary-li-chun-target-month-pillar": "辛丑"
    },
    float: [
      { name: "data-astronomy-max-residual-hours", expected: 95.109375, tolerance: 0.0001 },
      { name: "data-astronomy-min-residual-hours", expected: 1.363468, tolerance: 0.0001 },
      { name: "data-astronomy-max-signed-residual-hours", expected: 95.109375, tolerance: 0.0001 },
      { name: "data-month-boundary-largest-window-hours", expected: 95.109375, tolerance: 0.0001 }
    ]
  },
  "24000-year discrete closure with astronomical non-closure"
);
if (!/95\.11 h/.test(global.dom) || !/e 0\.01669 → 0\.00340/.test(global.dom)) {
  throw new Error(`24000-year astronomical residual readout missing: ${global.url}`);
}
assertBoundaryIsolatedGanzhi(global, "24000-year global recurrence");
if (!global.dom.includes("丁未·壬寅") || !global.dom.includes("丙午·辛丑")) {
  throw new Error(`24000-year Li Chun full Ganzhi state missing: ${global.url}`);
}
if (!/data-term="清明"[^>]*data-base-year-pillar="丙午"[^>]*data-base-month-pillar="壬辰"[^>]*data-target-year-pillar="丙午"[^>]*data-target-month-pillar="辛卯"/.test(global.dom)) {
  throw new Error(`24000-year Qingming full Ganzhi state missing or wrong: ${global.url}`);
}
const globalExposure = assertPillarDecomposition(global, "24000-year global recurrence");
if (!(globalExposure.hours > 500 && globalExposure.percent > 5 && globalExposure.percent < 10)) {
  throw new Error(`24000-year month-boundary exposure unexpectedly small/large: ${JSON.stringify(globalExposure)}: ${global.url}`);
}
if (!(globalExposure.monthOnlyHours > globalExposure.yearMonthHours && globalExposure.yearMonthHours > 0)) {
  throw new Error(`24000-year pillar decomposition is not meaningful: ${JSON.stringify(globalExposure)}: ${global.url}`);
}
if (globalExposure.overlap > 0.001) {
  throw new Error(`24000-year reference windows unexpectedly overlap: ${globalExposure.overlap}: ${global.url}`);
}
console.log(`[astronomy-residual] PASS 24000-year Ganzhi isolation; LiChun 丁未/壬寅 ↔ 丙午/辛丑; union=${globalExposure.hours.toFixed(3)} h: ${global.url}`);

const near = expect(
  "recurrence.html?date=2026-09-13&delta=792000",
  {
    exact: {
      "data-global-closed": "true",
      "data-astronomy-validity": "within-range",
      "data-month-boundary-exposure-validity": "within-range",
      "data-month-boundary-window-count": "12",
      "data-month-boundary-merged-window-count": "12",
      "data-month-boundary-closed": "false",
      "data-year-sequence-aligned": "true",
      "data-full-pillar-attribution": "boundary-isolated",
      "data-year-boundary-li-chun-before-branch": "丑",
      "data-year-boundary-li-chun-after-branch": "寅",
      "data-year-boundary-li-chun-base-year-pillar": "丁未",
      "data-year-boundary-li-chun-target-year-pillar": "丙午",
      "data-year-boundary-li-chun-base-month-pillar": "壬寅",
      "data-year-boundary-li-chun-target-month-pillar": "辛丑"
    },
    float: [
      { name: "data-astronomy-max-residual-hours", expected: 10.619909, tolerance: 0.001 },
      { name: "data-month-boundary-largest-window-hours", expected: 10.619909, tolerance: 0.001 }
    ]
  },
  "792000-year exact-discrete near recurrence"
);
assertBoundaryIsolatedGanzhi(near, "792000-year near recurrence");
if (!near.dom.includes("丁未·壬寅") || !near.dom.includes("丙午·辛丑")) {
  throw new Error(`792000-year Li Chun full Ganzhi state missing: ${near.url}`);
}
const nearExposure = assertPillarDecomposition(near, "792000-year near recurrence");
if (!(nearExposure.hours > 0 && nearExposure.hours < globalExposure.hours)) {
  throw new Error(`792000-year exposure did not improve on 24000 years: near=${nearExposure.hours}, global=${globalExposure.hours}: ${near.url}`);
}
if (!(nearExposure.percent > 0 && nearExposure.percent < globalExposure.percent)) {
  throw new Error(`792000-year exposure percent did not improve: near=${nearExposure.percent}, global=${globalExposure.percent}: ${near.url}`);
}
if (!(nearExposure.monthOnlyHours < globalExposure.monthOnlyHours && nearExposure.yearMonthHours < globalExposure.yearMonthHours)) {
  throw new Error(`792000-year pillar decomposition did not improve on 24000 years: near=${JSON.stringify(nearExposure)}, global=${JSON.stringify(globalExposure)}: ${near.url}`);
}
console.log(`[astronomy-residual] PASS 792000-year Ganzhi isolation; LiChun 丁未/壬寅 ↔ 丙午/辛丑; union=${nearExposure.hours.toFixed(3)} h: ${near.url}`);

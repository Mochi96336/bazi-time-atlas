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
    "--virtual-time-budget=2100",
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
      "data-year-boundary-li-chun-before-branch": "丑",
      "data-year-boundary-li-chun-after-branch": "寅"
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
console.log(`[astronomy-residual] PASS zero identity + canonical pillar transitions: ${zero.url}`);

const local = expect(
  "recurrence.html?date=2026-09-13&delta=1980",
  {
    exact: {
      "data-year-closed": "true",
      "data-day-closed": "true",
      "data-global-closed": "false",
      "data-astronomy-shape-closed": "false",
      "data-month-boundary-closed": "false"
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
console.log(`[astronomy-residual] PASS local non-closure + pillar classification: ${local.url}`);

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
      "data-year-boundary-li-chun-before-branch": "丑",
      "data-year-boundary-li-chun-after-branch": "寅",
      "data-year-boundary-li-chun-base-month-branch": "寅",
      "data-year-boundary-li-chun-target-month-branch": "丑"
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
console.log(`[astronomy-residual] PASS 24000-year non-closure; union=${globalExposure.hours.toFixed(3)} h, month-only=${globalExposure.monthOnlyHours.toFixed(3)} h, year+month=${globalExposure.yearMonthHours.toFixed(3)} h: ${global.url}`);

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
      "data-year-boundary-li-chun-before-branch": "丑",
      "data-year-boundary-li-chun-after-branch": "寅"
    },
    float: [
      { name: "data-astronomy-max-residual-hours", expected: 10.619909, tolerance: 0.001 },
      { name: "data-month-boundary-largest-window-hours", expected: 10.619909, tolerance: 0.001 }
    ]
  },
  "792000-year exact-discrete near recurrence"
);
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
console.log(`[astronomy-residual] PASS 792000-year near recurrence; union=${nearExposure.hours.toFixed(3)} h, month-only=${nearExposure.monthOnlyHours.toFixed(3)} h, year+month=${nearExposure.yearMonthHours.toFixed(3)} h: ${near.url}`);

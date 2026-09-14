import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const EXPECTED_DRAG_DEGREES = 0.25;
const MODEL_TOLERANCE_DEGREES = 0.002;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

const url = new URL("scripts/fixtures/linked-boundary-drag-390.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=15000",
  "--window-size=500,844",
  "--dump-dom",
  url
], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium linked-boundary drag probe failed: ${url}`);
}

const dom = result.stdout;
const probe = dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0] ?? "";
const attr = name => probe.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
const num = name => Number(attr(name));

if (attr("data-ready") !== "true") {
  throw new Error(`linked-boundary fixture did not settle (${attr("data-error") ?? "no error detail"}): ${url}`);
}
if (Math.abs(num("data-drag-degrees") - EXPECTED_DRAG_DEGREES) > 1e-12) {
  throw new Error(`linked-boundary fixture changed its canonical gesture: ${url}`);
}

function snapshot(key, position) {
  const prefix = `data-${key}-${position}`;
  return {
    innerWidth:num(`${prefix}-inner-width`),
    instantMs:num(`${prefix}-instant-ms`),
    model:num(`${prefix}-model-rotation`),
    manualOffset:num(`${prefix}-manual-offset`),
    linked:attr(`${prefix}-linked`) ?? "",
    activeRing:attr(`${prefix}-active-ring`) ?? "",
    scrubMode:attr(`${prefix}-scrub-mode`) ?? "",
    crossedBoundaries:num(`${prefix}-crossed-boundaries`),
    lastRing:attr(`${prefix}-last-ring`) ?? "",
    deltaMs:num(`${prefix}-delta-ms`),
    monthPillar:attr(`${prefix}-month-pillar`) ?? "",
    yearPillar:attr(`${prefix}-year-pillar`) ?? "",
    longitude:num(`${prefix}-longitude`),
    term:attr(`${prefix}-term`) ?? ""
  };
}

function caseData(key) {
  return {
    boundaryMs:num(`data-${key}-boundary-ms`),
    before:snapshot(key, "before"),
    active:snapshot(key, "active"),
    moved:snapshot(key, "moved"),
    after:snapshot(key, "after")
  };
}

function assertCommonLinkedDrag(key, ringId, data, expectedCrossings) {
  for (const [phase, value] of Object.entries({ before:data.before, active:data.active, moved:data.moved, after:data.after })) {
    if (value.innerWidth !== 390) throw new Error(`${key}/${phase} is not a true 390px viewport: ${JSON.stringify(data)}: ${url}`);
    if (![value.instantMs, value.model, value.manualOffset].every(Number.isFinite)) {
      throw new Error(`${key}/${phase} has non-finite production diagnostics: ${JSON.stringify(data)}: ${url}`);
    }
    if (Math.abs(value.manualOffset) > 1e-9 || value.linked !== "true" || value.scrubMode !== "linked-time") {
      throw new Error(`${key}/${phase} escaped linked-time ownership: ${JSON.stringify(data)}: ${url}`);
    }
  }

  if (data.active.activeRing !== ringId) {
    throw new Error(`${key} pointerdown did not capture ${ringId}: ${JSON.stringify(data)}: ${url}`);
  }
  if (data.after.activeRing !== "" || data.after.lastRing !== ringId) {
    throw new Error(`${key} pointerup did not finish the linked ${ringId} gesture cleanly: ${JSON.stringify(data)}: ${url}`);
  }
  if (!(data.before.instantMs > data.boundaryMs && data.moved.instantMs < data.boundaryMs && data.after.instantMs === data.moved.instantMs)) {
    throw new Error(`${key} gesture did not actually cross backward through its boundary: ${JSON.stringify(data)}: ${url}`);
  }
  if (!(data.moved.deltaMs < 0 && data.after.deltaMs === data.moved.deltaMs)) {
    throw new Error(`${key} clockwise gesture must move master time backward: ${JSON.stringify(data)}: ${url}`);
  }
  if (expectedCrossings !== null && data.moved.crossedBoundaries !== expectedCrossings) {
    throw new Error(`${key} reported ${data.moved.crossedBoundaries} crossed boundaries, expected ${expectedCrossings}: ${JSON.stringify(data)}: ${url}`);
  }

  const modelDelta = data.moved.model - data.before.model;
  if (Math.abs(modelDelta - EXPECTED_DRAG_DEGREES) > MODEL_TOLERANCE_DEGREES) {
    throw new Error(`${key} production ring pose did not follow the 0.25° pointer continuously (Δ=${modelDelta}°): ${JSON.stringify(data)}: ${url}`);
  }
  if (Math.abs(data.after.model - data.moved.model) > 1e-9) {
    throw new Error(`${key} ring pose changed again on pointerup: ${JSON.stringify(data)}: ${url}`);
  }
  return modelDelta;
}

const month = caseData("month");
const monthDelta = assertCommonLinkedDrag("month", "month", month, 1);
if (!(month.before.monthPillar === "丁卯" && month.after.monthPillar === "丙寅")) {
  throw new Error(`Month drag must cross Jing Zhe from 丁卯 back to 丙寅: ${JSON.stringify(month)}: ${url}`);
}

const year = caseData("year");
const yearDelta = assertCommonLinkedDrag("year", "year", year, 1);
if (!(year.before.yearPillar === "甲辰" && year.after.yearPillar === "癸卯")) {
  throw new Error(`Year drag must cross Li Chun from 甲辰 back to 癸卯: ${JSON.stringify(year)}: ${url}`);
}

const solar = caseData("solar");
const solarDelta = assertCommonLinkedDrag("solar", "solar", solar, 0);
if (!(solar.before.longitude >= 0 && solar.before.longitude < 0.2 && solar.after.longitude > 359.6)) {
  throw new Error(`Solar drag must cross the 0° wrap backward: ${JSON.stringify(solar)}: ${url}`);
}
if (!(solar.before.term === "春分" && solar.after.term === "驚蟄")) {
  throw new Error(`Solar drag must cross production term classification 春分→驚蟄: ${JSON.stringify(solar)}: ${url}`);
}

console.log(
  `[linked-boundary-drag] PASS true 390px pointer gesture; ` +
  `Month 丁卯→丙寅 Δ${monthDelta.toFixed(4)}° crossings=${month.moved.crossedBoundaries}; ` +
  `Year 甲辰→癸卯 Δ${yearDelta.toFixed(4)}° crossings=${year.moved.crossedBoundaries}; ` +
  `Solar λ ${solar.before.longitude.toFixed(6)}°→${solar.after.longitude.toFixed(6)}° Δ${solarDelta.toFixed(4)}°: ${url}`
);

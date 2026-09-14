import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const SECOND_MS = 1000;
const EXPECTED_STEP_MS = 2 * SECOND_MS;
const MAX_CONTINUOUS_MODEL_DELTA = 0.01;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

const url = new URL("scripts/fixtures/temporal-boundary-continuity.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=12000",
  "--window-size=500,844",
  "--dump-dom",
  url
], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium temporal-boundary probe failed: ${url}`);
}

const dom = result.stdout;
const probe = dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0] ?? "";
const attr = name => probe.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
const num = name => Number(attr(name));

if (attr("data-ready") !== "true") {
  throw new Error(`temporal-boundary fixture did not settle (${attr("data-error") ?? "no error detail"}): ${url}`);
}
if (num("data-step-ms") !== EXPECTED_STEP_MS) {
  throw new Error(`temporal-boundary fixture must use an exact two-second live step: ${url}`);
}

function caseData(key) {
  return {
    boundaryMs:num(`data-${key}-boundary-ms`),
    before:{
      innerWidth:num(`data-${key}-before-inner-width`),
      instantMs:num(`data-${key}-before-instant`),
      model:num(`data-${key}-before-model`),
      progress:num(`data-${key}-before-progress`),
      pillar:attr(`data-${key}-before-pillar`) ?? "",
      longitude:num(`data-${key}-before-longitude`),
      term:attr(`data-${key}-before-term`) ?? "",
      zodiac:attr(`data-${key}-before-zodiac`) ?? ""
    },
    after:{
      innerWidth:num(`data-${key}-after-inner-width`),
      instantMs:num(`data-${key}-after-instant`),
      model:num(`data-${key}-after-model`),
      progress:num(`data-${key}-after-progress`),
      pillar:attr(`data-${key}-after-pillar`) ?? "",
      longitude:num(`data-${key}-after-longitude`),
      term:attr(`data-${key}-after-term`) ?? "",
      zodiac:attr(`data-${key}-after-zodiac`) ?? ""
    }
  };
}

function assertCommonBoundaryShape(key, data) {
  const finite = [data.boundaryMs, data.before.instantMs, data.after.instantMs, data.before.model, data.after.model];
  if (!finite.every(Number.isFinite)) {
    throw new Error(`${key} boundary has non-finite production diagnostics: ${JSON.stringify(data)}: ${url}`);
  }
  if (data.before.innerWidth !== 390 || data.after.innerWidth !== 390) {
    throw new Error(`${key} boundary did not run in a true 390px atlas viewport: ${JSON.stringify(data)}: ${url}`);
  }
  if (data.before.instantMs !== data.boundaryMs - SECOND_MS || data.after.instantMs !== data.boundaryMs + SECOND_MS) {
    throw new Error(`${key} boundary must be sampled at exactly −1s/+1s: ${JSON.stringify(data)}: ${url}`);
  }
  const delta = data.after.model - data.before.model;
  if (Math.abs(delta) >= MAX_CONTINUOUS_MODEL_DELTA) {
    throw new Error(`${key} production track jumped across its boundary (${delta}°): ${JSON.stringify(data)}: ${url}`);
  }
  return delta;
}

const month = caseData("month");
const monthDelta = assertCommonBoundaryShape("month", month);
if (month.before.pillar === month.after.pillar || !month.before.pillar || !month.after.pillar) {
  throw new Error(`Jing Zhe must change Month pillar identity: ${JSON.stringify(month)}: ${url}`);
}
if (!(month.before.progress >= 0.999 && month.after.progress <= 0.001)) {
  throw new Error(`Month phase must reset across the exact Jie while geometry stays continuous: ${JSON.stringify(month)}: ${url}`);
}

const year = caseData("year");
const yearDelta = assertCommonBoundaryShape("year", year);
if (year.before.pillar === year.after.pillar || !year.before.pillar || !year.after.pillar) {
  throw new Error(`Li Chun must change Year pillar identity: ${JSON.stringify(year)}: ${url}`);
}
if (!(year.before.progress >= 0.999 && year.after.progress <= 0.001)) {
  throw new Error(`Year phase must reset across exact Li Chun while geometry stays continuous: ${JSON.stringify(year)}: ${url}`);
}

const solar = caseData("solar");
const solarDelta = assertCommonBoundaryShape("solar", solar);
if (!(solar.before.longitude > 359.9 && solar.after.longitude < 0.1)) {
  throw new Error(`Solar case must actually cross the production 360°→0° longitude wrap: ${JSON.stringify(solar)}: ${url}`);
}
if (solar.before.term !== "驚蟄" || solar.after.term !== "春分") {
  throw new Error(`Solar wrap must cross the production term classification 驚蟄→春分: ${JSON.stringify(solar)}: ${url}`);
}
if (Math.abs(solarDelta) >= 1) {
  throw new Error(`Solar wrap must never become a 360° rendering jump (${solarDelta}°): ${JSON.stringify(solar)}: ${url}`);
}

console.log(
  `[temporal-boundary] PASS true 390px −1s/+1s continuity; ` +
  `Month ${month.before.pillar}→${month.after.pillar} Δ${monthDelta.toFixed(4)}°, ` +
  `Year ${year.before.pillar}→${year.after.pillar} Δ${yearDelta.toFixed(4)}°, ` +
  `Solar λ ${solar.before.longitude.toFixed(6)}°→${solar.after.longitude.toFixed(6)}° Δ${solarDelta.toFixed(4)}°: ${url}`
);

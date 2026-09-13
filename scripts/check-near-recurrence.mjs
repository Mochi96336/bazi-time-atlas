import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

const browser = findBrowser();

function dump(path) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=2400",
    "--dump-dom",
    url,
  ], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { dom:result.stdout, url };
}

function instrumentAttrs(dom) {
  const tag = dom.match(/<section[^>]*id="recurrence-instrument"[^>]*>/)?.[0] ?? "";
  return name => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

const baseline = dump("recurrence.html?date=2026-09-13&delta=24000");
const attr = instrumentAttrs(baseline.dom);
const count = Number(attr("data-near-search-candidate-count"));
const bestDelta = Number(attr("data-near-search-best-delta-years"));
const bestMax = Number(attr("data-near-search-best-max-residual-hours"));
const bestRms = Number(attr("data-near-search-best-rms-hours"));
const lastDelta = Number(attr("data-near-search-last-delta-years"));

if (count !== 41) throw new Error(`expected 41 exact-closure candidates, got ${count}: ${baseline.url}`);
if (!Number.isFinite(bestDelta) || bestDelta % 24_000 !== 0 || bestDelta < 24_000) {
  throw new Error(`best candidate is not an exact-discrete closure: ${bestDelta}: ${baseline.url}`);
}
if (!Number.isFinite(bestMax) || bestMax >= 95.109375) {
  throw new Error(`search did not improve on the +24,000-year residual: ${bestMax}: ${baseline.url}`);
}
if (!Number.isFinite(bestRms) || bestRms <= 0) throw new Error(`invalid best RMS: ${bestRms}: ${baseline.url}`);
if (lastDelta !== 984_000) throw new Error(`expected last in-range exact closure +984000, got ${lastDelta}: ${baseline.url}`);
if ((baseline.dom.match(/class="near-dot/g) ?? []).length !== 41) {
  throw new Error(`expected 41 near-recurrence chart dots: ${baseline.url}`);
}
if ((baseline.dom.match(/class="near-ranking-row/g) ?? []).length !== 6) {
  throw new Error(`expected top-six near-recurrence ranking: ${baseline.url}`);
}
const bestLabel = `+${bestDelta.toLocaleString("en-US")} 年`;
if (!baseline.dom.includes(bestLabel)) {
  throw new Error(`best candidate headline missing (${bestLabel}): ${baseline.url}`);
}
if (!baseline.dom.includes(`<button type="button" class="near-ranking-row best" data-delta-years="${bestDelta}"`)) {
  throw new Error(`best candidate is not rendered as an interactive ranking button: ${baseline.url}`);
}

const deep = dump(`recurrence.html?date=2026-09-13&delta=${bestDelta}`);
const deepAttr = instrumentAttrs(deep.dom);
const deepDelta = Number(deepAttr("data-delta-years"));
const deepResidual = Number(deepAttr("data-astronomy-max-residual-hours"));
const selectedDelta = Number(deepAttr("data-near-search-selected-delta-years"));

if (deepDelta !== bestDelta) throw new Error(`deep-time query was clamped to ${deepDelta}: ${deep.url}`);
if (deepAttr("data-delta-mode") !== "deep") throw new Error(`deep-time query did not enter deep mode: ${deep.url}`);
if (deepAttr("data-global-closed") !== "true") throw new Error(`best candidate lost exact discrete closure: ${deep.url}`);
if (deepAttr("data-astronomy-validity") !== "within-range") throw new Error(`best candidate left astronomy model range: ${deep.url}`);
if (Math.abs(deepResidual - bestMax) > 0.001) {
  throw new Error(`best candidate wheel residual ${deepResidual} disagrees with search ${bestMax}: ${deep.url}`);
}
if (selectedDelta !== bestDelta) throw new Error(`near-search selection did not follow deep-time state: ${deep.url}`);
if (!deep.dom.includes(`深時間 +${bestDelta.toLocaleString("en-US")} 年`)) {
  throw new Error(`deep-time scale note missing: ${deep.url}`);
}
if (!deep.dom.includes(`class="near-ranking-row best selected"`)) {
  throw new Error(`best ranking row is not selected in deep-time state: ${deep.url}`);
}

console.log(`[near-recurrence] PASS ${count} candidates; best +${bestDelta} y; max=${bestMax.toFixed(3)} h; RMS=${bestRms.toFixed(3)} h; deep-link preserves exact closure and selected state`);
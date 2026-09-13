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
const url = new URL("recurrence.html?date=2026-09-13&delta=24000", baseURL).href;
const result = spawnSync(browser, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--virtual-time-budget=2200",
  "--dump-dom",
  url,
], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium DOM probe failed: ${url}`);
}

const dom = result.stdout;
const tag = dom.match(/<section[^>]*id="recurrence-instrument"[^>]*>/)?.[0] ?? "";
function attr(name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

const count = Number(attr("data-near-search-candidate-count"));
const bestDelta = Number(attr("data-near-search-best-delta-years"));
const bestMax = Number(attr("data-near-search-best-max-residual-hours"));
const bestRms = Number(attr("data-near-search-best-rms-hours"));
const lastDelta = Number(attr("data-near-search-last-delta-years"));

if (count !== 41) throw new Error(`expected 41 exact-closure candidates, got ${count}: ${url}`);
if (!Number.isFinite(bestDelta) || bestDelta % 24_000 !== 0 || bestDelta < 24_000) {
  throw new Error(`best candidate is not an exact-discrete closure: ${bestDelta}: ${url}`);
}
if (!Number.isFinite(bestMax) || bestMax >= 95.109375) {
  throw new Error(`search did not improve on the +24,000-year residual: ${bestMax}: ${url}`);
}
if (!Number.isFinite(bestRms) || bestRms <= 0) throw new Error(`invalid best RMS: ${bestRms}: ${url}`);
if (lastDelta !== 984_000) throw new Error(`expected last in-range exact closure +984000, got ${lastDelta}: ${url}`);
if ((dom.match(/class="near-dot/g) ?? []).length !== 41) {
  throw new Error(`expected 41 near-recurrence chart dots: ${url}`);
}
if ((dom.match(/class="near-ranking-row/g) ?? []).length !== 6) {
  throw new Error(`expected top-six near-recurrence ranking: ${url}`);
}
const bestLabel = `+${bestDelta.toLocaleString("en-US")} 年`;
if (!dom.includes(bestLabel)) {
  throw new Error(`best candidate headline missing (${bestLabel}): ${url}`);
}

console.log(`[near-recurrence] PASS ${count} candidates; best +${bestDelta} y; max=${bestMax.toFixed(3)} h; RMS=${bestRms.toFixed(3)} h; horizon=+${lastDelta} y`);

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

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function requireEqual(actual, expected, label, url) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}: ${url}`);
}

const url = new URL("scripts/fixtures/classification-overlay-390.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=4200",
  "--window-size=500,844",
  "--dump-dom",
  url
], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium classification-overlay probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
if (!probe || attr(probe, "data-ready") !== "true") {
  throw new Error(`classification-overlay fixture did not settle: ${url}`);
}

requireEqual(attr(probe, "data-inner-width"), "390", "classification overlay true viewport width", url);
requireEqual(attr(probe, "data-initial-overlay"), "off", "classification overlay default state", url);
requireEqual(attr(probe, "data-initial-pressed"), "false", "classification overlay default button state", url);
requireEqual(attr(probe, "data-initial-legend-hidden"), "true", "classification overlay legend default visibility", url);
requireEqual(attr(probe, "data-cycle-annotated"), "240", "all four sexagenary rings annotated", url);
requireEqual(attr(probe, "data-zodiac-annotated"), "12", "all zodiac sectors annotated", url);

requireEqual(attr(probe, "data-jia-zi-stem"), "木", "甲子 heavenly-stem element", url);
requireEqual(attr(probe, "data-jia-zi-branch"), "水", "甲子 earthly-branch element", url);
requireEqual(attr(probe, "data-aries-element"), "火", "Aries zodiac element", url);
requireEqual(attr(probe, "data-aries-modality"), "基本", "Aries modality", url);
requireEqual(attr(probe, "data-gemini-element"), "風", "Gemini zodiac element", url);
requireEqual(attr(probe, "data-gemini-modality"), "變動", "Gemini modality", url);

requireEqual(attr(probe, "data-on-overlay"), "on", "classification overlay enabled state", url);
requireEqual(attr(probe, "data-on-pressed"), "true", "classification overlay enabled button state", url);
requireEqual(attr(probe, "data-on-legend-hidden"), "false", "classification overlay legend enabled visibility", url);
if (attr(probe, "data-jia-zi-fill-before") === attr(probe, "data-jia-zi-fill-on")) {
  throw new Error(`classification overlay did not recolor heavenly-stem fill: ${url}`);
}
if (attr(probe, "data-jia-zi-stroke-before") === attr(probe, "data-jia-zi-stroke-on")) {
  throw new Error(`classification overlay did not encode earthly-branch outline: ${url}`);
}
if (attr(probe, "data-aries-fill-before") === attr(probe, "data-aries-fill-on")) {
  throw new Error(`classification overlay did not recolor zodiac element fill: ${url}`);
}
const geminiDash = attr(probe, "data-gemini-dash-on") ?? "";
if (!geminiDash || geminiDash === "none") {
  throw new Error(`classification overlay did not encode Gemini mutable modality in the border: ${url}`);
}

const baziCurrent = attr(probe, "data-bazi-current") ?? "";
const zodiacCurrent = attr(probe, "data-zodiac-current") ?? "";
const warning = attr(probe, "data-warning") ?? "";
if (!/時 .+\/.+ · 日 .+\/.+ · 月 .+\/.+ · 年 .+\/.+/.test(baziCurrent)) {
  throw new Error(`classification overlay current BaZi summary is incomplete (${baziCurrent}): ${url}`);
}
if (!/ · .+ · (基本|固定|變動)$/.test(zodiacCurrent)) {
  throw new Error(`classification overlay current zodiac summary is incomplete (${zodiacCurrent}): ${url}`);
}
if (!warning.includes("五行 ≠ 黃道四元素") || !warning.includes("沒有一對一對應")) {
  throw new Error(`classification overlay lost the explicit non-equivalence warning (${warning}): ${url}`);
}

const selectedBefore = attr(probe, "data-selected-before");
requireEqual(attr(probe, "data-selected-on"), selectedBefore, "enabling classification must not change Selected Instant", url);
requireEqual(attr(probe, "data-selected-off"), selectedBefore, "disabling classification must not change Selected Instant", url);
requireEqual(attr(probe, "data-off-overlay"), "off", "classification overlay disabled state", url);
requireEqual(attr(probe, "data-off-pressed"), "false", "classification overlay disabled button state", url);
requireEqual(attr(probe, "data-off-legend-hidden"), "true", "classification overlay legend disabled visibility", url);

console.log(`[classification-overlay] PASS 390px separate BaZi five-element and zodiac element/modality grammars without mutating Selected Instant: ${url}`);

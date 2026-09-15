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

function num(tag, name) {
  return Number(attr(tag, name));
}

function near(actual, expected, label, url, tolerance = .015) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}: ${url}`);
  }
}

function requireEqual(actual, expected, label, url) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}: ${url}`);
}

function requireIncludes(actual, expected, label, url) {
  if (!(actual ?? "").includes(expected)) throw new Error(`${label}: expected ${JSON.stringify(actual)} to include ${expected}: ${url}`);
}

function requireDescending(values, label, url) {
  if (!values.every(Number.isFinite) || values.some((value, index) => index > 0 && values[index - 1] <= value)) {
    throw new Error(`${label}: expected strictly descending opacity, got ${values.join(",")}: ${url}`);
  }
}

const url = new URL("scripts/fixtures/scale-emphasis-390.html", baseURL).href;
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
  throw new Error(`Chromium scale-emphasis probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
if (!probe || attr(probe, "data-ready") !== "true") throw new Error(`scale-emphasis fixture did not settle: ${url}`);

requireEqual(num(probe, "data-inner-width"), 390, "scale emphasis true viewport width", url);
requireEqual(attr(probe, "data-initial-window"), "year", "initial one-year emphasis", url);
requireEqual(attr(probe, "data-initial-focus"), "solar,month", "one-year focus rings", url);
requireEqual(attr(probe, "data-initial-context"), "year", "one-year context rings", url);
requireEqual(attr(probe, "data-initial-ambient"), "hour,day", "one-year ambient rings", url);
requireEqual(attr(probe, "data-initial-readout"), "一年", "one-year readout", url);
near(num(probe, "data-year-solar-opacity"), 1, "one-year Solar opacity", url);
near(num(probe, "data-year-zodiac-opacity"), 1, "one-year Zodiac opacity", url);
near(num(probe, "data-year-month-opacity"), 1, "one-year Month opacity", url);
near(num(probe, "data-year-year-opacity"), .62, "one-year Year context opacity", url);
near(num(probe, "data-year-day-opacity"), .54, "one-year Day ambient opacity", url);
near(num(probe, "data-year-hour-opacity"), .46, "one-year Hour ambient opacity", url);
requireEqual(attr(probe, "data-year-solar-filter"), "none", "one-year Solar filter", url);
requireEqual(attr(probe, "data-year-month-filter"), "none", "one-year Month filter", url);
requireEqual(attr(probe, "data-year-year-filter"), "none", "one-year Year filter", url);
requireDescending([
  num(probe, "data-year-year-opacity"),
  num(probe, "data-year-day-opacity"),
  num(probe, "data-year-hour-opacity")
], "one-year context hierarchy Year > Day > Hour", url);

requireEqual(attr(probe, "data-day-window"), "day", "48-hour emphasis mode", url);
requireEqual(attr(probe, "data-day-focus"), "hour,day", "48-hour focus rings", url);
requireEqual(attr(probe, "data-day-context"), "solar", "48-hour context rings", url);
requireEqual(attr(probe, "data-day-ambient"), "month,year", "48-hour ambient rings", url);
requireEqual(attr(probe, "data-day-readout"), "日內 / 48 小時", "48-hour readout", url);
near(num(probe, "data-day-hour-opacity"), 1, "48-hour Hour opacity", url);
near(num(probe, "data-day-day-opacity"), 1, "48-hour Day opacity", url);
near(num(probe, "data-day-solar-opacity"), .40, "48-hour Solar context opacity", url);
near(num(probe, "data-day-zodiac-opacity"), .40, "48-hour Zodiac follows Solar opacity", url);
near(num(probe, "data-day-month-opacity"), .22, "48-hour Month ambient opacity", url);
near(num(probe, "data-day-year-opacity"), .14, "48-hour Year ambient opacity", url);
requireDescending([
  num(probe, "data-day-day-opacity"),
  num(probe, "data-day-solar-opacity"),
  num(probe, "data-day-month-opacity"),
  num(probe, "data-day-year-opacity")
], "48-hour focus hierarchy Day > Solar > Month > Year", url);
requireEqual(attr(probe, "data-day-hour-filter"), "none", "48-hour Hour filter", url);
requireEqual(attr(probe, "data-day-day-filter"), "none", "48-hour Day filter", url);
requireIncludes(attr(probe, "data-day-solar-filter"), "saturate(0.72)", "48-hour Solar saturation recession", url);
requireIncludes(attr(probe, "data-day-solar-filter"), "brightness(0.78)", "48-hour Solar luminance recession", url);
requireEqual(attr(probe, "data-day-zodiac-filter"), attr(probe, "data-day-solar-filter"), "48-hour Zodiac follows Solar filter", url);
requireIncludes(attr(probe, "data-day-month-filter"), "saturate(0.56)", "48-hour Month saturation recession", url);
requireIncludes(attr(probe, "data-day-month-filter"), "brightness(0.62)", "48-hour Month luminance recession", url);
requireIncludes(attr(probe, "data-day-year-filter"), "saturate(0.48)", "48-hour Year saturation recession", url);
requireIncludes(attr(probe, "data-day-year-filter"), "brightness(0.55)", "48-hour Year luminance recession", url);
near(num(probe, "data-day-hover-year-opacity"), 1, "hovered 48-hour Year returns to full opacity", url);
requireEqual(attr(probe, "data-day-hover-year-filter"), "none", "hovered 48-hour Year clears recession filter", url);

requireEqual(attr(probe, "data-cycle-window"), "cycle", "60-year emphasis mode", url);
requireEqual(attr(probe, "data-cycle-focus"), "year", "60-year focus ring", url);
requireEqual(attr(probe, "data-cycle-context"), "month,solar", "60-year context rings", url);
requireEqual(attr(probe, "data-cycle-ambient"), "day,hour", "60-year ambient rings", url);
requireEqual(attr(probe, "data-cycle-readout"), "六十年", "60-year readout", url);
near(num(probe, "data-cycle-year-opacity"), 1, "60-year Year opacity", url);
near(num(probe, "data-cycle-month-opacity"), .70, "60-year Month context opacity", url);
near(num(probe, "data-cycle-solar-opacity"), .52, "60-year Solar context opacity", url);
near(num(probe, "data-cycle-zodiac-opacity"), .52, "60-year Zodiac follows Solar opacity", url);
near(num(probe, "data-cycle-day-opacity"), .48, "60-year Day ambient opacity", url);
near(num(probe, "data-cycle-hour-opacity"), .40, "60-year Hour ambient opacity", url);
requireEqual(attr(probe, "data-cycle-solar-filter"), "none", "60-year Solar filter does not inherit 48-hour recession", url);
requireEqual(attr(probe, "data-cycle-month-filter"), "none", "60-year Month filter does not inherit 48-hour recession", url);
requireEqual(attr(probe, "data-cycle-year-filter"), "none", "60-year Year filter does not inherit 48-hour recession", url);
requireDescending([
  num(probe, "data-cycle-year-opacity"),
  num(probe, "data-cycle-month-opacity"),
  num(probe, "data-cycle-solar-opacity"),
  num(probe, "data-cycle-day-opacity"),
  num(probe, "data-cycle-hour-opacity")
], "60-year hierarchy Year > Month > Solar > Day > Hour", url);

requireEqual(attr(probe, "data-all-primary-displayed"), "true", "scale emphasis must not hide primary layers", url);
requireEqual(attr(probe, "data-zodiac-displayed"), "true", "scale emphasis must not hide Zodiac overlay", url);
const selectedBefore = attr(probe, "data-selected-instant-before");
requireEqual(attr(probe, "data-day-selected-instant"), selectedBefore, "48-hour preset must not change Selected Instant", url);
requireEqual(attr(probe, "data-cycle-selected-instant"), selectedBefore, "60-year preset must not change Selected Instant", url);
requireEqual(num(probe, "data-active-scale-buttons"), 1, "one active scale button", url);
requireEqual(attr(probe, "data-current-scale-button"), "cycle", "final active scale button", url);
requireEqual(attr(probe, "data-current-aria-scale"), "cycle", "final aria-current scale button", url);

console.log(`[scale-emphasis] PASS 390px area-aware focus without hiding layers or changing Selected Instant: ${url}`);

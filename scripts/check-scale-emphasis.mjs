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
  if (!actual?.includes(expected)) throw new Error(`${label}: expected to include ${expected}, got ${actual}: ${url}`);
}

function data(prefix, ring, role) {
  return `data-${prefix}-${ring}-${role}-opacity`;
}

function assertRole(tag, prefix, ring, expected, url) {
  for (const [role, value] of Object.entries(expected)) {
    near(num(tag, data(prefix, ring, role)), value, `${prefix} ${ring} ${role}`, url);
  }
}

function assertRoleRamp(tag, prefix, ring, url) {
  const surface = num(tag, data(prefix, ring, "surface"));
  const structure = num(tag, data(prefix, ring, "structure"));
  const context = num(tag, data(prefix, ring, "context"));
  const activeSurface = num(tag, data(prefix, ring, "active-surface"));
  const active = num(tag, data(prefix, ring, "active"));
  if (![surface, structure, context, activeSurface, active].every(Number.isFinite)
    || !(surface < structure && structure < context && context < activeSurface && activeSurface < active)) {
    throw new Error(`${prefix} ${ring}: expected surface < structure < context < activeSurface < activeLabel, got ${surface},${structure},${context},${activeSurface},${active}: ${url}`);
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
requireEqual(attr(probe, "data-time-window-group-label"), "觀察時間窗", "preset group semantic label", url);
requireEqual(attr(probe, "data-time-window-visible-label"), "觀察時間窗", "preset group visible label", url);
requireEqual(attr(probe, "data-time-window-visible-label-display"), "inline-flex", "visible label pseudo display", url);
requireEqual(attr(probe, "data-time-window-visible-label-first-viewport"), "true", "visible label stays in first viewport", url);
requireEqual(attr(probe, "data-time-window-group-inside-viewport"), "true", "observation-window row stays inside 390px viewport", url);
requireEqual(attr(probe, "data-time-window-status-label"), "觀察時間窗", "timeline status semantic label", url);
requireEqual(attr(probe, "data-time-window-effects"), "slider-range,playback-tempo,reading-emphasis", "time-window coupled effects", url);
requireEqual(attr(probe, "data-time-window-geometry"), "unchanged", "time-window geometry contract", url);
requireEqual(attr(probe, "data-time-window-phase"), "unchanged", "time-window phase contract", url);
requireIncludes(attr(probe, "data-time-window-group-title"), "不改變圓盤幾何", "group must reject zoom semantics", url);
for (const [name, visibleLabel, range] of [
  ["day", "48 小時", "前後各 1 日"],
  ["year", "一年", "前後約半年"],
  ["cycle", "60 年", "前後約 30 年"]
]) {
  const aria = attr(probe, `data-${name}-button-aria-label`) ?? "";
  requireIncludes(aria, `${visibleLabel}觀察時間窗`, `${name} preset names its observation window`, url);
  requireIncludes(aria, range, `${name} preset exposes its range`, url);
  requireIncludes(aria, "播放節奏", `${name} preset exposes playback coupling`, url);
  requireIncludes(aria, "不改變圓盤幾何", `${name} preset rejects geometry zoom semantics`, url);
}

requireEqual(attr(probe, "data-initial-window"), "year", "initial one-year emphasis", url);
requireEqual(attr(probe, "data-initial-focus"), "solar,month", "one-year focus rings", url);
requireEqual(attr(probe, "data-initial-context"), "year", "one-year context rings", url);
requireEqual(attr(probe, "data-initial-ambient"), "hour,day", "one-year ambient rings", url);
requireEqual(attr(probe, "data-initial-readout"), "一年", "one-year readout", url);

/* Whole-track fading stays retired. Every mode keeps each rotating coordinate
   frame at full opacity and free of inherited brightness/saturation filters. */
for (const prefix of ["year", "day", "cycle"]) {
  for (const ring of ["hour", "day", "solar", "zodiac", "month", "year"]) {
    near(num(probe, `data-${prefix}-${ring}-track-opacity`), 1, `${prefix} ${ring} track opacity`, url);
    requireEqual(attr(probe, `data-${prefix}-${ring}-track-filter`), "none", `${prefix} ${ring} track filter`, url);
  }
}

/* One-year focus: Solar / Month retain full ink. Non-focus active sector
   surfaces recede, while the datum labels remain full strength. */
assertRole(probe, "year", "solar", { surface:1, structure:1, context:1, "active-surface":1, active:1 }, url);
assertRole(probe, "year", "zodiac", { surface:.78, context:.78, "active-surface":.84, active:1 }, url);
assertRole(probe, "year", "month", { surface:1, structure:1, context:1, "active-surface":1, active:1 }, url);
assertRole(probe, "year", "year", { surface:.56, structure:.66, context:.74, "active-surface":.82, active:1 }, url);
assertRole(probe, "year", "day", { surface:.46, structure:.58, context:.66, "active-surface":.74, active:1 }, url);
assertRole(probe, "year", "hour", { surface:.40, structure:.52, context:.62, "active-surface":.70, active:1 }, url);
for (const ring of ["year", "day", "hour"]) assertRoleRamp(probe, "year", ring, url);

requireEqual(attr(probe, "data-day-window"), "day", "48-hour emphasis mode", url);
requireEqual(attr(probe, "data-day-focus"), "hour,day", "48-hour focus rings", url);
requireEqual(attr(probe, "data-day-context"), "solar", "48-hour context rings", url);
requireEqual(attr(probe, "data-day-ambient"), "month,year", "48-hour ambient rings", url);
requireEqual(attr(probe, "data-day-readout"), "48 小時", "48-hour observation-window readout", url);
assertRole(probe, "day", "hour", { surface:1, structure:1, context:1, "active-surface":1, active:1 }, url);
assertRole(probe, "day", "day", { surface:1, structure:1, context:1, "active-surface":1, active:1 }, url);
assertRole(probe, "day", "solar", { surface:.52, structure:.62, context:.70, "active-surface":.78, active:1 }, url);
assertRole(probe, "day", "zodiac", { surface:.42, context:.56, "active-surface":.68, active:1 }, url);
assertRole(probe, "day", "month", { surface:.38, structure:.50, context:.58, "active-surface":.66, active:1 }, url);
assertRole(probe, "day", "year", { surface:.30, structure:.42, context:.50, "active-surface":.60, active:1 }, url);
for (const ring of ["solar", "month", "year"]) assertRoleRamp(probe, "day", ring, url);
near(num(probe, "data-day-hover-year-surface-opacity"), 1, "hovered Year surface returns to full ink", url);
near(num(probe, "data-day-hover-year-structure-opacity"), 1, "hovered Year structure returns to full ink", url);
near(num(probe, "data-day-hover-year-context-opacity"), 1, "hovered Year context returns to full ink", url);
near(num(probe, "data-day-hover-year-active-surface-opacity"), 1, "hovered Year active surface returns to full ink", url);
near(num(probe, "data-day-hover-year-active-opacity"), 1, "hovered Year active label remains full ink", url);

requireEqual(attr(probe, "data-cycle-window"), "cycle", "60-year emphasis mode", url);
requireEqual(attr(probe, "data-cycle-focus"), "year", "60-year focus ring", url);
requireEqual(attr(probe, "data-cycle-context"), "month,solar", "60-year context rings", url);
requireEqual(attr(probe, "data-cycle-ambient"), "day,hour", "60-year ambient rings", url);
requireEqual(attr(probe, "data-cycle-readout"), "60 年", "60-year observation-window readout", url);
assertRole(probe, "cycle", "year", { surface:1, structure:1, context:1, "active-surface":1, active:1 }, url);
assertRole(probe, "cycle", "month", { surface:.70, structure:.78, context:.84, "active-surface":.90, active:1 }, url);
assertRole(probe, "cycle", "solar", { surface:.56, structure:.66, context:.74, "active-surface":.82, active:1 }, url);
assertRole(probe, "cycle", "zodiac", { surface:.44, context:.60, "active-surface":.72, active:1 }, url);
assertRole(probe, "cycle", "day", { surface:.46, structure:.56, context:.64, "active-surface":.72, active:1 }, url);
assertRole(probe, "cycle", "hour", { surface:.40, structure:.50, context:.60, "active-surface":.68, active:1 }, url);
for (const ring of ["month", "solar", "day", "hour"]) assertRoleRamp(probe, "cycle", ring, url);

requireEqual(attr(probe, "data-all-primary-displayed"), "true", "scale emphasis must not hide primary layers", url);
requireEqual(attr(probe, "data-zodiac-displayed"), "true", "scale emphasis must not hide Zodiac overlay", url);
const selectedBefore = attr(probe, "data-selected-instant-before");
requireEqual(attr(probe, "data-day-selected-instant"), selectedBefore, "48-hour preset must not change Selected Instant", url);
requireEqual(attr(probe, "data-cycle-selected-instant"), selectedBefore, "60-year preset must not change Selected Instant", url);
requireEqual(num(probe, "data-active-scale-buttons"), 1, "one active scale button", url);
requireEqual(attr(probe, "data-current-scale-button"), "cycle", "final active scale button", url);
requireEqual(attr(probe, "data-current-aria-scale"), "cycle", "final aria-current scale button", url);

console.log(`[scale-emphasis] PASS 390px observation-window semantics + scale focus with receding active surfaces and full-strength datum labels: ${url}`);

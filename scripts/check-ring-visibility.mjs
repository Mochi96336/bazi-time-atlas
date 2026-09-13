import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const DAY_MS = 86_400_000;

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

const url = new URL("scripts/fixtures/ring-visibility-390.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=3500",
  "--window-size=500,844",
  "--dump-dom",
  url
], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium ring visibility probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
if (!probe || attr(probe, "data-ready") !== "true") {
  throw new Error(`ring visibility fixture did not settle: ${url}`);
}

const innerWidth = Number(attr(probe, "data-inner-width"));
const initialVisible = Number(attr(probe, "data-initial-visible-count"));
const hiddenVisible = Number(attr(probe, "data-hidden-visible-count"));
const restoredVisible = Number(attr(probe, "data-restored-visible-count"));
const instantBefore = Number(attr(probe, "data-instant-before"));
const instantAfterStep = Number(attr(probe, "data-instant-after-step"));
const modelBefore = Number(attr(probe, "data-day-model-before"));
const modelAfterStep = Number(attr(probe, "data-day-model-after-step"));
const hiddenTraceDelta = Number(attr(probe, "data-hidden-trace-delta"));
const hiddenDragBefore = Number(attr(probe, "data-hidden-drag-before"));
const hiddenDragAfter = Number(attr(probe, "data-hidden-drag-after"));
const dayOffset = Number(attr(probe, "data-day-offset"));

if (innerWidth !== 390) throw new Error(`visibility: fixture is not true 390px (innerWidth=${innerWidth}): ${url}`);
if (initialVisible !== 6) throw new Error(`visibility: expected six visible rings initially, got ${initialVisible}: ${url}`);
if (attr(probe, "data-hidden-pressed") !== "false" || attr(probe, "data-hidden-track") !== "true" || attr(probe, "data-hidden-trace") !== "true" || attr(probe, "data-hidden-display") !== "none") {
  throw new Error(`visibility: Day toggle did not hide track and trace cleanly: ${url}`);
}
if (attr(probe, "data-hidden-list") !== "day" || hiddenVisible !== 5) {
  throw new Error(`visibility: hidden-ring diagnostics disagree (hidden=${attr(probe, "data-hidden-list")}, visible=${hiddenVisible}): ${url}`);
}
if (![instantBefore, instantAfterStep, modelBefore, modelAfterStep, hiddenTraceDelta, hiddenDragBefore, hiddenDragAfter, dayOffset].every(Number.isFinite)) {
  throw new Error(`visibility: non-finite state diagnostics: ${url}`);
}
if (Math.abs((instantAfterStep - instantBefore) - DAY_MS) > 1) {
  throw new Error(`visibility: +1 day slider step did not advance master time exactly one day (${instantBefore} -> ${instantAfterStep}): ${url}`);
}
if (Math.abs(Math.abs(modelAfterStep - modelBefore) - 6) > 0.01) {
  throw new Error(`visibility: hidden Day model stopped or jumped incorrectly (${modelBefore} -> ${modelAfterStep}): ${url}`);
}
if (Math.abs(Math.abs(hiddenTraceDelta) - 6) > 0.01 || attr(probe, "data-hidden-trace-visible-after-step") !== "false") {
  throw new Error(`visibility: hidden Day trace did not keep baseline silently (delta=${hiddenTraceDelta}, visible=${attr(probe, "data-hidden-trace-visible-after-step")}): ${url}`);
}
if (Math.abs(hiddenDragAfter - hiddenDragBefore) > 1) {
  throw new Error(`visibility: invisible Day ring still captured pointer scrub (${hiddenDragBefore} -> ${hiddenDragAfter}): ${url}`);
}
if (attr(probe, "data-restored-pressed") !== "true" || attr(probe, "data-restored-track") !== "false" || attr(probe, "data-restored-trace") !== "false" || attr(probe, "data-restored-display") === "none") {
  throw new Error(`visibility: Day ring did not restore cleanly: ${url}`);
}
if (attr(probe, "data-restored-trace-visible") !== "false") {
  throw new Error(`visibility: restoring Day exposed a trace from hidden-time motion: ${url}`);
}
if (attr(probe, "data-restored-hidden-list") !== "" || restoredVisible !== 6) {
  throw new Error(`visibility: restored diagnostics disagree (hidden=${attr(probe, "data-restored-hidden-list")}, visible=${restoredVisible}): ${url}`);
}
if (Math.abs(dayOffset) > 1e-6 || attr(probe, "data-day-linked") !== "true") {
  throw new Error(`visibility: hide/show mutated Day linkage (offset=${dayOffset}, linked=${attr(probe, "data-day-linked")}): ${url}`);
}
if (attr(probe, "data-day-role") !== "button" || attr(probe, "data-day-tab-index") !== "0") {
  throw new Error(`visibility: legend toggle is not keyboard reachable: ${url}`);
}

console.log(`[ring-visibility] PASS true 390px hide/update/isolate/restore; Day model ${modelBefore}->${modelAfterStep}, hidden trace baseline ${hiddenTraceDelta}°, master +${DAY_MS}ms: ${url}`);

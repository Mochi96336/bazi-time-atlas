import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const EXPECTED_INSTANT_MS = Date.parse("2024-06-15T04:00:00.000Z");
const EXPECTED_OFFSET_DEGREES = 6;
const EXPECTED_ALL_DETACHED = "hour,day,solar,month,year";
const MIN_STATUS_LEGEND_GAP_PX = 4;
const MIN_STATUS_CLASSIFICATION_GAP_PX = 4;
const MAX_MOBILE_STATUS_WIDTH_PX = 372;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

const url = new URL("scripts/fixtures/free-compare-drag-390.html", baseURL).href;
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
  throw new Error(`Chromium Free Compare probe failed: ${url}`);
}

const dom = result.stdout;
const probe = dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0] ?? "";
const attr = name => probe.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
const num = name => Number(attr(name));

if (attr("data-ready") !== "true") {
  throw new Error(`Free Compare fixture did not settle (${attr("data-error") ?? "no error detail"}): ${url}`);
}
if (num("data-drag-degrees") !== EXPECTED_OFFSET_DEGREES) {
  throw new Error(`Free Compare fixture changed its canonical gesture: ${url}`);
}

function snapshot(prefix) {
  return {
    innerWidth:num(`data-${prefix}-inner-width`),
    instantMs:num(`data-${prefix}-instant-ms`),
    scrubMode:attr(`data-${prefix}-scrub-mode`) ?? "",
    compareMode:attr(`data-${prefix}-compare-mode`) ?? "",
    detachedRings:attr(`data-${prefix}-detached-rings`) ?? "",
    manualOffset:num(`data-${prefix}-manual-offset`),
    manualOffsets:attr(`data-${prefix}-manual-offsets`) ?? "",
    linked:attr(`data-${prefix}-linked`) ?? "",
    comparePressed:attr(`data-${prefix}-compare-pressed`) ?? "",
    resetHidden:attr(`data-${prefix}-reset-hidden`) ?? "",
    statusHidden:attr(`data-${prefix}-status-hidden`) ?? "",
    statusText:attr(`data-${prefix}-status-text`) ?? "",
    statusTop:num(`data-${prefix}-status-top`),
    statusBottom:num(`data-${prefix}-status-bottom`),
    statusWidth:num(`data-${prefix}-status-width`),
    statusHeight:num(`data-${prefix}-status-height`),
    legendBottom:num(`data-${prefix}-legend-bottom`),
    statusLegendOverlap:attr(`data-${prefix}-status-legend-overlap`) ?? "",
    classificationHidden:attr(`data-${prefix}-classification-hidden`) ?? "",
    classificationTop:num(`data-${prefix}-classification-top`),
    statusClassificationOverlap:attr(`data-${prefix}-status-classification-overlap`) ?? ""
  };
}

const before = snapshot("before");
const enabled = snapshot("enabled");
const detached = snapshot("detached");
const allDetached = snapshot("all-detached");
const combined = snapshot("combined");
const restored = snapshot("restored");

for (const [phase, value] of Object.entries({ before, enabled, detached, allDetached, combined, restored })) {
  if (value.innerWidth !== 390) throw new Error(`${phase} is not a true 390px viewport: ${JSON.stringify(value)}: ${url}`);
  if (value.instantMs !== EXPECTED_INSTANT_MS) {
    throw new Error(`${phase} changed Selected Instant during Free Compare: ${JSON.stringify(value)}: ${url}`);
  }
}

if (!(before.scrubMode === "linked-time" && before.compareMode === "false" && before.manualOffset === 0 && before.linked === "true")) {
  throw new Error(`baseline is not canonical linked-time state: ${JSON.stringify(before)}: ${url}`);
}

if (!(enabled.scrubMode === "free-compare" && enabled.compareMode === "true" && enabled.comparePressed === "true" && enabled.manualOffset === 0)) {
  throw new Error(`Compare button did not enter Free Compare cleanly: ${JSON.stringify(enabled)}: ${url}`);
}

for (const [phase, value] of Object.entries({ enabled, detached, allDetached, combined })) {
  if (!(value.statusHidden === "false" && value.statusLegendOverlap === "false")) {
    throw new Error(`${phase} Free Compare status overlaps the mobile layer legend: ${JSON.stringify(value)}: ${url}`);
  }
  if (!(Number.isFinite(value.statusTop) && Number.isFinite(value.statusBottom) && Number.isFinite(value.statusWidth) && Number.isFinite(value.statusHeight) && Number.isFinite(value.legendBottom))) {
    throw new Error(`${phase} Free Compare status clearance geometry is not finite: ${JSON.stringify(value)}: ${url}`);
  }
  if (value.statusTop < value.legendBottom + MIN_STATUS_LEGEND_GAP_PX) {
    throw new Error(
      `${phase} Free Compare status needs >=${MIN_STATUS_LEGEND_GAP_PX}px below legend; ` +
      `got ${value.statusTop - value.legendBottom}px: ${JSON.stringify(value)}: ${url}`
    );
  }
  if (value.statusWidth > MAX_MOBILE_STATUS_WIDTH_PX + 1e-6) {
    throw new Error(`${phase} Free Compare status escapes the 9px mobile gutters: ${JSON.stringify(value)}: ${url}`);
  }
}

if (Math.abs(detached.manualOffset - EXPECTED_OFFSET_DEGREES) > 1e-9) {
  throw new Error(`Free Compare day ring did not detent to +6°: ${JSON.stringify(detached)}: ${url}`);
}
if (!(detached.scrubMode === "free-compare" && detached.compareMode === "true" && detached.linked === "false")) {
  throw new Error(`Free Compare drag escaped manual-offset ownership: ${JSON.stringify(detached)}: ${url}`);
}
if (!(detached.detachedRings === "day" && detached.resetHidden === "false" && detached.statusHidden === "false" && detached.statusText.includes("日 +6.0°"))) {
  throw new Error(`Free Compare UI did not expose the detached day ring: ${JSON.stringify(detached)}: ${url}`);
}

if (allDetached.detachedRings !== EXPECTED_ALL_DETACHED) {
  throw new Error(`worst-case Compare did not detach all primary rings in radial order: ${JSON.stringify(allDetached)}: ${url}`);
}
for (const token of ["時 +6.0°", "日 +6.0°", "節氣 +15.0°", "月 +6.0°", "年 +6.0°"]) {
  if (!allDetached.statusText.includes(token)) {
    throw new Error(`worst-case Compare status is missing ${token}: ${JSON.stringify(allDetached)}: ${url}`);
  }
}

if (!(combined.classificationHidden === "false" && combined.statusClassificationOverlap === "false")) {
  throw new Error(`Compare status overlaps the simultaneously active classification overlay: ${JSON.stringify(combined)}: ${url}`);
}
if (!Number.isFinite(combined.classificationTop)) {
  throw new Error(`classification overlay geometry is not finite: ${JSON.stringify(combined)}: ${url}`);
}
const classificationGap = combined.classificationTop - combined.statusBottom;
if (classificationGap < MIN_STATUS_CLASSIFICATION_GAP_PX) {
  throw new Error(
    `worst-case Free Compare status needs >=${MIN_STATUS_CLASSIFICATION_GAP_PX}px above classification overlay; ` +
    `got ${classificationGap}px: ${JSON.stringify(combined)}: ${url}`
  );
}

if (!(restored.scrubMode === "linked-time" && restored.compareMode === "false" && restored.comparePressed === "false")) {
  throw new Error(`leaving Compare did not restore linked-time ownership: ${JSON.stringify(restored)}: ${url}`);
}
if (!(restored.manualOffset === 0 && restored.linked === "true" && restored.detachedRings === "" && restored.resetHidden === "true" && restored.statusHidden === "true")) {
  throw new Error(`leaving Compare did not reset ring offsets/UI: ${JSON.stringify(restored)}: ${url}`);
}

console.log(
  `[free-compare-drag] PASS true 390px pointer gestures; Selected Instant ${EXPECTED_INSTANT_MS} stayed fixed; ` +
  `Day offset 0°→${detached.manualOffset.toFixed(1)}°; all five detached; worst status ` +
  `${allDetached.statusWidth.toFixed(1)}×${allDetached.statusHeight.toFixed(1)}px; legend gap ` +
  `${(allDetached.statusTop - allDetached.legendBottom).toFixed(1)}px; classification gap ` +
  `${classificationGap.toFixed(1)}px; linked-time restored: ${url}`
);

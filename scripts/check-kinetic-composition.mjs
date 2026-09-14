import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const DAY_MS = 86_400_000;
const HOUR_PILLAR_MS = 7_200_000;
const LINKED_GESTURE_DEGREES = 6.5;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dump(path, width, height) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=3000", `--window-size=${width},${height}`, "--dump-dom", url
  ], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function requireAttr(tag, name, label, url) {
  const value = attr(tag, name);
  if (value === null) throw new Error(`${label}: missing ${name}: ${url}`);
  return value;
}

const desktop = dump("?instant=2027-03-15T13%3A20%3A09.000Z", 1440, 900);
const instrument = tagById(desktop.dom, "kinetic-instrument");
if (attr(instrument, "data-master-geometry") !== "shared-fan" || attr(instrument, "data-fan-clip") !== "active") {
  throw new Error(`desktop: shared master fan clip was not installed: ${desktop.url}`);
}
if (!desktop.dom.includes('id="kinetic-master-fan-clip"') || !desktop.dom.includes('id="kinetic-fan-layer"')) {
  throw new Error(`desktop: fan clip/wrapper missing from SVG DOM: ${desktop.url}`);
}
for (const id of ["hour-track", "day-track", "solar-track", "zodiac-track", "month-track", "year-track"]) {
  const tag = tagById(desktop.dom, id);
  if (attr(tag, "data-fan-clipped") !== "true") throw new Error(`desktop: ${id} is not under the shared fan guard: ${desktop.url}`);
}
const zodiacDesktop = tagById(desktop.dom, "zodiac-track");
const solarDesktop = tagById(desktop.dom, "solar-track");
if (attr(zodiacDesktop, "data-derived-from") !== "solar") {
  throw new Error(`desktop: Zodiac is not owned by the annual Solar frame: ${desktop.url}`);
}
if (attr(zodiacDesktop, "transform") !== attr(solarDesktop, "transform")) {
  throw new Error(`desktop: Zodiac and Solar do not share one annual transform: ${desktop.url}`);
}

const center = requireAttr(instrument, "data-geometry-center", "desktop", desktop.url).split(",").map(Number);
const innerRadius = Number(requireAttr(instrument, "data-geometry-inner-radius", "desktop", desktop.url));
const outerRadius = Number(requireAttr(instrument, "data-geometry-outer-radius", "desktop", desktop.url));
const radiusRatio = Number(requireAttr(instrument, "data-geometry-radius-ratio", "desktop", desktop.url));
const cameraMode = requireAttr(instrument, "data-geometry-camera-mode", "desktop", desktop.url);
const cameraZoom = Number(requireAttr(instrument, "data-geometry-camera-zoom", "desktop", desktop.url));
const cameraX = Number(requireAttr(instrument, "data-geometry-camera-x", "desktop", desktop.url));
const cameraY = Number(requireAttr(instrument, "data-geometry-camera-y", "desktop", desktop.url));
const cameraWidth = Number(requireAttr(instrument, "data-geometry-camera-width", "desktop", desktop.url));
const cameraHeight = Number(requireAttr(instrument, "data-geometry-camera-height", "desktop", desktop.url));
if (center.length !== 2 || !center.every(Number.isFinite) || center[1] <= 1000) {
  throw new Error(`desktop: disk center is not far enough below the viewport (${center.join(",")}): ${desktop.url}`);
}
if (![innerRadius, outerRadius, radiusRatio, cameraZoom, cameraX, cameraY, cameraWidth, cameraHeight].every(Number.isFinite)) {
  throw new Error(`desktop: missing giant-disk/camera diagnostics: ${desktop.url}`);
}
if (cameraMode !== "desktop" || Math.abs(cameraZoom - 1) > 1e-6 || Math.abs(cameraX) > 1e-6 || Math.abs(cameraWidth - 1200) > 1e-6 || Math.abs(cameraHeight - 760) > 1e-6) {
  throw new Error(`desktop: unexpected responsive camera (${cameraMode}, zoom=${cameraZoom}, box=${cameraX},${cameraY},${cameraWidth},${cameraHeight}): ${desktop.url}`);
}
if (outerRadius < 1100 || radiusRatio < 0.55) throw new Error(`desktop: disk curvature is too tight (inner=${innerRadius}, outer=${outerRadius}, ratio=${radiusRatio}): ${desktop.url}`);
const outerTopInView = center[1] - outerRadius - cameraY;
const innerTopInView = center[1] - innerRadius - cameraY;
if (outerTopInView < 70 || outerTopInView > 180 || innerTopInView <= outerTopInView || innerTopInView > 700) {
  throw new Error(`desktop: radial scale stack is not fully framed (outerTop=${outerTopInView}, innerTop=${innerTopInView}, cameraY=${cameraY}): ${desktop.url}`);
}
console.log(`[kinetic-composition] PASS desktop five-primary-ring radial hierarchy + annual overlay; center=${center.join(",")}, radii=${innerRadius}/${outerRadius}: ${desktop.url}`);

const mobile = dump("scripts/fixtures/mobile-390.html", 500, 844);
const probe = tagById(mobile.dom, "probe");
if (requireAttr(probe, "data-ready", "mobile", mobile.url) !== "true") throw new Error(`mobile: iframe probe did not settle: ${mobile.url}`);
const actualWidth = Number(requireAttr(probe, "data-inner-width", "mobile", mobile.url));
const mediaMatched = requireAttr(probe, "data-media-matched", "mobile", mobile.url);
const fit = requireAttr(probe, "data-viewport-fit", "mobile", mobile.url);
const hidden = requireAttr(probe, "data-secondary-hidden", "mobile", mobile.url);
const share = Number(requireAttr(probe, "data-instrument-share", "mobile", mobile.url));
const scrollHeight = Number(requireAttr(probe, "data-scroll-height", "mobile", mobile.url));
const viewportHeight = Number(requireAttr(probe, "data-viewport-height", "mobile", mobile.url));
const mobileCameraMode = requireAttr(probe, "data-camera-mode", "mobile", mobile.url);
const mobileCameraZoom = Number(requireAttr(probe, "data-camera-zoom", "mobile", mobile.url));
const mobileCameraX = Number(requireAttr(probe, "data-camera-x", "mobile", mobile.url));
const mobileCameraY = Number(requireAttr(probe, "data-camera-y", "mobile", mobile.url));
const mobileCameraWidth = Number(requireAttr(probe, "data-camera-width", "mobile", mobile.url));
const mobileCameraHeight = Number(requireAttr(probe, "data-camera-height", "mobile", mobile.url));
const wheelWidthRatio = Number(requireAttr(probe, "data-wheel-width-ratio", "mobile", mobile.url));
const wheelTransform = requireAttr(probe, "data-wheel-transform", "mobile", mobile.url);
const ringHitMask = requireAttr(probe, "data-ring-hit-mask", "mobile", mobile.url);
const ringHitClasses = requireAttr(probe, "data-ring-hit-classes", "mobile", mobile.url);
const ringHitDebug = requireAttr(probe, "data-ring-hit-debug", "mobile", mobile.url);
if (actualWidth !== 390 || mediaMatched !== "true") throw new Error(`mobile: fixture is not a true 390px CSS viewport (innerWidth=${actualWidth}, match=${mediaMatched}): ${mobile.url}`);
if (fit !== "true") throw new Error(`mobile: page still scrolls (${scrollHeight} > ${viewportHeight}): ${mobile.url}`);
if (hidden !== "true") throw new Error(`mobile: secondary dashboard sections were not collapsed: ${mobile.url}`);
if (!Number.isFinite(share) || share < 0.70) throw new Error(`mobile: instrument occupies too little of first viewport (${share}): ${mobile.url}`);
if (attr(probe, "data-fan-clip") !== "active" || attr(probe, "data-master-geometry") !== "shared-fan") throw new Error(`mobile: shared fan geometry inactive inside 390px fixture: ${mobile.url}`);
if (mobileCameraMode !== "mobile" || Math.abs(mobileCameraZoom - 2.3) > 1e-4) {
  throw new Error(`mobile: camera is not wheel-core mobile mode (${mobileCameraMode}, zoom=${mobileCameraZoom}): ${mobile.url}`);
}
if (![mobileCameraX, mobileCameraY, mobileCameraWidth, mobileCameraHeight, wheelWidthRatio].every(Number.isFinite)) {
  throw new Error(`mobile: non-finite camera/layout diagnostics: ${mobile.url}`);
}
if (Math.abs(mobileCameraX - 339.13) > 0.02 || Math.abs(mobileCameraY - 58) > 0.02 || Math.abs(mobileCameraWidth - 521.739) > 0.02 || Math.abs(mobileCameraHeight - 760) > 0.02) {
  throw new Error(`mobile: wrong viewBox crop (${mobileCameraX},${mobileCameraY},${mobileCameraWidth},${mobileCameraHeight}): ${mobile.url}`);
}
if (Math.abs(wheelWidthRatio - 1) > 0.01 || (wheelTransform !== "none" && wheelTransform !== "matrix(1, 0, 0, 1, 0, 0)")) {
  throw new Error(`mobile: CSS still owns wheel zoom (widthRatio=${wheelWidthRatio}, transform=${wheelTransform}): ${mobile.url}`);
}
if (ringHitMask !== "11111") throw new Error(`mobile: not all five primary time rings are visibly hit-testable (mask=${ringHitMask}; hits=${ringHitClasses}; debug=${ringHitDebug}): ${mobile.url}`);
if (requireAttr(probe, "data-zodiac-derived-from", "mobile", mobile.url) !== "solar" || requireAttr(probe, "data-zodiac-transform-matches-solar", "mobile", mobile.url) !== "true") {
  throw new Error(`mobile: Zodiac escaped the shared annual Solar transform: ${mobile.url}`);
}
if (requireAttr(probe, "data-zodiac-pointer-events", "mobile", mobile.url) !== "none") {
  throw new Error(`mobile: derived Zodiac overlay became an independent pointer target: ${mobile.url}`);
}
console.log(`[kinetic-composition] PASS true 390px five-ring composition + derived Zodiac overlay; instrument share=${share}, ringHits=${ringHitMask}: ${mobile.url}`);

const hour = dump("scripts/fixtures/mobile-390.html?exerciseHourDrag=1", 500, 844);
const hourProbe = tagById(hour.dom, "probe");
if (requireAttr(hourProbe, "data-hour-drag-ready", "hour-drag", hour.url) !== "true") {
  throw new Error(`hour-drag: fixture did not exercise linked hour scrub: ${hour.url}`);
}
const hourRing = requireAttr(hourProbe, "data-hour-drag-ring", "hour-drag", hour.url);
const hourInstantBefore = Number(requireAttr(hourProbe, "data-hour-instant-before", "hour-drag", hour.url));
const hourInstantAfter = Number(requireAttr(hourProbe, "data-hour-instant-after", "hour-drag", hour.url));
const hourModelBefore = Number(requireAttr(hourProbe, "data-hour-model-before", "hour-drag", hour.url));
const hourModelAfter = Number(requireAttr(hourProbe, "data-hour-model-after", "hour-drag", hour.url));
const hourSolarBefore = Number(requireAttr(hourProbe, "data-hour-solar-model-before", "hour-drag", hour.url));
const hourSolarAfter = Number(requireAttr(hourProbe, "data-hour-solar-model-after", "hour-drag", hour.url));
const hourOffsetBefore = Number(requireAttr(hourProbe, "data-hour-offset-before", "hour-drag", hour.url));
const hourOffsetAfter = Number(requireAttr(hourProbe, "data-hour-offset-after", "hour-drag", hour.url));
const hourLinkedState = requireAttr(hourProbe, "data-hour-linked-state", "hour-drag", hour.url);
const hourPillarBefore = requireAttr(hourProbe, "data-hour-pillar-before", "hour-drag", hour.url);
const hourPillarAfter = requireAttr(hourProbe, "data-hour-pillar-after", "hour-drag", hour.url);
const hourScrubMode = requireAttr(hourProbe, "data-hour-scrub-mode", "hour-drag", hour.url);
if (hourRing !== "hour" || hourScrubMode !== "linked-time") {
  throw new Error(`hour-drag: normal drag was not routed through linked hour scrub (ring=${hourRing}, mode=${hourScrubMode}): ${hour.url}`);
}
if (![hourInstantBefore, hourInstantAfter, hourModelBefore, hourModelAfter, hourSolarBefore, hourSolarAfter, hourOffsetBefore, hourOffsetAfter].every(Number.isFinite)) {
  throw new Error(`hour-drag: non-finite diagnostics: ${hour.url}`);
}
const expectedHourDeltaMs = HOUR_PILLAR_MS * LINKED_GESTURE_DEGREES / 6;
if (Math.abs((hourInstantAfter - hourInstantBefore) + expectedHourDeltaMs) > 1) {
  throw new Error(`hour-drag: +${LINKED_GESTURE_DEGREES}° hour drag should move master time proportionally backward (${hourInstantBefore} -> ${hourInstantAfter}): ${hour.url}`);
}
if (Math.abs((hourModelAfter - hourModelBefore) - LINKED_GESTURE_DEGREES) > 0.01) {
  throw new Error(`hour-drag: hour model should follow the full gesture continuously (${hourModelBefore} -> ${hourModelAfter}): ${hour.url}`);
}
if (Math.abs(hourOffsetBefore) > 1e-6 || Math.abs(hourOffsetAfter) > 1e-6 || hourLinkedState !== "true") {
  throw new Error(`hour-drag: linked scrub must keep zero manual offset (before=${hourOffsetBefore}, after=${hourOffsetAfter}, linked=${hourLinkedState}): ${hour.url}`);
}
if (!hourPillarBefore || !hourPillarAfter || hourPillarBefore === hourPillarAfter) {
  throw new Error(`hour-drag: resolved hour pillar did not change (${hourPillarBefore} -> ${hourPillarAfter}): ${hour.url}`);
}
if (Math.abs(hourSolarAfter - hourSolarBefore) < 0.02) {
  throw new Error(`hour-drag: coupled solar layer did not move with continuous master time (${hourSolarBefore} -> ${hourSolarAfter}): ${hour.url}`);
}
console.log(`[kinetic-composition] PASS continuous linked hour-ring scrub: ${hour.url}`);

const linked = dump("scripts/fixtures/mobile-390.html?exerciseLinkedDrag=1", 500, 844);
const linkedProbe = tagById(linked.dom, "probe");
if (requireAttr(linkedProbe, "data-linked-drag-ready", "linked-drag", linked.url) !== "true") {
  throw new Error(`linked-drag: fixture did not exercise normal-mode ring scrub: ${linked.url}`);
}
const linkedRing = requireAttr(linkedProbe, "data-linked-drag-ring", "linked-drag", linked.url);
const linkedInstantBefore = Number(requireAttr(linkedProbe, "data-linked-instant-before", "linked-drag", linked.url));
const linkedInstantAfter = Number(requireAttr(linkedProbe, "data-linked-instant-after", "linked-drag", linked.url));
const linkedDayModelBefore = Number(requireAttr(linkedProbe, "data-linked-day-model-before", "linked-drag", linked.url));
const linkedDayModelAfter = Number(requireAttr(linkedProbe, "data-linked-day-model-after", "linked-drag", linked.url));
const linkedSolarModelBefore = Number(requireAttr(linkedProbe, "data-linked-solar-model-before", "linked-drag", linked.url));
const linkedSolarModelAfter = Number(requireAttr(linkedProbe, "data-linked-solar-model-after", "linked-drag", linked.url));
const linkedDayOffsetBefore = Number(requireAttr(linkedProbe, "data-linked-day-offset-before", "linked-drag", linked.url));
const linkedDayOffsetAfter = Number(requireAttr(linkedProbe, "data-linked-day-offset-after", "linked-drag", linked.url));
const linkedDayState = requireAttr(linkedProbe, "data-linked-day-state", "linked-drag", linked.url);
const linkedScrubMode = requireAttr(linkedProbe, "data-linked-scrub-mode", "linked-drag", linked.url);
if (linkedRing !== "day" || linkedScrubMode !== "linked-time") {
  throw new Error(`linked-drag: normal drag was not routed through linked day scrub (ring=${linkedRing}, mode=${linkedScrubMode}): ${linked.url}`);
}
if (![linkedInstantBefore, linkedInstantAfter, linkedDayModelBefore, linkedDayModelAfter, linkedSolarModelBefore, linkedSolarModelAfter, linkedDayOffsetBefore, linkedDayOffsetAfter].every(Number.isFinite)) {
  throw new Error(`linked-drag: non-finite diagnostics: ${linked.url}`);
}
const expectedDayDeltaMs = DAY_MS * LINKED_GESTURE_DEGREES / 6;
if (Math.abs((linkedInstantAfter - linkedInstantBefore) + expectedDayDeltaMs) > 1) {
  throw new Error(`linked-drag: +${LINKED_GESTURE_DEGREES}° day drag should map proportionally through the real day interval (${linkedInstantBefore} -> ${linkedInstantAfter}): ${linked.url}`);
}
if (Math.abs((linkedDayModelAfter - linkedDayModelBefore) - LINKED_GESTURE_DEGREES) > 0.01) {
  throw new Error(`linked-drag: day model should follow the full gesture continuously (${linkedDayModelBefore} -> ${linkedDayModelAfter}): ${linked.url}`);
}
if (Math.abs(linkedDayOffsetBefore) > 1e-6 || Math.abs(linkedDayOffsetAfter) > 1e-6 || linkedDayState !== "true") {
  throw new Error(`linked-drag: normal scrub must stay linked with zero manual offset: ${linked.url}`);
}
if (Math.abs(linkedSolarModelAfter - linkedSolarModelBefore) < 0.5) {
  throw new Error(`linked-drag: coupled solar layer did not move with master time: ${linked.url}`);
}
console.log(`[kinetic-composition] PASS continuous linked day-ring scrub: ${linked.url}`);

const drag = dump("scripts/fixtures/mobile-390.html?exerciseDrag=1", 500, 844);
const dragProbe = tagById(drag.dom, "probe");
if (requireAttr(dragProbe, "data-drag-ready", "drag", drag.url) !== "true") throw new Error(`drag: fixture did not exercise pointer drag: ${drag.url}`);
const draggedRing = requireAttr(dragProbe, "data-drag-ring", "drag", drag.url);
const modelBefore = Number(requireAttr(dragProbe, "data-drag-model-before", "drag", drag.url));
const modelAfter = Number(requireAttr(dragProbe, "data-drag-model-after", "drag", drag.url));
const offsetAfter = Number(requireAttr(dragProbe, "data-drag-offset-after", "drag", drag.url));
const linkedAfter = requireAttr(dragProbe, "data-drag-linked-after", "drag", drag.url);
const detachedAfter = requireAttr(dragProbe, "data-drag-detached-after", "drag", drag.url);
const statusAfter = requireAttr(dragProbe, "data-drag-status-after", "drag", drag.url);
const offsetReset = Number(requireAttr(dragProbe, "data-drag-offset-reset", "drag", drag.url));
const linkedReset = requireAttr(dragProbe, "data-drag-linked-reset", "drag", drag.url);
if (draggedRing !== "day") throw new Error(`drag: expected day ring, got ${draggedRing}: ${drag.url}`);
if (![modelBefore, modelAfter, offsetAfter, offsetReset].every(Number.isFinite)) throw new Error(`drag: non-finite pose diagnostics: ${drag.url}`);
if (Math.abs(modelAfter - modelBefore) > 1e-6) throw new Error(`drag: manual drag mutated model rotation (${modelBefore} -> ${modelAfter}): ${drag.url}`);
if (Math.abs(offsetAfter - 12) > 0.01) throw new Error(`drag: +10° free gesture should release onto the 12° day-ring detent, got ${offsetAfter}: ${drag.url}`);
if (linkedAfter !== "false" || detachedAfter !== "day" || !statusAfter.includes("日")) throw new Error(`drag: detached state was not explicit: ${drag.url}`);
if (Math.abs(offsetReset) > 1e-6 || linkedReset !== "true") throw new Error(`drag: reset did not relink day ring: ${drag.url}`);
console.log(`[kinetic-composition] PASS independent day-ring detent: ${drag.url}`);

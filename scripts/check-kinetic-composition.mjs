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
const radialDepth = Number(requireAttr(instrument, "data-geometry-radial-depth", "desktop", desktop.url));
const radialDepthRatio = Number(requireAttr(instrument, "data-geometry-radial-depth-ratio", "desktop", desktop.url));
const cameraMode = requireAttr(instrument, "data-geometry-camera-mode", "desktop", desktop.url);
const cameraZoom = Number(requireAttr(instrument, "data-geometry-camera-zoom", "desktop", desktop.url));
const cameraX = Number(requireAttr(instrument, "data-geometry-camera-x", "desktop", desktop.url));
const cameraY = Number(requireAttr(instrument, "data-geometry-camera-y", "desktop", desktop.url));
const cameraWidth = Number(requireAttr(instrument, "data-geometry-camera-width", "desktop", desktop.url));
const cameraHeight = Number(requireAttr(instrument, "data-geometry-camera-height", "desktop", desktop.url));
const cameraAspect = Number(requireAttr(instrument, "data-geometry-camera-aspect", "desktop", desktop.url));
const cameraOriginGap = Number(requireAttr(instrument, "data-geometry-camera-origin-gap", "desktop", desktop.url));
const cameraOriginGapRatio = Number(requireAttr(instrument, "data-geometry-camera-origin-gap-ratio", "desktop", desktop.url));
const cameraInnerBlank = Number(requireAttr(instrument, "data-geometry-camera-inner-blank", "desktop", desktop.url));
const cameraInnerBlankRatio = Number(requireAttr(instrument, "data-geometry-camera-inner-blank-ratio", "desktop", desktop.url));
if (center.length !== 2 || !center.every(Number.isFinite)) {
  throw new Error(`desktop: invalid canonical disk center (${center.join(",")}): ${desktop.url}`);
}
if (![innerRadius, outerRadius, radiusRatio, radialDepth, radialDepthRatio, cameraZoom, cameraX, cameraY, cameraWidth, cameraHeight, cameraAspect, cameraOriginGap, cameraOriginGapRatio, cameraInnerBlank, cameraInnerBlankRatio].every(Number.isFinite)) {
  throw new Error(`desktop: missing giant-disk/camera diagnostics: ${desktop.url}`);
}
if (!(innerRadius > 0 && outerRadius > innerRadius) || Math.abs(radiusRatio - innerRadius / outerRadius) > 0.001) {
  throw new Error(`desktop: invalid radial envelope (inner=${innerRadius}, outer=${outerRadius}, ratio=${radiusRatio}): ${desktop.url}`);
}
if (Math.abs(radialDepth - (outerRadius - innerRadius)) > 0.02 || Math.abs(radialDepthRatio - radialDepth / outerRadius) > 0.001 || radialDepthRatio < 0.55) {
  throw new Error(`desktop: radial stack is not deep enough to carry the five-scale hierarchy (depth=${radialDepth}, ratio=${radialDepthRatio}): ${desktop.url}`);
}
if (cameraMode !== "desktop" || cameraZoom <= 0 || cameraWidth <= 0 || cameraHeight <= 0 || cameraAspect <= 0) {
  throw new Error(`desktop: invalid responsive camera (${cameraMode}, zoom=${cameraZoom}, box=${cameraX},${cameraY},${cameraWidth},${cameraHeight}, aspect=${cameraAspect}): ${desktop.url}`);
}
if (Math.abs(cameraWidth / cameraHeight - cameraAspect) > 0.002) {
  throw new Error(`desktop: camera viewBox no longer follows rendered aspect (${cameraWidth}/${cameraHeight} vs ${cameraAspect}): ${desktop.url}`);
}
const recomputedDesktopOriginGap = center[1] - (cameraY + cameraHeight);
const recomputedDesktopInnerBlank = innerRadius - recomputedDesktopOriginGap;
if (Math.abs(recomputedDesktopOriginGap - cameraOriginGap) > 0.02 || Math.abs(cameraOriginGap / outerRadius - cameraOriginGapRatio) > 0.001) {
  throw new Error(`desktop: origin-gap diagnostics disagree (gap=${cameraOriginGap}, ratio=${cameraOriginGapRatio}): ${desktop.url}`);
}
if (Math.abs(recomputedDesktopInnerBlank - cameraInnerBlank) > 0.02 || Math.abs(cameraInnerBlank / outerRadius - cameraInnerBlankRatio) > 0.001) {
  throw new Error(`desktop: inner-blank diagnostics disagree (blank=${cameraInnerBlank}, ratio=${cameraInnerBlankRatio}): ${desktop.url}`);
}
if (cameraOriginGap < 0 || cameraOriginGapRatio > 0.40) {
  throw new Error(`desktop: common radial origin is too remote from the frame (gap=${cameraOriginGap}, ratio=${cameraOriginGapRatio}): ${desktop.url}`);
}
if (cameraInnerBlank < 0 || cameraInnerBlankRatio > 0.12) {
  throw new Error(`desktop: camera exposes too much dead inner-disk area (blank=${cameraInnerBlank}, ratio=${cameraInnerBlankRatio}): ${desktop.url}`);
}
const outerTopInView = center[1] - outerRadius - cameraY;
if (outerTopInView < 0 || outerTopInView > cameraHeight * 0.15) {
  throw new Error(`desktop: outer Year crown is not framed near the top (outerTop=${outerTopInView}, cameraHeight=${cameraHeight}): ${desktop.url}`);
}
console.log(`[kinetic-composition] PASS desktop deep radial composition; depthRatio=${radialDepthRatio}, originGapRatio=${cameraOriginGapRatio}, innerBlankRatio=${cameraInnerBlankRatio}: ${desktop.url}`);

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
const activeCycleLabelMatchMask = requireAttr(probe, "data-active-cycle-label-match-mask", "mobile", mobile.url);
const activeCycleLabelVisibleMask = requireAttr(probe, "data-active-cycle-label-visible-mask", "mobile", mobile.url);
const activeCycleLabelUniqueMask = requireAttr(probe, "data-active-cycle-label-unique-mask", "mobile", mobile.url);
const activeCycleDuplicateVisibleMask = requireAttr(probe, "data-active-cycle-duplicate-visible-mask", "mobile", mobile.url);
const activeCycleIndices = requireAttr(probe, "data-active-cycle-indices", "mobile", mobile.url);
const activeCycleLabels = requireAttr(probe, "data-active-cycle-labels", "mobile", mobile.url);
const activeCycleLabelDebug = requireAttr(probe, "data-active-cycle-label-debug", "mobile", mobile.url);
if (actualWidth !== 390 || mediaMatched !== "true") throw new Error(`mobile: fixture is not a true 390px CSS viewport (innerWidth=${actualWidth}, match=${mediaMatched}): ${mobile.url}`);
if (fit !== "true") throw new Error(`mobile: page still scrolls (${scrollHeight} > ${viewportHeight}): ${mobile.url}`);
if (hidden !== "true") throw new Error(`mobile: secondary dashboard sections were not collapsed: ${mobile.url}`);
if (!Number.isFinite(share) || share < 0.70) throw new Error(`mobile: instrument occupies too little of first viewport (${share}): ${mobile.url}`);
if (attr(probe, "data-fan-clip") !== "active" || attr(probe, "data-master-geometry") !== "shared-fan") throw new Error(`mobile: shared fan geometry inactive inside 390px fixture: ${mobile.url}`);
if (mobileCameraMode !== "mobile" || !Number.isFinite(mobileCameraZoom) || mobileCameraZoom <= 0) {
  throw new Error(`mobile: invalid portrait wheel-core camera (${mobileCameraMode}, zoom=${mobileCameraZoom}): ${mobile.url}`);
}
if (![mobileCameraX, mobileCameraY, mobileCameraWidth, mobileCameraHeight, wheelWidthRatio].every(Number.isFinite) || mobileCameraWidth <= 0 || mobileCameraHeight <= 0) {
  throw new Error(`mobile: non-finite camera/layout diagnostics: ${mobile.url}`);
}
const mobileOriginGap = center[1] - (mobileCameraY + mobileCameraHeight);
const mobileOriginGapRatio = mobileOriginGap / outerRadius;
const mobileInnerBlank = innerRadius - mobileOriginGap;
const mobileInnerBlankRatio = mobileInnerBlank / outerRadius;
const mobileOuterTopInView = center[1] - outerRadius - mobileCameraY;
if (mobileOriginGap < 0 || mobileOriginGapRatio > 0.40) {
  throw new Error(`mobile: radial origin is too remote from portrait frame (gap=${mobileOriginGap}, ratio=${mobileOriginGapRatio}): ${mobile.url}`);
}
if (mobileInnerBlank < 0 || mobileInnerBlankRatio > 0.12) {
  throw new Error(`mobile: portrait framing exposes too much dead inner disk (blank=${mobileInnerBlank}, ratio=${mobileInnerBlankRatio}): ${mobile.url}`);
}
if (mobileOuterTopInView < 0 || mobileOuterTopInView > mobileCameraHeight * 0.15) {
  throw new Error(`mobile: outer Year crown is not preserved near the portrait top (outerTop=${mobileOuterTopInView}, cameraHeight=${mobileCameraHeight}): ${mobile.url}`);
}
if (Math.abs(wheelWidthRatio - 1) > 0.01 || (wheelTransform !== "none" && wheelTransform !== "matrix(1, 0, 0, 1, 0, 0)")) {
  throw new Error(`mobile: CSS still owns wheel zoom (widthRatio=${wheelWidthRatio}, transform=${wheelTransform}): ${mobile.url}`);
}
if (ringHitMask !== "11111") throw new Error(`mobile: not all five primary time rings are visibly hit-testable (mask=${ringHitMask}; hits=${ringHitClasses}; debug=${ringHitDebug}): ${mobile.url}`);
if (activeCycleLabelMatchMask !== "1111" || activeCycleLabelVisibleMask !== "1111" || activeCycleLabelUniqueMask !== "1111") {
  throw new Error(
    `mobile: active Ganzhi read-heads do not uniquely match their active sectors ` +
    `(match=${activeCycleLabelMatchMask}, visible=${activeCycleLabelVisibleMask}, unique=${activeCycleLabelUniqueMask}, ` +
    `indices=${activeCycleIndices}, labels=${activeCycleLabels}, debug=${activeCycleLabelDebug}): ${mobile.url}`
  );
}
if (activeCycleDuplicateVisibleMask !== "0000") {
  throw new Error(`mobile: active Ganzhi read-head doubled an existing sampled label (duplicates=${activeCycleDuplicateVisibleMask}, debug=${activeCycleLabelDebug}): ${mobile.url}`);
}
if (requireAttr(probe, "data-zodiac-derived-from", "mobile", mobile.url) !== "solar" || requireAttr(probe, "data-zodiac-transform-matches-solar", "mobile", mobile.url) !== "true") {
  throw new Error(`mobile: Zodiac escaped the shared annual Solar transform: ${mobile.url}`);
}
if (requireAttr(probe, "data-zodiac-pointer-events", "mobile", mobile.url) !== "none") {
  throw new Error(`mobile: derived Zodiac overlay became an independent pointer target: ${mobile.url}`);
}
console.log(
  `[kinetic-composition] PASS true 390px deep radial composition + derived Zodiac overlay; ` +
  `originGapRatio=${mobileOriginGapRatio.toFixed(4)}, innerBlankRatio=${mobileInnerBlankRatio.toFixed(4)}, ` +
  `instrument share=${share}, ringHits=${ringHitMask}, active Ganzhi=${activeCycleLabels}: ${mobile.url}`
);

const sampledTarget = encodeURIComponent("../../?instant=2029-03-15T13:20:09.000Z");
const sampledMobile = dump(`scripts/fixtures/mobile-390.html?target=${sampledTarget}`, 500, 844);
const sampledProbe = tagById(sampledMobile.dom, "probe");
const sampledMatchMask = requireAttr(sampledProbe, "data-active-cycle-label-match-mask", "sampled-active-label", sampledMobile.url);
const sampledVisibleMask = requireAttr(sampledProbe, "data-active-cycle-label-visible-mask", "sampled-active-label", sampledMobile.url);
const sampledUniqueMask = requireAttr(sampledProbe, "data-active-cycle-label-unique-mask", "sampled-active-label", sampledMobile.url);
const sampledStaticMask = requireAttr(sampledProbe, "data-active-cycle-sampled-mask", "sampled-active-label", sampledMobile.url);
const sampledDuplicateMask = requireAttr(sampledProbe, "data-active-cycle-duplicate-visible-mask", "sampled-active-label", sampledMobile.url);
const sampledIndices = requireAttr(sampledProbe, "data-active-cycle-indices", "sampled-active-label", sampledMobile.url);
const sampledLabels = requireAttr(sampledProbe, "data-active-cycle-labels", "sampled-active-label", sampledMobile.url);
const sampledDebug = requireAttr(sampledProbe, "data-active-cycle-label-debug", "sampled-active-label", sampledMobile.url);
if (sampledMatchMask !== "1111" || sampledVisibleMask !== "1111" || sampledUniqueMask !== "1111") {
  throw new Error(`sampled-active-label: read-head contract failed (match=${sampledMatchMask}, visible=${sampledVisibleMask}, unique=${sampledUniqueMask}, debug=${sampledDebug}): ${sampledMobile.url}`);
}
if (sampledStaticMask[3] !== "1" || sampledDuplicateMask[3] !== "0") {
  throw new Error(
    `sampled-active-label: 2029 Year index should collide with a five-step sample but render only the read-head ` +
    `(sampled=${sampledStaticMask}, duplicates=${sampledDuplicateMask}, indices=${sampledIndices}, labels=${sampledLabels}, debug=${sampledDebug}): ${sampledMobile.url}`
  );
}
console.log(`[kinetic-composition] PASS sampled Year active label dedupe at 390px; indices=${sampledIndices}, labels=${sampledLabels}: ${sampledMobile.url}`);

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
if (requireAttr(hourProbe, "data-active-cycle-label-match-mask", "hour-drag", hour.url) !== "1111") {
  throw new Error(`hour-drag: active Ganzhi read-heads did not follow the changed pillar state: ${hour.url}`);
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
if (requireAttr(linkedProbe, "data-active-cycle-label-match-mask", "linked-drag", linked.url) !== "1111") {
  throw new Error(`linked-drag: active Ganzhi read-heads did not follow the changed day state: ${linked.url}`);
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

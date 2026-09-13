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
for (const id of ["year-track", "month-track", "day-track", "solar-track", "zodiac-track"]) {
  const tag = tagById(desktop.dom, id);
  if (attr(tag, "data-fan-clipped") !== "true") throw new Error(`desktop: ${id} is not under the shared fan guard: ${desktop.url}`);
}

const center = requireAttr(instrument, "data-geometry-center", "desktop", desktop.url).split(",").map(Number);
const innerRadius = Number(requireAttr(instrument, "data-geometry-inner-radius", "desktop", desktop.url));
const outerRadius = Number(requireAttr(instrument, "data-geometry-outer-radius", "desktop", desktop.url));
const radiusRatio = Number(requireAttr(instrument, "data-geometry-radius-ratio", "desktop", desktop.url));
const cameraY = Number(requireAttr(instrument, "data-geometry-camera-y", "desktop", desktop.url));
if (center.length !== 2 || !center.every(Number.isFinite) || center[1] <= 1000) {
  throw new Error(`desktop: disk center is not far enough below the viewport (${center.join(",")}): ${desktop.url}`);
}
if (![innerRadius, outerRadius, radiusRatio, cameraY].every(Number.isFinite)) throw new Error(`desktop: missing giant-disk/camera diagnostics: ${desktop.url}`);
if (outerRadius < 1100 || radiusRatio < 0.60) throw new Error(`desktop: disk curvature is too tight (inner=${innerRadius}, outer=${outerRadius}, ratio=${radiusRatio}): ${desktop.url}`);
const outerTopInView = center[1] - outerRadius - cameraY;
const innerTopInView = center[1] - innerRadius - cameraY;
if (outerTopInView < 70 || outerTopInView > 180 || innerTopInView <= outerTopInView || innerTopInView > 700) {
  throw new Error(`desktop: five-ring stack is not fully framed (outerTop=${outerTopInView}, innerTop=${innerTopInView}, cameraY=${cameraY}): ${desktop.url}`);
}
console.log(`[kinetic-composition] PASS desktop shared giant-disk geometry; center=${center.join(",")}, radii=${innerRadius}/${outerRadius}, ratio=${radiusRatio}, cameraY=${cameraY}, stack=${outerTopInView}..${innerTopInView}: ${desktop.url}`);

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
const ringHitMask = requireAttr(probe, "data-ring-hit-mask", "mobile", mobile.url);
const ringHitClasses = requireAttr(probe, "data-ring-hit-classes", "mobile", mobile.url);
const ringHitDebug = requireAttr(probe, "data-ring-hit-debug", "mobile", mobile.url);
if (actualWidth !== 390 || mediaMatched !== "true") throw new Error(`mobile: fixture is not a true 390px CSS viewport (innerWidth=${actualWidth}, match=${mediaMatched}): ${mobile.url}`);
if (fit !== "true") throw new Error(`mobile: page still scrolls (${scrollHeight} > ${viewportHeight}): ${mobile.url}`);
if (hidden !== "true") throw new Error(`mobile: secondary dashboard sections were not collapsed: ${mobile.url}`);
if (!Number.isFinite(share) || share < 0.70) throw new Error(`mobile: instrument occupies too little of first viewport (${share}): ${mobile.url}`);
if (attr(probe, "data-fan-clip") !== "active" || attr(probe, "data-master-geometry") !== "shared-fan") throw new Error(`mobile: shared fan geometry inactive inside 390px fixture: ${mobile.url}`);
if (ringHitMask !== "11111") throw new Error(`mobile: not all five ring midpoints are visibly hit-testable (mask=${ringHitMask}; hits=${ringHitClasses}; debug=${ringHitDebug}): ${mobile.url}`);
console.log(`[kinetic-composition] PASS true 390px first viewport; instrument share=${share}, scroll=${scrollHeight}/${viewportHeight}, ringHits=${ringHitMask}: ${mobile.url}`);

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
if (Math.abs(offsetAfter - 10) > 0.25) throw new Error(`drag: expected about +10° manual offset, got ${offsetAfter}: ${drag.url}`);
if (linkedAfter !== "false" || detachedAfter !== "day" || !statusAfter.includes("日")) throw new Error(`drag: detached state was not explicit (linked=${linkedAfter}, detached=${detachedAfter}, status=${statusAfter}): ${drag.url}`);
if (Math.abs(offsetReset) > 1e-6 || linkedReset !== "true") throw new Error(`drag: reset did not relink day ring (offset=${offsetReset}, linked=${linkedReset}): ${drag.url}`);
console.log(`[kinetic-composition] PASS independent day-ring drag; model=${modelBefore}, manual=${offsetAfter.toFixed(3)}°, reset=${offsetReset}: ${drag.url}`);

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
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=6000",
    `--window-size=${width},${height}`,
    "--dump-dom",
    url,
  ], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium wide-desktop probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function requireAttr(tag, name, url) {
  const value = attr(tag, name);
  if (value === null) throw new Error(`wide desktop: missing ${name}: ${url}`);
  return value;
}

function numberAttr(tag, name, url) {
  const value = Number(requireAttr(tag, name, url));
  if (!Number.isFinite(value)) throw new Error(`wide desktop: ${name} is not finite: ${url}`);
  return value;
}

const page = dump("scripts/fixtures/wide-desktop-2047.html", 2100, 1100);
const probe = tagById(page.dom, "probe");
if (requireAttr(probe, "data-ready", page.url) !== "true") {
  throw new Error(`wide desktop: composition probe did not settle: ${page.url}`);
}

const width = numberAttr(probe, "data-inner-width", page.url);
const height = numberAttr(probe, "data-inner-height", page.url);
const scrollWidth = numberAttr(probe, "data-scroll-width", page.url);
const scrollHeight = numberAttr(probe, "data-scroll-height", page.url);
const instrumentTop = numberAttr(probe, "data-instrument-top", page.url);
const instrumentBottom = numberAttr(probe, "data-instrument-bottom", page.url);
const topbarTop = numberAttr(probe, "data-topbar-top", page.url);
const topbarBottom = numberAttr(probe, "data-topbar-bottom", page.url);
const instrumentHeight = numberAttr(probe, "data-instrument-height", page.url);
const instrumentBottomGap = numberAttr(probe, "data-instrument-bottom-gap", page.url);
const readoutTop = numberAttr(probe, "data-readout-top", page.url);
const readoutBottom = numberAttr(probe, "data-readout-bottom", page.url);
const readoutBottomGap = numberAttr(probe, "data-readout-bottom-gap", page.url);
const toolbarTop = numberAttr(probe, "data-toolbar-top", page.url);
const toolbarBottom = numberAttr(probe, "data-toolbar-bottom", page.url);
const toolbarLeft = numberAttr(probe, "data-toolbar-left", page.url);
const siteNavRight = numberAttr(probe, "data-site-nav-right", page.url);
const researchTop = numberAttr(probe, "data-research-top", page.url);
const researchBottom = numberAttr(probe, "data-research-bottom", page.url);
const researchHeight = numberAttr(probe, "data-research-height", page.url);
const timelineTop = numberAttr(probe, "data-timeline-top", page.url);
const timelineBottom = numberAttr(probe, "data-timeline-bottom", page.url);
const timelineLeft = numberAttr(probe, "data-timeline-left", page.url);
const timelineRight = numberAttr(probe, "data-timeline-right", page.url);
const solarTop = numberAttr(probe, "data-solar-top", page.url);
const solarBottom = numberAttr(probe, "data-solar-bottom", page.url);
const solarLeft = numberAttr(probe, "data-solar-left", page.url);
const solarRight = numberAttr(probe, "data-solar-right", page.url);
const evidenceTop = numberAttr(probe, "data-evidence-top", page.url);
const evidenceBottom = numberAttr(probe, "data-evidence-bottom", page.url);
const evidenceLeft = numberAttr(probe, "data-evidence-left", page.url);
const evidenceRight = numberAttr(probe, "data-evidence-right", page.url);
const evidenceGridWidth = numberAttr(probe, "data-evidence-grid-width", page.url);
const closeTop = numberAttr(probe, "data-close-top", page.url);
const closeBottom = numberAttr(probe, "data-close-bottom", page.url);
const closeRight = numberAttr(probe, "data-close-right", page.url);
const toolbarFont = numberAttr(probe, "data-toolbar-font", page.url);
const evidenceValueFont = numberAttr(probe, "data-evidence-value-font", page.url);
const evidenceInfoMinFont = numberAttr(probe, "data-evidence-info-min-font", page.url);
const closeFont = numberAttr(probe, "data-close-font", page.url);
const scaleVisible = numberAttr(probe, "data-scale-visible", page.url);
const ringToggleVisible = numberAttr(probe, "data-ring-toggle-visible", page.url);
const hourVisibleLabels = numberAttr(probe, "data-hour-visible-labels", page.url);
const dayVisibleLabels = numberAttr(probe, "data-day-visible-labels", page.url);

if (width !== 2047 || height !== 1038) {
  throw new Error(`wide desktop: fixture is not an exact 2047x1038 CSS viewport (${width}x${height}): ${page.url}`);
}
if (requireAttr(probe, "data-analysis-open", page.url) !== "true") {
  throw new Error(`wide desktop: Tools did not open in the review frame: ${page.url}`);
}
if (scrollWidth > width + 1) {
  throw new Error(`wide desktop: horizontal overflow returned (${scrollWidth} > ${width}): ${page.url}`);
}

const instrumentShare = instrumentHeight / height;
if (instrumentTop < 0 || instrumentBottom > height + 1 || instrumentBottomGap < -1 || instrumentBottomGap > 16) {
  throw new Error(`wide desktop: Tools left a dead footer band or escaped the first viewport (top=${instrumentTop}, bottom=${instrumentBottom}, gap=${instrumentBottomGap}): ${page.url}`);
}
if (instrumentShare < 0.92 || instrumentShare > 0.97) {
  throw new Error(`wide desktop: wheel lost its full-height Tools share (${instrumentShare.toFixed(3)}): ${page.url}`);
}
if (readoutTop < instrumentTop || readoutBottom > instrumentBottom || readoutBottomGap < 24) {
  throw new Error(`wide desktop: Selected Instant is clipped or too close to the viewport edge (top=${readoutTop}, bottom=${readoutBottom}, gap=${readoutBottomGap}): ${page.url}`);
}

/* Tools must remain edge-assist chrome over the existing instrument rather than
   reopening the retired bottom dashboard. A small shell/footer allowance is
   acceptable, but tool content itself must be fixed/absolute and viewport-bound. */
if (scrollHeight > height + 90) {
  throw new Error(`wide desktop: Tools grew the document instead of staying in the viewport (scrollHeight=${scrollHeight}, viewport=${height}): ${page.url}`);
}
if (requireAttr(probe, "data-site-nav-display", page.url) === "none") {
  throw new Error(`wide desktop: global Research exit disappeared in focused Tools mode: ${page.url}`);
}
if (siteNavRight > toolbarLeft - 24) {
  throw new Error(`wide desktop: global Research exit collides with Tools actions (navRight=${siteNavRight}, toolbarLeft=${toolbarLeft}): ${page.url}`);
}
const topbarCenter = (topbarTop + topbarBottom) / 2;
const researchCenter = (researchTop + researchBottom) / 2;
if (researchHeight < 28 || Math.abs(researchCenter - topbarCenter) > 2) {
  throw new Error(
    `wide desktop: Research text/hitbox is not centered in the global top row ` +
    `(research=${researchTop}-${researchBottom}/h${researchHeight}, topbar=${topbarTop}-${topbarBottom}): ${page.url}`
  );
}
if (toolbarTop < topbarTop || toolbarBottom > topbarBottom + 2) {
  throw new Error(`wide desktop: primary actions did not converge into the global top row (topbar=${topbarTop}-${topbarBottom}, toolbar=${toolbarTop}-${toolbarBottom}): ${page.url}`);
}
if (
  requireAttr(probe, "data-legend-display", page.url) !== "none"
  || requireAttr(probe, "data-reference-display", page.url) !== "none"
) {
  throw new Error(`wide desktop: retired reference/layer chrome resurfaced in Tools: ${page.url}`);
}
if (requireAttr(probe, "data-timeline-display", page.url) !== "none") {
  throw new Error(`wide desktop: duplicate edge exact-time rail resurfaced: ${page.url}`);
}
if (solarLeft < -1 || solarRight > 390 || solarTop < 80 || solarBottom > height + 1) {
  throw new Error(`wide desktop: Solar Time is not viewport-bound to the left edge (solar=${solarLeft}-${solarRight}@${solarTop}-${solarBottom}): ${page.url}`);
}
if (evidenceRight < width - 2 || evidenceRight > width + 1 || evidenceLeft < width - 430 || evidenceTop < 75 || evidenceBottom >= readoutTop) {
  throw new Error(`wide desktop: Four Pillars evidence is not a right-edge inspector (evidence=${evidenceLeft}-${evidenceRight}@${evidenceTop}-${evidenceBottom}, readoutTop=${readoutTop}): ${page.url}`);
}
if (evidenceGridWidth < 240) {
  throw new Error(`wide desktop: Four Pillars summary is squeezed inside the right rail (gridWidth=${evidenceGridWidth}): ${page.url}`);
}
if (Math.abs(closeTop - toolbarTop) > 2 || Math.abs(closeBottom - toolbarBottom) > 3 || closeRight < width - 60) {
  throw new Error(`wide desktop: Done action is not integrated into the primary action row (toolbar=${toolbarTop}-${toolbarBottom}, close=${closeTop}-${closeBottom}@${closeRight}): ${page.url}`);
}

if (scaleVisible !== 0 || requireAttr(probe, "data-play-display", page.url) !== "none" || ringToggleVisible !== 0) {
  throw new Error(`wide desktop: retired desktop Tools chrome resurfaced (scale=${scaleVisible}, play=${requireAttr(probe, "data-play-display", page.url)}, ringToggles=${ringToggleVisible}): ${page.url}`);
}
for (const name of ["state-strip", "notes", "sources"]) {
  if (requireAttr(probe, `data-${name}-display`, page.url) !== "none") {
    throw new Error(`wide desktop: ${name} still extends the Tools workspace below the wheel: ${page.url}`);
  }
}

if (toolbarFont < 9 || evidenceValueFont < 10 || evidenceInfoMinFont < 9 || closeFont < 8) {
  throw new Error(
    `wide desktop: control/evidence type fell below readable floor ` +
    `(toolbar=${toolbarFont}, evidence=${evidenceValueFont}, evidenceInfoMin=${evidenceInfoMinFont}, close=${closeFont}): ${page.url}`
  );
}
if (hourVisibleLabels !== 60 || dayVisibleLabels !== 60) {
  throw new Error(
    `wide desktop: Day / Hour labels were thinned into an alternating comb ` +
    `(hour=${hourVisibleLabels}, day=${dayVisibleLabels}; expected 60/60): ${page.url}`
  );
}

console.log(
  `[wide-desktop] PASS 2047x1038 edge Tools; ` +
  `instrumentShare=${instrumentShare.toFixed(3)}, viewportGap=${instrumentBottomGap}px, readoutGap=${readoutBottomGap}px, topbar=${topbarTop}-${topbarBottom}, research=${researchTop}-${researchBottom}, ` +
  `left=${solarLeft}-${solarRight}, right=${evidenceLeft}-${evidenceRight}/grid=${evidenceGridWidth}, scrollHeight=${scrollHeight}, ` +
  `fonts=${toolbarFont}/${evidenceValueFont}/${evidenceInfoMinFont}/${closeFont}, ` +
  `fastLabels=${hourVisibleLabels}/${dayVisibleLabels}: ${page.url}`
);

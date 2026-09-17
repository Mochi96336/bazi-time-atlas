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
    "--virtual-time-budget=3200",
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
const instrumentTop = numberAttr(probe, "data-instrument-top", page.url);
const instrumentBottom = numberAttr(probe, "data-instrument-bottom", page.url);
const instrumentHeight = numberAttr(probe, "data-instrument-height", page.url);
const instrumentBottomGap = numberAttr(probe, "data-instrument-bottom-gap", page.url);
const readoutTop = numberAttr(probe, "data-readout-top", page.url);
const readoutBottom = numberAttr(probe, "data-readout-bottom", page.url);
const readoutBottomGap = numberAttr(probe, "data-readout-bottom-gap", page.url);
const toolbarTop = numberAttr(probe, "data-toolbar-top", page.url);
const toolbarBottom = numberAttr(probe, "data-toolbar-bottom", page.url);
const legendTop = numberAttr(probe, "data-legend-top", page.url);
const legendBottom = numberAttr(probe, "data-legend-bottom", page.url);
const evidenceTop = numberAttr(probe, "data-evidence-top", page.url);
const evidenceBottom = numberAttr(probe, "data-evidence-bottom", page.url);
const toolbarFont = numberAttr(probe, "data-toolbar-font", page.url);
const legendFont = numberAttr(probe, "data-legend-font", page.url);
const evidenceValueFont = numberAttr(probe, "data-evidence-value-font", page.url);
const closeFont = numberAttr(probe, "data-close-font", page.url);
const hourVisibleLabels = numberAttr(probe, "data-hour-visible-labels", page.url);
const dayVisibleLabels = numberAttr(probe, "data-day-visible-labels", page.url);

if (width !== 2047 || height !== 1038) {
  throw new Error(`wide desktop: fixture is not an exact 2047x1038 CSS viewport (${width}x${height}): ${page.url}`);
}
if (requireAttr(probe, "data-analysis-open", page.url) !== "true") {
  throw new Error(`wide desktop: Analysis did not open in the review frame: ${page.url}`);
}
if (scrollWidth > width + 1) {
  throw new Error(`wide desktop: horizontal overflow returned (${scrollWidth} > ${width}): ${page.url}`);
}

const instrumentShare = instrumentHeight / height;
if (instrumentTop < 0 || instrumentBottom > height - 24 || instrumentBottomGap < 24) {
  throw new Error(`wide desktop: instrument is not contained in the first viewport (top=${instrumentTop}, bottom=${instrumentBottom}, gap=${instrumentBottomGap}): ${page.url}`);
}
if (instrumentShare < 0.80 || instrumentShare > 0.90) {
  throw new Error(`wide desktop: wheel lost its intended first-screen share (${instrumentShare.toFixed(3)}): ${page.url}`);
}
if (readoutTop < instrumentTop || readoutBottom > instrumentBottom || readoutBottomGap < 40) {
  throw new Error(`wide desktop: Selected Instant is clipped or too close to the viewport edge (top=${readoutTop}, bottom=${readoutBottom}, gap=${readoutBottomGap}): ${page.url}`);
}

if (toolbarTop < instrumentTop || toolbarBottom > legendTop + 1) {
  throw new Error(`wide desktop: primary toolbar collides with the secondary rail (${toolbarTop}-${toolbarBottom} vs legendTop=${legendTop}): ${page.url}`);
}
if (legendBottom > evidenceTop - 4) {
  throw new Error(`wide desktop: layer/reference rail collides with evidence rail (${legendBottom} vs ${evidenceTop}): ${page.url}`);
}
if (evidenceBottom >= readoutTop) {
  throw new Error(`wide desktop: evidence rail intrudes into the Selected Instant region (${evidenceBottom} >= ${readoutTop}): ${page.url}`);
}

if (toolbarFont < 10 || legendFont < 9 || evidenceValueFont < 10 || closeFont < 9) {
  throw new Error(
    `wide desktop: control/evidence type fell below readable floor ` +
    `(toolbar=${toolbarFont}, legend=${legendFont}, evidence=${evidenceValueFont}, close=${closeFont}): ${page.url}`
  );
}

if (hourVisibleLabels !== 60 || dayVisibleLabels !== 60) {
  throw new Error(
    `wide desktop: Day / Hour labels were thinned into an alternating comb ` +
    `(hour=${hourVisibleLabels}, day=${dayVisibleLabels}; expected 60/60): ${page.url}`
  );
}

console.log(
  `[wide-desktop] PASS 2047x1038 composition; ` +
  `instrumentShare=${instrumentShare.toFixed(3)}, viewportGap=${instrumentBottomGap}px, readoutGap=${readoutBottomGap}px, ` +
  `fonts=${toolbarFont}/${legendFont}/${evidenceValueFont}/${closeFont}, ` +
  `fastLabels=${hourVisibleLabels}/${dayVisibleLabels}: ${page.url}`
);

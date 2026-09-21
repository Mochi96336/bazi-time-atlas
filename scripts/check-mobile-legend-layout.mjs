import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const EPS = 1.5;
const DIRECT_LABELS = [
  ["year", "年"],
  ["month", "月"],
  ["solar", "太陽"],
  ["day", "日"],
  ["hour", "時"]
];

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dump(path) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=2500", "--window-size=500,844", "--dump-dom", url
  ], { encoding:"utf8", maxBuffer:4 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium legend probe failed: ${url}`);
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

function rect(probe, prefix, label, url) {
  const result = {};
  for (const edge of ["top", "right", "bottom", "left", "width", "height"]) {
    const name = `data-${prefix}-${edge}`;
    result[edge] = Number(requireAttr(probe, name, label, url));
  }
  if (!Object.values(result).every(Number.isFinite)) {
    throw new Error(`${label}: non-finite ${prefix} rect ${JSON.stringify(result)}: ${url}`);
  }
  return result;
}

function overlaps(a, b) {
  return a.left < b.right - EPS && a.right > b.left + EPS && a.top < b.bottom - EPS && a.bottom > b.top + EPS;
}

function inside(inner, outer) {
  return inner.left >= outer.left - EPS && inner.right <= outer.right + EPS && inner.top >= outer.top - EPS && inner.bottom <= outer.bottom + EPS;
}

function validateNormal(run, probe, { edited = false } = {}) {
  const instrument = rect(probe, "instrument", "normal", run.url);
  const legend = rect(probe, "legend", "normal", run.url);
  const toolbar = rect(probe, "toolbar", "normal", run.url);
  const open = rect(probe, "open", "normal", run.url);
  const openFontSize = Number.parseFloat(requireAttr(probe, "data-open-font-size", "normal", run.url));
  const labels = DIRECT_LABELS.map(([id, expected]) => ({ id, expected, box:rect(probe, id, "normal", run.url) }));

  if (Math.abs(legend.left - instrument.left) > EPS || Math.abs(legend.top - instrument.top) > EPS || legend.width < instrument.width * 0.98 || legend.height < instrument.height * 0.98) {
    throw new Error(`normal: direct-label overlay no longer owns the instrument frame (legend=${JSON.stringify(legend)}, instrument=${JSON.stringify(instrument)}): ${run.url}`);
  }

  let previousCenter = -Infinity;
  for (const { id, expected, box } of labels) {
    if (!inside(box, instrument)) {
      throw new Error(`normal: ${id} identity escaped the instrument frame (${JSON.stringify(box)}): ${run.url}`);
    }
    const center = (box.top + box.bottom) / 2;
    if (center <= previousCenter + instrument.height * 0.07) {
      throw new Error(`normal: radial identity order collapsed near ${id} (center=${center}, previous=${previousCenter}): ${run.url}`);
    }
    previousCenter = center;

    const identity = requireAttr(probe, `data-${id}-identity`, "normal", run.url);
    const dotVisible = requireAttr(probe, `data-${id}-dot-visible`, "normal", run.url);
    const valueVisible = requireAttr(probe, `data-${id}-value-visible`, "normal", run.url);
    const position = requireAttr(probe, `data-${id}-position`, "normal", run.url);
    if (!identity.includes(expected)) {
      throw new Error(`normal: ${id} identity text mismatch (${identity} !~= ${expected}): ${run.url}`);
    }
    if (dotVisible !== "false" || valueVisible !== "false" || position !== "absolute") {
      throw new Error(`normal: ${id} still behaves like a live HUD row (dot=${dotVisible}, value=${valueVisible}, position=${position}): ${run.url}`);
    }
  }

  if (
    Math.abs(open.top - toolbar.top) > 3
    || open.height < 30
    || !Number.isFinite(openFontSize)
    || openFontSize < 8.5
  ) {
    throw new Error(
      "normal: Tools entry fell out of the primary mobile action row " +
      "(toolbarTop=" + toolbar.top.toFixed(1) +
      ", open=" + open.top.toFixed(1) + ".." + open.bottom.toFixed(1) +
      ", font=" + openFontSize + "): " + run.url
    );
  }

  const expectedDirty = String(edited);
  if (
    requireAttr(probe, "data-mobile-time-dirty", "normal", run.url) !== expectedDirty
    || requireAttr(probe, "data-mobile-time-apply-visible", "normal", run.url) !== expectedDirty
  ) {
    throw new Error(`normal: exact-time Apply disclosure disagrees with dirty state (edited=${edited}): ${run.url}`);
  }

  if (requireAttr(probe, "data-reference-visible", "normal", run.url) !== "false" ||
      requireAttr(probe, "data-open-visible", "normal", run.url) !== "true" ||
      requireAttr(probe, "data-close-visible", "normal", run.url) !== "false" ||
      requireAttr(probe, "data-state-strip-visible", "normal", run.url) !== "false" ||
      requireAttr(probe, "data-analysis-open", "normal", run.url) !== "false") {
    throw new Error(`normal: progressive-disclosure visibility contract failed: ${run.url}`);
  }

  console.log(`[mobile-legend] PASS normal direct radial identities; ${labels.map(({id, box}) => `${id}=${((box.top + box.bottom) / 2).toFixed(1)}`).join(", ")}: ${run.url}`);
}

function validateClassification(run, probe) {
  const instrument = rect(probe, "instrument", "classification", run.url);
  const legend = rect(probe, "classification-legend", "classification", run.url);
  const heading = Number.parseFloat(requireAttr(probe, "data-classification-heading-font", "classification", run.url));
  const hint = Number.parseFloat(requireAttr(probe, "data-classification-hint-font", "classification", run.url));
  const key = Number.parseFloat(requireAttr(probe, "data-classification-key-font", "classification", run.url));
  const keyHeight = Number.parseFloat(requireAttr(probe, "data-classification-key-height", "classification", run.url));
  const warning = Number.parseFloat(requireAttr(probe, "data-classification-warning-font", "classification", run.url));

  if (requireAttr(probe, "data-classification-legend-visible", "classification", run.url) !== "true") {
    throw new Error("classification: evidence legend is not visible: " + run.url);
  }
  if (
    !Number.isFinite(heading) || heading < 8
    || !Number.isFinite(hint) || hint < 6
    || !Number.isFinite(key) || key < 7
    || !Number.isFinite(keyHeight) || keyHeight < 16
    || !Number.isFinite(warning) || warning < 6.5
  ) {
    throw new Error(
      "classification: mobile legend fell below readable type floor " +
      "(heading=" + heading + ", hint=" + hint + ", key=" + key + "/h" + keyHeight +
      ", warning=" + warning + "): " + run.url
    );
  }
  if (
    legend.top < instrument.bottom + 5
    || legend.left < instrument.left - 1
    || legend.right > instrument.right + 1
    || legend.height > 110
  ) {
    throw new Error(
      "classification: legend escaped its reserved evidence band " +
      "(instrumentBottom=" + instrument.bottom.toFixed(1) +
      ", legend=" + legend.left.toFixed(1) + ".." + legend.right.toFixed(1) +
      " × " + legend.top.toFixed(1) + ".." + legend.bottom.toFixed(1) +
      "/h" + legend.height.toFixed(1) + "): " + run.url
    );
  }

  console.log(
    "[mobile-legend] PASS classification evidence readability; heading=" + heading +
    "px, hint=" + hint + "px, key=" + key + "px/" + keyHeight +
    "px, warning=" + warning + "px: " + run.url
  );
}

function validateAnalysis(run, probe) {
  const toolbar = rect(probe, "toolbar", "analysis", run.url);
  const close = rect(probe, "close", "analysis", run.url);
  const actionBoxes = ["find-time", "classification", "solar-time", "now"].map(name => ({
    name,
    box:rect(probe, name, "analysis", run.url),
    fontSize:Number.parseFloat(requireAttr(probe, `data-${name}-font-size`, "analysis", run.url))
  }));
  const fourPillars = rect(probe, "four-pillars", "analysis", run.url);
  const fourPillarCells = Array.from({ length:4 }, (_, index) =>
    rect(probe, `four-pillar-cell${index}`, "analysis", run.url)
  );

  if (
    requireAttr(probe, "data-mobile-time-dirty", "analysis", run.url) !== "false"
    || requireAttr(probe, "data-mobile-time-apply-visible", "analysis", run.url) !== "true"
  ) {
    throw new Error("analysis: exact-time Apply was incorrectly hidden by ordinary-reading progressive disclosure: " + run.url);
  }

  if (
    requireAttr(probe, "data-analysis-open", "analysis", run.url) !== "true"
    || requireAttr(probe, "data-reference-visible", "analysis", run.url) !== "false"
    || requireAttr(probe, "data-open-visible", "analysis", run.url) !== "false"
    || requireAttr(probe, "data-close-visible", "analysis", run.url) !== "true"
  ) {
    throw new Error("analysis: progressive-disclosure visibility contract failed: " + run.url);
  }

  if (
    requireAttr(probe, "data-scale-visible", "analysis", run.url) !== "0"
    || requireAttr(probe, "data-play-visible", "analysis", run.url) !== "false"
    || requireAttr(probe, "data-ring-toggle-visible", "analysis", run.url) !== "0"
  ) {
    throw new Error("analysis: retired mobile dashboard controls resurfaced: " + run.url);
  }

  for (const name of ["find-time", "classification", "solar-time", "now"]) {
    if (requireAttr(probe, `data-${name}-visible`, "analysis", run.url) !== "true") {
      throw new Error("analysis: primary mobile Tools action disappeared (" + name + "): " + run.url);
    }
  }
  if (requireAttr(probe, "data-cursor-note-visible", "analysis", run.url) !== "false") {
    throw new Error("analysis: duplicate Selected Instant caption resurfaced: " + run.url);
  }

  if (
    Math.abs(close.top - toolbar.top) > 2
    || Math.abs(close.bottom - toolbar.bottom) > 3
    || close.height < 40
  ) {
    throw new Error(
      "analysis: Done did not return to the primary mobile action row " +
      "(toolbar=" + toolbar.top.toFixed(1) + ".." + toolbar.bottom.toFixed(1) +
      ", close=" + close.top.toFixed(1) + ".." + close.bottom.toFixed(1) + "): " + run.url
    );
  }

  for (const action of actionBoxes) {
    if (action.box.height < 40 || !Number.isFinite(action.fontSize) || action.fontSize < 9.5) {
      throw new Error(
        "analysis: primary Tools action is still visually/tactually undersized (" +
        action.name + "=" + action.box.height.toFixed(1) + "px/" + action.fontSize.toFixed(1) + "px font): " + run.url
      );
    }
  }

  if (
    requireAttr(probe, "data-four-pillars-visible", "analysis", run.url) !== "true"
    || requireAttr(probe, "data-four-pillars-cell-count", "analysis", run.url) !== "4"
    || requireAttr(probe, "data-four-pillars-note-visible", "analysis", run.url) !== "false"
  ) {
    throw new Error("analysis: compact Four Pillars inspector rail lost its product ownership: " + run.url);
  }
  if (fourPillars.height > 78 || fourPillars.top < toolbar.bottom + 3) {
    throw new Error(
      "analysis: Four Pillars rail is too tall or collides with the action row " +
      "(rail=" + fourPillars.top.toFixed(1) + ".." + fourPillars.bottom.toFixed(1) +
      "/h" + fourPillars.height.toFixed(1) + ", toolbarBottom=" + toolbar.bottom.toFixed(1) + "): " + run.url
    );
  }
  const cellTop = Math.min(...fourPillarCells.map(cell => cell.top));
  const cellBottom = Math.max(...fourPillarCells.map(cell => cell.bottom));
  if (
    fourPillarCells.some(cell => Math.abs(cell.top - cellTop) > 2 || Math.abs(cell.bottom - cellBottom) > 2)
    || fourPillarCells.some(cell => cell.width < 70 || cell.height < 38)
  ) {
    throw new Error("analysis: Four Pillars fell back to a stacked dashboard instead of one touch row: " + run.url);
  }

  console.log(
    "[mobile-legend] PASS Tools product rail; readable >=40px actions=find-time/classification/solar-time/now/done, " +
    "Four Pillars=" + fourPillars.height.toFixed(1) + "px one-row rail, reference-frame hidden, retired scale/play/layers hidden: " + run.url
  );
}

function validate(run, { analysis, edited = false, classification = false }) {
  const probe = tagById(run.dom, "probe");
  if (requireAttr(probe, "data-ready", "legend", run.url) !== "true") {
    throw new Error(`legend: fixture did not settle: ${run.url}`);
  }
  if (Number(requireAttr(probe, "data-inner-width", "legend", run.url)) !== 390) {
    throw new Error(`legend: fixture is not a true 390px viewport: ${run.url}`);
  }
  if (classification) validateClassification(run, probe);
  else if (analysis) validateAnalysis(run, probe);
  else validateNormal(run, probe, { edited });
}

validate(dump("scripts/fixtures/mobile-legend-390.html"), { analysis:false, edited:false });
validate(dump("scripts/fixtures/mobile-legend-390.html?edit=1"), { analysis:false, edited:true });
validate(dump("scripts/fixtures/mobile-legend-390.html?analysis=1"), { analysis:true });
validate(dump("scripts/fixtures/mobile-legend-390.html?classification=1"), { classification:true });

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

function validateNormal(run, probe) {
  const instrument = rect(probe, "instrument", "normal", run.url);
  const legend = rect(probe, "legend", "normal", run.url);
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

  if (requireAttr(probe, "data-reference-visible", "normal", run.url) !== "false" ||
      requireAttr(probe, "data-open-visible", "normal", run.url) !== "true" ||
      requireAttr(probe, "data-close-visible", "normal", run.url) !== "false" ||
      requireAttr(probe, "data-state-strip-visible", "normal", run.url) !== "false" ||
      requireAttr(probe, "data-analysis-open", "normal", run.url) !== "false") {
    throw new Error(`normal: progressive-disclosure visibility contract failed: ${run.url}`);
  }

  console.log(`[mobile-legend] PASS normal direct radial identities; ${labels.map(({id, box}) => `${id}=${((box.top + box.bottom) / 2).toFixed(1)}`).join(", ")}: ${run.url}`);
}

function validateAnalysis(run, probe) {
  const legend = rect(probe, "legend", "analysis", run.url);
  const reference = rect(probe, "reference", "analysis", run.url);
  const close = rect(probe, "close", "analysis", run.url);

  if (
    requireAttr(probe, "data-analysis-open", "analysis", run.url) !== "true"
    || requireAttr(probe, "data-reference-visible", "analysis", run.url) !== "true"
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

  for (const name of ["classification", "find-time", "now"]) {
    if (requireAttr(probe, `data-${name}-visible`, "analysis", run.url) !== "true") {
      throw new Error("analysis: primary mobile Tools action disappeared (" + name + "): " + run.url);
    }
  }
  if (requireAttr(probe, "data-cursor-note-visible", "analysis", run.url) !== "false") {
    throw new Error("analysis: duplicate Selected Instant caption resurfaced: " + run.url);
  }

  if (reference.left < legend.left - EPS || reference.right > legend.right + EPS) {
    throw new Error("analysis: reference frame escaped compact observation rail: " + run.url);
  }
  if (Math.abs(reference.top - close.top) > 3 || overlaps(reference, close)) {
    throw new Error(
      "analysis: reference frame and Done do not share one non-overlapping secondary row " +
      "(reference=" + reference.top.toFixed(1) + ".." + reference.right.toFixed(1) +
      ", close=" + close.top.toFixed(1) + ".." + close.left.toFixed(1) + "): " + run.url
    );
  }

  console.log(
    "[mobile-legend] PASS Tools de-dashboard; actions=classification/find-time/now, " +
    "reference=" + reference.top.toFixed(1) + ", close=" + close.top.toFixed(1) +
    ", retired scale/play/layers hidden: " + run.url
  );
}

function validate(run, { analysis }) {
  const probe = tagById(run.dom, "probe");
  if (requireAttr(probe, "data-ready", "legend", run.url) !== "true") {
    throw new Error(`legend: fixture did not settle: ${run.url}`);
  }
  if (Number(requireAttr(probe, "data-inner-width", "legend", run.url)) !== 390) {
    throw new Error(`legend: fixture is not a true 390px viewport: ${run.url}`);
  }
  if (analysis) validateAnalysis(run, probe);
  else validateNormal(run, probe);
}

validate(dump("scripts/fixtures/mobile-legend-390.html"), { analysis:false });
validate(dump("scripts/fixtures/mobile-legend-390.html?analysis=1"), { analysis:true });

import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const EPS = 1.5;

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

function validateRows(run, { analysis }) {
  const probe = tagById(run.dom, "probe");
  if (requireAttr(probe, "data-ready", "legend", run.url) !== "true") {
    throw new Error(`legend: fixture did not settle: ${run.url}`);
  }
  if (Number(requireAttr(probe, "data-inner-width", "legend", run.url)) !== 390) {
    throw new Error(`legend: fixture is not a true 390px viewport: ${run.url}`);
  }

  const legend = rect(probe, "legend", "legend", run.url);
  const rows = ["year", "month", "day", "hour"].map(id => ({ id, box:rect(probe, id, "legend", run.url) }));
  const solar = rect(probe, "solar", "legend", run.url);

  const rowTop = rows[0].box.top;
  const rowBottom = Math.max(...rows.map(row => row.box.bottom));
  for (const row of rows) {
    if (Math.abs(row.box.top - rowTop) > EPS) {
      throw new Error(`legend: ${row.id} escaped first row (${row.box.top} vs ${rowTop}): ${run.url}`);
    }
    if (row.box.left < legend.left - EPS || row.box.right > legend.right + EPS) {
      throw new Error(`legend: ${row.id} overflowed legend bounds: ${run.url}`);
    }
  }
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i - 1].box.left >= rows[i].box.left || rows[i - 1].box.right > rows[i].box.left + EPS) {
      throw new Error(`legend: first row is not ordered/non-overlapping at ${rows[i - 1].id}->${rows[i].id}: ${run.url}`);
    }
  }
  if (solar.top <= rowBottom - EPS) {
    throw new Error(`legend: solar row did not move below four-pillar row (${solar.top} <= ${rowBottom}): ${run.url}`);
  }
  if (solar.left < legend.left - EPS || solar.right > legend.right + EPS || solar.width < legend.width * 0.90) {
    throw new Error(`legend: solar row does not span the legend (${solar.left},${solar.right}, width=${solar.width}/${legend.width}): ${run.url}`);
  }

  const referenceVisible = requireAttr(probe, "data-reference-visible", "legend", run.url) === "true";
  const openVisible = requireAttr(probe, "data-open-visible", "legend", run.url) === "true";
  const closeVisible = requireAttr(probe, "data-close-visible", "legend", run.url) === "true";
  const analysisOpen = requireAttr(probe, "data-analysis-open", "legend", run.url);

  if (!analysis) {
    if (analysisOpen !== "false" || referenceVisible || !openVisible || closeVisible) {
      throw new Error(`legend: normal mode visibility contract failed (analysis=${analysisOpen}, ref=${referenceVisible}, open=${openVisible}, close=${closeVisible}): ${run.url}`);
    }
    console.log(`[mobile-legend] PASS normal 390px grid; row=${rowTop.toFixed(1)}, solar=${solar.top.toFixed(1)}: ${run.url}`);
    return;
  }

  if (analysisOpen !== "true" || !referenceVisible || openVisible || !closeVisible) {
    throw new Error(`legend: Analysis visibility contract failed (analysis=${analysisOpen}, ref=${referenceVisible}, open=${openVisible}, close=${closeVisible}): ${run.url}`);
  }
  const reference = rect(probe, "reference", "legend", run.url);
  const close = rect(probe, "close", "legend", run.url);
  if (reference.top <= solar.bottom - EPS) {
    throw new Error(`legend: reference frame did not get its own row (${reference.top} <= ${solar.bottom}): ${run.url}`);
  }
  if (reference.left < legend.left - EPS || reference.right > legend.right + EPS || reference.width < legend.width * 0.90) {
    throw new Error(`legend: reference row does not span the legend: ${run.url}`);
  }
  if (overlaps(reference, close) || close.top < reference.bottom - EPS) {
    throw new Error(`legend: Analysis close overlaps reference row (reference bottom=${reference.bottom}, close top=${close.top}): ${run.url}`);
  }
  console.log(`[mobile-legend] PASS Analysis 390px grid; solar=${solar.top.toFixed(1)}, reference=${reference.top.toFixed(1)}, close=${close.top.toFixed(1)}: ${run.url}`);
}

validateRows(dump("scripts/fixtures/mobile-legend-390.html"), { analysis:false });
validateRows(dump("scripts/fixtures/mobile-legend-390.html?analysis=1"), { analysis:true });

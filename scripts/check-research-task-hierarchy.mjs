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

function dump(path) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=3500", "--window-size=390,844", "--dump-dom", url
  ], { encoding:"utf8", maxBuffer:16 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function sectionById(dom, id) {
  const start = dom.indexOf(`id="${id}"`);
  if (start < 0) return "";
  const open = dom.lastIndexOf("<section", start);
  if (open < 0) return "";
  const tag = /<\/?section\b[^>]*>/g;
  tag.lastIndex = open;
  let depth = 0;
  let match;
  while ((match = tag.exec(dom))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return dom.slice(open, tag.lastIndex);
  }
  return "";
}

const probe = dump("recurrence.html?delta=24000&targetClock=fixed-zone&targetTime=12%3A00%3A00&ut1Offset=8&dayBoundary=zi-initial-next-day&clockBasis=local-mean-solar&lon=121.5");
const discrete = sectionById(probe.dom, "research-discrete");
const astronomy = sectionById(probe.dom, "research-astronomy");
const evidence = sectionById(probe.dom, "research-evidence");

if (!discrete || !astronomy || !evidence) throw new Error(`three Research ownership sections were not rendered: ${probe.url}`);
if (!discrete.includes('id="recurrence-instrument"') || !discrete.includes('class="closure-grid"') || !discrete.includes('id="research-sexagenary-cycle"')) {
  throw new Error(`discrete task lost instrument, closure evidence, or 60-day cycle: ${probe.url}`);
}
if (!discrete.includes('id="research-cycle-title">甲子</') || !discrete.includes('id="research-cycle-ordinal" class="research-cycle-ordinal">01 / 60</')) {
  throw new Error(`60-day Ganzhi cycle did not initialize at 甲子 / 01: ${probe.url}`);
}
if (discrete.includes('class="near-search-panel"') || discrete.includes('id="four-pillar-determinacy"')) {
  throw new Error(`discrete task still owns downstream astronomy/evidence UI: ${probe.url}`);
}
if (!astronomy.includes('class="astronomy-panel"') || !astronomy.includes('id="month-boundary-exposure"') || !astronomy.includes('class="near-search-panel"')) {
  throw new Error(`astronomy task did not retain residual, month-boundary, and near-recurrence evidence: ${probe.url}`);
}
if (!evidence.includes('id="four-pillar-determinacy"') || !evidence.includes('id="day-hour-proof-chain"') || !evidence.includes('id="seasonal-epoch-source-audit"')) {
  throw new Error(`four-pillar evidence task did not retain its proof chain and source audit: ${probe.url}`);
}
if (!evidence.includes('class="model-boundary research-evidence-appendix"')) {
  throw new Error(`model boundary is no longer attached to the evidence task: ${probe.url}`);
}
if (probe.dom.includes('class="research-task-nav"') || /先回答：|再問：|最後才問：|Why 24,000\?|Exact ≠ astronomical/.test(probe.dom)) {
  throw new Error(`retired Research task cards or redundant explainer copy returned: ${probe.url}`);
}

console.log(`[research-hierarchy] PASS concise three-section ownership + restored 60-day cycle at 390px: ${probe.url}`);

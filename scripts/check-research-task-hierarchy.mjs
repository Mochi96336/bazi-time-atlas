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

function detailsById(dom, id) {
  const start = dom.indexOf(`id="${id}"`);
  if (start < 0) return "";
  const open = dom.lastIndexOf("<details", start);
  if (open < 0) return "";
  const tag = /<\/?details\b[^>]*>/g;
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
const sexagenaryDetail = detailsById(probe.dom, "discrete-sexagenary-details");
if (!sexagenaryDetail || !sexagenaryDetail.includes('data-research-drilldown="discrete-sexagenary"')) {
  throw new Error(`60-day cycle did not move behind its supporting-evidence disclosure: ${probe.url}`);
}
if (/^<details[^>]*\sopen(?:\s|=|>)/.test(sexagenaryDetail)) {
  throw new Error(`60-day supporting evidence must remain closed by default: ${probe.url}`);
}
if (discrete.includes('class="near-search-panel"') || discrete.includes('id="four-pillar-determinacy"')) {
  throw new Error(`discrete task still owns downstream astronomy/evidence UI: ${probe.url}`);
}
if (!astronomy.includes('class="astronomy-panel"') || !astronomy.includes('id="month-boundary-exposure"') || !astronomy.includes('class="near-search-panel"')) {
  throw new Error(`astronomy task did not retain residual, month-boundary, and near-recurrence evidence: ${probe.url}`);
}
const astronomyDetail = detailsById(probe.dom, "astronomy-residual-detail");
if (!astronomy.includes('data-astronomy-visible-metric="rms"') || !astronomy.includes('id="astronomy-rms-residual"')) {
  throw new Error(`astronomy headline is not owned by the visible RMS rail: ${probe.url}`);
}
if (!astronomyDetail || !astronomyDetail.includes('data-astronomy-detail-metric="max-residual"') || !astronomyDetail.includes('id="astronomy-max-residual"')) {
  throw new Error(`duplicate max residual did not move into the astronomy detail: ${probe.url}`);
}
if (astronomyDetail.includes('id="astronomy-rms-residual"')) {
  throw new Error(`RMS headline was incorrectly hidden inside astronomy detail: ${probe.url}`);
}
if (/^<details[^>]*\sopen(?:\s|=|>)/.test(astronomyDetail)) {
  throw new Error(`astronomy residual detail must remain closed by default: ${probe.url}`);
}
if (!evidence.includes('id="four-pillar-determinacy"') || !evidence.includes('id="day-hour-proof-chain"') || !evidence.includes('id="seasonal-epoch-source-audit"')) {
  throw new Error(`four-pillar evidence task did not retain its proof chain and source audit: ${probe.url}`);
}
if (!evidence.includes('class="model-boundary research-evidence-appendix"')) {
  throw new Error(`model boundary is no longer attached to the evidence task: ${probe.url}`);
}

const proofSupport = detailsById(probe.dom, "proof-chain-support-details");
const epochSupport = detailsById(probe.dom, "epoch-audit-support-details");
if (!proofSupport || !proofSupport.includes('id="day-hour-proof-chain"') || !proofSupport.includes("日／時柱證明")) {
  throw new Error(`Day/Hour proof did not move behind its evidence support disclosure: ${probe.url}`);
}
if (!/^<details[^>]*\sopen(?:\s|=|>)/.test(proofSupport)) {
  throw new Error(`research convention query did not auto-open Day/Hour proof support: ${probe.url}`);
}
if (!epochSupport || !epochSupport.includes('id="seasonal-epoch-source-audit"') || !epochSupport.includes("天文來源能力")) {
  throw new Error(`seasonal source audit did not move behind its evidence support disclosure: ${probe.url}`);
}
if (/^<details[^>]*\sopen(?:\s|=|>)/.test(epochSupport)) {
  throw new Error(`source audit should stay closed unless directly targeted: ${probe.url}`);
}

const defaultEvidenceProbe = dump("recurrence.html?delta=24000");
const defaultEvidence = sectionById(defaultEvidenceProbe.dom, "research-evidence");
const defaultProofSupport = detailsById(defaultEvidenceProbe.dom, "proof-chain-support-details");
const defaultEpochSupport = detailsById(defaultEvidenceProbe.dom, "epoch-audit-support-details");
if (!defaultProofSupport || !defaultEpochSupport) {
  throw new Error(`default Research evidence disclosures were not rendered: ${defaultEvidenceProbe.url}`);
}
if (/^<details[^>]*\sopen(?:\s|=|>)/.test(defaultProofSupport) || /^<details[^>]*\sopen(?:\s|=|>)/.test(defaultEpochSupport)) {
  throw new Error(`supporting evidence must remain closed by default: ${defaultEvidenceProbe.url}`);
}
const determinacyIndex = defaultEvidence.indexOf('id="four-pillar-determinacy"');
const proofSupportIndex = defaultEvidence.indexOf('id="proof-chain-support-details"');
const epochSupportIndex = defaultEvidence.indexOf('id="epoch-audit-support-details"');
if (!(determinacyIndex >= 0 && proofSupportIndex > determinacyIndex && epochSupportIndex > proofSupportIndex)) {
  throw new Error(`evidence outcome/support ordering regressed: ${defaultEvidenceProbe.url}`);
}
if (probe.dom.includes('class="research-task-nav"') || /先回答：|再問：|最後才問：|Why 24,000\?|Exact ≠ astronomical/.test(probe.dom)) {
  throw new Error(`retired Research task cards or redundant explainer copy returned: ${probe.url}`);
}
for (const expected of [
  "時間位移",
  "公曆骨架",
  "干支年序",
  "干支日序",
  "RMS 殘差",
  "目前可支持的最強結論",
  "年柱＋月柱可隔離 · 日柱＋時柱未解"
]) {
  if (!probe.dom.includes(expected)) {
    throw new Error(`localized Research terminology missing "${expected}": ${probe.url}`);
  }
}
for (const stale of [
  "Time displacement",
  "Gregorian frame",
  "Year sequence",
  "Day sequence",
  "RMS residual",
  "Strongest supported claim",
  "Year + Month 可隔離 · Day + Hour 未解",
  "model unavailable"
]) {
  if (probe.dom.includes(stale)) {
    throw new Error(`prototype Research copy returned "${stale}": ${probe.url}`);
  }
}

for (const expected of [
  "目標時刻 / 日界 / 計時基準 / 經度 · 研究約定",
  "固定 UT1 時差",
  "目標地方鐘面",
  "相對 UT1 固定時差",
  "日界規則",
  "地方時計時基準",
  "經度 · 東＋ / 西−",
  "第一個硬阻塞",
  "日柱證明",
  "時柱證明",
  "目標年 / 結論",
  "個來源 · 展開看能力邊界"
]) {
  if (!probe.dom.includes(expected)) {
    throw new Error(`localized Research evidence copy missing "${expected}": ${probe.url}`);
  }
}
for (const stale of [
  "Target / Day boundary / Clock basis / Longitude · research conventions",
  "Target local clock",
  "Fixed offset from UT1",
  "First hard blocker",
  ">Day proof<",
  ">Hour proof<",
  "Target / verdict",
  "sources ·",
  "展開看 coverage"
]) {
  if (probe.dom.includes(stale)) {
    throw new Error(`prototype Research evidence copy returned "${stale}": ${probe.url}`);
  }
}

const cycleDeepLink = dump("recurrence.html#research-sexagenary-cycle");
const cycleDeepLinkDetail = detailsById(cycleDeepLink.dom, "discrete-sexagenary-details");
if (!cycleDeepLinkDetail || !/^<details[^>]*\sopen(?:\s|=|>)/.test(cycleDeepLinkDetail)) {
  throw new Error(`direct 60-day cycle hash did not auto-open supporting evidence: ${cycleDeepLink.url}`);
}
if (!cycleDeepLinkDetail.includes('id="research-sexagenary-cycle"')) {
  throw new Error(`direct 60-day cycle hash lost its original section owner: ${cycleDeepLink.url}`);
}

const proofDeepLink = dump("recurrence.html?delta=24000#day-hour-proof-chain");
const proofDeepLinkDetail = detailsById(proofDeepLink.dom, "proof-chain-support-details");
if (!proofDeepLinkDetail || !/^<details[^>]*\sopen(?:\s|=|>)/.test(proofDeepLinkDetail) || !proofDeepLinkDetail.includes('id="day-hour-proof-chain"')) {
  throw new Error(`direct Day/Hour proof hash did not auto-open supporting evidence: ${proofDeepLink.url}`);
}

const sourceDeepLink = dump("recurrence.html?delta=24000#seasonal-epoch-source-audit");
const sourceDeepLinkDetail = detailsById(sourceDeepLink.dom, "epoch-audit-support-details");
if (!sourceDeepLinkDetail || !/^<details[^>]*\sopen(?:\s|=|>)/.test(sourceDeepLinkDetail) || !sourceDeepLinkDetail.includes('id="seasonal-epoch-source-audit"')) {
  throw new Error(`direct source-audit hash did not auto-open supporting evidence: ${sourceDeepLink.url}`);
}

console.log(`[research-hierarchy] PASS outcome-first three-section ownership + closed supporting evidence + query/hash reveal + RMS astronomy headline at 390px: ${probe.url}`);

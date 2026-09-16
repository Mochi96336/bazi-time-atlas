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

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function requireEqual(actual, expected, message, url) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}: ${url}`);
}

function dumpDom(path, virtualTimeBudget = 8000) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    `--virtual-time-budget=${virtualTimeBudget}`,
    "--window-size=1260,980",
    "--dump-dom",
    url
  ], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Ganzhi inspector probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

const fixture = dumpDom("scripts/fixtures/ganzhi-inspector-contract.html");
const probe = tagById(fixture.dom, "probe");
if (!probe || attr(probe, "data-ready") !== "true") {
  throw new Error(`Ganzhi inspector fixture did not settle: ${fixture.url}`);
}

requireEqual(attr(probe, "data-closed-cell-count"), "5", "closed Atlas summary no longer has exactly five comparable cells", fixture.url);
requireEqual(attr(probe, "data-closed-cell-height-aligned"), "true", "pillar reference buttons changed the closed state-strip row height", fixture.url);
requireEqual(attr(probe, "data-closed-cell-top-aligned"), "true", "pillar reference buttons no longer share the Solar cell baseline", fixture.url);
requireEqual(attr(probe, "data-open-visible"), "true", "pillar click did not open inspector", fixture.url);
requireEqual(attr(probe, "data-open-position"), "fixed", "inspector must not participate in Atlas document flow", fixture.url);
requireEqual(attr(probe, "data-strip-top-stable"), "true", "opening inspector shifted state strip top", fixture.url);
requireEqual(attr(probe, "data-strip-height-stable"), "true", "opening inspector changed state strip height", fixture.url);
requireEqual(attr(probe, "data-selected-stable"), "true", "opening inspector mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-url-inspect"), "year", "year inspector state was not persisted in URL", fixture.url);
requireEqual(attr(probe, "data-url-instant"), "2026-09-13T23:43:42.000Z", "inspector rewrote the Selected Instant deep link", fixture.url);
requireEqual(attr(probe, "data-inspector-pillar"), "year", "year inspector selected wrong pillar", fixture.url);
requireEqual(attr(probe, "data-inspector-ganzhi"), attr(probe, "data-state-year"), "year inspector drifted from Atlas pillar identity", fixture.url);
requireEqual(attr(probe, "data-inspector-ready"), "true", "year inspector failed to resolve sexagenary reference", fixture.url);
requireEqual(attr(probe, "data-grid-count"), "60", "full sexagenary disclosure must retain all 60 entries", fixture.url);
requireEqual(attr(probe, "data-grid-button-count"), "0", "full sexagenary disclosure must stay reference-only, not create an independent selection state", fixture.url);
requireEqual(attr(probe, "data-month-pillar"), "month", "switching pillar reference failed", fixture.url);
requireEqual(attr(probe, "data-month-ganzhi"), attr(probe, "data-state-month"), "month inspector drifted from Atlas pillar identity", fixture.url);
requireEqual(attr(probe, "data-selected-after-switch"), "true", "switching inspector pillar mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-closed-hidden"), "true", "close control did not hide inspector", fixture.url);
requireEqual(attr(probe, "data-closed-inspect-missing"), "true", "close control did not clear only the inspector URL state", fixture.url);
requireEqual(attr(probe, "data-selected-after-close"), "true", "closing inspector mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-deep-visible"), "true", "?inspect=day did not reproduce the open inspector", fixture.url);
requireEqual(attr(probe, "data-deep-pillar"), "day", "?inspect=day opened the wrong pillar", fixture.url);
requireEqual(attr(probe, "data-deep-ganzhi"), attr(probe, "data-deep-state-day"), "deep-linked inspector drifted from current Day pillar", fixture.url);
requireEqual(attr(probe, "data-deep-ready"), "true", "deep-linked inspector failed to resolve sexagenary reference", fixture.url);

const instant = "2026-09-13T23:43:42.000Z";
const standalone = dumpDom(`?instant=${encodeURIComponent(instant)}&reference=${encodeURIComponent("乙酉")}`, 3000);
const standaloneInspector = tagById(standalone.dom, "ganzhi-inspector");
const standaloneInstrument = tagById(standalone.dom, "kinetic-instrument");
requireEqual(attr(standaloneInspector, "data-open"), "true", "standalone reference deep link did not open inspector", standalone.url);
requireEqual(attr(standaloneInspector, "data-mode"), "reference", "standalone target was mistaken for a pillar inspector", standalone.url);
requireEqual(attr(standaloneInspector, "data-pillar"), "", "standalone reference incorrectly claimed a current pillar", standalone.url);
requireEqual(attr(standaloneInspector, "data-ganzhi"), "乙酉", "standalone reference resolved wrong Ganzhi", standalone.url);
requireEqual(attr(standaloneInspector, "data-ready"), "true", "standalone reference failed to resolve", standalone.url);
requireEqual(attr(standaloneInstrument, "data-selected-instant-ms"), String(Date.parse(instant)), "standalone reference mutated Selected Instant", standalone.url);
if (!/id="ganzhi-inspector-title"[^>]*>乙酉<\/strong>/.test(standalone.dom)) {
  throw new Error(`standalone reference title did not render 乙酉: ${standalone.url}`);
}
if (!/id="ganzhi-inspector-ordinal"[^>]*>22 \/ 60<\/b>/.test(standalone.dom)) {
  throw new Error(`standalone reference ordinal did not render 22 / 60: ${standalone.url}`);
}

console.log(`[ganzhi-inspector] PASS contextual pillar + standalone reference targets without Selected-Instant mutation: ${fixture.url}`);

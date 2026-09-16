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

const url = new URL("scripts/fixtures/ganzhi-inspector-contract.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=8000",
  "--window-size=1260,980",
  "--dump-dom",
  url
], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Ganzhi inspector probe failed: ${url}`);
}

const probe = tagById(result.stdout, "probe");
if (!probe || attr(probe, "data-ready") !== "true") {
  throw new Error(`Ganzhi inspector fixture did not settle: ${url}`);
}

requireEqual(attr(probe, "data-closed-cell-count"), "5", "closed Atlas summary no longer has exactly five comparable cells", url);
requireEqual(attr(probe, "data-closed-cell-height-aligned"), "true", "pillar reference buttons changed the closed state-strip row height", url);
requireEqual(attr(probe, "data-closed-cell-top-aligned"), "true", "pillar reference buttons no longer share the Solar cell baseline", url);
requireEqual(attr(probe, "data-open-visible"), "true", "pillar click did not open inspector", url);
requireEqual(attr(probe, "data-open-position"), "fixed", "inspector must not participate in Atlas document flow", url);
requireEqual(attr(probe, "data-strip-top-stable"), "true", "opening inspector shifted state strip top", url);
requireEqual(attr(probe, "data-strip-height-stable"), "true", "opening inspector changed state strip height", url);
requireEqual(attr(probe, "data-selected-stable"), "true", "opening inspector mutated Selected Instant", url);
requireEqual(attr(probe, "data-url-inspect"), "year", "year inspector state was not persisted in URL", url);
requireEqual(attr(probe, "data-url-instant"), "2026-09-13T23:43:42.000Z", "inspector rewrote the Selected Instant deep link", url);
requireEqual(attr(probe, "data-inspector-pillar"), "year", "year inspector selected wrong pillar", url);
requireEqual(attr(probe, "data-inspector-ganzhi"), attr(probe, "data-state-year"), "year inspector drifted from Atlas pillar identity", url);
requireEqual(attr(probe, "data-inspector-ready"), "true", "year inspector failed to resolve sexagenary reference", url);
requireEqual(attr(probe, "data-grid-count"), "60", "full sexagenary disclosure must retain all 60 entries", url);
requireEqual(attr(probe, "data-grid-button-count"), "0", "full sexagenary disclosure must stay reference-only, not create an independent selection state", url);
requireEqual(attr(probe, "data-month-pillar"), "month", "switching pillar reference failed", url);
requireEqual(attr(probe, "data-month-ganzhi"), attr(probe, "data-state-month"), "month inspector drifted from Atlas pillar identity", url);
requireEqual(attr(probe, "data-selected-after-switch"), "true", "switching inspector pillar mutated Selected Instant", url);
requireEqual(attr(probe, "data-closed-hidden"), "true", "close control did not hide inspector", url);
requireEqual(attr(probe, "data-closed-inspect-missing"), "true", "close control did not clear only the inspector URL state", url);
requireEqual(attr(probe, "data-selected-after-close"), "true", "closing inspector mutated Selected Instant", url);
requireEqual(attr(probe, "data-deep-visible"), "true", "?inspect=day did not reproduce the open inspector", url);
requireEqual(attr(probe, "data-deep-pillar"), "day", "?inspect=day opened the wrong pillar", url);
requireEqual(attr(probe, "data-deep-ganzhi"), attr(probe, "data-deep-state-day"), "deep-linked inspector drifted from current Day pillar", url);
requireEqual(attr(probe, "data-deep-ready"), "true", "deep-linked inspector failed to resolve sexagenary reference", url);

console.log(`[ganzhi-inspector] PASS contextual pillar reference + closed-layout parity without Selected-Instant mutation: ${url}`);
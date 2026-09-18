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

const url = new URL("scripts/fixtures/time-context-control-contract.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw", "--virtual-time-budget=3500", "--window-size=1200,900", "--dump-dom", url
], { encoding:"utf8", maxBuffer:16 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium DOM probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
if (attr(probe, "data-ready") !== "true") throw new Error(`time-context fixture did not settle: ${url}`);

const expectedMs = String(Date.parse("2026-09-15T20:14:37.000Z"));
if (attr(probe, "data-trigger-text-default") !== "UTC+08:00") {
  throw new Error(`default time-basis trigger gained visible copy: ${url}`);
}
if (attr(probe, "data-panel-hidden-default") !== "true" || attr(probe, "data-panel-hidden-open") !== "false") {
  throw new Error(`time-context popover hidden/open contract failed: ${url}`);
}
const layoutDelta = Number(attr(probe, "data-timeline-delta-open"));
if (!Number.isFinite(layoutDelta) || layoutDelta > 0.5) {
  throw new Error(`opening time-context popover changed document flow (delta=${layoutDelta}): ${url}`);
}
if (attr(probe, "data-selected-before") !== expectedMs || attr(probe, "data-default-url-has-context") !== "false") {
  throw new Error(`default temporal context is not minimal or Selected Instant is wrong: ${url}`);
}

if (attr(probe, "data-selected-custom") !== expectedMs) {
  throw new Error(`changing temporal context mutated physical Selected Instant: ${url}`);
}
if (attr(probe, "data-utc-custom") !== "9" || attr(probe, "data-boundary-custom") !== "civil-midnight") {
  throw new Error(`custom temporal context did not reach kinetic state owner: ${url}`);
}
if (attr(probe, "data-source-custom") !== "time-context-popover") {
  throw new Error(`popover bypassed temporal-context command owner: ${url}`);
}
if (attr(probe, "data-trigger-text-custom") !== "UTC+09:00 · 00:00") {
  throw new Error(`non-default context is not compactly exposed in existing readout: ${url}`);
}
const customReadout = attr(probe, "data-readout-custom") ?? "";
if (!customReadout.includes("05:14:37") || !customReadout.includes("UTC+09:00")) {
  throw new Error(`Selected Instant did not re-render in UTC+09 without moving physically: ${url}`);
}
if (
  attr(probe, "data-url-utc-custom") !== "9"
  || attr(probe, "data-url-boundary-custom") !== "civil-midnight"
  || attr(probe, "data-url-instant-custom") !== "2026-09-15T20:14:37.000Z"
  || attr(probe, "data-url-keep-custom") !== "1"
  || attr(probe, "data-url-hash-custom") !== "#analysis"
) {
  throw new Error(`custom context URL persistence discarded existing state: ${url}`);
}
if (attr(probe, "data-panel-hidden-after-apply") !== "true" || attr(probe, "data-document-continuity") !== "true") {
  throw new Error(`context apply rebuilt the document or left the popover open: ${url}`);
}
if (
  attr(probe, "data-hour-phase-start-custom") !== String(Date.parse("2026-09-15T20:00:00.000Z"))
  || attr(probe, "data-hour-phase-end-custom") !== String(Date.parse("2026-09-15T22:00:00.000Z"))
  || attr(probe, "data-day-phase-source-custom") !== "civil-midnight"
) {
  throw new Error(`custom temporal context did not propagate into discrete phase ownership: ${url}`);
}

if (attr(probe, "data-selected-reset") !== expectedMs || attr(probe, "data-trigger-text-reset") !== "UTC+08:00") {
  throw new Error(`resetting context changed Selected Instant or default readout: ${url}`);
}
if (attr(probe, "data-reset-has-utc") !== "false" || attr(probe, "data-reset-has-boundary") !== "false") {
  throw new Error(`default context did not clear custom URL keys: ${url}`);
}
if (
  attr(probe, "data-reset-instant") !== "2026-09-15T20:14:37.000Z"
  || attr(probe, "data-reset-keep") !== "1"
  || attr(probe, "data-reset-hash") !== "#analysis"
) {
  throw new Error(`context reset discarded unrelated URL state: ${url}`);
}
if (
  attr(probe, "data-hour-phase-start-reset") !== String(Date.parse("2026-09-15T19:00:00.000Z"))
  || attr(probe, "data-hour-phase-end-reset") !== String(Date.parse("2026-09-15T21:00:00.000Z"))
  || attr(probe, "data-day-phase-source-reset") !== "zi-initial"
) {
  throw new Error(`reset temporal context did not refresh discrete phase ownership: ${url}`);
}

console.log(`[time-context] PASS overlay control preserves physical instant + discrete phase context: ${url}`);

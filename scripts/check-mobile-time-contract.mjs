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

const url = new URL("scripts/fixtures/mobile-time-contract.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw", "--virtual-time-budget=4000", "--window-size=1600,1000", "--dump-dom", url
], { encoding:"utf8", maxBuffer:16 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium DOM probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
if (attr(probe, "data-ready") !== "true") throw new Error(`exact-time fixture did not settle: ${url}`);
if (attr(probe, "data-inner-width") !== "390") throw new Error(`fixture did not produce a 390px mobile child viewport: ${url}`);
if (attr(probe, "data-dock-display") !== "grid") throw new Error(`mobile exact-time dock is not visible: ${url}`);
if (attr(probe, "data-input-step") !== "1") throw new Error(`mobile exact-time input lost second precision: ${url}`);
if (attr(probe, "data-input-value") !== "2026-09-16T04:14:37") throw new Error(`mobile input is not synchronized to Selected Instant: ${url}`);
if (!["auto", "scroll"].includes(attr(probe, "data-shell-overflow-y"))) throw new Error(`mobile shell is not vertically scrollable: ${url}`);
if (attr(probe, "data-shell-scrollable") !== "true") throw new Error(`mobile shell has no reachable content below the disk: ${url}`);
if (attr(probe, "data-dock-after-instrument") !== "true") throw new Error(`exact-time dock does not follow the instrument in reading order: ${url}`);
if (attr(probe, "data-apply-visible") !== "true") throw new Error(`exact-time apply action is not visible: ${url}`);
const share = Number(attr(probe, "data-instrument-share"));
if (!Number.isFinite(share) || share < 0.70) throw new Error(`instrument no longer owns the first mobile viewport (share=${share}): ${url}`);

if (attr(probe, "data-mobile-roundtrip-value") !== "2026-09-16T04:15:09") {
  throw new Error(`mobile exact-time edit did not stay synchronized after apply: ${url}`);
}
const expectedMobileMs = Date.parse("2026-09-15T20:15:09.000Z");
if (attr(probe, "data-mobile-selected-instant-ms") !== String(expectedMobileMs)) {
  throw new Error(`mobile exact-time command did not update the physical Selected Instant: ${url}`);
}
if (attr(probe, "data-mobile-source") !== "mobile-exact") {
  throw new Error(`mobile exact-time update bypassed the selected-instant command owner: ${url}`);
}
if (attr(probe, "data-mobile-url-instant") !== "2026-09-15T20:15:09.000Z") {
  throw new Error(`mobile exact-time apply did not persist the exact instant into the URL: ${url}`);
}
if (attr(probe, "data-mobile-document-continuity") !== "true") {
  throw new Error(`mobile exact-time apply rebuilt the document instead of updating in place: ${url}`);
}
if (attr(probe, "data-mobile-load-count") !== "1") {
  throw new Error(`mobile exact-time apply caused an unexpected frame reload: ${url}`);
}
if (attr(probe, "data-mobile-status-state") !== "success" || attr(probe, "data-mobile-status-text") !== "已套用 · UTC+08:00") {
  throw new Error(`mobile exact-time apply did not settle into a success state: ${url}`);
}

if (attr(probe, "data-desktop-inner-width") !== "1200") throw new Error(`fixture did not produce a 1200px desktop child viewport: ${url}`);
if (attr(probe, "data-desktop-initial-step") !== "1") throw new Error(`desktop exact-time input is not second-level in markup: ${url}`);
if (attr(probe, "data-desktop-initial-precision") !== "second") throw new Error(`desktop exact-time precision diagnostic missing: ${url}`);
if (attr(probe, "data-desktop-initial-value") !== "2026-09-16T04:14:37") throw new Error(`desktop input truncated Selected Instant seconds on initial sync: ${url}`);
if (attr(probe, "data-desktop-initial-valid") !== "true") throw new Error(`desktop second-level Selected Instant is invalid under its input step: ${url}`);
if (attr(probe, "data-desktop-roundtrip-value") !== "2026-09-16T04:14:52") throw new Error(`desktop exact-time edit did not preserve typed seconds: ${url}`);
if (attr(probe, "data-desktop-roundtrip-valid") !== "true") throw new Error(`desktop second-level edit became invalid: ${url}`);
const expectedDesktopMs = Date.parse("2026-09-15T20:14:52.000Z");
if (attr(probe, "data-desktop-selected-instant-ms") !== String(expectedDesktopMs)) {
  throw new Error(`desktop second-level round trip did not update the physical Selected Instant: ${url}`);
}
if (attr(probe, "data-desktop-source") !== "desktop-input") {
  throw new Error(`desktop exact-time edit bypassed the selected-instant state owner: ${url}`);
}

console.log(`[exact-time] PASS in-place mobile command + desktop second-level round trip; mobile share=${share.toFixed(3)}: ${url}`);

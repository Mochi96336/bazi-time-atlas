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
  "--run-all-compositor-stages-before-draw", "--virtual-time-budget=3000", "--window-size=500,844", "--dump-dom", url
], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium DOM probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
if (attr(probe, "data-ready") !== "true") throw new Error(`mobile precise-time fixture did not settle: ${url}`);
if (attr(probe, "data-inner-width") !== "390") throw new Error(`fixture did not produce a 390px child viewport: ${url}`);
if (attr(probe, "data-dock-display") !== "grid") throw new Error(`mobile exact-time dock is not visible: ${url}`);
if (attr(probe, "data-input-step") !== "1") throw new Error(`mobile exact-time input lost second precision: ${url}`);
if (attr(probe, "data-input-value") !== "2026-09-16T04:14:37") throw new Error(`mobile input is not synchronized to Selected Instant: ${url}`);
if (!["auto", "scroll"].includes(attr(probe, "data-shell-overflow-y"))) throw new Error(`mobile shell is not vertically scrollable: ${url}`);
if (attr(probe, "data-shell-scrollable") !== "true") throw new Error(`mobile shell has no reachable content below the disk: ${url}`);
if (attr(probe, "data-dock-after-instrument") !== "true") throw new Error(`exact-time dock does not follow the instrument in reading order: ${url}`);
if (attr(probe, "data-apply-visible") !== "true") throw new Error(`exact-time apply action is not visible: ${url}`);
const share = Number(attr(probe, "data-instrument-share"));
if (!Number.isFinite(share) || share < 0.70) throw new Error(`instrument no longer owns the first mobile viewport (share=${share}): ${url}`);

console.log(`[mobile-time] PASS second-level exact entry below instrument; share=${share.toFixed(3)}: ${url}`);

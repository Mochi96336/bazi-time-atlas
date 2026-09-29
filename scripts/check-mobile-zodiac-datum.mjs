import { spawnSync } from "node:child_process";
import { MATERIAL_FIXED_INSTANT } from "./material-visual-contract.mjs";

// Preserve the 390px proof entrypoint, but validate the canonical wheel
// identity and the single-row mobile controller instead of a duplicate caption.
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
function browserPath() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No Chromium for 390px mobile rail proof");
}
const fixture = "scripts/fixtures/mobile-390.html?" + new URLSearchParams({
  target:"../../?material=roughness&instant=" + MATERIAL_FIXED_INSTANT,
  height:"844", exerciseZodiac:"1"
}).toString();
const url = new URL(fixture, baseURL).href;
const r = spawnSync(browserPath(), [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader-webgl", "--virtual-time-budget=4000",
  "--window-size=500,844", "--dump-dom", url
], { encoding:"utf8", timeout:65_000, killSignal:"SIGKILL" });
if (r.status !== 0) {
  process.stderr.write(r.stderr ?? "");
  throw new Error("390px mobile one-row browser failed");
}
const attr = name => r.stdout.match(new RegExp("data-" + name + '="([^"]*)"'))?.[1] ?? "";
const required = [
  "wheel-zodiac-identity", "single-row-initial", "dirty-swaps-action",
  "restore-one-row", "classification-one-row", "analysis-one-row"
];
if (attr("ready") !== "true" || attr("inner-width") !== "390" ||
    attr("media-matched") !== "true") {
  throw new Error("Mobile rail fixture did not render at genuine 390px width");
}
const missing = required.filter(name => attr(name) !== "true");
if (missing.length) throw new Error("Mobile single-row state failed: " + missing.join(", "));
console.log("[mobile-rail] 390px wheel Zodiac authority + one-row idle/dirty/classification/Analysis passed");

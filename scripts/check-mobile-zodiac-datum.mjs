import { spawnSync } from "node:child_process";
import { MATERIAL_FIXED_INSTANT } from "./material-visual-contract.mjs";

// Exercise the real child iframe at 390 CSS px, not Chromium's 500px minimum outer window.
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
function browserPath() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No Chromium found for 390px mobile Zodiac runtime proof");
}
const requestedTarget = "../../?material=roughness&instant=" + MATERIAL_FIXED_INSTANT;
const fixture = "scripts/fixtures/mobile-390.html?" + new URLSearchParams({
  target:requestedTarget, height:"844", exerciseZodiac:"1"
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
  throw new Error("390px mobile Zodiac runtime browser failed");
}
function attr(name) {
  return r.stdout.match(new RegExp("data-" + name + '="([^"]*)"'))?.[1] ?? "";
}
const required = [
  "zodiac-initial-matches", "zodiac-initial-visible", "zodiac-dirty-hidden",
  "zodiac-apply-restored", "zodiac-classification-hidden", "zodiac-analysis-hidden"
];
if (attr("ready") !== "true" || attr("inner-width") !== "390"
  || attr("media-matched") !== "true") {
  throw new Error("Mobile Zodiac fixture did not render at genuine 390px width");
}
const missing = required.filter(name => attr(name) !== "true");
if (missing.length) throw new Error("Mobile Zodiac runtime state failed: " + missing.join(", "));
if (Math.abs(Number.parseFloat(attr("zodiac-font-size")) - 12) > 0.25) {
  throw new Error("Mobile Zodiac caption lost its 12px screen-space text sizing");
}
console.log("[mobile-zodiac] 390px selected-label, dirty, apply, Classification and Analysis contracts passed");

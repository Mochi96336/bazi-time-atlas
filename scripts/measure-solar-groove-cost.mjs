import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { MATERIAL_FIXED_INSTANT } from "./material-visual-contract.mjs";

// Relative same-context costs ONLY; headless SwiftShader numbers are not
// real-device FPS and must not automatically authorize a visual PR merge.
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const browser = (() => {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const c of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const r = spawnSync("sh", ["-lc", "command -v " + c], { encoding:"utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error("no Chromium browser available");
})();
const url = new URL("?material=roughness&materialProbe=none&materialPerf=1&instant="
  + MATERIAL_FIXED_INSTANT, baseURL).href;
const r = spawnSync(browser, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader-webgl", "--virtual-time-budget=4000",
  "--window-size=1440,900", "--dump-dom", url
], { encoding:"utf8", timeout:90_000, killSignal:"SIGKILL" });
if (r.status !== 0) {
  process.stderr.write(r.stderr ?? "");
  throw new Error("diagnostic Chromium failed to launch");
}
if (!r.stdout.includes('data-material-prototype="roughness"')
  || !r.stdout.includes('data-material-probe="none"')) {
  throw new Error("Solar diagnostic did not activate expected roughness baseline");
}
const match = r.stdout.match(/data-material-bench="([^"]+)"/);
if (!match) throw new Error("same-context draw-cost evidence missing");
const values = Object.fromEntries(match[1].split(";").map(v => v.split("=")));
for (const k of ["offMs", "onMs", "ratio", "samples", "width", "height"]) {
  if (!Number.isFinite(Number(values[k]))) throw new Error("invalid benchmark field: " + k);
}
if (Number(values.samples) !== 10 || Number(values.width) < 1 || Number(values.height) < 1) {
  throw new Error("unexpected benchmark sample count or canvas dimensions");
}
const results = {
  kind: "h21-solar-groove-relative-draw-cost",
  instantUtc: decodeURIComponent(MATERIAL_FIXED_INSTANT),
  viewportRequested: "1440x900",
  sameGlContext: true,
  roughnessWithScratchLightingMedianMs: Number(values.onMs),
  roughnessWithoutScratchLightingMedianMs: Number(values.offMs),
  withVsWithoutRatio: Number(values.ratio),
  pairs: Number(values.samples),
  canvasPx: [Number(values.width), Number(values.height)],
  method: "Alternating order; four warmup pairs plus ten alternating timed pairs; performance.now around draw+gl.finish in one explicitly requested WebGL2 context.",
  limitations: [
    "This measures GPU-inclusive wall time plus CPU command submission and forced finish overhead, not isolated GPU shader time.",
    "CI SwiftShader is software rendering, not user-device GPU performance; ratio can vary with runner load.",
    "Changes to material realism are NOT inferred from a lower/higher render cost or PNG pixel difference.",
    "Browser process launch, font load and page navigation are outside the timed section."
  ]
};
await mkdir(path.resolve("tmp/visual-check"), { recursive: true });
await writeFile(path.resolve("tmp/visual-check/solar-groove-draw-cost.json"),
  JSON.stringify(results, null, 2) + "\n", "utf8");
console.log("[solar-groove-cost] " + JSON.stringify(results));

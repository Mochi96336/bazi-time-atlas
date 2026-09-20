import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const fixtureURL = new URL("scripts/fixtures/tools-human-ux.html?scenario=editor-visual", baseURL).href;
const outputPath = path.join(outputDir, "annual-tools-selected-instant-editor-1440x900.png");

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

const browser = findBrowser();
await mkdir(outputDir, { recursive:true });
const result = spawnSync(browser, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=4200",
  "--window-size=1440,900",
  `--screenshot=${outputPath}`,
  fixtureURL
], { encoding:"utf8", timeout:45_000, killSignal:"SIGKILL" });

if (result.status !== 0) {
  process.stderr.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Selected Instant editor screenshot failed: ${fixtureURL}`);
}
const info = await stat(outputPath);
if (info.size < 20_000) throw new Error(`Selected Instant editor screenshot is unexpectedly small (${info.size} bytes)`);
console.log(`[visual] annual-tools-selected-instant-editor-1440x900.png: ${info.size} bytes`);

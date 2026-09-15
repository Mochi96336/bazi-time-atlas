import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");

const scales = [
  { key:"48h", value:"day" },
  { key:"year", value:"year" },
  { key:"60y", value:"cycle" },
];
const viewports = [
  { key:"1440x900", width:1440, height:900 },
  { key:"390x844", width:390, height:844 },
];

const captures = scales.flatMap(scale => viewports.map(viewport => ({
  name:`annual-scale-${scale.key}-${viewport.key}.png`,
  target:`scripts/fixtures/scale-window.html?scale=${scale.value}`,
  scale:scale.value,
  ...viewport,
})));

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function mobileHarnessPath(target, height) {
  const params = new URLSearchParams({ target:`../../${target}`, height:String(height) });
  return `scripts/fixtures/mobile-390.html?${params.toString()}`;
}

await mkdir(outputDir, { recursive:true });
const browser = findBrowser();

for (const capture of captures) {
  const outputPath = path.join(outputDir, capture.name);
  const mobileLayout = capture.width === 390;
  const requestedPath = mobileLayout
    ? mobileHarnessPath(capture.target, capture.height)
    : capture.target;
  const browserWidth = mobileLayout ? 500 : capture.width;
  const url = new URL(requestedPath, baseURL).href;
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2600",
    "--force-device-scale-factor=1",
    `--window-size=${browserWidth},${capture.height}`,
    `--screenshot=${outputPath}`,
    url,
  ];

  const result = spawnSync(browser, args, {
    encoding:"utf8",
    stdio:["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Scale-window screenshot failed for ${capture.name}`);
  }

  const info = await stat(outputPath);
  if (info.size < 10_000) {
    throw new Error(`${capture.name} is unexpectedly small (${info.size} bytes)`);
  }
  console.log(`[visual-scale] ${capture.name}: ${info.size} bytes · scale=${capture.scale}${mobileLayout ? " · true 390px iframe" : ""}`);
}

import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");

const captures = [
  {
    name:"recurrence-epoch-audit-1440x2850.png",
    path:"recurrence.html?date=2026-09-13&delta=24000",
    width:1440,
    height:2850
  },
  {
    name:"recurrence-epoch-audit-390x4700.png",
    path:"recurrence.html?date=2026-09-13&delta=24000",
    width:390,
    height:4700
  }
];

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

await mkdir(outputDir, { recursive:true });
const browser = findBrowser();

for (const capture of captures) {
  const outputPath = path.join(outputDir, capture.name);
  const url = new URL(capture.path, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2600",
    "--force-device-scale-factor=1",
    `--window-size=${capture.width},${capture.height}`,
    `--screenshot=${outputPath}`,
    url
  ], { encoding:"utf8", stdio:["ignore", "pipe", "pipe"] });

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Epoch-audit screenshot failed for ${capture.name}`);
  }
  const info = await stat(outputPath);
  if (info.size < 10_000) throw new Error(`${capture.name} is unexpectedly small (${info.size} bytes)`);
  console.log(`[visual-epoch-audit] ${capture.name}: ${info.size} bytes`);
}

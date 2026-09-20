import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const width = 2047;
const height = 1038;
const captures = [
  {
    name: "annual-wide-2047x1038.png",
    path: "?instant=2026-09-13T23%3A43%3A42.000Z",
  },
  {
    name: "annual-tools-wide-2047x1038.png",
    path: "?analysis=1&instant=2026-09-13T23%3A43%3A42.000Z",
  },
  {
    name: "annual-tools-inspector-wide-2047x1038.png",
    path: "?analysis=1&inspect=year&instant=2026-09-13T23%3A43%3A42.000Z",
  },
  {
    name: "annual-tools-classification-wide-2047x1038.png",
    path: "?analysis=1&classification=1&instant=2026-09-13T23%3A43%3A42.000Z",
  },
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
const evidence = [];

for (const capture of captures) {
  const url = new URL(capture.path, baseURL).href;
  const outputPath = path.join(outputDir, capture.name);
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2400",
    `--window-size=${width},${height}`,
    `--screenshot=${outputPath}`,
    url,
  ], { encoding:"utf8", timeout:45_000, killSignal:"SIGKILL" });

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Wide screenshot failed for ${capture.name}`);
  }

  const info = await stat(outputPath);
  if (info.size < 20_000) throw new Error(`${capture.name} is unexpectedly small (${info.size} bytes)`);
  evidence.push({ file:capture.name, url, layoutViewport:`${width}x${height}`, bytes:info.size });
  console.log(`[visual-wide] ${capture.name}: ${info.size} bytes`);
}

await writeFile(
  path.join(outputDir, "wide-desktop-evidence.json"),
  `${JSON.stringify({ browser, baseURL, captures:evidence }, null, 2)}\n`,
  "utf8",
);

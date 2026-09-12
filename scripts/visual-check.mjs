import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");

const captures = [
  { name: "surface-1440x900.png", width: 1440, height: 900 },
  { name: "surface-390x844.png", width: 390, height: 844 },
];

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], {
      encoding: "utf8",
    });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

await mkdir(outputDir, { recursive: true });
const browser = findBrowser();
const evidence = [];

for (const capture of captures) {
  const outputPath = path.join(outputDir, capture.name);
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=1200",
    "--force-device-scale-factor=1",
    `--window-size=${capture.width},${capture.height}`,
    `--screenshot=${outputPath}`,
    baseURL,
  ];

  const result = spawnSync(browser, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Screenshot capture failed for ${capture.name}`);
  }

  const info = await stat(outputPath);
  if (info.size < 10_000) {
    throw new Error(`${capture.name} is unexpectedly small (${info.size} bytes)`);
  }

  evidence.push({
    file: capture.name,
    viewport: `${capture.width}x${capture.height}`,
    bytes: info.size,
  });
  console.log(`[visual] ${capture.name}: ${info.size} bytes`);
}

await writeFile(
  path.join(outputDir, "evidence.json"),
  `${JSON.stringify({ browser, baseURL, captures: evidence }, null, 2)}\n`,
  "utf8",
);

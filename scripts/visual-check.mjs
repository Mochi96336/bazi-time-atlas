import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");

const pages = [
  { key: "annual", path: "" },
  { key: "annual-birth", path: "?lambda=271.25&yearStem=%E4%B9%99&hidden=1" },
  { key: "birth", path: "birth.html" },
  { key: "sexagenary", path: "sexagenary.html" },
];

const viewports = [
  { key: "1440x900", width: 1440, height: 900 },
  { key: "390x844", width: 390, height: 844 },
];

const captures = pages.flatMap(page =>
  viewports.map(viewport => ({
    name: `${page.key}-${viewport.key}.png`,
    page: page.key,
    path: page.path,
    ...viewport,
  }))
);

// Review-only frames preserve the ordinary first-viewport regressions while
// focusing expanded detail layers that normally sit below the fold.
captures.push(
  {
    name: "annual-hidden-inspector-390x1320.png",
    page: "annual-hidden-inspector",
    path: "?lambda=271.25&yearStem=%E4%B9%99&hidden=1",
    width: 390,
    height: 1320,
  },
  {
    name: "birth-ten-gods-1440x900.png",
    page: "birth-ten-gods",
    path: "birth.html?tenGod=1&reviewFocus=tenGod",
    width: 1440,
    height: 900,
  },
  {
    name: "birth-ten-gods-390x844.png",
    page: "birth-ten-gods",
    path: "birth.html?tenGod=1&reviewFocus=tenGod",
    width: 390,
    height: 844,
  },
);

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
  const url = new URL(capture.path, baseURL).href;
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=1600",
    "--force-device-scale-factor=1",
    `--window-size=${capture.width},${capture.height}`,
    `--screenshot=${outputPath}`,
    url,
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
    page: capture.page,
    url,
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

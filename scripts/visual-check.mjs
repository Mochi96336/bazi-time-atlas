import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");

const pages = [
  { key: "annual", path: "" },
  { key: "annual-birth", path: "?lambda=271.25&yearStem=%E4%B9%99&hidden=1" },
  { key: "recurrence", path: "recurrence.html" },
  { key: "recurrence-local", path: "recurrence.html?date=2026-09-13&delta=1980" },
  { key: "recurrence-global", path: "recurrence.html?date=2026-09-13&delta=24000" },
  { key: "recurrence-near-best", path: "recurrence.html?date=2026-09-13&delta=792000" },
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

// Review-only frames keep the normal first-viewport regression set small while
// giving lower panels enough vertical room to be inspected without scroll automation.
captures.push(
  {
    name: "annual-hidden-inspector-390x1320.png",
    page: "annual-hidden-inspector",
    path: "?lambda=271.25&yearStem=%E4%B9%99&hidden=1",
    width: 390,
    height: 1320,
  },
  {
    name: "recurrence-search-1440x1750.png",
    page: "recurrence-search",
    path: "recurrence.html?date=2026-09-13&delta=24000",
    width: 1440,
    height: 1750,
  },
  {
    name: "recurrence-search-390x2050.png",
    page: "recurrence-search",
    path: "recurrence.html?date=2026-09-13&delta=24000",
    width: 390,
    height: 2050,
  },
  {
    name: "recurrence-near-best-risk-1440x1700.png",
    page: "recurrence-near-best-risk",
    path: "recurrence.html?date=2026-09-13&delta=792000",
    width: 1440,
    height: 1700,
  },
  {
    name: "recurrence-near-best-risk-390x2000.png",
    page: "recurrence-near-best-risk",
    path: "recurrence.html?date=2026-09-13&delta=792000",
    width: 390,
    height: 2000,
  },
  {
    name: "birth-ten-gods-1440x1400.png",
    page: "birth-ten-gods",
    path: "birth.html?tenGod=1",
    width: 1440,
    height: 1400,
  },
  {
    name: "birth-ten-gods-390x2000.png",
    page: "birth-ten-gods",
    path: "birth.html?tenGod=1",
    width: 390,
    height: 2000,
  },
  {
    name: "birth-relations-1440x1600.png",
    page: "birth-relations",
    path: "birth.html?relations=1",
    width: 1440,
    height: 1600,
  },
  {
    name: "birth-relations-390x1700.png",
    page: "birth-relations",
    path: "birth.html?relations=1",
    width: 390,
    height: 1700,
  },
  {
    name: "birth-three-harmony-1440x1750.png",
    page: "birth-three-harmony",
    path: "birth.html?relations=1&date=2016-12-20&time=08%3A00&utc=8",
    width: 1440,
    height: 1750,
  },
  {
    name: "birth-three-meeting-390x1900.png",
    page: "birth-three-meeting",
    path: "birth.html?relations=1&date=2022-03-20&time=08%3A00&utc=8",
    width: 390,
    height: 1900,
  },
  {
    name: "birth-six-harm-390x1850.png",
    page: "birth-six-harm",
    path: "birth.html?relations=1&date=2022-06-20&time=10%3A00&utc=8",
    width: 390,
    height: 1850,
  },
  {
    name: "birth-time-basis-sensitive-390x1280.png",
    page: "birth-time-basis-sensitive",
    path: "birth.html?date=2005-12-23&time=22%3A55&utc=8&lon=121.5",
    width: 390,
    height: 1280,
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

function mobileHarnessPath(capture) {
  const target = capture.path ? `../../${capture.path}` : "../../";
  const params = new URLSearchParams({ target, height:String(capture.height) });
  return `scripts/fixtures/mobile-390.html?${params.toString()}`;
}

await mkdir(outputDir, { recursive: true });
const browser = findBrowser();
const evidence = [];

for (const capture of captures) {
  const outputPath = path.join(outputDir, capture.name);
  const mobileLayout = capture.width === 390;
  const requestedPath = mobileLayout ? mobileHarnessPath(capture) : capture.path;
  const browserWidth = mobileLayout ? 500 : capture.width;
  const url = new URL(requestedPath, baseURL).href;
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2200",
    "--force-device-scale-factor=1",
    `--window-size=${browserWidth},${capture.height}`,
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
    layoutViewport: `${capture.width}x${capture.height}`,
    browserWindow: `${browserWidth}x${capture.height}`,
    trueMobileHarness: mobileLayout,
    bytes: info.size,
  });
  console.log(`[visual] ${capture.name}: ${info.size} bytes${mobileLayout ? " · true 390px iframe" : ""}`);
}

await writeFile(
  path.join(outputDir, "evidence.json"),
  `${JSON.stringify({ browser, baseURL, captures: evidence }, null, 2)}\n`,
  "utf8",
);

import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const fixturePath = "scripts/fixtures/mobile-390-solar-time-panel.html";
const expectedSelectedMs = String(Date.parse("2005-12-23T14:55:00.000Z"));

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function browserArgs(windowWidth, windowHeight) {
  return [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2600",
    "--force-device-scale-factor=1",
    `--window-size=${windowWidth},${windowHeight}`
  ];
}

function reviewURL(width, height) {
  const url = new URL(fixturePath, baseURL);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  return url.href;
}

const browser = findBrowser();

await mkdir(outputDir, { recursive:true });

async function captureReview({ label, width, height, windowWidth, windowHeight, outputName }) {
  const fixtureURL = reviewURL(width, height);
  const commonArgs = browserArgs(windowWidth, windowHeight);
  const outputPath = path.join(outputDir, outputName);
  const probeResult = spawnSync(browser, [...commonArgs, "--dump-dom", fixtureURL], {
    encoding:"utf8",
    maxBuffer:8 * 1024 * 1024
  });
  if (probeResult.status !== 0) {
    process.stderr.write(probeResult.stderr ?? "");
    throw new Error(`solar-time ${label} review fixture failed: ${fixtureURL}`);
  }

  const probe = probeResult.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
  const panelTop = Number(attr(probe, "data-panel-top"));
  const panelBottom = Number(attr(probe, "data-panel-bottom"));
  const panelHeight = Number(attr(probe, "data-panel-height"));
  const panelLeft = Number(attr(probe, "data-panel-left"));
  const panelRight = Number(attr(probe, "data-panel-right"));
  const panelWidth = Number(attr(probe, "data-panel-width"));
  if (
    attr(probe, "data-ready") !== "true"
    || attr(probe, "data-inner-width") !== String(width)
    || attr(probe, "data-inner-height") !== String(height)
    || attr(probe, "data-analysis-open") !== "true"
    || attr(probe, "data-longitude-bound") !== "true"
    || attr(probe, "data-selected-instant-ms") !== expectedSelectedMs
    || !Number.isFinite(panelTop)
    || !Number.isFinite(panelBottom)
    || !Number.isFinite(panelHeight)
    || !Number.isFinite(panelLeft)
    || !Number.isFinite(panelRight)
    || !Number.isFinite(panelWidth)
    || panelHeight <= 0
    || panelWidth <= 0
    || panelTop < -1
    || panelBottom > height + 1
    || panelBottom <= panelTop
    || panelLeft < -1
    || panelRight > width + 1
    || panelRight <= panelLeft
  ) {
    throw new Error(`solar-time ${label} review fixture did not settle with the full rail inside the true ${width}x${height} viewport: ${fixtureURL} · ${probe}`);
  }

  const shot = spawnSync(browser, [...commonArgs, `--screenshot=${outputPath}`, fixtureURL], {
    encoding:"utf8",
    timeout:45_000,
    killSignal:"SIGKILL"
  });
  if (shot.status !== 0) {
    process.stderr.write(shot.stdout ?? "");
    process.stderr.write(shot.stderr ?? "");
    throw new Error(`solar-time ${label} panel screenshot failed: ${fixtureURL}`);
  }
  const info = await stat(outputPath);
  if (info.size < 10_000) {
    throw new Error(`solar-time ${label} panel screenshot is unexpectedly small (${info.size} bytes)`);
  }
  console.log(`[visual] ${outputName}: ${info.size} bytes · true ${width}x${height} panel-scrolled review · rail ${panelLeft.toFixed(1)}..${panelRight.toFixed(1)} × ${panelTop.toFixed(1)}..${panelBottom.toFixed(1)}px`);
}

await captureReview({
  label:"mobile",
  width:390,
  height:844,
  windowWidth:500,
  windowHeight:844,
  outputName:"annual-solar-time-analysis-panel-390x844.png"
});

await captureReview({
  label:"desktop",
  width:1440,
  height:900,
  windowWidth:1440,
  windowHeight:900,
  outputName:"annual-solar-time-analysis-panel-1440x900.png"
});

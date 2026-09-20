import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const fixturePath = "scripts/fixtures/find-time-review.html";

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
    throw new Error(`find-time ${label} review fixture failed: ${fixtureURL}`);
  }

  const probe = probeResult.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
  const top = Number(attr(probe, "data-readout-top"));
  const bottom = Number(attr(probe, "data-readout-bottom"));
  const left = Number(attr(probe, "data-readout-left"));
  const right = Number(attr(probe, "data-readout-right"));
  const readoutInstrumentTop = Number(attr(probe, "data-readout-instrument-top"));
  const queryFont = Number(attr(probe, "data-query-font"));
  const statusFont = Number(attr(probe, "data-status-font"));
  const applyFont = Number(attr(probe, "data-apply-font"));
  if (
    attr(probe, "data-ready") !== "true"
    || attr(probe, "data-inner-width") !== String(width)
    || attr(probe, "data-inner-height") !== String(height)
    || attr(probe, "data-tools-open") !== "true"
    || attr(probe, "data-find-time") !== "active"
    || attr(probe, "data-button-pressed") !== "true"
    || attr(probe, "data-button-text") !== "完成找時間"
    || attr(probe, "data-close-text") !== "完成"
    || attr(probe, "data-readout-hidden") !== "false"
    || attr(probe, "data-form-controls") !== "0"
    || attr(probe, "data-page-form-controls") !== "0"
    || !Number.isFinite(top)
    || !Number.isFinite(bottom)
    || !Number.isFinite(left)
    || !Number.isFinite(right)
    || top < -1
    || bottom > height + 1
    || left < -1
    || right > width + 1
    || bottom <= top
    || right <= left
  ) {
    throw new Error(`find-time ${label} did not settle as a visible wheel-native tool in ${width}x${height}: ${fixtureURL} · ${probe}`);
  }

  if (
    width > 480
    && (
      !Number.isFinite(queryFont)
      || !Number.isFinite(statusFont)
      || !Number.isFinite(applyFont)
      || queryFont < 11
      || statusFont < 10
      || applyFont < 10
    )
  ) {
    throw new Error(
      `find-time ${label} readability fell below the desktop floor ` +
      `(query=${queryFont}, status=${statusFont}, apply=${applyFont}): ${fixtureURL} · ${probe}`
    );
  }

  const taskTopMin = width <= 480 ? 38 : 48;
  const taskTopMax = width <= 480 ? 50 : 66;
  if (
    attr(probe, "data-visible-toolbar-buttons") !== "1"
    || attr(probe, "data-legend-visible") !== "false"
    || attr(probe, "data-close-visible") !== "false"
    || attr(probe, "data-classification-legend-visible") !== "false"
    || attr(probe, "data-ten-gods-visible") !== "false"
    || !Number.isFinite(readoutInstrumentTop)
    || readoutInstrumentTop < taskTopMin
    || readoutInstrumentTop > taskTopMax
  ) {
    throw new Error(`find-time ${label} leaked unrelated Tools chrome into the single-task surface: ${fixtureURL} · ${probe}`);
  }

  const shot = spawnSync(browser, [...commonArgs, `--screenshot=${outputPath}`, fixtureURL], {
    encoding:"utf8",
    timeout:45_000,
    killSignal:"SIGKILL"
  });
  if (shot.status !== 0) {
    process.stderr.write(shot.stdout ?? "");
    process.stderr.write(shot.stderr ?? "");
    throw new Error(`find-time ${label} screenshot failed: ${fixtureURL}`);
  }
  const info = await stat(outputPath);
  if (info.size < 10_000) {
    throw new Error(`find-time ${label} screenshot is unexpectedly small (${info.size} bytes)`);
  }
  console.log(`[visual] ${outputName}: ${info.size} bytes · wheel-native find-time · readout ${left.toFixed(1)}..${right.toFixed(1)} × ${top.toFixed(1)}..${bottom.toFixed(1)}px`);
}

await captureReview({
  label:"mobile",
  width:390,
  height:844,
  windowWidth:500,
  windowHeight:844,
  outputName:"annual-find-time-390x844.png"
});

await captureReview({
  label:"desktop",
  width:1440,
  height:900,
  windowWidth:1440,
  windowHeight:900,
  outputName:"annual-find-time-1440x900.png"
});

await captureReview({
  label:"wide desktop",
  width:2047,
  height:1038,
  windowWidth:2047,
  windowHeight:1038,
  outputName:"annual-find-time-2047x1038.png"
});

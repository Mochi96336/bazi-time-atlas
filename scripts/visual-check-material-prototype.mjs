import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const instant = "2026-09-13T23%3A43%3A42.000Z";
const modes = ["svg", "roughness"];
const viewports = [
  { key:"2047x1038", width:2047, height:1038, mobile:false },
  { key:"1440x900", width:1440, height:900, mobile:false },
  { key:"390x844", width:390, height:844, mobile:true }
];

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function materialPath(mode) {
  return "?material=" + encodeURIComponent(mode) + "&instant=" + instant;
}

function mobileHarnessPath(target, height) {
  const params = new URLSearchParams({ target:"../../" + target, height:String(height) });
  return "scripts/fixtures/mobile-390.html?" + params.toString();
}

function chromiumBaseArgs() {
  return [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader-webgl",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2600"
  ];
}

function probeMode(browser, mode) {
  const pathName = materialPath(mode);
  const url = new URL(pathName, baseURL).href;
  const result = spawnSync(browser, [
    ...chromiumBaseArgs(),
    "--window-size=1440,900",
    "--dump-dom",
    url
  ], { encoding:"utf8", timeout:45_000, killSignal:"SIGKILL" });

  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error("Material DOM probe failed for " + mode);
  }

  if (mode === "svg") {
    if (/data-material-prototype="roughness"/.test(result.stdout)) {
      throw new Error("SVG baseline unexpectedly activated the shader");
    }
    return;
  }

  const expected = 'data-material-prototype="' + mode + '"';
  if (!result.stdout.includes(expected)) {
    throw new Error("Shader mode did not become active for " + mode);
  }
}

function probeDefaultProduction(browser) {
  const url = new URL("?instant=" + instant, baseURL).href;
  const result = spawnSync(browser, [
    ...chromiumBaseArgs(),
    "--window-size=1440,900",
    "--dump-dom",
    url
  ], { encoding:"utf8", timeout:45_000, killSignal:"SIGKILL" });

  if (result.status !== 0) throw new Error("Default material production probe failed");
  if (!result.stdout.includes('data-material-prototype="roughness"')) {
    throw new Error("Default production material did not activate roughness after idle");
  }
}

function probeForcedFallback(browser) {
  const url = new URL("?material=roughness&materialWebgl=off&instant=" + instant, baseURL).href;
  const result = spawnSync(browser, [
    ...chromiumBaseArgs(),
    "--window-size=1440,900",
    "--dump-dom",
    url
  ], { encoding:"utf8", timeout:45_000, killSignal:"SIGKILL" });

  if (result.status !== 0) throw new Error("Forced material fallback probe failed");
  if (!result.stdout.includes('data-material-prototype-fallback="forced"')) {
    throw new Error("Forced WebGL failure did not expose the SVG fallback state");
  }
  if (/data-material-prototype="roughness"/.test(result.stdout)) {
    throw new Error("Forced fallback left shader mode active");
  }
}

await mkdir(outputDir, { recursive:true });
const browser = findBrowser();
for (const mode of modes) probeMode(browser, mode);
probeDefaultProduction(browser);
probeForcedFallback(browser);

const evidence = [];
for (const mode of modes) {
  for (const viewport of viewports) {
    const directPath = materialPath(mode);
    const requestedPath = viewport.mobile
      ? mobileHarnessPath(directPath, viewport.height)
      : directPath;
    const browserWidth = viewport.mobile ? 500 : viewport.width;
    const url = new URL(requestedPath, baseURL).href;
    const outputName = "material-" + mode + "-" + viewport.key + ".png";
    const outputPath = path.join(outputDir, outputName);
    const result = spawnSync(browser, [
      ...chromiumBaseArgs(),
      "--window-size=" + browserWidth + "," + viewport.height,
      "--screenshot=" + outputPath,
      url
    ], { encoding:"utf8", timeout:45_000, killSignal:"SIGKILL" });

    if (result.status !== 0) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      throw new Error("Material screenshot failed for " + outputName);
    }

    const info = await stat(outputPath);
    if (info.size < 10_000) throw new Error(outputName + " is unexpectedly small (" + info.size + " bytes)");
    evidence.push({
      file:outputName,
      mode,
      viewport:viewport.key,
      trueMobileHarness:viewport.mobile,
      bytes:info.size,
      url
    });
    console.log("[visual-material] " + outputName + ": " + info.size + " bytes");
  }
}

await writeFile(
  path.join(outputDir, "material-prototype-evidence.json"),
  JSON.stringify({ browser, baseURL, captures:evidence }, null, 2) + "\n",
  "utf8"
);

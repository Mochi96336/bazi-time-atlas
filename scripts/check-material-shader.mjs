import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const launchAttempts = 2;
const launchTimeoutMs = 45_000;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function launchMaterialProbe(browser, url) {
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader-webgl",
    "--virtual-time-budget=2200",
    "--window-size=1440,900",
    "--dump-dom",
    url
  ];
  let lastResult = null;

  for (let attempt = 1; attempt <= launchAttempts; attempt += 1) {
    const result = spawnSync(browser, args, {
      encoding:"utf8",
      timeout:launchTimeoutMs,
      killSignal:"SIGKILL"
    });
    if (result.status === 0) return result;

    lastResult = result;
    const timedOut = result.error?.code === "ETIMEDOUT";
    const reason = timedOut
      ? `timed out after ${launchTimeoutMs} ms`
      : `exited with status ${result.status ?? "unknown"}${result.signal ? ` / ${result.signal}` : ""}`;
    if (attempt < launchAttempts) {
      console.warn(`[material-shader] RETRY launch: attempt ${attempt}/${launchAttempts} ${reason}`);
    }
  }

  process.stderr.write(lastResult?.stdout ?? "");
  process.stderr.write(lastResult?.stderr ?? "");
  throw new Error("Material shader activation probe failed to launch Chromium after bounded retry");
}

const browser = findBrowser();
const url = new URL("?material=roughness&instant=2026-09-13T23%3A43%3A42.000Z", baseURL).href;
const result = launchMaterialProbe(browser, url);

if (!result.stdout.includes('data-material-prototype="roughness"')) {
  const fallback = result.stdout.match(/data-material-prototype-fallback="([^"]*)"/)?.[1] ?? "missing";
  const detail = result.stdout.match(/data-material-prototype-error="([^"]*)"/)?.[1] ?? "no compiler detail";
  throw new Error("roughness shader inactive · fallback=" + fallback + " · detail=" + detail);
}

console.log("[material-shader] PASS roughness shader compiled and activated");

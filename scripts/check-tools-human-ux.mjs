import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const fixturePath = "scripts/fixtures/tools-human-ux.html";

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

function runScenario(scenario) {
  const url = new URL(fixturePath, baseURL);
  url.searchParams.set("scenario", scenario);
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=5000",
    "--force-device-scale-factor=1",
    "--window-size=1440,900",
    "--dump-dom",
    url.href
  ], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Tools human UX scenario failed to load: ${scenario}`);
  }
  const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
  if (attr(probe, "data-ready") !== "true") {
    throw new Error(`Tools human UX scenario did not settle: ${scenario} · ${probe}`);
  }
  return { url:url.href, probe };
}

{
  const { url, probe } = runScenario("find-time");
  if (
    attr(probe, "data-first-tools-open") !== "true"
    || attr(probe, "data-first-find-time") !== "available"
    || attr(probe, "data-first-find-pressed") !== "false"
    || attr(probe, "data-second-tools-open") !== "false"
  ) {
    throw new Error(`Find Time Escape did not pop exactly one layer: ${url} · ${probe}`);
  }
}

{
  const { url, probe } = runScenario("inspector");
  if (
    attr(probe, "data-first-tools-open") !== "true"
    || attr(probe, "data-first-inspector-open") !== "false"
    || attr(probe, "data-first-inspector-hidden") !== "true"
    || attr(probe, "data-second-tools-open") !== "false"
  ) {
    throw new Error(`Ganzhi inspector Escape did not pop exactly one layer: ${url} · ${probe}`);
  }
}

{
  const { url, probe } = runScenario("preserve");
  if (
    attr(probe, "data-before-reference") !== "day"
    || attr(probe, "data-before-classification") !== "on"
    || attr(probe, "data-closed-tools-open") !== "false"
    || attr(probe, "data-closed-reference") !== "day"
    || attr(probe, "data-closed-classification") !== "on"
    || attr(probe, "data-reopened-tools-open") !== "true"
    || attr(probe, "data-reopened-reference") !== "day"
    || attr(probe, "data-reopened-classification") !== "on"
  ) {
    throw new Error(`Tools close/reopen did not preserve observation settings: ${url} · ${probe}`);
  }
}

console.log("[tools-human-ux] PASS one-layer Escape + preserved observation settings");

// Repair A2: every README feature needs a visible, hit-testable entry point
// at desktop 1440x900 and mobile 390x844. See docs/repair-plan.md.
import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const fixturePath = "scripts/fixtures/feature-reachability.html";

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

let failed = false;
for (const viewport of ["desktop", "mobile"]) {
  const url = new URL(fixturePath, baseURL);
  url.searchParams.set("viewport", viewport);
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=12000",
    "--force-device-scale-factor=1",
    "--window-size=1440,900",
    "--dump-dom",
    url.href
  ], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Feature reachability probe failed to load: ${viewport}`);
  }
  const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
  const error = attr(probe, "data-error");
  const failures = attr(probe, "data-failures");
  const checked = Number(attr(probe, "data-checked"));
  if (attr(probe, "data-ready") !== "true" || error || !(checked >= 12) || failures) {
    failed = true;
    console.error(`[reachability] ${viewport} FAILED · checked=${checked} · error=${error ?? "-"} · failures=${failures || "-"}`);
  } else {
    console.log(`[reachability] ${viewport} ok · ${checked} entry points reachable`);
  }
}
if (failed) process.exit(1);

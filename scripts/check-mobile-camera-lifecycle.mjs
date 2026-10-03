import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

let browser = process.env.CHROMIUM_BIN;
if (!browser) {
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", "command -v " + name], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) { browser = probe.stdout.trim(); break; }
  }
}
if (!browser) throw new Error("No Chromium for mobile camera lifecycle contract");
const url = new URL("scripts/fixtures/mobile-camera-lifecycle.html",
  process.env.BASE_URL ?? "http://127.0.0.1:4173/");
const args = ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--force-device-scale-factor=3", "--enable-unsafe-swiftshader", "--use-angle=swiftshader-webgl",
  "--window-size=600,900", "--virtual-time-budget=6500"];
const run = spawnSync(browser, [...args, "--dump-dom", url.href],
  { encoding:"utf8", timeout:65000, killSignal:"SIGKILL", maxBuffer:12 * 1024 * 1024 });
const proof = run.stdout?.match(/<pre id="proof"[^>]*>([\s\S]*?)<\/pre>/);
if (run.status !== 0 || !proof?.[0].includes('data-ready="true"')) {
  throw new Error("Mobile camera lifecycle failed: " + (proof?.[0] ?? run.stderr));
}
const evidence = JSON.parse(proof[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
const out = path.resolve("tmp/visual-check");
await mkdir(out, { recursive:true });
await writeFile(path.join(out, "mobile-camera-lifecycle.json"), JSON.stringify(evidence, null, 2));
url.searchParams.set("capture", "1");
const capture = spawnSync(browser, [...args, "--screenshot=" + path.join(out, "mobile-camera-recovered-390x844.png"), url.href],
  { encoding:"utf8", timeout:65000, killSignal:"SIGKILL", maxBuffer:2 * 1024 * 1024 });
if (capture.status !== 0) throw new Error("Mobile camera recovery screenshot failed: " + capture.stderr);
console.log("Mobile camera lifecycle contract:", JSON.stringify(evidence));

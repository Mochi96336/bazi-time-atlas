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
if (!browser) throw new Error("No Chromium for mobile material workload contract");
const results = [];
for (const full of [false, true]) {
  const url = new URL("scripts/fixtures/mobile-material-budget.html" + (full ? "?full=1" : ""),
    process.env.BASE_URL ?? "http://127.0.0.1:4173/").href;
  const run = spawnSync(browser, ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--force-device-scale-factor=3", "--enable-unsafe-swiftshader", "--use-angle=swiftshader-webgl",
    "--window-size=600,900", "--virtual-time-budget=6500", "--dump-dom", url],
    { encoding:"utf8", timeout:65000, killSignal:"SIGKILL", maxBuffer:12 * 1024 * 1024 });
  const proof = run.stdout?.match(/<pre id="proof"[^>]*>([\s\S]*?)<\/pre>/);
  if (run.status !== 0 || !proof?.[0].includes('data-ready="true"')) {
    throw new Error("Mobile material workload contract failed: " + (proof?.[0] ?? run.stderr));
  }
  results.push(JSON.parse(proof[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&")));
}
const [mobile, full] = results;
const pixels = value => value.canvasPixels[0] * value.canvasPixels[1];
if (Math.abs(pixels(mobile) / pixels(full) - 0.25) > 0.002) {
  throw new Error("DPR3 mobile must submit one quarter of full-budget bitmap pixels");
}
await mkdir(path.resolve("tmp/visual-check"), { recursive:true });
await writeFile(path.resolve("tmp/visual-check/mobile-material-budget.json"), JSON.stringify(results, null, 2));
console.log("Mobile material workload contract:", JSON.stringify(results));

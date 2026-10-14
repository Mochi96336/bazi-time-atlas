import { spawnSync } from "node:child_process";

let browser = process.env.CHROMIUM_BIN;
if (!browser) {
  for (const executable of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", "command -v " + executable], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) {
      browser = probe.stdout.trim();
      break;
    }
  }
}
if (!browser) throw new Error("No Chromium for home → Research → home camera regression");

const root = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
for (const mode of ["mobile", "desktop"]) {
  const url = new URL("scripts/fixtures/camera-history-navigation.html", root);
  url.searchParams.set("mode", mode);
  const args = [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader", "--use-angle=swiftshader-webgl",
    "--run-all-compositor-stages-before-draw",
    "--window-size=" + (mode === "mobile" ? "600,950" : "1700,1080"),
    "--virtual-time-budget=45000", "--dump-dom", url.href
  ];
  const run = spawnSync(browser, args, {
    encoding:"utf8", timeout:100000, killSignal:"SIGKILL",
    maxBuffer:16*1024*1024
  });
  const proof = run.stdout?.match(/<pre id="proof"[^>]*>([\s\S]*?)<\/pre>/);
  if (run.status !== 0 || !proof?.[0].includes('data-ready="true"')) {
    throw new Error("Home / Research camera history regression failed (" + mode + "): "
      + (proof?.[0] ?? run.stdout?.slice(-1200) ?? run.stderr)
      + "\n" + (run.stderr ?? "").slice(-1200));
  }
  const evidence = JSON.parse(proof[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  if (!evidence.browserBack || !evidence.researchNav || !evidence.backgroundCameraAligned) {
    throw new Error("Incomplete navigation evidence: " + JSON.stringify(evidence));
  }
  console.log("[camera-history-navigation] PASS", JSON.stringify(evidence));
}

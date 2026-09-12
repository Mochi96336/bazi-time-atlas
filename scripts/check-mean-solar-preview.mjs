import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dumpDom(path) {
  const browser = findBrowser();
  const url = new URL(path, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=1400",
    "--dump-dom",
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium mean-solar probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

const cases = [
  {
    path: "birth.html",
    label: "default equivalent-meridian preview stays zero-correction",
    assert(dom) {
      return /data-longitude="120\.0000"/.test(dom) &&
        /data-mean-solar-correction-minutes="0\.0000"/.test(dom) &&
        /data-mean-solar-clock="08:37:00"/.test(dom) &&
        /id="mean-solar-preview"/.test(dom) &&
        /地方平太陽時/.test(dom) &&
        /尚未加入均時差/.test(dom);
    },
  },
  {
    path: "birth.html?lon=121.5",
    label: "121.5E at UTC+8 advances local mean solar time by six minutes",
    assert(dom) {
      return /data-longitude="121\.5000"/.test(dom) &&
        /data-mean-solar-correction-minutes="6\.0000"/.test(dom) &&
        /data-mean-solar-clock="08:43:00"/.test(dom) &&
        /id="mean-solar-time"[^>]*>08:43:00<\/b>/.test(dom) &&
        /id="mean-solar-correction"[^>]*>\+6\.00 min<\/span>/.test(dom) &&
        /E121\.5000°/.test(dom);
    },
  },
];

for (const testCase of cases) {
  const { url, dom } = dumpDom(testCase.path);
  if (!testCase.assert(dom)) {
    throw new Error(`${testCase.label} did not resolve expected state: ${url}`);
  }
  console.log(`[mean-solar] PASS ${testCase.label}: ${url}`);
}

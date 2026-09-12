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
    "--virtual-time-budget=900",
    "--dump-dom",
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

const cases = [
  {
    path: "?month=%E5%AD%90",
    label: "Annual month deep link",
    assert(dom) {
      return /id="center-value"[^>]*>子月<\/text>/.test(dom) &&
        /id="detail-title"[^>]*>子月<\/h2>/.test(dom);
    },
  },
  {
    path: "sexagenary.html?ganzhi=%E4%B9%99%E9%85%89",
    label: "Sexagenary Gan-Zhi deep link",
    assert(dom) {
      return /id="cycle-center-value"[^>]*>乙酉<\/text>/.test(dom) &&
        /id="cycle-title"[^>]*>乙酉<\/h2>/.test(dom);
    },
  },
];

for (const testCase of cases) {
  const { url, dom } = dumpDom(testCase.path);
  if (!testCase.assert(dom)) {
    throw new Error(`${testCase.label} did not resolve expected selection: ${url}`);
  }
  console.log(`[deep-link] PASS ${testCase.label}: ${url}`);
}

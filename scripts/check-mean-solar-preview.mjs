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
    throw new Error(`Chromium solar-time probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

function dataValue(dom, name) {
  return dom.match(new RegExp(`data-${name}="([^"]+)"`))?.[1] ?? null;
}

function dataNumber(dom, name) {
  const value = Number(dataValue(dom, name));
  return Number.isFinite(value) ? value : Number.NaN;
}

function coherentCorrections(dom, expectedLongitudeMinutes) {
  const longitude = dataNumber(dom, "mean-solar-correction-minutes");
  const equation = dataNumber(dom, "equation-of-time-minutes");
  const total = dataNumber(dom, "total-solar-correction-minutes");
  return Math.abs(longitude - expectedLongitudeMinutes) < 0.0001 &&
    equation > 0.9 && equation < 1.3 &&
    Math.abs(total - longitude - equation) < 0.0002;
}

function basisRow(dom, basis) {
  return dom.match(new RegExp(`<div[^>]*class="time-basis-sensitivity-row"[^>]*data-time-basis="${basis}"[^>]*>`))?.[0] ?? "";
}

const cases = [
  {
    path: "birth.html",
    label: "default equivalent meridian keeps LMST unchanged and pillars insensitive",
    assert(dom) {
      return /data-longitude="120\.0000"/.test(dom) &&
        /data-mean-solar-correction-minutes="0\.0000"/.test(dom) &&
        /data-mean-solar-clock="08:37:00"/.test(dom) &&
        /^08:38:/.test(dataValue(dom, "apparent-solar-clock") ?? "") &&
        coherentCorrections(dom, 0) &&
        /id="mean-solar-preview"/.test(dom) &&
        /地方太陽時比較/.test(dom) &&
        /平太陽時/.test(dom) &&
        /均時差 EoT/.test(dom) &&
        /視太陽時/.test(dom) &&
        /data-time-basis-sensitive="0"/.test(dom) &&
        /id="time-basis-sensitivity-summary"[^>]*>未跨界 · 三種基準皆為 辛巳日 \/ 壬辰時<\/strong>/.test(dom);
    },
  },
  {
    path: "birth.html?lon=121.5",
    label: "121.5E combines longitude and EoT without changing the ordinary chart",
    assert(dom) {
      return /data-longitude="121\.5000"/.test(dom) &&
        /data-mean-solar-correction-minutes="6\.0000"/.test(dom) &&
        /data-mean-solar-clock="08:43:00"/.test(dom) &&
        /^08:44:/.test(dataValue(dom, "apparent-solar-clock") ?? "") &&
        coherentCorrections(dom, 6) &&
        /id="mean-solar-time"[^>]*>08:43:00<\/b>/.test(dom) &&
        /id="mean-solar-correction"[^>]*>\+6\.00 min<\/em>/.test(dom) &&
        /id="equation-of-time"[^>]*>\+1\.[0-2]\d min<\/b>/.test(dom) &&
        /id="apparent-solar-time"[^>]*>08:44:[0-5]\d<\/b>/.test(dom) &&
        /data-time-basis-sensitive="0"/.test(dom) &&
        /E121\.5000°/.test(dom);
    },
  },
  {
    path: "birth.html?date=2005-12-23&time=22%3A55&utc=8&lon=121.5",
    label: "solar correction crosses Zi-initial and exposes Day + Hour sensitivity",
    assert(dom) {
      const civil = basisRow(dom, "civil");
      const mean = basisRow(dom, "local-mean-solar");
      const apparent = basisRow(dom, "local-apparent-solar");
      return /id="birth-readout"[^>]*>2005-12-23 · 22:55<\/h2>/.test(dom) &&
        /data-time-basis-sensitive="1"/.test(dom) &&
        /data-day-sensitive="1"/.test(dom) &&
        /data-hour-sensitive="1"/.test(dom) &&
        civil.includes('data-day-pillar="辛巳"') &&
        civil.includes('data-hour-pillar="己亥"') &&
        civil.includes('data-day-changed="false"') &&
        civil.includes('data-hour-changed="false"') &&
        mean.includes('data-day-pillar="壬午"') &&
        mean.includes('data-hour-pillar="庚子"') &&
        mean.includes('data-day-changed="true"') &&
        mean.includes('data-hour-changed="true"') &&
        apparent.includes('data-day-pillar="壬午"') &&
        apparent.includes('data-hour-pillar="庚子"') &&
        apparent.includes('data-day-changed="true"') &&
        apparent.includes('data-hour-changed="true"') &&
        /id="time-basis-sensitivity-summary"[^>]*>已跨 日界 \+ 時辰界 · 下列僅比較，不自動改盤<\/strong>/.test(dom);
    },
  },
];

for (const testCase of cases) {
  const { url, dom } = dumpDom(testCase.path);
  if (!testCase.assert(dom)) {
    throw new Error(`${testCase.label} did not resolve expected state: ${url}`);
  }
  console.log(`[solar-time] PASS ${testCase.label}: ${url}`);
}

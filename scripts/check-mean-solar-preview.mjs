import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dumpDom(path, virtualTimeBudget = 1800) {
  const browser = findBrowser();
  const url = new URL(path, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--virtual-time-budget=${virtualTimeBudget}`,
    "--dump-dom",
    url,
  ], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium solar-time probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function dataValue(dom, name) {
  return dom.match(new RegExp(`data-${name}="([^"]+)"`))?.[1] ?? null;
}

function dataNumber(dom, name) {
  const value = Number(dataValue(dom, name));
  return Number.isFinite(value) ? value : Number.NaN;
}

function correctionComposition(dom, expectedLongitudeMinutes) {
  const longitude = dataNumber(dom, "mean-solar-correction-minutes");
  const equation = dataNumber(dom, "equation-of-time-minutes");
  const total = dataNumber(dom, "total-solar-correction-minutes");
  return Math.abs(longitude - expectedLongitudeMinutes) < 0.0001 &&
    Number.isFinite(equation) &&
    Math.abs(total - longitude - equation) < 0.0002;
}

function coherentCorrections(dom, expectedLongitudeMinutes) {
  const equation = dataNumber(dom, "equation-of-time-minutes");
  return correctionComposition(dom, expectedLongitudeMinutes) &&
    equation > 0.9 && equation < 1.3;
}

function basisRow(dom, basis) {
  return dom.match(new RegExp(`<div[^>]*class="time-basis-sensitivity-row"[^>]*data-time-basis="${basis}"[^>]*>`))?.[0] ?? "";
}

function atlasBasisRow(dom, basis) {
  return dom.match(new RegExp(`<div[^>]*class="atlas-solar-basis-row"[^>]*data-time-basis="${basis}"[^>]*>`))?.[0] ?? "";
}

const cases = [
  {
    path:"birth.html",
    label:"default equivalent meridian keeps LMST unchanged and pillars insensitive",
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
    path:"birth.html?lon=121.5",
    label:"121.5E combines longitude and EoT without changing the ordinary chart",
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
    path:"birth.html?date=2005-12-23&time=22%3A55&utc=8&lon=121.5",
    label:"solar correction crosses Zi-initial and exposes Day + Hour sensitivity",
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

const instant = "2005-12-23T14:55:00.000Z";
const selectedMs = String(Date.parse(instant));

{
  const { url, dom } = dumpDom(`?instant=${encodeURIComponent(instant)}`);
  const panel = dom.match(/<section[^>]*id="atlas-solar-time-analysis"[^>]*>/)?.[0] ?? "";
  if (!panel.includes("hidden") || !panel.includes('data-longitude-bound="false"')) {
    throw new Error(`Atlas solar-time analysis leaked into the default reading view: ${url}`);
  }
  if (!dom.includes(`data-selected-instant-ms="${selectedMs}"`)) {
    throw new Error(`Atlas default solar-time probe changed Selected Instant: ${url}`);
  }
  console.log(`[solar-time] PASS Atlas default view keeps solar-time analysis hidden: ${url}`);
}

{
  const { url, dom } = dumpDom(`?instant=${encodeURIComponent(instant)}&analysis=1`);
  const panel = dom.match(/<section[^>]*id="atlas-solar-time-analysis"[^>]*>/)?.[0] ?? "";
  if (panel.includes("hidden") || !panel.includes('data-ready="true"') || !panel.includes('data-longitude-bound="false"')) {
    throw new Error(`Atlas Analysis did not fail closed without explicit longitude: ${url}`);
  }
  if (!dom.includes("UTC offset 不會被當成地理經度")) {
    throw new Error(`Atlas Analysis did not explain the unbound longitude state: ${url}`);
  }
  if (!dom.includes(`data-selected-instant-ms="${selectedMs}"`)) {
    throw new Error(`unbound Atlas solar-time analysis changed Selected Instant: ${url}`);
  }
  console.log(`[solar-time] PASS Atlas Analysis requires explicit longitude: ${url}`);
}

{
  const { url, dom } = dumpDom(`?instant=${encodeURIComponent(instant)}&analysis=1&lon=999`);
  const panel = dom.match(/<section[^>]*id="atlas-solar-time-analysis"[^>]*>/)?.[0] ?? "";
  const input = dom.match(/<input[^>]*id="atlas-solar-longitude"[^>]*>/)?.[0] ?? "";
  if (panel.includes("hidden") ||
      !panel.includes('data-ready="true"') ||
      !panel.includes('data-longitude-bound="false"') ||
      panel.includes("data-mean-solar-correction-minutes") ||
      !input.includes('aria-invalid="true"') ||
      !dom.includes("經度需為 −180° 至 +180° 的有限數字") ||
      !dom.includes(`data-selected-instant-ms="${selectedMs}"`)) {
    throw new Error(`Atlas Analysis did not preserve invalid-longitude fail-closed state: ${url}`);
  }
  console.log(`[solar-time] PASS Atlas Analysis keeps invalid longitude distinct from unbound longitude: ${url}`);
}

{
  const { url, dom } = dumpDom(`?instant=${encodeURIComponent(instant)}&analysis=1&lon=121.5`);
  const panel = dom.match(/<section[^>]*id="atlas-solar-time-analysis"[^>]*>/)?.[0] ?? "";
  const civil = atlasBasisRow(dom, "civil");
  const mean = atlasBasisRow(dom, "local-mean-solar");
  const apparent = atlasBasisRow(dom, "local-apparent-solar");
  const ok = !panel.includes("hidden") &&
    panel.includes('data-ready="true"') &&
    panel.includes('data-longitude-bound="true"') &&
    panel.includes('data-longitude="121.5000"') &&
    panel.includes('data-time-basis-sensitive="1"') &&
    panel.includes('data-day-sensitive="1"') &&
    panel.includes('data-hour-sensitive="1"') &&
    panel.includes(`data-selected-instant-ms="${selectedMs}"`) &&
    correctionComposition(panel, 6) &&
    civil.includes('data-day-pillar="辛巳"') &&
    civil.includes('data-hour-pillar="己亥"') &&
    mean.includes('data-day-pillar="壬午"') &&
    mean.includes('data-hour-pillar="庚子"') &&
    apparent.includes('data-day-pillar="壬午"') &&
    apparent.includes('data-hour-pillar="庚子"') &&
    /id="atlas-solar-sensitivity-summary"[^>]*>已跨 日界 \+ 時辰界 · 僅比較<\/strong>/.test(dom);
  if (!ok) {
    throw new Error(`Atlas solar-time Analysis did not match Birth sensitivity semantics: ${url}`);
  }
  console.log(`[solar-time] PASS Atlas Analysis matches explicit-longitude Day/Hour sensitivity without Selected-Instant mutation: ${url}`);
}

{
  const { url, dom } = dumpDom("scripts/fixtures/atlas-solar-time-lifecycle.html", 5000);
  const probe = dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0] ?? "";
  const attr = name => probe.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
  if (attr("data-ready") !== "true") {
    throw new Error(`Atlas longitude lifecycle fixture did not settle (${attr("data-error") ?? "no error detail"}): ${url}`);
  }
  const expectedPillars = "乙酉|戊子|辛巳|己亥";
  for (const phase of ["before", "invalid", "valid", "cleared"]) {
    if (attr(`data-${phase}-selected-ms`) !== selectedMs ||
        attr(`data-${phase}-scale`) !== "year" ||
        attr(`data-${phase}-playback`) !== "false" ||
        attr(`data-${phase}-pillars`) !== expectedPillars) {
      throw new Error(`Atlas longitude ${phase} lifecycle changed time authority: ${url}`);
    }
  }
  if (attr("data-before-url-lon") !== "121.5" ||
      attr("data-before-bound") !== "true" ||
      attr("data-invalid-url-lon") !== "121.5" ||
      attr("data-invalid-bound") !== "false" ||
      attr("data-invalid-invalid") !== "true" ||
      attr("data-valid-url-lon") !== "120" ||
      attr("data-valid-bound") !== "true" ||
      attr("data-valid-longitude") !== "120.0000" ||
      attr("data-cleared-url-lon") !== "" ||
      attr("data-cleared-bound") !== "false") {
    throw new Error(`Atlas longitude URL persistence lifecycle violated fail-closed/share semantics: ${url}`);
  }
  console.log(`[solar-time] PASS Atlas longitude edit lifecycle preserves invalid URL authority, persists valid lon, clears only explicit empty input, and never changes Selected Instant/scale/playback/canonical pillars: ${url}`);
}
